"""Evidence research service.

Formulates targeted multi-perspective queries (supporting, counter-hypothetical,
and temporal update queries) to discover both corroborating and contradicting evidence.
"""
from __future__ import annotations

import re
import uuid
from typing import List
from urllib.parse import urlparse

from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.core.temporal import parse_datetime, utc_now
from app.integrations.tavily import TavilySearchClient


class EvidenceResearchService:
    """Generates search queries and conducts web research."""

    def __init__(self, tavily_client: TavilySearchClient | None = None):
        self.tavily = tavily_client or TavilySearchClient()

    def generate_search_queries(self, claim: AtomicClaim) -> List[str]:
        """Generate balanced affirmative, counter-factual, and update queries."""
        entity = claim.entity or "subject"
        attribute = claim.attribute or "status"
        claimed_val = claim.claimed_value or ""

        queries = []

        # 1. Direct factual query
        if entity and claimed_val:
            queries.append(f"{entity} {attribute} {claimed_val}")
        else:
            queries.append(claim.normalized_text)

        # 2. Update / recency query (checking for superseding changes)
        queries.append(f"{entity} current {attribute} latest announcement update")

        # 3. Counter-hypothetical query (checking if changed, stepped down, replaced)
        if any(w in attribute.lower() for w in ["ceo", "president", "leader", "minister"]):
            queries.append(f"{entity} new {attribute} appointed replaced stepped down")

        return queries

    async def research_claim(self, claim: AtomicClaim, max_results_per_query: int = 3) -> List[EvidenceRecord]:
        """Execute web searches for a claim and parse results into EvidenceRecords."""
        queries = self.generate_search_queries(claim)
        records: List[EvidenceRecord] = []
        seen_urls = set()

        for q in queries:
            results = await self.tavily.search(q, max_results=max_results_per_query)
            for item in results:
                url = item.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                content = item.get("content", "").strip()
                if not content:
                    continue

                domain = urlparse(url).netloc.replace("www.", "") if url else "web"
                pub_date = parse_datetime(item.get("published_date"))

                # Context-aware evidence: split into exact citation passage vs surrounding context
                sentences = re.split(r"(?<=[.!?])\s+", content)
                citation = sentences[0] if sentences else content[:200]
                context = content

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
                    verification_context=context,
                    relevance_score=float(item.get("score", 0.7)),
                    source_quality=0.8 if any(t in domain for t in ["gov", "edu", "reuters", "bbc", "wikipedia"]) else 0.5,
                    retrieval_method=RetrievalMethod.TAVILY_SEARCH.value,
                )
                records.append(record)

        return records

