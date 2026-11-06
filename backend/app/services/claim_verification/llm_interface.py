"""Provider-neutral LLM reasoning interface and schemas.

Prepares contracts for structured claim extraction and claim-vs-evidence assessment
for future Bifrost / LLM integration without introducing external vendor SDKs.
"""
from __future__ import annotations

import abc
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.structured_claim import StructuredClaim


# ============================================================================
# Schemas for Claim Extraction
# ============================================================================

class ExtractionRequest(BaseModel):
    """Input payload for LLM-assisted claim extraction."""
    response_text: str = Field(..., min_length=1, description="AI-generated text to decompose into atomic claims")
    context_hint: Optional[str] = Field(default=None, description="Optional prompt or conversation context")


class ExtractionResponse(BaseModel):
    """Output payload from LLM-assisted claim extraction."""
    claims: List[StructuredClaim] = Field(default_factory=list, description="Extracted structured factual claims")
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

