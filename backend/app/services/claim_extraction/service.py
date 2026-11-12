"""Atomic claim extraction service.

Converts AI-generated responses into individual verifiable factual claims
while preserving character spans and filtering out non-factual discourse.
"""
from __future__ import annotations

import asyncio
import logging
import re
import uuid
from typing import List, Optional, Tuple
from app.core.config import settings
from app.schemas.claims import AtomicClaim, TemporalSensitivity, StructuredProposition
from app.core.security import sanitize_untrusted_text
from app.services.claim_extraction.proposition_decomposer import PropositionDecompositionService
from app.services.claim_extraction.complexity_detector import LinguisticComplexityDetector
from app.services.claim_verification.llm_interface import BaseSemanticReasoningProvider, ExtractionRequest

logger = logging.getLogger(__name__)

# Patterns identifying non-factual conversational or meta sentences
_DISCOURSE_PATTERNS = [
    re.compile(r"^(sure|certainly|of course|hello|hi|hey|greetings|thank you|thanks)\b", re.IGNORECASE),
    re.compile(r"^(here is|here are|below is|below are|in summary|as mentioned|to summarize)\b", re.IGNORECASE),
    re.compile(r"^(i hope this helps|let me know if you need|feel free to ask)\b", re.IGNORECASE),
    re.compile(r"^(in my opinion|i believe|personally|i think)\b", re.IGNORECASE),
    re.compile(r"\b(here (?:are|is)|below (?:are|is)|following (?:are|is))\s+(?:some|a few|the|several)?\s*(?:important|key|notable)?\s*(?:facts|points|details|updates|information)\b", re.IGNORECASE),
]

# Coordinating conjunctions or split points for compound sentences
_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+|\n+")


