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

        # 4. Check for state transition / supersedence / defeat / succession
        #
        # A. Person-Succession Relationship Verification:
        # If the claim asserts that Person X succeeded/replaced Person Y, verify:
        # 1. Exact directional succession (who succeeded whom)
        # 2. Both successor and predecessor identity match (honorifics stripped, multi-word names matched)
        # 3. Non-succession contexts (co-working, merely co-mentioned) remain Neutral
        # 4. Competing organizations conflict and remain Neutral
        c_succ_m = re.search(
            r"\b(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+"
            r"(?:succeeded|replaced|took\s+over\s+from)\s+"
            r"(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)"
            r"(?:\s+at\s+([A-Za-z0-9\s]+?))?(?:\.|$)",
            claim_text,
            re.IGNORECASE
        )
        if c_succ_m:
            c_successor_tokens = set(c_succ_m.group(1).lower().split())
            c_predecessor_tokens = set(c_succ_m.group(2).lower().split())
            c_org_scope = c_succ_m.group(3).strip().lower() if c_succ_m.group(3) else None

            # Organization compatibility check
            if c_org_scope:
                e_org_m = re.search(r"\b(?:at|of|for)\s+([A-Za-z0-9\s]+?)(?:\.|\,|$)", evidence_text)
                if e_org_m:
                    e_org = e_org_m.group(1).strip().lower()
                    if c_org_scope not in e_org and e_org not in c_org_scope:
                        return 0.15, 0.15, 0.70

            # Directional succession pattern matching in evidence
            e_succ_active = re.search(
                r"\b(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:has\s+been\s+appointed|was\s+appointed|appointed|named|became)\s+[a-z\s]+?,\s+replacing\s+(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([a-z]+(?:\s+[a-z]+)?)",
                e_norm
            )
            e_succ_direct = re.search(
                r"\b(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:succeeded|replaced|took\s+over\s+from)\s+(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([a-z]+(?:\s+[a-z]+)?)",
                e_norm
            )
            e_succ_passive = re.search(
                r"\b(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([a-z]+(?:\s+[a-z]+)?)\s+(?:was\s+succeeded\s+by|was\s+replaced\s+by|replaced\s+by)\s+(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?([a-z]+(?:\s+[a-z]+)?)",
                e_norm
            )

            e_succ_cand = None
            if e_succ_active:
                e_succ_cand = (set(e_succ_active.group(1).split()), set(e_succ_active.group(2).split()))
            elif e_succ_direct:
                e_succ_cand = (set(e_succ_direct.group(1).split()), set(e_succ_direct.group(2).split()))
            elif e_succ_passive:
                # In passive ("Y was replaced by X"), group(2) is successor, group(1) is predecessor
                e_succ_cand = (set(e_succ_passive.group(2).split()), set(e_succ_passive.group(1).split()))

            if e_succ_cand:
                e_successor, e_predecessor = e_succ_cand
                if c_successor_tokens == e_successor and c_predecessor_tokens == e_predecessor:
                    return 0.90, 0.05, 0.05  # Strongly Supported
                if c_successor_tokens == e_predecessor and c_predecessor_tokens == e_successor:
                    return 0.05, 0.90, 0.05  # Directionally Contradicted
                # Distinct individuals or partial matches -> Neutral
                return 0.15, 0.15, 0.70

            # Co-working or non-succession relationships (e.g. worked together)
            if any(term in e_norm for term in ["worked together", "alongside", "collaborated", "co-workers", "co-researchers"]):
                return 0.15, 0.15, 0.70

            # Mentioned in unrelated contexts without directional succession
            return 0.15, 0.15, 0.70

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
                # Stepped down / concluded pattern (only contradicts if claim was asserting active current role)
                if c_ent_lower in e_norm and any(term in e_norm for term in ["stepped down", "resigned", "concluding", "concluded"]):
                    if not any(term in claim_text.lower() for term in ["stepped down", "resigned", "concluding", "concluded"]):
                        return 0.04, 0.92, 0.04

                # Replaced pattern: "[other] replacing [claim_entity]" or "[claim_entity] replaced by [other]"
                # Handle possible honorifics (e.g. Dr., Mr., Ms., Prof.) before the name
                honorific_prefix = r"(?:(?:dr|mr|mrs|ms|prof)\.?\s+)?"
                if re.search(rf"\breplacing\s+{honorific_prefix}{re.escape(c_ent_lower)}\b", e_norm) or re.search(rf"\b{honorific_prefix}{re.escape(c_ent_lower)}\s+(?:was\s+)?replaced\s+by\b", e_norm):
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
        # Check if predicate and object are directly asserted in evidence without negation attached
        pred_obj_norm = f"{claim_attribute} {claim_value}".lower().strip().rstrip(".,;")
        pred_obj_in_evidence = len(pred_obj_norm) > 10 and pred_obj_norm in e_norm
        is_substring = (
            c_norm in e_norm
            or (len(c_norm) > 15 and c_norm.rstrip(".,;") in e_norm)
            or pred_obj_in_evidence
        )
        if e_has_negation != c_has_negation and overlap_ratio >= 0.55:
            if not is_substring:
                return 0.05, 0.85, 0.10

        # 6. Check for distinct grammatical subject head mismatch (e.g. Alice vs Bob, Mistral vs Acme)
        # If the asserted subject entity does not appear in evidence, high overlap
        # on context alone (e.g. "lead researcher", "announced in Paris") must not trigger entailment.
        #
        # A. Grammatical leading subject clash check:
        # If both claim and evidence start with different singular person names (e.g., Alice vs Bob),
        # they are asserting properties of different individuals.
        # Ensure we only check when the leading word is an actual proper name (Titlecased word not a common stopword/conjunction).
        lead_stopwords = {"and", "but", "or", "so", "yet", "for", "in", "on", "at", "by", "with", "from", "as", "if", "that", "this"}
        c_lead_m = re.match(r"^(?:(?:the|dr|mr|mrs|ms|prof)\.?\s+)?([A-Z][a-z]+)\b", claim_text.strip())
        e_lead_m = re.match(r"^(?:(?:the|dr|mr|mrs|ms|prof)\.?\s+)?([A-Z][a-z]+)\b", evidence_text.strip())
        if c_lead_m and e_lead_m:
            c_lead_name = c_lead_m.group(1).lower()
            e_lead_name = e_lead_m.group(1).lower()
            if c_lead_name not in lead_stopwords and e_lead_name not in lead_stopwords:
                # Also ensure neither is an organization/entity token shared in context
                if c_lead_name != e_lead_name and c_lead_name not in e_tokens and not is_substring:
                    return 0.15, 0.15, 0.70

        # B. Determine candidate subject/entity tokens
        subj_phrase = claim_entity.strip() if claim_entity else ""
        if not subj_phrase:
            cleaned_lead = re.sub(r"^(?:dr|mr|mrs|ms|prof)\.?\s+", "", claim_text.strip(), flags=re.IGNORECASE)
            m_lead = re.match(r"^(?:the\s+)?([A-Z0-9][a-zA-Z0-9\.\'\-]+(?:\s+[A-Z0-9][a-zA-Z0-9\.\'\-]+)?)\b", cleaned_lead)
            subj_phrase = m_lead.group(1) if m_lead else claim_text.strip().split()[0]

        honorifics = {"dr", "mr", "mrs", "ms", "prof"}
        c_subj_tokens = [
            t for t in _clean_tokens(subj_phrase)
            if t not in honorifics and re.search(r"[a-z]", t) and not t.replace(".", "").isdigit()
        ]

        # Distinguish person entities (honorific present or two standard Titlecase words like First Last)
        is_person = bool(re.search(r"\b(?:dr|mr|mrs|ms|prof)\.?\b", claim_text, re.IGNORECASE))
        if not is_person and len(c_subj_tokens) == 2:
            words = subj_phrase.split()
            if len(words) == 2 and all(re.match(r"^[A-Z][a-z]+$", w) for w in words):
                is_person = True

        if c_subj_tokens:
            if is_person and len(c_subj_tokens) >= 2:
                # For multi-word person names, both components must be present in evidence
                # to prevent conflating different individuals (e.g. Alice Smith vs Alice Johnson).
                entity_aligned = all(t in e_tokens for t in c_subj_tokens)
            else:
                # For organizational / model / brand entities (e.g. "OpenAI's GPT-4.1" vs "GPT-4.1"),
                # distinctive non-numeric tokens must intersect.
                entity_aligned = bool(set(c_subj_tokens).intersection(e_tokens))

            # If the entity was an organization/context (e.g. "Nova Dynamics") but the claim's actual
            # grammatical subject/names (e.g. "Dr. Bob Jones") are present in evidence, treat as aligned.
            # Only apply this when the claim's subject entity wasn't already a specific person (is_person is False).
            if not entity_aligned and not is_person:
                # Find titlecased person names in claim text (e.g. Bob Jones)
                claim_titlecased_words = re.findall(r"\b[A-Z][a-z]+\b", claim_text)
                person_candidate_tokens = [
                    w.lower() for w in claim_titlecased_words
                    if w.lower() not in honorifics and w.lower() not in lead_stopwords and len(w) > 2
                ]
                if person_candidate_tokens:
                    # If we found person tokens in claim, require that at least 2 match evidence
                    person_overlap = set(person_candidate_tokens).intersection(e_tokens)
                    if len(person_overlap) >= 2:
                        entity_aligned = True

            if not entity_aligned and not is_substring:
                # Evidence is discussing a completely different subject entity! Return Neutral
                return 0.15, 0.15, 0.70

            # Check for competing organization/brand modifier clash on identical model identifier
            # e.g., "Meta Llama 3" vs "Amazon Llama 3"
            c_words = [w.strip(".,;'") for w in subj_phrase.split() if w.strip(".,;'")]
            e_words = [w.strip(".,;'") for w in evidence_text.strip().split() if w.strip(".,;'")]
            if len(c_words) >= 2 and len(e_words) >= 2:
                if c_words[1].lower() == e_words[1].lower() and c_words[0].lower() != e_words[0].lower():
                    c_clean_prefix = _clean_tokens(c_words[0].lower())
                    e_clean_prefix = _clean_tokens(e_words[0].lower())
                    if c_clean_prefix and e_clean_prefix and not c_clean_prefix.intersection(e_clean_prefix):
                        # Explicit competing prefix entity clash
                        return 0.15, 0.15, 0.70

        # C. Check that predicate/value content is corroborated if subject overlap is the only commonality
        # Having only person/subject overlap while the asserted predicate/relationship is completely absent
        # must remain NEUTRAL rather than producing false entailment.
        ent_token_set = set(c_subj_tokens) | honorifics
        pred_val_tokens = c_tokens - ent_token_set
        # Content tokens: include words > 2 chars, or temporal/numeric anchor tokens (e.g. years '1215')
        pred_val_content_tokens = {
            t for t in pred_val_tokens
            if (not t.replace(".", "").isdigit() and len(t) > 2) or (t.isdigit() and len(t) == 4)
        }
        if pred_val_content_tokens and not pred_val_content_tokens.intersection(e_tokens) and not is_substring:
            return 0.15, 0.15, 0.70

        # 7. Direct entailment / semantic support
        # High token overlap with matching polarity and no version/subject conflict, OR exact substring
        if is_substring:
            return 0.95, 0.02, 0.03

        if overlap_ratio >= 0.60 and not (e_has_negation != c_has_negation):
            if not (c_versions and e_versions and c_versions != e_versions):
                return 0.90, 0.05, 0.05

        if overlap_ratio >= 0.40 and not (e_has_negation != c_has_negation):
            if not (c_versions and e_versions and c_versions != e_versions):
                return 0.70, 0.10, 0.20

        # 8. Moderate overlap without definitive agreement -> NEUTRAL
        if overlap_ratio >= 0.20:
            return 0.15, 0.15, 0.70

        # 9. Low overlap -> Inconclusive / Neutral
        return 0.05, 0.05, 0.90


# Reusable alias for backwards compatibility
SemanticVerificationEngine = GeneralSemanticVerifier
