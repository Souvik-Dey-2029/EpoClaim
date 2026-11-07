"""Atomic claim extraction service.

Converts AI-generated responses into individual verifiable factual claims
while preserving character spans and filtering out non-factual discourse.
"""
from __future__ import annotations

import re
import uuid
from typing import List, Tuple
from app.schemas.claims import AtomicClaim, TemporalSensitivity, StructuredProposition
from app.core.security import sanitize_untrusted_text
from app.services.claim_extraction.proposition_decomposer import PropositionDecompositionService

# Patterns identifying non-factual conversational or meta sentences
_DISCOURSE_PATTERNS = [
    re.compile(r"^(sure|certainly|of course|hello|hi|hey|greetings|thank you|thanks)\b", re.IGNORECASE),
    re.compile(r"^(here is|here are|below is|in summary|as mentioned|to summarize)\b", re.IGNORECASE),
    re.compile(r"^(i hope this helps|let me know if you need|feel free to ask)\b", re.IGNORECASE),
    re.compile(r"^(in my opinion|i believe|personally|i think)\b", re.IGNORECASE),
]

# Coordinating conjunctions or split points for compound sentences
_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+|\n+")


class ClaimExtractionService:
    """Extracts atomic factual claims with exact text span mappings and structured propositions."""

    def __init__(self):
        self.decomposer = PropositionDecompositionService()

    def extract_claims(self, text: str) -> List[AtomicClaim]:
        """Extract atomic claims from the given text."""
        sanitized = sanitize_untrusted_text(text)
        if not sanitized:
            return []

        raw_sentences = self._split_sentences_with_spans(text)
        claims: List[AtomicClaim] = []

        for sentence, start, end in raw_sentences:
            cleaned_s = sentence.strip()
            if not cleaned_s or len(cleaned_s) < 10:
                continue

            # Skip conversational non-factual filler
            if self._is_non_factual_filler(cleaned_s):
                continue

            claim_id = f"clm_{uuid.uuid4().hex[:8]}"
            entity, attribute, value = self._heuristic_parse_triple(cleaned_s)
            
            # Decompose into structured atomic propositions
            props = self.decomposer.decompose_claim(
                parent_claim_id=claim_id,
                text=cleaned_s,
                inherited_entity=entity,
            )

            claims.append(
                AtomicClaim(
                    claim_id=claim_id,
                    original_text=cleaned_s,
                    normalized_text=self._normalize_clause(cleaned_s),
                    entity=entity,
                    attribute=attribute,
                    claimed_value=value,
                    temporal_sensitivity=TemporalSensitivity.SLOW_MOVING,
                    extraction_confidence=0.92,
                    start_char=start,
                    end_char=end,
                    propositions=props,
                )
            )

        return claims

    def _split_sentences_with_spans(self, text: str) -> List[Tuple[str, int, int]]:
        """Split text into sentences while recording start and end offsets."""
        spans: List[Tuple[str, int, int]] = []
        matches = list(_SPLIT_REGEX.finditer(text))
        
        last_idx = 0
        for match in matches:
            sentence = text[last_idx:match.start()].strip()
            if sentence:
                # Find exact character indices in the slice
                s_start = text.find(sentence, last_idx)
                s_end = s_start + len(sentence)
                spans.append((sentence, s_start, s_end))
            last_idx = match.end()

        if last_idx < len(text):
            trailing = text[last_idx:].strip()
            if trailing:
                s_start = text.find(trailing, last_idx)
                s_end = s_start + len(trailing)
                spans.append((trailing, s_start, s_end))

        return spans

    def _is_non_factual_filler(self, sentence: str) -> bool:
        """Identify conversational boilerplate, rhetorical questions, and greetings."""
        for pattern in _DISCOURSE_PATTERNS:
            if pattern.search(sentence):
                return True
        if sentence.endswith("?") and not any(w in sentence.lower() for w in ["who", "what", "where", "when"]):
            return True
        return False

    def _decompose_compound_sentence(self, sentence: str, base_offset: int) -> List[Tuple[str, int, int]]:
        """Decompose compound sentences connected by 'and also', 'additionally', or semicolons."""
        parts = re.split(r";|\s+and\s+(?:also\s+)?(?=[A-Z]|the\b|it\b|this\b)", sentence)
        if len(parts) <= 1:
            return [(sentence, base_offset, base_offset + len(sentence))]

        clauses: List[Tuple[str, int, int]] = []
        current_pos = 0
        for p in parts:
            p_strip = p.strip()
            if len(p_strip) > 15:
                idx = sentence.find(p_strip, current_pos)
                if idx != -1:
                    clauses.append((p_strip, base_offset + idx, base_offset + idx + len(p_strip)))
                    current_pos = idx + len(p_strip)
                else:
                    clauses.append((p_strip, base_offset, base_offset + len(p_strip)))
        return clauses if clauses else [(sentence, base_offset, base_offset + len(sentence))]

    def _normalize_clause(self, clause: str) -> str:
        """Resolve common relative pronouns and remove trailing punctuation."""
        norm = clause.strip().rstrip(".")
        # Capitalize first letter
        if norm and norm[0].islower():
            norm = norm[0].upper() + norm[1:]
        return norm

    def _heuristic_parse_triple(self, text: str) -> Tuple[str, str, str]:
        """Extract coarse (entity, attribute, value) triple."""
        # Check for copular statements: "X is/was Y"
        match = re.search(r"^(.*?)\s+(is|was|are|were|has\s+been|became)\s+(.*)$", text, re.IGNORECASE)
        if match:
            entity = match.group(1).strip()
            attribute = match.group(2).strip()
            value = match.group(3).strip()
            return entity, attribute, value

        # Check for release / launch statements: "X released Y in Z"
        match2 = re.search(r"^(.*?)\s+(released|launched|announced|acquired|founded)\s+(.*)$", text, re.IGNORECASE)
        if match2:
            entity = match2.group(1).strip()
            attribute = match2.group(2).strip()
            value = match2.group(3).strip()
            return entity, attribute, value

        words = text.split()
        entity = " ".join(words[:2]) if len(words) >= 2 else (words[0] if words else "Unknown")
        return entity, "state", text

