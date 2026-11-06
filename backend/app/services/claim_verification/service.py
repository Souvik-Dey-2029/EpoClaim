"""Claim verification service.

Performs 3-way NLI verification against retrieved evidence passages,
distinguishes entailment from contradiction, and prepares evidence sets.
"""
from __future__ import annotations

import logging
import re
from typing import List, Set, Tuple
from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationVerdict, VerificationResult
from app.core.config import settings

logger = logging.getLogger(__name__)

_STOP_WORDS = {
    "a", "an", "the", "is", "was", "are", "were", "be", "been", "being",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "and", "or"
}


def _content_tokens(text: str) -> Set[str]:
    tokens = set(re.findall(r"[a-z0-9]+", text.lower()))
    return {t for t in tokens if t not in _STOP_WORDS}


class ClaimVerificationService:
    """Verifies factual claims against evidence records."""

    def __init__(self):
        self._cross_encoder = None
        self._load_failed = False

    def _get_model(self):
        if not settings.enable_hf_models:
            return None
        if self._cross_encoder is None and not self._load_failed:
            try:
                from sentence_transformers import CrossEncoder
                logger.info("Loading NLI verification model...")
                self._cross_encoder = CrossEncoder("cross-encoder/nli-deberta-v3-base")
            except Exception as exc:
                logger.info(f"Verification CrossEncoder not loaded ({exc}); using rule-based NLI fallback.")
                self._load_failed = True
        return self._cross_encoder

    def verify_claim(
        self,
        claim: AtomicClaim,
        evidence_records: List[EvidenceRecord],
    ) -> Tuple[VerificationResult, List[EvidenceRecord], List[EvidenceRecord]]:
        """Verify an atomic claim against evidence records.

        Returns:
            Tuple of (VerificationResult, supporting_evidence_list, contradicting_evidence_list)
        """
        if not evidence_records:
            return (
                VerificationResult(
                    claim_id=claim.claim_id,
                    verdict=VerificationVerdict.INSUFFICIENT_EVIDENCE,
                    entailment_score=0.0,
                    contradiction_score=0.0,
                    neutral_score=1.0,
                    verification_confidence=0.5,
                    evidence_ids=[],
                    explanation="No relevant evidence was found to corroborate or refute this claim.",
                ),
                [],
                [],
            )

        supporting: List[EvidenceRecord] = []
        contradicting: List[EvidenceRecord] = []

        model = self._get_model()

        best_ent = 0.0
        best_contra = 0.0

        for rec in evidence_records:
            ent, contra, neu = self._score_pair(claim, rec, model)

            if ent >= settings.entailment_threshold and ent > contra:
                supporting.append(rec)
            elif contra >= settings.contradiction_threshold and contra > ent:
                contradicting.append(rec)

            if ent > best_ent:
                best_ent = ent
            if contra > best_contra:
                best_contra = contra

        # Verdict logic
        if supporting and not contradicting:
            verdict = VerificationVerdict.SUPPORTED
            confidence = best_ent
            explanation = f"Claim is verified and supported by {len(supporting)} authoritative source(s)."
            evidence_ids = [r.evidence_id for r in supporting]

        elif contradicting and not supporting:
            verdict = VerificationVerdict.CONTRADICTED
            confidence = best_contra
            explanation = f"Claim is directly contradicted by {len(contradicting)} source(s)."
            evidence_ids = [r.evidence_id for r in contradicting]

        elif supporting and contradicting:
            # Conflicting evidence exists! Preserve both sides
            # Note: Temporal analysis stage will check whether the contradiction is newer (OUTDATED)
            verdict = VerificationVerdict.CONTRADICTED
            confidence = max(best_contra, best_ent)
            explanation = (
                f"Conflicting evidence detected: supported by {len(supporting)} source(s) "
                f"but contradicted by {len(contradicting)} source(s)."
            )
            evidence_ids = [r.evidence_id for r in supporting + contradicting]

        else:
            verdict = VerificationVerdict.INSUFFICIENT_EVIDENCE
            confidence = 0.4
            explanation = "Available evidence mentions the subject but is insufficient to confirm or refute the claim."
            evidence_ids = [r.evidence_id for r in evidence_records[:2]]

        result = VerificationResult(
            claim_id=claim.claim_id,
            verdict=verdict,
            entailment_score=round(best_ent, 4),
            contradiction_score=round(best_contra, 4),
            neutral_score=round(max(0.0, 1.0 - best_ent - best_contra), 4),
            verification_confidence=round(confidence, 4),
            evidence_ids=evidence_ids,
            explanation=explanation,
        )

        return result, supporting, contradicting

    def _score_pair(
        self,
        claim: AtomicClaim,
        evidence: EvidenceRecord,
        model,
    ) -> Tuple[float, float, float]:
        """Compute (entailment, contradiction, neutral) probabilities."""
        if model is not None:
            try:
                scores = model.predict([(evidence.verification_context, claim.normalized_text)], apply_softmax=True)[0]
                return float(scores[1]), float(scores[0]), float(scores[2])
            except Exception:
                pass

        # Robust rule-based NLI fallback
        doc_raw = f"{evidence.citation_text} {evidence.verification_context}".lower()
        # Expand known acronyms in doc and claim
        doc_text = doc_raw.replace("chief executive officer", "ceo")
        claim_text = claim.normalized_text.lower().replace("chief executive officer", "ceo")

        claim_tokens = _content_tokens(claim_text)
        doc_tokens = _content_tokens(doc_text)

        if not claim_tokens:
            return 0.33, 0.33, 0.34

        overlap = len(claim_tokens.intersection(doc_tokens)) / len(claim_tokens)

        # Check for explicit negation / supersedence cues
        negation_cues = [
            "is not", "was not", "are not", "were not", "no longer",
            "stepped down", "replaced by", "replaced", "succeeding",
            "succeeded by", "stepped down from", "former", "ex-ceo",
            "refuted", "false", "never", "mistakenly", "incorrect", "denied"
        ]
        has_negation = any(cue in doc_text for cue in negation_cues)

        entity_tokens = _content_tokens(claim.entity) if claim.entity else set()
        has_entity = bool(entity_tokens.intersection(doc_tokens)) if entity_tokens else True

        if has_entity and has_negation:
            # If evidence mentions entity and a negation cue, high contradiction
            return 0.05, 0.88, 0.07

        if overlap >= 0.6:
            # Substantial content overlap without negation
            return 0.90, 0.05, 0.05
        elif overlap >= 0.4:
            return 0.65, 0.15, 0.20
        elif has_entity:
            # Mentions entity but little overlap with the claim predicate
            return 0.15, 0.55, 0.30
        else:
            return 0.10, 0.10, 0.80
