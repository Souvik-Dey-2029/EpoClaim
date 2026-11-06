"""Stance-neutral evidence reranker.

Uses the principle:
    Relevance = P(Entailment) + P(Contradiction)
so that both supporting and refuting evidence are scored high,
while off-topic or irrelevant text is ranked low.
"""
from __future__ import annotations

import logging
from typing import List, Tuple
from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord
from app.core.config import settings

logger = logging.getLogger(__name__)


class NLIReranker:
    """Stance-neutral reranker for evidence candidate passages."""

    def __init__(self, model_name: str = "cross-encoder/nli-deberta-v3-base"):
        self.model_name = model_name
        self._model = None
        self._load_failed = False

    def _get_model(self):
        if not settings.enable_hf_models:
            return None
        if self._model is None and not self._load_failed:
            try:
                from sentence_transformers import CrossEncoder
                logger.info(f"Loading NLI reranker CrossEncoder: {self.model_name}")
                self._model = CrossEncoder(self.model_name)
            except Exception as exc:
                logger.info(f"CrossEncoder not loaded ({exc}); using stance-neutral lexical scoring fallback.")
                self._load_failed = True
        return self._model

    def rerank(
        self,
        claim: AtomicClaim,
        records: List[EvidenceRecord],
        top_n: int = 10,
    ) -> List[Tuple[EvidenceRecord, float]]:
        """Rerank evidence records based on stance-neutral relevance to claim."""
        if not records:
            return []

        model = self._get_model()
        if model is not None:
            try:
                pairs = [(r.citation_text, claim.normalized_text) for r in records]
                scores = model.predict(pairs, apply_softmax=True)
                # Model labels typically: 0: Contradiction, 1: Entailment, 2: Neutral
                # or mapped via id2label.
                id2label = getattr(model.config, "id2label", {0: "contradiction", 1: "entailment", 2: "neutral"})
                label_map = {v.lower(): k for k, v in id2label.items()}
                ent_idx = label_map.get("entailment", 1)
                contra_idx = label_map.get("contradiction", 0)

                reranked = []
                for i, r in enumerate(records):
                    p_ent = float(scores[i][ent_idx])
                    p_contra = float(scores[i][contra_idx])
                    # Stance-neutral relevance
                    relevance = p_ent + p_contra
                    r.relevance_score = round(relevance, 4)
                    reranked.append((r, relevance))

                reranked.sort(key=lambda x: x[1], reverse=True)
                return reranked[:top_n]
            except Exception as exc:
                logger.warning(f"Error during NLI reranking ({exc}); falling back to heuristic scoring.")

        # Heuristic stance-neutral relevance fallback
        return self._heuristic_stance_neutral_rank(claim, records, top_n)

    def _heuristic_stance_neutral_rank(
        self,
        claim: AtomicClaim,
        records: List[EvidenceRecord],
        top_n: int,
    ) -> List[Tuple[EvidenceRecord, float]]:
        """Heuristic relevance based on entity and predicate overlap."""
        entity_terms = set(claim.entity.lower().split()) if claim.entity else set()
        val_terms = set(claim.claimed_value.lower().split()) if claim.claimed_value else set()
        attr_terms = set(claim.attribute.lower().split()) if claim.attribute else set()

        reranked = []
        for r in records:
            text = f"{r.source_title} {r.citation_text}".lower()
            entity_match = any(t in text for t in entity_terms) if entity_terms else True
            attr_match = any(t in text for t in attr_terms) if attr_terms else False
            val_match = any(t in text for t in val_terms) if val_terms else False

            # High relevance if it mentions the entity and either the value (support)
            # OR the attribute with another value (potential contradiction!)
            relevance = 0.2
            if entity_match:
                relevance += 0.4
            if attr_match:
                relevance += 0.25
            if val_match:
                relevance += 0.15

            score = min(1.0, relevance)
            r.relevance_score = round(score, 4)
            reranked.append((r, score))

        reranked.sort(key=lambda x: x[1], reverse=True)
        return reranked[:top_n]
