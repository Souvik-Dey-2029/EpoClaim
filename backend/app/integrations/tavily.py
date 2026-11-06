"""Tavily search provider integration."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.core.security import sanitize_evidence_text

logger = logging.getLogger(__name__)

TAVILY_API_URL = "https://api.tavily.com/search"


class TavilySearchClient:
    """Client for Tavily Search API with graceful offline fallback."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.tavily_api_key
        self.is_configured = bool(self.api_key and self.api_key.strip())

    async def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: str = "advanced",
        include_raw_content: bool = False,
    ) -> List[Dict[str, Any]]:
        """Perform web search. Returns a list of standardized search result dicts."""
        if not self.is_configured:
            logger.info("Tavily API key not configured; skipping live web request.")
            return []

        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": search_depth,
            "include_answer": False,
            "include_raw_content": include_raw_content,
            "max_results": max_results,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(TAVILY_API_URL, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    cleaned = []
                    for item in results:
                        cleaned.append({
                            "url": item.get("url", ""),
                            "title": item.get("title", ""),
                            "content": sanitize_evidence_text(item.get("content", "")),
                            "published_date": item.get("published_date"),
                            "score": float(item.get("score", 0.7)),
                        })
                    return cleaned
                else:
                    logger.warning(f"Tavily search returned status {resp.status_code}: {resp.text}")
                    return []
        except Exception as exc:
            logger.error(f"Error connecting to Tavily search: {exc}")
            return []

