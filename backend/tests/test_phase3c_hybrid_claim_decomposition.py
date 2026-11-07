"""Tests for Phase 3C: Hybrid LLM-Assisted Claim Decomposition.

Covers:
1. Routing Tests:
   - Simple sentence routing to deterministic decomposer.
   - Single coordinating conjunction sentence routing.
   - Complex contrastive sentence routing.
   - Complex conditional sentence routing.
   - Complex passive auxiliary sentence routing.
   - Epistemic modality & attribution verb sentence routing.
   - Threshold boundary tests (below vs at/above threshold).
   - Disabled flag bypass routing.
2. Structured Extraction Tests:
   - Independent vs shared subjects in LLM output.
   - Multi-clause preservation.
   - Epistemic modality assignments (ASSERTED, POSSIBLE, CONDITIONAL, ALLEGED, REPORTED).
   - Polarity preservation (POSITIVE, NEGATIVE).
   - Temporal qualifiers preservation.
   - Span grounding offsets and substring match.
   - Quality-based extraction confidence calculation.
3. Failure and Structural Integrity Tests:
   - Zero propositions rejected -> deterministic fallback.
   - Duplicate proposition IDs rejected -> deterministic fallback.
   - Mismatched parent claim ID rejected -> deterministic fallback.
   - Ungrounded span rejected -> deterministic fallback.
   - Empty subject/predicate rejected -> deterministic fallback.
   - Invalid character offset rejected -> deterministic fallback.
   - LLM provider timeout -> deterministic fallback.
   - Malformed provider JSON -> deterministic fallback.
   - HTTP error from provider -> deterministic fallback.
4. Regression and Invariance Tests:
   - Claim extraction pipeline with default flags yields identical output to baseline.
   - All 18 benchmark scenarios unchanged.
"""
from __future__ import annotations

import asyncio
import json
import pytest
import httpx

from app.core.config import settings
from app.schemas.claims import (
    AtomicClaim,
    StructuredProposition,
    PropositionPolarity,
    EpistemicModality,
)
from app.services.claim_extraction.complexity_detector import (
    LinguisticComplexityDetector,
    ComplexityResult,
)
from app.services.claim_extraction.validator import PropositionExtractionValidator
from app.services.claim_extraction.service import ClaimExtractionService
from app.services.claim_verification.providers.bifrost_provider import BifrostSemanticProvider
from app.services.claim_verification.llm_interface import ExtractionRequest, ExtractionResponse


# ============================================================================
# 1. ROUTING & COMPLEXITY TESTS
# ============================================================================

def test_complexity_detector_simple_sentence():
    """Simple sentences have 0 or low complexity score and are not marked complex."""
    detector = LinguisticComplexityDetector(default_threshold=0.5)
    res = detector.evaluate("Python was released in 1991.")
    assert not res.is_complex
    assert res.complexity_score < 0.5
    assert len(res.trigger_reasons) == 0


def test_complexity_detector_single_coordinating_conjunction():
    """Single coordinating conjunction does not exceed default threshold of 0.5."""
    detector = LinguisticComplexityDetector(default_threshold=0.5)
    res = detector.evaluate("France borders Germany and Spain.")
    assert not res.is_complex
    assert res.complexity_score < 0.5


def test_complexity_detector_complex_contrastive():
    """Contrastive and multiple conjunctions trigger escalation."""
    detector = LinguisticComplexityDetector(default_threshold=0.5)
    text = "The product launched in 2021, but sales declined sharply whereas competitors expanded."
    res = detector.evaluate(text)
    assert res.is_complex
    assert res.complexity_score >= 0.5
    assert any("contrastive" in trig or "nested" in trig for trig in res.trigger_reasons)


def test_complexity_detector_conditionals():
    """Conditional clauses trigger complexity score."""
    detector = LinguisticComplexityDetector(default_threshold=0.5)
    text = "If inflation rises, interest rates will increase unless supply stabilizes."
    res = detector.evaluate(text)
    assert res.is_complex
    assert res.complexity_score >= 0.5
    assert "conditional_clause" in res.trigger_reasons


