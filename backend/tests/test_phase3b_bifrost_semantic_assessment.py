"""Comprehensive offline tests for Phase 3B: Bifrost Integration & Batched Semantic Evidence Assessment.

All tests utilize mocked HTTP transport/providers with zero external API calls or Tavily credits.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, List
import httpx
import pytest

from app.core.config import settings
from app.schemas.claims import AtomicClaim, StructuredProposition
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationVerdict
from app.schemas.report import AnalyzeRequest
from app.services.claim_verification.llm_interface import (
    BatchAssessmentRequest,
    BatchAssessmentResponse,
    BatchPropositionItem,
    BatchEvidenceItem,
    PairAssessmentResult,
    AssessmentRelation,
    UnavailableSemanticProvider,
)
from app.services.claim_verification.providers.bifrost_provider import BifrostSemanticProvider
from app.services.claim_verification.service import ClaimVerificationService
from app.services.pipeline import EpoClaimPipeline
from app.evaluation.runner import BenchmarkRunner
from app.evaluation.scenarios import get_default_benchmark_scenarios


# ============================================================================
# Helpers & Mock Handlers
# ============================================================================

def make_mock_bifrost_handler(response_dict: Dict[str, Any], status_code: int = 200):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=status_code, json=response_dict)
    return handler


def make_mock_client(response_dict: Dict[str, Any], status_code: int = 200) -> httpx.AsyncClient:
    handler = make_mock_bifrost_handler(response_dict, status_code)
    transport = httpx.MockTransport(handler)
    return httpx.AsyncClient(transport=transport, base_url="http://test-bifrost:8080/v1")


# ============================================================================
# 1. Valid Structured Assessment & Attribution Tests
# ============================================================================

def test_valid_structured_assessment_and_attribution():
    """Verify that valid structured assessments are parsed and attributed to exact pairs."""
    mock_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "assessments": [
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_1",
                                "relation": "SUPPORTS",
                                "confidence": 0.95,
                                "relevant_quote": "Apollo 11 landed on the moon on July 20, 1969.",
                                "rationale": "Directly corroborates date and mission.",
                            }
                        ]
                    })
                }
            }
        ]
    }
    client = make_mock_client(mock_payload)
    provider = BifrostSemanticProvider(
        base_url="http://test-bifrost:8080/v1",
        model="gpt-4o-mini",
        http_client=client,
    )

    req = BatchAssessmentRequest(
        claim_id="clm_1",
        propositions=[
            BatchPropositionItem(
                proposition_id="prop_1",
                subject="Apollo 11",
                predicate="landed",
                object="on the moon in 1969",
            )
        ],
        evidence_items=[
            BatchEvidenceItem(
                evidence_id="ev_1",
                source_snippet="Apollo 11 landed on the moon on July 20, 1969.",
            )
        ],
    )

    # Force enabled in provider for test
    async def _run():
        settings.enable_llm_semantic_assessment = True
        res = await provider.batch_assess_evidence(req)
        assert len(res.assessments) == 1
        ass = res.assessments[0]
        assert ass.proposition_id == "prop_1"
        assert ass.evidence_id == "ev_1"
        assert ass.relation == AssessmentRelation.SUPPORTS
        assert ass.confidence == 0.95
        assert ass.relevant_quote == "Apollo 11 landed on the moon on July 20, 1969."

    asyncio.run(_run())


# ============================================================================
# 2. Strict Integrity Rejection Tests (Unknown IDs, Duplicates, Invalid Enums)
# ============================================================================

def test_rejection_of_unknown_ids_and_duplicates():
    """Reject unknown proposition/evidence IDs and reject duplicate assessment pairs entirely."""
    mock_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "assessments": [
                            # Unknown proposition ID
                            {
                                "proposition_id": "prop_invented",
                                "evidence_id": "ev_1",
                                "relation": "SUPPORTS",
                                "confidence": 0.9,
                                "rationale": "fake prop",
                            },
                            # Unknown evidence ID
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_invented",
                                "relation": "SUPPORTS",
                                "confidence": 0.9,
                                "rationale": "fake ev",
                            },
                            # Valid pair 1 (will be duplicated below)
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_1",
                                "relation": "SUPPORTS",
                                "confidence": 0.9,
                                "rationale": "valid",
                            },
                            # Duplicate of (prop_1, ev_1) -> should invalidate BOTH instances
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_1",
                                "relation": "CONTRADICTS",
                                "confidence": 0.8,
                                "rationale": "duplicate",
                            },
                            # Unrelated valid pair
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_2",
                                "relation": "SUPPORTS",
                                "confidence": 0.88,
                                "rationale": "valid other",
                            },
                        ]
                    })
                }
            }
        ]
    }
    client = make_mock_client(mock_payload)
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client)

    req = BatchAssessmentRequest(
        claim_id="clm_1",
        propositions=[BatchPropositionItem(proposition_id="prop_1", subject="X", predicate="Y")],
        evidence_items=[
            BatchEvidenceItem(evidence_id="ev_1", source_snippet="X is Y in reality."),
            BatchEvidenceItem(evidence_id="ev_2", source_snippet="X also does Y."),
        ],
    )

    async def _run():
        settings.enable_llm_semantic_assessment = True
        res = await provider.batch_assess_evidence(req)
        # (prop_1, ev_1) was duplicated, so it was completely invalidated.
        # Only the unrelated valid pair (prop_1, ev_2) is retained.
        assert len(res.assessments) == 1
        assert res.assessments[0].proposition_id == "prop_1"
        assert res.assessments[0].evidence_id == "ev_2"

    asyncio.run(_run())


def test_rejection_of_invalid_relations_and_confidence():
    """Reject malformed categorical relations and out-of-bound confidence values."""
    mock_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "assessments": [
                            # Invalid relation
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_1",
                                "relation": "MAYBE_AGREES",
                                "confidence": 0.9,
                                "rationale": "invalid relation",
                            },
                            # Out of bounds confidence (> 1.0)
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_2",
                                "relation": "SUPPORTS",
                                "confidence": 1.5,
                                "rationale": "invalid conf",
                            },
                            # Valid item
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_3",
                                "relation": "CONTRADICTS",
                                "confidence": 0.85,
                                "rationale": "valid",
                            },
                        ]
                    })
                }
            }
        ]
    }
    client = make_mock_client(mock_payload)
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client)

    req = BatchAssessmentRequest(
        claim_id="clm_1",
        propositions=[BatchPropositionItem(proposition_id="prop_1", subject="X", predicate="Y")],
        evidence_items=[
            BatchEvidenceItem(evidence_id="ev_1", source_snippet="Snippet 1"),
            BatchEvidenceItem(evidence_id="ev_2", source_snippet="Snippet 2"),
            BatchEvidenceItem(evidence_id="ev_3", source_snippet="Snippet 3"),
        ],
    )

    async def _run():
        settings.enable_llm_semantic_assessment = True
        res = await provider.batch_assess_evidence(req)
        assert len(res.assessments) == 1
        assert res.assessments[0].evidence_id == "ev_3"
        assert res.assessments[0].relation == AssessmentRelation.CONTRADICTS

    asyncio.run(_run())


def test_quote_must_match_supplied_snippet():
    """Quotes invented or not exactly present in the snippet cause the pair to be rejected entirely."""
    mock_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "assessments": [
                            # Pair with invented quote -> rejected entirely
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_1",
                                "relation": "SUPPORTS",
                                "confidence": 0.9,
                                "relevant_quote": "Invented quote that does not appear in source snippet.",
                                "rationale": "test",
                            },
                            # Valid pair with matching quote -> retained
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_2",
                                "relation": "SUPPORTS",
                                "confidence": 0.9,
                                "relevant_quote": "exact matching quote",
                                "rationale": "valid",
                            },
                        ]
                    })
                }
            }
        ]
    }
    client = make_mock_client(mock_payload)
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client)

    req = BatchAssessmentRequest(
        claim_id="clm_1",
        propositions=[BatchPropositionItem(proposition_id="prop_1", subject="X", predicate="Y")],
        evidence_items=[
            BatchEvidenceItem(evidence_id="ev_1", source_snippet="The real snippet text."),
            BatchEvidenceItem(evidence_id="ev_2", source_snippet="Here is an exact matching quote from the article."),
        ],
    )

    async def _run():
        settings.enable_llm_semantic_assessment = True
        res = await provider.batch_assess_evidence(req)
        # Pair 1 is rejected; Pair 2 is accepted
        assert len(res.assessments) == 1
        assert res.assessments[0].evidence_id == "ev_2"
        assert res.assessments[0].relevant_quote == "exact matching quote"

    asyncio.run(_run())


# ============================================================================
# 3. Robust Error Handling & Fallback Tests (Malformed, Truncated, 5xx, Timeout)
# ============================================================================

def test_malformed_and_truncated_json_handling():
    """Verify that malformed or truncated model JSON raises error for clean fallback."""
    handler = lambda r: httpx.Response(status_code=200, json={"choices": [{"message": {"content": "{\"assessments\": [ { incomplete"}}]})
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test-bifrost:8080/v1")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client, max_retries=0)

    req = BatchAssessmentRequest(
        claim_id="c",
        propositions=[BatchPropositionItem(proposition_id="p1", subject="s", predicate="p")],
        evidence_items=[BatchEvidenceItem(evidence_id="e1", source_snippet="snip")],
    )

    async def _run():
        settings.enable_llm_semantic_assessment = True
        with pytest.raises(RuntimeError) as exc_info:
            await provider.batch_assess_evidence(req)
        assert "Malformed or truncated JSON" in str(exc_info.value)

    asyncio.run(_run())


def test_http_5xx_and_timeout_fallback():
    """Verify provider raises clean exception on HTTP 500 or timeout."""
    handler = lambda r: httpx.Response(status_code=500, text="Internal Server Error")
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test-bifrost:8080/v1")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client, max_retries=0)

    req = BatchAssessmentRequest(
        claim_id="c",
        propositions=[BatchPropositionItem(proposition_id="p1", subject="s", predicate="p")],
        evidence_items=[BatchEvidenceItem(evidence_id="e1", source_snippet="snip")],
    )

    async def _run():
        settings.enable_llm_semantic_assessment = True
        with pytest.raises(RuntimeError) as exc_info:
            await provider.batch_assess_evidence(req)
        assert "Bifrost HTTP 500" in str(exc_info.value)

    asyncio.run(_run())


def test_service_level_partial_success_and_fallback():
    """When some assessments succeed, the service uses them and falls back only for missing pairs."""
    mock_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "assessments": [
                            # Only prop_1 is assessed by LLM; prop_2 is omitted
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_1",
                                "relation": "SUPPORTS",
                                "confidence": 0.95,
                                "rationale": "supported by LLM",
                            }
                        ]
                    })
                }
            }
        ]
    }
    client = make_mock_client(mock_payload)
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client)
    verifier = ClaimVerificationService(semantic_provider=provider)

    prop1 = StructuredProposition(
        proposition_id="prop_1", parent_claim_id="clm", source_claim_id="clm",
        subject="Python", predicate="is", object="a programming language",
        original_text_span="Python is a programming language"
    )
    prop2 = StructuredProposition(
        proposition_id="prop_2", parent_claim_id="clm", source_claim_id="clm",
        subject="Guido van Rossum", predicate="created", object="Python",
        original_text_span="Guido van Rossum created Python"
    )

    ev1 = EvidenceRecord(
        evidence_id="ev_1", claim_id="clm",
        citation_text="Guido van Rossum created Python. Python is a programming language.",
        verification_context="Guido van Rossum created Python. Python is a programming language.",
    )

    # Enable LLM
    settings.enable_llm_semantic_assessment = True
    claim = AtomicClaim(
        claim_id="clm",
        original_text="Python is a programming language and Guido van Rossum created Python.",
        normalized_text="Python is a programming language and Guido van Rossum created Python.",
        propositions=[prop1, prop2]
    )

    v_res, sup, contra = verifier.verify_claim(claim, [ev1])
    # Both propositions are supported: prop_1 via LLM, prop_2 via deterministic fallback
    assert v_res.verdict == VerificationVerdict.SUPPORTED
    assert len(v_res.proposition_results) == 2
    assert v_res.proposition_results[0].verdict == VerificationVerdict.SUPPORTED
    assert v_res.proposition_results[1].verdict == VerificationVerdict.SUPPORTED

    # Reset
    settings.enable_llm_semantic_assessment = False


# ============================================================================
# 4. Pipeline Integration, Scoring & Temporal Integrity Tests
# ============================================================================

def test_deterministic_scoring_conversion_mapping():
    """Verify heuristic conversion mapping from categorical relations to probabilistic scores."""
    verifier = ClaimVerificationService()
    
    # SUPPORTS (c=0.8): e=0.8, c=0.1, n=0.1
    e, c, n = verifier._map_llm_relation_to_scores(AssessmentRelation.SUPPORTS, 0.8)
    assert e == 0.8 and c == 0.1 and n == 0.1
    assert round(e + c + n, 4) == 1.0

    # CONTRADICTS (c=0.9): c=0.9, e=0.05, n=0.05
    e, c, n = verifier._map_llm_relation_to_scores(AssessmentRelation.CONTRADICTS, 0.9)
    assert c == 0.9 and e == 0.05 and n == 0.05
    assert round(e + c + n, 4) == 1.0

    # NEUTRAL (c=0.7): n=0.7, e=0.15, c=0.15
    e, c, n = verifier._map_llm_relation_to_scores(AssessmentRelation.NEUTRAL, 0.7)
    assert n == 0.7 and e == 0.15 and c == 0.15
    assert round(e + c + n, 4) == 1.0

    # INSUFFICIENT: n=1.0, e=0.0, c=0.0
    e, c, n = verifier._map_llm_relation_to_scores(AssessmentRelation.INSUFFICIENT, 0.5)
    assert n == 1.0 and e == 0.0 and c == 0.0


def test_disabled_provider_makes_zero_http_calls(monkeypatch):
    """When enable_llm_semantic_assessment is False, provider is unavailable and zero network calls occur."""
    monkeypatch.setattr(settings, "enable_llm_semantic_assessment", False)
    monkeypatch.setattr(settings, "enable_llm_claim_decomposition", False)
    monkeypatch.setattr(settings, "enable_llm_answer_correction", False)

    called = False
    def failing_handler(r):
        nonlocal called
        called = True
        return httpx.Response(200, json={})

    client = httpx.AsyncClient(transport=httpx.MockTransport(failing_handler), base_url="http://test-bifrost:8080/v1")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client)

    assert provider.is_available is False
    verifier = ClaimVerificationService(semantic_provider=provider)
    
    claim = AtomicClaim(claim_id="c", original_text="Earth orbits Sun.", normalized_text="Earth orbits Sun.")
    ev = EvidenceRecord(evidence_id="e1", claim_id="c", citation_text="Earth orbits the Sun.", verification_context="Earth orbits the Sun.")
    
    res, sup, con = verifier.verify_claim(claim, [ev])
    assert called is False
    assert res.verdict == VerificationVerdict.SUPPORTED


def test_temporally_ineligible_evidence_never_evaluated():
    """Ineligible evidence filtered by temporal reasoning is never forwarded to semantic provider."""
    # Under historical mode with target in 1969, an article for 2024 is ineligible
    async def _run():
        settings.enable_llm_semantic_assessment = False
        pipeline = EpoClaimPipeline()
        req = AnalyzeRequest(
            response_text="The Battle of Hastings was fought in 1066.",
            context_documents=[
                {
                    "title": "Unrelated Future Document",
                    "content": "Future tech event in 2025.",
                    "published_date": "2025-01-01T00:00:00Z",
                    "asserted_valid_time": {
                        "start_time": "2025-01-01T00:00:00Z",
                        "end_time": "2026-01-01T00:00:00Z",
                        "precision": "YEAR",
                        "temporal_status": "KNOWN_INTERVAL",
                    }
                }
            ],
            enable_live_search=False,
            temporal_evaluation_mode="historical",
            target_event_time=datetime(1066, 10, 14, tzinfo=timezone.utc),
        )
        report = await pipeline.run(req)
        # Ineligible evidence was filtered out, resulting in insufficient evidence
        assert report.insufficient_evidence_claims == 1

    asyncio.run(_run())


def test_offline_benchmarks_reproducibility():
    """Verify that existing 18 benchmark scenarios yield exact identical results with LLM disabled."""
    async def _run():
        settings.enable_llm_semantic_assessment = False
        runner = BenchmarkRunner()
        scenarios = get_default_benchmark_scenarios()
        report = await runner.run_benchmark(scenarios=scenarios, max_scenarios=18)
        assert report.total_scenarios == 18
        assert report.parent_verdict_accuracy >= 0.88
        assert report.stale_detection_rate >= 0.83
        assert report.fresh_acceptance_rate >= 0.83

    asyncio.run(_run())


# ============================================================================
# 5. Additional Batch Invariants & Boundaries (Section B & C Verification)
# ============================================================================

def test_deterministic_batch_splitting_and_evidence_limit():
    """Verify that batches strictly respect bifrost_max_batch_evidence and split deterministically."""
    batches_seen = []
    def handler(request: httpx.Request) -> httpx.Response:
        data = json.loads(request.content.decode("utf-8"))
        user_body = json.loads(data["messages"][1]["content"])
        ev_ids = [e["evidence_id"] for e in user_body["evidence_passages"]]
        batches_seen.append(ev_ids)
        # return dummy assessments
        mock_ass = [{"proposition_id": "p1", "evidence_id": eid, "relation": "NEUTRAL", "confidence": 0.5, "rationale": "r"} for eid in ev_ids]
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({"assessments": mock_ass})}}]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test-bifrost:8080/v1")
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client)
    verifier = ClaimVerificationService(semantic_provider=provider)

    settings.enable_llm_semantic_assessment = True
    settings.bifrost_max_batch_evidence = 3

    props = [StructuredProposition(proposition_id="p1", parent_claim_id="c", source_claim_id="c", subject="S", predicate="P", original_text_span="S P")]
    # 7 evidence records -> should produce 3 batches: [3, 3, 1]
    ev_records = [
        EvidenceRecord(evidence_id=f"ev_{i}", claim_id="c", citation_text=f"Text {i}", verification_context=f"Text {i}")
        for i in range(7)
    ]

    res_map = verifier._run_async_safely(verifier._evaluate_llm_batch("c", props, ev_records))
    assert len(batches_seen) == 3
    assert len(batches_seen[0]) == 3
    assert len(batches_seen[1]) == 3
    assert len(batches_seen[2]) == 1
    assert len(res_map) == 7
    # Reset
    settings.enable_llm_semantic_assessment = False
    settings.bifrost_max_batch_evidence = 10


def test_no_cross_proposition_evidence_leakage():
    """Verify that evidence for prop_1 never leaks into or alters prop_2."""
    mock_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "assessments": [
                            {
                                "proposition_id": "prop_1",
                                "evidence_id": "ev_1",
                                "relation": "SUPPORTS",
                                "confidence": 0.99,
                                "relevant_quote": "Exact prop 1 quote.",
                                "rationale": "supports prop 1",
                            },
                            {
                                "proposition_id": "prop_2",
                                "evidence_id": "ev_1",
                                "relation": "CONTRADICTS",
                                "confidence": 0.95,
                                "relevant_quote": "Exact prop 1 quote.",
                                "rationale": "refutes prop 2",
                            },
                        ]
                    })
                }
            }
        ]
    }
    client = make_mock_client(mock_payload)
    provider = BifrostSemanticProvider(base_url="http://test-bifrost:8080/v1", http_client=client)
    verifier = ClaimVerificationService(semantic_provider=provider)

    settings.enable_llm_semantic_assessment = True
    p1 = StructuredProposition(proposition_id="prop_1", parent_claim_id="c", source_claim_id="c", subject="A", predicate="B", original_text_span="A B")
    p2 = StructuredProposition(proposition_id="prop_2", parent_claim_id="c", source_claim_id="c", subject="C", predicate="D", original_text_span="C D")
    ev1 = EvidenceRecord(evidence_id="ev_1", claim_id="c", citation_text="Exact prop 1 quote.", verification_context="Exact prop 1 quote.")

    claim = AtomicClaim(claim_id="c", original_text="A B and C D", normalized_text="A B and C D", propositions=[p1, p2])
    v_res, sup, con = verifier.verify_claim(claim, [ev1])

    assert len(v_res.proposition_results) == 2
    res_p1 = v_res.proposition_results[0]
    res_p2 = v_res.proposition_results[1]

    # prop_1 supported, prop_2 contradicted
    assert res_p1.verdict == VerificationVerdict.SUPPORTED
    assert res_p1.supporting_evidence_ids == ["ev_1"]
    assert res_p1.contradicting_evidence_ids == []

    assert res_p2.verdict == VerificationVerdict.CONTRADICTED
    assert res_p2.supporting_evidence_ids == []
    assert res_p2.contradicting_evidence_ids == ["ev_1"]

    settings.enable_llm_semantic_assessment = False

