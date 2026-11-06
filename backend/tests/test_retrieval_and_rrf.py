"""Tests for BM25 retrieval, Dense retrieval fallback, RRF, and NLI reranking."""
import sys
from pathlib import Path
import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.schemas.evidence import EvidenceRecord
from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.services.evidence_retrieval.bm25 import BM25Retriever
from app.services.evidence_retrieval.dense import DenseRetriever
from app.services.evidence_ranking.rrf import reciprocal_rank_fusion
from app.services.evidence_ranking.reranker import NLIReranker


@pytest.fixture
def sample_evidence():
    return [
        EvidenceRecord(
            evidence_id="ev_1",
            claim_id="clm_1",
            source_url="https://example.com/1",
            source_title="OpenAI Leadership History",
            source_domain="example.com",
            citation_text="Sam Altman is the chief executive officer of OpenAI.",
            verification_context="In November 2023, Sam Altman was reinstated as CEO of OpenAI.",
            relevance_score=0.9,
            source_quality=0.8,
        ),
        EvidenceRecord(
            evidence_id="ev_2",
            claim_id="clm_1",
            source_url="https://example.com/2",
            source_title="Interim CEO Board Decision",
            source_domain="example.com",
            citation_text="Mira Murati served as interim CEO for several days.",
            verification_context="Mira Murati was briefly appointed interim CEO before Altman returned.",
            relevance_score=0.7,
            source_quality=0.7,
        ),
        EvidenceRecord(
            evidence_id="ev_3",
            claim_id="clm_1",
            source_url="https://example.com/3",
            source_title="Weather in San Francisco",
            source_domain="weather.com",
            citation_text="San Francisco experiences mild weather with summer fog.",
            verification_context="The meteorological forecast for the bay area shows moderate temperatures.",
            relevance_score=0.1,
            source_quality=0.5,
        ),
    ]


def test_bm25_retrieval_ranks_relevant_document_first(sample_evidence):
    retriever = BM25Retriever()
    results = retriever.rank("Sam Altman CEO OpenAI", sample_evidence, top_n=2)
    assert len(results) > 0
    top_doc, top_score = results[0]
    assert top_doc.evidence_id == "ev_1"
    assert top_score > 0.0


def test_dense_retrieval_fallback(sample_evidence):
    retriever = DenseRetriever()
    results = retriever.rank("Sam Altman chief executive", sample_evidence, top_n=2)
    assert len(results) > 0
    top_doc, top_score = results[0]
    assert top_doc.evidence_id == "ev_1"


def test_reciprocal_rank_fusion_combination(sample_evidence):
    list1 = [(sample_evidence[0], 1.0), (sample_evidence[1], 0.5)]
    list2 = [(sample_evidence[1], 0.9), (sample_evidence[0], 0.8)]

    # Document occurring in both lists should be rewarded
    fused = reciprocal_rank_fusion([list1, list2], k=60, top_n=3)
    assert len(fused) == 2
    # RRF score for ev_1: 1/(60+1) + 1/(60+2) = 1/61 + 1/62 = 0.01639 + 0.01613 = 0.03252
    assert fused[0][1] > 0.03


def test_stance_neutral_reranker_retains_contradiction(sample_evidence):
    reranker = NLIReranker()
    claim = AtomicClaim(
        claim_id="clm_test",
        original_text="Mira Murati is the CEO of OpenAI",
        normalized_text="Mira Murati is the CEO of OpenAI",
        entity="OpenAI",
        attribute="CEO",
        claimed_value="Mira Murati",
        temporal_sensitivity=TemporalSensitivity.SLOW_MOVING,
    )

    # Reranking against the claim should recognize ev_2 and ev_1 as on-topic
    # while ev_3 (weather) is irrelevant
    ranked = reranker.rerank(claim, sample_evidence, top_n=3)
    top_ids = [r.evidence_id for r, _ in ranked]
    assert "ev_3" != top_ids[0]  # Weather should never be top

