"""Tiered proposition correction validator and independent entailment interface for Phase 3D.

Implements:
1. Tier 1: Hard structural invariants (IDs, whitelists, operation-verdict matching, completeness).
2. Tier 2: Deterministic invariance filters (rejection gates for entities, numbers, years, polarity, modality).
3. Tier 3: Directional entailment validator interface (premise=evidence, hypothesis=correction).
4. Evidence conflict analysis before replacement generation.
"""
from __future__ import annotations

import abc
import enum
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.claims import StructuredProposition, PropositionPolarity, EpistemicModality
from app.schemas.evidence import EvidenceRecord, TemporalEligibilityStatus
from app.schemas.verification import VerificationVerdict, PropositionVerificationResult
from app.schemas.correction import PropositionCorrectionUnit, CorrectionOperationType

logger = logging.getLogger(__name__)


class EntailmentOutcome(str, enum.Enum):
    """Directional entailment verification outcome."""
    ENTAILED = "ENTAILED"
    CONTRADICTED = "CONTRADICTED"
    NEUTRAL = "NEUTRAL"
    INSUFFICIENT = "INSUFFICIENT"
    VALIDATOR_UNAVAILABLE = "VALIDATOR_UNAVAILABLE"
    VALIDATOR_ERROR = "VALIDATOR_ERROR"


class BaseDirectionalEntailmentValidator(abc.ABC):
    """Provider-neutral interface for independent directional entailment validation.
    
    Guarantees: Premise = Evidence Passage, Hypothesis = Generated Correction Sentence.
    """

    @abc.abstractmethod
    def validate_entailment(
        self,
        hypothesis_sentence: str,
        premise_evidence_passages: List[str],
        anchor_proposition: StructuredProposition,
        operation: CorrectionOperationType,
    ) -> Tuple[EntailmentOutcome, float, str]:
        """Validate whether the evidence entails the hypothesis sentence."""
        pass


class UnavailableEntailmentValidator(BaseDirectionalEntailmentValidator):
    """Default production validator when no trusted offline neural NLI model is available.
    
    Fails closed: signals VALIDATOR_UNAVAILABLE so that generated prose cannot be
    falsely marked as 'entailment_verified'.
    """

    def validate_entailment(
        self,
        hypothesis_sentence: str,
        premise_evidence_passages: List[str],
        anchor_proposition: StructuredProposition,
        operation: CorrectionOperationType,
    ) -> Tuple[EntailmentOutcome, float, str]:
        return (
            EntailmentOutcome.VALIDATOR_UNAVAILABLE,
            0.0,
            "Independent neural NLI validator is unavailable in offline environment; failing closed."
        )


