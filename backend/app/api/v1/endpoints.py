"""EpoClaim REST API endpoints (v1)."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.report import AnalyzeRequest, FinalReport
from app.schemas.evaluation import EvaluateRequest, BenchmarkReport
from app.services.pipeline import EpoClaimPipeline
from app.evaluation.runner import BenchmarkRunner
from app.storage.repository import report_repo
from app.storage.db import db_manager
from app.core.config import settings
from app.core.security import verify_developer_api_key
from app.integrations.tavily import tavily_client

# Core router containing endpoint handlers without prefix
v1_core_router = APIRouter(tags=["Analysis & Verification"])
pipeline = EpoClaimPipeline()
benchmark_runner = BenchmarkRunner(pipeline)


@v1_core_router.post("/analyze", response_model=FinalReport, status_code=status.HTTP_200_OK)
async def analyze_response(
    request: AnalyzeRequest,
    _auth: Optional[str] = Depends(verify_developer_api_key),
) -> FinalReport:
    """Analyze an AI-generated answer for factual correctness and temporal freshness."""
    logger.info(f"Analyze request received: {request.response_text[:50]}")
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


@v1_core_router.get("/tavily/status", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def tavily_status(
    _auth: Optional[str] = Depends(verify_developer_api_key),
) -> Dict[str, Any]:
    """Return backend-visible Tavily operational status, budget, and ledger statistics."""
    return tavily_client.get_operational_status()


@v1_core_router.get("/bifrost/status", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def bifrost_status(
    _auth: Optional[str] = Depends(verify_developer_api_key),
) -> Dict[str, Any]:
    """Return backend-visible Bifrost LLM gateway operational and connectivity status."""
    configured_url = settings.bifrost_base_url or settings.bifrost_endpoint
    is_prod = (
        settings.environment.lower() == "production"
        or bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    )
    is_loopback = any(h in configured_url.lower() for h in ["localhost", "127.0.0.1", "0.0.0.0"]) if configured_url else False

    if not configured_url:
        bifrost_state = "DISABLED"
        reason = "BIFROST_BASE_URL is not configured. Verification operates in deterministic local NLI mode."
    elif is_prod and is_loopback:
        bifrost_state = "BLOCKED"
        reason = (
            f"BIFROST_BASE_URL is set to a local loopback address ('{configured_url}'), "
            "which is unreachable from Render. A publicly routable gateway "
            "or tunnel endpoint is required for production LLM verification."
        )
    else:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                probe_url = configured_url.rstrip("/") + "/models"
                headers = {}
                if settings.bifrost_api_key:
                    headers["Authorization"] = f"Bearer {settings.bifrost_api_key}"
                resp = await client.get(probe_url, headers=headers)
                if resp.status_code in (200, 401, 403):
                    bifrost_state = "ONLINE"
                    reason = f"Gateway reachable (HTTP {resp.status_code})"
                else:
                    bifrost_state = "DEGRADED"
                    reason = f"Gateway returned HTTP {resp.status_code}"
        except Exception as exc:
            bifrost_state = "UNREACHABLE"
            reason = f"Connection failed ({type(exc).__name__}: {str(exc)})"

    return {
        "status": bifrost_state,
        "configured": bool(configured_url),
        "endpoint": configured_url,
        "model": settings.bifrost_model,
        "is_production": is_prod,
        "is_loopback": is_loopback,
        "reason": reason,
        "semantic_assessment_enabled": bool(settings.enable_llm_semantic_assessment),
        "decomposition_enabled": bool(settings.enable_llm_claim_decomposition),
        "correction_enabled": bool(settings.enable_llm_answer_correction),
    }


@v1_core_router.get("/health", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """Return application health, integration readiness, and environment status (Public)."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "auth_enabled": bool(settings.api_key.strip()),
        "storage": {
            "engine": "postgresql" if db_manager.is_postgres else "sqlite",
            "durable": db_manager.is_postgres,
        },
        "integrations": {
            "tavily_search": bool(settings.tavily_api_key),
            "storage_sqlite": not db_manager.is_postgres,
            "storage_postgres": db_manager.is_postgres,
            "dense_retrieval": True,
            "nli_verification": True,
        },
    }


@v1_core_router.get("/analysis/{report_id}", response_model=FinalReport, status_code=status.HTTP_200_OK)
async def get_analysis(
    report_id: str,
    _auth: Optional[str] = Depends(verify_developer_api_key),
) -> FinalReport:
    """Retrieve a previously generated analysis report by ID."""
    report = report_repo.get_report(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID '{report_id}' was not found.",
        )
    return report


@v1_core_router.post("/evaluate", response_model=BenchmarkReport, status_code=status.HTTP_200_OK)
async def evaluate_scenarios(
    request: EvaluateRequest,
    _auth: Optional[str] = Depends(verify_developer_api_key),
) -> BenchmarkReport:
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


# Primary /api/v1 router (standard public API prefix)
router = APIRouter(tags=["Analysis & Verification"])
router.include_router(v1_core_router)
