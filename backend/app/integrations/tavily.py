"""Tavily search provider integration with strict credit budget protection.

Features:
- Official POST https://api.tavily.com/search endpoint.
- Strictly Basic Search (1 credit cost per query).
- Concurrency-safe atomic reservations in SQLite ledger.
- Persistent query caching (24h TTL) avoiding redundant queries.
- Application-side rate limiting (max 2 req/min).
- HTTP 429 Retry-After handling with safe backoff.
- Clear error disclosures without leaking API keys.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import httpx

from app.core.config import settings
from app.core.security import sanitize_evidence_text
from app.integrations.tavily_ledger import tavily_ledger, TavilyCreditLedger
from app.integrations.tavily_cache import tavily_cache, TavilySearchCache

logger = logging.getLogger(__name__)

TAVILY_API_URL = "https://api.tavily.com/search"


class TavilyRateLimiter:
    """Thread-safe and async-safe token/timestamp rate limiter.
    
    NOTE ON CONCURRENCY ARCHITECTURE:
    This rate limiter is process-local (in-memory lock and monotonic timestamp).
    For initial live-testing and controlled operation, EpoClaim must run with a single
    FastAPI/Uvicorn backend worker process. Multi-worker deployments would require a
    shared distributed store (such as Redis or SQLite locking) to coordinate request rates.
    """

    def __init__(self, requests_per_minute: int = 2):
        self.requests_per_minute = max(1, requests_per_minute)
        self.min_interval = 60.0 / float(self.requests_per_minute)
        self.last_request_time = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Wait if necessary to enforce the requests-per-minute ceiling."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_request_time
            if elapsed < self.min_interval:
                wait_time = self.min_interval - elapsed
                logger.info(f"Tavily rate limiter throttling request for {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
            self.last_request_time = time.monotonic()


class TavilySearchClient:
    """Client for Tavily Search API with credit reservation and caching."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        ledger: Optional[TavilyCreditLedger] = None,
        cache: Optional[TavilySearchCache] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.tavily_api_key
        self.is_configured = bool(self.api_key and self.api_key.strip())
        self.ledger = ledger or tavily_ledger
        self.cache = cache or tavily_cache
        self.rate_limiter = TavilyRateLimiter(settings.tavily_rate_limit_per_minute)

        # Operational statistics
        self.stats = {
            "cache_hits": 0,
            "successful_searches": 0,
            "failed_searches": 0,
            "blocked_searches": 0,
        }

    async def search(
        self,
        query: str,
        max_results: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Perform web search with credit reservation and caching.

        Returns:
            Dict containing:
                - "results": List[Dict[str, Any]]
                - "source": "cache" | "live" | "none"
                - "error": Optional[str]
                - "reservation_id": Optional[str]
        """
        clean_query = query.strip()
        if not clean_query:
            return {"results": [], "source": "none", "error": "Empty search query"}

        max_res = max_results or settings.tavily_max_results
        search_depth = "basic"  # Strictly Basic Search (1 credit)

        # 1. Check persistent cache
        cached_results = self.cache.get(clean_query, search_depth=search_depth, max_results=max_res)
        if cached_results is not None:
            self.stats["cache_hits"] += 1
            logger.info(f"Tavily cache hit for query: '{clean_query[:50]}'")
            return {
                "results": cached_results,
                "source": "cache",
                "error": None,
                "reservation_id": None,
            }

        # 2. Check API key configuration
        if not self.is_configured:
            logger.info("Tavily API key not configured; skipping live web search.")
            return {
                "results": [],
                "source": "none",
                "error": "Tavily API key is not configured.",
                "reservation_id": None,
            }

        # 3. Reserve credit in SQLite ledger before network call
        reserved, msg, res_id = self.ledger.reserve_credit(clean_query, cost=1)
        if not reserved:
            self.stats["blocked_searches"] += 1
            logger.warning(f"Tavily credit reservation blocked: {msg}")
            return {
                "results": [],
                "source": "none",
                "error": msg,
                "reservation_id": None,
            }

        # 4. Apply application-side rate limiting
        await self.rate_limiter.acquire()

        # 5. Execute HTTP Request
        payload = {
            "api_key": self.api_key,
            "query": clean_query[:400],  # Enforce < 400 char recommendation
            "search_depth": search_depth,
            "topic": "general",
            "include_answer": False,
            "include_raw_content": False,
            "include_images": False,
            "auto_parameters": False,
            "max_results": max_res,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(TAVILY_API_URL, json=payload)

                # Handle HTTP 429 Rate Limiting
                if resp.status_code == 429:
                    retry_after = resp.headers.get("Retry-After", "5")
                    err_msg = f"Tavily provider rate limit exceeded (HTTP 429). Retry-After: {retry_after}s."
                    self.ledger.release_reservation(res_id, reason="HTTP 429 rate limit (unprocessed)")
                    self.stats["failed_searches"] += 1
                    return {"results": [], "source": "none", "error": err_msg, "reservation_id": res_id}

                # Handle Authentication failures (401 / 403)
                if resp.status_code in {401, 403}:
                    err_msg = "Tavily authentication failure: invalid or unauthorized API key."
                    self.ledger.release_reservation(res_id, reason=f"HTTP {resp.status_code} Auth Failure")
                    self.stats["failed_searches"] += 1
                    return {"results": [], "source": "none", "error": err_msg, "reservation_id": res_id}

                # Handle Server Errors (5xx)
                if resp.status_code >= 500:
                    err_msg = f"Tavily upstream service error (HTTP {resp.status_code})."
                    self.ledger.release_reservation(res_id, reason=f"HTTP {resp.status_code} Upstream Error")
                    self.stats["failed_searches"] += 1
                    return {"results": [], "source": "none", "error": err_msg, "reservation_id": res_id}

                if resp.status_code == 200:
                    data = resp.json()
                    raw_results = data.get("results", [])
                    request_id = data.get("request_id")

                    normalized_results = []
                    for item in raw_results:
                        url = item.get("url", "").strip()
                        raw_content = item.get("content", "")
                        clean_content = sanitize_evidence_text(raw_content) if raw_content else ""

                        normalized_results.append({
                            "url": url,
                            "title": item.get("title", "").strip(),
                            "content": clean_content,
                            "published_date": item.get("published_date"),
                            "score": float(item.get("score", 0.7)),
                            "request_id": request_id,
                            "query": clean_query,
                            "provider": "tavily",
                        })

                    # Confirm credit consumption in ledger
                    self.ledger.confirm_usage(res_id, actual_cost=1)
                    self.stats["successful_searches"] += 1

                    # Cache normalized results
                    self.cache.set(clean_query, normalized_results, search_depth=search_depth, max_results=max_res)

                    return {
                        "results": normalized_results,
                        "source": "live",
                        "error": None,
                        "reservation_id": res_id,
                    }
                else:
                    err_msg = f"Tavily search returned unexpected HTTP status {resp.status_code}."
                    self.ledger.release_reservation(res_id, reason=err_msg)
                    self.stats["failed_searches"] += 1
                    return {"results": [], "source": "none", "error": err_msg, "reservation_id": res_id}

        except httpx.TimeoutException:
            # Request timed out mid-flight; mark as FAILED_CHARGED to protect budget conservatively
            err_msg = "Tavily search connection timed out."
            self.ledger.mark_failed_charged(res_id, error_msg=err_msg, actual_cost=1)
            self.stats["failed_searches"] += 1
            return {"results": [], "source": "none", "error": err_msg, "reservation_id": res_id}

        except Exception as exc:
            err_msg = f"Network or connection error communicating with Tavily: {str(exc)}"
            self.ledger.release_reservation(res_id, reason=err_msg)
            self.stats["failed_searches"] += 1
            return {"results": [], "source": "none", "error": err_msg, "reservation_id": res_id}

    def get_operational_status(self) -> Dict[str, Any]:
        """Return safe backend visibility metadata without secrets."""
        ledger_status = self.ledger.get_ledger_status()
        cache_stats = self.cache.get_stats()

        return {
            "configured": self.is_configured,
            "search_depth": settings.tavily_search_depth,
            "budget_cap": ledger_status["budget_cap"],
            "consumed_credits": ledger_status["consumed_credits"],
            "reserved_credits": ledger_status["reserved_credits"],
            "available_credits": ledger_status["available_credits"],
            "cache_hits": self.stats["cache_hits"],
            "active_cached_queries": cache_stats["active_cached_queries"],
            "successful_searches": self.stats["successful_searches"],
            "failed_searches": self.stats["failed_searches"],
            "blocked_searches": self.stats["blocked_searches"],
            "rate_limit_per_minute": settings.tavily_rate_limit_per_minute,
        }


# Global singleton client
tavily_client = TavilySearchClient()
