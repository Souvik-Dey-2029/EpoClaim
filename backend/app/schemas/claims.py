"""Schemas for atomic claims and temporal classifications."""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class TemporalSensitivity(str, Enum):
    """Categorization of how quickly a factual claim becomes vulnerable to change."""
    TIME_INVARIANT = "TIME_INVARIANT"      # Historical facts, physical laws, mathematical truths
    SLOW_MOVING = "SLOW_MOVING"            # Corporate leadership, country capitals, long-term policies
    FAST_MOVING = "FAST_MOVING"            # Stock prices, sports scores, latest software versions, live events


class AtomicClaim(BaseModel):
    """An individual atomic factual claim extracted from an AI-generated answer."""
    claim_id: str = Field(..., description="Unique deterministic or UUID identifier for the claim")
    original_text: str = Field(..., description="Original verbatim text span from the source response")
    normalized_text: str = Field(..., description="Self-contained, decontextualized factual proposition")
    entity: str = Field(default="", description="Primary subject entity (e.g. 'OpenAI', 'Albert Einstein')")
    attribute: str = Field(default="", description="Predicate or attribute being asserted (e.g. 'CEO', 'birth year')")
    claimed_value: str = Field(default="", description="Asserted value for the entity-attribute pair")
    temporal_sensitivity: TemporalSensitivity = Field(
        default=TemporalSensitivity.SLOW_MOVING,
        description="Assessed sensitivity to temporal changes"
    )
    temporal_reference: Optional[str] = Field(
        default=None,
        description="Explicit temporal anchor in the claim, e.g. 'in 2024', 'currently', 'yesterday'"
    )
    extraction_confidence: float = Field(
        default=1.0, ge=0.0, le=1.0,
        description="Model confidence in the claim extraction accuracy"
    )
    start_char: Optional[int] = Field(default=None, description="Start character index in original response")
    end_char: Optional[int] = Field(default=None, description="End character index in original response")

