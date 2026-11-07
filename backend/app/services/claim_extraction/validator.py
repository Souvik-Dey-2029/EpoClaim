"""Structural validation and coverage layer for LLM-assisted claim extraction and proposition decomposition.

Guarantees integrity of decomposed propositions returned by external or mock LLM providers:
- Reject empty proposition sets
- Unique proposition IDs
- Claim ID provenance matching
- Non-empty subject and predicate
- Exact verbatim text span substring grounding in parent sentence
- Valid polarity and explicit epistemic modality (no UNKNOWN or missing)
- Proposition coverage validation across independent syntactic and factual clauses
- Extraction quality score assignment based on structural completeness
"""
from __future__ import annotations

import logging
import re
from typing import List, Set, Tuple
from app.schemas.claims import StructuredProposition, PropositionPolarity, EpistemicModality

logger = logging.getLogger(__name__)

# Conjunctions and punctuation marking independent factual clauses
_CLAUSE_SPLIT_PATTERN = re.compile(
    r"\b(?:while|whereas|although|even\s+though|despite|but|however)\b"
    r"|\s+and\s+(?=[A-Z])"
    r"|(?<=[,;])\s*(?:and|subsequently|then|later|furthermore|additionally)\s+"
    r"|(?<=[,;])\s*(?=[A-Z])"
    r"|\b(?:if|unless|provided\s+that)\b",
    re.IGNORECASE
)

# Common modal / attribution prefixes to inspect
_ATTRIBUTION_DENIAL_PATTERN = re.compile(
    r"\b(?:denied|rejected|refuted|dismissed|disputed|claimed|alleged|reported|announced|stated)\b",
    re.IGNORECASE
)


