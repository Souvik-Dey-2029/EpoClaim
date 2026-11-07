"""Schemas for retrieved evidence passages and source metadata."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.core.temporal import utc_now


class RetrievalMethod(str, Enum):
    BM25 = "bm25"
    DENSE = "dense"
    HYBRID_RRF = "hybrid_rrf"
    TAVILY_SEARCH = "tavily_search"
    KNOWLEDGE_BASE = "knowledge_base"


class TemporalPrecision(str, Enum):
    """Precision level for temporal intervals and point occurrences."""
    INSTANT = "INSTANT"
    DAY = "DAY"
    MONTH = "MONTH"
    YEAR = "YEAR"
    UNKNOWN = "UNKNOWN"


class TemporalIntervalStatus(str, Enum):
    """Boundary nature of a temporal interval."""
    KNOWN_INTERVAL = "KNOWN_INTERVAL"
    OPEN_START = "OPEN_START"
    OPEN_END = "OPEN_END"
    UNKNOWN = "UNKNOWN"


class PublicationTimeSource(str, Enum):
    """Origin and provenance of the publication timestamp."""
    PROVIDER_SUPPLIED = "PROVIDER_SUPPLIED"
    DOCUMENT_METADATA = "DOCUMENT_METADATA"
    EXTRACTED_FROM_TEXT = "EXTRACTED_FROM_TEXT"
    INFERRED = "INFERRED"
    UNKNOWN = "UNKNOWN"


class SourceRelationshipType(str, Enum):
    """Cluster membership or provenance relationship between evidence sources."""
    SAME_CANONICAL_DOCUMENT = "SAME_CANONICAL_DOCUMENT"
    EXACT_COPY = "EXACT_COPY"
    NEAR_DUPLICATE = "NEAR_DUPLICATE"
    EXPLICITLY_SYNDICATED = "EXPLICITLY_SYNDICATED"
    UNKNOWN_RELATIONSHIP = "UNKNOWN_RELATIONSHIP"


class TemporalEligibilityStatus(str, Enum):
    """Temporal admissibility of an evidence item for a given evaluation mode/target."""
    ELIGIBLE = "ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    UNKNOWN = "UNKNOWN"


class TemporalInterval(BaseModel):
    """Half-open [start_time, end_time) UTC temporal interval representing validity."""
    start_time: Optional[datetime] = Field(default=None, description="Start boundary in UTC (inclusive by default)")
    end_time: Optional[datetime] = Field(default=None, description="End boundary in UTC (exclusive by default)")
    start_inclusive: bool = Field(default=True, description="Whether start boundary is inclusive")
    end_inclusive: bool = Field(default=False, description="Whether end boundary is inclusive")
    precision: TemporalPrecision = Field(default=TemporalPrecision.UNKNOWN, description="Temporal granularity")
    temporal_status: TemporalIntervalStatus = Field(default=TemporalIntervalStatus.UNKNOWN, description="Boundary status")

    def contains(self, dt: datetime) -> bool:
        """Check if a datetime falls within this temporal interval.
        
        If temporal_status is UNKNOWN or both start_time and end_time are None,
        it does NOT imply infinite validity; it returns False (unknown validity cannot contain with certainty).
        """
        if dt is None:
            return False
        if self.temporal_status == TemporalIntervalStatus.UNKNOWN and self.start_time is None and self.end_time is None:
            return False
        if self.start_time is None and self.end_time is None:
            return False
        # Normalize naive dt to UTC if needed
        dt_val = dt
        if self.start_time is not None:
            st = self.start_time
            if self.start_inclusive:
                if dt_val < st:
                    return False
            else:
                if dt_val <= st:
                    return False
        if self.end_time is not None:
            et = self.end_time
            if self.end_inclusive:
                if dt_val > et:
                    return False
            else:
                if dt_val >= et:
                    return False
        return True


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
    
    # Phase 2B Bitemporal & Provenance Extensions
    canonical_url: Optional[str] = Field(default=None, description="Resolved canonical URL of the document")
    root_source_id: Optional[str] = Field(default=None, description="Identifier of cluster root source document")
    source_version_id: Optional[str] = Field(default=None, description="Identifier of specific source revision/snapshot")
    publication_time: Optional[datetime] = Field(
        default=None,
        description="Explicit publication timestamp (synced with publication_date)"
    )
    publication_time_source: PublicationTimeSource = Field(
        default=PublicationTimeSource.UNKNOWN,
        description="Provenance of how publication_time was acquired"
    )
    transaction_time: Optional[datetime] = Field(
        default=None,
        description="Timestamp when EpoClaim committed this record to persistence"
    )
    content_hash: Optional[str] = Field(
        default=None,
        description="SHA-256 hash of verbatim citation_text/content"
    )
    normalized_content_hash: Optional[str] = Field(
        default=None,
        description="SHA-256 hash of normalized content (lowercased, stripped whitespace/punctuation)"
    )
    asserted_valid_time: Optional[TemporalInterval] = Field(
        default=None,
        description="Real-world valid time interval asserted by the evidence proposition"
    )
    temporal_eligibility: TemporalEligibilityStatus = Field(
        default=TemporalEligibilityStatus.ELIGIBLE,
        description="Eligibility of this evidence for verification under current evaluation mode"
    )
    relationship_type: SourceRelationshipType = Field(
        default=SourceRelationshipType.UNKNOWN_RELATIONSHIP,
        description="Relationship to canonical or syndicated document"
    )

    def model_post_init(self, __context: Any) -> None:
        # Keep publication_time and publication_date synchronized
        if self.publication_time is not None and self.publication_date is None:
            self.publication_date = self.publication_time
        elif self.publication_date is not None and self.publication_time is None:
            self.publication_time = self.publication_date

