"""Comprehensive regression suite for mixed-proposition decomposition, possessive noun phrases,
contrastive/subordinating conjunctions, negative controls, and verdict aggregation.

Regression targets:
- "OpenAI is based in San Francisco, and its interim CEO is Mira Murati."
- Possessive specifiers ("its", "their", "his", "her", "the", etc.)
- Strict negative controls preserving compound subjects and compound objects
- Parent verdict aggregation truth table for mixed-outcome propositions
"""
import pytest
from app.services.claim_extraction.proposition_decomposer import PropositionDecompositionService
from app.services.claim_extraction.validator import PropositionExtractionValidator
from app.services.claim_verification.service import ClaimVerificationService
from app.schemas.claims import PropositionPolarity, StructuredProposition
from app.schemas.verification import (
    PropositionVerificationResult,
    VerificationVerdict,
)


@pytest.fixture
def decomposer() -> PropositionDecompositionService:
    return PropositionDecompositionService()


@pytest.fixture
def verification_service() -> ClaimVerificationService:
    return ClaimVerificationService()


def test_original_mixed_sentence_decomposition(decomposer: PropositionDecompositionService):
    """Verify that 'OpenAI is based in San Francisco, and its interim CEO is Mira Murati.'
    decomposes into exactly 2 verifiable propositions, with verbatim spans passing coverage validation.
    """
    sentence = "OpenAI is based in San Francisco, and its interim CEO is Mira Murati."
    props = decomposer.decompose_claim(
        parent_claim_id="claim_mixed_orig",
        text=sentence,
        inherited_entity="OpenAI",
    )

    assert len(props) == 2, f"Expected 2 propositions, got {len(props)}"

    p1, p2 = props[0], props[1]

    # First proposition assertions
    assert p1.subject == "OpenAI"
    assert "based in San Francisco" in p1.object or "San Francisco" in p1.object
    assert p1.polarity == PropositionPolarity.POSITIVE
    assert p1.original_text_span in sentence

    # Second proposition assertions
    assert p2.subject == "its interim CEO"
    assert "is" in p2.predicate
    assert "Mira Murati" in p2.object
    assert p2.polarity == PropositionPolarity.POSITIVE
    assert p2.original_text_span in sentence

    # Validate proposition coverage using PropositionExtractionValidator
    is_valid, reason, validated = PropositionExtractionValidator.validate_propositions(
        props, "claim_mixed_orig", sentence
    )
    assert is_valid is True, f"Validation failed: {reason}"
    assert len(validated) == 2


@pytest.mark.parametrize(
    "sentence,expected_subj1,expected_subj2,expected_p2_obj",
    [
        (
            "Microsoft is located in Redmond, and their CEO is Satya Nadella.",
            "Microsoft",
            "their CEO",
            "Satya Nadella",
        ),
        (
            "Apple is headquartered in Cupertino, and its revenue is growing.",
            "Apple",
            "its revenue",
            "growing",
        ),
        (
            "DeepMind is based in London, and the director is Demis Hassabis.",
            "DeepMind",
            "the director",
            "Demis Hassabis",
        ),
        (
            "Google operates Android, and this platform is widely used.",
            "Google",
            "this platform",
            "widely used",
        ),
        (
            "Tesla is based in Austin, and his role was executive leader.",
            "Tesla",
            "his role",
            "executive leader",
        ),
    ],
)
def test_possessive_and_determiner_variations(
    decomposer: PropositionDecompositionService,
    sentence: str,
    expected_subj1: str,
    expected_subj2: str,
    expected_p2_obj: str,
):
    """Verify coordinate decomposition across various possessive and determiner noun phrases."""
    props = decomposer.decompose_claim(
        parent_claim_id="claim_possessive",
        text=sentence,
        inherited_entity=expected_subj1,
    )
    assert len(props) == 2, f"Failed to decompose into 2 propositions: {sentence}"
    assert props[0].subject == expected_subj1
    assert props[1].subject == expected_subj2
    assert expected_p2_obj in props[1].object

    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        props, "claim_possessive", sentence
    )
    assert is_valid is True, f"Validator rejected spans: {reason}"


@pytest.mark.parametrize(
    "sentence,expected_prop_count,expected_second_subj",
    [
        (
            "OpenAI is based in San Francisco, while its CEO is Sam Altman.",
            2,
            "its CEO",
        ),
        (
            "OpenAI was founded in 2015, but its CEO changed in 2023.",
            2,
            "its CEO",
        ),
        (
            "Anthropic was formed by ex-OpenAI staff, whereas its competitor remains OpenAI.",
            2,
            "its competitor",
        ),
    ],
)
def test_contrastive_and_subordinating_conjunctions(
    decomposer: PropositionDecompositionService,
    sentence: str,
    expected_prop_count: int,
    expected_second_subj: str,
):
    """Verify contrastive and subordinating conjunctions decompose properly."""
    props = decomposer.decompose_claim(
        parent_claim_id="claim_contrast",
        text=sentence,
        inherited_entity="OpenAI",
    )
    assert len(props) == expected_prop_count
    assert props[1].subject == expected_second_subj

    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        props, "claim_contrast", sentence
    )
    assert is_valid is True, f"Validator rejected spans: {reason}"


