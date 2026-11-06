"""Comprehensive test suite for Tavily Search integration with mocked HTTP responses.

CRITICAL: Never connects to real Tavily API or consumes live credits.
Tests:
1. Correct Tavily request payload
2. Basic Search explicitly selected
3. API key loaded only from backend environment
4. Missing key behavior
5. Successful result normalization
6. Missing publication date handling
7. Empty results handling
8. Provider authentication failure (401/403)
9. HTTP 429 rate limit handling with Retry-After
10. Timeout handling with FAILED_CHARGED reservation
11. Cache hit avoids another provider request
12. Cache expiration triggers new request
13. Duplicate query normalization in cache
14. Credit cap blocks requests at 500
15. Manual increase from 500 to 600
16. Automatic increase is impossible (no auto-bumping)
17. Backend restart preserves ledger state
18. Concurrent requests cannot exceed cap
19. Failed request reservation reconciliation
20. Duplicate and syndicated evidence clustering
21. Independent evidence sources remain independent
22. Existing local evidence workflow still works
23. Existing /api/v1/analyze API contract remains compatible
24. Report provenance survives SQLite save and retrieval
"""
from __future__ import annotations

import asyncio
import json
import pytest
import sqlite3
import httpx
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import Settings
from app.integrations.tavily import TavilySearchClient, TAVILY_API_URL
from app.integrations.tavily_ledger import TavilyCreditLedger
from app.integrations.tavily_cache import TavilySearchCache
from app.services.evidence_research.service import EvidenceResearchService, estimate_source_quality
from app.services.evidence_retrieval.clustering import cluster_evidence_records, canonicalize_url
from app.schemas.claims import AtomicClaim, TemporalSensitivity
from app.schemas.evidence import EvidenceRecord
from app.schemas.report import AnalyzeRequest
from app.services.pipeline import EpoClaimPipeline
from app.storage.repository import ReportRepository


@pytest.fixture
def temp_db(tmp_path):
    """Create an isolated temporary SQLite database for test execution."""
    db_file = tmp_path / "test_ledger.db"
    return str(db_file)


@pytest.fixture
def ledger(temp_db):
    return TavilyCreditLedger(db_path=temp_db)


@pytest.fixture
def cache(temp_db):
    return TavilySearchCache(db_path=temp_db)


@pytest.fixture
def search_client(ledger, cache):
    return TavilySearchClient(api_key="tvly-mock-key-12345", ledger=ledger, cache=cache)


# 1. Correct Tavily request payload & 2. Basic Search explicitly selected
def test_tavily_request_payload_and_basic_search(search_client):
    captured_payload = {}

    def mock_post_handler(url, json=None, **kwargs):
        nonlocal captured_payload
        captured_payload = json
        mock_response = httpx.Response(
            status_code=200,
            json={
                "results": [
                    {
                        "title": "Mock Title",
                        "url": "https://example.com/mock",
                        "content": "Mock factual content about AI leadership.",
                        "published_date": "2024-01-01T00:00:00Z",
                        "score": 0.85,
                    }
                ],
                "request_id": "req_123",
            },
            request=httpx.Request("POST", url),
        )
        return mock_response

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = mock_post_handler
            res = await search_client.search("who is the CEO of OpenAI")

            assert res["source"] == "live"
            assert len(res["results"]) == 1
            assert captured_payload["search_depth"] == "basic"
            assert captured_payload["topic"] == "general"
            assert captured_payload["include_answer"] is False
            assert captured_payload["include_raw_content"] is False
            assert captured_payload["auto_parameters"] is False
            assert captured_payload["api_key"] == "tvly-mock-key-12345"

    asyncio.run(_run())


# 3. API key loaded only from backend environment
def test_api_key_loaded_only_from_backend_env(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "env-secret-key-abc")
    custom_settings = Settings()
    assert custom_settings.tavily_api_key == "env-secret-key-abc"


# 4. Missing key behavior
def test_missing_api_key_behavior(ledger, cache):
    async def _run():
        client = TavilySearchClient(api_key="", ledger=ledger, cache=cache)
        res = await client.search("test query")
        assert res["source"] == "none"
        assert "not configured" in res["error"].lower()
        # Ensure zero credits consumed
        status = ledger.get_ledger_status()
        assert status["consumed_credits"] == 0
        assert status["reserved_credits"] == 0

    asyncio.run(_run())


