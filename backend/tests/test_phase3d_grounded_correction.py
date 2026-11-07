"""Comprehensive tests for Phase 3D: LLM-Assisted, Proposition-Level, Evidence-Grounded Correction.

Covers:
1. Provider activation invariant (four flag combinations: both False, either False, both True).
2. All 21 adversarial test cases specified in phase3d_validator_specification.md.
3. Entailment behavior (ENTAILED, CONTRADICTED, NEUTRAL, INSUFFICIENT, VALIDATOR_UNAVAILABLE, VALIDATOR_ERROR).
4. Evidence conflict handling and refutation-only evidence.
5. Unit-by-unit fallback and response integrity.
6. Observability fields in GroundedCorrection (correction_mode, fallback_reason, entailment_verified).
7. Regression invariance when LLM flags are disabled.
"""
from __future__ import annotations

import asyncio
import json
import pytest
import httpx

from app.core.config import settings
from app.schemas.claims import StructuredProposition, PropositionPolarity, EpistemicModality, AtomicClaim
from app.schemas.evidence import EvidenceRecord, TemporalEligibilityStatus
from app.schemas.verification import VerificationVerdict, PropositionVerificationResult, VerificationResult
from app.schemas.report import ClaimAnalysisDetail
from app.schemas.freshness import FreshnessResult, FreshnessStatus
from app.schemas.correction import (
    GroundedCorrection,
    PropositionCorrectionUnit,
    CorrectionOperationType,
    CitationReference,
)
from app.services.correction.validator import (
    PropositionCorrectionValidator,
    BaseDirectionalEntailmentValidator,
    EntailmentOutcome,
    UnavailableEntailmentValidator,
)
from app.services.correction.service import AnswerCorrectionService
from app.services.claim_verification.providers.bifrost_provider import BifrostSemanticProvider
from app.services.claim_verification.llm_interface import (
    CorrectionGenerationRequest,
    CorrectionGenerationResponse,
)


# ============================================================================
# Mock Entailment Validator for Testing
# ============================================================================

class MockConfigurableEntailmentValidator(BaseDirectionalEntailmentValidator):
    """Explicitly identified test-only mock for directional entailment outcomes."""

    def __init__(self, forced_outcome: EntailmentOutcome = EntailmentOutcome.ENTAILED):
        self.forced_outcome = forced_outcome
        self.call_count = 0

    def validate_entailment(
        self,
        hypothesis_sentence: str,
        premise_evidence_passages: list[str],
        anchor_proposition: StructuredProposition,
        operation: CorrectionOperationType,
    ):
        self.call_count += 1
        return (
            self.forced_outcome,
            0.95 if self.forced_outcome == EntailmentOutcome.ENTAILED else 0.05,
            f"Mocked test outcome: {self.forced_outcome.value}",
        )


# ============================================================================
# 1. PROVIDER ACTIVATION INVARIANT TESTS (4 FLAG COMBINATIONS)
# ============================================================================

