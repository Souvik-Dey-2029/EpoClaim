"""Lexical BM25 retrieval engine."""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import List, Tuple
from app.schemas.evidence import EvidenceRecord

_TOKEN_REGEX = re.compile(r"[a-zA-Z0-9]+")


def tokenize(text: str) -> List[str]:
    """Tokenize text into lowercase alphanumeric words."""
    return _TOKEN_REGEX.findall(text.lower())


class BM25Retriever:
    """Independent implementation of BM25Okapi scoring for evidence passages."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b

    def rank(self, query: str, records: List[EvidenceRecord], top_n: int = 10) -> List[Tuple[EvidenceRecord, float]]:
        """Rank candidate evidence records against the query using BM25."""
        if not records or not query.strip():
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            return [(r, 0.0) for r in records[:top_n]]

        corpus = [tokenize(f"{r.source_title} {r.citation_text} {r.verification_context}") for r in records]
        n_docs = len(corpus)
        avg_doc_len = sum(len(doc) for doc in corpus) / max(1, n_docs)

        # Document frequencies for query terms
        df = Counter()
        for doc in corpus:
            unique_terms = set(doc)
            for t in unique_terms:
                if t in query_tokens:
                    df[t] += 1

        scores: List[Tuple[EvidenceRecord, float]] = []
        for i, (record, doc) in enumerate(zip(records, corpus)):
            doc_len = len(doc)
            term_counts = Counter(doc)
            score = 0.0

            for q_term in query_tokens:
                if q_term not in term_counts:
                    continue
                tf = term_counts[q_term]
                n_qi = df[q_term]
                # Standard Robertson-Spärck Jones IDF
                idf = math.log((n_docs - n_qi + 0.5) / (n_qi + 0.5) + 1.0)
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / max(1.0, avg_doc_len)))
                score += idf * (numerator / denominator)

            scores.append((record, max(0.0, score)))

        # Sort descending by score
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_n]

