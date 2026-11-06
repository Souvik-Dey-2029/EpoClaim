"""Tests for temporal sensitivity classification and date reference handling."""
import sys
from pathlib import Path
from datetime import datetime, timezone
import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.services.temporal_analysis.service import TemporalAnalysisService
from app.services.claim_normalization.service import ClaimNormalizationService
from app.core.temporal import parse_datetime, compute_age_hours


@pytest.fixture
def temporal_service():
    return TemporalAnalysisService()


def test_classify_time_invariant_facts(temporal_service):
    claim = AtomicClaim(
        claim_id="1",
        original_text="Apollo 11 landed on the moon in 1969",
        normalized_text="Apollo 11 landed on the moon in 1969",
        entity="Apollo 11",
        attribute="landed on the moon",
        claimed_value="in 1969",
        temporal_reference="in 1969",
    )
    sens = temporal_service.classify_sensitivity(claim)
    assert sens == TemporalSensitivity.TIME_INVARIANT


def test_classify_fast_moving_facts(temporal_service):
    claim = AtomicClaim(
        claim_id="2",
        original_text="The latest release is version 2.4",
        normalized_text="The latest release is version 2.4",
        entity="Software",
        attribute="latest release",
        claimed_value="version 2.4",
    )
    sens = temporal_service.classify_sensitivity(claim)
    assert sens == TemporalSensitivity.FAST_MOVING


def test_classify_slow_moving_facts(temporal_service):
    claim = AtomicClaim(
        claim_id="3",
        original_text="Tim Cook is CEO of Apple",
        normalized_text="Tim Cook is CEO of Apple",
        entity="Apple",
        attribute="CEO",
        claimed_value="Tim Cook",
    )
    sens = temporal_service.classify_sensitivity(claim)
    assert sens == TemporalSensitivity.SLOW_MOVING


def test_temporal_anchor_extraction():
    normalizer = ClaimNormalizationService()
    claim = AtomicClaim(
        claim_id="4",
        original_text="In 2024, the law was amended",
        normalized_text="In 2024, the law was amended",
    )
    norm = normalizer.normalize(claim)
    assert norm.temporal_reference is not None
    assert "2024" in norm.temporal_reference


def test_datetime_parsing_and_age_hours():
    dt_iso = parse_datetime("2024-01-01T12:00:00Z")
    assert dt_iso is not None
    assert dt_iso.tzinfo == timezone.utc

    ref = parse_datetime("2024-01-02T12:00:00Z")
    age = compute_age_hours(dt_iso, ref)
    assert age == 24.0

