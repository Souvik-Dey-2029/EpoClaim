"""Deterministic linguistic complexity detector for claim decomposition routing.

Analyzes sentences for syntactic and semantic complexity triggers to determine
whether decomposition can be handled by deterministic regex patterns or requires
escalation to semantic LLM reasoning.
"""
from __future__ import annotations

import re
from typing import List, Tuple
from pydantic import BaseModel, Field


class ComplexityResult(BaseModel):
    """Result of linguistic complexity evaluation."""
    is_complex: bool = Field(..., description="Whether the sentence meets complexity escalation threshold")
    complexity_score: float = Field(..., ge=0.0, le=1.0, description="Normalized complexity score [0, 1]")
    trigger_reasons: List[str] = Field(default_factory=list, description="List of detected complexity trigger descriptions")
    detector_version: str = Field(default="v1", description="Detector algorithm version")


class LinguisticComplexityDetector:
    """Detects linguistic complexity features in a sentence deterministically."""

    # Trigger patterns with associated weights and reason tags
    # Features:
    # 1. Conditionals: if, unless, provided that, assuming, whether, etc. (0.35)
    CONDITIONALS_PATTERN = re.compile(
        r"\b(if|unless|provided\s+that|assuming\s+that|assuming|whether|in\s+case|as\s+long\s+as)\b",
        re.IGNORECASE
    )

    # 2. Epistemic Modality: might, may, could, would, allegedly, reportedly, purportedly, etc. (0.30)
    EPISTEMIC_MODALITY_PATTERN = re.compile(
        r"\b(might|may|could|would|allegedly|reportedly|purportedly|supposedly|presumably|possibly|perhaps)\b",
        re.IGNORECASE
    )

    # 3. Attribution verbs: claimed, alleged, reported, announced, stated, according to, said that, etc. (0.25)
    ATTRIBUTION_PATTERN = re.compile(
        r"\b(according\s+to|claimed|claims|alleged|alleges|reported|reports|announced|announces|stated|states|argued|argues|asserted|asserts|said\s+that)\b",
        re.IGNORECASE
    )

    # 4. Appositive / non-restrictive relative clauses with comma boundaries: , who / , which / , whose / , that (0.25)
    APPOSITIVE_RELATIVE_PATTERN = re.compile(
        r",\s*(who|which|whose|whom)\b",
        re.IGNORECASE
    )

    # 5. Passive with complex auxiliary: has been reported to, was said to, believed to be, etc. (0.25)
    COMPLEX_PASSIVE_PATTERN = re.compile(
        r"\b(has\s+been|have\s+been|had\s+been|was|were|is|are)\s+(reported|said|believed|thought|rumored|expected|claimed)\s+to\b",
        re.IGNORECASE
    )

    # 6. Multiple / interacting clause conjunctions: but, whereas, while, although, however, yet, etc. (0.25)
    # Notice: a single 'and' is standard coordinate clause (handled deterministically). Multiple conjunctions or contrastive+coordinate indicate nesting.
    CONTRASTIVE_CONJUNCTIONS_PATTERN = re.compile(
        r"\b(whereas|although|even\s+though|while|despite|in\s+spite\s+of|however|nevertheless|nonetheless)\b",
        re.IGNORECASE
    )

    COORDINATING_CONJUNCTIONS_PATTERN = re.compile(
        r"\b(and|or|but|nor|so|yet)\b",
        re.IGNORECASE
    )

    def __init__(self, default_threshold: float = 0.5):
        self.default_threshold = default_threshold

    def evaluate(self, sentence: str, threshold: float = None) -> ComplexityResult:
        """Evaluate a sentence and compute complexity score and triggers."""
        effective_threshold = self.default_threshold if threshold is None else threshold
        text = sentence.strip()
        if not text:
            return ComplexityResult(
                is_complex=False,
                complexity_score=0.0,
                trigger_reasons=[],
                detector_version="v1"
            )

        triggers: List[str] = []
        score = 0.0

        # Check conditionals: if multiple conditionals or combined with subordinate clauses (Weight: 0.35 each, up to 0.70)
        cond_matches = self.CONDITIONALS_PATTERN.findall(text)
        if cond_matches:
            cond_score = 0.35 if len(cond_matches) == 1 else 0.55
            score += cond_score
            triggers.append("conditional_clause")

        # Check epistemic modality (Weight: 0.30)
        if self.EPISTEMIC_MODALITY_PATTERN.search(text):
            score += 0.30
            triggers.append("epistemic_modality")

        # Check attribution (Weight: 0.25)
        if self.ATTRIBUTION_PATTERN.search(text):
            score += 0.25
            triggers.append("attribution_framing")

        # Check appositive relative clause (Weight: 0.25)
        if self.APPOSITIVE_RELATIVE_PATTERN.search(text):
            score += 0.25
            triggers.append("appositive_relative_clause")

        # Check complex passive / auxiliary (Weight: 0.25)
        if self.COMPLEX_PASSIVE_PATTERN.search(text):
            score += 0.25
            triggers.append("complex_passive_auxiliary")

        # Check contrastive conjunctions (Weight: 0.25)
        if self.CONTRASTIVE_CONJUNCTIONS_PATTERN.search(text):
            score += 0.25
            triggers.append("subordinate_contrastive_conjunction")

        # Check coordinating conjunctions:
        # A single 'and' has weight 0.0 (stays deterministic).
        # Multiple coordinating conjunctions or contrastive + coordinating indicates complex compound structure (Weight: 0.25)
        coord_matches = self.COORDINATING_CONJUNCTIONS_PATTERN.findall(text)
        has_contrastive = bool(self.CONTRASTIVE_CONJUNCTIONS_PATTERN.search(text))
        if len(coord_matches) >= 2 or (has_contrastive and len(coord_matches) >= 1):
            score += 0.25
            triggers.append("multiple_conjunctions")

        # Interacting clause boundaries (e.g. contrastive subordinate + coordinating conjunction with comma)
        if ("," in text) and has_contrastive and ("but" in text.lower() or "and" in text.lower() or "or" in text.lower()):
            score += 0.15
            triggers.append("nested_clause_interaction")

        # Clamp score to [0.0, 1.0]
        final_score = min(1.0, round(score, 4))
        is_complex = final_score >= effective_threshold

        return ComplexityResult(
            is_complex=is_complex,
            complexity_score=final_score,
            trigger_reasons=triggers,
            detector_version="v1"
        )

