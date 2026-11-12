"""Regression test suite for comprehensive engine audit and failure fixes."""
import asyncio
from datetime import datetime, timezone
import pytest
import httpx

from app.schemas.claims import AtomicClaim, TemporalSensitivity, StructuredProposition
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.schemas.report import AnalyzeRequest, ClaimAnalysisDetail
from app.schemas.verification import VerificationVerdict, VerificationResult
from app.schemas.freshness import FreshnessResult, FreshnessStatus
from app.services.claim_extraction.service import ClaimExtractionService
from app.services.temporal_analysis.service import TemporalAnalysisService
from app.services.evidence_research.service import EvidenceResearchService
from app.services.reporting.service import ReportingService
from app.services.correction.service import AnswerCorrectionService
from app.services.claim_verification.providers.bifrost_provider import BifrostSemanticProvider
from app.services.pipeline import EpoClaimPipeline


def test_discourse_introductory_sentence_filtering():
    """Verify that introductory/catalog preamble sentences are excluded from claims."""
    extractor = ClaimExtractionService()

    # Sentences that should be filtered as non-factual discourse
    fillers = [
        "As of November 2026, here are some important facts about modern software development.",
        "In this guide, below is a summary of recent updates.",
        "Here are key facts about the release.",
        "Below are several points regarding modern architecture.",
        "For your information, here are the details.",
    ]

    for f in fillers:
        assert extractor._is_non_factual_filler(f), f"Expected filler to be filtered: {f}"

    # Factual statements that must NOT be filtered
    factual = [
        "Windows 10 is the latest operating system released by Microsoft.",
        "Git is a distributed version control system used by developers.",
        "MongoDB stores data in BSON format.",
    ]

    for s in factual:
        assert not extractor._is_non_factual_filler(s), f"Expected factual claim to be retained: {s}"


def test_technical_definitional_invariance():
    """Verify that fundamental computing definitions and RFC standards are TIME_INVARIANT,
    while dynamic/evolving technical propositions are SLOW_MOVING or FAST_MOVING."""
    temporal = TemporalAnalysisService()

    # 1. Stable technical definitions (Must be TIME_INVARIANT)
    invariant_claims = [
        AtomicClaim(
            claim_id="t1",
            original_text="TCP is a connection-oriented transport protocol.",
            normalized_text="TCP is a connection-oriented transport protocol",
            attribute="is",
            claimed_value="a connection-oriented transport protocol",
        ),
        AtomicClaim(
            claim_id="t2",
            original_text="Git is a distributed version control system.",
            normalized_text="Git is a distributed version control system",
            attribute="is",
            claimed_value="a distributed version control system",
        ),
        AtomicClaim(
            claim_id="t3",
            original_text="HTTP 404 indicates that a requested resource was not found.",
            normalized_text="HTTP 404 indicates that a requested resource was not found",
            attribute="indicates",
            claimed_value="requested resource was not found",
        ),
        AtomicClaim(
            claim_id="t4",
            original_text="MongoDB is a NoSQL document-oriented database that stores data in BSON format.",
            normalized_text="MongoDB is a NoSQL document-oriented database that stores data in BSON format",
            attribute="is",
            claimed_value="a NoSQL document-oriented database storing BSON format",
        ),
    ]

    for c in invariant_claims:
        sensitivity = temporal.classify_sensitivity(c)
        assert sensitivity == TemporalSensitivity.TIME_INVARIANT, f"Expected TIME_INVARIANT for: {c.original_text}, got {sensitivity}"

    # 2. Time-sensitive technical propositions (Must NOT be TIME_INVARIANT)
    time_sensitive_claims = [
        (
            AtomicClaim(
                claim_id="d1",
                original_text="The latest version of a protocol specification is version X.",
                normalized_text="The latest version of a protocol specification is version X",
                attribute="is",
                claimed_value="version X",
            ),
            TemporalSensitivity.FAST_MOVING,
        ),
        (
            AtomicClaim(
                claim_id="d2",
                original_text="The currently recommended security configuration for a protocol is X.",
                normalized_text="The currently recommended security configuration for a protocol is X",
                attribute="is",
                claimed_value="X",
            ),
            TemporalSensitivity.SLOW_MOVING,
        ),
        (
            AtomicClaim(
                claim_id="d3",
                original_text="React 19 is the latest version of React released today.",
                normalized_text="React 19 is the latest version of React released today",
                attribute="is",
                claimed_value="the latest version of React",
            ),
            TemporalSensitivity.FAST_MOVING,
        ),
    ]

    for c, expected_sens in time_sensitive_claims:
        sens = temporal.classify_sensitivity(c)
        assert sens == expected_sens, f"Expected {expected_sens} for '{c.original_text}', got {sens}"


