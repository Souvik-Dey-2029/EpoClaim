"""Tests for EpoClaim Python SDK."""
import sys
from pathlib import Path
import pytest
import httpx

sdk_dir = Path(__file__).resolve().parent.parent
if str(sdk_dir) not in sys.path:
    sys.path.insert(0, str(sdk_dir))

from epoclaim import (
    EpoClaim,
    AsyncEpoClaim,
    EpoClaimValidationError,
    EpoClaimAuthenticationError,
    EpoClaimNotFoundError,
    EpoClaimPayloadTooLargeError,
    EpoClaimTimeoutError,
    EpoClaimNetworkError,
)


def test_python_client_init_and_validation():
    client = EpoClaim(base_url="http://mock-service")

    with pytest.raises(EpoClaimValidationError):
        client.analyze("")

    with pytest.raises(EpoClaimValidationError):
        client.analyze("   ")

    with pytest.raises(EpoClaimValidationError):
        client.get_report("")


def test_python_client_error_mapping():
    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v1/auth-fail":
            return httpx.Response(401, json={"detail": "Bad API key"}, request=request)
        if request.url.path == "/api/v1/not-found":
            return httpx.Response(404, json={"detail": "Report not found"}, request=request)
        if request.url.path == "/api/v1/large":
            return httpx.Response(413, json={"detail": "Payload too large"}, request=request)
        return httpx.Response(200, json={"status": "healthy"}, request=request)

    transport = httpx.MockTransport(mock_handler)
    mock_http = httpx.Client(transport=transport)
    client = EpoClaim(base_url="http://mock-service", http_client=mock_http)

    with pytest.raises(EpoClaimAuthenticationError):
        client._handle_response(mock_http.get("http://mock-service/api/v1/auth-fail"))

    with pytest.raises(EpoClaimNotFoundError):
        client._handle_response(mock_http.get("http://mock-service/api/v1/not-found"))

    with pytest.raises(EpoClaimPayloadTooLargeError):
        client._handle_response(mock_http.get("http://mock-service/api/v1/large"))


def test_python_client_analyze_and_report_success():
    mock_report = {
        "report_id": "rep_test_py_1",
        "original_input": "Python 3.12 is released.",
        "total_claims": 1,
        "supported_claims": 1,
        "overall_assessment": "Verified fact.",
        "claim_results": [],
    }

    def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-Key"] == "secret-key"
        assert request.headers["Authorization"] == "Bearer secret-key"
        if request.url.path == "/api/v1/analyze":
            return httpx.Response(200, json=mock_report, request=request)
        if request.url.path == "/api/v1/analysis/rep_test_py_1":
            return httpx.Response(200, json=mock_report, request=request)
        return httpx.Response(404, request=request)

    transport = httpx.MockTransport(mock_handler)
    mock_http = httpx.Client(transport=transport)
    client = EpoClaim(base_url="http://mock-service", api_key="secret-key", http_client=mock_http)

    res = client.analyze(response_text="Python 3.12 is released.")
    assert res["report_id"] == "rep_test_py_1"
    assert res["supported_claims"] == 1

    fetched = client.get_report("rep_test_py_1")
    assert fetched["report_id"] == "rep_test_py_1"

