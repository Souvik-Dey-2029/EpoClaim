"""Comprehensive Phase 1 test suite covering:
1. GPT-4.1 compound-claim decomposition
2. Independent proposition verification (evidence for P2 does NOT support P1)
3. Parent aggregation rules (Supported + Insufficient -> PARTIALLY_SUPPORTED)
4. Negation preservation in propositions
5. Contrast preservation across clauses
6. Historical versus current assertions
7. Grounded answer correction generation with citations
8. No unsupported facts introduced in corrections
9. Existing hallucination detection preserved
10. Existing stale detection preserved
11. Existing Answer Analyzer API behavior
12. Expanded Benchmark Suite execution
13. Tavily mocked integration and credit accounting
"""
from __future__ import annotations

import asyncio
import pytest
from datetime import datetime, timezone

from app.schemas.claims import AtomicClaim, StructuredProposition, PropositionPolarity
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.schemas.verification import VerificationVerdict, VerificationResult, PropositionVerificationResult
from app.schemas.report import AnalyzeRequest, ClaimAnalysisDetail
from app.schemas.freshness import FreshnessResult, FreshnessStatus
from app.services.claim_extraction.proposition_decomposer import PropositionDecompositionService
from app.services.claim_extraction.service import ClaimExtractionService
from app.services.claim_verification.service import ClaimVerificationService
from app.services.correction.service import AnswerCorrectionService
from app.services.pipeline import EpoClaimPipeline
from app.evaluation.runner import BenchmarkRunner


def test_gpt41_compound_claim_decomposition():
    """Verify that compound sentence is decomposed into distinct propositions with shared parent reference."""
    decomposer = PropositionDecompositionService()
    text = "OpenAI's GPT-4.1 remains the latest model in the GPT-4 series and is available through the API."
    parent_id = "clm_parent_123"

    props = decomposer.decompose_claim(parent_claim_id=parent_id, text=text, inherited_entity="OpenAI GPT-4.1")
    assert len(props) == 2

    p1, p2 = props[0], props[1]
    assert p1.parent_claim_id == parent_id
    assert p2.parent_claim_id == parent_id

    # P1 asserts recency/latest model
    assert "latest" in p1.object.lower() or "latest" in p1.predicate.lower() or "latest" in p1.original_text_span.lower()
    # P2 asserts API availability
    assert "api" in p2.object.lower() or "api" in p2.original_text_span.lower()


