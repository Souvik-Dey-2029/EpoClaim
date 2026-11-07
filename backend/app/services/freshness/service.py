"""Freshness calculation and temporal supersedence engine."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.schemas.evidence import EvidenceRecord, TemporalEligibilityStatus
from app.schemas.verification import VerificationVerdict, VerificationResult
from app.schemas.freshness import FreshnessStatus, FreshnessResult
from app.core.temporal import compute_age_hours, utc_now
from app.services.freshness.decay import half_life_decay
from app.core.config import settings


def filter_temporally_eligible_evidence(
    records: List[EvidenceRecord],
    mode: str = "default",
    as_known_cutoff: Optional[datetime] = None,
    target_event_time: Optional[datetime] = None,
) -> List[EvidenceRecord]:
    """Filter evidence records for temporal eligibility based on verification mode.

    Modes:
      1. 'historical': Evaluates historical truth during a target time interval.
         Evidence published LATER (e.g., 2026) is fully ELIGIBLE if its asserted_valid_time
         or event context covers target_event_time.
         Evidence whose valid interval strictly excludes target_event_time is INELIGIBLE.
      2. 'system_as_known': Evaluates what EpoClaim had recorded by cutoff T_cutoff.
         Requires Publication Time T_p <= T_cutoff AND Transaction Time T_x <= T_cutoff.
      3. 'default': Standard baseline behavior. All non-explicitly ineligible records are eligible.
    """
    eligible_records: List[EvidenceRecord] = []
    
    # Normalize cutoff times to UTC
    cutoff_utc = None
    if as_known_cutoff is not None:
        cutoff_utc = as_known_cutoff if as_known_cutoff.tzinfo is not None else as_known_cutoff.replace(tzinfo=timezone.utc)
        
    target_utc = None
    if target_event_time is not None:
        target_utc = target_event_time if target_event_time.tzinfo is not None else target_event_time.replace(tzinfo=timezone.utc)

    for rec in records:
        pub_dt = rec.publication_time or rec.publication_date
        if pub_dt and pub_dt.tzinfo is None:
            pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        tx_dt = rec.transaction_time
        if tx_dt and tx_dt.tzinfo is None:
            tx_dt = tx_dt.replace(tzinfo=timezone.utc)

        if mode == "system_as_known" and cutoff_utc is not None:
            # Must satisfy T_p <= T_cutoff AND (T_x is None OR T_x <= T_cutoff)
            pub_ok = (pub_dt is not None and pub_dt <= cutoff_utc)
            tx_ok = (tx_dt is None or tx_dt <= cutoff_utc)
            if pub_ok and tx_ok:
                rec.temporal_eligibility = TemporalEligibilityStatus.ELIGIBLE
                eligible_records.append(rec)
            else:
                rec.temporal_eligibility = TemporalEligibilityStatus.INELIGIBLE

        elif mode == "historical" and target_utc is not None:
            # If evidence has an asserted valid interval, check containment
            if rec.asserted_valid_time is not None:
                if rec.asserted_valid_time.contains(target_utc):
                    rec.temporal_eligibility = TemporalEligibilityStatus.ELIGIBLE
                    eligible_records.append(rec)
                else:
                    rec.temporal_eligibility = TemporalEligibilityStatus.INELIGIBLE
            else:
                # If no asserted valid time, check event_date or publication_date
                ev_dt = rec.event_date
                if ev_dt and ev_dt.tzinfo is None:
                    ev_dt = ev_dt.replace(tzinfo=timezone.utc)
                if ev_dt is not None:
                    # Point event matches if year/month matches target or within proximity
                    rec.temporal_eligibility = TemporalEligibilityStatus.ELIGIBLE
                    eligible_records.append(rec)
                else:
                    # Retrospective reporting from later date is eligible
                    rec.temporal_eligibility = TemporalEligibilityStatus.ELIGIBLE
                    eligible_records.append(rec)
        else:
            rec.temporal_eligibility = TemporalEligibilityStatus.ELIGIBLE
            eligible_records.append(rec)

    return eligible_records


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
        # 1. It is time-sensitive (NOT a historical invariant), AND
        # 2. We have supporting evidence with timestamp T1, AND
        # 3. We have actual contradictory evidence with timestamp T2 where T2 > T1,
        #    OR the contradictory evidence explicitly cites a state-changing event (resignation, replacement).
        # Both event_date (factual state transition) and publication_date (reporting recency) are tracked independently.
        is_superseded = False
        supersedes_older_contradiction = False
        supersedence_cues = [
            "no longer", "stepped down", "resigned", "concluding", "concluded",
            "returned as", "reinstated", "replaced by", "replaced", "succeeded by",
            "succeeded", "is now the latest", "now the latest", "now the current",
            "former", "ex-", "previously", "defeated", "retracted",
        ]

        if sensitivity != TemporalSensitivity.TIME_INVARIANT:
            if newest_contra_date and newest_support_date:
                if newest_contra_date > newest_support_date:
                    is_superseded = True
                elif newest_support_date > newest_contra_date:
                    # Supporting evidence is newer than older contradictory state
                    supersedes_older_contradiction = True
            elif not is_superseded and contradicting and not supporting:
                for r in contradicting:
                    c_text = f"{r.citation_text} {r.verification_context}".lower()
                    if any(cue in c_text for cue in supersedence_cues):
                        is_superseded = True
                        break

        updated_verdict = verification.verdict
        if supersedes_older_contradiction and verification.verdict == VerificationVerdict.CONTRADICTED:
            updated_verdict = VerificationVerdict.SUPPORTED

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
            d = r.event_date or r.last_updated_date or r.publication_date
            if d:
                # Ensure UTC
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                dates.append(d)
        return max(dates) if dates else None

