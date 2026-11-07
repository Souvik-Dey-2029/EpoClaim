"""Claim normalization and temporal anchor extraction service."""
from __future__ import annotations

import re
from typing import Optional, Tuple
from app.schemas.claims import AtomicClaim

# Temporal indicators
_TEMPORAL_PATTERNS = [
    re.compile(r"\b(in|on|during|by|since|as of|around|circa)\s+([12][0-9]{3})\b", re.IGNORECASE),
    re.compile(r"\b(in|during)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+([12][0-9]{3})\b", re.IGNORECASE),
    re.compile(r"\b(currently|presently|right now|at present|as of today|this year|recently)\b", re.IGNORECASE),
    re.compile(r"\b(yesterday|last week|last month|last year)\b", re.IGNORECASE),
]


class ClaimNormalizationService:
    """Normalizes atomic claims and isolates temporal references."""

    def normalize(self, claim: AtomicClaim, context_entity: Optional[str] = None) -> AtomicClaim:
        text = claim.normalized_text

        # Extract temporal anchor
        temp_ref = self._extract_temporal_reference(text)
        if temp_ref:
            claim.temporal_reference = temp_ref

        # Pronoun coreference resolution from context if subject is ambiguous
        if claim.entity.lower() in {"it", "the model", "he", "she", "they", "this company"} and context_entity:
            claim.entity = context_entity
            claim.normalized_text = self._replace_leading_pronoun(claim.normalized_text, context_entity)

        # Clean trailing commas/periods
        claim.normalized_text = claim.normalized_text.strip().rstrip(".,;")

        # Also propagate context entity and normalization to sub-propositions if needed
        if claim.propositions:
            for prop in claim.propositions:
                if prop.subject.lower() in {"it", "the model", "he", "she", "they"} and context_entity:
                    prop.subject = context_entity
                    prop.related_entities = [context_entity]

        return claim

    def _extract_temporal_reference(self, text: str) -> Optional[str]:
        for pattern in _TEMPORAL_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(0).strip()
        return None

    def _replace_leading_pronoun(self, text: str, replacement: str) -> str:
        words = text.split(maxsplit=1)
        if len(words) == 2 and words[0].lower() in {"it", "the model", "he", "she", "this"}:
            return f"{replacement} {words[1]}"
        return text