def test_temporal_and_negation_in_coordinate_clauses(decomposer: PropositionDecompositionService):
    """Verify temporal scope and negation in coordinated clauses."""
    # Negation in second clause
    neg_sentence = "OpenAI is based in San Francisco, and its CEO is not Mira Murati."
    props_neg = decomposer.decompose_claim("c_neg", neg_sentence, "OpenAI")
    assert len(props_neg) == 2
    assert props_neg[0].polarity == PropositionPolarity.POSITIVE
    assert props_neg[1].polarity == PropositionPolarity.NEGATIVE

    # Temporal indicator in first clause
    temp_sentence = "OpenAI was founded in 2015, and its current CEO is Sam Altman."
    props_temp = decomposer.decompose_claim("c_temp", temp_sentence, "OpenAI")
    assert len(props_temp) == 2
    assert props_temp[0].temporal_scope is not None
    assert "2015" in props_temp[0].temporal_scope


@pytest.mark.parametrize(
    "negative_control_sentence",
    [
        "OpenAI and Microsoft are technology companies.",
        "Larry Page and Sergey Brin founded Google.",
        "OpenAI provides ChatGPT and API services.",
        "France and Germany signed the bilateral treaty.",
    ],
)
def test_negative_controls_prevent_false_splitting(
    decomposer: PropositionDecompositionService,
    negative_control_sentence: str,
):
    """Compound subjects (OpenAI and Microsoft...) and compound objects (ChatGPT and API...)
    must NOT be erroneously split into false independent subject clauses.
    """
    props = decomposer.decompose_claim(
        parent_claim_id="claim_ctrl",
        text=negative_control_sentence,
        inherited_entity="Entity",
    )
    assert len(props) == 1, (
        f"Expected 1 proposition for compound control '{negative_control_sentence}', "
        f"got {len(props)}: {[p.original_text_span for p in props]}"
    )


def test_mixed_proposition_verdict_aggregation(verification_service: ClaimVerificationService):
    """Verify that when Prop 1 is SUPPORTED and Prop 2 is OUTDATED,
    the parent claim verdict aggregates to PARTIALLY_SUPPORTED.
    """
    p1 = StructuredProposition(
        proposition_id="prop_sf_01",
        parent_claim_id="claim_sf_ceo",
        source_claim_id="claim_sf_ceo",
        subject="OpenAI",
        predicate="is",
        object="based in San Francisco",
        polarity=PropositionPolarity.POSITIVE,
        original_text_span="OpenAI is based in San Francisco",
    )
    p2 = StructuredProposition(
        proposition_id="prop_ceo_02",
        parent_claim_id="claim_sf_ceo",
        source_claim_id="claim_sf_ceo",
        subject="its interim CEO",
        predicate="is",
        object="Mira Murati",
        polarity=PropositionPolarity.POSITIVE,
        original_text_span="its interim CEO is Mira Murati",
    )

    # Mock proposition verification results
    res1 = PropositionVerificationResult(
        proposition_id=p1.proposition_id,
        parent_claim_id="claim_sf_ceo",
        verdict=VerificationVerdict.SUPPORTED,
        confidence=0.96,
        explanation="Evidence confirms OpenAI headquarters in San Francisco.",
        evidence_ids=["ev_hq_01"],
    )
    res2 = PropositionVerificationResult(
        proposition_id=p2.proposition_id,
        parent_claim_id="claim_sf_ceo",
        verdict=VerificationVerdict.OUTDATED,
        confidence=0.94,
        explanation="Evidence indicates Mira Murati's interim CEO term concluded in Nov 2023.",
        evidence_ids=["ev_ceo_02"],
    )

    parent_verdict, explanation = verification_service.aggregate_proposition_verdicts([res1, res2])

    assert parent_verdict == VerificationVerdict.PARTIALLY_SUPPORTED
    assert "Partially supported: 1/2 propositions verified" in explanation
    assert "1 outdated" in explanation


@pytest.mark.parametrize(
    "prop1_verdict,prop2_verdict,expected_parent_verdict",
    [
        (VerificationVerdict.SUPPORTED, VerificationVerdict.SUPPORTED, VerificationVerdict.SUPPORTED),
        (VerificationVerdict.CONTRADICTED, VerificationVerdict.CONTRADICTED, VerificationVerdict.CONTRADICTED),
        (VerificationVerdict.INSUFFICIENT_EVIDENCE, VerificationVerdict.INSUFFICIENT_EVIDENCE, VerificationVerdict.INSUFFICIENT_EVIDENCE),
        (VerificationVerdict.SUPPORTED, VerificationVerdict.OUTDATED, VerificationVerdict.PARTIALLY_SUPPORTED),
        (VerificationVerdict.SUPPORTED, VerificationVerdict.CONTRADICTED, VerificationVerdict.PARTIALLY_SUPPORTED),
        (VerificationVerdict.SUPPORTED, VerificationVerdict.INSUFFICIENT_EVIDENCE, VerificationVerdict.PARTIALLY_SUPPORTED),
        (VerificationVerdict.CONTRADICTED, VerificationVerdict.INSUFFICIENT_EVIDENCE, VerificationVerdict.CONTRADICTED),
    ],
)
def test_parent_aggregation_truth_table_mixed(
    verification_service: ClaimVerificationService,
    prop1_verdict: VerificationVerdict,
    prop2_verdict: VerificationVerdict,
    expected_parent_verdict: VerificationVerdict,
):
    """Exhaustive check of parent aggregation truth table for 2-proposition scenarios."""
    res1 = PropositionVerificationResult(
        proposition_id="p1",
        parent_claim_id="parent_claim_test",
        verdict=prop1_verdict,
        confidence=0.9,
        explanation="",
        evidence_ids=[],
    )
    res2 = PropositionVerificationResult(
        proposition_id="p2",
        parent_claim_id="parent_claim_test",
        verdict=prop2_verdict,
        confidence=0.9,
        explanation="",
        evidence_ids=[],
    )

    parent_verdict, _ = verification_service.aggregate_proposition_verdicts([res1, res2])
    assert parent_verdict == expected_parent_verdict
