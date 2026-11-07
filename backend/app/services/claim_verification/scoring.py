"""Evidence aggregation and mathematical scoring functions.

Implements independent probabilistic evidence weighting:
    w_support_i = r_i * q_i * e_i
    w_contradiction_i = r_i * q_i * c_i

    S = 1 - PRODUCT(1 - w_support_i)
    C = 1 - PRODUCT(1 - w_contradiction_i)

These scores are heuristic aggregation weights on [0, 1] and are labeled as such,
not calibrated physical probabilities.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Set, Tuple
from app.schemas.evidence import EvidenceRecord


def deduplicate_evidence_records(records: List[EvidenceRecord]) -> List[EvidenceRecord]:
    """Deduplicate repeated evidence items by canonical content and source identity."""
    seen_keys: Set[str] = set()
    deduped: List[EvidenceRecord] = []

    for r in records:
        # Key on normalized citation text and source URL/parent_doc
        norm_text = " ".join(r.citation_text.lower().split())
        source_key = r.source_url or r.parent_doc_id or r.source_title
        dedup_key = f"{source_key}::{norm_text}"

        if dedup_key not in seen_keys:
            seen_keys.add(dedup_key)
            deduped.append(r)

    return deduped


def calculate_evidence_weights(
    e_i: float,
    c_i: float,
    n_i: float,
    r_i: float,
    q_i: float,
) -> Tuple[float, float]:
    """Calculate effective support and contradiction weights for a single evidence item.

    Args:
        e_i: Entailment probability in [0, 1].
        c_i: Contradiction probability in [0, 1].
        n_i: Neutral probability in [0, 1].
        r_i: Retrieval relevance in [0, 1].
        q_i: Source quality/reliability in [0, 1].

    Returns:
        (w_support, w_contradiction) clamped to [0, 1].
    """
    # Enforce unit bounds
    e = max(0.0, min(1.0, float(e_i)))
    c = max(0.0, min(1.0, float(c_i)))
    n = max(0.0, min(1.0, float(n_i)))
    r = max(0.0, min(1.0, float(r_i)))
    q = max(0.0, min(1.0, float(q_i)))

    # Validate sum approximately 1.0; normalize if necessary
    total = e + c + n
    if total > 0.0:
        e /= total
        c /= total

    w_support = r * q * e
    w_contra = r * q * c

    return max(0.0, min(1.0, w_support)), max(0.0, min(1.0, w_contra))


def aggregate_evidence_scores(
    evidence_triples: List[Tuple[float, float, float, float, float]],
) -> Tuple[float, float]:
    """Aggregate multiple evidence weights into global heuristic Support (S) and Contradiction (C) scores.

    S = 1 - PRODUCT(1 - w_support_i)
    C = 1 - PRODUCT(1 - w_contradiction_i)

    Args:
        evidence_triples: List of tuples (e_i, c_i, n_i, r_i, q_i) for each evaluated evidence item.

    Returns:
        (S, C) as floating-point heuristic scores in [0.0, 1.0].
    """
    if not evidence_triples:
        return 0.0, 0.0

    prod_not_support = 1.0
    prod_not_contra = 1.0

    for e_i, c_i, n_i, r_i, q_i in evidence_triples:
        w_sup, w_con = calculate_evidence_weights(e_i, c_i, n_i, r_i, q_i)
        prod_not_support *= (1.0 - w_sup)
        prod_not_contra *= (1.0 - w_con)

    s_score = 1.0 - prod_not_support
    c_score = 1.0 - prod_not_contra

    return round(max(0.0, min(1.0, s_score)), 4), round(max(0.0, min(1.0, c_score)), 4)


def aggregate_cluster_evidence_scores(
    cluster_triples: List[List[Tuple[float, float, float, float, float]]],
) -> Tuple[float, float]:
    """Aggregate evidence scores using correlation-discounted, cluster-capped independent evidence.

    For cluster k with items i in k:
        W_{support, k} = max_{i in k}(w_{support, i})
        W_{contra, k} = max_{i in k}(w_{contra, i})

    Across clusters:
        S_{cluster} = 1 - PRODUCT_{k=1}^K (1 - W_{support, k})
        C_{cluster} = 1 - PRODUCT_{k=1}^K (1 - W_{contra, k})

    Args:
        cluster_triples: List of clusters, each containing a list of (e_i, c_i, n_i, r_i, q_i) triples.

    Returns:
        (S_cluster, C_cluster) clamped to [0.0, 1.0].
    """
    if not cluster_triples:
        return 0.0, 0.0

    prod_not_support = 1.0
    prod_not_contra = 1.0

    for cluster in cluster_triples:
        if not cluster:
            continue
        max_w_sup = 0.0
        max_w_con = 0.0
        for e_i, c_i, n_i, r_i, q_i in cluster:
            w_sup, w_con = calculate_evidence_weights(e_i, c_i, n_i, r_i, q_i)
            if w_sup > max_w_sup:
                max_w_sup = w_sup
            if w_con > max_w_con:
                max_w_con = w_con

        prod_not_support *= (1.0 - max_w_sup)
        prod_not_contra *= (1.0 - max_w_con)

    s_score = 1.0 - prod_not_support
    c_score = 1.0 - prod_not_contra

    return round(max(0.0, min(1.0, s_score)), 4), round(max(0.0, min(1.0, c_score)), 4)

