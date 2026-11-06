"""Comprehensive regression test suite for general-purpose EpoClaim verification architecture.

Covers:
1. Unknown organizations and unfamiliar entities (not in any whitelist).
2. Two CEOs in different organizations (no cross-organization false contradiction).
3. Co-CEO ambiguity (two leaders in same company without contradiction).
4. Interim versus permanent appointment distinction.
5. Non-exclusive relationships (researcher, board member, student).
6. Historical claims (Apollo 11, ancient foundations remain true).
7. Explicit replacement and reinstatement state changes.
8. Multiple dates in one article segmented cleanly.
9. Publication date versus event date separation (never overwritten).
10. Unrelated newer evidence does not supersede older facts.
11. Conflicting evidence with uncertain dates.
12. Insufficient evidence on unseen topics.
13. Duplicate source evidence deduplication.
14. Malformed semantic-provider output validation.
15. Existing public API compatibility (/api/v1/analyze).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas.report import AnalyzeRequest
from app.schemas.verification import VerificationVerdict
from app.schemas.freshness import FreshnessStatus
from app.schemas.structured_claim import StructuredClaim
from app.services.pipeline import EpoClaimPipeline
from app.services.claim_verification.semantic_matcher import GeneralSemanticVerifier
from app.services.claim_verification.scoring import (
    deduplicate_evidence_records,
    calculate_evidence_weights,
    aggregate_evidence_scores,
)
from app.services.claim_verification.llm_interface import (
    EvidenceAssessmentResponse,
    UnavailableSemanticProvider,
)
from app.services.evidence_retrieval.segmentation import (
    EvidenceSegmentationService,
    extract_sentence_event_date,
)


@pytest.fixture
def pipeline():
    return EpoClaimPipeline()


@pytest.fixture
def verifier():
    return GeneralSemanticVerifier()


# 1. Unknown organizations and unfamiliar entities
def test_unfamiliar_entity_and_organization(pipeline):
    """Verify that an unfamiliar company not in any previous whitelist verifies correctly."""
    docs = [
        {
            "title": "QuantumBio Series B Announcement",
            "content": "QuantumBio Therapeutics appointed Dr. Elena Rostova as Chief Scientific Officer in 2024.",
            "published_date": "2024-03-15T00:00:00Z",
        }
    ]
    req = AnalyzeRequest(
        response_text="Dr. Elena Rostova is the Chief Scientific Officer of QuantumBio Therapeutics.",
        context_documents=docs,
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    assert len(report.claim_results) >= 1
    cr = report.claim_results[0]
    assert cr.verification.verdict == VerificationVerdict.SUPPORTED


# 2. Two CEOs in different organizations
def test_two_ceos_different_organizations(verifier):
    """Different people holding CEO at DIFFERENT organizations must NOT contradict."""
    claim = "Satya Nadella is the CEO of Microsoft."
    evidence = "Sundar Pichai is the CEO of Alphabet."
    ent, contra, neu = verifier.evaluate_pair(claim, evidence, claim_entity="Microsoft", claim_attribute="CEO")
    assert contra < 0.25
    assert neu >= 0.60


# 3. Co-CEO ambiguity
def test_co_ceo_ambiguity_not_falsely_contradicted(verifier):
    """Two leaders sharing a role without explicit replacement must preserve uncertainty."""
    claim = "Ted Sarandos is CEO of Netflix."
    evidence = "Greg Peters serves as CEO of Netflix alongside co-leadership."
    ent, contra, neu = verifier.evaluate_pair(claim, evidence, claim_entity="Netflix", claim_attribute="CEO")
    # Must not produce high contradiction without explicit replacement or stepping down
    assert contra < 0.35


# 4. Interim versus permanent appointment
def test_interim_versus_permanent_distinction(verifier):
    """An interim role is not an identical permanent claim, preserving neutral stance."""
    claim = "John Doe is the permanent CEO of Globex."
    evidence = "Globex named Jane Smith as interim manager during the transition."
    ent, contra, neu = verifier.evaluate_pair(claim, evidence, claim_entity="Globex", claim_attribute="CEO")
    assert ent < 0.30
    assert contra < 0.30
    assert neu >= 0.60


# 5. Non-exclusive relationships
def test_non_exclusive_relationships(verifier):
    """Two different people working or researching at the same institution do not collide."""
    claim = "Alice is a researcher at Stanford University."
    evidence = "Bob is a researcher at Stanford University focusing on robotics."
    ent, contra, neu = verifier.evaluate_pair(claim, evidence, claim_entity="Stanford University", claim_attribute="researcher")
    assert contra < 0.25
    assert neu >= 0.60


# 6. Historical claims remain true
def test_historical_claims_protected(pipeline):
    """Apollo 11 moon landing in 1969 remains historically supported even with modern articles."""
    docs = [
        {
            "title": "NASA Retrospective 2025",
            "content": "On July 20, 1969, Apollo 11 successfully landed on the moon.",
            "published_date": "2025-01-01T00:00:00Z",
        }
    ]
    req = AnalyzeRequest(
        response_text="Apollo 11 landed on the moon on July 20, 1969.",
        context_documents=docs,
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    assert len(report.claim_results) >= 1
    cr = report.claim_results[0]
    assert cr.verification.verdict == VerificationVerdict.SUPPORTED
    assert cr.freshness.freshness_status == FreshnessStatus.STATIC_VALID


# 7. Explicit replacement and reinstatement
def test_explicit_replacement_and_reinstatement(pipeline):
    """Explicit return/reinstatement supersedes older leadership state."""
    docs = [
        {
            "title": "Nov 17 Update",
            "content": "OpenAI announced Mira Murati was appointed interim CEO.",
            "published_date": "2023-11-17T00:00:00Z",
        },
        {
            "title": "Nov 29 Update",
            "content": "Sam Altman has returned as CEO of OpenAI with a newly reconstituted board.",
            "published_date": "2023-11-29T00:00:00Z",
        },
    ]
    req = AnalyzeRequest(
        response_text="Mira Murati is the CEO of OpenAI.",
        context_documents=docs,
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    assert report.claim_results[0].verification.verdict == VerificationVerdict.OUTDATED


# 8. Multiple dates in one article
def test_multiple_dates_in_one_article_segmented():
    """Verify that multiple events in one article produce discrete sentence records."""
    seg = EvidenceSegmentationService()
    doc = {
        "title": "Timeline",
        "content": "In 2018, France won the tournament. Later in 2022, Argentina became champion.",
        "published_date": "2023-01-01T00:00:00Z",
    }
    records = seg.segment_document(doc, doc_index=1)
    assert len(records) >= 2
    assert records[0].event_date.year == 2018
    assert records[1].event_date.year == 2022


# 9. Publication date versus event date separation
def test_publication_date_never_overwritten_by_event_date():
    """Verify bugfix: an article published in 2024 describing 1995 does NOT overwrite publication_date."""
    seg = EvidenceSegmentationService()
    doc = {
        "title": "History of Tech",
        "content": "Acme Corp was originally founded in 1995 by three students.",
        "published_date": "2024-05-01T12:00:00Z",
    }
    records = seg.segment_document(doc, doc_index=1)
    assert len(records) >= 1
    rec = records[0]
    # Publication date MUST remain 2024
    assert rec.publication_date == datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)
    # Event date MUST capture 1995
    assert rec.event_date == datetime(1995, 1, 1, tzinfo=timezone.utc)


# 10. Unrelated newer evidence does not supersede
def test_unrelated_newer_evidence_does_not_supersede(pipeline):
    """An unrelated modern announcement does not invalidate an established factual foundation."""
    docs = [
        {
            "title": "Original Inception",
            "content": "BetaLab was founded in 2012 by Sarah Connor.",
            "published_date": "2013-01-01T00:00:00Z",
        },
        {
            "title": "New Product 2025",
            "content": "In 2025, BetaLab released an AI assistant for logistics.",
            "published_date": "2025-06-01T00:00:00Z",
        },
    ]
    req = AnalyzeRequest(
        response_text="BetaLab was founded in 2012 by Sarah Connor.",
        context_documents=docs,
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    assert report.claim_results[0].verification.verdict == VerificationVerdict.SUPPORTED


# 11. Conflicting evidence with uncertain dates
def test_conflicting_evidence_with_uncertain_dates(pipeline):
    """Conflicting claims without valid temporal precedence do not falsely become OUTDATED."""
    docs = [
        {
            "title": "Lab A",
            "content": "Device battery lasts 12 hours under load.",
            "published_date": None,
        },
        {
            "title": "Lab B",
            "content": "Device battery lasts 12 hours is disproved; it lasts 6 hours under load.",
            "published_date": None,
        },
    ]
    req = AnalyzeRequest(
        response_text="Device battery lasts 12 hours under load.",
        context_documents=docs,
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    assert report.claim_results[0].verification.verdict != VerificationVerdict.OUTDATED


# 12. Insufficient evidence
def test_insufficient_evidence(pipeline):
    """Unrelated documents yield INSUFFICIENT_EVIDENCE."""
    docs = [
        {
            "title": "Marine Biology",
            "content": "Coral reefs are sensitive to temperature anomalies in oceanic currents.",
            "published_date": "2024-01-01T00:00:00Z",
        }
    ]
    req = AnalyzeRequest(
        response_text="The artisanal bakery in Lyon won the regional croissant medal.",
        context_documents=docs,
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    assert report.claim_results[0].verification.verdict == VerificationVerdict.INSUFFICIENT_EVIDENCE


# 13. Duplicate source evidence deduplication
def test_duplicate_evidence_scoring():
    """Verify that identical repeated evidence passages do not exponentially inflate support score."""
    from app.schemas.evidence import EvidenceRecord
    rec1 = EvidenceRecord(
        evidence_id="ev_1",
        claim_id="clm_1",
        source_url="https://example.com/a",
        source_title="Title A",
        citation_text="Identical factual assertion here.",
        verification_context="Full document context for identical factual assertion here.",
        relevance_score=0.9,
        source_quality=0.9,
    )
    rec2 = EvidenceRecord(
        evidence_id="ev_2",
        claim_id="clm_1",
        source_url="https://example.com/a",
        source_title="Title A",
        citation_text="Identical factual assertion here.",
        verification_context="Full document context for identical factual assertion here.",
        relevance_score=0.9,
        source_quality=0.9,
    )
    deduped = deduplicate_evidence_records([rec1, rec2])
    assert len(deduped) == 1

    # Verify score aggregation formula S = 1 - (1 - r*q*e)
    # With 1 item: r=0.9, q=0.9, e=0.9 -> w = 0.729 -> S = 0.729
    s_single, c_single = aggregate_evidence_scores([(0.9, 0.05, 0.05, 0.9, 0.9)])
    assert s_single == pytest.approx(0.729, abs=0.01)


# 14. Malformed semantic-provider output validation
def test_malformed_semantic_provider_validation():
    """Verify that EvidenceAssessmentResponse strictly rejects probabilities not summing to 1.0."""
    # Valid output
    valid = EvidenceAssessmentResponse(
        p_entailment=0.8,
        p_contradiction=0.1,
        p_neutral=0.1,
        explanation="Direct factual support.",
    )
    assert valid.p_entailment + valid.p_contradiction + valid.p_neutral == pytest.approx(1.0)

    # Malformed output where sum exceeds 1.0 significantly
    with pytest.raises(ValidationError):
        EvidenceAssessmentResponse(
            p_entailment=0.9,
            p_contradiction=0.9,
            p_neutral=0.5,
            explanation="Invalid probabilities.",
        )


# 15. Public API compatibility
def test_public_api_compatibility_via_pipeline(pipeline):
    """Verify that AnalyzeRequest with raw strings or structured dicts produces FinalReport."""
    req = AnalyzeRequest(
        response_text="Python 3.12 is the latest stable release of Python.",
        context_documents=[
            "Python 3.12 is officially released and is now the latest stable version."
        ],
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    assert report.total_claims >= 1
    assert report.supported_claims >= 1
    assert report.claim_results[0].verification.verdict == VerificationVerdict.SUPPORTED
