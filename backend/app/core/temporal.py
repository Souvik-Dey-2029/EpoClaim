"""Temporal parsing, timezone-aware datetime manipulation, and time utilities."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def utc_now() -> datetime:
    """Return the current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def parse_datetime(value: Any, default: Optional[datetime] = None) -> Optional[datetime]:
    """Parse an ISO timestamp, datetime object, or unix epoch timestamp.

    All returned datetime objects are strictly timezone-aware in UTC.
    Naive datetime values are assumed to be in UTC.
    Never invents dates; returns default if value is None or unparseable.
    """
    if value is None or value == "":
        return default

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, (int, float)):
        try:
            raw = float(value)
            # Handle millisecond timestamps
            if raw > 1e12:
                raw = raw / 1000.0
            return datetime.fromtimestamp(raw, tz=timezone.utc)
        except (ValueError, OverflowError, OSError):
            return default

    text = str(value).strip()
    if not text:
        return default

    # Standardize UTC indicator
    cleaned = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(cleaned)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass

    # Try common fallback date patterns (YYYY-MM-DD)
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return default


def compute_age_hours(past_time: Optional[datetime], reference_time: Optional[datetime] = None) -> Optional[float]:
    """Calculate the age in hours between past_time and reference_time (default: now).

    Returns None if past_time is None.
    Negative values (future events) are clamped to 0.0.
    """
    if past_time is None:
        return None

    ref = reference_time or utc_now()
    if past_time.tzinfo is None:
        past_time = past_time.replace(tzinfo=timezone.utc)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)

    delta = ref - past_time
    age_seconds = delta.total_seconds()
    return max(0.0, age_seconds / 3600.0)

