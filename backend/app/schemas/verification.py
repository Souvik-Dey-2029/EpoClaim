"""Schemas for NLI-based factual verification results."""
from __future__ import annotations

from enum import Enum
from typing import List
from pydantic import BaseModel, Field


class VerificationVerdict(str, Enum):
    """Categorical verdict for a factual claim or proposition."""
    SUPPORTED = "SUPPORTED"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    OUTDATED = "OUTDATED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    CONFLICTING = "CONFLICTING"
    UNVERIFIED = "UNVERIFIED"


class PropositionVerificationResult(BaseModel):
    """Factual entailment and stance assessment result for an individual atomic proposition."""
    proposition_id: str = Field(..., description="ID of the verified proposition")
    parent_claim_id: str = Field(..., description="ID of parent claim")
    verdict: VerificationVerdict = Field(..., description="Proposition-level categorical outcome")
    entailment_score: float = Field(default=0.0, ge=0.0, le=1.0)
    contradiction_score: float = Field(default=0.0, ge=0.0, le=1.0)
    neutral_score: float = Field(default=0.0, ge=0.0, le=1.0)
    verification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    contradicting_evidence_ids: List[str] = Field(default_factory=list)
    neutral_evidence_ids: List[str] = Field(default_factory=list)
    explanation: str = Field(default="")


class VerificationResult(BaseModel):
    """Factual entailment and stance assessment result for a claim."""
    claim_id: str = Field(..., description="ID of the verified claim")
    verdict: VerificationVerdict = Field(..., description="Normalized categorical outcome")
    entailment_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="NLI probability that evidence entails the claim"
    )
    contradiction_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="NLI probability that evidence refutes the claim"
    )
    neutral_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="NLI probability that evidence is inconclusive or neutral"
    )
    verification_confidence: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Estimated confidence in the assigned verdict"
    )
    evidence_ids: List[str] = Field(
        default_factory=list,
        description="List of EvidenceRecord IDs supporting or refuting this claim"
    )
    explanation: str = Field(
        default="",
        description="Human-readable explanation of why this verdict was reached"
    )
    proposition_results: List[PropositionVerificationResult] = Field(
        default_factory=list,
        description="Individual verification outcomes for decomposed propositions"
    )

