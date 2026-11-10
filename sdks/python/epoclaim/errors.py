"""Exceptions for the EpoClaim Python SDK."""
from __future__ import annotations

from typing import Any, Optional


class EpoClaimError(Exception):
    """Base exception for all EpoClaim SDK errors."""
    pass


class EpoClaimAPIError(EpoClaimError):
    """Exception raised when the EpoClaim API returns a non-2xx HTTP status code."""

    def __init__(self, status_code: int, message: str, response_body: Optional[Any] = None) -> None:
        super().__init__(f"EpoClaim API Error [HTTP {status_code}]: {message}")
        self.status_code = status_code
        self.message = message
        self.response_body = response_body


class EpoClaimAuthenticationError(EpoClaimAPIError):
    """Exception raised on HTTP 401 Unauthorized."""
    def __init__(self, message: str, response_body: Optional[Any] = None) -> None:
        super().__init__(401, message, response_body)


class EpoClaimNotFoundError(EpoClaimAPIError):
    """Exception raised on HTTP 404 Not Found."""
    def __init__(self, message: str, response_body: Optional[Any] = None) -> None:
        super().__init__(404, message, response_body)


class EpoClaimValidationError(EpoClaimAPIError):
    """Exception raised on HTTP 422 Unprocessable Entity or client-side validation."""
    def __init__(self, message: str, response_body: Optional[Any] = None) -> None:
        super().__init__(422, message, response_body)


class EpoClaimPayloadTooLargeError(EpoClaimAPIError):
    """Exception raised on HTTP 413 Payload Too Large."""
    def __init__(self, message: str, response_body: Optional[Any] = None) -> None:
        super().__init__(413, message, response_body)


class EpoClaimTimeoutError(EpoClaimError):
    """Exception raised when an API request times out."""

    def __init__(self, timeout_seconds: float) -> None:
        super().__init__(f"EpoClaim request timed out after {timeout_seconds} seconds.")
        self.timeout_seconds = timeout_seconds


class EpoClaimNetworkError(EpoClaimError):
    """Exception raised on network failure or unreachable host."""

    def __init__(self, message: str, cause: Optional[Exception] = None) -> None:
        super().__init__(f"EpoClaim Network Error: {message}")
        self.cause = cause

