"""Tests for NLI verification, temporal supersedence, and verdict classification."""
import sys
from pathlib import Path
from datetime import datetime, timezone
import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationVerdict
from app.schemas.freshness import FreshnessStatus
from app.services.claim_verification.service import ClaimVerificationService
from app.services.freshness.service import FreshnessService


@pytest.fixture
def verifier():
    return ClaimVerificationService()


@pytest.fixture
def freshness_service():
    return FreshnessService()


def test_supported_claim_verification(verifier):
    claim = AtomicClaim(
        claim_id="clm_1",
        original_text="Satya Nadella is CEO of Microsoft",
        normalized_text="Satya Nadella is CEO of Microsoft",
        entity="Microsoft",
        attribute="CEO",
        claimed_value="Satya Nadella",
    )
    evidence = [
        EvidenceRecord(
            evidence_id="ev_1",
            claim_id="clm_1",
            source_title="Microsoft Leadership",
            source_domain="microsoft.com",
            citation_text="Satya Nadella is the Chief Executive Officer of Microsoft.",
            verification_context="Satya Nadella leads Microsoft as Chairman and Chief Executive Officer.",
        )
    ]
    res, sup, contra = verifier.verify_claim(claim, evidence)
    assert res.verdict == VerificationVerdict.SUPPORTED
    assert len(sup) == 1
    assert len(contra) == 0


def test_insufficient_evidence(verifier):
    claim = AtomicClaim(
        claim_id="clm_2",
        original_text="Unknown Entity founded in 1700",
        normalized_text="Unknown Entity founded in 1700",
    )
    res, sup, contra = verifier.verify_claim(claim, [])
    assert res.verdict == VerificationVerdict.INSUFFICIENT_EVIDENCE
    assert res.evidence_ids == []


def test_outdated_claim_detection_via_temporal_supersedence(verifier, freshness_service):
    """When a claim was true in the past, but newer evidence contradicts it, it must be OUTDATED."""
    claim = AtomicClaim(
        claim_id="clm_3",
        original_text="Mira Murati is the CEO of OpenAI",
        normalized_text="Mira Murati is the CEO of OpenAI",
        entity="OpenAI",
        attribute="CEO",
        claimed_value="Mira Murati",
        temporal_sensitivity=TemporalSensitivity.SLOW_MOVING,
    )

    # Older supporting evidence (Nov 17, 2023)
    ev_old_support = EvidenceRecord(
        evidence_id="ev_old",
        claim_id="clm_3",
        source_title="Interim CEO Announced",
        source_domain="news.com",
        publication_date=datetime(2023, 11, 17, 12, 0, tzinfo=timezone.utc),
        citation_text="Mira Murati is appointed interim CEO of OpenAI.",
        verification_context="Mira Murati will serve as interim CEO of OpenAI effective immediately.",
    )

    # Newer contradicting evidence (Nov 29, 2023)
    ev_new_contra = EvidenceRecord(
        evidence_id="ev_new",
        claim_id="clm_3",
        source_title="Altman returns as CEO",
        source_domain="news.com",
        publication_date=datetime(2023, 11, 29, 18, 0, tzinfo=timezone.utc),
        citation_text="Sam Altman has returned as CEO of OpenAI; Murati stepped down from interim role.",
        verification_context="Sam Altman is reinstated as CEO of OpenAI, concluding the brief tenure of Mira Murati.",
    )

    res, sup, contra = verifier.verify_claim(claim, [ev_old_support, ev_new_contra])
    # Run through freshness service
    f_res, final_verdict = freshness_service.evaluate_freshness(
        claim, res, [ev_old_support], [ev_new_contra]
    )

    assert final_verdict == VerificationVerdict.OUTDATED
    assert f_res.freshness_status == FreshnessStatus.OUTDATED
    assert "OUTDATED" in f_res.explanation