def test_fair_multi_claim_query_distribution():
    """Verify that search query planning allocates 1 query per claim before secondary queries."""
    researcher = EvidenceResearchService()

    claims = [
        AtomicClaim(
            claim_id="c1",
            original_text="Windows 10 is the latest OS and remains primary desktop OS.",
            normalized_text="Windows 10 is the latest OS and remains primary desktop OS",
            temporal_sensitivity=TemporalSensitivity.FAST_MOVING,
            propositions=[
                StructuredProposition(
                    proposition_id="p1", parent_claim_id="c1", source_claim_id="c1",
                    subject="Windows 10", predicate="is", object="the latest OS",
                    original_text_span="Windows 10 is the latest OS"
                ),
                StructuredProposition(
                    proposition_id="p2", parent_claim_id="c1", source_claim_id="c1",
                    subject="Windows 10", predicate="remains", object="primary desktop OS",
                    original_text_span="remains primary desktop OS"
                ),
            ]
        ),
        AtomicClaim(
            claim_id="c2",
            original_text="React 17 is the latest stable version of React.",
            normalized_text="React 17 is the latest stable version of React",
            temporal_sensitivity=TemporalSensitivity.FAST_MOVING,
            entity="React 17",
            attribute="is",
            claimed_value="the latest stable version of React",
        ),
    ]

    # Mock tavily client to track executed queries
    class MockTavily:
        def __init__(self):
            self.queries = []
        async def search(self, q):
            self.queries.append(q)
            return {"results": [], "source": "live"}

    mock_client = MockTavily()
    researcher.tavily = mock_client

    async def _run():
        await researcher.research_claims(claims, max_searches_per_analysis=2)
        # With max 2 searches, claim 1 and claim 2 should each receive 1 query
        # rather than claim 1 receiving both queries!
        assert len(mock_client.queries) == 2
        assert any("Windows 10" in q for q in mock_client.queries)
        assert any("React" in q for q in mock_client.queries)

    asyncio.run(_run())


