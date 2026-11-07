"""Schemas for the unified analysis report and detailed claim items."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationResult
from app.schemas.freshness import FreshnessResult
from app.schemas.correction import GroundedCorrection


class ClaimAnalysisDetail(BaseModel):
    """Unified container for an individual claim and its complete analysis."""
    claim: AtomicClaim
    verification: VerificationResult
    freshness: FreshnessResult
    supporting_evidence: List[EvidenceRecord] = Field(default_factory=list)
    contradicting_evidence: List[EvidenceRecord] = Field(default_factory=list)


class FinalReport(BaseModel):
    """Complete structured EpoClaim analysis report."""
    report_id: str = Field(..., description="Unique report identifier")
    original_input: str = Field(..., description="AI-generated text or collection of statements evaluated")
    total_claims: int = Field(default=0, ge=0)
    supported_claims: int = Field(default=0, ge=0)
    partially_supported_claims: int = Field(default=0, ge=0, description="Claims with mixed proposition outcomes")
    contradicted_claims: int = Field(default=0, ge=0)
    outdated_claims: int = Field(default=0, ge=0)
    insufficient_evidence_claims: int = Field(default=0, ge=0)
    unverified_claims: int = Field(default=0, ge=0)
    overall_assessment: str = Field(
        default="",
        description="Executive summary of answer validity, staleness, and factual grounding"
    )
    claim_results: List[ClaimAnalysisDetail] = Field(
        default_factory=list,
        description="Detailed verification and freshness outcomes per atomic claim"
    )
    evidence_sources: List[EvidenceRecord] = Field(
        default_factory=list,
        description="Deduplicated list of all external sources and evidence records cited"
    )
    grounded_correction: Optional[GroundedCorrection] = Field(
        default=None,
        description="Evidence-grounded corrected answer synthesized from verified propositions"
    )
    scoring_mode: str = Field(
        default="baseline",
        description="Scoring formula used: 'baseline' or 'cluster_capped_experimental'"
    )
    temporal_evaluation_mode: str = Field(
        default="default",
        description="Temporal evaluation mode used: 'default', 'historical', or 'system_as_known'"
    )
    execution_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Runtime statistics: duration_ms, search_queries_executed, models_used"
    )


class AnalyzeRequest(BaseModel):
    """Payload for POST /api/v1/analyze."""
    prompt: Optional[str] = Field(
        default="",
        description="Optional original user question that prompted the AI response"
    )
    response_text: str = Field(
        ...,
        description="The AI-generated response text to verify for factuality and freshness"
    )
    context_documents: Optional[List[Union[str, Dict[str, Any]]]] = Field(
        default=None,
        description="Optional local grounding documents (plain strings or dicts with metadata) to include alongside live search"
    )
    enable_live_search: bool = Field(
        default=True,
        description="Whether to query live web search via Tavily"
    )
    reference_date: Optional[str] = Field(
        default=None,
        description="Optional ISO timestamp to treat as 'now' for temporal backtesting"
    )
    temporal_evaluation_mode: str = Field(
        default="default",
        description="Temporal reasoning mode: 'default', 'historical', or 'system_as_known'"
    )
    as_known_cutoff: Optional[datetime] = Field(
        default=None,
        description="Cutoff timestamp for 'system_as_known' mode (evidence recorded/published after this is ignored)"
    )
    target_event_time: Optional[datetime] = Field(
        default=None,
        description="Target real-world time anchor for 'historical' evaluation mode"
    )
    enable_correlation_discounted_scoring: Optional[bool] = Field(
        default=None,
        description="Override for correlation-aware cluster-capped scoring aggregation"
    )