class PropositionCorrectionValidator:
    """Multi-tiered validator enforcing structural, lexical, and entailment invariants on correction units."""

    def __init__(self, entailment_validator: Optional[BaseDirectionalEntailmentValidator] = None):
        self.entailment_validator = entailment_validator or UnavailableEntailmentValidator()

    @staticmethod
    def inspect_evidence_conflict(
        contradicting_evidence: List[EvidenceRecord]
    ) -> Tuple[bool, str]:
        """Inspect eligible contradicting evidence for conflicting replacement assertions.
        
        Returns:
            Tuple[has_conflict: bool, reason: str]
        """
        eligible = [e for e in contradicting_evidence if e.temporal_eligibility == TemporalEligibilityStatus.ELIGIBLE]
        if len(eligible) <= 1:
            return False, ""

        # Check for numerical / entity collision among candidate passages
        # e.g. snippet A contains "$2 billion", snippet B contains "$3 billion"
        amounts: Set[str] = set()
        for e in eligible:
            found_nums = set(re.findall(r"\$?\b\d+(?:\.\d+)?\b(?:\s*(?:billion|million|trillion))?", e.citation_text, re.IGNORECASE))
            amounts.update(found_nums)
        if len(amounts) > 2:
            return True, f"Eligible contradicting evidence presents conflicting quantities: {amounts}"

        return False, ""

    def validate_unit(
        self,
        unit: PropositionCorrectionUnit,
        target_proposition: StructuredProposition,
        prop_verdict: VerificationVerdict,
        authorized_evidence_whitelist: List[str],
        all_evidence_map: Dict[str, EvidenceRecord],
    ) -> Tuple[bool, str, bool, bool]:
        """Validate an individual correction unit through Tier 1, Tier 2, and Tier 3.
        
        Returns:
            Tuple[is_valid: bool, rejection_reason: str, invariants_passed: bool, entailment_verified: bool]
        """
        # ====================================================================
        # TIER 1: HARD STRUCTURAL INVARIANTS
        # ====================================================================
        # 1.1 Proposition ID Match
        if unit.proposition_id != target_proposition.proposition_id:
            return False, f"Unit proposition_id '{unit.proposition_id}' does not match target '{target_proposition.proposition_id}'", False, False

        # 1.2 Operation / Verdict Authorization
        if prop_verdict == VerificationVerdict.SUPPORTED:
            if unit.operation != CorrectionOperationType.REPHRASE_SUPPORTED:
                return False, f"Proposition verdict is SUPPORTED; operation must be REPHRASE_SUPPORTED, got '{unit.operation}'", False, False
            if unit.change_type != "RETAINED_SUPPORTED":
                return False, f"Operation REPHRASE_SUPPORTED requires change_type 'RETAINED_SUPPORTED', got '{unit.change_type}'", False, False

        elif prop_verdict in {VerificationVerdict.OUTDATED, VerificationVerdict.CONTRADICTED}:
            if unit.operation != CorrectionOperationType.REPLACE_OUTDATED:
                return False, f"Proposition verdict is {prop_verdict.value}; operation must be REPLACE_OUTDATED, got '{unit.operation}'", False, False
            expected_change = "CORRECTED_OUTDATED" if prop_verdict == VerificationVerdict.OUTDATED else "REFUTED_CONTRADICTED"
            if unit.change_type not in {"CORRECTED_OUTDATED", "REFUTED_CONTRADICTED"}:
                return False, f"Operation REPLACE_OUTDATED requires change_type '{expected_change}', got '{unit.change_type}'", False, False
        else:
            return False, f"Verdict {prop_verdict.value} is not eligible for generative correction; must use deterministic qualification.", False, False

        # 1.3 Evidence Whitelist Integrity
        if not unit.cited_evidence_ids:
            return False, "Unit must cite at least one authorized evidence ID", False, False

        whitelist_set = set(authorized_evidence_whitelist)
        for ev_id in unit.cited_evidence_ids:
            if ev_id not in whitelist_set:
                return False, f"Fabricated or unauthorized evidence ID '{ev_id}'. Allowed whitelist: {authorized_evidence_whitelist}", False, False
            # Check temporal eligibility
            ev_rec = all_evidence_map.get(ev_id)
            if ev_rec and ev_rec.temporal_eligibility == TemporalEligibilityStatus.INELIGIBLE:
                return False, f"Cited evidence '{ev_id}' is temporally INELIGIBLE under current evaluation mode", False, False

        # Text length check
        unit_text = unit.text.strip()
        if len(unit_text) < 5:
            return False, "Unit text is empty or too short", False, False

        # ====================================================================
        # TIER 2: DETERMINISTIC INVARIANCE FILTERS (REJECTION GATES)
        # ====================================================================
        cited_snippets = [all_evidence_map[eid].citation_text for eid in unit.cited_evidence_ids if eid in all_evidence_map]
        combined_evidence = " ".join(cited_snippets)

        # 2.1 Entity Checks for REPHRASE_SUPPORTED
        if unit.operation == CorrectionOperationType.REPHRASE_SUPPORTED:
            # Subject and Object must be preserved
            if target_proposition.subject and target_proposition.subject.lower() not in unit_text.lower():
                return False, f"Subject entity '{target_proposition.subject}' missing from rephrased text", False, False

            # If object is substantive entity, check containment
            if target_proposition.object and len(target_proposition.object.strip()) > 1:
                obj_clean = target_proposition.object.lower().strip()
                # Exact containment of normalized object
                if obj_clean not in unit_text.lower():
                    return False, f"Object entity '{target_proposition.object}' missing from rephrased text", False, False

            # 2.2 Numerical / Amount Invariance
            unit_nums = set(re.findall(r"\$?\b\d+(?:\.\d+)?\b(?:\s*(?:billion|million|trillion|percent|%))?", unit_text, re.IGNORECASE))
            allowed_nums = set(re.findall(r"\$?\b\d+(?:\.\d+)?\b(?:\s*(?:billion|million|trillion|percent|%))?", target_proposition.original_text_span + " " + combined_evidence, re.IGNORECASE))
            # Clean numerical tokens (e.g. drop standalone single digits like citation numbers '[1]')
            filtered_unit_nums = {n for n in unit_nums if not re.match(r"^\d+$", n.strip())}
            filtered_allowed_nums = {n for n in allowed_nums if not re.match(r"^\d+$", n.strip())}
            if filtered_unit_nums and not filtered_unit_nums.issubset(filtered_allowed_nums):
                diff = filtered_unit_nums - filtered_allowed_nums
                return False, f"Numerical / quantity distortion detected: {diff}", False, False

            # 2.3 Calendar Year Invariance
            unit_years = set(re.findall(r"\b(19\d\d|20\d\d)\b", unit_text))
            allowed_years = set(re.findall(r"\b(19\d\d|20\d\d)\b", target_proposition.original_text_span + " " + combined_evidence))
            if unit_years and not unit_years.issubset(allowed_years):
                diff_years = unit_years - allowed_years
                return False, f"Calendar year distortion detected: {diff_years}", False, False

            # 2.4 Polarity Invariance
            has_neg_unit = bool(re.search(r"\b(not|never|no longer|failed to|did not|was not|is not)\b", unit_text, re.IGNORECASE))
            if target_proposition.polarity == PropositionPolarity.POSITIVE and has_neg_unit:
                return False, "Positive proposition inverted to negative polarity", False, False
            if target_proposition.polarity == PropositionPolarity.NEGATIVE and not has_neg_unit:
                return False, "Negative proposition inverted to positive polarity", False, False

            # 2.5 Modality Retention
            if target_proposition.modality == EpistemicModality.ASSERTED:
                if re.search(r"\b(allegedly|supposedly|purportedly|reportedly|sources claimed|claimed)\b", unit_text, re.IGNORECASE):
                    return False, "Asserted fact demoted to rumor / speculative reporting", False, False
            elif target_proposition.modality == EpistemicModality.POSSIBLE:
                if re.search(r"\b(planned to|scheduled to|planned)\b", unit_text, re.IGNORECASE):
                    return False, "Possible proposition converted to planned event", False, False
                has_modal = bool(re.search(r"\b(if|unless|provided that|might|may|could|possibly|potential)\b", unit_text, re.IGNORECASE))
                if not has_modal:
                    return False, "Conditional or speculative proposition upgraded to asserted accomplishment", False, False
            elif target_proposition.modality == EpistemicModality.CONDITIONAL:
                has_modal = bool(re.search(r"\b(if|unless|provided that|might|may|could|possibly|potential)\b", unit_text, re.IGNORECASE))
                if not has_modal:
                    return False, "Conditional or speculative proposition upgraded to asserted accomplishment", False, False

            # 2.6 Obvious Role / Entity-Relation Reversal
            if target_proposition.subject and target_proposition.object:
                subj_pos = unit_text.lower().find(target_proposition.subject.lower())
                obj_pos = unit_text.lower().find(target_proposition.object.lower())
                if subj_pos >= 0 and obj_pos >= 0 and subj_pos > obj_pos:
                    # Object appears before Subject; inspect if passive by-clause
                    if not re.search(rf"\bby\s+{re.escape(target_proposition.subject.lower())}\b", unit_text.lower()):
                        return False, f"Relational role reversal: '{target_proposition.object}' appears before '{target_proposition.subject}' without passive attribution", False, False

        elif unit.operation == CorrectionOperationType.REPLACE_OUTDATED:
            # Subject anchor must remain
            if target_proposition.subject and target_proposition.subject.lower() not in unit_text.lower():
                # Allow head noun
                subj_words = [w for w in target_proposition.subject.split() if len(w) > 3]
                if subj_words and not any(w.lower() in unit_text.lower() for w in subj_words):
                    return False, f"Subject anchor '{target_proposition.subject}' missing from replacement text", False, False

            # Check that replacement content is actually grounded in cited evidence
            # Candidate replacement numbers/entities in unit must be in evidence
            unit_nums = set(re.findall(r"\$?\b\d+(?:\.\d+)?\b(?:\s*(?:billion|million|trillion|percent|%))?", unit_text, re.IGNORECASE))
            ev_nums = set(re.findall(r"\$?\b\d+(?:\.\d+)?\b(?:\s*(?:billion|million|trillion|percent|%))?", combined_evidence, re.IGNORECASE))
            filtered_unit_nums = {n for n in unit_nums if not re.match(r"^\d+$", n.strip())}
            filtered_ev_nums = {n for n in ev_nums if not re.match(r"^\d+$", n.strip())}
            if filtered_unit_nums and not filtered_unit_nums.issubset(filtered_ev_nums):
                return False, f"Replacement quantity {filtered_unit_nums - filtered_ev_nums} absent from cited evidence", False, False

        # Invariants passed Tier 1 and Tier 2
        invariants_passed = True

        # ====================================================================
        # TIER 3: DIRECTIONAL ENTAILMENT VALIDATION
        # ====================================================================
        outcome, conf, msg = self.entailment_validator.validate_entailment(
            hypothesis_sentence=unit_text,
            premise_evidence_passages=cited_snippets,
            anchor_proposition=target_proposition,
            operation=unit.operation,
        )

        if outcome == EntailmentOutcome.ENTAILED:
            entailment_verified = True
            return True, "", invariants_passed, entailment_verified
        elif outcome in {EntailmentOutcome.CONTRADICTED, EntailmentOutcome.NEUTRAL, EntailmentOutcome.INSUFFICIENT}:
            return False, f"Independent entailment check failed: {outcome.value} ({msg})", invariants_passed, False
        else: # VALIDATOR_UNAVAILABLE or VALIDATOR_ERROR
            # In offline environments where no trusted neural model is loaded, fail-closed:
            # Rejects acceptance of LLM text, triggering deterministic fallback.
            return False, f"Independent entailment validator unavailable/error: {msg}", invariants_passed, False
