"""EpoClaim unified data schemas."""
from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.schemas.verification import VerificationVerdict, VerificationResult
from app.schemas.freshness import FreshnessStatus, FreshnessResult
from app.schemas.report import FinalReport, ClaimAnalysisDetail, AnalyzeRequest
from app.schemas.evaluation import EvaluationScenario, MetricResult, BenchmarkReport, EvaluateRequest

__all__ = [
    "AtomicClaim",
    "TemporalSensitivity",
    "EvidenceRecord",
    "RetrievalMethod",
    "VerificationVerdict",
    "VerificationResult",
    "FreshnessStatus",
    "FreshnessResult",
    "FinalReport",
    "ClaimAnalysisDetail",
    "AnalyzeRequest",
    "EvaluationScenario",
    "MetricResult",
    "BenchmarkReport",
    "EvaluateRequest",
]