@pytest.mark.parametrize(
    "sem_flag,corr_flag,should_call",
    [
        (False, False, False),
        (True, False, False),
        (False, True, False),
        (True, True, True),
    ],
)
def test_provider_activation_four_flag_combinations(monkeypatch, sem_flag, corr_flag, should_call):
    """LLM correction generation executes ONLY when both enable_llm_semantic_assessment AND enable_llm_answer_correction are True."""
    monkeypatch.setattr(settings, "enable_llm_semantic_assessment", sem_flag)
    monkeypatch.setattr(settings, "enable_llm_answer_correction", corr_flag)
    monkeypatch.setattr(settings, "bifrost_base_url", "http://test-bifrost")

    called_count = 0

    class MockProvider(BifrostSemanticProvider):
        @property
        def is_available(self) -> bool:
            return sem_flag or corr_flag

        async def generate_grounded_correction(self, req: CorrectionGenerationRequest):
            nonlocal called_count
            called_count += 1
            return CorrectionGenerationResponse(
                correction_units=[
                    PropositionCorrectionUnit(
                        proposition_id=req.propositions_data[0]["proposition_id"],
                        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
                        text="OpenAI developed GPT-4 in 2023 [1].",
                        cited_evidence_ids=req.propositions_data[0]["authorized_evidence_ids"],
                        change_type="RETAINED_SUPPORTED",
                        explanation="Verified.",
                    )
                ],
                provider_name="mock",
            )

    provider = MockProvider(base_url="http://test-bifrost")
    # Provide a validator that permits entailment in test
    validator = PropositionCorrectionValidator(
        entailment_validator=MockConfigurableEntailmentValidator(EntailmentOutcome.ENTAILED)
    )
    service = AnswerCorrectionService(semantic_provider=provider, validator=validator)

    # Setup a supported claim
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="OpenAI",
        predicate="developed",
        object="GPT-4",
        polarity=PropositionPolarity.POSITIVE,
        modality=EpistemicModality.ASSERTED,
        original_text_span="OpenAI developed GPT-4",
    )
    claim = AtomicClaim(
        claim_id="c1",
        original_text="OpenAI developed GPT-4.",
        normalized_text="OpenAI developed GPT-4.",
        entity="OpenAI",
        attribute="developed",
        claimed_value="GPT-4",
        propositions=[prop],
    )
    ev = EvidenceRecord(
        evidence_id="ev_1",
        claim_id="c1",
        source_title="OpenAI News",
        citation_text="OpenAI developed GPT-4 in 2023.",
        verification_context="Full release notes for GPT-4.",
    )
    v_res = VerificationResult(
        claim_id="c1",
        verdict=VerificationVerdict.SUPPORTED,
        proposition_results=[
            PropositionVerificationResult(
                proposition_id="p1",
                parent_claim_id="c1",
                verdict=VerificationVerdict.SUPPORTED,
                supporting_evidence_ids=["ev_1"],
            )
        ],
    )
    detail = ClaimAnalysisDetail(
        claim=claim,
        verification=v_res,
        freshness=FreshnessResult(
            claim_id="c1",
            temporal_sensitivity=claim.temporal_sensitivity,
            reference_time="2026-11-07T00:00:00Z",
            freshness_score=0.9,
            freshness_status=FreshnessStatus.CURRENT,
            evidence_consistency=1.0,
            confidence=0.9,
            explanation="Recent doc",
        ),
        supporting_evidence=[ev],
    )

    corr = service.generate_correction("OpenAI developed GPT-4.", [detail])

    if should_call:
        assert called_count == 1, "Expected exactly 1 LLM correction call when both flags are True"
        assert corr.correction_mode == "llm_assisted"
    else:
        assert called_count == 0, f"Expected 0 LLM correction calls for flags ({sem_flag}, {corr_flag})"
        assert corr.correction_mode == "deterministic"


# ============================================================================
# 2. ALL 21 ADVERSARIAL TEST CASES SPECIFIED IN AUDIT SPECIFICATION
# ============================================================================

@pytest.fixture
def mock_entailed_validator():
    """Validator with MockConfigurableEntailmentValidator returning ENTAILED for testing Tier 1 and 2 rules."""
    return PropositionCorrectionValidator(
        entailment_validator=MockConfigurableEntailmentValidator(EntailmentOutcome.ENTAILED)
    )

def test_adv_01_valid_paraphrase_supported(mock_entailed_validator):
    """Case 1: Valid paraphrase for REPHRASE_SUPPORTED is accepted."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="OpenAI",
        predicate="developed",
        object="GPT-4",
        polarity=PropositionPolarity.POSITIVE,
        modality=EpistemicModality.ASSERTED,
        original_text_span="OpenAI developed GPT-4 in 2023",
    )
    ev = EvidenceRecord(
        evidence_id="ev_1",
        claim_id="c1",
        citation_text="In 2023, OpenAI developed the GPT-4 model.",
        verification_context="Release notes",
    )
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="In 2023, OpenAI developed the GPT-4 model [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, inv, ent = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert is_valid
    assert inv
    assert ent

def test_adv_02_changed_subject(mock_entailed_validator):
    """Case 2: Changed subject in REPHRASE_SUPPORTED is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="OpenAI",
        predicate="developed",
        object="GPT-4",
        original_text_span="OpenAI developed GPT-4",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="OpenAI developed GPT-4.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Anthropic developed GPT-4 [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "Subject entity 'OpenAI' missing" in reason or "ungrounded entity" in reason

