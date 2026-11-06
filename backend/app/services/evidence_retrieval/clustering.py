"""Deterministic evidence clustering and syndicated duplicate prevention.

Prevents syndicated or near-identical articles from inflating support or contradiction
scores when aggregated. Retains all member URLs in report provenance while using the
strongest single contribution per cluster.
"""
from __future__ import annotations

import re
from typing import List, Set, Tuple
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from app.schemas.evidence import EvidenceRecord


def canonicalize_url(url: str) -> str:
    """Canonicalize URLs by lowercasing hostname, removing tracking params, and stripping fragments."""
    if not url:
        return ""
    try:
        parsed = urlparse(url.strip())
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]

        # Drop common marketing tracking query parameters
        tracking_params = {
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "gclid", "fbclid", "ref", "source", "ref_src"
        }
        filtered_query = [
            (k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            if k.lower() not in tracking_params
        ]
        sorted_query = urlencode(sorted(filtered_query))

        path = parsed.path.rstrip("/")
        return urlunparse((parsed.scheme.lower() or "https", netloc, path, "", sorted_query, ""))
    except Exception:
        return url.strip().lower()


def _normalize_text_for_sim(text: str) -> str:
    """Normalize text by lowercasing and condensing whitespace."""
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def compute_jaccard_similarity(text_a: str, text_b: str) -> float:
    """Compute token-level Jaccard similarity between two texts."""
    toks_a = set(_normalize_text_for_sim(text_a).split())
    toks_b = set(_normalize_text_for_sim(text_b).split())
    if not toks_a or not toks_b:
        return 0.0
    intersection = len(toks_a.intersection(toks_b))
    union = len(toks_a.union(toks_b))
    return float(intersection) / float(union) if union > 0 else 0.0


class EvidenceCluster:
    """A cluster of identical or syndicated near-duplicate evidence items."""

    def __init__(self, representative: EvidenceRecord):
        self.representative: EvidenceRecord = representative
        self.members: List[EvidenceRecord] = [representative]
        self.canonical_urls: Set[str] = {canonicalize_url(representative.source_url or "")}

    def can_merge(self, record: EvidenceRecord, similarity_threshold: float = 0.80) -> bool:
        """Check whether record is an exact URL match, identical text, or syndicated near-duplicate.
        
        To prevent transitive chaining (e.g. A ~ B and B ~ C merging A and C when A !~ C),
        if merging via textual similarity, the incoming record must meet the similarity threshold
        against EVERY existing member in this cluster.
        """
        rec_url = canonicalize_url(record.source_url or "")
        # Exact canonical URL match with any known member
        if rec_url and rec_url in self.canonical_urls:
            return True

        norm_rec = _normalize_text_for_sim(record.citation_text)
        rec_ctx = record.verification_context or ""

        # Must be similar to ALL existing members in this cluster to prevent transitive chaining
        for member in self.members:
            norm_mem = _normalize_text_for_sim(member.citation_text)
            if norm_mem and norm_mem == norm_rec:
                continue

            sim = compute_jaccard_similarity(member.citation_text, record.citation_text)
            if sim >= similarity_threshold:
                continue

            # Check full verification context similarity if citations are short
            if len(norm_mem.split()) < 8 and len(norm_rec.split()) < 8:
                ctx_sim = compute_jaccard_similarity(member.verification_context or "", rec_ctx)
                if ctx_sim >= similarity_threshold:
                    continue

            # Failed similarity with at least one member
            return False

        return True

    def add_member(self, record: EvidenceRecord) -> None:
        self.members.append(record)
        rec_url = canonicalize_url(record.source_url or "")
        if rec_url:
            self.canonical_urls.add(rec_url)

        # Retain the strongest eligible evidence as representative
        rep_weight = (self.representative.relevance_score or 0.5) * (self.representative.source_quality or 0.5)
        new_weight = (record.relevance_score or 0.5) * (record.source_quality or 0.5)
        if new_weight > rep_weight:
            self.representative = record


def cluster_evidence_records(
    records: List[EvidenceRecord],
    similarity_threshold: float = 0.80,
) -> Tuple[List[EvidenceRecord], List[EvidenceCluster]]:
    """Cluster evidence items to prevent syndicated duplicates from inflating evidence scores.

    Returns:
        (unique_representatives, all_clusters)
        The unique representatives should be used for scoring aggregation.
        The full cluster members retain all source URLs for report provenance.
    """
    if not records:
        return [], []

    clusters: List[EvidenceCluster] = []

    for rec in records:
        matched = False
        for cluster in clusters:
            if cluster.can_merge(rec, similarity_threshold=similarity_threshold):
                cluster.add_member(rec)
                matched = True
                break
        if not matched:
            clusters.append(EvidenceCluster(rec))

    representatives = [c.representative for c in clusters]
    return representatives, clusters

