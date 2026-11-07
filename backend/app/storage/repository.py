"""Persistence layer for analysis reports."""
from __future__ import annotations

import json
import sqlite3
from typing import Optional
from pathlib import Path

from app.schemas.report import FinalReport
from app.core.config import settings


class ReportRepository:
    """Stores and retrieves FinalReport objects using SQLite."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            # Handle sqlite:///./epoclaim.db or file path
            url = settings.database_url
            if url.startswith("sqlite:///"):
                db_path = url[len("sqlite:///"):]
            else:
                db_path = "epoclaim.db"
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS reports (
                    report_id TEXT PRIMARY KEY,
                    original_input TEXT NOT NULL,
                    total_claims INTEGER NOT NULL,
                    supported_claims INTEGER NOT NULL,
                    contradicted_claims INTEGER NOT NULL,
                    outdated_claims INTEGER NOT NULL,
                    insufficient_evidence_claims INTEGER NOT NULL,
                    unverified_claims INTEGER NOT NULL,
                    overall_assessment TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    payload JSON NOT NULL
                )
                """
            )
            # Add partially_supported_claims column if missing
            cur = conn.cursor()
            cur.execute("PRAGMA table_info(reports)")
            cols = [r["name"] for r in cur.fetchall()]
            if "partially_supported_claims" not in cols:
                try:
                    conn.execute("ALTER TABLE reports ADD COLUMN partially_supported_claims INTEGER DEFAULT 0")
                except Exception:
                    pass
            conn.commit()

    def save_report(self, report: FinalReport) -> None:
        """Save or replace a report in the database."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO reports (
                    report_id, original_input, total_claims, supported_claims,
                    partially_supported_claims, contradicted_claims, outdated_claims,
                    insufficient_evidence_claims, unverified_claims, overall_assessment, payload
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
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
                    report.model_dump_json(),
                ),
            )
            conn.commit()

    def get_report(self, report_id: str) -> Optional[FinalReport]:
        """Fetch a report by ID."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT payload FROM reports WHERE report_id = ?", (report_id,))
            row = cur.fetchone()
            if not row:
                return None
            data = json.loads(row["payload"])
            return FinalReport.model_validate(data)


# Global repository instance
report_repo = ReportRepository()

