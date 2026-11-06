"""Tests for benchmark scenarios, Wilson confidence intervals, and token checker."""
import sys
from pathlib import Path
import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.evaluation.metrics import wilson_score_interval, TokenChecker, compute_freshness_metrics
from app.evaluation.scenarios import get_default_benchmark_scenarios


def test_wilson_interval_bounds():
    """Wilson interval at k=0, k=n, and intermediate k."""
    # Zero successes
    lo, hi = wilson_score_interval(0, 100)
    assert lo == 0.0
    assert 0.0 < hi < 0.05

    # 100% successes
    lo, hi = wilson_score_interval(100, 100)
    assert 0.95 < lo < 1.0
    assert abs(hi - 1.0) < 1e-9

    # 50% successes
    lo, hi = wilson_score_interval(50, 100)
    assert 0.40 < lo < 0.50
    assert 0.50 < hi < 0.60


def test_token_checker_no_substring_false_positives():
    """TokenChecker must NOT match 'Park' inside 'Parkinson'."""
    checker = TokenChecker()
    # 'Park' is inside 'Parkinson' as substring, but NOT as a whole token!
    assert not checker.contains_phrase("The director is Parkinson.", "David Park")
    assert not checker.contains_phrase("The director is Parkinson.", "Park")

    # Positive exact phrase match
    assert checker.contains_phrase("The director is David Park.", "David Park")
    assert checker.classify_answer("It is David Park now.", "Maria Lopez", "David Park") == "NEW"
    assert checker.classify_answer("Maria Lopez leads it.", "Maria Lopez", "David Park") == "OLD"


def test_default_scenarios_exist_and_valid():
    scenarios = get_default_benchmark_scenarios()
    assert len(scenarios) >= 5
    for s in scenarios:
        assert s.scenario_id
        assert s.entity
        assert s.original_claim
        assert s.updated_claim
        assert len(s.context_docs) > 0


def test_compute_freshness_metrics():
    mock_results = [
        {"test_type": "stale", "predicted_verdict": "OUTDATED"},
        {"test_type": "stale", "predicted_verdict": "CONTRADICTED"},
        {"test_type": "fresh", "predicted_verdict": "SUPPORTED"},
        {"test_type": "fresh", "predicted_verdict": "SUPPORTED"},
    ]
    metrics = compute_freshness_metrics(mock_results)
    assert metrics["stale_detection_rate"] == 1.0
    assert metrics["fresh_acceptance_rate"] == 1.0
    assert metrics["false_stale_detection_rate"] == 0.0
