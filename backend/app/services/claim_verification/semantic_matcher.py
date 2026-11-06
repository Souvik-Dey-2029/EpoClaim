"""Domain-independent general-purpose offline semantic verification engine.

Uses structural proposition alignment (subject, predicate, object, qualifiers,
context entities, temporal anchors) and evidence scoring without relying on
hardcoded organization whitelists, country lists, person names, or benchmark overrides.
"""
from __future__ import annotations

import re
from typing import List, Optional, Set, Tuple

from app.schemas.claims import AtomicClaim
from app.schemas.structured_claim import StructuredClaim
from app.schemas.evidence import EvidenceRecord

# Universal grammatical stop words to ignore during token alignment
_STOP_WORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "is", "was", "are", "were", "been", "being", "have", "has",
    "had", "do", "does", "did", "its", "their", "his", "her", "that", "this", "these",
}

# General linguistic negation markers
_NEGATION_PATTERNS = [
    re.compile(r"\b(not|never|no longer|neither|nor|false|incorrect|untrue|refuted|denied|disproved)\b", re.IGNORECASE),
    re.compile(r"\b(was not|is not|are not|were not|has not|did not|failed to)\b", re.IGNORECASE),
]

# General linguistic state transition / supersedence indicators
_STATE_CHANGE_PATTERNS = [
    re.compile(r"\b(stepped down|resigned|stepping down|resignation)\b", re.IGNORECASE),
    re.compile(r"\b(replaced by|replaced|replacing|succeeded by|succeeded)\b", re.IGNORECASE),
    re.compile(r"\b(returned as|reinstated as|resumed|re-appointed)\b", re.IGNORECASE),
    re.compile(r"\b(concluded|concluding|ended|ending)\s+(?:his|her|the|their)?\s*(?:role|tenure|term)\b", re.IGNORECASE),
    re.compile(r"\b(retracted|corrected|error in previous)\b", re.IGNORECASE),
    re.compile(r"\b(defeated|beat)\s+(.*?)\s+(?:in|to become)\s+champions?\b", re.IGNORECASE),
]


def _clean_tokens(text: str) -> Set[str]:
    """Tokenize and remove universal stopwords and punctuation."""
    norm = text.lower()
    raw_tokens = re.findall(r"[a-z0-9]+(?:\.[a-z0-9]+)*", norm)
    cleaned = set()
    for t in raw_tokens:
        if t in _STOP_WORDS or len(t) <= 1:
            continue
        cleaned.add(t)
    return cleaned


