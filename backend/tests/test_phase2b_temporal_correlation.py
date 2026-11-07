"""Tests for Phase 2B: Bitemporal Evidence, Provenance & Correlation-Aware Verification."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import pytest

from app.schemas.evidence import (
    EvidenceRecord,
    TemporalInterval,
    TemporalPrecision,
    TemporalIntervalStatus,
    PublicationTimeSource,
    SourceRelationshipType,
    TemporalEligibilityStatus,
)
from app.schemas.claims import AtomicClaim, StructuredProposition
from app.schemas.report import AnalyzeRequest, FinalReport
from app.schemas.verification import VerificationVerdict
from app.services.evidence_retrieval.clustering import (
    canonicalize_url,
    compute_sha256,
    cluster_evidence_records,
)
from app.services.claim_verification.scoring import (
    calculate_evidence_weights,
    aggregate_evidence_scores,
    aggregate_cluster_evidence_scores,
)
from app.services.freshness.service import filter_temporally_eligible_evidence
from app.services.pipeline import EpoClaimPipeline
from app.evaluation.runner import BenchmarkRunner
from app.evaluation.scenarios import get_default_benchmark_scenarios


def test_temporal_interval_semantics():
    """Test half-open [start, end) interval containment."""
    t_start = datetime(2020, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    t_end = datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    interval = TemporalInterval(
        start_time=t_start,
        end_time=t_end,
        start_inclusive=True,
        end_inclusive=False,
        precision=TemporalPrecision.DAY,
        temporal_status=TemporalIntervalStatus.KNOWN_INTERVAL,
    )

    # Point at exact start (inclusive)
    assert interval.contains(t_start) is True
    # Point midway
    assert interval.contains(datetime(2022, 6, 15, tzinfo=timezone.utc)) is True
    # Point at exact end (exclusive)
    assert interval.contains(t_end) is False
    # Point before start
    assert interval.contains(datetime(2019, 12, 31, tzinfo=timezone.utc)) is False
    # Point after end
    assert interval.contains(datetime(2025, 1, 2, tzinfo=timezone.utc)) is False


def test_bitemporal_evidence_fields_and_sync():
    """Test 4 clocks and provenance tracking on EvidenceRecord."""
    pub_dt = datetime(2024, 5, 10, 12, 0, 0, tzinfo=timezone.utc)
    ev = EvidenceRecord(
        evidence_id="ev_001",
        claim_id="cl_001",
        source_url="https://news.example.com/item?utm_source=twitter",
        source_title="Example News",
        citation_text="Revenue reached 10 million in Q1 2024.",
        verification_context="In their quarterly report, revenue reached 10 million in Q1 2024.",
        publication_time=pub_dt,
        publication_time_source=PublicationTimeSource.PROVIDER_SUPPLIED,
    )

    # Check publication_date is synchronized with publication_time
    assert ev.publication_date == pub_dt
    assert ev.publication_time_source == PublicationTimeSource.PROVIDER_SUPPLIED
    assert ev.retrieved_at is not None
    assert ev.temporal_eligibility == TemporalEligibilityStatus.ELIGIBLE


def test_syndicated_clustering_and_hash_generation():
    """Test clustering of 10 syndicated copies into a single cluster."""
    base_text = "Acme Corp announced an unexpected merger with Beta Ltd for 500 million dollars."
    records = []
    for idx in range(10):
        records.append(
            EvidenceRecord(
                evidence_id=f"ev_wire_{idx}",
                claim_id="cl_merger",
                source_url=f"https://outlet{idx}.com/story/acme-merger?utm_campaign=feed{idx}",
                citation_text=base_text if idx % 2 == 0 else base_text.lower(),
                verification_context=base_text,
                relevance_score=0.9,
                source_quality=0.8,
            )
        )

    representatives, clusters = cluster_evidence_records(records)
    # All 10 syndicated copies should merge into 1 cluster
    assert len(clusters) == 1
    assert len(representatives) == 1
    assert len(clusters[0].members) == 10
    # Provenance fields populated
    for mem in clusters[0].members:
        assert mem.content_hash is not None
        assert mem.normalized_content_hash is not None
        assert mem.root_source_id is not None
        assert mem.relationship_type in {
            SourceRelationshipType.EXACT_COPY,
            SourceRelationshipType.EXPLICITLY_SYNDICATED,
            SourceRelationshipType.SAME_CANONICAL_DOCUMENT,
        }


def test_baseline_vs_correlation_capped_scoring():
    """Compare baseline multi-evidence aggregation vs cluster-capped aggregation."""
    # 5 identical syndicated copies in 1 cluster, each with high support
    triples_in_cluster = [
        (0.9, 0.05, 0.05, 0.9, 0.9)  # w_sup = 0.9 * 0.9 * 0.9 = 0.729
        for _ in range(5)
    ]
    
    # Baseline treats each copy as an independent probability: 1 - (1 - 0.729)^5 ~ 0.9998
    s_base, _ = aggregate_evidence_scores(triples_in_cluster)
    assert s_base > 0.99

    # Cluster-capped aggregation caps the cluster contribution to max(w_sup): 0.729
    s_cluster, _ = aggregate_cluster_evidence_scores([triples_in_cluster])
    assert s_cluster == 0.729
    assert s_cluster < s_base


def test_historical_mode_temporal_eligibility():
    """Test Historical Truth Mode allows retrospective reporting and rejects out-of-interval sources."""
    target_dt = datetime(1969, 7, 20, tzinfo=timezone.utc)

    # Case A: Article published in 2026 describing 1969 event
    rec_2026 = EvidenceRecord(
        evidence_id="ev_retrospective",
        claim_id="apollo",
        citation_text="Apollo 11 landed on the moon on July 20, 1969.",
        verification_context="Full mission log from July 20, 1969.",
        publication_date=datetime(2026, 1, 15, tzinfo=timezone.utc),
        event_date=target_dt,
        asserted_valid_time=TemporalInterval(
            start_time=datetime(1969, 7, 20, tzinfo=timezone.utc),
            end_time=datetime(1969, 7, 21, tzinfo=timezone.utc),
        ),
    )

    # Case B: Article with asserted interval strictly in 2024 (e.g. Artemis)
    rec_out = EvidenceRecord(
        evidence_id="ev_artemis",
        claim_id="apollo",
        citation_text="Artemis mission launched in 2024.",
        verification_context="Artemis mission launched in 2024.",
        publication_date=datetime(2024, 5, 1, tzinfo=timezone.utc),
        asserted_valid_time=TemporalInterval(
            start_time=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end_time=datetime(2025, 1, 1, tzinfo=timezone.utc),
        ),
    )

    eligible = filter_temporally_eligible_evidence(
        [rec_2026, rec_out],
        mode="historical",
        target_event_time=target_dt,
    )

    assert len(eligible) == 1
    assert eligible[0].evidence_id == "ev_retrospective"
    assert eligible[0].temporal_eligibility == TemporalEligibilityStatus.ELIGIBLE
    assert rec_out.temporal_eligibility == TemporalEligibilityStatus.INELIGIBLE


def test_system_as_known_mode_temporal_eligibility():
    """Test System-as-Known Mode enforces cutoff on publication and transaction time."""
    cutoff = datetime(2023, 11, 20, tzinfo=timezone.utc)

    # Case 1: Published and committed BEFORE cutoff
    rec_valid = EvidenceRecord(
        evidence_id="ev_before",
        claim_id="openai",
        citation_text="Mira Murati appointed interim CEO on Nov 17.",
        verification_context="Mira Murati appointed interim CEO on Nov 17.",
        publication_time=datetime(2023, 11, 17, 12, 0, tzinfo=timezone.utc),
        transaction_time=datetime(2023, 11, 17, 12, 5, tzinfo=timezone.utc),
    )

    # Case 2: Published AFTER cutoff (Nov 29 reinstatement)
    rec_after_pub = EvidenceRecord(
        evidence_id="ev_after_pub",
        claim_id="openai",
        citation_text="Sam Altman returned as CEO on Nov 29.",
        verification_context="Sam Altman returned as CEO on Nov 29.",
        publication_time=datetime(2023, 11, 29, 18, 0, tzinfo=timezone.utc),
        transaction_time=datetime(2023, 11, 29, 18, 5, tzinfo=timezone.utc),
    )

    # Case 3: Published before cutoff, but committed to EpoClaim AFTER cutoff
    rec_after_tx = EvidenceRecord(
        evidence_id="ev_after_tx",
        claim_id="openai",
        citation_text="Nov 18 board statement.",
        verification_context="Nov 18 board statement.",
        publication_time=datetime(2023, 11, 18, 12, 0, tzinfo=timezone.utc),
        transaction_time=datetime(2023, 11, 25, 0, 0, tzinfo=timezone.utc),
    )

    eligible = filter_temporally_eligible_evidence(
        [rec_valid, rec_after_pub, rec_after_tx],
        mode="system_as_known",
        as_known_cutoff=cutoff,
    )

    assert len(eligible) == 1
    assert eligible[0].evidence_id == "ev_valid" or eligible[0].evidence_id == "ev_before"
    assert rec_after_pub.temporal_eligibility == TemporalEligibilityStatus.INELIGIBLE
    assert rec_after_tx.temporal_eligibility == TemporalEligibilityStatus.INELIGIBLE


def test_e2e_pipeline_with_phase2b_modes_and_scoring():
    """Verify full pipeline runs in historical mode and records scoring_mode in report."""
    async def _run():
        pipeline = EpoClaimPipeline()
        req = AnalyzeRequest(
            response_text="The Battle of Hastings was fought in 1066.",
            context_documents=[
                {
                    "title": "Medieval Records",
                    "content": "The Battle of Hastings was fought in 1066.",
                    "published_date": "2026-01-01T00:00:00Z",
                }
            ],
            enable_live_search=False,
            temporal_evaluation_mode="historical",
            target_event_time=datetime(1066, 10, 14, tzinfo=timezone.utc),
            enable_correlation_discounted_scoring=True,
        )
        report = await pipeline.run(req)

        assert report.total_claims == 1
        assert report.supported_claims == 1
        assert report.scoring_mode == "cluster_capped_experimental"
        assert report.temporal_evaluation_mode == "historical"
        assert len(report.evidence_sources) > 0
        assert report.evidence_sources[0].transaction_time is not None

    asyncio.run(_run())


def test_expanded_18_benchmark_scenarios_deterministic():
    """Verify that all 18 benchmark scenarios are valid and execute cleanly."""
    async def _run():
        scenarios = get_default_benchmark_scenarios()
        assert len(scenarios) == 18

        runner = BenchmarkRunner()
        # Run subset including new Phase 2B scenarios
        report = await runner.run_benchmark(scenarios=scenarios, max_scenarios=18)
        assert report.total_scenarios == 18
        assert report.stale_detection_rate >= 0.80
        assert report.fresh_acceptance_rate >= 0.80
        assert report.parent_verdict_accuracy >= 0.80

    asyncio.run(_run())

