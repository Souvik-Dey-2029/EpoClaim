"""End-to-end integration test for the unified EpoClaim pipeline."""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timezone
import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.pipeline import EpoClaimPipeline
from app.schemas.report import AnalyzeRequest
from app.schemas.verification import VerificationVerdict
from app.storage.repository import report_repo


def test_pipeline_e2e_multi_claim():
    async def _run():
        pipeline = EpoClaimPipeline()

        input_text = (
            "Apollo 11 landed on the moon in 1969. "
            "Mira Murati was the CEO of OpenAI. "
            "Sam Altman is currently the CEO of OpenAI."
        )

        context_docs = [
            "On July 20, 1969, Apollo 11 landed on the moon with Neil Armstrong and Buzz Aldrin.",
            "Mira Murati was appointed interim CEO on November 17, 2023.",
            "Sam Altman returned as CEO on November 29, 2023, succeeding interim CEO Mira Murati.",
        ]

        request = AnalyzeRequest(
            prompt="Tell me about Apollo 11 and OpenAI leadership",
            response_text=input_text,
            context_documents=context_docs,
            enable_live_search=False,
        )

        report = await pipeline.run(request)

        assert report.report_id.startswith("epo_")
        assert report.total_claims >= 2
        assert len(report.claim_results) >= 2

        # Verify report is stored in SQLite
        saved = report_repo.get_report(report.report_id)
        assert saved is not None
        assert saved.report_id == report.report_id
        assert saved.total_claims == report.total_claims
        assert len(saved.evidence_sources) > 0

    asyncio.run(_run())
