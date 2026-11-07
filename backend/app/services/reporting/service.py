"""Final report aggregation and coverage assessment service."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional
from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationVerdict, VerificationResult
from app.schemas.freshness import FreshnessResult
from app.schemas.report import FinalReport, ClaimAnalysisDetail
from app.schemas.correction import GroundedCorrection
from app.services.correction.service import AnswerCorrectionService


class ReportingService:
    """Compiles individual claim analyses into a unified structured FinalReport."""

    def __init__(self):
        self.correction_service = AnswerCorrectionService()

    def generate_report(
        self,
        original_input: str,
        claim_details: List[ClaimAnalysisDetail],
        execution_metadata: Dict[str, object] | None = None,
        grounded_correction: Optional[GroundedCorrection] = None,
    ) -> FinalReport:
        report_id = f"epo_{uuid.uuid4().hex[:10]}"
        total = len(claim_details)

        supported = 0
        partially_supported = 0
        contradicted = 0
        outdated = 0
        insufficient = 0
        unverified = 0

        unique_sources: Dict[str, EvidenceRecord] = {}

        for detail in claim_details:
            v = detail.verification.verdict
            if v == VerificationVerdict.SUPPORTED:
                supported += 1
            elif v == VerificationVerdict.PARTIALLY_SUPPORTED:
                partially_supported += 1
            elif v == VerificationVerdict.CONTRADICTED:
                contradicted += 1
            elif v == VerificationVerdict.OUTDATED:
                outdated += 1
            elif v == VerificationVerdict.INSUFFICIENT_EVIDENCE:
                insufficient += 1
            else:
                unverified += 1

            for ev in detail.supporting_evidence + detail.contradicting_evidence:
                if ev.evidence_id not in unique_sources:
                    unique_sources[ev.evidence_id] = ev

        # Generate evidence-grounded correction if not provided
        correction = grounded_correction or self.correction_service.generate_correction(
            original_input, claim_details
        )

        # Coverage and validity summary
        overall = self._generate_overall_assessment(
            total, supported, partially_supported, contradicted, outdated, insufficient, unverified
        )

        return FinalReport(
            report_id=report_id,
            original_input=original_input,
            total_claims=total,
            supported_claims=supported,
            partially_supported_claims=partially_supported,
            contradicted_claims=contradicted,
            outdated_claims=outdated,
            insufficient_evidence_claims=insufficient,
            unverified_claims=unverified,
            overall_assessment=overall,
            claim_results=claim_details,
            evidence_sources=list(unique_sources.values()),
            grounded_correction=correction,
            execution_metadata=execution_metadata or {},
        )

    def _generate_overall_assessment(
        self,
        total: int,
        supported: int,
        partially_supported: int,
        contradicted: int,
        outdated: int,
        insufficient: int,
        unverified: int,
    ) -> str:
        if total == 0:
            return "No verifiable factual claims were detected in the input."

        if outdated > 0:
            return f"TEMPORALLY OUTDATED: {outdated}/{total} claim(s) superseded by more recent evidence."
        if contradicted > 0:
            return f"FACTUALLY CONTRADICTED: {contradicted}/{total} claim(s) refuted by reliable sources."
        if partially_supported > 0:
            return f"PARTIALLY SUPPORTED: {partially_supported}/{total} compound claim(s) have unverified or mixed clauses."
        if supported == total:
            return f"FULLY SUPPORTED: All {total} factual claim(s) corroborated by reliable evidence."
        if insufficient == total:
            return f"INSUFFICIENT EVIDENCE: None of the {total} claim(s) could be corroborated by retrieved sources."

        return f"EVALUATED: {supported} supported, {partially_supported} partial, {insufficient} insufficient of {total} claims."

        parts = []
        if outdated > 0:
            parts.append(f"Contains {outdated} OUTDATED claim(s) superseded by newer information.")
        if contradicted > 0:
            parts.append(f"Contains {contradicted} CONTRADICTED factual claim(s).")
        if insufficient > 0:
            parts.append(f"{insufficient} claim(s) lack sufficient verifying evidence.")
        if unverified > 0:
            parts.append(f"{unverified} claim(s) could not be verified.")

        if supported == total:
            return "VERIFIED FRESH: All factual claims in the response are supported by evidence and remain valid."
        elif supported > 0 and not (outdated or contradicted):
            return f"PARTIALLY VERIFIED: {supported}/{total} claims supported, while {insufficient + unverified} require further evidence."
        elif outdated > 0 and not contradicted:
            return f"TEMPORALLY STALE: {outdated}/{total} claims are outdated. " + " ".join(parts)
        elif contradicted > 0:
            return f"FACTUALLY DISPUTED: {contradicted}/{total} claims are directly refuted by authoritative sources. " + " ".join(parts)
        else:
            return "INCONCLUSIVE: " + " ".join(parts)