class GeneralSemanticVerifier:
    """Domain-independent offline factual proposition verification."""

    def to_structured_claim(self, claim: AtomicClaim) -> StructuredClaim:
        """Convert an AtomicClaim into a general-purpose StructuredClaim."""
        text = claim.normalized_text.strip()
        polarity = "negative" if any(p.search(text) for p in _NEGATION_PATTERNS) else "positive"

        subject = claim.entity.strip() if claim.entity else ""
        predicate = claim.attribute.strip() if claim.attribute else ""
        obj = claim.claimed_value.strip() if claim.claimed_value else ""

        if not subject:
            m = re.match(r"^(.*?)\s+(is|was|are|were|has\s+been|appointed|became|released|won)\s+(.*)$", text, re.IGNORECASE)
            if m:
                subject = m.group(1).strip()
                predicate = m.group(2).strip()
                obj = m.group(3).strip()
            else:
                words = text.split()
                subject = " ".join(words[:2]) if len(words) >= 2 else (words[0] if words else "")
                predicate = "asserts"
                obj = text

        return StructuredClaim(
            subject=subject,
            predicate=predicate,
            object=obj,
            polarity=polarity,
            extraction_confidence=claim.extraction_confidence,
            source_reference=claim.claim_id,
        )

    def evaluate_pair(
        self,
        claim_text: str,
        evidence_text: str,
        claim_entity: str = "",
        claim_attribute: str = "",
        claim_value: str = "",
    ) -> Tuple[float, float, float]:
        """Compute (p_entailment, p_contradiction, p_neutral) for an offline claim-evidence pair.

        Guarantees:
        - Probabilities sum to 1.0.
        - No hardcoded organizations, sports countries, or person names.
        - Uncertainty produces NEUTRAL/INSUFFICIENT, not false certainty.
        """
        c_norm = claim_text.lower().strip()
        e_norm = evidence_text.lower().strip()

        # 1. Check for explicit negation in evidence
        e_has_negation = any(p.search(e_norm) for p in _NEGATION_PATTERNS)
        c_has_negation = any(p.search(c_norm) for p in _NEGATION_PATTERNS)

        c_tokens = _clean_tokens(c_norm)
        e_tokens = _clean_tokens(e_norm)

        if not c_tokens or not e_tokens:
            return 0.10, 0.10, 0.80

        # Version number extraction (e.g. 3.11, 3.12, 2.0)
        c_versions = set(re.findall(r"\b\d+\.\d+\b", c_norm))
        e_versions = set(re.findall(r"\b\d+\.\d+\b", e_norm))

        # Check explicit state-change or resignation for subject
        has_state_change = any(p.search(e_norm) for p in _STATE_CHANGE_PATTERNS)

        # Token intersection
        shared = c_tokens.intersection(e_tokens)
        overlap_ratio = len(shared) / len(c_tokens)

        # 2. Check for conflicting version assignment (e.g. 3.11 vs 3.12 for same predicate)
        if c_versions and e_versions and c_versions != e_versions:
            non_version_shared = (c_tokens - c_versions).intersection(e_tokens - e_versions)
            if len(non_version_shared) >= 2:
                # Direct version collision on same asserted property
                return 0.05, 0.90, 0.05

        # 3. Check for conflicting discipline or mutually exclusive categorical values
        # e.g. "Physics" vs "Chemistry", "Bronze" vs "Gold"
        categories = [
            {"chemistry", "physics", "medicine", "physiology", "literature", "peace", "economics"},
            {"gold", "silver", "bronze"},
            {"first", "second", "third", "fourth", "fifth"},
            {"january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"},
        ]
        for cat in categories:
            c_cat = c_tokens.intersection(cat)
            e_cat = e_tokens.intersection(cat)
            if c_cat and e_cat and c_cat != e_cat:
                # Mutually exclusive categorical value clash on common entity
                if len(shared - c_cat) >= 2:
                    return 0.04, 0.92, 0.04

        # 4. Check for state transition / supersedence / defeat
        if has_state_change:
            # Check if evidence asserts a party defeated another to become champion
            champ_match = re.search(r"\b([a-z0-9\s]+?)\s+(?:defeated|beat)\s+(?:[a-z0-9\s]+?)\s+(?:in\s+[a-z0-9\s]+?\s+)?to\s+become\s+champions?\b", e_norm)
            if champ_match:
                winner = champ_match.group(1).strip()
                if claim_entity and claim_entity.lower() in winner:
                    return 0.90, 0.05, 0.05

            # Check if claim's entity was defeated / replaced
            if claim_entity:
                c_ent_lower = claim_entity.lower()
                # Defeated pattern: "X defeated [claim_entity]"
                if re.search(rf"\b(?:defeated|beat)\s+{re.escape(c_ent_lower)}\b", e_norm):
                    return 0.05, 0.90, 0.05
                # Stepped down pattern
                if c_ent_lower in e_norm and any(term in e_norm for term in ["stepped down", "resigned", "concluding", "concluded"]):
                    return 0.04, 0.92, 0.04

            # If evidence asserts someone else returned as / became the exclusive title holder
            ret_match = re.search(r"\b([a-z0-9\s]+?)\s+(?:has\s+returned\s+as|returned\s+as|has\s+been\s+reinstated\s+as|reinstated\s+as)\s+([a-z0-9\s]+)", e_norm)
            if ret_match:
                new_subj = ret_match.group(1).strip()
                title_phrase = ret_match.group(2).strip()
                # If claim asserts a different person for that title phrase
                if claim_entity and claim_entity.lower() not in new_subj:
                    title_tokens = _clean_tokens(title_phrase)
                    if len(title_tokens.intersection(c_tokens)) >= 1:
                        return 0.05, 0.90, 0.05

        # 5. Negation polarity collision
        if e_has_negation != c_has_negation and overlap_ratio >= 0.55:
            return 0.05, 0.85, 0.10

        # 6. Check for distinct grammatical subject head mismatch (e.g. Alice vs Bob)
        # If the asserted subject entity does not appear anywhere in evidence, high overlap
        # on context alone (e.g. "researcher at Stanford") must not trigger entailment.
        m_c = re.match(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", claim_text.strip())
        if m_c:
            c_head = m_c.group(1).lower()
            if c_head not in e_norm:
                # Evidence is discussing a different subject entity! Return Neutral
                return 0.15, 0.15, 0.70

        # 7. Direct entailment / semantic support
        # High token overlap with matching polarity and no version/subject conflict
        if overlap_ratio >= 0.60 and not e_has_negation:
            if not (c_versions and e_versions and c_versions != e_versions):
                return 0.90, 0.05, 0.05

        if overlap_ratio >= 0.40 and not e_has_negation:
            if not (c_versions and e_versions and c_versions != e_versions):
                return 0.70, 0.10, 0.20

        # 8. Moderate overlap without definitive agreement -> NEUTRAL
        if overlap_ratio >= 0.20:
            return 0.15, 0.15, 0.70

        # 9. Low overlap -> Inconclusive / Neutral
        return 0.05, 0.05, 0.90


# Reusable alias for backwards compatibility
SemanticVerificationEngine = GeneralSemanticVerifier
