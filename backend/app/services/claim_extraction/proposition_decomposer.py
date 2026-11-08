"""Deterministic atomic proposition decomposition service.

Breaks complex sentences into independent, verifiable 8-tuple StructuredPropositions
while preserving meaning, qualifiers, contrast, temporal scopes, and polarity.
"""
from __future__ import annotations

import re
import uuid
from typing import List, Tuple
from app.schemas.claims import StructuredProposition, PropositionPolarity


# Coordinating and contrastive conjunctions with lookahead/lookbehind
_CONTRAST_SPLIT = re.compile(r"\b(?:but|however|whereas|while|although)\b", re.IGNORECASE)
_COORDINATE_AND_SPLIT = re.compile(
    r"\b(?:and\s+also|and\s+is|and\s+was|and\s+remains|and\s+continues\s+to\s+be|and\s+has\s+been|and\s+offers)\b"
    r"|(?<=[,;])\s*and\s+(?=[a-z0-9])",
    re.IGNORECASE
)


class PropositionDecompositionService:
    """Decomposes compound factual statements into independent atomic propositions."""

    def decompose_claim(
        self,
        parent_claim_id: str,
        text: str,
        inherited_entity: str = "",
    ) -> List[StructuredProposition]:
        """Decompose a parent claim or sentence into one or more StructuredPropositions."""
        clean_text = text.strip()
        if not clean_text:
            return []

        # 1. Check for contrastive constructions ("X, but Y")
        contrast_propositions = self._try_decompose_contrast(parent_claim_id, clean_text, inherited_entity)
        if contrast_propositions:
            return contrast_propositions

        # 2. Check for relative clauses ("Subject, who/which ..., main predicate ...")
        relative_propositions = self._try_decompose_relative_clause(parent_claim_id, clean_text, inherited_entity)
        if relative_propositions:
            return relative_propositions

        # 3. Check for coordinate conjunctions ("X and is Y", "S1 V1 O1 and S2 V2 O2")
        coordinate_propositions = self._try_decompose_coordinate(parent_claim_id, clean_text, inherited_entity)
        if coordinate_propositions:
            return coordinate_propositions

        # 4. Fallback: single atomic proposition (preserving complete sentence)
        return [self._create_single_proposition(parent_claim_id, clean_text, inherited_entity)]

    def _try_decompose_contrast(
        self,
        parent_claim_id: str,
        text: str,
        inherited_entity: str,
    ) -> List[StructuredProposition] | None:
        """Decompose contrastive statements (e.g. 'A was deprecated, but B is supported')."""
        match = _CONTRAST_SPLIT.search(text)
        if not match:
            return None

        left = text[:match.start()].strip().rstrip(" ,;")
        right = text[match.end():].strip().lstrip(" ,;")
        if len(left.split()) < 3 or len(right.split()) < 3:
            return None

        # Check if right clause lacks a subject (shares subject with left)
        subj_left, pred_left, obj_left, pol_left = self._parse_spo(left, inherited_entity)

        # If right clause starts with a verb, it inherits subj_left
        verb_match = re.match(r"^(remains|continues\s+to\s+be|is|was|are|were|became|has\s+been)\s+(.*)$", right, re.IGNORECASE)
        if verb_match:
            subj_right = subj_left
            pred_right = verb_match.group(1).strip()
            obj_right = verb_match.group(2).strip()
            pol_right = PropositionPolarity.NEGATIVE if re.search(r"\b(?:not|never|no longer|cannot)\b", right, re.IGNORECASE) else PropositionPolarity.POSITIVE
        else:
            subj_right, pred_right, obj_right, pol_right = self._parse_spo(right, subj_left)

        p1_id = f"prop_{uuid.uuid4().hex[:8]}"
        p2_id = f"prop_{uuid.uuid4().hex[:8]}"

        p1 = StructuredProposition(
            proposition_id=p1_id,
            parent_claim_id=parent_claim_id,
            source_claim_id=parent_claim_id,
            subject=subj_left,
            predicate=pred_left,
            object=obj_left,
            qualifiers={"relation": "contrast_thesis"},
            polarity=pol_left,
            temporal_scope=self._extract_temporal_scope(left),
            related_entities=[subj_left] if subj_left else [],
            original_text_span=left,
            extraction_confidence=0.95,
        )

        p2 = StructuredProposition(
            proposition_id=p2_id,
            parent_claim_id=parent_claim_id,
            source_claim_id=parent_claim_id,
            subject=subj_right,
            predicate=pred_right,
            object=obj_right,
            qualifiers={"relation": "contrast_antithesis", "contrast_marker": match.group(0).lower()},
            polarity=pol_right,
            temporal_scope=self._extract_temporal_scope(right),
            related_entities=[subj_right] if subj_right else [],
            original_text_span=right,
            extraction_confidence=0.95,
        )

        return [p1, p2]

    def _try_decompose_relative_clause(
        self,
        parent_claim_id: str,
        text: str,
        inherited_entity: str,
    ) -> List[StructuredProposition] | None:
        """Decompose sentences with appositive relative clauses e.g. 'Subject, who/which is X, predicate Y'."""
        rel_match = re.search(r"^([A-Z][a-zA-Z0-9_\'\-\.\s]+?),\s*(who|which|that)\s+(.+?),\s*(.+)$", text)
        if not rel_match:
            return None

        subj = rel_match.group(1).strip()
        rel_pron = rel_match.group(2).strip()
        rel_body = rel_match.group(3).strip()
        main_rest = rel_match.group(4).strip()

        # Prop 1: Relative clause assertion ("Subject is X")
        p1_text = f"{subj} {rel_body}"
        s1, pred1, obj1, pol1 = self._parse_spo(p1_text, subj)

        # Prop 2: Main clause assertion ("Subject main_rest")
        p2_text = f"{subj} {main_rest}"
        s2, pred2, obj2, pol2 = self._parse_spo(p2_text, subj)

        p1_id = f"prop_{uuid.uuid4().hex[:8]}"
        p2_id = f"prop_{uuid.uuid4().hex[:8]}"

        p1 = StructuredProposition(
            proposition_id=p1_id,
            parent_claim_id=parent_claim_id,
            source_claim_id=parent_claim_id,
            subject=subj,
            predicate=pred1,
            object=obj1,
            qualifiers={"clause_type": "relative_clause", "relative_pronoun": rel_pron},
            polarity=pol1,
            temporal_scope=self._extract_temporal_scope(p1_text),
            related_entities=[subj] if subj else [],
            original_text_span=f"{rel_pron} {rel_body}",
            extraction_confidence=0.92,
        )

        p2 = StructuredProposition(
            proposition_id=p2_id,
            parent_claim_id=parent_claim_id,
            source_claim_id=parent_claim_id,
            subject=subj,
            predicate=pred2,
            object=obj2,
            qualifiers={"clause_type": "main_clause"},
            polarity=pol2,
            temporal_scope=self._extract_temporal_scope(p2_text),
            related_entities=[subj] if subj else [],
            original_text_span=main_rest,
            extraction_confidence=0.92,
        )

        return [p1, p2]

    def _try_decompose_coordinate(
        self,
        parent_claim_id: str,
        text: str,
        inherited_entity: str,
    ) -> List[StructuredProposition] | None:
        """Decompose coordinate statements sharing a subject (e.g. 'GPT-4.1 remains latest and is available via API')."""
        # Look for conjunction boundary where predicate follows: "and is", "and was", "and remains", etc.
        patterns = [
            (
                re.compile(r"^(.*?)\s+and\s+(is|was|are|were|remains|continues\s+to\s+be|has\s+been|offers)\s+(.*)$", re.IGNORECASE),
                True, # Shared subject
            ),
            (
                re.compile(r"^(.*?)\s+and\s+([A-Z][a-zA-Z0-9_\'\-\.]*|\bthe\b|\bit\b)\s+(.*)$", re.IGNORECASE),
                False, # Independent subject
            ),
        ]

        # Case 1: Shared subject with explicit verbal conjunction: "S P1 O1 and [verb] O2"
        # Example: "OpenAI's GPT-4.1 remains the latest model in the GPT-4 series and is available through the API."
        match = patterns[0][0].search(text)
        if match:
            first_clause = match.group(1).strip()
            verb2 = match.group(2).strip()
            rest2 = match.group(3).strip()

            subj1, pred1, obj1, pol1 = self._parse_spo(first_clause, inherited_entity)
            # Second clause inherits subj1
            second_clause_text = f"{subj1} {verb2} {rest2}"
            subj2, pred2, obj2, pol2 = self._parse_spo(second_clause_text, subj1)

            p1_id = f"prop_{uuid.uuid4().hex[:8]}"
            p2_id = f"prop_{uuid.uuid4().hex[:8]}"

            p1 = StructuredProposition(
                proposition_id=p1_id,
                parent_claim_id=parent_claim_id,
                source_claim_id=parent_claim_id,
                subject=subj1,
                predicate=pred1,
                object=obj1,
                qualifiers={"coordination": "clause_1"},
                polarity=pol1,
                temporal_scope=self._extract_temporal_scope(first_clause),
                related_entities=[subj1] if subj1 else [],
                original_text_span=first_clause,
                extraction_confidence=0.95,
            )

            p2 = StructuredProposition(
                proposition_id=p2_id,
                parent_claim_id=parent_claim_id,
                source_claim_id=parent_claim_id,
                subject=subj2,
                predicate=pred2,
                object=obj2,
                qualifiers={"coordination": "clause_2"},
                polarity=pol2,
                temporal_scope=self._extract_temporal_scope(second_clause_text),
                related_entities=[subj2] if subj2 else [],
                original_text_span=f"and {verb2} {rest2}",
                extraction_confidence=0.95,
            )

            return [p1, p2]

        # Case 2: Independent subjects coordinate: "S1 P1 O1 and S2 P2 O2"
        # Example: "OpenAI developed GPT-4 and Anthropic released Claude."
        # Also handles possessive specifiers: "OpenAI is based in San Francisco, and its interim CEO is Mira Murati."
        coord_clause_pattern = re.compile(
            r"^(?P<left>.+?)(?:,\s*and\s+|\s+and\s+)(?P<subj>(?:(?:its|their|his|her|our|the|this|that)\s+[a-zA-Z0-9_\'\-]+(?:\s+[a-zA-Z0-9_\'\-]+)?|[A-Z][a-zA-Z0-9_\'\-\.]*|\bit\b|\bthey\b|\bhe\b|\bshe\b))\s+(?P<verb>is\s+not|was\s+not|are\s+not|were\s+not|is|was|are|were|remains|continues\s+to\s+be|became|has\s+been|released|launched|announced|acquired|founded|developed|created|built|attended|defeated|won|changed|operates|maintains|leads|manages|directs|serves\s+as)\s+(?P<rest>.+)$",
            re.IGNORECASE,
        )
        verb_check = re.compile(
            r"\b(is|was|are|were|remains|continues|became|has|released|launched|announced|acquired|founded|developed|created|built|attended|defeated|won|changed|operates|maintains|leads|manages|directs|serves)\b",
            re.IGNORECASE,
        )

        coord_clause_match = coord_clause_pattern.search(text)
        if coord_clause_match:
            left_clause = coord_clause_match.group("left").strip()
            subj2 = coord_clause_match.group("subj").strip()
            verb2 = coord_clause_match.group("verb").strip()
            rest2 = coord_clause_match.group("rest").strip().rstrip(".,;")

            # Safety check: Ensure left_clause contains its own finite verb and has sufficient length
            # to prevent false splits on compound subjects like "OpenAI and Microsoft are..."
            if verb_check.search(left_clause) and len(left_clause.split()) >= 3:
                right_clause = f"{subj2} {verb2} {rest2}"

                subj1, pred1, obj1, pol1 = self._parse_spo(left_clause, inherited_entity)
                subj2, pred2, obj2, pol2 = self._parse_spo(right_clause, subj2)

                p1_id = f"prop_{uuid.uuid4().hex[:8]}"
                p2_id = f"prop_{uuid.uuid4().hex[:8]}"

                p1 = StructuredProposition(
                    proposition_id=p1_id,
                    parent_claim_id=parent_claim_id,
                    source_claim_id=parent_claim_id,
                    subject=subj1,
                    predicate=pred1,
                    object=obj1,
                    qualifiers={"coordination": "independent_clause_1"},
                    polarity=pol1,
                    temporal_scope=self._extract_temporal_scope(left_clause),
                    related_entities=[subj1] if subj1 else [],
                    original_text_span=left_clause,
                    extraction_confidence=0.92,
                )

                p2 = StructuredProposition(
                    proposition_id=p2_id,
                    parent_claim_id=parent_claim_id,
                    source_claim_id=parent_claim_id,
                    subject=subj2,
                    predicate=pred2,
                    object=obj2,
                    qualifiers={"coordination": "independent_clause_2"},
                    polarity=pol2,
                    temporal_scope=self._extract_temporal_scope(right_clause),
                    related_entities=[subj2] if subj2 else [],
                    original_text_span=right_clause,
                    extraction_confidence=0.92,
                )

                return [p1, p2]

        return None

    def _create_single_proposition(
        self,
        parent_claim_id: str,
        text: str,
        inherited_entity: str,
    ) -> StructuredProposition:
        """Create a single StructuredProposition for simple sentences."""
        subj, pred, obj, pol = self._parse_spo(text, inherited_entity)
        return StructuredProposition(
            proposition_id=f"prop_{uuid.uuid4().hex[:8]}",
            parent_claim_id=parent_claim_id,
            source_claim_id=parent_claim_id,
            subject=subj,
            predicate=pred,
            object=obj,
            qualifiers={},
            polarity=pol,
            temporal_scope=self._extract_temporal_scope(text),
            related_entities=[subj] if subj else [],
            original_text_span=text,
            extraction_confidence=0.90,
        )

    def _parse_spo(self, text: str, fallback_entity: str = "") -> Tuple[str, str, str, PropositionPolarity]:
        """Extract coarse (Subject, Predicate, Object, Polarity) tuple."""
        clean = text.strip().rstrip(".,;")
        polarity = PropositionPolarity.NEGATIVE if re.search(r"\b(?:not|never|no longer|cannot|neither|nor)\b", clean, re.IGNORECASE) else PropositionPolarity.POSITIVE

        # Check for copula / state transitions: "X remains / is / was / became Y"
        match = re.search(r"^(.*?)\s+(remains|continues\s+to\s+be|is|was|are|were|became|has\s+been)\s+(.*)$", clean, re.IGNORECASE)
        if match:
            s = match.group(1).strip()
            p = match.group(2).strip()
            o = match.group(3).strip()
            return s or fallback_entity, p, o, polarity

        # Check for transitive verbs: "X released / announced / launched / acquired / developed / attended / changed / operates Y"
        match2 = re.search(r"^(.*?)\s+(released|launched|announced|acquired|founded|developed|created|built|attended|defeated|won|changed|operates|maintains|leads|manages|directs|serves\s+as)\s+(.*)$", clean, re.IGNORECASE)
        if match2:
            s = match2.group(1).strip()
            p = match2.group(2).strip()
            o = match2.group(3).strip()
            return s or fallback_entity, p, o, polarity

        # Fallback to leading words as subject
        words = clean.split()
        if len(words) >= 3:
            return words[0], "asserts", " ".join(words[1:]), polarity
        return fallback_entity or (words[0] if words else "Entity"), "state", clean, polarity

    def _extract_temporal_scope(self, text: str) -> str | None:
        """Extract explicit year or date indicator from text."""
        m = re.search(r"\b(in|on|since|as of|by|circa)?\s*([12][0-9]{3}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+[12][0-9]{3})\b", text, re.IGNORECASE)
        return m.group(0).strip() if m else None

