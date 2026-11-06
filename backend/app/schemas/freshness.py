"""Schemas for temporal freshness assessment."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.core.temporal import utc_now
from app.schemas.claims import TemporalSensitivity


class FreshnessStatus(str, Enum):
    CURRENT = "CURRENT"              # Evidence is recent and fully consistent
    OUTDATED = "OUTDATED"            # Superseded by newer conflicting evidence
    DRIFTING = "DRIFTING"            # Aging evidence with partial ambiguity
    STATIC_VALID = "STATIC_VALID"    # Historical / invariant fact; age decay is not penalizing
    UNKNOWN = "UNKNOWN"              # Inadequate temporal data or unverified


class FreshnessResult(BaseModel):
    """Temporal freshness evaluation for a single claim."""
    claim_id: str = Field(..., description="ID of the claim")
    temporal_sensitivity: TemporalSensitivity = Field(..., description="Sensitivity classification")
    reference_time: datetime = Field(
        default_factory=utc_now,
        description="Temporal anchor or evaluation reference timestamp"
    )
    freshness_score: float = Field(
        default=1.0, ge=0.0, le=1.0,
        description="Calculated freshness score in [0.0, 1.0]"
    )
    freshness_status: FreshnessStatus = Field(
        default=FreshnessStatus.CURRENT,
        description="Categorical freshness determination"
    )
    evidence_age: Optional[float] = Field(
        default=None,
        description="Age of newest relevant evidence in hours (None if undated)"
    )
    evidence_consistency: float = Field(
        default=1.0, ge=0.0, le=1.0,
        description="Degree of agreement across timestamps and multiple sources"
    )
    confidence: float = Field(
        default=0.8, ge=0.0, le=1.0,
        description="Confidence in the freshness determination"
    )
    explanation: str = Field(
        default="",
        description="Detailed rationale for the freshness verdict"
    )