def test_reporting_preserves_candidate_evidence_when_unconfirmed():
    """Verify that report.evidence_sources retains evaluated neutral evidence while strictly excluding unrelated candidate evidence."""
    reporting = ReportingService()

    dummy_ev = EvidenceRecord(
        evidence_id="ev_test_123",
        claim_id="c1",
        source_url="https://example.com/doc",
        source_title="Example Knowledge",
        source_domain="example.com",
        citation_text="Example snippet text.",
        verification_context="Full example context.",
    )

    neutral_ev = EvidenceRecord(
        evidence_id="ev_neutral_456",
        claim_id="c1",
        source_url="https://example.com/neutral",
        source_title="Neutral Evaluation",
        source_domain="example.com",
        citation_text="Inconclusive context.",
        verification_context="Full neutral context.",
    )

    from app.schemas.verification import PropositionVerificationResult
    detail = ClaimAnalysisDetail(
        claim=AtomicClaim(
            claim_id="c1",
            original_text="Unconfirmed fact",
            normalized_text="Unconfirmed fact",
        ),
        verification=VerificationResult(
            claim_id="c1",
            verdict=VerificationVerdict.INSUFFICIENT_EVIDENCE,
            entailment_score=0.2,
            contradiction_score=0.2,
            neutral_score=0.6,
            verification_confidence=0.4,
            evidence_ids=["ev_test_123"],
            explanation="Insufficient evidence.",
            proposition_results=[
                PropositionVerificationResult(
                    parent_claim_id="c1",
                    proposition_id="p1",
                    text="Unconfirmed fact",
                    verdict=VerificationVerdict.INSUFFICIENT_EVIDENCE,
                    confidence=0.4,
                    reasoning="Inconclusive evidence",
                    supporting_evidence_ids=[],
                    contradicting_evidence_ids=[],
                    neutral_evidence_ids=["ev_neutral_456"],
                )
            ],
        ),
        freshness=FreshnessResult(
            claim_id="c1",
            temporal_sensitivity=TemporalSensitivity.SLOW_MOVING,
            reference_time=datetime.now(timezone.utc),
            freshness_score=0.5,
            freshness_status=FreshnessStatus.UNKNOWN,
            evidence_age=None,
            evidence_consistency=0.5,
            confidence=0.5,
            explanation="No publication date.",
        ),
        supporting_evidence=[],
        contradicting_evidence=[],
    )

    unrelated_ev = EvidenceRecord(
        evidence_id="ev_unrelated_999",
        claim_id="other_claim",
        source_url="https://other.com/unrelated",
        source_title="Unrelated Document",
        source_domain="other.com",
        citation_text="Completely unrelated topic text.",
        verification_context="Full unrelated text.",
    )

    report = reporting.generate_report(
        original_input="Unconfirmed fact",
        claim_details=[detail],
        candidate_evidence=[dummy_ev, neutral_ev, unrelated_ev],
    )

    # 1. Evaluated supporting and neutral evidence are both retained
    retained_ids = [e.evidence_id for e in report.evidence_sources]
    assert "ev_test_123" in retained_ids
    assert "ev_neutral_456" in retained_ids
    # 2. Unrelated candidate evidence is strictly excluded
    assert "ev_unrelated_999" not in retained_ids
    assert len(report.evidence_sources) == 2


