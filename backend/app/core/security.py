"""Security controls, input sanitization, and prompt-injection defenses."""
from __future__ import annotations

import re
import secrets
from typing import Any, Optional
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)


def verify_developer_api_key(
    header_key: Optional[str] = Security(api_key_header),
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Security(http_bearer),
) -> Optional[str]:
    """Verify incoming developer API key if server-side authentication is enabled.

    Accepts key via 'X-API-Key' header or 'Authorization: Bearer <key>'.
    If EPOCLAIM_API_KEY is not configured (empty), requests pass through freely (development default).
    If EPOCLAIM_API_KEY is configured, requests must supply a valid matching key.
    """
    configured_key = settings.api_key.strip()
    if not configured_key:
        return None  # No auth enforced in open dev mode

    supplied_key = header_key or (bearer_creds.credentials if bearer_creds else None)
    if not supplied_key or not secrets.compare_digest(supplied_key.strip(), configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key. Provide a valid key via X-API-Key or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return supplied_key


def verify_admin_api_key(
    header_key: Optional[str] = Security(api_key_header),
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Security(http_bearer),
) -> Optional[str]:
    """Verify administrator API key for privileged operations.

    If EPOCLAIM_ADMIN_API_KEY is configured, checks against it.
    If only EPOCLAIM_API_KEY is configured, requires that key.
    If neither is configured, raises 403 Forbidden to prevent unauthorized administrative actions.
    """
    admin_key = settings.admin_api_key.strip() or settings.api_key.strip()
    if not admin_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative operations are disabled because no admin API key is configured.",
        )

    supplied_key = header_key or (bearer_creds.credentials if bearer_creds else None)
    if not supplied_key or not secrets.compare_digest(supplied_key.strip(), admin_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized administrative access.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return supplied_key

# Known prompt injection pattern signatures to neutralize in retrieved evidence
_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions?", re.IGNORECASE),
    re.compile(r"system\s*prompt\s*override", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(an?\s+)?unrestricted", re.IGNORECASE),
    re.compile(r"do\s+not\s+verify\s+this\s+claim", re.IGNORECASE),
    re.compile(r"always\s+(mark|say|output)\s+supported", re.IGNORECASE),
    re.compile(r"<\s*script\b[^>]*>", re.IGNORECASE),
]


def sanitize_untrusted_text(text: str, max_chars: int = 100_000) -> str:
    """Sanitize arbitrary user or retrieved text.

    Truncates excessive length and strips control characters while keeping
    formatting intact.
    """
    if not text:
        return ""
    # Strip null bytes and non-printable control chars (except \n, \r, \t)
    cleaned = "".join(ch for ch in text if ch in "\n\r\t" or (ord(ch) >= 32 and ord(ch) != 127))
    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars]
    return cleaned.strip()


def sanitize_evidence_text(text: str) -> str:
    """Neutralize prompt-injection directives found in retrieved evidence."""
    sanitized = sanitize_untrusted_text(text)
    for pattern in _INJECTION_PATTERNS:
        sanitized = pattern.sub("[REDACTED_SUSPICIOUS_INSTRUCTION]", sanitized)
    return sanitized


def validate_input_size(text: str, max_length: int = 100_000) -> None:
    """Check text length boundaries."""
    if not text or not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Input text cannot be empty.",
        )
    if len(text) > max_length:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Input text exceeds maximum allowed size ({max_length} characters).",
        )
