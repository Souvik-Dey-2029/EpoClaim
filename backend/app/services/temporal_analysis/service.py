"""Temporal sensitivity classification and temporal reference alignment."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional
from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.core.temporal import utc_now

# Invariant domain cues: historical markers, physics, mathematics, geography
_INVARIANT_CUES = [
    re.compile(r"\b(born|died|discovered|invented|founded|assassinated|signed|landed|fought)\b", re.IGNORECASE),
    re.compile(r"\b(in|during)\s+(1[5-9][0-9]{2}|200[0-9]|201[0-5])\b", re.IGNORECASE), # dates prior to 2016
    re.compile(r"\b(speed of light|freezing point|boiling point|atomic number|chemical formula|constant)\b", re.IGNORECASE),
    re.compile(r"\b(capital of|mountain|river|continent|planet)\b", re.IGNORECASE),
]

# Fast moving cues: prices, latest releases, versions, active live metrics
_FAST_MOVING_CUES = [
    re.compile(r"\b(stock price|market cap|trading at|share price|exchange rate)\b", re.IGNORECASE),
    re.compile(r"\b(latest|current version|newest|released today|just announced|breaking)\b", re.IGNORECASE),
    re.compile(r"\b(temperature|weather|forecast|poll numbers)\b", re.IGNORECASE),
    re.compile(r"\b(as of (today|this week|yesterday))\b", re.IGNORECASE),
]

# Slow moving cues: leadership, titles, policies, relationships
_SLOW_MOVING_CUES = [
    re.compile(r"\b(ceo|president|prime minister|head coach|director|mayor|governor)\b", re.IGNORECASE),
    re.compile(r"\b(married to|working at|employed by|member of|subsidiary of)\b", re.IGNORECASE),
    re.compile(r"\b(regulation|law|policy|population of)\b", re.IGNORECASE),
]


class TemporalAnalysisService:
    """Classifies temporal sensitivity and models temporal context."""

    def classify_sensitivity(self, claim: AtomicClaim) -> TemporalSensitivity:
        """Classify a claim as TIME_INVARIANT, SLOW_MOVING, or FAST_MOVING."""
        text = f"{claim.normalized_text} {claim.attribute} {claim.claimed_value}".lower()

        # Check for FAST_MOVING first
        for pat in _FAST_MOVING_CUES:
            if pat.search(text):
                return TemporalSensitivity.FAST_MOVING

        # Check for TIME_INVARIANT historical / scientific facts
        # Note: A claim with an explicit past historical date anchor is usually invariant
        if claim.temporal_reference:
            year_match = re.search(r"\b(1[0-9]{3}|200[0-9]|201[0-5])\b", claim.temporal_reference)
            if year_match:
                return TemporalSensitivity.TIME_INVARIANT

        for pat in _INVARIANT_CUES:
            if pat.search(text):
                return TemporalSensitivity.TIME_INVARIANT

        # Check for SLOW_MOVING leadership / affiliation
        for pat in _SLOW_MOVING_CUES:
            if pat.search(text):
                return TemporalSensitivity.SLOW_MOVING

        # Default to SLOW_MOVING for general real-world propositions
        return TemporalSensitivity.SLOW_MOVING

    def get_reference_timestamp(self, claim: AtomicClaim, requested_ref: Optional[datetime] = None) -> datetime:
        """Determine the temporal anchor against which evidence must be measured.

        If a claim explicitly says 'In 1995, X was Y', the claim's validity
        must be checked against 1995, not today.
        """
        if claim.temporal_reference:
            year_match = re.search(r"\b([12][0-9]{3})\b", claim.temporal_reference)
            if year_match:
                year = int(year_match.group(1))
                # Return Jan 1st of that year in UTC
                from datetime import timezone
                return datetime(year, 1, 1, tzinfo=timezone.utc)

        return requested_ref or utc_now()

