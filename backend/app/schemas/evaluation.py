"""Schemas for evaluation scenarios, benchmark metrics, and evaluation reports."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EvaluationScenario(BaseModel):
    """A parameterized test scenario representing an evolving fact or failure-mode test."""
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
    domain: str = "general"
    failure_mode_category: str = "temporal_supersedence"
    expected_explanation: str = ""
    context_docs: List[Dict[str, Any]] = Field(default_factory=list)


class MetricDetail(BaseModel):
    """Detailed metric result with explicit numerator, denominator, and statistical status."""
    metric_name: str
    score: Optional[float] = None
    numerator: int = 0
    denominator: int = 0
    population: str = ""
    ci_95: Optional[tuple[float, float]] = None
    status: str = "MEASURED"  # MEASURED or NOT_TESTED
    explanation: str = ""


class MetricResult(BaseModel):
    name: str
    score: Optional[float]
    confidence_interval: Optional[tuple[float, float]] = None
    reason: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BenchmarkExecutionProvenance(BaseModel):
    """Truthful execution-mode metadata describing actual runtime paths."""
    retrieval_mode: str = "controlled_fixtures"  # controlled_fixtures | live_web
    semantic_mode: str = "deterministic_semantic"  # deterministic_semantic | llm_bifrost | hybrid
    bifrost_configured: bool = False
    bifrost_active: bool = False
    bifrost_model: Optional[str] = None
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    live_searches_executed: int = 0
    controlled_evidence_records_evaluated: int = 0


class ScenarioTrialResult(BaseModel):
    """Detailed audit trial output for a single evaluation scenario run."""
    scenario_id: str
    domain: str = "general"
    failure_mode_category: str = "temporal_supersedence"
    test_type: str  # stale | fresh
    claim: str
    expected_verdict: str
    predicted_verdict: str
    passed: bool
    exact_pass: bool = False
    policy_normalized_pass: bool = False
    exact_match: bool = False
    policy_normalized_match: bool = False
    equivalence_reason: Optional[str] = None
    expected_explanation: str = ""
    engine_explanation: str = ""
    evidence_excerpts: List[Dict[str, Any]] = Field(default_factory=list)
    propositions: Optional[List[Dict[str, Any]]] = None
    proposition_results: Optional[List[Dict[str, Any]]] = None
    temporal_metadata: Dict[str, Any] = Field(default_factory=dict)
    evaluation_as_of: Optional[str] = None
    execution_provenance: Optional[BenchmarkExecutionProvenance] = None


class BenchmarkReport(BaseModel):
    benchmark_id: str
    benchmark_timestamp: Optional[str] = None
    evaluation_as_of: Optional[str] = None
    total_scenarios: int
    total_trials: int = 0
    recovery_rate: Optional[float] = None
    recovery_rate_ci_95: Optional[tuple[float, float]] = None
    mean_catch_up_latency: float = 0.0
    stale_detection_rate: Optional[float] = None
    fresh_acceptance_rate: Optional[float] = None
    fresh_precision: Optional[float] = None
    false_stale_detection_rate: Optional[float] = None
    false_alarm_rate: Optional[float] = None
    parent_verdict_accuracy: Optional[float] = None
    parent_verdict_accuracy_ci_95: Optional[tuple[float, float]] = None
    exact_verdict_accuracy: Optional[float] = None
    exact_verdict_accuracy_ci_95: Optional[tuple[float, float]] = None
    normalized_verdict_accuracy: Optional[float] = None
    normalized_verdict_accuracy_ci_95: Optional[tuple[float, float]] = None
    abstention_rate: Optional[float] = None  # Overall rate (insufficient / total)
    abstention_fidelity: Optional[float] = None  # Fidelity (correctly abstained / expected insufficient)
    metrics_breakdown: Dict[str, MetricDetail] = Field(default_factory=dict)
    execution_provenance: Optional[BenchmarkExecutionProvenance] = None
    category_metrics: Dict[str, Any] = Field(default_factory=dict)
    confusion_matrix: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    scenario_results: List[Dict[str, Any]] = Field(default_factory=list)
    summary: str = ""


class EvaluateRequest(BaseModel):
    scenario_count: int = Field(default=5, ge=1, le=50)
    scenarios: Optional[List[EvaluationScenario]] = None

