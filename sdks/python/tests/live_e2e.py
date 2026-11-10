"""End-to-end test verifying Python SDK (Sync and Async) against running EpoClaim backend."""
import asyncio
import sys
from pathlib import Path

sdk_dir = Path(__file__).resolve().parent.parent
if str(sdk_dir) not in sys.path:
    sys.path.insert(0, str(sdk_dir))

from epoclaim import EpoClaim, AsyncEpoClaim, EpoClaimNetworkError, EpoClaimTimeoutError


def test_sync_client_live():
    print("=== Python SDK (Sync) Live E2E Test ===")
    client = EpoClaim(base_url="http://127.0.0.1:8000", timeout=30.0)

    # 1. Health check
    health = client.health()
    assert health["status"] == "healthy"
    assert health["service"] == "EpoClaim"
    print("PASS: Sync health check:", health["service"])

    # 2. Analyze
    llm_answer = "Apollo 11 landed on the moon on July 20, 1969."
    report = client.analyze(
        prompt="When did Apollo 11 land on the moon?",
        response_text=llm_answer,
        context_documents=["On July 20, 1969, American astronauts Neil Armstrong and Buzz Aldrin landed the Apollo 11 Lunar Module on the Moon."],
        enable_live_search=False,
    )
    assert report["report_id"].startswith("epo_")
    assert report["total_claims"] >= 1
    assert report["supported_claims"] >= 1
    print(f"PASS: Sync analyze produced report {report['report_id']} (Supported: {report['supported_claims']})")

    # 3. Get report by ID
    fetched = client.get_report(report["report_id"])
    assert fetched["report_id"] == report["report_id"]
    assert fetched["overall_assessment"] == report["overall_assessment"]
    print("PASS: Sync get_report matches analyzed report.")

    # 4. Network error on unreachable host
    dead_client = EpoClaim(base_url="http://127.0.0.1:59999", timeout=2.0)
    try:
        dead_client.health()
        assert False, "Should have raised an error"
    except (EpoClaimNetworkError, EpoClaimTimeoutError):
        print("PASS: Sync client caught network/timeout error on unreachable backend.")


async def test_async_client_live():
    print("\n=== Python SDK (Async) Live E2E Test ===")
    client = AsyncEpoClaim(base_url="http://127.0.0.1:8000", timeout=30.0)

    # 1. Health check
    health = await client.health()
    assert health["status"] == "healthy"
    print("PASS: Async health check:", health["service"])

    # 2. Analyze
    llm_answer = "Apollo 11 landed on the moon on July 20, 1969."
    report = await client.analyze(
        prompt="When did Apollo 11 land on the moon?",
        response_text=llm_answer,
        context_documents=["On July 20, 1969, American astronauts Neil Armstrong and Buzz Aldrin landed the Apollo 11 Lunar Module on the Moon."],
        enable_live_search=False,
    )
    assert report["report_id"].startswith("epo_")
    print(f"PASS: Async analyze produced report {report['report_id']}")

    # 3. Get report
    fetched = await client.get_report(report["report_id"])
    assert fetched["report_id"] == report["report_id"]
    print("PASS: Async get_report matches analyzed report.")

    # 4. Network error
    dead_client = AsyncEpoClaim(base_url="http://127.0.0.1:59999", timeout=2.0)
    try:
        await dead_client.health()
        assert False, "Should have raised an error"
    except (EpoClaimNetworkError, EpoClaimTimeoutError):
        print("PASS: Async client caught network/timeout error on unreachable backend.")


if __name__ == "__main__":
    test_sync_client_live()
    asyncio.run(test_async_client_live())
    print("\n=== ALL PYTHON SDK LIVE E2E TESTS PASSED ===")
