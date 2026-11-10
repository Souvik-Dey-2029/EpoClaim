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
    """Compute rigorous benchmark freshness metrics, Wilson confidence intervals, and breakdowns.

    Rules:
    - Never convert an undefined metric (denominator == 0) into 1.0 or 100%.
    - If denominator == 0, metric score is None and status is 'NOT_TESTED'.
    - Explicitly attribute Wilson intervals to their precise tested sub-populations:
      * recovery_rate_ci_95: strictly fresh trials (n_fresh)
      * parent_verdict_accuracy_ci_95: all evaluated trials (n_total)
    """
    total = len(eval_results)
    if total == 0:
        return {
            "stale_detection_rate": None,
            "fresh_acceptance_rate": None,
            "false_stale_detection_rate": None,
            "recovery_rate": None,
            "recovery_rate_ci_95": None,
            "parent_verdict_accuracy": None,
            "parent_verdict_accuracy_ci_95": None,
            "abstention_rate": None,
            "metrics_breakdown": {},
            "category_metrics": {},
        }

    stale_tests = [r for r in eval_results if r.get("test_type") == "stale"]
    fresh_tests = [r for r in eval_results if r.get("test_type") == "fresh"]

    # 1. Stale detection rate
    # Scenarios where old claim was expected to be OUTDATED or CONTRADICTED
    stale_expected_tests = [
        r for r in stale_tests if r.get("expected_verdict") in {"OUTDATED", "CONTRADICTED"} or "expected_verdict" not in r
    ]
    stale_denom = len(stale_expected_tests)
    stale_detected = sum(
        1 for r in stale_expected_tests if r.get("predicted_verdict") in {"OUTDATED", "CONTRADICTED"}
    )
    stale_rate = round(stale_detected / stale_denom, 4) if stale_denom > 0 else None

    # 2. Fresh acceptance rate (Fresh Supported Recall) & Conventional Fresh Precision
    # Eligible population for Fresh Acceptance / Supported Recall: fresh trials where expected verdict is SUPPORTED
    fresh_supported_expected = [
        r for r in fresh_tests if r.get("expected_verdict") == "SUPPORTED" or "expected_verdict" not in r
    ]
    fresh_denom = len(fresh_supported_expected)
    fresh_accepted = sum(1 for r in fresh_supported_expected if r.get("predicted_verdict") == "SUPPORTED")
    fresh_rate = round(fresh_accepted / fresh_denom, 4) if fresh_denom > 0 else None

    # Conventional Fresh Precision: of all fresh trials predicted as SUPPORTED, how many were actually expected SUPPORTED
    fresh_predicted_supported = [r for r in fresh_tests if r.get("predicted_verdict") == "SUPPORTED"]
    fresh_prec_denom = len(fresh_predicted_supported)
    fresh_precision = round(fresh_accepted / fresh_prec_denom, 4) if fresh_prec_denom > 0 else None
    fresh_prec_ci = wilson_score_interval(fresh_accepted, fresh_prec_denom) if fresh_prec_denom > 0 else None
    fresh_prec_ci_rounded = (round(fresh_prec_ci[0], 4), round(fresh_prec_ci[1], 4)) if fresh_prec_ci else None

    # 3. False stale detection & False alarm rate over fresh trials
    # False Stale: fresh trials mistakenly flagged as OUTDATED (temporal false alarm)
    # False Alarm (Strict): fresh trials mistakenly flagged as either OUTDATED or CONTRADICTED
    all_fresh_denom = len(fresh_tests)
    false_stale = sum(1 for r in fresh_tests if r.get("predicted_verdict") == "OUTDATED")
    false_stale_rate = round(false_stale / all_fresh_denom, 4) if all_fresh_denom > 0 else None
    false_stale_ci = wilson_score_interval(false_stale, all_fresh_denom) if all_fresh_denom > 0 else None
    false_stale_ci_rounded = (round(false_stale_ci[0], 4), round(false_stale_ci[1], 4)) if false_stale_ci else None

    false_alarm = sum(1 for r in fresh_tests if r.get("predicted_verdict") in {"OUTDATED", "CONTRADICTED"})
    false_alarm_rate = round(false_alarm / all_fresh_denom, 4) if all_fresh_denom > 0 else None
    false_alarm_ci = wilson_score_interval(false_alarm, all_fresh_denom) if all_fresh_denom > 0 else None
    false_alarm_ci_rounded = (round(false_alarm_ci[0], 4), round(false_alarm_ci[1], 4)) if false_alarm_ci else None

    # 4. Fresh Recovery Rate & Wilson 95% Confidence Interval (strictly over fresh supported trials)
    recovery_ci = wilson_score_interval(fresh_accepted, fresh_denom) if fresh_denom > 0 else None
    recovery_ci_rounded = (round(recovery_ci[0], 4), round(recovery_ci[1], 4)) if recovery_ci else None

    # 5. Exact vs. Policy-Normalized Accuracy across all trials
    exact_matches = sum(1 for r in eval_results if r.get("exact_match") is True or r.get("predicted_verdict") == r.get("expected_verdict"))
    exact_accuracy = round(exact_matches / total, 4) if total > 0 else None
    exact_accuracy_ci = wilson_score_interval(exact_matches, total) if total > 0 else None
    exact_accuracy_ci_rounded = (round(exact_accuracy_ci[0], 4), round(exact_accuracy_ci[1], 4)) if exact_accuracy_ci else None

    policy_normalized_matches = sum(1 for r in eval_results if r.get("policy_normalized_match") is True or r.get("passed") is True)
    normalized_accuracy = round(policy_normalized_matches / total, 4) if total > 0 else None
    normalized_accuracy_ci = wilson_score_interval(policy_normalized_matches, total) if total > 0 else None
    normalized_accuracy_ci_rounded = (round(normalized_accuracy_ci[0], 4), round(normalized_accuracy_ci[1], 4)) if normalized_accuracy_ci else None

    # Overall Parent Verdict Accuracy (defaults to policy_normalized_matches with exact transparently separated)
    parent_accuracy = normalized_accuracy
    parent_accuracy_ci_rounded = normalized_accuracy_ci_rounded

    # 6. Abstention Performance: Overall Abstention Rate vs. Abstention Fidelity
    # Overall Abstention Rate: proportion of ALL evaluated trials that returned INSUFFICIENT_EVIDENCE
    total_insufficient_predicted = sum(1 for r in eval_results if r.get("predicted_verdict") == "INSUFFICIENT_EVIDENCE")
    overall_abstention_rate = round(total_insufficient_predicted / total, 4) if total > 0 else None
    overall_abstention_ci = wilson_score_interval(total_insufficient_predicted, total) if total > 0 else None
    overall_abstention_ci_rounded = (round(overall_abstention_ci[0], 4), round(overall_abstention_ci[1], 4)) if overall_abstention_ci else None

    # Abstention Fidelity: proportion of trials EXPECTED to be INSUFFICIENT_EVIDENCE that correctly abstained
    insufficient_expected = [r for r in eval_results if r.get("expected_verdict") == "INSUFFICIENT_EVIDENCE"]
    abstention_denom = len(insufficient_expected)
    if abstention_denom > 0:
        insufficient_correct = sum(1 for r in insufficient_expected if r.get("predicted_verdict") == "INSUFFICIENT_EVIDENCE")
        abstention_fidelity = round(insufficient_correct / abstention_denom, 4)
        abstention_fidelity_ci = wilson_score_interval(insufficient_correct, abstention_denom)
        abstention_status = "MEASURED"
        abstention_expl = f"Evaluated across {abstention_denom} unverified/uncertain fact scenarios ({insufficient_correct} properly abstained)."
    else:
        insufficient_correct = 0
        abstention_fidelity = None
        abstention_fidelity_ci = None
        abstention_status = "NOT_TESTED"
        abstention_expl = "N/A — No unverified or insufficient-evidence scenarios present in current cohort."

    # 7. Confusion Matrix (Expected vs Predicted)
    all_verdicts = ["SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "OUTDATED", "INSUFFICIENT_EVIDENCE"]
    confusion_matrix: Dict[str, Dict[str, int]] = {ev: {pv: 0 for pv in all_verdicts} for ev in all_verdicts}
    for r in eval_results:
        exp = str(r.get("expected_verdict", "INSUFFICIENT_EVIDENCE"))
        pred = str(r.get("predicted_verdict", "INSUFFICIENT_EVIDENCE"))
        if exp not in confusion_matrix:
            confusion_matrix[exp] = {pv: 0 for pv in all_verdicts}
        if pred not in confusion_matrix[exp]:
            confusion_matrix[exp][pred] = 0
        confusion_matrix[exp][pred] += 1

    # 8. Structured metrics breakdown for transparent UI display
    metrics_breakdown = {
        "stale_detection": {
            "metric_name": "Stale Recall",
            "score": stale_rate,
            "numerator": stale_detected,
            "denominator": stale_denom,
            "population": "Stale / Outdated Trials (Expected OUTDATED or CONTRADICTED)",
            "ci_95": (round(wilson_score_interval(stale_detected, stale_denom)[0], 4), round(wilson_score_interval(stale_detected, stale_denom)[1], 4)) if stale_denom > 0 else None,
            "status": "MEASURED" if stale_denom > 0 else "NOT_TESTED",
            "explanation": "Proportion of superseded or outdated statements successfully flagged as OUTDATED/CONTRADICTED.",
        },
        "fresh_acceptance": {
            "metric_name": "Fresh Acceptance Rate",
            "score": fresh_rate,
            "numerator": fresh_accepted,
            "denominator": fresh_denom,
            "population": "Fresh Supported Trials (Expected SUPPORTED)",
            "ci_95": recovery_ci_rounded,
            "status": "MEASURED" if fresh_denom > 0 else "NOT_TESTED",
            "explanation": "Proportion of valid fresh assertions correctly confirmed as SUPPORTED (Fresh Supported Recall).",
        },
        "fresh_precision": {
            "metric_name": "Fresh Precision",
            "score": fresh_precision,
            "numerator": fresh_accepted,
            "denominator": fresh_prec_denom,
            "population": "Fresh Trials Predicted SUPPORTED",
            "ci_95": fresh_prec_ci_rounded,
            "status": "MEASURED" if fresh_prec_denom > 0 else "NOT_TESTED",
            "explanation": "Proportion of fresh assertions predicted as SUPPORTED that were truly expected to be SUPPORTED.",
        },
        "false_stale": {
            "metric_name": "False Stale Rate",
            "score": false_stale_rate,
            "numerator": false_stale,
            "denominator": all_fresh_denom,
            "population": "All Fresh / Valid Trials",
            "ci_95": false_stale_ci_rounded,
            "status": "MEASURED" if all_fresh_denom > 0 else "NOT_TESTED",
            "explanation": "Proportion of fresh assertions mistakenly degraded or flagged as expired/outdated.",
        },
        "false_alarm": {
            "metric_name": "False Alarm Rate (Strict)",
            "score": false_alarm_rate,
            "numerator": false_alarm,
            "denominator": all_fresh_denom,
            "population": "All Fresh / Valid Trials",
            "ci_95": false_alarm_ci_rounded,
            "status": "MEASURED" if all_fresh_denom > 0 else "NOT_TESTED",
            "explanation": "Proportion of fresh assertions falsely flagged as either OUTDATED or CONTRADICTED.",
        },
        "exact_accuracy": {
            "metric_name": "Exact Verdict Accuracy",
            "score": exact_accuracy,
            "numerator": exact_matches,
            "denominator": total,
            "population": "All Evaluated Trials",
            "ci_95": exact_accuracy_ci_rounded,
            "status": "MEASURED" if total > 0 else "NOT_TESTED",
            "explanation": "Proportion of trials where predicted verdict matched expected ground truth exactly (no policy normalization).",
        },
        "normalized_accuracy": {
            "metric_name": "Policy-Normalized Accuracy",
            "score": normalized_accuracy,
            "numerator": policy_normalized_matches,
            "denominator": total,
            "population": "All Evaluated Trials",
            "ci_95": normalized_accuracy_ci_rounded,
            "status": "MEASURED" if total > 0 else "NOT_TESTED",
            "explanation": "Proportion of trials matching ground truth under documented temporal policy equivalence (e.g. past state transition interval bounds).",
        },
        "parent_accuracy": {
            "metric_name": "Overall Verdict Accuracy",
            "score": parent_accuracy,
            "numerator": policy_normalized_matches,
            "denominator": total,
            "population": "All Evaluated Trials",
            "ci_95": parent_accuracy_ci_rounded,
            "status": "MEASURED" if total > 0 else "NOT_TESTED",
            "explanation": "Standard benchmark accuracy combining exact matches and validated policy-normalized equivalences.",
        },
        "abstention_rate": {
            "metric_name": "Overall Abstention Rate",
            "score": overall_abstention_rate,
            "numerator": total_insufficient_predicted,
            "denominator": total,
            "population": "All Evaluated Trials",
            "ci_95": overall_abstention_ci_rounded,
            "status": "MEASURED" if total > 0 else "NOT_TESTED",
            "explanation": "Proportion of all evaluated trials where the engine abstained and returned INSUFFICIENT_EVIDENCE.",
        },
        "abstention": {
            "metric_name": "Abstention Fidelity",
            "score": abstention_fidelity,
            "numerator": insufficient_correct,
            "denominator": abstention_denom,
            "population": "Unverifiable / Missing Evidence Trials (Expected INSUFFICIENT_EVIDENCE)",
            "ci_95": (round(abstention_fidelity_ci[0], 4), round(abstention_fidelity_ci[1], 4)) if abstention_fidelity_ci else None,
            "status": abstention_status,
            "explanation": abstention_expl,
        },
    }

    # Categorical breakdown
    categories = {}
    for r in eval_results:
        cat = r.get("scenario_id", "").split("_")[1] if "_" in r.get("scenario_id", "") else "general"
        if cat not in categories:
            categories[cat] = {"total": 0, "passed": 0, "exact_passed": 0}
        categories[cat]["total"] += 1
        if r.get("passed") is True or r.get("policy_normalized_pass") is True:
            categories[cat]["passed"] += 1
        if r.get("exact_pass") is True or r.get("exact_match") is True:
            categories[cat]["exact_passed"] += 1

    category_metrics = {
        cat: {
            "accuracy": round(data["passed"] / max(1, data["total"]), 4),
            "normalized_accuracy": round(data["passed"] / max(1, data["total"]), 4),
            "exact_accuracy": round(data.get("exact_passed", data["passed"]) / max(1, data["total"]), 4),
            "passed": data["passed"],
            "total": data["total"],
        }
        for cat, data in categories.items()
    }

    return {
        "stale_detection_rate": stale_rate,
        "fresh_acceptance_rate": fresh_rate,
        "fresh_precision": fresh_precision,
        "false_stale_detection_rate": false_stale_rate,
        "false_alarm_rate": false_alarm_rate,
        "recovery_rate": fresh_rate,
        "recovery_rate_ci_95": recovery_ci_rounded,
        "parent_verdict_accuracy": parent_accuracy,
        "parent_verdict_accuracy_ci_95": parent_accuracy_ci_rounded,
        "exact_verdict_accuracy": exact_accuracy,
        "exact_verdict_accuracy_ci_95": exact_accuracy_ci_rounded,
        "normalized_verdict_accuracy": normalized_accuracy,
        "normalized_verdict_accuracy_ci_95": normalized_accuracy_ci_rounded,
        "abstention_rate": overall_abstention_rate,
        "abstention_fidelity": abstention_fidelity,
        "confusion_matrix": confusion_matrix,
        "metrics_breakdown": metrics_breakdown,
        "category_metrics": category_metrics,
    }

