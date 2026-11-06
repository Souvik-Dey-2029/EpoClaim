"""Reciprocal Rank Fusion (RRF) implementation for multi-channel retrieval."""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Tuple
from app.schemas.evidence import EvidenceRecord


def reciprocal_rank_fusion(
    channel_ranked_lists: List[List[Tuple[EvidenceRecord, float]]],
    k: int = 60,
    top_n: int = 15,
) -> List[Tuple[EvidenceRecord, float]]:
    """Merge multiple ranked lists using Reciprocal Rank Fusion.

    Formula:
        RRF(d) = sum_{channel i} 1 / (k + rank_i(d))

    Args:
        channel_ranked_lists: A list of ranked results from different retrieval channels
                              (e.g., [bm25_results, dense_results]).
        k: Smoothing constant (standard: 60).
        top_n: Number of fused results to return.

    Returns:
        List of (EvidenceRecord, rrf_score) sorted descending by score.
    """
    if not channel_ranked_lists:
        return []

    scores: Dict[str, float] = defaultdict(float)
    record_map: Dict[str, EvidenceRecord] = {}

    for ranked_list in channel_ranked_lists:
        for rank, (record, _) in enumerate(ranked_list, start=1):
            doc_id = record.evidence_id
            record_map[doc_id] = record
            scores[doc_id] += 1.0 / (k + rank)

    # Sort descending by RRF score; break ties deterministically by evidence_id
    sorted_ids = sorted(scores.keys(), key=lambda doc_id: (scores[doc_id], doc_id), reverse=True)

    fused_results: List[Tuple[EvidenceRecord, float]] = []
    for doc_id in sorted_ids[:top_n]:
        fused_results.append((record_map[doc_id], scores[doc_id]))

    return fused_results