class ClaimExtractionService:
    """Extracts atomic factual claims with exact text span mappings and structured propositions."""

    def __init__(self, semantic_provider: Optional[BaseSemanticReasoningProvider] = None):
        self.decomposer = PropositionDecompositionService()
        self.complexity_detector = LinguisticComplexityDetector(
            default_threshold=settings.claim_decomposition_complexity_threshold
        )
        self.semantic_provider = semantic_provider

    def _decompose_with_provider_sync(
        self,
        claim_id: str,
        cleaned_s: str,
        inherited_entity: str,
        timeout: float
    ) -> Optional[List[StructuredProposition]]:
        """Attempt LLM decomposition via semantic_provider synchronously (or running async event loop)."""
        if not self.semantic_provider or not getattr(self.semantic_provider, "is_claim_decomposition_available", False):
            return None

        req = ExtractionRequest(
            response_text=cleaned_s,
            claim_id=claim_id,
            sentence_text=cleaned_s,
            extraction_version="v1"
        )

        async def _run_extract():
            return await asyncio.wait_for(
                self.semantic_provider.extract_structured_claims(req),
                timeout=timeout
            )

        try:
            # Check if there's already an active event loop in current thread
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                # We are in an active event loop (e.g. running in async pipeline)
                # To avoid blocking, create task and wait if in nested or run in thread
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    resp = executor.submit(lambda: asyncio.run(_run_extract())).result(timeout=timeout + 1.0)
            else:
                resp = asyncio.run(_run_extract())

            if resp and resp.propositions:
                logger.info(
                    f"Successfully decomposed complex claim {claim_id} into {len(resp.propositions)} propositions via {resp.provider_name}"
                )
                return resp.propositions
        except Exception as exc:
            logger.warning(
                f"LLM claim decomposition failed or rejected for claim {claim_id}: {exc}. Falling back to deterministic decomposer."
            )
            return None

    def extract_claims(self, text: str) -> List[AtomicClaim]:
        """Extract atomic claims from the given text."""
        sanitized = sanitize_untrusted_text(text)
        if not sanitized:
            return []

        raw_sentences = self._split_sentences_with_spans(text)
        claims: List[AtomicClaim] = []

        for sentence, start, end in raw_sentences:
            cleaned_s = sentence.strip()
            if not cleaned_s or len(cleaned_s) < 10:
                continue

            # Skip conversational non-factual filler
            if self._is_non_factual_filler(cleaned_s):
                continue

            claim_id = f"clm_{uuid.uuid4().hex[:8]}"
            entity, attribute, value = self._heuristic_parse_triple(cleaned_s)

            # Check linguistic complexity
            complexity = self.complexity_detector.evaluate(
                cleaned_s,
                threshold=settings.claim_decomposition_complexity_threshold
            )

            props: Optional[List[StructuredProposition]] = None

            # Route to LLM only if:
            # 1. Linguistic complexity meets threshold
            # 2. Both enable_llm_semantic_assessment and enable_llm_claim_decomposition are True
            # 3. Provider is configured and available
            if (
                complexity.is_complex
                and settings.enable_llm_semantic_assessment
                and settings.enable_llm_claim_decomposition
                and self.semantic_provider
                and getattr(self.semantic_provider, "is_claim_decomposition_available", False)
            ):
                props = self._decompose_with_provider_sync(
                    claim_id=claim_id,
                    cleaned_s=cleaned_s,
                    inherited_entity=entity,
                    timeout=settings.claim_decomposition_timeout_seconds
                )

            # Fallback to deterministic regex-based decomposition if props not obtained
            if not props:
                props = self.decomposer.decompose_claim(
                    parent_claim_id=claim_id,
                    text=cleaned_s,
                    inherited_entity=entity,
                )

            claims.append(
                AtomicClaim(
                    claim_id=claim_id,
                    original_text=cleaned_s,
                    normalized_text=self._normalize_clause(cleaned_s),
                    entity=entity,
                    attribute=attribute,
                    claimed_value=value,
                    temporal_sensitivity=TemporalSensitivity.SLOW_MOVING,
                    extraction_confidence=0.92,
                    start_char=start,
                    end_char=end,
                    propositions=props,
                )
            )

        return claims

    def _split_sentences_with_spans(self, text: str) -> List[Tuple[str, int, int]]:
        """Split text into sentences while recording start and end offsets, protecting common abbreviations."""
        # Protect abbreviations like Dr., Mr., Ms., Prof., Inc., etc. from sentence splitting
        _PROTECTED_ABBRS = [r"\bdr\.", r"\bmr\.", r"\bmrs\.", r"\bms\.", r"\bprof\.", r"\binc\.", r"\bcorp\.", r"\bltd\.", r"\bco\.", r"\bjr\.", r"\bsr\.", r"\bvs\.", r"\be\.g\.", r"\bi\.e\."]
        masked_text = text
        for abbr_pattern in _PROTECTED_ABBRS:
            masked_text = re.sub(abbr_pattern, lambda m: m.group(0)[:-1] + "\x00", masked_text, flags=re.IGNORECASE)

        spans: List[Tuple[str, int, int]] = []
        matches = list(_SPLIT_REGEX.finditer(masked_text))
        
        last_idx = 0
        for match in matches:
            s_candidate = masked_text[last_idx:match.start()].replace("\x00", ".").strip()
            if s_candidate:
                s_start = text.find(s_candidate, last_idx)
                s_end = s_start + len(s_candidate)
                spans.append((s_candidate, s_start, s_end))
            last_idx = match.end()

        if last_idx < len(text):
            trailing = masked_text[last_idx:].replace("\x00", ".").strip()
            if trailing:
                s_start = text.find(trailing, last_idx)
                s_end = s_start + len(trailing)
                spans.append((trailing, s_start, s_end))

        return spans

    def _is_non_factual_filler(self, sentence: str) -> bool:
        """Identify conversational boilerplate, rhetorical questions, and greetings."""
        # Strip leading temporal or introductory adverbial preambles before testing
        # e.g. "As of November 2026, here are..." -> "here are..."
        stripped = re.sub(
            r"^(?:as of [^,]+|in this (?:article|guide|response|overview)|for your information|please note|note that|below|firstly|first of all),\s*",
            "",
            sentence.strip(),
            flags=re.IGNORECASE,
        )

        for pattern in _DISCOURSE_PATTERNS:
            if pattern.search(sentence) or pattern.search(stripped):
                return True
        if sentence.endswith("?") and not any(w in sentence.lower() for w in ["who", "what", "where", "when"]):
            return True
        return False

    def _decompose_compound_sentence(self, sentence: str, base_offset: int) -> List[Tuple[str, int, int]]:
        """Decompose compound sentences connected by 'and also', 'additionally', or semicolons."""
        parts = re.split(r";|\s+and\s+(?:also\s+)?(?=[A-Z]|the\b|it\b|this\b)", sentence)
        if len(parts) <= 1:
            return [(sentence, base_offset, base_offset + len(sentence))]

        clauses: List[Tuple[str, int, int]] = []
        current_pos = 0
        for p in parts:
            p_strip = p.strip()
            if len(p_strip) > 15:
                idx = sentence.find(p_strip, current_pos)
                if idx != -1:
                    clauses.append((p_strip, base_offset + idx, base_offset + idx + len(p_strip)))
                    current_pos = idx + len(p_strip)
                else:
                    clauses.append((p_strip, base_offset, base_offset + len(p_strip)))
        return clauses if clauses else [(sentence, base_offset, base_offset + len(sentence))]

    def _normalize_clause(self, clause: str) -> str:
        """Resolve common relative pronouns and remove trailing punctuation."""
        norm = clause.strip().rstrip(".")
        # Capitalize first letter
        if norm and norm[0].islower():
            norm = norm[0].upper() + norm[1:]
        return norm

    def _heuristic_parse_triple(self, text: str) -> Tuple[str, str, str]:
        """Extract coarse (entity, attribute, value) triple."""
        # Check for copular statements: "X is/was Y"
        match = re.search(r"^(.*?)\s+(is|was|are|were|has\s+been|became)\s+(.*)$", text, re.IGNORECASE)
        if match:
            entity = match.group(1).strip()
            attribute = match.group(2).strip()
            value = match.group(3).strip()
            return entity, attribute, value

        # Check for release / launch statements: "X released Y in Z"
        match2 = re.search(r"^(.*?)\s+(released|launched|announced|acquired|founded)\s+(.*)$", text, re.IGNORECASE)
        if match2:
            entity = match2.group(1).strip()
            attribute = match2.group(2).strip()
            value = match2.group(3).strip()
            return entity, attribute, value

        words = text.split()
        entity = " ".join(words[:2]) if len(words) >= 2 else (words[0] if words else "Unknown")
        return entity, "state", text

