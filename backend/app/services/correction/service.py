"""Deterministic and LLM-assisted evidence-grounded answer correction service.

Synthesizes an updated, truthful, verifiable response from claim-level
and proposition-level verification outcomes:
1. Retains statements backed by sufficient supporting evidence with citations.
2. Corrects statements refuted by reliable contradictory or superseding evidence.
3. Excludes or explicitly qualifies statements lacking corroborating evidence.
4. Generates an itemized change explanation delta.
5. Emits strict citation provenance metadata.
6. Proposition-level unit synthesis with multi-tiered validation and unit-by-unit fallback.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from datetime import datetime, timezone

from app.core.config import settings
from app.schemas.claims import AtomicClaim, StructuredProposition
from app.schemas.evidence import EvidenceRecord, TemporalEligibilityStatus
from app.schemas.verification import VerificationVerdict, VerificationResult, PropositionVerificationResult
from app.schemas.report import ClaimAnalysisDetail
from app.schemas.correction import (
    GroundedCorrection,
    CitationReference,
    CorrectionDelta,
    PropositionCorrectionUnit,
    CorrectionOperationType,
)
from app.services.claim_verification.llm_interface import (
    BaseSemanticReasoningProvider,
    CorrectionGenerationRequest,
    CorrectionGenerationResponse,
)
from app.services.correction.validator import PropositionCorrectionValidator

logger = logging.getLogger(__name__)


class AnswerCorrectionService:
    """Produces evidence-grounded corrections without hallucinating unsupported facts."""

    def __init__(
        self,
        semantic_provider: Optional[BaseSemanticReasoningProvider] = None,
        validator: Optional[PropositionCorrectionValidator] = None,
    ):
        self.semantic_provider = semantic_provider
        self.validator = validator or PropositionCorrectionValidator()

    def _run_async_safely(self, coro, timeout: float):
        """Execute async coroutine synchronously with bounded timeout."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(lambda: asyncio.run(asyncio.wait_for(coro, timeout=timeout))).result(timeout=timeout + 1.0)
        else:
            return asyncio.run(asyncio.wait_for(coro, timeout=timeout))

    def generate_correction(
        self,
        original_text: str,
        claim_details: List[ClaimAnalysisDetail],
        reference_time: Optional[datetime] = None,
    ) -> GroundedCorrection:
        """Synthesize a grounded correction from evaluated claim details."""
        as_of = (reference_time or datetime.now(timezone.utc)).strftime("%B %d, %Y")
        as_of_iso = (reference_time or datetime.now(timezone.utc)).isoformat()

        citations: List[CitationReference] = []
        evidence_citation_map: Dict[str, int] = {}  # evidence_id -> citation_number

        def get_or_create_citation(ev: EvidenceRecord) -> int:
            if ev.evidence_id in evidence_citation_map:
                return evidence_citation_map[ev.evidence_id]
            next_num = len(citations) + 1
            evidence_citation_map[ev.evidence_id] = next_num

            pub_date_str = None
            if ev.publication_date is not None:
                if isinstance(ev.publication_date, datetime):
                    pub_date_str = ev.publication_date.isoformat()
                else:
                    pub_date_str = str(ev.publication_date)

            citations.append(
                CitationReference(
                    citation_number=next_num,
                    evidence_id=ev.evidence_id,
                    source_title=ev.source_title or ev.source_domain or "Authoritative Source",
                    source_url=ev.source_url,
                    published_date=pub_date_str,
                    snippet=ev.citation_text[:200],
                )
            )
            return next_num

        # Index all candidate evidence records by ID
        all_evidence_map: Dict[str, EvidenceRecord] = {}
        for detail in claim_details:
            for ev in detail.supporting_evidence + detail.contradicting_evidence:
                all_evidence_map[ev.evidence_id] = ev

        # Flatten all actionable propositions and metadata
        actionable_props_map: Dict[str, StructuredProposition] = {}
        prop_verdicts: Dict[str, VerificationVerdict] = {}
        prop_whitelist: Dict[str, List[str]] = {}
        prop_to_claim: Dict[str, AtomicClaim] = {}

        for detail in claim_details:
            claim = detail.claim
            verdict = detail.verification.verdict
            prop_results = detail.verification.proposition_results

            if claim.propositions and len(claim.propositions) > 0 and prop_results:
                for prop, p_res in zip(claim.propositions, prop_results):
                    actionable_props_map[prop.proposition_id] = prop
                    prop_verdicts[prop.proposition_id] = p_res.verdict
                    prop_to_claim[prop.proposition_id] = claim
                    if p_res.verdict == VerificationVerdict.SUPPORTED:
                        prop_whitelist[prop.proposition_id] = p_res.supporting_evidence_ids
                    elif p_res.verdict in {VerificationVerdict.OUTDATED, VerificationVerdict.CONTRADICTED}:
                        prop_whitelist[prop.proposition_id] = p_res.contradicting_evidence_ids
                    else:
                        prop_whitelist[prop.proposition_id] = []
            else:
                # Synthetic pseudo-proposition for single claim
                pseudo_pid = f"prop_{claim.claim_id}"
                pseudo_prop = StructuredProposition(
                    proposition_id=pseudo_pid,
                    parent_claim_id=claim.claim_id,
                    source_claim_id=claim.claim_id,
                    subject=claim.entity or "Entity",
                    predicate=claim.attribute or "asserts",
                    object=claim.claimed_value or claim.normalized_text,
                    original_text_span=claim.normalized_text,
                )
                actionable_props_map[pseudo_pid] = pseudo_prop
                prop_verdicts[pseudo_pid] = verdict
                prop_to_claim[pseudo_pid] = claim
                if verdict == VerificationVerdict.SUPPORTED:
                    prop_whitelist[pseudo_pid] = [e.evidence_id for e in detail.supporting_evidence]
                elif verdict in {VerificationVerdict.OUTDATED, VerificationVerdict.CONTRADICTED}:
                    prop_whitelist[pseudo_pid] = [e.evidence_id for e in detail.contradicting_evidence]
                else:
                    prop_whitelist[pseudo_pid] = []

        # Determine if LLM answer correction is enabled and available
        can_attempt_llm = (
            settings.enable_llm_semantic_assessment
            and settings.enable_llm_answer_correction
            and self.semantic_provider is not None
            and getattr(self.semantic_provider, "is_correction_generation_available", False)
        )

        llm_response: Optional[CorrectionGenerationResponse] = None
        provider_error_msg: Optional[str] = None

        if can_attempt_llm:
            # Build propositions payload for supported and outdated propositions only
            eligible_props_payload = []
            for pid, prop in actionable_props_map.items():
                v = prop_verdicts[pid]
                wl = prop_whitelist[pid]
                if v == VerificationVerdict.SUPPORTED:
                    eligible_props_payload.append({
                        "proposition_id": pid,
                        "verdict": v.value,
                        "authorized_operation": "REPHRASE_SUPPORTED",
                        "subject": prop.subject,
                        "predicate": prop.predicate,
                        "object": prop.object,
                        "original_text_span": prop.original_text_span,
                        "authorized_evidence_ids": wl,
                    })
                elif v in {VerificationVerdict.OUTDATED, VerificationVerdict.CONTRADICTED} and wl:
                    # Check for evidence conflict before submitting to LLM
                    contra_records = [all_evidence_map[eid] for eid in wl if eid in all_evidence_map]
                    has_conflict, conflict_reason = self.validator.inspect_evidence_conflict(contra_records)
                    if not has_conflict:
                        eligible_props_payload.append({
                            "proposition_id": pid,
                            "verdict": v.value,
                            "authorized_operation": "REPLACE_OUTDATED",
                            "subject": prop.subject,
                            "predicate": prop.predicate,
                            "object": prop.object,
                            "original_text_span": prop.original_text_span,
                            "authorized_evidence_ids": wl,
                        })

            if eligible_props_payload:
                evidence_pool_payload = [
                    {
                        "evidence_id": e.evidence_id,
                        "title": e.source_title,
                        "published_date": e.publication_date.isoformat() if e.publication_date else None,
                        "snippet": e.citation_text,
                    }
                    for e in all_evidence_map.values()
                ]

                req = CorrectionGenerationRequest(
                    original_text=original_text,
                    as_of_date=as_of,
                    propositions_data=eligible_props_payload,
                    evidence_pool=evidence_pool_payload,
                )

                try:
                    llm_response = self._run_async_safely(
                        self.semantic_provider.generate_grounded_correction(req),
                        timeout=settings.answer_correction_timeout_seconds,
                    )
                except Exception as exc:
                    provider_error_msg = f"Provider error/timeout: {exc}"
                    logger.warning(f"LLM answer correction generation failed: {exc}. Falling back to deterministic.")

        # Unit-by-unit processing & validation
        unit_map: Dict[str, PropositionCorrectionUnit] = {}
        if llm_response and llm_response.correction_units:
            for u in llm_response.correction_units:
                unit_map[u.proposition_id] = u

        corrected_sentences: List[str] = []
        deltas: List[CorrectionDelta] = []
        unresolved: List[str] = []
        unit_tracking: List[Dict[str, Any]] = []

        overall_llm_used = False
        overall_fallback_reasons: List[str] = []
        if provider_error_msg:
            overall_fallback_reasons.append(provider_error_msg)

        # Iterate over each proposition deterministically
        for pid, prop in actionable_props_map.items():
            claim = prop_to_claim[pid]
            v = prop_verdicts[pid]
            wl = prop_whitelist[pid]
            prop_text = f"{prop.subject} {prop.predicate} {prop.object}".strip()

            candidate_unit = unit_map.get(pid)
            use_llm_unit = False
            unit_fallback_reason: Optional[str] = None
            invariants_ok = False
            entailment_ok = False

            if candidate_unit is not None:
                # Validate unit through PropositionCorrectionValidator
                is_valid, reason, inv_pass, ent_pass = self.validator.validate_unit(
                    unit=candidate_unit,
                    target_proposition=prop,
                    prop_verdict=v,
                    authorized_evidence_whitelist=wl,
                    all_evidence_map=all_evidence_map,
                )
                invariants_ok = inv_pass
                entailment_ok = ent_pass

                if is_valid and entailment_ok:
                    use_llm_unit = True
                else:
                    unit_fallback_reason = reason
                    overall_fallback_reasons.append(f"[{pid}] {reason}")

            # Assemble sentence for this proposition
            if use_llm_unit and candidate_unit is not None:
                overall_llm_used = True
                # Format citations
                c_nums = [get_or_create_citation(all_evidence_map[eid]) for eid in candidate_unit.cited_evidence_ids if eid in all_evidence_map]
                cite_str = "".join(f" [{n}]" for n in c_nums) if c_nums else ""
                clean_unit_text = candidate_unit.text.strip().rstrip(".,;")
                corrected_sentences.append(f"{clean_unit_text}{cite_str}.")
                deltas.append(
                    CorrectionDelta(
                        claim_id=claim.claim_id,
                        proposition_id=prop.proposition_id,
                        change_type=candidate_unit.change_type,
                        original_text=prop.original_text_span,
                        explanation=candidate_unit.explanation or "Synthesized and verified via grounded reasoning.",
                    )
                )
                unit_tracking.append({
                    "proposition_id": pid,
                    "mode": "llm_assisted",
                    "invariants_passed": invariants_ok,
                    "entailment_verified": entailment_ok,
                    "fallback_reason": None,
                })
            else:
                # Deterministic synthesis fallback for this proposition
                unit_tracking.append({
                    "proposition_id": pid,
                    "mode": "deterministic",
                    "invariants_passed": invariants_ok,
                    "entailment_verified": False,
                    "fallback_reason": unit_fallback_reason or ("LLM correction disabled or unattempted" if not can_attempt_llm else "Proposition unit absent or ineligible"),
                })

            # Determine display text for deterministic fallback
            is_pseudo = (pid == f"prop_{claim.claim_id}" and (not claim.propositions or len(claim.propositions) <= 1))
            display_text = claim.normalized_text if is_pseudo else prop_text

            if v == VerificationVerdict.SUPPORTED:
                c_nums = [get_or_create_citation(all_evidence_map[eid]) for eid in wl[:2] if eid in all_evidence_map]
                cite_str = "".join(f" [{n}]" for n in c_nums) if c_nums else ""
                corrected_sentences.append(f"{display_text}{cite_str}.")
                deltas.append(
                    CorrectionDelta(
                        claim_id=claim.claim_id,
                        proposition_id=None if is_pseudo else prop.proposition_id,
                        change_type="RETAINED_SUPPORTED",
                        original_text=claim.original_text if is_pseudo else prop.original_text_span,
                        explanation="Verified and retained with supporting evidence.",
                    )
                )
            elif v in {VerificationVerdict.OUTDATED, VerificationVerdict.CONTRADICTED}:
                contra_ev = all_evidence_map.get(wl[0]) if wl else None
                c_str = ""
                if contra_ev:
                    c_num = get_or_create_citation(contra_ev)
                    c_str = f" [{c_num}]"
                    snippet = contra_ev.citation_text.strip().rstrip(".")
                    corrected_sentences.append(f"Rather than '{display_text}', reliable evidence confirms that {snippet}{c_str}.")
                else:
                    corrected_sentences.append(f"The statement '{display_text}' is refuted by evidence.")
                deltas.append(
                    CorrectionDelta(
                        claim_id=claim.claim_id,
                        proposition_id=None if is_pseudo else prop.proposition_id,
                        change_type="CORRECTED_OUTDATED" if v == VerificationVerdict.OUTDATED else "REFUTED_CONTRADICTED",
                        original_text=claim.original_text if is_pseudo else prop.original_text_span,
                        explanation="Corrected based on contradictory/superseding evidence.",
                    )
                )
            else: # INSUFFICIENT / UNVERIFIED
                unresolved.append(display_text)
                corrected_sentences.append(f"It remains unverified whether {display_text.lower()} due to insufficient corroborating evidence.")
                deltas.append(
                    CorrectionDelta(
                        claim_id=claim.claim_id,
                        proposition_id=None if is_pseudo else prop.proposition_id,
                        change_type="QUALIFIED_UNVERIFIED",
                        original_text=claim.original_text if is_pseudo else prop.original_text_span,
                        explanation="Unverified by available evidence; explicitly qualified to avoid hallucination.",
                    )
                )

        full_corrected = " ".join(corrected_sentences).strip()
        if not full_corrected:
            full_corrected = "No verifiable claims were available to generate a correction."

        overall_mode = "llm_assisted" if overall_llm_used else "deterministic"
        overall_fb_reason = "; ".join(overall_fallback_reasons) if overall_fallback_reasons else None
        overall_inv_passed = all(u.get("invariants_passed", False) for u in unit_tracking if u["mode"] == "llm_assisted") if overall_llm_used else True
        overall_ent_verified = all(u.get("entailment_verified", False) for u in unit_tracking if u["mode"] == "llm_assisted") if overall_llm_used else False

        return GroundedCorrection(
            original_text=original_text,
            corrected_text=full_corrected,
            as_of_timestamp=as_of_iso,
            citations=citations,
            deltas=deltas,
            unresolved_uncertainties=unresolved,
            correction_mode=overall_mode,
            invariant_checks_passed=overall_inv_passed,
            entailment_verified=overall_ent_verified,
            fallback_reason=overall_fb_reason,
            unit_results=unit_tracking,
        )

