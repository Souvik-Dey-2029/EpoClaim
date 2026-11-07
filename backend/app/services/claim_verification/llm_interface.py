"""Provider-neutral LLM reasoning interface and schemas.

Prepares contracts for structured claim extraction and claim-vs-evidence assessment
for future Bifrost / LLM integration without introducing external vendor SDKs.
"""
from __future__ import annotations

import abc
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.structured_claim import StructuredClaim
from app.schemas.claims import StructuredProposition
from app.schemas.correction import PropositionCorrectionUnit


# ============================================================================
# Schemas for Answer Correction
# ============================================================================

class CorrectionGenerationRequest(BaseModel):
    """Input payload for LLM-assisted proposition-level answer correction."""
    original_text: str = Field(..., description="Original user/AI response text")
    as_of_date: str = Field(..., description="Evaluation reference date or timestamp string")
    propositions_data: List[Dict[str, Any]] = Field(
        ...,
        description="Structured proposition payloads with verdicts, authorized operation, and evidence whitelist"
    )
    evidence_pool: List[Dict[str, Any]] = Field(
        ...,
        description="Whitelisted candidate evidence passages with IDs, titles, dates, snippets"
    )


class CorrectionGenerationResponse(BaseModel):
    """Output payload from LLM-assisted proposition-level answer correction."""
    correction_units: List[PropositionCorrectionUnit] = Field(default_factory=list)
    raw_response: Optional[str] = Field(default=None, description="Raw provider output for auditing")
    provider_name: str = Field(default="mock", description="Name of the backing model/gateway")


# ============================================================================
# Schemas for Claim Extraction
# ============================================================================

class ExtractionRequest(BaseModel):
    """Input payload for LLM-assisted claim extraction / proposition decomposition."""
    response_text: str = Field(..., min_length=1, description="AI-generated text or sentence to decompose into atomic claims/propositions")
    context_hint: Optional[str] = Field(default=None, description="Optional prompt or conversation context")
    claim_id: Optional[str] = Field(default=None, description="Identifier of the claim or sentence being decomposed")
    sentence_text: Optional[str] = Field(default=None, description="Isolated sentence text if decomposing a specific claim")
    start_char: Optional[int] = Field(default=None, description="Global start character offset")
    end_char: Optional[int] = Field(default=None, description="Global end character offset")
    extraction_version: str = Field(default="v1", description="Decomposition schema version")


class ExtractionResponse(BaseModel):
    """Output payload from LLM-assisted claim extraction / proposition decomposition."""
    claims: List[StructuredClaim] = Field(default_factory=list, description="Extracted structured factual claims")
    propositions: List[StructuredProposition] = Field(default_factory=list, description="Decomposed structured propositions")
    raw_response: Optional[str] = Field(default=None, description="Raw provider output for auditing")
    provider_name: str = Field(default="mock", description="Name of the backing model/gateway")


# ============================================================================
# Schemas for Evidence Assessment
# ============================================================================

class EvidenceAssessmentRequest(BaseModel):
    """Input payload for LLM-assisted evidence assessment."""
    claim: StructuredClaim = Field(..., description="The structured claim being evaluated")
    claim_text: str = Field(..., description="Verbatim text of the claim")
    evidence_text: str = Field(..., description="The individual evidence statement quote")
    evidence_context: str = Field(default="", description="Surrounding context window of the evidence document")
    source_metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata such as title, url, publication date")


class EvidenceAssessmentResponse(BaseModel):
    """Output payload from LLM-assisted evidence assessment."""
    p_entailment: float = Field(..., ge=0.0, le=1.0, description="Entailment probability [0, 1]")
    p_contradiction: float = Field(..., ge=0.0, le=1.0, description="Contradiction probability [0, 1]")
    p_neutral: float = Field(..., ge=0.0, le=1.0, description="Neutral probability [0, 1]")
    relationship: str = Field(default="neutral", description="Extracted relationship between claim and evidence")
    temporal_relevance: str = Field(default="contemporary", description="Temporal classification: 'contemporary', 'superseding', 'historical', 'unrelated'")
    explanation: str = Field(..., min_length=1, description="Grounded explanation referencing evidence")
    provider_name: str = Field(default="mock", description="Provider used")

    @model_validator(mode="after")
    def validate_probabilities_sum(self) -> EvidenceAssessmentResponse:
        total = self.p_entailment + self.p_contradiction + self.p_neutral
        if abs(total - 1.0) > 0.02:
            raise ValueError(f"Probabilities must sum to 1.0 (got {total:.4f}: e={self.p_entailment}, c={self.p_contradiction}, n={self.p_neutral})")
        # Normalize minor floating-point jitter strictly to 1.0
        norm_factor = total if total > 0 else 1.0
        self.p_entailment = round(self.p_entailment / norm_factor, 4)
        self.p_contradiction = round(self.p_contradiction / norm_factor, 4)
        self.p_neutral = round(max(0.0, 1.0 - self.p_entailment - self.p_contradiction), 4)
        return self


