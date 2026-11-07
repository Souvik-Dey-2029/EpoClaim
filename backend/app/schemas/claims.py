"""Schemas for atomic claims and temporal classifications."""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.evidence import TemporalInterval


class TemporalSensitivity(str, Enum):
    """Categorization of how quickly a factual claim becomes vulnerable to change."""
    TIME_INVARIANT = "TIME_INVARIANT"      # Historical facts, physical laws, mathematical truths
    SLOW_MOVING = "SLOW_MOVING"            # Corporate leadership, country capitals, long-term policies
    FAST_MOVING = "FAST_MOVING"            # Stock prices, sports scores, latest software versions, live events


class PropositionPolarity(str, Enum):
    """Semantic polarity of the proposition assertion."""
    POSITIVE = "POSITIVE"
    NEGATIVE = "NEGATIVE"


class EpistemicModality(str, Enum):
    """Epistemic modality or communicative framing of the assertion."""
    ASSERTED = "ASSERTED"
    POSSIBLE = "POSSIBLE"
    CONDITIONAL = "CONDITIONAL"
    ALLEGED = "ALLEGED"
    REPORTED = "REPORTED"
    PLANNED = "PLANNED"
    UNKNOWN = "UNKNOWN"


class StructuredProposition(BaseModel):
    """Granular, atomic factual proposition decomposed from a parent claim or sentence."""
    proposition_id: str = Field(..., description="Unique identifier for the proposition (e.g. 'prop_123')")
    parent_claim_id: str = Field(..., description="ID of the parent sentence or claim that produced this proposition")
    source_claim_id: str = Field(..., description="Root source claim identifier for backward provenance")
    subject: str = Field(..., description="Entity or concept the proposition is about")
    predicate: str = Field(..., description="Action, relation, or attribute linking subject and object")
    object: str = Field(default="", description="Target entity, attribute value, or state asserted")
    qualifiers: dict = Field(default_factory=dict, description="Contextual qualifiers (contrast, condition, modality)")
    polarity: PropositionPolarity = Field(default=PropositionPolarity.POSITIVE, description="Positive or negative polarity")
    modality: EpistemicModality = Field(default=EpistemicModality.ASSERTED, description="Epistemic modality of the assertion")
    temporal_scope: Optional[str] = Field(default=None, description="Explicit or inferred time window / validity")
    related_entities: list[str] = Field(default_factory=list, description="Extracted named entities in this proposition")
    original_text_span: str = Field(..., description="Verbatim text span corresponding to this proposition")
    start_char: Optional[int] = Field(default=None, description="Start character index of original_text_span in parent sentence/claim")
    end_char: Optional[int] = Field(default=None, description="End character index of original_text_span in parent sentence/claim")
    extraction_confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence in decomposition")
    asserted_valid_time: Optional[TemporalInterval] = Field(
        default=None,
        description="Temporal validity interval asserted by this proposition"
    )


class AtomicClaim(BaseModel):
    """An individual factual claim extracted from an AI-generated answer.
    
    Can contain one or more granular StructuredPropositions when compound.
    """
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
    propositions: list[StructuredProposition] = Field(
        default_factory=list,
        description="Decomposed atomic propositions underpinning this claim"
    )
    asserted_valid_time: Optional[TemporalInterval] = Field(
        default=None,
        description="Temporal validity interval asserted by this claim"
    )