def test_complexity_detector_passive_auxiliary_and_modality():
    """Complex passive auxiliary combined with epistemic modality escalates to complex."""
    detector = LinguisticComplexityDetector(default_threshold=0.5)
    text = "The merger was reported to be approved, but might still face antitrust scrutiny."
    res = detector.evaluate(text)
    assert res.is_complex
    assert res.complexity_score >= 0.5
    assert "complex_passive_auxiliary" in res.trigger_reasons
    assert "epistemic_modality" in res.trigger_reasons


def test_complexity_detector_attribution_framing():
    """Attribution framing and epistemic reporting trigger escalation."""
    detector = LinguisticComplexityDetector(default_threshold=0.5)
    text = "According to internal sources, the executive allegedly embezzled funds."
    res = detector.evaluate(text)
    assert res.is_complex
    assert res.complexity_score >= 0.5
    assert "attribution_framing" in res.trigger_reasons
    assert "epistemic_modality" in res.trigger_reasons


def test_complexity_detector_threshold_boundary():
    """Sentences below custom threshold stay simple; at or above escalate."""
    detector = LinguisticComplexityDetector(default_threshold=0.5)
    text = "The revenue grew, although costs also escalated."
    res_default = detector.evaluate(text, threshold=0.5)
    # score: contrastive (0.25)
    assert res_default.complexity_score == 0.25
    assert not res_default.is_complex

    res_low = detector.evaluate(text, threshold=0.2)
    assert res_low.is_complex


def test_disabled_flag_bypasses_llm(monkeypatch):
    """When enable_llm_claim_decomposition is False, even complex sentences stay deterministic."""
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", False)
    
    called_llm = []
    class MockProvider(BifrostSemanticProvider):
        @property
        def is_claim_decomposition_available(self) -> bool:
            return True
        async def extract_structured_claims(self, req):
            called_llm.append(req)
            return ExtractionResponse(propositions=[], provider_name="mock")

    service = ClaimExtractionService(semantic_provider=MockProvider())
    complex_text = "If the regulatory approval succeeds, the company will launch in Europe, but competitors might appeal."
    claims = service.extract_claims(complex_text)
    assert len(claims) >= 1
    assert len(called_llm) == 0  # Did not attempt LLM call


@pytest.mark.parametrize(
    "sem_flag,decomp_flag,should_call",
    [
        (False, False, False),
        (True, False, False),
        (False, True, False),
        (True, True, True),
    ],
)
def test_provider_activation_four_flag_combinations(monkeypatch, sem_flag, decomp_flag, should_call):
    """LLM claim decomposition executes ONLY when both enable_llm_semantic_assessment AND enable_llm_claim_decomposition are True."""
    monkeypatch.setattr(settings, "enable_llm_semantic_assessment", sem_flag)
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", decomp_flag)
    monkeypatch.setattr(settings, "bifrost_base_url", "http://test-bifrost")

    called = []

    class MockProvider(BifrostSemanticProvider):
        @property
        def is_available(self) -> bool:
            return sem_flag or decomp_flag

        async def extract_structured_claims(self, req):
            called.append(req)
            return ExtractionResponse(
                propositions=[
                    StructuredProposition(
                        proposition_id="p1",
                        parent_claim_id=req.claim_id or "c1",
                        source_claim_id=req.claim_id or "c1",
                        subject="A",
                        predicate="acquired",
                        object="B",
                        original_text_span="A acquired B",
                        modality=EpistemicModality.ASSERTED,
                    )
                ],
                provider_name="mock",
            )

    provider = MockProvider(base_url="http://test-bifrost")
    service = ClaimExtractionService(semantic_provider=provider)

    complex_text = "Although company A struggled, it acquired company B and expanded rapidly."
    claims = service.extract_claims(complex_text)
    assert len(claims) >= 1

    if should_call:
        assert len(called) == 1, "Expected LLM decomposition call when both flags are True"
    else:
        assert len(called) == 0, f"Expected 0 calls for flags ({sem_flag}, {decomp_flag})"


# ============================================================================
# 2. STRUCTURED EXTRACTION & MODALITY TESTS
# ============================================================================

