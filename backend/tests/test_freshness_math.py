"""Mathematical verification tests for the half-life decay function."""
import math
import sys
from pathlib import Path
import pytest

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.freshness.decay import half_life_decay


def test_time_decay_at_zero_age():
    """F(0) must equal exactly 1.0."""
    assert half_life_decay(0.0, 168.0) == 1.0
    assert half_life_decay(-10.0, 168.0) == 1.0  # Future timestamps clamped to 1.0


def test_time_decay_at_one_half_life():
    """F(half_life) must equal exactly 0.5 (not 1/e!)."""
    half_life = 168.0
    score = half_life_decay(half_life, half_life)
    assert abs(score - 0.5) < 1e-9


def test_time_decay_at_two_half_lives():
    """F(2 * half_life) must equal exactly 0.25."""
    half_life = 168.0
    score = half_life_decay(2.0 * half_life, half_life)
    assert abs(score - 0.25) < 1e-9


def test_time_decay_at_three_half_lives():
    """F(3 * half_life) must equal exactly 0.125."""
    half_life = 50.0
    score = half_life_decay(150.0, half_life)
    assert abs(score - 0.125) < 1e-9


def test_very_old_evidence_asymptote():
    """Very old evidence approaches 0.0 asymptotically and stays non-negative."""
    half_life = 24.0
    score = half_life_decay(24000.0, half_life)  # 1000 half-lives
    assert score >= 0.0
    assert score < 1e-12


def test_invalid_or_zero_half_life():
    """Zero or negative half-life must not divide by zero and handle gracefully."""
    assert half_life_decay(10.0, 0.0) == 0.0
    assert half_life_decay(0.0, 0.0) == 1.0
    assert half_life_decay(10.0, -50.0) == 0.0


def test_score_is_strictly_bounded_unit_interval():
    """Decay score is always in [0.0, 1.0]."""
    test_cases = [
        (0.0, 100.0),
        (50.0, 100.0),
        (100.0, 100.0),
        (200.0, 100.0),
        (1e6, 100.0),
        (-100.0, 100.0),
    ]
    for age, hl in test_cases:
        score = half_life_decay(age, hl)
        assert 0.0 <= score <= 1.0

