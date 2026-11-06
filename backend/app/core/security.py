"""Security controls, input sanitization, and prompt-injection defenses."""
from __future__ import annotations

import re
from typing import Any
from fastapi import HTTPException, status

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
