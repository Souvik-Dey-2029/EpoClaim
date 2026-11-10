"""Python client for EpoClaim API (supports both synchronous and asynchronous operations)."""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Union
import httpx

from .errors import (
    EpoClaimError,
    EpoClaimAPIError,
    EpoClaimAuthenticationError,
    EpoClaimNotFoundError,
    EpoClaimValidationError,
    EpoClaimPayloadTooLargeError,
    EpoClaimTimeoutError,
    EpoClaimNetworkError,
)


class EpoClaim:
    """Client for interacting with the EpoClaim Temporal Verification Platform."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        self.base_url = (
            base_url
            or os.getenv("EPOCLAIM_BASE_URL")
            or "http://localhost:8000"
        ).rstrip("/")
        self.api_key = api_key or os.getenv("EPOCLAIM_API_KEY")
        self.timeout = timeout
        self._custom_client = http_client

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        try:
            data = response.json()
        except Exception:
            data = None

        if response.is_success:
            return data if isinstance(data, dict) else {"data": data}

        detail = ""
        if isinstance(data, dict) and "detail" in data:
            detail = str(data["detail"])
        else:
            detail = response.text or f"HTTP {response.status_code}"

        if response.status_code == 401:
            raise EpoClaimAuthenticationError(detail, response_body=data)
        elif response.status_code == 404:
            raise EpoClaimNotFoundError(detail, response_body=data)
        elif response.status_code == 413:
            raise EpoClaimPayloadTooLargeError(detail, response_body=data)
        elif response.status_code == 422:
            raise EpoClaimValidationError(detail, response_body=data)
        else:
            raise EpoClaimAPIError(response.status_code, detail, response_body=data)

    def analyze(
        self,
        response_text: str,
        prompt: Optional[str] = None,
        context_documents: Optional[List[Union[str, Dict[str, Any]]]] = None,
        enable_live_search: bool = True,
        reference_date: Optional[str] = None,
        temporal_evaluation_mode: str = "default",
        as_known_cutoff: Optional[str] = None,
        target_event_time: Optional[str] = None,
        enable_correlation_discounted_scoring: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Submit an AI-generated answer for factual verification and temporal analysis."""
        if not response_text or not isinstance(response_text, str) or not response_text.strip():
            raise EpoClaimValidationError("response_text must be a non-empty string.")

        payload: Dict[str, Any] = {
            "response_text": response_text,
            "enable_live_search": enable_live_search,
        }
        if prompt is not None:
            payload["prompt"] = prompt
        if context_documents is not None:
            payload["context_documents"] = context_documents
        if reference_date is not None:
            payload["reference_date"] = reference_date
        if temporal_evaluation_mode:
            payload["temporal_evaluation_mode"] = temporal_evaluation_mode
        if as_known_cutoff is not None:
            payload["as_known_cutoff"] = as_known_cutoff
        if target_event_time is not None:
            payload["target_event_time"] = target_event_time
        if enable_correlation_discounted_scoring is not None:
            payload["enable_correlation_discounted_scoring"] = enable_correlation_discounted_scoring

        url = f"{self.base_url}/api/v1/analyze"
        client = self._custom_client or httpx.Client(timeout=self.timeout)

        try:
            resp = client.post(url, json=payload, headers=self._get_headers())
            return self._handle_response(resp)
        except httpx.TimeoutException:
            raise EpoClaimTimeoutError(self.timeout)
        except httpx.RequestError as exc:
            raise EpoClaimNetworkError(str(exc), cause=exc)
        finally:
            if not self._custom_client:
                client.close()

    def get_report(self, report_id: str) -> Dict[str, Any]:
        """Retrieve a previously generated analysis report by ID."""
        if not report_id or not isinstance(report_id, str) or not report_id.strip():
            raise EpoClaimValidationError("report_id must be a non-empty string.")

        url = f"{self.base_url}/api/v1/analysis/{report_id.strip()}"
        client = self._custom_client or httpx.Client(timeout=self.timeout)

        try:
            resp = client.get(url, headers=self._get_headers())
            return self._handle_response(resp)
        except httpx.TimeoutException:
            raise EpoClaimTimeoutError(self.timeout)
        except httpx.RequestError as exc:
            raise EpoClaimNetworkError(str(exc), cause=exc)
        finally:
            if not self._custom_client:
                client.close()

    def health(self) -> Dict[str, Any]:
        """Check EpoClaim backend health and integrations."""
        url = f"{self.base_url}/api/v1/health"
        client = self._custom_client or httpx.Client(timeout=self.timeout)

        try:
            resp = client.get(url, headers=self._get_headers())
            return self._handle_response(resp)
        except httpx.TimeoutException:
            raise EpoClaimTimeoutError(self.timeout)
        except httpx.RequestError as exc:
            raise EpoClaimNetworkError(str(exc), cause=exc)
        finally:
            if not self._custom_client:
                client.close()

    def get_tavily_status(self) -> Dict[str, Any]:
        """Retrieve Tavily credit ledger and search status."""
        url = f"{self.base_url}/api/v1/tavily/status"
        client = self._custom_client or httpx.Client(timeout=self.timeout)

        try:
            resp = client.get(url, headers=self._get_headers())
            return self._handle_response(resp)
        except httpx.TimeoutException:
            raise EpoClaimTimeoutError(self.timeout)
        except httpx.RequestError as exc:
            raise EpoClaimNetworkError(str(exc), cause=exc)
        finally:
            if not self._custom_client:
                client.close()


