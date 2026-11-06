"""Persistent, concurrency-safe credit ledger for Tavily API budget protection.

Enforces:
- Initial development budget hard cap of 500 credits.
- Concurrency-safe atomic reservations in SQLite before making network calls.
- Manual-only budget cap bumps (e.g. 500 -> 600) with permanent audit trail.
- Persistent tracking across backend restarts.
- Prevention of decreases below consumed credits.
"""
from __future__ import annotations

import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from pathlib import Path

from app.core.config import settings
from app.core.temporal import utc_now

logger = logging.getLogger(__name__)


def _get_db_path() -> str:
    url = settings.database_url
    if url.startswith("sqlite:///"):
        return url[len("sqlite:///"):]
    return "epoclaim.db"


class TavilyCreditLedger:
    """Manages persistent credit allocations, reservations, and usage records."""

    INITIAL_DEV_CAP = 500
    MAX_ACCOUNT_BUDGET = 1000
    INCREMENT_STEP = 100

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or _get_db_path()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        # Use timeout to safely handle concurrent transaction serialization
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initialize ledger tables and default cap."""
        with self._get_connection() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            # Budget config and current status
            conn.execute(
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
            # Budget audit log for manual increases
            conn.execute(
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
            # Individual transaction reservations and actual costs
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tavily_reservations (
                    reservation_id TEXT PRIMARY KEY,
                    query_text TEXT NOT NULL,
                    reserved_credits INTEGER NOT NULL,
                    actual_credits INTEGER,
                    status TEXT NOT NULL, -- 'RESERVED', 'CONFIRMED', 'RELEASED', 'FAILED_CHARGED'
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP
                )
                """
            )
            # Insert initial row if not exists
            cur = conn.cursor()
            cur.execute("SELECT id FROM tavily_budget_config WHERE id = 1")
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO tavily_budget_config (id, budget_cap, consumed_credits, reserved_credits)
                    VALUES (1, ?, 0, 0)
                    """,
                    (self.INITIAL_DEV_CAP,),
                )
                cur.execute(
                    """
                    INSERT INTO tavily_budget_audit_log (audit_id, previous_cap, new_cap, change_reason)
                    VALUES (?, 0, ?, 'Initial development budget initialization')
                    """,
                    (f"audit_{uuid.uuid4().hex[:8]}", self.INITIAL_DEV_CAP),
                )
            conn.commit()

    def get_ledger_status(self) -> Dict[str, Any]:
        """Fetch current budget, consumed, reserved, and available credits."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT budget_cap, consumed_credits, reserved_credits FROM tavily_budget_config WHERE id = 1")
            row = cur.fetchone()
            if not row:
                return {
                    "budget_cap": self.INITIAL_DEV_CAP,
                    "consumed_credits": 0,
                    "reserved_credits": 0,
                    "available_credits": self.INITIAL_DEV_CAP,
                }
            cap = row["budget_cap"]
            consumed = row["consumed_credits"]
            reserved = row["reserved_credits"]
            available = max(0, cap - (consumed + reserved))
            return {
                "budget_cap": cap,
                "consumed_credits": consumed,
                "reserved_credits": reserved,
                "available_credits": available,
            }

    def reserve_credit(self, query: str, cost: int = 1) -> Tuple[bool, str, Optional[str]]:
        """Atomically reserve credit for a search request.

        Returns:
            (success, message, reservation_id)
        """
        res_id = f"res_{uuid.uuid4().hex[:10]}"
        conn = self._get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            cur = conn.cursor()
            cur.execute("SELECT budget_cap, consumed_credits, reserved_credits FROM tavily_budget_config WHERE id = 1")
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return False, "Ledger uninitialized", None

            cap = row["budget_cap"]
            consumed = row["consumed_credits"]
            reserved = row["reserved_credits"]

            if (consumed + reserved + cost) > cap:
                conn.rollback()
                return False, (
                    f"Tavily development budget exceeded: cap={cap}, consumed={consumed}, "
                    f"reserved={reserved}, requested={cost}. Request blocked to protect budget."
                ), None

            # Update reserved credits
            cur.execute(
                """
                UPDATE tavily_budget_config
                SET reserved_credits = reserved_credits + ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """,
                (cost,),
            )
            # Insert reservation entry
            cur.execute(
                """
                INSERT INTO tavily_reservations (reservation_id, query_text, reserved_credits, status)
                VALUES (?, ?, ?, 'RESERVED')
                """,
                (res_id, query, cost),
            )
            conn.commit()
            return True, "Credit reserved successfully", res_id
        except Exception as exc:
            conn.rollback()
            logger.error(f"Error during credit reservation: {exc}")
            return False, f"Ledger transaction failure: {str(exc)}", None
        finally:
            conn.close()

    def confirm_usage(self, reservation_id: str, actual_cost: int = 1) -> None:
        """Confirm actual cost charged, decrementing reserved and incrementing consumed."""
        conn = self._get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            cur = conn.cursor()
            cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ?", (reservation_id,))
            row = cur.fetchone()
            if not row or row["status"] != "RESERVED":
                conn.rollback()
                return

            reserved_cost = row["reserved_credits"]
            cur.execute(
                """
                UPDATE tavily_budget_config
                SET reserved_credits = max(0, reserved_credits - ?),
                    consumed_credits = consumed_credits + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """,
                (reserved_cost, actual_cost),
            )
            cur.execute(
                """
                UPDATE tavily_reservations
                SET actual_credits = ?, status = 'CONFIRMED', resolved_at = CURRENT_TIMESTAMP
                WHERE reservation_id = ?
                """,
                (actual_cost, reservation_id),
            )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            logger.error(f"Error confirming credit usage for {reservation_id}: {exc}")
        finally:
            conn.close()

    def release_reservation(self, reservation_id: str, reason: str = "") -> None:
        """Release reservation ONLY when provider did not charge (e.g. client pre-check failure)."""
        conn = self._get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            cur = conn.cursor()
            cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ?", (reservation_id,))
            row = cur.fetchone()
            if not row or row["status"] != "RESERVED":
                conn.rollback()
                return

            reserved_cost = row["reserved_credits"]
            cur.execute(
                """
                UPDATE tavily_budget_config
                SET reserved_credits = max(0, reserved_credits - ?),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """,
                (reserved_cost,),
            )
            cur.execute(
                """
                UPDATE tavily_reservations
                SET status = 'RELEASED', error_message = ?, resolved_at = CURRENT_TIMESTAMP
                WHERE reservation_id = ?
                """,
                (reason, reservation_id),
            )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            logger.error(f"Error releasing reservation {reservation_id}: {exc}")
        finally:
            conn.close()

    def mark_failed_charged(self, reservation_id: str, error_msg: str, actual_cost: int = 1) -> None:
        """Mark as consumed if provider received request but timed out or failed mid-stream."""
        conn = self._get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            cur = conn.cursor()
            cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ?", (reservation_id,))
            row = cur.fetchone()
            if not row or row["status"] != "RESERVED":
                conn.rollback()
                return

            reserved_cost = row["reserved_credits"]
            cur.execute(
                """
                UPDATE tavily_budget_config
                SET reserved_credits = max(0, reserved_credits - ?),
                    consumed_credits = consumed_credits + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """,
                (reserved_cost, actual_cost),
            )
            cur.execute(
                """
                UPDATE tavily_reservations
                SET actual_credits = ?, status = 'FAILED_CHARGED', error_message = ?, resolved_at = CURRENT_TIMESTAMP
                WHERE reservation_id = ?
                """,
                (actual_cost, error_msg, reservation_id),
            )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            logger.error(f"Error marking failed-charged reservation {reservation_id}: {exc}")
        finally:
            conn.close()

    def manual_increase_budget(self, new_cap: int, reason: str) -> Tuple[bool, str]:
        """Manually bump budget cap with audit log.

        Enforces strict validation:
        - Must be exactly INCREMENT_STEP (100 credits) above current cap.
        - Cannot exceed MAX_ACCOUNT_BUDGET (1000 credits).
        - Cannot decrease below consumed + reserved credits.
        """
        if not reason or not reason.strip():
            return False, "Change reason is required for manual budget modifications."

        conn = self._get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            cur = conn.cursor()
            cur.execute("SELECT budget_cap, consumed_credits, reserved_credits FROM tavily_budget_config WHERE id = 1")
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return False, "Ledger uninitialized"

            current_cap = row["budget_cap"]
            consumed = row["consumed_credits"]
            reserved = row["reserved_credits"]
            min_required = consumed + reserved

            # 1. Reject decreases below consumed + reserved
            if new_cap < min_required:
                conn.rollback()
                return False, f"Cannot decrease budget cap below committed credits ({min_required} = {consumed} consumed + {reserved} reserved)."

            # 2. Reject caps exceeding account maximum
            if new_cap > self.MAX_ACCOUNT_BUDGET:
                conn.rollback()
                return False, f"Cannot increase budget cap beyond account hard ceiling of {self.MAX_ACCOUNT_BUDGET} credits (requested {new_cap})."

            # 3. Reject non-stepped jumps: must be exactly current_cap + 100
            expected_cap = current_cap + self.INCREMENT_STEP
            if new_cap != expected_cap:
                conn.rollback()
                return False, (
                    f"Budget increases must be in exact stepped increments of {self.INCREMENT_STEP} credits. "
                    f"Current cap is {current_cap}; next allowed cap is {expected_cap} (requested {new_cap})."
                )

            cur.execute(
                """
                UPDATE tavily_budget_config
                SET budget_cap = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """,
                (new_cap,),
            )
            audit_id = f"audit_{uuid.uuid4().hex[:8]}"
            cur.execute(
                """
                INSERT INTO tavily_budget_audit_log (audit_id, previous_cap, new_cap, change_reason)
                VALUES (?, ?, ?, ?)
                """,
                (audit_id, current_cap, new_cap, reason.strip()),
            )
            conn.commit()
            return True, f"Budget cap increased from {current_cap} to {new_cap} successfully."
        except Exception as exc:
            conn.rollback()
            return False, f"Failed to increase budget: {str(exc)}"
        finally:
            conn.close()

    def get_audit_logs(self, limit: int = 20) -> list[Dict[str, Any]]:
        """Return history of manual budget cap adjustments."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT audit_id, previous_cap, new_cap, change_reason, created_at
                FROM tavily_budget_audit_log
                ORDER BY created_at DESC LIMIT ?
                """,
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]


# Global singleton ledger instance
tavily_ledger = TavilyCreditLedger()

