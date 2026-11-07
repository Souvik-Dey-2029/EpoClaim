"""Schemas for evaluation scenarios, benchmark metrics, and evaluation reports."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EvaluationScenario(BaseModel):
    """A parameterized test scenario representing an evolving fact."""
    scenario_id: str
    entity: str
    attribute: str
    old_value: str
    new_value: str
    change_date: str
    query: str
    original_claim: str
    updated_claim: str
    expected_stale_verdict: str = "OUTDATED"
    expected_fresh_verdict: str = "SUPPORTED"
    context_docs: List[Dict[str, Any]] = Field(default_factory=list)


class MetricResult(BaseModel):
    name: str
    score: Optional[float]
    confidence_interval: Optional[tuple[float, float]] = None
    reason: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BenchmarkReport(BaseModel):
    benchmark_id: str
    total_scenarios: int
    recovery_rate: float
    recovery_rate_ci_95: tuple[float, float]
    mean_catch_up_latency: float
    stale_detection_rate: float
    fresh_acceptance_rate: float
    false_stale_detection_rate: float
    parent_verdict_accuracy: float = 1.0
    parent_verdict_accuracy_ci_95: tuple[float, float] = (1.0, 1.0)
    abstention_rate: float = 1.0
    category_metrics: Dict[str, Any] = Field(default_factory=dict)
    scenario_results: List[Dict[str, Any]] = Field(default_factory=list)
    summary: str = ""


class EvaluateRequest(BaseModel):
    scenario_count: int = Field(default=5, ge=1, le=50)
    scenarios: Optional[List[EvaluationScenario]] = None

