"""Schemas for retrieved evidence passages and source metadata."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.core.temporal import utc_now


class RetrievalMethod(str, Enum):
    BM25 = "bm25"
    DENSE = "dense"
    HYBRID_RRF = "hybrid_rrf"
    TAVILY_SEARCH = "tavily_search"
    KNOWLEDGE_BASE = "knowledge_base"


class EvidenceRecord(BaseModel):
    """Structured evidence item supporting or contradicting a claim."""
    evidence_id: str = Field(..., description="Unique ID for this evidence excerpt")
    claim_id: str = Field(..., description="ID of the claim this evidence addresses")
    source_url: Optional[str] = Field(default=None, description="Direct URL of the source article")
    source_title: str = Field(default="", description="Title of the source webpage or publication")
    source_domain: str = Field(default="", description="Originating domain, e.g. 'bbc.com', 'wikipedia.org'")
    publisher: Optional[str] = Field(default=None, description="Authoritative publisher or organization")
    publication_date: Optional[datetime] = Field(
        default=None,
        description="True publication date (None if unavailable; NEVER invented)"
    )
    last_updated_date: Optional[datetime] = Field(
        default=None,
        description="Last modified date of the source document"
    )
    event_date: Optional[datetime] = Field(
        default=None,
        description="Explicit event timestamp mentioned in the evidence passage"
    )
    parent_doc_id: Optional[str] = Field(
        default=None,
        description="Identifier of parent source document if segmented into sentences"
    )
    retrieved_at: datetime = Field(
        default_factory=utc_now,
        description="Timestamp when EpoClaim retrieved this record"
    )
    citation_text: str = Field(
        ...,
        description="Exact quote presented to the end user for verification"
    )
    verification_context: str = Field(
        ...,
        description="Surrounding text window used internally for coreference and stance resolution"
    )
    relevance_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Relevance of evidence to the claim topic (independent of stance)"
    )
    source_quality: float = Field(
        default=0.5, ge=0.0, le=1.0,
        description="Heuristic domain credibility score"
    )
    retrieval_method: str = Field(
        default=RetrievalMethod.HYBRID_RRF.value,
        description="Retrieval channel or fusion method that yielded this item"
    )

