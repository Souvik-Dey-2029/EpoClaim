"""Schemas for grounded answer corrections and explainability."""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field


class CorrectionOperationType(str, Enum):
    """Authorized correction operation types for proposition-level units."""
    REPHRASE_SUPPORTED = "REPHRASE_SUPPORTED"
    REPLACE_OUTDATED = "REPLACE_OUTDATED"


class PropositionCorrectionUnit(BaseModel):
    """Granular, verifiable correction sentence mapped to a single proposition."""
    proposition_id: str = Field(..., description="ID of the verified StructuredProposition being addressed")
    operation: CorrectionOperationType = Field(..., description="REPHRASE_SUPPORTED or REPLACE_OUTDATED")
    text: str = Field(..., min_length=5, description="Synthesized fluent sentence addressing this proposition")
    cited_evidence_ids: List[str] = Field(default_factory=list, description="Evidence IDs explicitly supporting this text")
    change_type: str = Field(
        ...,
        description="RETAINED_SUPPORTED | CORRECTED_OUTDATED | REFUTED_CONTRADICTED"
    )
    explanation: str = Field(default="", description="Concise justification grounded in evidence")


class CitationReference(BaseModel):
    """Citation linking a statement to an evidence source."""
    citation_number: int = Field(..., description="1-based citation index e.g. [1]")
    evidence_id: str = Field(..., description="Referenced evidence ID")
    source_title: str = Field(..., description="Title or publisher of the source")
    source_url: Optional[str] = Field(default=None, description="URL of the evidence")
    published_date: Optional[Union[str, datetime]] = Field(default=None, description="Publication date if available")
    snippet: str = Field(..., description="Verifiable snippet supporting the correction")


class CorrectionDelta(BaseModel):
    """Explanation of a specific factual change between original and corrected text."""
    claim_id: str = Field(..., description="ID of affected claim")
    proposition_id: Optional[str] = Field(default=None, description="ID of affected proposition")
    change_type: str = Field(..., description="RETAINED_SUPPORTED | CORRECTED_OUTDATED | REFUTED_CONTRADICTED | QUALIFIED_UNVERIFIED")
    original_text: str = Field(..., description="Original claim or proposition text")
    explanation: str = Field(..., description="Why this statement was changed, retained, or qualified")


class GroundedCorrection(BaseModel):
    """Evidence-grounded corrected response produced from verified propositions."""
    original_text: str = Field(..., description="Original user/AI response")
    corrected_text: str = Field(..., description="Synthesized corrected answer containing only verified or qualified facts")
    as_of_timestamp: str = Field(..., description="Effective as-of evaluation timestamp")
    citations: List[CitationReference] = Field(default_factory=list, description="Ordered list of sources cited in corrected_text")
    deltas: List[CorrectionDelta] = Field(default_factory=list, description="Itemized changes from original text")
    unresolved_uncertainties: List[str] = Field(
        default_factory=list,
        description="Statements that could not be corroborated due to insufficient evidence"
    )
    # Phase 3D Observability Fields (backward-compatible defaults)
    correction_mode: str = Field(
        default="deterministic",
        description="Overall correction synthesis mode: 'deterministic' or 'llm_assisted'"
    )
    invariant_checks_passed: bool = Field(
        default=True,
        description="Whether all structural and deterministic invariance filters passed"
    )
    entailment_verified: bool = Field(
        default=False,
        description="Whether an independent directional entailment validator verified the correction (never True for mocks/regex)"
    )
    fallback_reason: Optional[str] = Field(
        default=None,
        description="Explanation if fallback to deterministic synthesis occurred"
    )
    unit_results: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Per-proposition correction unit metadata and fallback tracking"
    )
