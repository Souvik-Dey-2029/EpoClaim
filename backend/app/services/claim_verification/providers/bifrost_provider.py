"""Bifrost-backed semantic reasoning provider.

Implements asynchronous, batched proposition-to-evidence interpretation using
an OpenAI-compatible chat completions interface through Bifrost / litellm.
Adheres strictly to zero external calls when unconfigured or disabled,
bounded retries, strict JSON extraction, and evidence quote verification.
"""
from __future__ import annotations

import json
import logging
import time
import asyncio
import random
from typing import Any, Dict, List, Optional, Set
import httpx

from app.core.config import settings
from app.schemas.claims import StructuredProposition, PropositionPolarity, EpistemicModality
from app.schemas.correction import PropositionCorrectionUnit, CorrectionOperationType
from app.services.claim_extraction.validator import PropositionExtractionValidator
from app.services.claim_verification.llm_interface import (
    BaseSemanticReasoningProvider,
    ExtractionRequest,
    ExtractionResponse,
    EvidenceAssessmentRequest,
    EvidenceAssessmentResponse,
    BatchAssessmentRequest,
    BatchAssessmentResponse,
    PairAssessmentResult,
    AssessmentRelation,
    CorrectionGenerationRequest,
    CorrectionGenerationResponse,
)

logger = logging.getLogger(__name__)

CORRECTION_SYSTEM_PROMPT = (
    "You are a factual answer correction component, not a general-purpose conversational assistant. "
    "Your task is to synthesize grounded correction units strictly addressing provided propositions. "
    "Rules:\n"
    "1. For REPHRASE_SUPPORTED: Preserve the verified subject, object, relation, numbers, dates, polarity, and modality. Do not add outside facts.\n"
    "2. For REPLACE_OUTDATED: Replace the outdated value using strictly the facts present in the eligible cited evidence. Retain the subject anchor.\n"
    "3. Citing: You must cite ONLY evidence IDs provided in the authorized evidence whitelist for each proposition. Do not invent citation IDs or numbers.\n"
    "4. Output format: Return JSON with an array 'correction_units', each having 'proposition_id', 'operation', 'text', 'cited_evidence_ids', 'change_type', and 'explanation'."
)

DECOMPOSITION_SYSTEM_PROMPT = (
    "You are a factual claim decomposition component. "
    "Your task is to decompose a complex sentence into atomic, self-contained structured propositions. "
    "Rules:\n"
    "1. Preserve the original meaning exactly without adding, altering, or omitting factual content.\n"
    "2. Do not use external knowledge or make unsupported assumptions.\n"
    "3. Keep original polarity (POSITIVE or NEGATIVE).\n"
    "4. Retain conditions, qualifications, and temporal bounds.\n"
    "5. Capture epistemic modality: ASSERTED, POSSIBLE, CONDITIONAL, ALLEGED, REPORTED, PLANNED, or UNKNOWN.\n"
    "6. Separate independent clauses with different subjects into distinct propositions.\n"
    "7. For shared subjects, produce separate propositions sharing that subject.\n"
    "8. Preserve attribution frames (e.g. 'Officials reported that X' -> attribution framing / modality REPORTED or separate proposition).\n"
    "9. original_text_span must be an exact verbatim substring from the input sentence.\n"
    "Return JSON with an array 'propositions'."
)

SYSTEM_PROMPT = (
    "You are an evidence interpretation component, not a general-purpose fact-answering system. "
    "Evaluate only the supplied proposition against the supplied evidence passage. "
    "Do not use prior knowledge, browsing, assumptions, or facts absent from the passage. "
    "A passage supports a proposition only when its meaning entails the proposition. Similar wording is not sufficient. "
    "A passage contradicts a proposition only when it provides incompatible factual information. "
    "If the passage is related but does not establish either side, classify it as NEUTRAL. "
    "If the passage is too ambiguous or incomplete to assess, classify it as INSUFFICIENT. "
    "Preserve negation, quantities, dates, modality, conditions, entity identity, and temporal qualifiers. "
    "Return only the required structured JSON response with an array 'assessments'."
)