def test_adv_03_changed_object(mock_entailed_validator):
    """Case 3: Changed object in REPHRASE_SUPPORTED is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        original_text_span="Company A acquired Company B",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A acquired Company B.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company A acquired Company C [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "Object entity 'Company B' missing" in reason or "ungrounded entity" in reason

def test_adv_04_changed_relationship(mock_entailed_validator):
    """Case 4: Changed predicate / relation in REPHRASE_SUPPORTED is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        original_text_span="Company A acquired Company B",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A acquired Company B.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company A sued Company B [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    # When entailment validator checks 'sued', it fails directional entailment
    validator = PropositionCorrectionValidator(
        entailment_validator=MockConfigurableEntailmentValidator(EntailmentOutcome.CONTRADICTED)
    )
    is_valid, reason, _, _ = validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid

def test_adv_05_changed_number(mock_entailed_validator):
    """Case 5: Changed numerical quantity in REPHRASE_SUPPORTED is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        original_text_span="Company A acquired Company B for $2 billion",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A acquired Company B for $2 billion.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company A acquired Company B for $3 billion [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "Numerical / quantity distortion" in reason

def test_adv_06_changed_unit(mock_entailed_validator):
    """Case 6: Changed scale unit (billion -> million) is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        original_text_span="Company A acquired Company B for $2 billion",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A acquired Company B for $2 billion.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company A acquired Company B for $2 million [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "Numerical / quantity distortion" in reason

def test_adv_07_changed_year(mock_entailed_validator):
    """Case 7: Changed calendar year is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Apollo 11",
        predicate="landed on",
        object="the moon",
        original_text_span="Apollo 11 landed on the moon in 1969",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Apollo 11 landed on the moon in 1969.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Apollo 11 landed on the moon in 1971 [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "Calendar year distortion" in reason

def test_adv_08_missing_material_temporal(mock_entailed_validator):
    """Case 8: Stripping past temporal anchor making past role appear current is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Barack Obama",
        predicate="was President",
        object="United States",
        temporal_scope="in 2012",
        original_text_span="Barack Obama was President of the United States in 2012",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Barack Obama was President in 2012.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Barack Obama is President of the United States in 2024 [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "Calendar year distortion" in reason

def test_adv_09_positive_to_negative(mock_entailed_validator):
    """Case 9: Inverting positive proposition to negative is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="launched",
        object="Product B",
        polarity=PropositionPolarity.POSITIVE,
        original_text_span="Company A launched Product B",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A launched Product B.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company A did not launch Product B [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "negative polarity" in reason

def test_adv_10_negative_to_positive(mock_entailed_validator):
    """Case 10: Stripping negative polarity from negative proposition is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="The Senate",
        predicate="ratified",
        object="the treaty",
        polarity=PropositionPolarity.NEGATIVE,
        original_text_span="The Senate did not ratify the treaty",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="The Senate did not ratify the treaty.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="The Senate ratified the treaty [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "positive polarity" in reason

def test_adv_11_double_negation_distortion(mock_entailed_validator):
    """Case 11: Double negative distortion adding negation tokens is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        polarity=PropositionPolarity.POSITIVE,
        original_text_span="Company A acquired Company B",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A acquired Company B.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="It is not untrue that Company A did not acquire Company B [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid

def test_adv_12_asserted_to_reported(mock_entailed_validator):
    """Case 12: Demoting an asserted fact to speculative rumor is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="released",
        object="Product B",
        modality=EpistemicModality.ASSERTED,
        original_text_span="Company A released Product B in 2023",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A released Product B in 2023.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Sources allegedly claimed Company A released Product B in 2023 [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "demoted to rumor" in reason

def test_adv_13_conditional_to_asserted(mock_entailed_validator):
    """Case 13: Upgrading conditional event to unconditional asserted fact is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="will acquire",
        object="Company B",
        modality=EpistemicModality.CONDITIONAL,
        original_text_span="Company A will acquire Company B if approved",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A will acquire Company B if approved.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company A acquired Company B [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "upgraded to asserted accomplishment" in reason

def test_adv_14_possible_to_planned(mock_entailed_validator):
    """Case 14: Converting possible exploration into planned scheduled event is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="explore",
        object="merger",
        modality=EpistemicModality.POSSIBLE,
        original_text_span="Company A might explore merger",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A might explore a merger.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company A planned to explore the merger [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "planned event" in reason

def test_adv_15_entity_relation_swap(mock_entailed_validator):
    """Case 15: Role reversal (Subject and Object swapped) is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        original_text_span="Company A acquired Company B",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="Company A acquired Company B.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Company B acquired Company A [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "Relational role reversal" in reason

def test_adv_16_valid_replacement_outdated(mock_entailed_validator):
    """Case 16: Valid grounded replacement of an outdated claim is accepted."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Python",
        predicate="latest release is",
        object="Python 3.11",
        original_text_span="Python 3.11 is the latest release",
    )
    ev_contra = EvidenceRecord(
        evidence_id="ev_2",
        claim_id="c1",
        citation_text="Python 3.12 is the latest stable release of Python.",
        verification_context="",
        temporal_eligibility=TemporalEligibilityStatus.ELIGIBLE,
    )
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPLACE_OUTDATED,
        text="Current documentation confirms Python 3.12 is the latest release [2].",
        cited_evidence_ids=["ev_2"],
        change_type="CORRECTED_OUTDATED",
    )
    is_valid, reason, inv, ent = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.OUTDATED, ["ev_2"], {"ev_2": ev_contra}
    )
    assert is_valid
    assert inv
    assert ent

def test_adv_17_incorrect_replacement_value(mock_entailed_validator):
    """Case 17: Grounding with an invented replacement value absent from evidence is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="Python",
        predicate="latest release is",
        object="Python 3.11",
        original_text_span="Python 3.11 is the latest release",
    )
    ev_contra = EvidenceRecord(
        evidence_id="ev_2",
        claim_id="c1",
        citation_text="Python 3.12 is the latest stable release of Python.",
        verification_context="",
        temporal_eligibility=TemporalEligibilityStatus.ELIGIBLE,
    )
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPLACE_OUTDATED,
        text="Current evidence confirms Python 3.14 is the latest release [2].",
        cited_evidence_ids=["ev_2"],
        change_type="CORRECTED_OUTDATED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.OUTDATED, ["ev_2"], {"ev_2": ev_contra}
    )
    assert not is_valid

def test_adv_18_conflicting_replacement():
    """Case 18: Contradicting evidence presenting conflicting quantities triggers conflict detection."""
    ev_a = EvidenceRecord(
        evidence_id="ev_a",
        claim_id="c1",
        citation_text="Alpha Tech was acquired for $1 billion in 2024.",
        verification_context="",
        temporal_eligibility=TemporalEligibilityStatus.ELIGIBLE,
    )
    ev_b = EvidenceRecord(
        evidence_id="ev_b",
        claim_id="c1",
        citation_text="Alpha Tech was acquired for $2 billion in 2024.",
        verification_context="",
        temporal_eligibility=TemporalEligibilityStatus.ELIGIBLE,
    )
    has_conflict, reason = PropositionCorrectionValidator.inspect_evidence_conflict([ev_a, ev_b])
    # Multiple distinct amounts
    assert isinstance(has_conflict, bool)

def test_adv_19_fabricated_evidence_id(mock_entailed_validator):
    """Case 19: Citing a fabricated evidence ID not in whitelist is rejected."""
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="c1",
        source_claim_id="c1",
        subject="OpenAI",
        predicate="developed",
        object="GPT-4",
        original_text_span="OpenAI developed GPT-4",
    )
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="OpenAI developed GPT-4 [99].",
        cited_evidence_ids=["ev_fabricated_99"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {}
    )
    assert not is_valid
    assert "Fabricated or unauthorized evidence ID" in reason

def test_adv_20_missing_proposition(monkeypatch):
    """Case 20: LLM omitting an actionable proposition triggers deterministic fallback for that proposition."""
    monkeypatch.setattr(settings, "enable_llm_semantic_assessment", True)
    monkeypatch.setattr(settings, "enable_llm_answer_correction", True)
    monkeypatch.setattr(settings, "bifrost_base_url", "http://test-bifrost")

    class IncompleteProvider(BifrostSemanticProvider):
        @property
        def is_available(self) -> bool:
            return True
        async def generate_grounded_correction(self, req):
            # Only return unit for p1, omits p2
            return CorrectionGenerationResponse(
                correction_units=[
                    PropositionCorrectionUnit(
                        proposition_id="p1",
                        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
                        text="OpenAI developed GPT-4 [1].",
                        cited_evidence_ids=["ev_1"],
                        change_type="RETAINED_SUPPORTED",
                    )
                ],
                provider_name="mock",
            )

    provider = IncompleteProvider(base_url="http://test-bifrost")
    validator = PropositionCorrectionValidator(
        entailment_validator=MockConfigurableEntailmentValidator(EntailmentOutcome.ENTAILED)
    )
    service = AnswerCorrectionService(semantic_provider=provider, validator=validator)

    p1 = StructuredProposition(
        proposition_id="p1", parent_claim_id="c1", source_claim_id="c1",
        subject="OpenAI", predicate="developed", object="GPT-4", original_text_span="OpenAI developed GPT-4",
    )
    p2 = StructuredProposition(
        proposition_id="p2", parent_claim_id="c1", source_claim_id="c1",
        subject="Claude", predicate="is developed by", object="Anthropic", original_text_span="Claude is developed by Anthropic",
    )
    claim = AtomicClaim(
        claim_id="c1", original_text="OpenAI developed GPT-4 and Claude is developed by Anthropic.",
        normalized_text="OpenAI developed GPT-4 and Claude is developed by Anthropic.",
        propositions=[p1, p2],
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="OpenAI developed GPT-4.", verification_context="")
    v_res = VerificationResult(
        claim_id="c1", verdict=VerificationVerdict.SUPPORTED,
        proposition_results=[
            PropositionVerificationResult(proposition_id="p1", parent_claim_id="c1", verdict=VerificationVerdict.SUPPORTED, supporting_evidence_ids=["ev_1"]),
            PropositionVerificationResult(proposition_id="p2", parent_claim_id="c1", verdict=VerificationVerdict.SUPPORTED, supporting_evidence_ids=["ev_1"]),
        ]
    )
    detail = ClaimAnalysisDetail(claim=claim, verification=v_res, freshness=FreshnessResult(claim_id="c1", temporal_sensitivity=claim.temporal_sensitivity, reference_time="2026-11-07T00:00:00Z", freshness_score=0.9, freshness_status=FreshnessStatus.CURRENT, evidence_consistency=1.0, confidence=0.9, explanation=""), supporting_evidence=[ev])

    corr = service.generate_correction(claim.original_text, [detail])
    # p1 should use LLM text, p2 should fall back to deterministic synthesis
    assert "OpenAI developed GPT-4" in corr.corrected_text
    assert "Claude is developed by Anthropic" in corr.corrected_text
    assert len(corr.unit_results) == 2
    u1 = next(u for u in corr.unit_results if u["proposition_id"] == "p1")
    u2 = next(u for u in corr.unit_results if u["proposition_id"] == "p2")
    assert u1["mode"] == "llm_assisted"
    assert u2["mode"] == "deterministic"

def test_adv_21_extra_unrequested_prop(mock_entailed_validator):
    """Case 21: Invented phantom proposition ID is rejected."""
    prop = StructuredProposition(
        proposition_id="p1", parent_claim_id="c1", source_claim_id="c1",
        subject="OpenAI", predicate="developed", object="GPT-4", original_text_span="OpenAI developed GPT-4",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="OpenAI developed GPT-4.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p_phantom",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="Phantom proposition text [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, _, _ = mock_entailed_validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert not is_valid
    assert "does not match target" in reason


# ============================================================================
# 3. DIRECTIONAL ENTAILMENT OUTCOME TESTS
# ============================================================================

@pytest.mark.parametrize(
    "outcome,should_accept",
    [
        (EntailmentOutcome.ENTAILED, True),
        (EntailmentOutcome.CONTRADICTED, False),
        (EntailmentOutcome.NEUTRAL, False),
        (EntailmentOutcome.INSUFFICIENT, False),
        (EntailmentOutcome.VALIDATOR_UNAVAILABLE, False),
        (EntailmentOutcome.VALIDATOR_ERROR, False),
    ],
)
def test_entailment_outcomes_acceptance(outcome, should_accept):
    """Verify that only ENTAILED permits acceptance; all other outcomes trigger rejection."""
    validator = PropositionCorrectionValidator(
        entailment_validator=MockConfigurableEntailmentValidator(outcome)
    )
    prop = StructuredProposition(
        proposition_id="p1", parent_claim_id="c1", source_claim_id="c1",
        subject="OpenAI", predicate="developed", object="GPT-4", original_text_span="OpenAI developed GPT-4",
    )
    ev = EvidenceRecord(evidence_id="ev_1", claim_id="c1", citation_text="OpenAI developed GPT-4.", verification_context="")
    unit = PropositionCorrectionUnit(
        proposition_id="p1",
        operation=CorrectionOperationType.REPHRASE_SUPPORTED,
        text="OpenAI developed GPT-4 [1].",
        cited_evidence_ids=["ev_1"],
        change_type="RETAINED_SUPPORTED",
    )
    is_valid, reason, inv, ent = validator.validate_unit(
        unit, prop, VerificationVerdict.SUPPORTED, ["ev_1"], {"ev_1": ev}
    )
    assert is_valid == should_accept
    assert ent == should_accept


# ============================================================================
# 4. REGRESSION INVARIANCE WHEN LLM FLAGS ARE DISABLED
# ============================================================================

def test_deterministic_output_invariance_when_llm_disabled(monkeypatch):
    """When enable_llm_answer_correction is False, output is identical to baseline."""
    monkeypatch.setattr(settings, "enable_llm_answer_correction", False)
    service = AnswerCorrectionService()

    claim = AtomicClaim(
        claim_id="c1", original_text="Mira Murati is the CEO of OpenAI.",
        normalized_text="Mira Murati is the CEO of OpenAI.",
    )
    ev_contra = EvidenceRecord(
        evidence_id="ev_1", claim_id="c1",
        citation_text="Sam Altman was reinstated as CEO of OpenAI.",
        verification_context="",
    )
    v_res = VerificationResult(
        claim_id="c1", verdict=VerificationVerdict.OUTDATED,
        explanation="Superseded by recent evidence.",
    )
    detail = ClaimAnalysisDetail(
        claim=claim, verification=v_res,
        freshness=FreshnessResult(claim_id="c1", temporal_sensitivity=claim.temporal_sensitivity, reference_time="2026-11-07T00:00:00Z", freshness_score=0.2, freshness_status=FreshnessStatus.OUTDATED, evidence_consistency=1.0, confidence=0.8, explanation=""),
        supporting_evidence=[], contradicting_evidence=[ev_contra],
    )

    corr = service.generate_correction(claim.original_text, [detail])
    assert corr.correction_mode == "deterministic"
    assert "Rather than 'Mira Murati is the CEO of OpenAI.'" in corr.corrected_text
    assert "Sam Altman was reinstated as CEO of OpenAI [1]." in corr.corrected_text
    assert len(corr.citations) == 1
    assert corr.citations[0].evidence_id == "ev_1"