def test_grounded_correction_preserves_proper_noun_casing():
    """Verify that answer correction preserves proper nouns rather than lowercasing them."""
    correction_svc = AnswerCorrectionService()

    detail = ClaimAnalysisDetail(
        claim=AtomicClaim(
            claim_id="c1",
            original_text="React 17 is the latest stable version of React.",
            normalized_text="React 17 is the latest stable version of React",
        ),
        verification=VerificationResult(
            claim_id="c1",
            verdict=VerificationVerdict.INSUFFICIENT_EVIDENCE,
            entailment_score=0.2,
            contradiction_score=0.2,
            neutral_score=0.6,
            verification_confidence=0.4,
            evidence_ids=[],
            explanation="Insufficient evidence.",
        ),
        freshness=FreshnessResult(
            claim_id="c1",
            temporal_sensitivity=TemporalSensitivity.FAST_MOVING,
            reference_time=datetime.now(timezone.utc),
            freshness_score=0.5,
            freshness_status=FreshnessStatus.UNKNOWN,
            evidence_age=None,
            evidence_consistency=0.5,
            confidence=0.5,
            explanation="Unknown",
        ),
        supporting_evidence=[],
        contradicting_evidence=[],
    )

    correction = correction_svc.generate_correction(
        original_text="React 17 is the latest stable version of React.",
        claim_details=[detail],
    )

    # Single unverified statement format
    assert "React 17" in correction.corrected_text
    assert "It remains unverified whether React 17 is the latest stable version of React due to insufficient corroborating evidence." in correction.corrected_text

    # Multiple unverified statements must be grouped naturally rather than repeating the boilerplate
    detail2 = ClaimAnalysisDetail(
        claim=AtomicClaim(
            claim_id="c2",
            original_text="AngularJS is recommended by Google for modern apps.",
            normalized_text="AngularJS is recommended by Google for modern apps",
        ),
        verification=VerificationResult(
            claim_id="c2",
            verdict=VerificationVerdict.INSUFFICIENT_EVIDENCE,
            entailment_score=0.2,
            contradiction_score=0.2,
            neutral_score=0.6,
            verification_confidence=0.4,
            evidence_ids=[],
            explanation="Insufficient evidence.",
        ),
        freshness=FreshnessResult(
            claim_id="c2",
            temporal_sensitivity=TemporalSensitivity.SLOW_MOVING,
            reference_time=datetime.now(timezone.utc),
            freshness_score=0.5,
            freshness_status=FreshnessStatus.UNKNOWN,
            evidence_age=None,
            evidence_consistency=0.5,
            confidence=0.5,
            explanation="Unknown",
        ),
        supporting_evidence=[],
        contradicting_evidence=[],
    )

    multi_correction = correction_svc.generate_correction(
        original_text="React 17 is latest. AngularJS is recommended.",
        claim_details=[detail, detail2],
    )
    assert "Due to insufficient corroborating evidence, it remains unverified whether: (1) React 17 is the latest stable version of React; (2) AngularJS is recommended by Google for modern apps." in multi_correction.corrected_text
    # Proposition-level uncertainty preservation in structured metadata
    assert len(multi_correction.unresolved_uncertainties) == 2
    assert multi_correction.unresolved_uncertainties[0] == "React 17 is the latest stable version of React"
    assert multi_correction.unresolved_uncertainties[1] == "AngularJS is recommended by Google for modern apps"


def test_bifrost_circuit_breaker_on_connect_failure():
    """Verify that Bifrost provider engages circuit breaker on connection error and recovers after cooldown."""
    import json
    # Custom client that initially fails with ConnectError, then recovers
    server_healthy = False

    def dynamic_handler(request):
        if not server_healthy:
            raise httpx.ConnectError("Connection refused")
        return httpx.Response(
            200,
            json={
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "assessments": [{
                                "proposition_id": "p1",
                                "evidence_id": "e1",
                                "relation": "SUPPORTS",
                                "confidence": 0.95,
                                "relevant_quote": "text",
                                "rationale": "ok"
                            }]
                        })
                    }
                }]
            }
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(dynamic_handler), base_url="http://offline-bifrost:8080/v1")
    provider = BifrostSemanticProvider(base_url="http://offline-bifrost:8080/v1", http_client=client, max_retries=0)
    provider._cooldown_seconds = 0.05  # Short cooldown for test

    async def _run():
        assert provider.is_available is True
        from app.services.claim_verification.llm_interface import BatchAssessmentRequest, BatchPropositionItem, BatchEvidenceItem
        req = BatchAssessmentRequest(
            claim_id="c1",
            propositions=[BatchPropositionItem(proposition_id="p1", subject="X", predicate="Y")],
            evidence_items=[BatchEvidenceItem(evidence_id="e1", source_snippet="text")],
        )
        try:
            await provider.batch_assess_evidence(req)
        except RuntimeError:
            pass

        # 1. Circuit breaker is engaged immediately after connect failure
        assert provider.is_available is False

        # 2. Fast forward beyond cooldown
        await asyncio.sleep(0.06)
        assert provider.is_available is True

        # 3. Server recovers
        nonlocal server_healthy
        server_healthy = True
        resp = await provider.batch_assess_evidence(req)
        assert len(resp.assessments) == 1
        assert resp.assessments[0].relation.value == "SUPPORTS"
        # Circuit breaker is fully reset and remains healthy
        assert provider._last_connect_failure_time == 0.0
        assert provider.is_available is True

    asyncio.run(_run())