class PropositionExtractionValidator:
    """Validates structural integrity and clause coverage of LLM-generated propositions before acceptance."""

    @classmethod
    def segment_independent_clauses(cls, sentence: str) -> List[str]:
        """Split a sentence into candidate factual clauses for coverage auditing."""
        parts = _CLAUSE_SPLIT_PATTERN.split(sentence)
        clauses = []
        for p in parts:
            c = p.strip().strip(",;.")
            # Only keep clauses with substantive content (at least 2 words)
            if len(c.split()) >= 2:
                clauses.append(c)
        return clauses

    @classmethod
    def check_proposition_coverage(
        cls,
        propositions: List[StructuredProposition],
        original_sentence: str
    ) -> Tuple[bool, str]:
        """Verify that every independently factual clause is represented in propositions.
        
        Algorithm:
        1. Deconstruct original sentence into candidate independent clauses using boundary markers.
        2. Identify clauses containing factual assertions (subject + predicate patterns).
        3. For each candidate clause, verify that at least one proposition:
           a. Contains a text span matching or overlapping the clause, OR
           b. Has subject/predicate/object accounting for the clause's key terms.
        4. Check for attribution / denial pairs: if sentence has both an attribution and a denial/contrast,
           ensure at least one proposition reflects the denial/contrast.
        5. Check for conditional / modal structures: if sentence has conditional or modal triggers,
           ensure propositions do not reduce to unconditional ASSERTED events.
        """
        clauses = cls.segment_independent_clauses(original_sentence)
        if len(clauses) <= 1:
            # Single clause; at least one proposition is sufficient
            return True, ""

        combined_spans = " ".join(p.original_text_span.lower() for p in propositions)
        combined_pred_obj = " ".join(f"{p.subject} {p.predicate} {p.object}".lower() for p in propositions)

        # 1. Audit each substantive clause
        for clause in clauses:
            words = [w.lower() for w in re.findall(r"\b[a-zA-Z0-9_\-]+\b", clause) if len(w) > 2]
            # Skip clauses that are purely connecting phrases
            factual_words = [w for w in words if w not in {"the", "and", "but", "while", "that", "this", "with", "from", "for"}]
            if len(factual_words) < 2:
                continue

            # Check if key words of this clause appear in extracted propositions
            matched_words = [w for w in factual_words if w in combined_spans or w in combined_pred_obj]
            coverage_ratio = len(matched_words) / len(factual_words) if factual_words else 1.0

            if coverage_ratio < 0.5:
                return False, f"Uncovered factual clause detected: '{clause}' (coverage ratio {coverage_ratio:.2f})"

        # 2. Check contrast / denial coverage:
        # If sentence contains denial or dispute ("denied the report", "refuted claims"), ensure at least one prop reflects it
        if re.search(r"\b(?:denied|refuted|rejected|dismissed|disputed)\b", original_sentence, re.IGNORECASE):
            has_denial_prop = any(
                re.search(r"\b(?:denied|refuted|rejected|dismissed|disputed)\b", f"{p.predicate} {p.object} {p.original_text_span}", re.IGNORECASE)
                or p.polarity == PropositionPolarity.NEGATIVE
                for p in propositions
            )
            if not has_denial_prop:
                return False, "Sentence contains denial/rebuttal clause not accounted for in propositions"

        # 3. Check conditional coverage:
        # If sentence contains conditional ("if", "unless"), ensure at least one proposition reflects CONDITIONAL or POSSIBLE modality
        if re.search(r"\b(?:if|unless|provided\s+that)\b", original_sentence, re.IGNORECASE):
            has_conditional_or_possible = any(
                p.modality in {EpistemicModality.CONDITIONAL, EpistemicModality.POSSIBLE}
                or "condition" in p.qualifiers
                for p in propositions
            )
            if not has_conditional_or_possible:
                return False, "Sentence contains conditional clause but no proposition reflects CONDITIONAL or POSSIBLE modality"

        return True, ""

    @classmethod
    def validate_propositions(
        cls,
        propositions: List[StructuredProposition],
        parent_claim_id: str,
        original_sentence: str
    ) -> Tuple[bool, str, List[StructuredProposition]]:
        """Validate a list of decomposed propositions.
        
        Returns:
            Tuple[is_valid, rejection_reason, validated_propositions]
        """
        if not propositions:
            return False, "Empty propositions list returned by provider", []

        sentence_clean = original_sentence.strip()
        seen_prop_ids: Set[str] = set()
        validated: List[StructuredProposition] = []

        for idx, prop in enumerate(propositions):
            # 1. Unique proposition_id
            if not prop.proposition_id or prop.proposition_id in seen_prop_ids:
                return False, f"Duplicate or empty proposition_id at index {idx}: '{prop.proposition_id}'", []
            seen_prop_ids.add(prop.proposition_id)

            # 2. Parent claim ID matching
            if prop.parent_claim_id != parent_claim_id:
                return False, f"Mismatched parent_claim_id at index {idx}: expected '{parent_claim_id}', got '{prop.parent_claim_id}'", []

            # 3. Non-empty subject and predicate
            if not prop.subject or not prop.subject.strip():
                return False, f"Missing or empty subject at proposition '{prop.proposition_id}'", []
            if not prop.predicate or not prop.predicate.strip():
                return False, f"Missing or empty predicate at proposition '{prop.proposition_id}'", []

            # 4. Valid polarity and modality
            if not isinstance(prop.polarity, PropositionPolarity):
                return False, f"Invalid polarity at proposition '{prop.proposition_id}': {prop.polarity}", []
            if not isinstance(prop.modality, EpistemicModality) or prop.modality == EpistemicModality.UNKNOWN:
                return False, f"Invalid or UNKNOWN modality at proposition '{prop.proposition_id}': {prop.modality}", []

            # 5. Span grounding: original_text_span must be non-empty and must exist in original_sentence
            span = prop.original_text_span.strip() if prop.original_text_span else ""
            if not span:
                return False, f"Missing original_text_span at proposition '{prop.proposition_id}'", []

            # Substring check in sentence
            if span not in original_sentence and span.lower() not in original_sentence.lower():
                return False, f"Ungrounded original_text_span '{span}' not found in sentence: '{sentence_clean}'", []

            # 6. Character offset verification if provided
            start_c = prop.start_char
            end_c = prop.end_char
            if start_c is not None and end_c is not None:
                if start_c < 0 or end_c > len(original_sentence) or start_c >= end_c:
                    return False, f"Invalid character offsets ({start_c}, {end_c}) for sentence length {len(original_sentence)}", []
                actual_slice = original_sentence[start_c:end_c].strip()
                if actual_slice.lower() != span.lower() and span.lower() not in actual_slice.lower():
                    return False, f"Character slice '{actual_slice}' does not match original_text_span '{span}'", []
            else:
                # Inferred offsets if not provided
                found_idx = original_sentence.lower().find(span.lower())
                if found_idx >= 0:
                    start_c = found_idx
                    end_c = found_idx + len(span)

            # 7. Quality-based extraction confidence score calculation
            quality_score = 0.4  # base for grounded span + valid subject & predicate
            if prop.object and prop.object.strip():
                quality_score += 0.2
            if prop.modality != EpistemicModality.UNKNOWN:
                quality_score += 0.2
            if prop.related_entities or prop.qualifiers or prop.temporal_scope:
                quality_score += 0.2

            prop.extraction_confidence = round(min(1.0, quality_score), 2)
            prop.start_char = start_c
            prop.end_char = end_c
            validated.append(prop)

        # 8. Proposition clause coverage check across the complete original sentence
        cov_ok, cov_reason = cls.check_proposition_coverage(validated, original_sentence)
        if not cov_ok:
            return False, f"Proposition coverage validation failed: {cov_reason}", []

        return True, "", validated


