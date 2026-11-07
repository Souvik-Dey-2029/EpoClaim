"""Benchmark runner for automated freshness and staleness evaluation."""
from __future__ import annotations

import uuid
import logging
from typing import List, Optional
from app.schemas.evaluation import EvaluationScenario, BenchmarkReport
from app.schemas.report import AnalyzeRequest
from app.services.pipeline import EpoClaimPipeline
from app.evaluation.scenarios import get_default_benchmark_scenarios
from app.evaluation.metrics import compute_freshness_metrics, TokenChecker

logger = logging.getLogger(__name__)


class BenchmarkRunner:
    """Executes EpoClaim against temporal scenarios and aggregates benchmark results."""

    def __init__(self, pipeline: Optional[EpoClaimPipeline] = None):
        self.pipeline = pipeline or EpoClaimPipeline()
        self.checker = TokenChecker()

    async def run_benchmark(
        self,
        scenarios: Optional[List[EvaluationScenario]] = None,
        max_scenarios: int = 5,
        enable_correlation_discounting: Optional[bool] = None,
        temporal_evaluation_mode: Optional[str] = None,
    ) -> BenchmarkReport:
        """Run the benchmark evaluation across test scenarios."""
        target_scenarios = (scenarios or get_default_benchmark_scenarios())[:max_scenarios]
        benchmark_id = f"bmk_{uuid.uuid4().hex[:8]}"

        results = []

        for scen in target_scenarios:
            # 1. Test Stale Claim
            stale_req = AnalyzeRequest(
                response_text=scen.original_claim,
                context_documents=scen.context_docs,
                enable_live_search=False,  # Use controlled scenario context docs
                enable_correlation_discounted_scoring=enable_correlation_discounting,
                temporal_evaluation_mode=temporal_evaluation_mode or "default",
            )
            stale_report = await self.pipeline.run(stale_req)
            stale_verdict = (
                stale_report.claim_results[0].verification.verdict.value
                if stale_report.claim_results
                else "UNKNOWN"
            )

            results.append({
                "scenario_id": scen.scenario_id,
                "test_type": "stale",
                "claim": scen.original_claim,
                "expected_verdict": scen.expected_stale_verdict,
                "predicted_verdict": stale_verdict,
                "passed": (stale_verdict == scen.expected_stale_verdict)
                or (scen.expected_stale_verdict == "OUTDATED" and stale_verdict in {"OUTDATED", "CONTRADICTED"}),
            })

            # 2. Test Updated / Fresh Claim
            fresh_req = AnalyzeRequest(
                response_text=scen.updated_claim,
                context_documents=scen.context_docs,
                enable_live_search=False,
                enable_correlation_discounted_scoring=enable_correlation_discounting,
                temporal_evaluation_mode=temporal_evaluation_mode or "default",
            )
            fresh_report = await self.pipeline.run(fresh_req)
            fresh_verdict = (
                fresh_report.claim_results[0].verification.verdict.value
                if fresh_report.claim_results
                else "UNKNOWN"
            )

            results.append({
                "scenario_id": scen.scenario_id,
                "test_type": "fresh",
                "claim": scen.updated_claim,
                "expected_verdict": scen.expected_fresh_verdict,
                "predicted_verdict": fresh_verdict,
                "passed": fresh_verdict == scen.expected_fresh_verdict,
            })

        # Calculate metrics
        metrics = compute_freshness_metrics(results)

        summary = (
            f"Benchmark {benchmark_id}: Evaluated {len(target_scenarios)} scenarios ({len(results)} runs). "
            f"Parent Accuracy: {metrics.get('parent_verdict_accuracy', 1.0)*100:.1f}%, "
            f"Stale Detection: {metrics['stale_detection_rate']*100:.1f}%, "
            f"Fresh Acceptance: {metrics['fresh_acceptance_rate']*100:.1f}%, "
            f"Abstention: {metrics.get('abstention_rate', 1.0)*100:.1f}%, "
            f"Wilson 95% CI: [{metrics['recovery_rate_ci_95'][0]:.2f}, {metrics['recovery_rate_ci_95'][1]:.2f}]."
        )

        return BenchmarkReport(
            benchmark_id=benchmark_id,
            total_scenarios=len(target_scenarios),
            recovery_rate=metrics["recovery_rate"],
            recovery_rate_ci_95=metrics["recovery_rate_ci_95"],
            mean_catch_up_latency=0.0,
            stale_detection_rate=metrics["stale_detection_rate"],
            fresh_acceptance_rate=metrics["fresh_acceptance_rate"],
            false_stale_detection_rate=metrics["false_stale_detection_rate"],
            parent_verdict_accuracy=metrics.get("parent_verdict_accuracy", 1.0),
            parent_verdict_accuracy_ci_95=metrics.get("parent_verdict_accuracy_ci_95", (1.0, 1.0)),
            abstention_rate=metrics.get("abstention_rate", 1.0),
            category_metrics=metrics.get("category_metrics", {}),
            scenario_results=results,
            summary=summary,
        )

