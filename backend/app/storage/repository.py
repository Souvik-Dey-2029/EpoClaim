"""Persistence layer for analysis reports."""
from __future__ import annotations

import json
import logging
from typing import Optional, Dict

from app.schemas.report import FinalReport
from app.core.temporal import utc_now
from app.storage.db import DatabaseManager, db_manager

logger = logging.getLogger(__name__)


class ReportRepository:
    """Stores and retrieves FinalReport objects using durable persistence with in-memory caching."""

    def __init__(self, db: Optional[DatabaseManager] = None, db_path: Optional[str] = None):
        if db_path is not None:
            self.db = DatabaseManager(url=db_path)
        else:
            self.db = db or db_manager
        self._memory_cache: Dict[str, FinalReport] = {}
        try:
            self.db.init_schema()
        except Exception as exc:
            logger.warning("Report repository schema initialization note: %s", exc)

    def save_report(self, report: FinalReport) -> None:
        """Save or replace a report in memory and in the database."""
        # Always update in-memory cache first
        self._memory_cache[report.report_id] = report

        # Ensure transaction_time is stamped on committed evidence records if missing
        now_utc = utc_now()
        for ev in report.evidence_sources:
            if ev.transaction_time is None:
                ev.transaction_time = now_utc
        for cr in report.claim_results:
            for ev in cr.supporting_evidence:
                if ev.transaction_time is None:
                    ev.transaction_time = now_utc
            for ev in cr.contradicting_evidence:
                if ev.transaction_time is None:
                    ev.transaction_time = now_utc

        upsert_sql = """
        INSERT INTO reports (
            report_id, original_input, total_claims, supported_claims,
            partially_supported_claims, contradicted_claims, outdated_claims,
            insufficient_evidence_claims, unverified_claims, overall_assessment, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (report_id) DO UPDATE SET
            original_input = EXCLUDED.original_input,
            total_claims = EXCLUDED.total_claims,
            supported_claims = EXCLUDED.supported_claims,
            partially_supported_claims = EXCLUDED.partially_supported_claims,
            contradicted_claims = EXCLUDED.contradicted_claims,
            outdated_claims = EXCLUDED.outdated_claims,
            insufficient_evidence_claims = EXCLUDED.insufficient_evidence_claims,
            unverified_claims = EXCLUDED.unverified_claims,
            overall_assessment = EXCLUDED.overall_assessment,
            payload = EXCLUDED.payload
        """

        try:
            payload_json = report.model_dump_json()
            with self.db.cursor() as cur:
                cur.execute(
                    upsert_sql,
                    (
                        report.report_id,
                        report.original_input,
                        report.total_claims,
                        report.supported_claims,
                        getattr(report, "partially_supported_claims", 0),
                        report.contradicted_claims,
                        report.outdated_claims,
                        report.insufficient_evidence_claims,
                        report.unverified_claims,
                        report.overall_assessment,
                        payload_json,
                    ),
                )
        except Exception as exc:
            logger.warning("Could not persist report %s to database (cached in-memory): %s", report.report_id, exc)

    def get_report(self, report_id: str) -> Optional[FinalReport]:
        """Fetch a report by ID, checking memory cache before database."""
        if report_id in self._memory_cache:
            return self._memory_cache[report_id]

        try:
            with self.db.cursor() as cur:
                cur.execute("SELECT payload FROM reports WHERE report_id = ?", (report_id,))
                row = cur.fetchone()
                if not row:
                    return None
                payload = row["payload"]
                if isinstance(payload, str):
                    data = json.loads(payload)
                elif isinstance(payload, dict):
                    data = payload
                else:
                    data = json.loads(str(payload))
                report = FinalReport.model_validate(data)
                self._memory_cache[report_id] = report
                return report
        except Exception as exc:
            logger.warning("Could not load report %s from database: %s", report_id, exc)
            return None


# Global repository instance
report_repo = ReportRepository()
