"""Persistent, parameter-hashed query cache for Tavily search results.

Prevents duplicate credit consumption by caching normalized results in SQLite.
Default TTL: 24 hours (configurable).
"""
from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from pathlib import Path

from app.core.config import settings
from app.core.temporal import parse_datetime, utc_now

logger = logging.getLogger(__name__)


def _get_db_path() -> str:
    url = settings.database_url
    if url.startswith("sqlite:///"):
        return url[len("sqlite:///"):]
    return "epoclaim.db"


class TavilySearchCache:
    """Stores and retrieves search results keyed on canonicalized query parameters."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or _get_db_path()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tavily_search_cache (
                    cache_key TEXT PRIMARY KEY,
                    query_text TEXT NOT NULL,
                    search_depth TEXT NOT NULL,
                    max_results INTEGER NOT NULL,
                    results_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL
                )
                """
            )
            conn.commit()

    def compute_cache_key(self, query: str, search_depth: str, max_results: int) -> str:
        """Create deterministic SHA256 key from normalized parameters."""
        norm_query = " ".join(query.lower().strip().split())
        canonical_str = f"query={norm_query}|depth={search_depth.lower()}|max={max_results}"
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def get(self, query: str, search_depth: str = "basic", max_results: int = 5) -> Optional[List[Dict[str, Any]]]:
        """Fetch cached results if present and not expired."""
        key = self.compute_cache_key(query, search_depth, max_results)
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT results_json, expires_at FROM tavily_search_cache WHERE cache_key = ?
                """,
                (key,),
            )
            row = cur.fetchone()
            if not row:
                return None

            expires_str = row["expires_at"]
            expires_at = parse_datetime(expires_str)
            if expires_at and expires_at <= utc_now():
                # Expired entry; delete asynchronously or on lookup
                cur.execute("DELETE FROM tavily_search_cache WHERE cache_key = ?", (key,))
                conn.commit()
                return None

            try:
                data = json.loads(row["results_json"])
                return data if isinstance(data, list) else None
            except Exception as exc:
                logger.warning(f"Malformed cached results in tavily_search_cache ({exc}); clearing entry.")
                cur.execute("DELETE FROM tavily_search_cache WHERE cache_key = ?", (key,))
                conn.commit()
                return None

    def set(
        self,
        query: str,
        results: List[Dict[str, Any]],
        search_depth: str = "basic",
        max_results: int = 5,
        ttl_hours: Optional[float] = None,
    ) -> None:
        """Cache search results with expiration timestamp."""
        ttl = ttl_hours if ttl_hours is not None else settings.tavily_cache_ttl_hours
        key = self.compute_cache_key(query, search_depth, max_results)
        expires_at = utc_now() + timedelta(hours=ttl)

        results_json = json.dumps(results)
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO tavily_search_cache (
                    cache_key, query_text, search_depth, max_results, results_json, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (key, query.strip(), search_depth, max_results, results_json, expires_at.isoformat()),
            )
            conn.commit()

    def get_stats(self) -> Dict[str, Any]:
        """Return total active cached queries count."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT count(*) as cnt FROM tavily_search_cache WHERE expires_at > CURRENT_TIMESTAMP")
            row = cur.fetchone()
            return {"active_cached_queries": row["cnt"] if row else 0}


# Global singleton cache instance
tavily_cache = TavilySearchCache()