class AsyncEpoClaim:
    """Asynchronous client for interacting with EpoClaim API using httpx.AsyncClient."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = (
            base_url
            or os.getenv("EPOCLAIM_BASE_URL")
            or "http://localhost:8000"
        ).rstrip("/")
        self.api_key = api_key or os.getenv("EPOCLAIM_API_KEY")
        self.timeout = timeout
        self._custom_client = http_client

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        try:
            data = response.json()
        except Exception:
            data = None

        if response.is_success:
            return data if isinstance(data, dict) else {"data": data}

        detail = ""
        if isinstance(data, dict) and "detail" in data:
            detail = str(data["detail"])
        else:
            detail = response.text or f"HTTP {response.status_code}"

        if response.status_code == 401:
            raise EpoClaimAuthenticationError(detail, response_body=data)
        elif response.status_code == 404:
            raise EpoClaimNotFoundError(detail, response_body=data)
        elif response.status_code == 413:
            raise EpoClaimPayloadTooLargeError(detail, response_body=data)
        elif response.status_code == 422:
            raise EpoClaimValidationError(detail, response_body=data)
        else:
            raise EpoClaimAPIError(response.status_code, detail, response_body=data)

    async def analyze(
        self,
        response_text: str,
        prompt: Optional[str] = None,
        context_documents: Optional[List[Union[str, Dict[str, Any]]]] = None,
        enable_live_search: bool = True,
        reference_date: Optional[str] = None,
        temporal_evaluation_mode: str = "default",
        as_known_cutoff: Optional[str] = None,
        target_event_time: Optional[str] = None,
        enable_correlation_discounted_scoring: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Asynchronously submit an AI-generated answer for verification."""
        if not response_text or not isinstance(response_text, str) or not response_text.strip():
            raise EpoClaimValidationError("response_text must be a non-empty string.")

        payload: Dict[str, Any] = {
            "response_text": response_text,
            "enable_live_search": enable_live_search,
        }
        if prompt is not None:
            payload["prompt"] = prompt
        if context_documents is not None:
            payload["context_documents"] = context_documents
        if reference_date is not None:
            payload["reference_date"] = reference_date
        if temporal_evaluation_mode:
            payload["temporal_evaluation_mode"] = temporal_evaluation_mode
        if as_known_cutoff is not None:
            payload["as_known_cutoff"] = as_known_cutoff
        if target_event_time is not None:
            payload["target_event_time"] = target_event_time
        if enable_correlation_discounted_scoring is not None:
            payload["enable_correlation_discounted_scoring"] = enable_correlation_discounted_scoring

        url = f"{self.base_url}/api/v1/analyze"
        client = self._custom_client or httpx.AsyncClient(timeout=self.timeout)

        try:
            resp = await client.post(url, json=payload, headers=self._get_headers())
            return self._handle_response(resp)
        except httpx.TimeoutException:
            raise EpoClaimTimeoutError(self.timeout)
        except httpx.RequestError as exc:
            raise EpoClaimNetworkError(str(exc), cause=exc)
        finally:
            if not self._custom_client:
                await client.aclose()

    async def get_report(self, report_id: str) -> Dict[str, Any]:
        """Asynchronously retrieve a previously generated report by ID."""
        if not report_id or not isinstance(report_id, str) or not report_id.strip():
            raise EpoClaimValidationError("report_id must be a non-empty string.")

        url = f"{self.base_url}/api/v1/analysis/{report_id.strip()}"
        client = self._custom_client or httpx.AsyncClient(timeout=self.timeout)

        try:
            resp = await client.get(url, headers=self._get_headers())
            return self._handle_response(resp)
        except httpx.TimeoutException:
            raise EpoClaimTimeoutError(self.timeout)
        except httpx.RequestError as exc:
            raise EpoClaimNetworkError(str(exc), cause=exc)
        finally:
            if not self._custom_client:
                await client.aclose()

    async def health(self) -> Dict[str, Any]:
        """Asynchronously check EpoClaim health."""
        url = f"{self.base_url}/api/v1/health"
        client = self._custom_client or httpx.AsyncClient(timeout=self.timeout)

        try:
            resp = await client.get(url, headers=self._get_headers())
            return self._handle_response(resp)
        except httpx.TimeoutException:
            raise EpoClaimTimeoutError(self.timeout)
        except httpx.RequestError as exc:
            raise EpoClaimNetworkError(str(exc), cause=exc)
        finally:
            if not self._custom_client:
                await client.aclose()

