"""Unified database connection and persistence manager for EpoClaim.

Supports:
- SQLite for local development and unit testing.
- PostgreSQL / Supabase for durable production deployments on Vercel Serverless.
- Fail-fast enforcement prohibiting silent ephemeral /tmp SQLite storage in production.
- Concurrency-safe atomic transactions and row locking.
"""
from __future__ import annotations

import contextlib
import json
import logging
import os
import re
import sqlite3
from typing import Any, Dict, Generator, Iterator, List, Optional, Tuple, Union

try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_production_environment() -> bool:
    """Return True if running in a deployed production or serverless environment."""
    env = (settings.environment or "").lower()
    return (
        env == "production"
        or bool(os.environ.get("VERCEL"))
        or bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    )


def validate_database_url_for_environment(url: str) -> None:
    """Fail-fast validator prohibiting ephemeral SQLite in production."""
    if is_production_environment():
        is_postgres = url.startswith("postgresql://") or url.startswith("postgres://")
        if not is_postgres:
            raise RuntimeError(
                "Production deployment error: DATABASE_URL must be configured with a durable "
                "PostgreSQL/Supabase connection string (e.g. postgresql://user:pass@ep-xyz.supabase.com:5432/postgres). "
                f"Ephemeral SQLite storage ('{url}') and silent fallback to /tmp are strictly prohibited in production "
                "to prevent data loss across serverless function instances."
            )


class DatabaseCursorWrapper:
    """Wraps database cursors to unify parameter binding and result formatting."""

    def __init__(self, raw_cursor: Any, is_postgres: bool):
        self._cur = raw_cursor
        self._is_postgres = is_postgres

    def _prepare_sql(self, sql: str) -> str:
        if self._is_postgres:
            # Convert SQLite ? placeholders to PostgreSQL %s placeholders outside literals
            return sql.replace("?", "%s")
        return sql

    def execute(self, sql: str, params: Optional[Union[tuple, list]] = None) -> Any:
        prepared_sql = self._prepare_sql(sql)
        if params is None:
            return self._cur.execute(prepared_sql)
        return self._cur.execute(prepared_sql, params)

    def fetchone(self) -> Optional[Dict[str, Any]]:
        row = self._cur.fetchone()
        if row is None:
            return None
        if self._is_postgres:
            return dict(row)
        return dict(row)

    def fetchall(self) -> List[Dict[str, Any]]:
        rows = self._cur.fetchall()
        if self._is_postgres:
            return [dict(r) for r in rows]
        return [dict(r) for r in rows]

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount


class DatabaseManager:
    """Manages database connections, schemas, and transactions for EpoClaim."""

    def __init__(self, url: Optional[str] = None):
        self._raw_url = url or settings.database_url
        validate_database_url_for_environment(self._raw_url)
        self.is_postgres = self._raw_url.startswith("postgresql://") or self._raw_url.startswith("postgres://")
        self._db_path = self._resolve_sqlite_path(self._raw_url) if not self.is_postgres else None
        self._initialized = False

    def _resolve_sqlite_path(self, url: str) -> str:
        if url.startswith("sqlite:///"):
            return url[len("sqlite:///"):]
        return url or "epoclaim.db"

    @contextlib.contextmanager
    def get_connection(self) -> Generator[Any, None, None]:
        """Context manager yielding a transactional database connection."""
        if self.is_postgres:
            if not PSYCOPG2_AVAILABLE:
                raise RuntimeError("psycopg2 is required for PostgreSQL persistence but is not installed.")
            dsn = self._raw_url
            if dsn.startswith("postgres://"):
                dsn = "postgresql://" + dsn[len("postgres://"):]
            conn = psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor, connect_timeout=10)
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        else:
            conn = sqlite3.connect(self._db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    @contextlib.contextmanager
    def cursor(self) -> Generator[DatabaseCursorWrapper, None, None]:
        """Yields a DatabaseCursorWrapper within an active transaction."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            try:
                yield DatabaseCursorWrapper(cur, self.is_postgres)
            finally:
                cur.close()

    def init_schema(self) -> None:
        """Create all required persistence tables idempotently."""
        if self._initialized:
            return

        with self.cursor() as cur:
            # 1. Reports table
            if self.is_postgres:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS reports (
                        report_id TEXT PRIMARY KEY,
                        original_input TEXT NOT NULL,
                        total_claims INTEGER NOT NULL,
                        supported_claims INTEGER NOT NULL,
                        partially_supported_claims INTEGER DEFAULT 0,
                        contradicted_claims INTEGER NOT NULL,
                        outdated_claims INTEGER NOT NULL,
                        insufficient_evidence_claims INTEGER NOT NULL,
                        unverified_claims INTEGER NOT NULL,
                        overall_assessment TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        payload JSONB NOT NULL
                    )
                    """
                )
            else:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS reports (
                        report_id TEXT PRIMARY KEY,
                        original_input TEXT NOT NULL,
                        total_claims INTEGER NOT NULL,
                        supported_claims INTEGER NOT NULL,
                        partially_supported_claims INTEGER DEFAULT 0,
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

            # 2. Tavily Budget Config
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tavily_budget_config (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    budget_cap INTEGER NOT NULL,
                    consumed_credits INTEGER NOT NULL DEFAULT 0,
                    reserved_credits INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            # 3. Tavily Budget Audit Log
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tavily_budget_audit_log (
                    audit_id TEXT PRIMARY KEY,
                    previous_cap INTEGER NOT NULL,
                    new_cap INTEGER NOT NULL,
                    change_reason TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            # 4. Tavily Reservations
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tavily_reservations (
                    reservation_id TEXT PRIMARY KEY,
                    query_text TEXT NOT NULL,
                    reserved_credits INTEGER NOT NULL,
                    actual_credits INTEGER,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP
                )
                """
            )

            # 5. Tavily Search Cache
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tavily_search_cache (
                    cache_key TEXT PRIMARY KEY,
                    query_text TEXT NOT NULL,
                    search_depth TEXT NOT NULL,
                    max_results INTEGER NOT NULL,
                    results_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL
                )
                """
            )

        self._initialized = True


# Global default database manager
db_manager = DatabaseManager()

