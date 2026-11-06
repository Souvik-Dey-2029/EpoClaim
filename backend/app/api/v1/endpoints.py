"""EpoClaim REST API endpoints (v1)."""
from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status

from app.schemas.report import AnalyzeRequest, FinalReport
from app.schemas.evaluation import EvaluateRequest, BenchmarkReport
from app.services.pipeline import EpoClaimPipeline
from app.evaluation.runner import BenchmarkRunner
from app.storage.repository import report_repo
from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["Analysis & Verification"])
pipeline = EpoClaimPipeline()
benchmark_runner = BenchmarkRunner(pipeline)


@router.post("/analyze", response_model=FinalReport, status_code=status.HTTP_200_OK)
async def analyze_response(request: AnalyzeRequest) -> FinalReport:
    """Analyze an AI-generated answer for factual correctness and temporal freshness."""
    try:
        report = await pipeline.run(request)
        return report
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis pipeline error: {str(exc)}",
        )


@router.get("/health", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """Return application health, integration readiness, and environment status."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "integrations": {
            "tavily_search": bool(settings.tavily_api_key),
            "storage_sqlite": True,
            "dense_retrieval": True,
            "nli_verification": True,
        },
    }


@router.get("/analysis/{report_id}", response_model=FinalReport, status_code=status.HTTP_200_OK)
async def get_analysis(report_id: str) -> FinalReport:
    """Retrieve a previously generated analysis report by ID."""
    report = report_repo.get_report(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID '{report_id}' was not found.",
        )
    return report


@router.post("/evaluate", response_model=BenchmarkReport, status_code=status.HTTP_200_OK)
async def evaluate_scenarios(request: EvaluateRequest) -> BenchmarkReport:
    """Run an automated freshness and staleness benchmark evaluation."""
    try:
        benchmark_result = await benchmark_runner.run_benchmark(
            scenarios=request.scenarios,
            max_scenarios=request.scenario_count,
        )
        return benchmark_result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Benchmark runner failure: {str(exc)}",
        )