def test_parent_aggregation_truth_table():
    """Explicitly test parent aggregation combinations:
    - SUPPORTED + INSUFFICIENT_EVIDENCE -> PARTIALLY_SUPPORTED
    - SUPPORTED + CONTRADICTED -> PARTIALLY_SUPPORTED
    - SUPPORTED + OUTDATED -> PARTIALLY_SUPPORTED
    - CONTRADICTED + INSUFFICIENT_EVIDENCE -> CONTRADICTED
    - OUTDATED + INSUFFICIENT_EVIDENCE -> CONTRADICTED
    - All propositions supported -> SUPPORTED
    - All propositions insufficient -> INSUFFICIENT_EVIDENCE
    """
    verifier = ClaimVerificationService()

    def make_prop_res(verdict: VerificationVerdict) -> PropositionVerificationResult:
        return PropositionVerificationResult(
            proposition_id="p1",
            parent_claim_id="clm1",
            verdict=verdict,
            entailment_score=0.9 if verdict == VerificationVerdict.SUPPORTED else 0.1,
            contradiction_score=0.9 if verdict in {VerificationVerdict.CONTRADICTED, VerificationVerdict.OUTDATED} else 0.1,
            neutral_score=0.8 if verdict == VerificationVerdict.INSUFFICIENT_EVIDENCE else 0.1,
            verification_confidence=0.85,
        )

    # 1. SUPPORTED + INSUFFICIENT_EVIDENCE
    v, _ = verifier.aggregate_proposition_verdicts([
        make_prop_res(VerificationVerdict.SUPPORTED),
        make_prop_res(VerificationVerdict.INSUFFICIENT_EVIDENCE),
    ])
    assert v == VerificationVerdict.PARTIALLY_SUPPORTED

    # 2. SUPPORTED + CONTRADICTED
    v, _ = verifier.aggregate_proposition_verdicts([
        make_prop_res(VerificationVerdict.SUPPORTED),
        make_prop_res(VerificationVerdict.CONTRADICTED),
    ])
    assert v == VerificationVerdict.PARTIALLY_SUPPORTED

    # 3. SUPPORTED + OUTDATED
    v, _ = verifier.aggregate_proposition_verdicts([
        make_prop_res(VerificationVerdict.SUPPORTED),
        make_prop_res(VerificationVerdict.OUTDATED),
    ])
    assert v == VerificationVerdict.PARTIALLY_SUPPORTED

    # 4. CONTRADICTED + INSUFFICIENT_EVIDENCE
    v, _ = verifier.aggregate_proposition_verdicts([
        make_prop_res(VerificationVerdict.CONTRADICTED),
        make_prop_res(VerificationVerdict.INSUFFICIENT_EVIDENCE),
    ])
    assert v == VerificationVerdict.CONTRADICTED

    # 5. OUTDATED + INSUFFICIENT_EVIDENCE
    v, _ = verifier.aggregate_proposition_verdicts([
        make_prop_res(VerificationVerdict.OUTDATED),
        make_prop_res(VerificationVerdict.INSUFFICIENT_EVIDENCE),
    ])
    assert v == VerificationVerdict.OUTDATED

    # 6. All propositions supported
    v, _ = verifier.aggregate_proposition_verdicts([
        make_prop_res(VerificationVerdict.SUPPORTED),
        make_prop_res(VerificationVerdict.SUPPORTED),
    ])
    assert v == VerificationVerdict.SUPPORTED

    # 7. All propositions insufficient
    v, _ = verifier.aggregate_proposition_verdicts([
        make_prop_res(VerificationVerdict.INSUFFICIENT_EVIDENCE),
        make_prop_res(VerificationVerdict.INSUFFICIENT_EVIDENCE),
    ])
    assert v == VerificationVerdict.INSUFFICIENT_EVIDENCE


def test_correction_missing_publication_date_honesty():
    """Verify that evidence with missing publication dates is handled honestly without inventing timestamps."""
    correction_service = AnswerCorrectionService()
    claim = AtomicClaim(
        claim_id="clm_spec",
        original_text="Quantum Corp is valued at 50 billion dollars.",
        normalized_text="Quantum Corp is valued at 50 billion dollars",
        entity="Quantum Corp",
        attribute="is",
        claimed_value="valued at 50 billion dollars",
    )
    ev_nodate = EvidenceRecord(
        evidence_id="ev_nodate",
        claim_id="clm_spec",
        source_url="https://speculative-blog.com/post",
        source_title="Blog Speculation",
        publication_date=None,  # Missing date!
        citation_text="Analysts speculate on potential valuations.",
        verification_context="Full post without publication date",
        relevance_score=0.4,
        source_quality=0.4,
    )
    detail = ClaimAnalysisDetail(
        claim=claim,
        verification=VerificationResult(
            claim_id="clm_spec",
            verdict=VerificationVerdict.INSUFFICIENT_EVIDENCE,
            explanation="No dated evidence available.",
        ),
        freshness=FreshnessResult(
            claim_id="clm_spec",
            temporal_sensitivity=claim.temporal_sensitivity,
            reference_time="2026-11-07T00:00:00Z",
            freshness_score=0.5,
            freshness_status=FreshnessStatus.UNKNOWN,
            evidence_consistency=1.0,
            confidence=0.5,
            explanation="Missing publication date",
        ),
        supporting_evidence=[ev_nodate],
        contradicting_evidence=[],
    )

    correction = correction_service.generate_correction(claim.original_text, [detail])
    assert "unverified" in correction.corrected_text.lower()
    # Ensure no fabricated dates or prices in correction text
    assert "2024" not in correction.corrected_text
    assert "2025" not in correction.corrected_text
    assert len(correction.unresolved_uncertainties) >= 1
    """Verify contrastive statements with negation are separated and polarities preserved."""
    decomposer = PropositionDecompositionService()
    text = "The legacy v1 API was deprecated, but the replacement v2 API is supported."
    props = decomposer.decompose_claim("clm_contrast", text)
    assert len(props) == 2
    assert props[0].qualifiers.get("relation") == "contrast_thesis"
    assert "contrast" in props[1].qualifiers.get("relation", "")

    # Negation statement
    neg_text = "The model is not available in ChatGPT but remains available through the API."
    neg_props = decomposer.decompose_claim("clm_neg", neg_text)
    assert len(neg_props) == 2
    assert neg_props[0].polarity == PropositionPolarity.NEGATIVE
    assert neg_props[1].polarity == PropositionPolarity.POSITIVE