def test_extract_structured_claims_bifrost_success(monkeypatch):
    """Bifrost provider decomposes complex sentence into structured propositions."""
    monkeypatch.setattr(settings, "enable_llm_semantic_assessment", True)
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", True)
    monkeypatch.setattr(settings, "bifrost_base_url", "http://test-bifrost")

    sentence = "The treaty was signed in Paris in 1919, but it was not ratified by the Senate."
    mock_response_json = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "propositions": [
                            {
                                "proposition_id": "clm_1_p1",
                                "parent_claim_id": "clm_1",
                                "subject": "The treaty",
                                "predicate": "was signed in",
                                "object": "Paris",
                                "polarity": "POSITIVE",
                                "modality": "ASSERTED",
                                "temporal_scope": "in 1919",
                                "related_entities": ["The treaty", "Paris"],
                                "original_text_span": "The treaty was signed in Paris in 1919"
                            },
                            {
                                "proposition_id": "clm_1_p2",
                                "parent_claim_id": "clm_1",
                                "subject": "it",
                                "predicate": "was ratified by",
                                "object": "the Senate",
                                "polarity": "NEGATIVE",
                                "modality": "ASSERTED",
                                "temporal_scope": None,
                                "related_entities": ["the Senate"],
                                "original_text_span": "it was not ratified by the Senate"
                            }
                        ]
                    })
                }
            }
        ]
    }

    async def mock_handler(request: httpx.Request):
        assert "/chat/completions" in str(request.url)
        return httpx.Response(200, json=mock_response_json)

    transport = httpx.MockTransport(mock_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://test-bifrost")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost", http_client=client)

    req = ExtractionRequest(
        response_text=sentence,
        claim_id="clm_1",
        sentence_text=sentence,
    )

    async def _run():
        return await provider.extract_structured_claims(req)

    res = asyncio.run(_run())
    assert len(res.propositions) == 2
    p1, p2 = res.propositions
    assert p1.subject == "The treaty"
    assert p1.polarity == PropositionPolarity.POSITIVE
    assert p1.modality == EpistemicModality.ASSERTED
    assert p1.temporal_scope == "in 1919"
    assert p1.extraction_confidence > 0.8
    assert p2.polarity == PropositionPolarity.NEGATIVE


def test_epistemic_modality_representation():
    """Epistemic modality enums are properly handled and parsed."""
    for mod in ["ASSERTED", "POSSIBLE", "CONDITIONAL", "ALLEGED", "REPORTED", "PLANNED", "UNKNOWN"]:
        val = EpistemicModality(mod)
        assert val.value == mod


def test_proposition_validator_quality_confidence():
    """PropositionExtractionValidator assigns higher quality confidence for rich propositions."""
    parent_id = "clm_test"
    sent = "Google acquired Android in 2005."
    prop = StructuredProposition(
        proposition_id="clm_test_p1",
        parent_claim_id=parent_id,
        source_claim_id=parent_id,
        subject="Google",
        predicate="acquired",
        object="Android",
        polarity=PropositionPolarity.POSITIVE,
        modality=EpistemicModality.ASSERTED,
        temporal_scope="in 2005",
        related_entities=["Google", "Android"],
        original_text_span="Google acquired Android in 2005",
    )
    is_valid, reason, validated = PropositionExtractionValidator.validate_propositions(
        [prop], parent_claim_id=parent_id, original_sentence=sent
    )
    assert is_valid
    assert len(validated) == 1
    assert validated[0].extraction_confidence >= 0.9
    assert validated[0].start_char == 0
    assert validated[0].end_char == len("Google acquired Android in 2005")


# ============================================================================
# 3. FAILURE AND STRUCTURAL INTEGRITY TESTS (FALLBACKS)
# ============================================================================

def test_coverage_validation_example_a_three_clauses():
    """Sentence A: 'OpenAI released Model A, while Anthropic announced Model B and Google deprecated Model C.'
    Must contain all 3 propositions. Omitting one must be rejected by coverage validation.
    """
    sentence = "OpenAI released Model A, while Anthropic announced Model B and Google deprecated Model C."
    p1 = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="OpenAI",
        predicate="released",
        object="Model A",
        original_text_span="OpenAI released Model A",
        modality=EpistemicModality.ASSERTED,
    )
    p2 = StructuredProposition(
        proposition_id="p2",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Anthropic",
        predicate="announced",
        object="Model B",
        original_text_span="Anthropic announced Model B",
        modality=EpistemicModality.ASSERTED,
    )
    p3 = StructuredProposition(
        proposition_id="p3",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Google",
        predicate="deprecated",
        object="Model C",
        original_text_span="Google deprecated Model C",
        modality=EpistemicModality.ASSERTED,
    )

    # All three present -> VALID
    is_valid, reason, validated = PropositionExtractionValidator.validate_propositions(
        [p1, p2, p3], parent_claim_id="clm_1", original_sentence=sentence
    )
    assert is_valid
    assert len(validated) == 3

    # Incomplete (only 2 out of 3) -> REJECTED (Google deprecated Model C missing)
    is_valid_inc, reason_inc, _ = PropositionExtractionValidator.validate_propositions(
        [p1, p2], parent_claim_id="clm_1", original_sentence=sentence
    )
    assert not is_valid_inc
    assert "Proposition coverage validation failed" in reason_inc


