"""Statistical metrics for freshness evaluation and confidence intervals."""
from __future__ import annotations

import math
import re
from typing import Dict, List, Tuple


def wilson_score_interval(k: int, n: int, z: float = 1.96) -> Tuple[float, float]:
    """Calculate the Wilson score confidence interval for a binomial proportion k/n.

    Args:
        k: Number of successes.
        n: Total number of trials.
        z: 1.96 for a 95% confidence interval.

    Returns:
        (lower_bound, upper_bound) clamped to [0.0, 1.0].
    """
    if n <= 0:
        return (0.0, 0.0)

    p = float(k) / float(n)
    denom = 1.0 + (z * z) / float(n)
    center = (p + (z * z) / (2.0 * float(n))) / denom
    half = (z * math.sqrt((p * (1.0 - p)) / float(n) + (z * z) / (4.0 * float(n) * float(n)))) / denom

    return (max(0.0, center - half), min(1.0, center + half))


class TokenChecker:
    """Robust token-level phrase matcher avoiding substring false positives.

    Ensures that short entities (like 'Park') are not mistakenly matched
    within larger words (like 'Parkinson').
    """

    def __init__(self):
        self._word_re = re.compile(r"[a-z0-9]+")

    def _tokenize(self, text: str) -> List[str]:
        return self._word_re.findall(text.lower())

    def contains_phrase(self, text: str, phrase: str) -> bool:
        """Check whether phrase appears as an exact sequence of whole tokens."""
        text_toks = self._tokenize(text)
        phrase_toks = self._tokenize(phrase)

        if not phrase_toks:
            return False
        if len(phrase_toks) > len(text_toks):
            return False

        p_len = len(phrase_toks)
        for i in range(len(text_toks) - p_len + 1):
            if text_toks[i : i + p_len] == phrase_toks:
                return True
        return False

    def classify_answer(self, answer: str, old_val: str, new_val: str) -> str:
        """Classify answer as OLD, NEW, BOTH, or OTHER."""
        has_old = self.contains_phrase(answer, old_val)
        has_new = self.contains_phrase(answer, new_val)

        if has_old and has_new:
            return "BOTH"
        if has_new:
            return "NEW"
        if has_old:
            return "OLD"
        return "OTHER"


def compute_freshness_metrics(
    eval_results: List[Dict[str, object]]
) -> Dict[str, object]:
    """Compute benchmark freshness metrics.

    Metrics:
    - Stale detection rate: Fraction of stale scenarios correctly flagged OUTDATED or CONTRADICTED
    - Fresh acceptance rate: Fraction of fresh scenarios correctly flagged SUPPORTED
    - False stale detection rate: Fraction of fresh scenarios incorrectly marked OUTDATED
    - Recovery rate: Fraction of updated facts successfully identified with new value
    """
    total = len(eval_results)
    if total == 0:
        return {
            "stale_detection_rate": 0.0,
            "fresh_acceptance_rate": 0.0,
            "false_stale_detection_rate": 0.0,
            "recovery_rate": 0.0,
            "recovery_rate_ci_95": (0.0, 0.0),
        }

    stale_tests = [r for r in eval_results if r.get("test_type") == "stale"]
    fresh_tests = [r for r in eval_results if r.get("test_type") == "fresh"]

    # Stale detection rate
    # Scenarios where old claim was expected to be OUTDATED or CONTRADICTED (or not specified)
    stale_expected_tests = [
        r for r in stale_tests if r.get("expected_verdict") in {"OUTDATED", "CONTRADICTED"} or "expected_verdict" not in r
    ]
    stale_detected = sum(
        1 for r in stale_expected_tests if r.get("predicted_verdict") in {"OUTDATED", "CONTRADICTED"}
    )
    stale_rate = stale_detected / max(1, len(stale_expected_tests))

    # Fresh acceptance rate
    fresh_accepted = sum(1 for r in fresh_tests if r.get("predicted_verdict") == "SUPPORTED")
    fresh_rate = fresh_accepted / max(1, len(fresh_tests))

    # False stale detection
    false_stale = sum(1 for r in fresh_tests if r.get("predicted_verdict") == "OUTDATED")
    false_stale_rate = false_stale / max(1, len(fresh_tests))

    # Recovery rate (fresh scenarios that succeeded)
    recovery_ci = wilson_score_interval(fresh_accepted, len(fresh_tests))

    # Overall Parent Verdict Accuracy across all runs
    total_passed = sum(1 for r in eval_results if r.get("passed") is True)
    parent_accuracy = total_passed / max(1, total)
    parent_accuracy_ci = wilson_score_interval(total_passed, total)

    # Abstention / Insufficient Evidence Performance
    insufficient_expected = [r for r in eval_results if r.get("expected_verdict") == "INSUFFICIENT_EVIDENCE"]
    insufficient_correct = sum(1 for r in insufficient_expected if r.get("predicted_verdict") == "INSUFFICIENT_EVIDENCE")
    abstention_rate = insufficient_correct / max(1, len(insufficient_expected)) if insufficient_expected else 1.0

    # Categorical breakdown
    categories = {}
    for r in eval_results:
        cat = r.get("scenario_id", "").split("_")[1] if "_" in r.get("scenario_id", "") else "general"
        if cat not in categories:
            categories[cat] = {"total": 0, "passed": 0}
        categories[cat]["total"] += 1
        if r.get("passed") is True:
            categories[cat]["passed"] += 1

    category_metrics = {
        cat: {
            "accuracy": round(data["passed"] / max(1, data["total"]), 4),
            "passed": data["passed"],
            "total": data["total"],
        }
        for cat, data in categories.items()
    }

    return {
        "stale_detection_rate": round(stale_rate, 4),
        "fresh_acceptance_rate": round(fresh_rate, 4),
        "false_stale_detection_rate": round(false_stale_rate, 4),
        "recovery_rate": round(fresh_rate, 4),
        "recovery_rate_ci_95": (round(recovery_ci[0], 4), round(recovery_ci[1], 4)),
        "parent_verdict_accuracy": round(parent_accuracy, 4),
        "parent_verdict_accuracy_ci_95": (round(parent_accuracy_ci[0], 4), round(parent_accuracy_ci[1], 4)),
        "abstention_rate": round(abstention_rate, 4),
        "category_metrics": category_metrics,
    }