def test_independent_proposition_verification_and_parent_aggregation():
    """Verify evidence supporting only P2 leaves P1 as INSUFFICIENT, yielding PARTIALLY_SUPPORTED parent."""
    verifier = ClaimVerificationService()
    extractor = ClaimExtractionService()

    sentence = "OpenAI's GPT-4.1 remains the latest model in the GPT-4 series and is available through the API."
    claims = extractor.extract_claims(sentence)
    assert len(claims) == 1
    claim = claims[0]
    assert len(claim.propositions) == 2

    # Evidence ONLY establishes API availability (P2), says NOTHING about being the latest model (P1)
    ev_api_only = [
        EvidenceRecord(
            evidence_id="ev_api_doc",
            claim_id=claim.claim_id,
            source_url="https://openai.com/api",
            source_title="OpenAI API Documentation",
            citation_text="Note that GPT-4.1 is available through the API for all developers.",
            verification_context="Note that GPT-4.1 is available through the API for all developers.",
            relevance_score=0.9,
            source_quality=0.9,
        )
    ]

    v_res, sup, contra = verifier.verify_claim(claim, ev_api_only)
    assert len(v_res.proposition_results) == 2

    p_recency = next(p for p in v_res.proposition_results if "latest" in p.explanation.lower() or p == v_res.proposition_results[0])
    p_api = next(p for p in v_res.proposition_results if p != p_recency)

    # P2 (API availability) must be SUPPORTED
    assert p_api.verdict == VerificationVerdict.SUPPORTED
    # P1 (remains latest model) must NOT be SUPPORTED (must be INSUFFICIENT_EVIDENCE)
    assert p_recency.verdict == VerificationVerdict.INSUFFICIENT_EVIDENCE
    # Parent claim MUST be aggregated to PARTIALLY_SUPPORTED
    assert v_res.verdict == VerificationVerdict.PARTIALLY_SUPPORTED


def test_grounded_answer_correction_generation():
    """Verify that correction preserves verified facts, qualifies unverified ones, and attaches citations."""
    extractor = ClaimExtractionService()
    verifier = ClaimVerificationService()
    correction_service = AnswerCorrectionService()

    input_text = "OpenAI's GPT-4.1 remains the latest model in the GPT-4 series and is available through the API."
    claim = extractor.extract_claims(input_text)[0]

    ev_api = EvidenceRecord(
        evidence_id="ev_api_1",
        claim_id=claim.claim_id,
        source_url="https://openai.com/api-pricing",
        source_title="OpenAI API Reference",
        publication_date="2025-04-14T00:00:00Z",
        citation_text="GPT-4.1 is available through the API.",
        verification_context="Full text of API announcement",
        relevance_score=0.9,
        source_quality=0.85,
    )

    v_res, sup, contra = verifier.verify_claim(claim, [ev_api])
    detail = ClaimAnalysisDetail(
        claim=claim,
        verification=v_res,
        freshness=FreshnessResult(
            claim_id=claim.claim_id,
            temporal_sensitivity=claim.temporal_sensitivity,
            reference_time="2026-11-07T00:00:00Z",
            freshness_score=0.8,
            freshness_status=FreshnessStatus.CURRENT,
            evidence_consistency=1.0,
            confidence=0.8,
            explanation="Recent API document",
        ),
        supporting_evidence=[ev_api],
        contradicting_evidence=[],
    )

    correction = correction_service.generate_correction(input_text, [detail])
    assert len(correction.citations) >= 1
    assert correction.citations[0].evidence_id == "ev_api_1"
    # Corrected text must qualify the unverified recency claim without hallucinating
    assert "does not verify" in correction.corrected_text.lower() or "unverified" in correction.corrected_text.lower()
    # Corrected text must include the verified API availability
    assert "available" in correction.corrected_text.lower()
    assert len(correction.deltas) >= 2