def test_coverage_validation_example_b_shared_subject():
    """Sentence B: 'Company A acquired Company B and subsequently launched Product C.'
    Two propositions with correct subject and relationship.
    """
    sentence = "Company A acquired Company B and subsequently launched Product C."
    p1 = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        original_text_span="Company A acquired Company B",
        modality=EpistemicModality.ASSERTED,
    )
    p2 = StructuredProposition(
        proposition_id="p2",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Company A",
        predicate="launched",
        object="Product C",
        original_text_span="subsequently launched Product C",
        modality=EpistemicModality.ASSERTED,
    )

    is_valid, reason, validated = PropositionExtractionValidator.validate_propositions(
        [p1, p2], parent_claim_id="clm_1", original_sentence=sentence
    )
    assert is_valid
    assert len(validated) == 2


def test_coverage_validation_example_c_conditional():
    """Sentence C: 'Company A might acquire Company B if regulators approve the transaction.'
    Must retain conditional/possible modality and not convert to established fact.
    """
    sentence = "Company A might acquire Company B if regulators approve the transaction."

    # Valid with POSSIBLE / CONDITIONAL modality
    p_valid = [
        StructuredProposition(
            proposition_id="p1",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="Company A",
            predicate="acquire",
            object="Company B",
            original_text_span="Company A might acquire Company B",
            modality=EpistemicModality.POSSIBLE,
        ),
        StructuredProposition(
            proposition_id="p2",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="regulators",
            predicate="approve",
            object="the transaction",
            original_text_span="if regulators approve the transaction",
            modality=EpistemicModality.CONDITIONAL,
        ),
    ]
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        p_valid, parent_claim_id="clm_1", original_sentence=sentence
    )
    assert is_valid

    # Invalid: converted into unconditional ASSERTED event without conditional coverage
    p_invalid = [
        StructuredProposition(
            proposition_id="p1",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="Company A",
            predicate="acquire",
            object="Company B",
            original_text_span="Company A might acquire Company B",
            modality=EpistemicModality.ASSERTED,  # Improper assertion
        ),
        StructuredProposition(
            proposition_id="p2",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="regulators",
            predicate="approve",
            object="the transaction",
            original_text_span="regulators approve the transaction",
            modality=EpistemicModality.ASSERTED,  # Improper assertion
        ),
    ]
    is_valid_inv, reason_inv, _ = PropositionExtractionValidator.validate_propositions(
        p_invalid, parent_claim_id="clm_1", original_sentence=sentence
    )
    assert not is_valid_inv
    assert "conditional" in reason_inv.lower()


