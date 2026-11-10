"""Tests for FastAPI endpoints, request limits, and error handling."""
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "EpoClaim"
    assert "integrations" in data


def test_empty_input_validation():
    response = client.post("/api/v1/analyze", json={"response_text": ""})
    assert response.status_code == 422


def test_analyze_endpoint_with_context():
    payload = {
        "prompt": "Who is the CEO of OpenAI?",
        "response_text": "Sam Altman is the CEO of OpenAI.",
        "context_documents": [
            "Sam Altman is the Chief Executive Officer of OpenAI, leading its artificial intelligence research."
        ],
        "enable_live_search": False,
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    report = response.json()
    assert "report_id" in report
    assert report["total_claims"] >= 1
    assert report["supported_claims"] >= 1

    # Fetch previously created report
    report_id = report["report_id"]
    get_res = client.get(f"/api/v1/analysis/{report_id}")
    assert get_res.status_code == 200
    assert get_res.json()["report_id"] == report_id


def test_analysis_not_found():
    response = client.get("/api/v1/analysis/non_existent_id_12345")
    assert response.status_code == 404


def test_evaluate_benchmark_endpoint():
    payload = {"scenario_count": 2}
    response = client.post("/api/v1/evaluate", json=payload)
    assert response.status_code == 200
    report = response.json()
    assert "benchmark_id" in report
    assert report["total_scenarios"] == 2
    assert "stale_detection_rate" in report


def test_api_key_authentication_enforcement():
    from app.core.config import settings
    # Test with auth enabled
    orig_key = settings.api_key
    try:
        settings.api_key = "secure-test-token"

        # Request without key fails with 401
        res_no_key = client.post("/api/v1/analyze", json={"response_text": "Test statement"})
        assert res_no_key.status_code == 401
        assert "Invalid or missing API key" in res_no_key.json()["detail"]

        # Request with bad key fails with 401
        res_bad_key = client.post(
            "/api/v1/analyze",
            json={"response_text": "Test statement"},
            headers={"X-API-Key": "wrong-token"}
        )
        assert res_bad_key.status_code == 401

        # Request with correct X-API-Key succeeds validation (returns 200 or handles pipeline)
        res_good_header = client.post(
            "/api/v1/analyze",
            json={"response_text": "Test statement", "enable_live_search": False, "context_documents": ["Test statement"]},
            headers={"X-API-Key": "secure-test-token"}
        )
        assert res_good_header.status_code == 200

        # Request with Bearer token succeeds
        res_bearer = client.post(
            "/api/v1/analyze",
            json={"response_text": "Test statement", "enable_live_search": False, "context_documents": ["Test statement"]},
            headers={"Authorization": "Bearer secure-test-token"}
        )
        assert res_bearer.status_code == 200

        # Public health check still works without auth
        res_health = client.get("/api/v1/health")
        assert res_health.status_code == 200
        assert res_health.json()["auth_enabled"] is True

    finally:
        settings.api_key = orig_key


def test_tavily_budget_endpoint_exposure_check():
    """Verify that unauthorized requests cannot modify the Tavily budget via HTTP."""
    # Attempting POST to budget modification endpoints should be 404 (non-existent) or 405
    res_bump = client.post("/api/v1/tavily/budget", json={"new_cap": 600})
    assert res_bump.status_code in (404, 405)

    res_bump2 = client.post("/api/v1/tavily/increase-budget", json={"new_cap": 600})
    assert res_bump2.status_code in (404, 405)