# ============================================================================
# Schemas for Batched Evidence Assessment (Phase 3B)
# ============================================================================

class AssessmentRelation(str, Enum):
    """Semantic relation between proposition and evidence passage."""
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    NEUTRAL = "NEUTRAL"
    INSUFFICIENT = "INSUFFICIENT"


class BatchPropositionItem(BaseModel):
    """A granular proposition submitted in a batch assessment request."""
    proposition_id: str
    subject: str
    predicate: str
    object: str = ""
    qualifiers: Dict[str, Any] = Field(default_factory=dict)
    polarity: str = "POSITIVE"
    temporal_scope: Optional[str] = None
    original_text_span: str = ""


class BatchEvidenceItem(BaseModel):
    """A candidate evidence item passage submitted in a batch assessment request."""
    evidence_id: str
    source_title: str = ""
    source_url: Optional[str] = None
    source_snippet: str
    published_date: Optional[str] = None


class BatchAssessmentRequest(BaseModel):
    """Input payload for batched proposition-to-evidence assessment."""
    claim_id: str
    propositions: List[BatchPropositionItem]
    evidence_items: List[BatchEvidenceItem]
    requested_assessment_types: List[str] = Field(default_factory=lambda: ["entailment", "temporal"])
    assessment_version: str = "v1"


class PairAssessmentResult(BaseModel):
    """Result of an individual proposition-to-evidence evaluation within a batch."""
    proposition_id: str
    evidence_id: str
    relation: AssessmentRelation
    confidence: float = Field(..., ge=0.0, le=1.0)
    relevant_quote: Optional[str] = None
    rationale: str
    assessment_version: str = "v1"


class BatchAssessmentResponse(BaseModel):
    """Aggregated output from batched proposition-to-evidence assessment."""
    assessments: List[PairAssessmentResult] = Field(default_factory=list)
    provider_name: str = "mock"
    model_name: str = "mock"
    duration_ms: int = 0
    raw_response: Optional[str] = None


# ============================================================================
# Abstract Interface
# ============================================================================

class BaseSemanticReasoningProvider(abc.ABC):
    """Abstract provider-neutral interface for semantic reasoning services."""

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """Name of the semantic reasoning provider."""
        pass

    @property
    @abc.abstractmethod
    def is_available(self) -> bool:
        """Whether this provider is configured and reachable."""
        pass

    @abc.abstractmethod
    async def extract_structured_claims(self, request: ExtractionRequest) -> ExtractionResponse:
        """Extract atomic structured factual claims from AI response text."""
        pass

    @abc.abstractmethod
    async def assess_evidence_item(self, request: EvidenceAssessmentRequest) -> EvidenceAssessmentResponse:
        """Evaluate an individual claim against an evidence statement."""
        pass

    @abc.abstractmethod
    async def batch_assess_evidence(self, request: BatchAssessmentRequest) -> BatchAssessmentResponse:
        """Evaluate a batch of propositions against a collection of evidence items."""
        pass

    @abc.abstractmethod
    async def generate_grounded_correction(self, request: CorrectionGenerationRequest) -> CorrectionGenerationResponse:
        """Synthesize proposition-level evidence-grounded correction units."""
        pass


class UnavailableSemanticProvider(BaseSemanticReasoningProvider):
    """Default fallback when Bifrost or an external LLM is not configured.

    Explicitly signals that LLM reasoning is unavailable rather than pretending
    or silently masking the absence of a configured provider.
    """

    @property
    def provider_name(self) -> str:
        return "unconfigured"

    @property
    def is_available(self) -> bool:
        return False

    async def extract_structured_claims(self, request: ExtractionRequest) -> ExtractionResponse:
        raise RuntimeError("No LLM semantic reasoning provider is configured. Offline heuristic pipeline must be used.")

    async def assess_evidence_item(self, request: EvidenceAssessmentRequest) -> EvidenceAssessmentResponse:
        raise RuntimeError("No LLM semantic reasoning provider is configured. Offline heuristic pipeline must be used.")

    async def batch_assess_evidence(self, request: BatchAssessmentRequest) -> BatchAssessmentResponse:
        raise RuntimeError("No LLM semantic reasoning provider is configured. Offline heuristic pipeline must be used.")

    async def generate_grounded_correction(self, request: CorrectionGenerationRequest) -> CorrectionGenerationResponse:
        raise RuntimeError("No LLM semantic reasoning provider is configured. Offline heuristic pipeline must be used.")

