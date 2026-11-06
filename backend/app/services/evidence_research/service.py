"""Evidence research service with deterministic query construction and source quality estimation.

Enforces:
- Concise deterministic search queries (< 400 chars).
- Prioritization of time-sensitive claims (skipping invariant facts).
- Transparent, deterministic source quality estimation ($q \in [0.1, 1.0]$).
- Syndiated evidence clustering and deduplication.
- Max 5 searches per analysis safety cap.
"""
from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.core.config import settings
from app.core.temporal import parse_datetime, utc_now
from app.integrations.tavily import TavilySearchClient, tavily_client
from app.services.evidence_retrieval.clustering import cluster_evidence_records, canonicalize_url


def estimate_source_quality(
    url: str,
    title: str,
    content: str,
    published_date: Optional[Any],
    tavily_score: float = 0.7,
) -> Tuple[float, List[str]]:
    """Transparent deterministic source quality estimator using available evidence metadata.

    Returns:
        (quality_score, factors) where score is in [0.1, 1.0].
    """
    domain = urlparse(url).netloc.lower() if url else ""
    if domain.startswith("www."):
        domain = domain[4:]

    factors: List[str] = []
    base_quality = 0.50

    # 1. Identifiable domain / publisher
    if domain and "." in domain:
        base_quality += 0.10
        factors.append("identifiable_domain")
        # Educational / institutional / government domain signal
        if domain.endswith(".gov") or domain.endswith(".edu") or domain.endswith(".mil"):
            base_quality += 0.15
            factors.append("institutional_tld_signal")
        elif domain.endswith(".org"):
            base_quality += 0.05
            factors.append("org_tld_signal")

    # 2. Publication date presence & traceability
    if published_date:
        base_quality += 0.10
        factors.append("timestamped_publication_date")
    else:
        factors.append("missing_publication_date")

    # 3. Content depth and attribution signals
    content_len = len(content.split())
    if content_len >= 30:
        base_quality += 0.10
        factors.append("sufficient_context_depth")
    elif content_len < 10:
        base_quality -= 0.10
        factors.append("brief_snippet_penalty")

    # 4. Tavily relevance correlation
    if tavily_score >= 0.80:
        base_quality += 0.05
        factors.append("high_engine_relevance")

    # Bounded score
    bounded = max(0.10, min(0.95, base_quality))
    return round(bounded, 2), factors


class EvidenceResearchService:
    """Generates search queries and conducts web research with persistent credit limits."""

    def __init__(self, search_client: Optional[TavilySearchClient] = None):
        self.tavily = search_client or tavily_client

    def generate_search_query(self, claim: AtomicClaim) -> Optional[str]:
        """Construct a single concise search query from claim fields (< 400 characters)."""
        # Prioritize time-sensitive claims (skip time invariant facts)
        if claim.temporal_sensitivity == TemporalSensitivity.TIME_INVARIANT:
            return None

        entity = claim.entity.strip() if claim.entity else ""
        attribute = claim.attribute.strip() if claim.attribute else ""
        val = claim.claimed_value.strip() if claim.claimed_value else ""

        # Clean filler words
        clean_norm = re.sub(r"^(however|furthermore|meanwhile|in addition|additionally|also|therefore),\s*", "", claim.normalized_text, flags=re.IGNORECASE).strip()

        # Build concise targeted query
        if entity and attribute:
            # Check if attribute or entity already contains status
            query = f"{entity} {attribute}"
            if val and len(val.split()) <= 4:
                query = f"{query} {val}"
            # Add recency marker if not present
            if not any(w in query.lower() for w in ["latest", "current", "update", "now", "recent"]):
                query = f"{query} latest update"
        else:
            query = clean_norm

        # Clean excessive punctuation and clamp to 350 chars
        clean_q = re.sub(r"[\'\"\(\)\[\]\{\}\;\:\?]", " ", query)
        compact_q = " ".join(clean_q.split())
        return compact_q[:350] if compact_q else None

    async def research_claims(
        self,
        claims: List[AtomicClaim],
        max_searches_per_analysis: Optional[int] = None,
    ) -> Tuple[List[EvidenceRecord], Dict[str, Any]]:
        """Conduct web research across a batch of claims with budget safety limits.

        Returns:
            (records, research_metadata)
        """
        max_limit = max_searches_per_analysis or settings.tavily_max_searches_per_analysis
        records: List[EvidenceRecord] = []
        searches_executed = 0
        cache_hits = 0
        errors: List[str] = []

        seen_queries = set()

        for claim in claims:
            if searches_executed >= max_limit:
                break

            query = self.generate_search_query(claim)
            if not query or query in seen_queries:
                continue
            seen_queries.add(query)

            res = await self.tavily.search(query)
            if res.get("source") == "cache":
                cache_hits += 1
            elif res.get("source") == "live":
                searches_executed += 1

            if res.get("error"):
                errors.append(res["error"])

            for item in res.get("results", []):
                url = item.get("url", "")
                content = item.get("content", "").strip()
                if not content:
                    continue

                domain = urlparse(url).netloc.replace("www.", "") if url else "web"
                pub_date = parse_datetime(item.get("published_date"))
                score = float(item.get("score", 0.7))

                quality, factors = estimate_source_quality(url, item.get("title", ""), content, pub_date, score)

                # Split into citation sentence vs surrounding context
                sentences = re.split(r"(?<=[.!?])\s+", content)
                citation = sentences[0] if sentences else content[:200]

                record = EvidenceRecord(
                    evidence_id=f"ev_{uuid.uuid4().hex[:8]}",
                    claim_id=claim.claim_id,
                    source_url=url,
                    source_title=item.get("title", ""),
                    source_domain=domain,
                    publisher=domain,
                    publication_date=pub_date,
                    last_updated_date=None,
                    retrieved_at=utc_now(),
                    citation_text=citation,
                    verification_context=content,
                    relevance_score=score,
                    source_quality=quality,
                    retrieval_method=RetrievalMethod.TAVILY_SEARCH.value,
                )
                records.append(record)

        # Cluster syndicated / near-duplicate evidence before returning
        clustered_representatives, clusters = cluster_evidence_records(records, similarity_threshold=0.80)

        meta = {
            "searches_executed": searches_executed,
            "cache_hits": cache_hits,
            "total_web_records": len(records),
            "clustered_unique_records": len(clustered_representatives),
            "errors": errors,
        }

        return clustered_representatives, meta