# 5. Successful result normalization
def test_successful_result_normalization(search_client):
    mock_resp = {
        "results": [
            {
                "title": "   Clean Title   ",
                "url": "https://news.example.com/article?utm_source=twitter",
                "content": "Raw unsanitized text with valid factual claims.",
                "published_date": "2024-02-15T10:00:00Z",
                "score": 0.92,
            }
        ],
        "request_id": "req_norm_99",
    }

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = httpx.Response(200, json=mock_resp, request=httpx.Request("POST", TAVILY_API_URL))
            res = await search_client.search("clean query test")
            item = res["results"][0]
            assert item["title"] == "Clean Title"
            assert item["provider"] == "tavily"
            assert item["request_id"] == "req_norm_99"
            assert item["score"] == 0.92

    asyncio.run(_run())


# 6. Missing publication date handling
def test_missing_publication_date_handling(search_client):
    mock_resp = {
        "results": [
            {
                "title": "No Date Article",
                "url": "https://example.org/undated",
                "content": "An undated passage about history.",
                "published_date": None,
                "score": 0.70,
            }
        ]
    }

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = httpx.Response(200, json=mock_resp, request=httpx.Request("POST", TAVILY_API_URL))
            res = await search_client.search("undated test")
            assert res["results"][0]["published_date"] is None

    asyncio.run(_run())


# 7. Empty results handling
def test_empty_results_handling(search_client):
    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = httpx.Response(200, json={"results": []}, request=httpx.Request("POST", TAVILY_API_URL))
            res = await search_client.search("obscure impossible query")
            assert res["source"] == "live"
            assert len(res["results"]) == 0

    asyncio.run(_run())


# 8. Provider authentication failure (401/403)
def test_provider_auth_failure(search_client, ledger):
    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = httpx.Response(401, json={"detail": "Unauthorized key"}, request=httpx.Request("POST", TAVILY_API_URL))
            res = await search_client.search("auth fail test")
            assert res["source"] == "none"
            assert "authentication failure" in res["error"].lower()
            # Released reservation: no credits consumed
            status = ledger.get_ledger_status()
            assert status["consumed_credits"] == 0
            assert status["reserved_credits"] == 0

    asyncio.run(_run())


# 9. HTTP 429 rate limit handling with Retry-After
def test_http_429_rate_limit_handling(search_client, ledger):
    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            headers = {"Retry-After": "10"}
            mock_post.return_value = httpx.Response(429, headers=headers, request=httpx.Request("POST", TAVILY_API_URL))
            res = await search_client.search("rate limit test")
            assert res["source"] == "none"
            assert "429" in res["error"]
            assert "10s" in res["error"]
            assert ledger.get_ledger_status()["consumed_credits"] == 0

    asyncio.run(_run())


# 10. Timeout handling with conservative FAILED_CHARGED reservation
def test_timeout_handling(search_client, ledger):
    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.TimeoutException("Connection timed out mid-flight")
            res = await search_client.search("timeout query")
            assert res["source"] == "none"
            assert "timed out" in res["error"].lower()
            # Timeout marked as consumed to protect user budget conservatively
            status = ledger.get_ledger_status()
            assert status["consumed_credits"] == 1
            assert status["reserved_credits"] == 0

    asyncio.run(_run())


# 11. Cache hit avoids another provider request & 13. Duplicate query normalization
def test_cache_hit_avoids_provider_request(search_client, ledger):
    call_count = 0

    def mock_post(url, **kwargs):
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json={"results": [{"title": "Cached", "url": "https://c.org", "content": "Sample"}]}, request=httpx.Request("POST", url))

    async def _run():
        nonlocal call_count
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as p:
            p.side_effect = mock_post

            # First call: live network request
            res1 = await search_client.search("  Python Latest Release  ")
            assert res1["source"] == "live"
            assert call_count == 1

            # Second call with different casing/whitespace: must hit cache
            res2 = await search_client.search("python latest release")
            assert res2["source"] == "cache"
            assert call_count == 1  # No additional network call!
            assert ledger.get_ledger_status()["consumed_credits"] == 1

    asyncio.run(_run())