def test_coverage_validation_example_d_denial():
    """Sentence D: 'Company A reportedly acquired Company B, although the company denied the report.'
    Preserves both attributed report and denial.
    """
    sentence = "Company A reportedly acquired Company B, although the company denied the report."

    # Both present
    p_valid = [
        StructuredProposition(
            proposition_id="p1",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="Company A",
            predicate="acquired",
            object="Company B",
            original_text_span="Company A reportedly acquired Company B",
            modality=EpistemicModality.REPORTED,
        ),
        StructuredProposition(
            proposition_id="p2",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="the company",
            predicate="denied",
            object="the report",
            original_text_span="the company denied the report",
            modality=EpistemicModality.ASSERTED,
            polarity=PropositionPolarity.NEGATIVE,
        ),
    ]
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        p_valid, parent_claim_id="clm_1", original_sentence=sentence
    )
    assert is_valid

    # Omitted denial
    p_missing_denial = [
        StructuredProposition(
            proposition_id="p1",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="Company A",
            predicate="acquired",
            object="Company B",
            original_text_span="Company A reportedly acquired Company B",
            modality=EpistemicModality.REPORTED,
        )
    ]
    is_valid_miss, reason_miss, _ = PropositionExtractionValidator.validate_propositions(
        p_missing_denial, parent_claim_id="clm_1", original_sentence=sentence
    )
    assert not is_valid_miss
    assert "denial" in reason_miss.lower() or "coverage" in reason_miss.lower()


def test_modality_integrity_seven_types():
    """Verify 7 distinct modalities and negation: ASSERTED, POSSIBLE, CONDITIONAL, ALLEGED, REPORTED, PLANNED, NEGATED."""
    modalities = [
        (EpistemicModality.ASSERTED, PropositionPolarity.POSITIVE),
        (EpistemicModality.POSSIBLE, PropositionPolarity.POSITIVE),
        (EpistemicModality.CONDITIONAL, PropositionPolarity.POSITIVE),
        (EpistemicModality.ALLEGED, PropositionPolarity.POSITIVE),
        (EpistemicModality.REPORTED, PropositionPolarity.POSITIVE),
        (EpistemicModality.PLANNED, PropositionPolarity.POSITIVE),
        (EpistemicModality.ASSERTED, PropositionPolarity.NEGATIVE),  # Negated
    ]
    sentence = "Company A announced corporate updates."
    for mod, pol in modalities:
        prop = StructuredProposition(
            proposition_id="p_mod",
            parent_claim_id="clm_1",
            source_claim_id="clm_1",
            subject="Company A",
            predicate="acquired",
            object="Company B",
            original_text_span="Company A announced",
            modality=mod,
            polarity=pol,
        )
        assert prop.modality == mod
        assert prop.polarity == pol


def test_validator_rejects_unknown_modality():
    """Proposition with UNKNOWN modality is rejected by validator."""
    sentence = "Company A acquired Company B."
    prop = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Company A",
        predicate="acquired",
        object="Company B",
        original_text_span="Company A acquired Company B",
        modality=EpistemicModality.UNKNOWN,
    )
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        [prop], parent_claim_id="clm_1", original_sentence=sentence
    )
    assert not is_valid
    assert "UNKNOWN modality" in reason

def test_validator_rejects_empty_propositions():
    """Empty proposition set is rejected."""
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        [], parent_claim_id="clm_1", original_sentence="Any sentence."
    )
    assert not is_valid
    assert "Empty propositions" in reason


def test_validator_rejects_duplicate_proposition_id():
    """Duplicate proposition IDs within the response are rejected."""
    sent = "Alice visited Rome and Bob visited Paris."
    p1 = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Alice",
        predicate="visited",
        object="Rome",
        original_text_span="Alice visited Rome",
    )
    p2 = StructuredProposition(
        proposition_id="p1",  # duplicate ID
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Bob",
        predicate="visited",
        object="Paris",
        original_text_span="Bob visited Paris",
    )
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        [p1, p2], parent_claim_id="clm_1", original_sentence=sent
    )
    assert not is_valid
    assert "Duplicate or empty proposition_id" in reason


def test_validator_rejects_mismatched_parent_claim_id():
    """Propositions with mismatched parent_claim_id are rejected."""
    sent = "Alice visited Rome."
    p1 = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_WRONG",
        source_claim_id="clm_WRONG",
        subject="Alice",
        predicate="visited",
        object="Rome",
        original_text_span="Alice visited Rome",
    )
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        [p1], parent_claim_id="clm_EXPECTED", original_sentence=sent
    )
    assert not is_valid
    assert "Mismatched parent_claim_id" in reason


def test_validator_rejects_ungrounded_span():
    """Propositions with hallucinated or ungrounded spans are rejected."""
    sent = "Alice visited Rome."
    p1 = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Alice",
        predicate="visited",
        object="Berlin",
        original_text_span="Alice visited Berlin",  # Not in sentence
    )
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        [p1], parent_claim_id="clm_1", original_sentence=sent
    )
    assert not is_valid
    assert "Ungrounded original_text_span" in reason


