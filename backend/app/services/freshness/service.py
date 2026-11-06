"""Freshness calculation and temporal supersedence engine."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationVerdict, VerificationResult
from app.schemas.freshness import FreshnessStatus, FreshnessResult
from app.core.temporal import compute_age_hours, utc_now
from app.services.freshness.decay import half_life_decay
from app.core.config import settings


class FreshnessService:
    """Evaluates temporal validity, evidence recency decay, and supersedence."""

    def evaluate_freshness(
        self,
        claim: AtomicClaim,
        verification: VerificationResult,
        supporting: List[EvidenceRecord],
        contradicting: List[EvidenceRecord],
        reference_time: Optional[datetime] = None,
    ) -> Tuple[FreshnessResult, VerificationVerdict]:
        """Assess freshness and determine whether a contradicted claim is OUTDATED.

        Returns:
            Tuple of (FreshnessResult, updated_verdict)
        """
        ref_time = reference_time or utc_now()
        sensitivity = claim.temporal_sensitivity

        # Adjust half-life based on claim volatility
        if sensitivity == TemporalSensitivity.FAST_MOVING:
            half_life = 24.0  # 1 day for fast-moving claims
        elif sensitivity == TemporalSensitivity.SLOW_MOVING:
            half_life = settings.default_half_life_hours  # 7 days
        else:
            half_life = float("inf")  # Invariant claims do not decay

        # Find newest supporting and newest contradicting evidence dates
        newest_support_date = self._get_newest_date(supporting)
        newest_contra_date = self._get_newest_date(contradicting)

        # Compute age in hours
        primary_date = newest_support_date or newest_contra_date
        evidence_age_hours = compute_age_hours(primary_date, ref_time) if primary_date else None

        # Check for TEMPORAL SUPERSEDENCE:
        # A claim is OUTDATED if:
        # 1. We have supporting evidence with a timestamp T1, AND
        # 2. We have contradictory evidence with a timestamp T2, AND
        # 3. T2 is significantly newer than T1 (e.g. T2 > T1), showing the state of the world changed!
        # OR the contradictory evidence explicitly cites a superseding update.
        is_superseded = False
        if newest_contra_date and newest_support_date:
            if newest_contra_date > newest_support_date:
                is_superseded = True
        elif contradicting and any("no longer" in (r.citation_text.lower()) or "stepped down" in (r.citation_text.lower()) for r in contradicting):
            is_superseded = True

        updated_verdict = verification.verdict

        # Calculate decay factor
        if sensitivity == TemporalSensitivity.TIME_INVARIANT:
            decay_factor = 1.0
            freshness_status = FreshnessStatus.STATIC_VALID
            explanation = "Fact is historically or scientifically invariant; publication age does not degrade freshness."
        elif evidence_age_hours is not None:
            decay_factor = half_life_decay(evidence_age_hours, half_life)
            if decay_factor > 0.7:
                freshness_status = FreshnessStatus.CURRENT
                explanation = f"Evidence is fresh (age: {evidence_age_hours:.1f} hrs, freshness factor: {decay_factor:.2f})."
            else:
                freshness_status = FreshnessStatus.DRIFTING
                explanation = f"Evidence has aged ({evidence_age_hours:.1f} hrs since publication; freshness factor: {decay_factor:.2f})."
        else:
            decay_factor = 0.5
            freshness_status = FreshnessStatus.UNKNOWN
            explanation = "No publication dates were available on retrieved evidence; freshness cannot be measured precisely."

        # Handle supersedence & outdated detection
        if is_superseded:
            updated_verdict = VerificationVerdict.OUTDATED
            freshness_status = FreshnessStatus.OUTDATED
            freshness_score = 0.1
            explanation = (
                f"Claim is OUTDATED: superseded by newer contradictory evidence "
                f"(Newer update: {newest_contra_date.strftime('%Y-%m-%d') if newest_contra_date else 'recent'} vs "
                f"Previous: {newest_support_date.strftime('%Y-%m-%d') if newest_support_date else 'historical'})."
            )
        elif verification.verdict == VerificationVerdict.SUPPORTED:
            freshness_score = round(decay_factor, 4)
        elif verification.verdict == VerificationVerdict.CONTRADICTED:
            freshness_score = 0.2
            explanation = "Claim is contradicted by contemporary authoritative evidence."
        else:
            freshness_score = 0.5

        # Measure evidence consistency
        total_evidence = len(supporting) + len(contradicting)
        if total_evidence > 0:
            evidence_consistency = round(abs(len(supporting) - len(contradicting)) / total_evidence, 2)
        else:
            evidence_consistency = 0.5

        freshness_result = FreshnessResult(
            claim_id=claim.claim_id,
            temporal_sensitivity=sensitivity,
            reference_time=ref_time,
            freshness_score=round(freshness_score, 4),
            freshness_status=freshness_status,
            evidence_age=evidence_age_hours,
            evidence_consistency=evidence_consistency,
            confidence=round(decay_factor if not is_superseded else 0.9, 2),
            explanation=explanation,
        )

        return freshness_result, updated_verdict

    def _get_newest_date(self, records: List[EvidenceRecord]) -> Optional[datetime]:
        """Find the most recent publication or update date from a set of records."""
        dates = []
        for r in records:
            d = r.last_updated_date or r.publication_date
            if d:
                # Ensure UTC
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                dates.append(d)
        return max(dates) if dates else None