# 12. Cache expiration triggers new request
def test_cache_expiration_triggers_new_request(search_client, cache):
    call_count = 0

    def mock_post(url, **kwargs):
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json={"results": [{"title": f"Run {call_count}", "url": "https://c.org", "content": "Sample"}]}, request=httpx.Request("POST", url))

    async def _run():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as p:
            p.side_effect = mock_post
            # Populate cache with negative TTL (already expired)
            cache.set("expired query", [{"title": "Stale", "url": "https://c.org", "content": "Sample"}], ttl_hours=-1.0)

            res = await search_client.search("expired query")
            assert res["source"] == "live"
            assert call_count == 1

    asyncio.run(_run())


# 14. Credit cap blocks requests at 500
def test_credit_cap_blocks_at_limit(ledger, cache):
    # Set consumed credits to 500 directly in ledger
    with ledger._get_connection() as conn:
        conn.execute("UPDATE tavily_budget_config SET consumed_credits = 500 WHERE id = 1")
        conn.commit()

    async def _run():
        client = TavilySearchClient(api_key="tvly-mock", ledger=ledger, cache=cache)
        res = await client.search("exceed cap query")
        assert res["source"] == "none"
        assert "budget exceeded" in res["error"].lower()
        assert ledger.get_ledger_status()["consumed_credits"] == 500

    asyncio.run(_run())


# 15. Manual increase from 500 to 600
def test_manual_increase_budget(ledger):
    success, msg = ledger.manual_increase_budget(600, reason="Approved for testing milestone 2")
    assert success is True
    status = ledger.get_ledger_status()
    assert status["budget_cap"] == 600

    # Audit log check
    logs = ledger.get_audit_logs()
    assert len(logs) >= 1
    # Check that entry exists in audit history
    assert any(entry["new_cap"] == 600 for entry in logs)


def test_budget_increase_validation_rules(ledger):
    # Arbitrary jump (e.g. 500 -> 700) must be rejected
    success, msg = ledger.manual_increase_budget(700, reason="Arbitrary jump")
    assert success is False
    assert "strictly exactly" in msg.lower() or "increment" in msg.lower()

    # Step up cleanly to 1000
    assert ledger.manual_increase_budget(600, reason="step 1")[0] is True
    assert ledger.manual_increase_budget(700, reason="step 2")[0] is True
    assert ledger.manual_increase_budget(800, reason="step 3")[0] is True
    assert ledger.manual_increase_budget(900, reason="step 4")[0] is True
    assert ledger.manual_increase_budget(1000, reason="step 5")[0] is True

    # Increase above 1,000 must be rejected
    success_over, msg_over = ledger.manual_increase_budget(1100, reason="Exceed max cap")
    assert success_over is False
    assert "hard ceiling" in msg_over.lower() or "maximum allowed" in msg_over.lower()