class BifrostSemanticProvider(BaseSemanticReasoningProvider):
    """Bifrost / OpenAI-compatible semantic reasoning provider."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        raw_base = (base_url or settings.bifrost_base_url or settings.bifrost_endpoint).rstrip("/")
        if raw_base and not raw_base.endswith("/v1"):
            # Ensure base_url has /v1 prefix for OpenAI-compatible completions
            self._base_url = f"{raw_base}/v1"
        else:
            self._base_url = raw_base
        self._model = model or settings.bifrost_model
        self._api_key = api_key or settings.bifrost_api_key
        self._timeout = timeout_seconds if timeout_seconds is not None else settings.bifrost_timeout_seconds
        self._max_retries = max_retries if max_retries is not None else settings.bifrost_max_retries
        self._custom_client = http_client
        self._last_connect_failure_time: float = 0.0
        self._cooldown_seconds: float = 30.0

    @staticmethod
    def _calculate_backoff_delay(attempt: int, base_delay: float = 0.5, max_delay: float = 5.0) -> float:
        """Calculate bounded exponential backoff with full jitter to handle transient 503/429 errors."""
        # Exponential backoff: base_delay * 2^(attempt - 1)
        exp_delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
        # Full jitter between 0 and exp_delay to distribute burst concurrent requests
        return random.uniform(0.1, exp_delay)

    @property
    def provider_name(self) -> str:
        return "bifrost"

    @property
    def is_available(self) -> bool:
        """Check if provider is configured and available for any semantic reasoning task."""
        if not self._base_url:
            return False
        # If gateway experienced connection failure recently, remain in cooldown
        if self._last_connect_failure_time > 0 and (time.monotonic() - self._last_connect_failure_time) < self._cooldown_seconds:
            return False
        return (
            settings.enable_llm_semantic_assessment
            or settings.enable_llm_claim_decomposition
            or settings.enable_llm_answer_correction
        )

    @property
    def is_claim_decomposition_available(self) -> bool:
        """Check if provider is available and enabled specifically for claim decomposition.
        
        Requires BOTH enable_llm_semantic_assessment and enable_llm_claim_decomposition to be True.
        """
        if not (settings.enable_llm_semantic_assessment and settings.enable_llm_claim_decomposition):
            return False
        if not self._base_url:
            return False
        return True

    @property
    def is_correction_generation_available(self) -> bool:
        """Check if provider is available and enabled specifically for answer correction.
        
        Requires BOTH enable_llm_semantic_assessment and enable_llm_answer_correction to be True.
        """
        if not (settings.enable_llm_semantic_assessment and settings.enable_llm_answer_correction):
            return False
        if not self._base_url:
            return False
        return True

    @property
    def is_semantic_assessment_available(self) -> bool:
        """Check if provider is available and enabled specifically for evidence assessment."""
        if not settings.enable_llm_semantic_assessment:
            return False
        if not self._base_url:
            return False
        return True

    async def _get_client(self) -> httpx.AsyncClient:
        if self._custom_client is not None:
            return self._custom_client
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return httpx.AsyncClient(base_url=self._base_url, headers=headers, timeout=self._timeout)

    def _parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Safely parse JSON response with markdown fence handling."""
        if not raw_text or not raw_text.strip():
            raise ValueError("Empty response received from Bifrost.")

        clean_text = raw_text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.strip("`")
            if clean_text.lower().startswith("json"):
                clean_text = clean_text[4:].strip()

        return json.loads(clean_text)

    def _build_decomposition_payload(self, request: ExtractionRequest) -> Dict[str, Any]:
        """Build chat completion payload for claim decomposition."""
        parent_id = request.claim_id or "claim_0"
        sentence = request.sentence_text or request.response_text

        user_content = (
            f"Decompose the following sentence into atomic factual propositions for parent_claim_id '{parent_id}':\n"
            f"Sentence: \"{sentence}\"\n\n"
            f"Provide a JSON object adhering to this schema:\n"
            "{\n"
            '  "propositions": [\n'
            "    {\n"
            f'      "proposition_id": "{parent_id}_p1",\n'
            f'      "parent_claim_id": "{parent_id}",\n'
            '      "subject": "Entity or subject",\n'
            '      "predicate": "Verb or relation",\n'
            '      "object": "Target attribute, object, or asserted state",\n'
            '      "polarity": "POSITIVE", // or NEGATIVE\n'
            '      "modality": "ASSERTED", // ASSERTED, POSSIBLE, CONDITIONAL, ALLEGED, REPORTED, PLANNED, UNKNOWN\n'
            '      "temporal_scope": null, // or string like "in 2024"\n'
            '      "related_entities": ["Entity1"],\n'
            '      "original_text_span": "Exact substring from the sentence"\n'
            "    }\n"
            "  ]\n"
            "}"
        )

        return {
            "model": self._model,
            "messages": [
                {"role": "system", "content": DECOMPOSITION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
            "max_tokens": 1000,
        }

    async def extract_structured_claims(self, request: ExtractionRequest) -> ExtractionResponse:
        """Decompose a complex sentence into structured atomic propositions using LLM."""
        if not self.is_claim_decomposition_available:
            raise RuntimeError("Bifrost claim decomposition is not available or enable_llm_claim_decomposition is False.")

        parent_id = request.claim_id or "claim_0"
        sentence = request.sentence_text or request.response_text
        payload = self._build_decomposition_payload(request)
        endpoint = "/chat/completions"

        attempts = 0
        last_error = None
        raw_text = ""

        client = await self._get_client()
        should_close = (self._custom_client is None)

        try:
            while attempts <= self._max_retries:
                attempts += 1
                try:
                    resp = await client.post(endpoint, json=payload)
                    if resp.status_code >= 400:
                        logger.warning(
                            f"Bifrost decomposition HTTP {resp.status_code} error on attempt {attempts}/{self._max_retries + 1}"
                        )
                        last_error = RuntimeError(f"Bifrost HTTP {resp.status_code}: {resp.text[:200]}")
                        if attempts <= self._max_retries:
                            backoff = self._calculate_backoff_delay(attempts)
                            await asyncio.sleep(backoff)
                        continue

                    data = resp.json()
                    choices = data.get("choices", [])
                    if not choices:
                        raise ValueError("Bifrost returned empty choices array.")

                    raw_text = choices[0].get("message", {}).get("content", "")
                    parsed_json = self._parse_json(raw_text)
                    raw_props = parsed_json.get("propositions", [])

                    # Construct candidate propositions
                    candidates: List[StructuredProposition] = []
                    for p in raw_props:
                        # Normalize polarity
                        pol_raw = str(p.get("polarity", "POSITIVE")).upper()
                        polarity = PropositionPolarity.NEGATIVE if pol_raw == "NEGATIVE" else PropositionPolarity.POSITIVE

                        # Extract and validate modality
                        mod_raw = p.get("modality")
                        if not mod_raw:
                            raise ValueError(f"Missing required 'modality' field in proposition '{p.get('proposition_id')}'.")
                        try:
                            modality = EpistemicModality(str(mod_raw).upper())
                        except Exception:
                            raise ValueError(f"Invalid modality '{mod_raw}' in proposition '{p.get('proposition_id')}'.")

                        prop_obj = StructuredProposition(
                            proposition_id=str(p.get("proposition_id", "")),
                            parent_claim_id=str(p.get("parent_claim_id", parent_id)),
                            source_claim_id=parent_id,
                            subject=str(p.get("subject", "")).strip(),
                            predicate=str(p.get("predicate", "")).strip(),
                            object=str(p.get("object", "")).strip(),
                            qualifiers=p.get("qualifiers", {}) if isinstance(p.get("qualifiers"), dict) else {},
                            polarity=polarity,
                            modality=modality,
                            temporal_scope=p.get("temporal_scope"),
                            related_entities=p.get("related_entities", []) if isinstance(p.get("related_entities"), list) else [],
                            original_text_span=str(p.get("original_text_span", "")).strip(),
                            extraction_confidence=1.0,
                        )
                        candidates.append(prop_obj)

                    # Validate candidates with PropositionExtractionValidator
                    is_valid, reason, validated = PropositionExtractionValidator.validate_propositions(
                        candidates, parent_claim_id=parent_id, original_sentence=sentence
                    )
                    if not is_valid:
                        raise ValueError(f"Structural validation failed: {reason}")

                    self._last_connect_failure_time = 0.0
                    return ExtractionResponse(
                        propositions=validated,
                        raw_response=raw_text,
                        provider_name=self.provider_name,
                    )
                except (httpx.TimeoutException, httpx.RequestError) as net_err:
                    self._last_connect_failure_time = time.monotonic()
                    logger.warning(f"Bifrost decomposition network exception on attempt {attempts}: {net_err.__class__.__name__}")
                    last_error = net_err
                except Exception as parse_err:
                    logger.warning(f"Bifrost decomposition validation/parse error: {parse_err}")
                    last_error = parse_err
                    break  # Do not retry fatal parse or validation rejections
        finally:
            if should_close:
                await client.aclose()

        raise RuntimeError(f"Bifrost claim decomposition failed after {attempts} attempts: {last_error}")

    def _build_correction_payload(self, request: CorrectionGenerationRequest) -> Dict[str, Any]:
        """Construct prompt and OpenAI-compatible chat payload for answer correction."""
        user_content = {
            "task": "Synthesize proposition-level evidence-grounded correction units.",
            "original_text": request.original_text,
            "as_of_date": request.as_of_date,
            "propositions_to_address": request.propositions_data,
            "eligible_evidence_pool": request.evidence_pool,
            "required_schema": {
                "correction_units": [
                    {
                        "proposition_id": "string (must match a target proposition_id)",
                        "operation": "REPHRASE_SUPPORTED | REPLACE_OUTDATED",
                        "text": "string (synthesized fluent sentence)",
                        "cited_evidence_ids": ["string (must be from the proposition's authorized whitelist)"],
                        "change_type": "RETAINED_SUPPORTED | CORRECTED_OUTDATED | REFUTED_CONTRADICTED",
                        "explanation": "string (concise reason grounded in evidence)",
                    }
                ]
            },
        }

        return {
            "model": self._model,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": CORRECTION_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(user_content)},
            ],
        }

    async def generate_grounded_correction(
        self, request: CorrectionGenerationRequest
    ) -> CorrectionGenerationResponse:
        """Synthesize proposition-level evidence-grounded correction units."""
        if not self.is_correction_generation_available:
            raise RuntimeError(
                "Bifrost correction generation is not available or enable_llm_answer_correction is False."
            )

        payload = self._build_correction_payload(request)
        endpoint = "/chat/completions"

        attempts = 0
        last_error = None
        raw_text = ""

        client = await self._get_client()
        should_close = (self._custom_client is None)

        try:
            while attempts <= self._max_retries:
                attempts += 1
                try:
                    resp = await client.post(endpoint, json=payload)
                    if resp.status_code >= 400:
                        logger.warning(
                            f"Bifrost correction HTTP {resp.status_code} error on attempt {attempts}/{self._max_retries + 1}"
                        )
                        last_error = RuntimeError(f"Bifrost HTTP {resp.status_code}: {resp.text[:200]}")
                        if attempts <= self._max_retries:
                            backoff = self._calculate_backoff_delay(attempts)
                            await asyncio.sleep(backoff)
                        continue

                    data = resp.json()
                    choices = data.get("choices", [])
                    if not choices:
                        raise ValueError("Bifrost returned empty choices array.")

                    raw_text = choices[0].get("message", {}).get("content", "")
                    parsed = self._parse_json(raw_text)
                    raw_units = parsed.get("correction_units", [])
                    if not isinstance(raw_units, list):
                        raise ValueError("Response does not contain a 'correction_units' array.")

                    validated_units: List[PropositionCorrectionUnit] = []
                    seen_pids = set()

                    for idx, u in enumerate(raw_units):
                        if not isinstance(u, dict):
                            continue
                        pid = str(u.get("proposition_id", "")).strip()
                        if not pid or pid in seen_pids:
                            logger.warning(f"Rejecting duplicate/empty proposition_id '{pid}' in unit {idx}")
                            continue
                        seen_pids.add(pid)

                        op_raw = str(u.get("operation", "")).strip()
                        try:
                            op = CorrectionOperationType(op_raw)
                        except Exception:
                            logger.warning(f"Unknown operation '{op_raw}' in unit {pid}")
                            continue

                        text_val = str(u.get("text", "")).strip()
                        cited_ids = [str(e).strip() for e in u.get("cited_evidence_ids", []) if str(e).strip()]
                        change_type_val = str(u.get("change_type", "")).strip()
                        explanation_val = str(u.get("explanation", "")).strip()

                        unit_obj = PropositionCorrectionUnit(
                            proposition_id=pid,
                            operation=op,
                            text=text_val,
                            cited_evidence_ids=cited_ids,
                            change_type=change_type_val,
                            explanation=explanation_val,
                        )
                        validated_units.append(unit_obj)

                    self._last_connect_failure_time = 0.0
                    return CorrectionGenerationResponse(
                        correction_units=validated_units,
                        raw_response=raw_text,
                        provider_name=self.provider_name,
                    )
                except (httpx.TimeoutException, httpx.RequestError) as net_err:
                    self._last_connect_failure_time = time.monotonic()
                    logger.warning(f"Bifrost correction network exception on attempt {attempts}: {net_err.__class__.__name__}")
                    last_error = net_err
                except Exception as parse_err:
                    logger.warning(f"Bifrost correction parse/validation error: {parse_err}")
                    last_error = parse_err
                    break
        finally:
            if should_close:
                await client.aclose()

        raise RuntimeError(f"Bifrost correction generation failed after {attempts} attempts: {last_error}")

    async def assess_evidence_item(self, request: EvidenceAssessmentRequest) -> EvidenceAssessmentResponse:
        """Single-item evaluation fallback by wrapping in batch contract."""
        raise NotImplementedError("Use batch_assess_evidence for efficient bounded processing.")

    async def batch_assess_evidence(self, request: BatchAssessmentRequest) -> BatchAssessmentResponse:
        """Evaluate a bounded batch of propositions against evidence passages."""
        if not self.is_semantic_assessment_available:
            raise RuntimeError("Bifrost provider is not available or enable_llm_semantic_assessment is False.")

        start_time = time.perf_counter()
        valid_prop_ids: Set[str] = {p.proposition_id for p in request.propositions}
        valid_ev_map: Dict[str, str] = {e.evidence_id: e.source_snippet for e in request.evidence_items}

        if not valid_prop_ids or not valid_ev_map:
            return BatchAssessmentResponse(
                assessments=[],
                provider_name=self.provider_name,
                model_name=self._model,
                duration_ms=0,
            )

        payload = self._build_chat_payload(request)
        endpoint = "/chat/completions"

        attempts = 0
        last_error = None
        raw_text = ""

        client = await self._get_client()
        should_close = (self._custom_client is None)

        try:
            while attempts <= self._max_retries:
                attempts += 1
                try:
                    resp = await client.post(endpoint, json=payload)
                    if resp.status_code >= 400:
                        logger.warning(
                            f"Bifrost HTTP {resp.status_code} error on attempt {attempts}/{self._max_retries + 1}"
                        )
                        last_error = RuntimeError(f"Bifrost HTTP {resp.status_code}: {resp.text[:200]}")
                        if attempts <= self._max_retries:
                            backoff = self._calculate_backoff_delay(attempts)
                            await asyncio.sleep(backoff)
                        continue

                    data = resp.json()
                    choices = data.get("choices", [])
                    if not choices:
                        raise ValueError("Bifrost returned empty choices array.")

                    raw_text = choices[0].get("message", {}).get("content", "")
                    validated_assessments = self._parse_and_validate_response(
                        raw_text, valid_prop_ids, valid_ev_map
                    )

                    self._last_connect_failure_time = 0.0
                    duration_ms = int((time.perf_counter() - start_time) * 1000)
                    return BatchAssessmentResponse(
                        assessments=validated_assessments,
                        provider_name=self.provider_name,
                        model_name=self._model,
                        duration_ms=duration_ms,
                        raw_response=raw_text,
                    )
                except (httpx.TimeoutException, httpx.RequestError) as net_err:
                    self._last_connect_failure_time = time.monotonic()
                    logger.warning(f"Bifrost network exception on attempt {attempts}: {net_err.__class__.__name__}")
                    last_error = net_err
                except Exception as parse_err:
                    logger.warning(f"Bifrost parse/validation exception on attempt {attempts}: {parse_err}")
                    last_error = parse_err
                    break # Don't retry unfixable json parse errors
        finally:
            if should_close:
                await client.aclose()

        raise RuntimeError(f"Bifrost assessment failed after {attempts} attempts: {last_error}")

    def _build_chat_payload(self, request: BatchAssessmentRequest) -> Dict[str, Any]:
        """Construct prompt and OpenAI-compatible chat payload."""
        props_data = [
            {
                "proposition_id": p.proposition_id,
                "statement": f"{p.subject} {p.predicate} {p.object}".strip(),
                "polarity": p.polarity,
                "temporal_scope": p.temporal_scope,
            }
            for p in request.propositions
        ]

        evidence_data = [
            {
                "evidence_id": e.evidence_id,
                "title": e.source_title,
                "snippet": e.source_snippet,
                "published_date": e.published_date,
            }
            for e in request.evidence_items
        ]

        user_content = {
            "task": "Evaluate each proposition against each relevant evidence passage.",
            "propositions": props_data,
            "evidence_passages": evidence_data,
            "required_schema": {
                "assessments": [
                    {
                        "proposition_id": "string (must match supplied)",
                        "evidence_id": "string (must match supplied)",
                        "relation": "SUPPORTS | CONTRADICTS | NEUTRAL | INSUFFICIENT",
                        "confidence": "number between 0.0 and 1.0",
                        "relevant_quote": "exact quote from snippet or null",
                        "rationale": "string concise explanation",
                    }
                ]
            },
        }

        return {
            "model": self._model,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(user_content)},
            ],
        }

    def _parse_and_validate_response(
        self,
        raw_text: str,
        valid_prop_ids: Set[str],
        valid_ev_map: Dict[str, str],
    ) -> List[PairAssessmentResult]:
        """Parse raw JSON output and enforce strict integrity rules."""
        if not raw_text or not raw_text.strip():
            raise ValueError("Empty response received from Bifrost.")

        clean_text = raw_text.strip()
        # Handle markdown fences if present
        if clean_text.startswith("```"):
            clean_text = clean_text.strip("`")
            if clean_text.lower().startswith("json"):
                clean_text = clean_text[4:].strip()

        try:
            parsed = json.loads(clean_text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Malformed or truncated JSON from model: {exc}")

        raw_list = parsed.get("assessments", [])
        if not isinstance(raw_list, list):
            raise ValueError("Response payload does not contain an 'assessments' list.")

        validated: List[PairAssessmentResult] = []
        seen_pairs: Set[tuple[str, str]] = set()
        duplicate_pairs: Set[tuple[str, str]] = set()

        # First pass: parse valid items and detect any duplicate pairs
        candidate_items: List[PairAssessmentResult] = []

        for item in raw_list:
            if not isinstance(item, dict):
                continue

            p_id = item.get("proposition_id")
            e_id = item.get("evidence_id")
            rel_str = item.get("relation")
            conf = item.get("confidence")
            quote = item.get("relevant_quote")
            rationale = item.get("rationale") or ""

            # 1. Proposition ID integrity
            if p_id not in valid_prop_ids:
                logger.warning(f"Rejecting unknown proposition_id: {p_id}")
                continue

            # 2. Evidence ID integrity
            if e_id not in valid_ev_map:
                logger.warning(f"Rejecting unknown evidence_id: {e_id}")
                continue

            # 3. Duplicate assessment tracking
            pair_key = (p_id, e_id)
            if pair_key in seen_pairs:
                logger.warning(f"Duplicate assessment pair detected for {pair_key}; marking entire pair invalid.")
                duplicate_pairs.add(pair_key)
                continue
            seen_pairs.add(pair_key)

            # 4. Relation validation
            try:
                relation = AssessmentRelation(str(rel_str).upper())
            except Exception:
                logger.warning(f"Rejecting invalid relation value for {pair_key}: {rel_str}")
                continue

            # 5. Confidence validation
            try:
                conf_val = float(conf)
                if not (0.0 <= conf_val <= 1.0):
                    logger.warning(f"Rejecting out-of-bounds confidence for {pair_key}: {conf_val}")
                    continue
            except (TypeError, ValueError):
                logger.warning(f"Rejecting invalid confidence type for {pair_key}: {conf}")
                continue

            # 6. Quote grounding validation
            # If relevant_quote is non-null, it MUST be an exact substring of the evidence snippet.
            # If it is not, reject that entire assessment pair and trigger deterministic fallback.
            snippet = valid_ev_map[e_id]
            if quote is not None:
                quote_str = str(quote).strip()
                if quote_str and quote_str not in snippet:
                    logger.warning(
                        f"Rejecting assessment pair {pair_key}: relevant_quote '{quote_str}' "
                        f"is not an exact substring of evidence snippet."
                    )
                    continue

            candidate_items.append(
                PairAssessmentResult(
                    proposition_id=p_id,
                    evidence_id=e_id,
                    relation=relation,
                    confidence=round(conf_val, 4),
                    relevant_quote=str(quote).strip() if quote is not None else None,
                    rationale=str(rationale).strip(),
                )
            )

        # Second pass: exclude any candidate that was part of a duplicate pair
        for cand in candidate_items:
            pair_key = (cand.proposition_id, cand.evidence_id)
            if pair_key in duplicate_pairs:
                logger.warning(
                    f"Excluding assessment for duplicated pair {pair_key} to trigger deterministic fallback."
                )
                continue
            validated.append(cand)

        return validated

