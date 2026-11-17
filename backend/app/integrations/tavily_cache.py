"""Persistent, parameter-hashed query cache for Tavily search results.

Prevents duplicate credit consumption by caching normalized results in database.
Default TTL: 24 hours (configurable).
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.temporal import parse_datetime, utc_now
from app.storage.db import DatabaseManager, db_manager

logger = logging.getLogger(__name__)


class TavilySearchCache:
    """Stores and retrieves search results keyed on canonicalized query parameters."""

    def __init__(self, db_path: Optional[str] = None, db: Optional[DatabaseManager] = None):
        if db_path is not None:
            self.db = DatabaseManager(url=db_path)
        else:
            self.db = db or db_manager
        self.db.init_schema()

    def compute_cache_key(self, query: str, search_depth: str, max_results: int) -> str:
        """Create deterministic SHA256 key from normalized parameters."""
        norm_query = " ".join(query.lower().strip().split())
        canonical_str = f"query={norm_query}|depth={search_depth.lower()}|max={max_results}"
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def get(self, query: str, search_depth: str = "basic", max_results: int = 5) -> Optional[List[Dict[str, Any]]]:
        """Fetch cached results if present and not expired."""
        key = self.compute_cache_key(query, search_depth, max_results)
        try:
            with self.db.cursor() as cur:
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
                expires_at = parse_datetime(str(expires_str))
                if expires_at and expires_at <= utc_now():
                    cur.execute("DELETE FROM tavily_search_cache WHERE cache_key = ?", (key,))
                    return None

                results_val = row["results_json"]
                if isinstance(results_val, str):
                    data = json.loads(results_val)
                elif isinstance(results_val, list):
                    data = results_val
                else:
                    data = json.loads(str(results_val))
                return data if isinstance(data, list) else None
        except Exception as exc:
            logger.warning(f"Error querying tavily_search_cache: {exc}")
            return None

    def set(
        self,
        query: str,
        results: List[Dict[str, Any]],
        search_depth: str = "basic",
        max_results: int = 5,
        ttl_hours: Optional[float] = None,
    ) -> None:
        """Cache results with expiration timestamp."""
        key = self.compute_cache_key(query, search_depth, max_results)
        ttl = ttl_hours if ttl_hours is not None else settings.tavily_cache_ttl_hours
        from datetime import timedelta
        expires_at = utc_now() + timedelta(hours=ttl)
        results_json = json.dumps(results)

        upsert_sql = """
        INSERT INTO tavily_search_cache (cache_key, query_text, search_depth, max_results, results_json, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (cache_key) DO UPDATE SET
            results_json = EXCLUDED.results_json,
            expires_at = EXCLUDED.expires_at,
            created_at = CURRENT_TIMESTAMP
        """

        try:
            with self.db.cursor() as cur:
                cur.execute(
                    upsert_sql,
                    (key, query.strip(), search_depth, max_results, results_json, expires_at.isoformat()),
                )
        except Exception as exc:
            logger.warning(f"Failed to persist cache entry for query '{query}': {exc}")

    def get_stats(self) -> Dict[str, Any]:
        """Return cache statistics including active unexpired query count."""
        try:
            with self.db.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) as cnt FROM tavily_search_cache WHERE expires_at > ?",
                    (utc_now().isoformat(),),
                )
                row = cur.fetchone()
                active = row["cnt"] if row else 0
                return {"active_cached_queries": active}
        except Exception as exc:
            logger.warning(f"Failed to fetch cache stats: {exc}")
            return {"active_cached_queries": 0}

    def clear(self) -> None:
        """Purge all cached results."""
        try:
            with self.db.cursor() as cur:
                cur.execute("DELETE FROM tavily_search_cache")
        except Exception as exc:
            logger.warning(f"Failed to clear tavily_search_cache: {exc}")


# Global search cache instance
tavily_cache = TavilySearchCache()
