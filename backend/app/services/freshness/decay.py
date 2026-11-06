"""Mathematical half-life decay function for evidence age."""
from __future__ import annotations

import math


def half_life_decay(age: float, half_life: float) -> float:
    """Calculate exponential decay with a true half-life.

    Mathematical formulation:
        F(age) = 2^(-age / half_life)
    Equivalently:
        F(age) = exp(-ln(2) * age / half_life)

    Guarantees:
        F(0) = 1.0
        F(half_life) = 0.5
        F(2 * half_life) = 0.25
        Lim_{age -> inf} F(age) = 0.0

    Args:
        age: Age of evidence (e.g. In hours or days). Must be non-negative.
        half_life: Time interval at which freshness reduces to exactly 0.5.

    Returns:
        Freshness factor in [0.0, 1.0].
    """
    if half_life <= 0:
        return 0.0 if age > 0 else 1.0

    if age <= 0:
        return 1.0

    # True half-life decay formula
    score = math.pow(2.0, -float(age) / float(half_life))
    # Alternatively: math.exp(-math.log(2.0) * float(age) / float(half_life))

    return max(0.0, min(1.0, score))