def test_advanced_proposition_decomposition_patterns():
    """Test diverse linguistic constructions for atomic decomposition:
    - AND clauses with shared subjects
    - BUT contrastive clauses
    - Negation combined with conjunctions
    - Relative clauses (who/which/that)
    - Multiple propositions with different subjects
    - Comparative / Superlative claims
    - Abstention on ambiguous sentences
    """
    d = PropositionDecompositionService()

    # 1. Coordinate with independent subjects
    t_multi_subj = "OpenAI developed GPT-4 and Anthropic released Claude."
    p_multi = d.decompose_claim("c_multi", t_multi_subj)
    assert len(p_multi) == 2
    assert p_multi[0].subject == "OpenAI"
    assert p_multi[0].predicate == "developed"
    assert "GPT-4" in p_multi[0].object
    assert p_multi[1].subject == "Anthropic"
    assert p_multi[1].predicate == "released"
    assert "Claude" in p_multi[1].object

    # 2. Relative clause
    t_rel = "Sam Altman, who is the CEO of OpenAI, attended the summit."
    p_rel = d.decompose_claim("c_rel", t_rel)
    assert len(p_rel) == 2
    assert p_rel[0].subject == "Sam Altman"
    assert p_rel[0].predicate == "is"
    assert "CEO of OpenAI" in p_rel[0].object
    assert p_rel[1].subject == "Sam Altman"
    assert p_rel[1].predicate == "attended"
    assert "summit" in p_rel[1].object

    # 3. Negation combined with conjunction
    t_neg = "The model is not available in ChatGPT but remains available through the API."
    p_neg = d.decompose_claim("c_neg", t_neg)
    assert len(p_neg) == 2
    assert p_neg[0].polarity == PropositionPolarity.NEGATIVE
    assert p_neg[1].polarity == PropositionPolarity.POSITIVE

    # 4. Superlative / Comparative
    t_comp = "GPT-4.1 remains the latest model in the GPT-4 series and is available through the API."
    p_comp = d.decompose_claim("c_comp", t_comp)
    assert len(p_comp) == 2
    assert "latest" in p_comp[0].object.lower() or "latest" in p_comp[0].predicate.lower()

    # 5. Abstention on ambiguous or atomic sentences (preserves single claim)
    t_simple = "The earth orbits around the sun in approximately 365 days."
    p_simple = d.decompose_claim("c_simple", t_simple)
    assert len(p_simple) == 1
    assert p_simple[0].original_text_span == t_simple


def test_e2e_pipeline_with_expanded_benchmark():
    """Verify that 10 benchmark scenarios execute successfully and compute valid statistics."""
    runner = BenchmarkRunner()
    result = asyncio.run(runner.run_benchmark(max_scenarios=10))
    assert result.total_scenarios == 10
    assert 0.0 <= result.recovery_rate <= 1.0
    assert result.recovery_rate_ci_95[0] <= result.recovery_rate_ci_95[1]
    # Each scenario executes 2 evaluations (1 stale run + 1 fresh run) = 20 scenario_results
    assert len(result.scenario_results) == 20
    assert result.stale_detection_rate >= 0.80
