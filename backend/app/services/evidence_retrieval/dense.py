"""Dense semantic retrieval engine with lazy loading and fallback support."""
from __future__ import annotations

import logging
import math
from typing import List, Tuple
from app.schemas.evidence import EvidenceRecord
from app.services.evidence_retrieval.bm25 import tokenize
from app.core.config import settings

logger = logging.getLogger(__name__)


class DenseRetriever:
    """Semantic vector retriever using embeddings or TF-IDF vector space fallback."""

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None
        self._load_failed = False

    def _get_model(self):
        """Lazy load sentence-transformers model if enabled and available."""
        if not settings.enable_hf_models:
            return None
        if self._model is None and not self._load_failed:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading dense embedding model: {self.model_name}")
                self._model = SentenceTransformer(self.model_name)
            except Exception as exc:
                logger.warning(f"Could not load SentenceTransformer ({exc}); using vector space fallback.")
                self._load_failed = True
        return self._model

    def rank(self, query: str, records: List[EvidenceRecord], top_n: int = 10) -> List[Tuple[EvidenceRecord, float]]:
        """Rank records against query using dense semantic similarity."""
        if not records or not query.strip():
            return []

        model = self._get_model()
        if model is not None:
            try:
                import numpy as np
                texts = [f"{r.source_title}: {r.citation_text}" for r in records]
                query_emb = model.encode([query], convert_to_numpy=True)[0]
                doc_embs = model.encode(texts, convert_to_numpy=True)

                # Cosine similarities
                q_norm = np.linalg.norm(query_emb)
                scores = []
                for i, r in enumerate(records):
                    d_norm = np.linalg.norm(doc_embs[i])
                    sim = float(np.dot(query_emb, doc_embs[i]) / (q_norm * d_norm + 1e-9))
                    # Rescale [-1, 1] to [0, 1]
                    normalized_score = max(0.0, min(1.0, (sim + 1.0) / 2.0))
                    scores.append((r, normalized_score))

                scores.sort(key=lambda x: x[1], reverse=True)
                return scores[:top_n]
            except Exception as exc:
                logger.error(f"Error in dense embedding inference: {exc}; falling back to vector space")

        # Fallback: Character n-gram & word cosine vector space model
        return self._cosine_fallback(query, records, top_n)

    def _cosine_fallback(self, query: str, records: List[EvidenceRecord], top_n: int) -> List[Tuple[EvidenceRecord, float]]:
        """Deterministic vector space fallback without external model download."""
        q_tokens = tokenize(query)
        q_vec = {}
        for t in q_tokens:
            q_vec[t] = q_vec.get(t, 0) + 1
        q_norm = math.sqrt(sum(v * v for v in q_vec.values())) or 1.0

        scores = []
        for r in records:
            doc_text = f"{r.source_title} {r.citation_text} {r.verification_context}"
            d_tokens = tokenize(doc_text)
            d_vec = {}
            for t in d_tokens:
                d_vec[t] = d_vec.get(t, 0) + 1
            d_norm = math.sqrt(sum(v * v for v in d_vec.values())) or 1.0

            dot = sum(q_vec[t] * d_vec.get(t, 0) for t in q_vec)
            sim = dot / (q_norm * d_norm)
            scores.append((r, float(sim)))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_n]