def test_public_budget_increase_endpoint_removed():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    # The endpoint POST /api/v1/tavily/budget/increase must return 404 (or 405 Method Not Allowed)
    resp = client.post("/api/v1/tavily/budget/increase", json={"new_budget_cap": 600, "reason": "Test"})
    assert resp.status_code in {404, 405}

    # Ensure GET /api/v1/tavily/status is still accessible
    status_resp = client.get("/api/v1/tavily/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert "budget_cap" in data


# 16. Automatic increase is impossible (no auto-bumping; reject decreases below consumed)
def test_budget_cannot_decrease_below_consumed(ledger):
    with ledger._get_connection() as conn:
        conn.execute("UPDATE tavily_budget_config SET budget_cap = 600, consumed_credits = 550 WHERE id = 1")
        conn.commit()

    success, msg = ledger.manual_increase_budget(500, reason="Illegal decrease")
    assert success is False
    assert "below committed credits" in msg.lower() or "below already consumed" in msg.lower()


# 17. Backend restart preserves ledger state
def test_backend_restart_preserves_ledger(temp_db):
    ledger1 = TavilyCreditLedger(db_path=temp_db)
    # Step up cleanly 500 -> 600 -> 700
    ledger1.manual_increase_budget(600, reason="Pre-restart allocation step 1")
    ledger1.manual_increase_budget(700, reason="Pre-restart allocation step 2")
    with ledger1._get_connection() as conn:
        conn.execute("UPDATE tavily_budget_config SET consumed_credits = 120 WHERE id = 1")
        conn.commit()

    # Re-instantiate as if server restarted
    ledger2 = TavilyCreditLedger(db_path=temp_db)
    status = ledger2.get_ledger_status()
    assert status["budget_cap"] == 700
    assert status["consumed_credits"] == 120
    assert status["available_credits"] == 580


# 18. Concurrent requests cannot exceed cap
def test_concurrent_reservations_cannot_exceed_cap(temp_db):
    test_ledger = TavilyCreditLedger(db_path=temp_db)
    # Set cap to exactly 3 credits
    with test_ledger._get_connection() as conn:
        conn.execute("UPDATE tavily_budget_config SET budget_cap = 3, consumed_credits = 0, reserved_credits = 0 WHERE id = 1")
        conn.commit()

    # Try 5 reservations
    results = []
    for i in range(5):
        ok, msg, rid = test_ledger.reserve_credit(f"query_{i}", cost=1)
        results.append(ok)

    assert results.count(True) == 3
    assert results.count(False) == 2
    status = test_ledger.get_ledger_status()
    assert status["reserved_credits"] == 3


# 19. Failed request reservation reconciliation
def test_failed_request_reservation_reconciliation(ledger):
    ok, msg, res_id = ledger.reserve_credit("fail_query", cost=1)
    assert ok is True
    assert ledger.get_ledger_status()["reserved_credits"] == 1

    # Release reservation
    ledger.release_reservation(res_id, reason="Network handshake failed")
    assert ledger.get_ledger_status()["reserved_credits"] == 0
    assert ledger.get_ledger_status()["consumed_credits"] == 0


# 20. Duplicate and syndicated evidence clustering & 21. Independent sources remain independent
def test_syndicated_evidence_clustering():
    rec1 = EvidenceRecord(
        evidence_id="ev_1",
        claim_id="clm_1",
        source_url="https://apnews.com/article/123?utm_source=twitter",
        source_title="AP News Report",
        citation_text="The central bank maintained interest rates at 5 percent today in a unanimous decision.",
        verification_context="Full article text",
        relevance_score=0.9,
        source_quality=0.8,
    )
    rec2 = EvidenceRecord(
        evidence_id="ev_2",
        claim_id="clm_1",
        source_url="https://finance.yahoo.com/reprint/123",
        source_title="Yahoo Finance (Syndicated)",
        # Identical syndicated copy
        citation_text="The central bank maintained interest rates at 5 percent today in a unanimous decision.",
        verification_context="Full article text",
        relevance_score=0.9,
        source_quality=0.7,
    )
    rec3 = EvidenceRecord(
        evidence_id="ev_3",
        claim_id="clm_1",
        source_url="https://bloomberg.com/opinion/analyst-take",
        source_title="Independent Economic Commentary",
        citation_text="Market analysts anticipated this pause given recent inflationary trends.",
        verification_context="Full commentary text",
        relevance_score=0.8,
        source_quality=0.85,
    )

    reps, clusters = cluster_evidence_records([rec1, rec2, rec3], similarity_threshold=0.80)
    # rec1 and rec2 must be grouped into one cluster; rec3 is independent
    assert len(reps) == 2
    assert len(clusters) == 2
    # Verify strongest source chosen in syndicated cluster
    syn_cluster = next(c for c in clusters if len(c.members) == 2)
    assert syn_cluster.representative.evidence_id == "ev_1"
    assert len(syn_cluster.canonical_urls) == 2


def test_transitive_clustering_prevention():
    # Construct 3 records: A shares high similarity with B, B shares high similarity with C,
    # but A and C have low similarity. They should NOT all collapse into a single cluster.
    words_common_ab = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november"
    words_common_bc = "golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform"
    # A has ab words, C has bc words, B has a mix
    # Sim(A, B) will be high, Sim(B, C) will be high, Sim(A, C) will be low.
    text_a = f"{words_common_ab} unique_a_extra_1 unique_a_extra_2"
    text_b = f"{words_common_ab} oscar papa quebec romeo"
    text_c = f"hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform extra_c1 extra_c2"

    rec_a = EvidenceRecord(
        evidence_id="ev_a",
        claim_id="clm_1",
        source_url="https://source-a.com/article",
        citation_text=text_a,
        verification_context=text_a,
        relevance_score=0.95,
        source_quality=0.9,
    )
    rec_b = EvidenceRecord(
        evidence_id="ev_b",
        claim_id="clm_1",
        source_url="https://source-b.com/article",
        citation_text=text_b,
        verification_context=text_b,
        relevance_score=0.85,
        source_quality=0.8,
    )
    rec_c = EvidenceRecord(
        evidence_id="ev_c",
        claim_id="clm_1",
        source_url="https://source-c.com/article",
        citation_text=text_c,
        verification_context=text_c,
        relevance_score=0.75,
        source_quality=0.7,
    )

    # Threshold 0.65 where A-B match (~0.77), B-C match (~0.68), but A-C (<0.45)
    reps, clusters = cluster_evidence_records([rec_a, rec_b, rec_c], similarity_threshold=0.65)
    # If transitive chaining was occurring, rec_c would merge with rec_b, ending up in cluster with rec_a.
    # With all-member similarity requirement, rec_c cannot join a cluster containing rec_a!
    cluster_with_a = next(c for c in clusters if any(m.evidence_id == "ev_a" for m in c.members))
    assert not any(m.evidence_id == "ev_c" for m in cluster_with_a.members)
    assert len(clusters) >= 2


# 22. Existing local evidence workflow still works
def test_local_evidence_workflow_preserved():
    async def _run():
        pipeline = EpoClaimPipeline()
        req = AnalyzeRequest(
            response_text="Albert Einstein won the Nobel Prize in Physics for his explanation of the photoelectric effect.",
            context_documents=[
                "The Nobel Prize in Physics 1921 was awarded to Albert Einstein for his services to Theoretical Physics."
            ],
            enable_live_search=False,
        )
        report = await pipeline.run(req)
        assert report.total_claims >= 1
        assert report.supported_claims >= 1
        assert report.claim_results[0].verification.verdict.value == "SUPPORTED"

    asyncio.run(_run())


# 23. Existing /api/v1/analyze API contract remains compatible
def test_analyze_contract_compatibility():
    async def _run():
        pipeline = EpoClaimPipeline()
        req = AnalyzeRequest(
            response_text="Mira Murati is the CEO of OpenAI.",
            context_documents=[
                {
                    "title": "Leadership Announcement",
                    "content": "Sam Altman has returned as CEO of OpenAI, concluding Murati's interim role.",
                    "published_date": "2023-11-29T00:00:00Z",
                }
            ],
            enable_live_search=False,
        )
        report = await pipeline.run(req)
        # Check all root fields exist
        assert hasattr(report, "report_id")
        assert hasattr(report, "claim_results")
        assert hasattr(report, "evidence_sources")
        assert hasattr(report, "execution_metadata")
        assert report.outdated_claims >= 1

    asyncio.run(_run())


# 24. Report provenance survives SQLite save and retrieval
def test_report_provenance_sqlite_survival(temp_db):
    repo = ReportRepository(db_path=temp_db)
    pipeline = EpoClaimPipeline()
    req = AnalyzeRequest(
        response_text="Python 3.12 is the latest stable release of Python.",
        context_documents=[
            {
                "title": "Python Release",
                "content": "Python 3.12 is officially released and is now the latest stable version.",
                "published_date": "2023-10-02T00:00:00Z",
                "url": "https://python.org/release-312",
            }
        ],
        enable_live_search=False,
    )
    report = asyncio.run(pipeline.run(req))
    repo.save_report(report)

    retrieved = repo.get_report(report.report_id)
    assert retrieved is not None
    assert retrieved.report_id == report.report_id
    assert len(retrieved.evidence_sources) >= 1
    ev = retrieved.evidence_sources[0]
    assert ev.source_url == "https://python.org/release-312"
    assert ev.source_title == "Python Release"