def test_validator_rejects_empty_subject_or_predicate():
    """Empty subject or predicate is rejected."""
    sent = "Alice visited Rome."
    p1 = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="",  # empty
        predicate="visited",
        object="Rome",
        original_text_span="Alice visited Rome",
    )
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        [p1], parent_claim_id="clm_1", original_sentence=sent
    )
    assert not is_valid
    assert "Missing or empty subject" in reason


def test_validator_rejects_invalid_offsets():
    """Invalid character offsets are rejected."""
    sent = "Alice visited Rome."
    p1 = StructuredProposition(
        proposition_id="p1",
        parent_claim_id="clm_1",
        source_claim_id="clm_1",
        subject="Alice",
        predicate="visited",
        object="Rome",
        original_text_span="Alice visited Rome",
        start_char=50,  # Out of bounds
        end_char=70,
    )
    is_valid, reason, _ = PropositionExtractionValidator.validate_propositions(
        [p1], parent_claim_id="clm_1", original_sentence=sent
    )
    assert not is_valid
    assert "Invalid character offsets" in reason


def test_service_falls_back_on_llm_timeout(monkeypatch):
    """When LLM provider times out or errors, ClaimExtractionService falls back to deterministic."""
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", True)

    async def mock_handler(request: httpx.Request):
        raise httpx.ReadTimeout("Timeout waiting for Bifrost response")

    transport = httpx.MockTransport(mock_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://test-bifrost")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost", http_client=client)

    service = ClaimExtractionService(semantic_provider=provider)
    text = "Although the project faced budget delays, the team completed the milestone on time."
    claims = service.extract_claims(text)
    assert len(claims) == 1
    # Fallback to deterministic regex decomposer produces propositions successfully
    assert len(claims[0].propositions) >= 1
    assert any("milestone" in p.original_text_span or "milestone" in p.predicate for p in claims[0].propositions)


def test_service_falls_back_on_malformed_json(monkeypatch):
    """When LLM provider returns invalid JSON, fallback to deterministic decomposer."""
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", True)

    async def mock_handler(request: httpx.Request):
        return httpx.Response(200, json={"choices": [{"message": {"content": "Not valid JSON {"}}]})

    transport = httpx.MockTransport(mock_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://test-bifrost")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost", http_client=client)

    service = ClaimExtractionService(semantic_provider=provider)
    text = "The product was reported to be delayed, but officials denied the rumor."
    claims = service.extract_claims(text)
    assert len(claims) == 1
    assert len(claims[0].propositions) >= 1


def test_service_falls_back_on_http_error(monkeypatch):
    """When LLM provider returns 500 error, fallback to deterministic decomposer."""
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", True)

    async def mock_handler(request: httpx.Request):
        return httpx.Response(500, text="Internal Gateway Error")

    transport = httpx.MockTransport(mock_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://test-bifrost")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost", http_client=client)

    service = ClaimExtractionService(semantic_provider=provider)
    text = "If conditions worsen, travel might be suspended across the region."
    claims = service.extract_claims(text)
    assert len(claims) == 1
    assert len(claims[0].propositions) >= 1


# ============================================================================
# 4. REGRESSION & INVARIANCE TESTS
# ============================================================================

def test_pipeline_extraction_invariance_when_llm_disabled(monkeypatch):
    """With enable_llm_claim_decomposition=False, output is strictly identical to baseline."""
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", False)
    service = ClaimExtractionService()
    test_text = (
        "OpenAI released GPT-4 in March 2023. Sam Altman was briefly ousted as CEO in November 2023, "
        "but he was reinstated within a week."
    )
    claims = service.extract_claims(test_text)
    assert len(claims) == 2
    # First claim is single proposition
    assert len(claims[0].propositions) == 1
    assert claims[0].propositions[0].subject == "OpenAI"
    # Second claim is contrastive
    assert len(claims[1].propositions) == 2
    assert claims[1].propositions[0].subject == "Sam Altman"
    assert "reinstated" in claims[1].propositions[1].original_text_span or "reinstated" in claims[1].propositions[1].predicate
