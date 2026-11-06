"""Schemas for the unified analysis report and detailed claim items."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationResult
from app.schemas.freshness import FreshnessResult


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
    context_documents: Optional[List[str]] = Field(
        default=None,
        description="Optional local grounding documents to include alongside live search"
    )
    enable_live_search: bool = Field(
        default=True,
        description="Whether to query live web search via Tavily"
    )
    reference_date: Optional[str] = Field(
        default=None,
        description="Optional ISO timestamp to treat as 'now' for temporal backtesting"
    )

