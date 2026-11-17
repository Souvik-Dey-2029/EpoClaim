"""Persistent, concurrency-safe credit ledger for Tavily API budget protection.

Enforces:
- Initial development budget hard cap of 5000 credits.
- Concurrency-safe atomic reservations in database before making network calls.
- Manual-only budget cap bumps (e.g. 5000 -> 5100) with permanent audit trail.
- Persistent tracking across backend restarts and serverless invocations.
- Prevention of decreases below consumed credits.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.storage.db import DatabaseManager, db_manager

logger = logging.getLogger(__name__)


class TavilyCreditLedger:
    """Manages persistent credit allocations, reservations, and usage records."""

    INITIAL_DEV_CAP = 5000
    MAX_ACCOUNT_BUDGET = 25000
    INCREMENT_STEP = 100

    def __init__(self, db_path: Optional[str] = None, db: Optional[DatabaseManager] = None):
        if db_path is not None:
            self.db = DatabaseManager(url=db_path)
            self.db_path = self.db._db_path
        else:
            self.db = db or db_manager
            self.db_path = self.db._db_path
        self._init_db()

    def _get_connection(self):
        """Provide direct connection context for backward compatibility and tests."""
        return self.db.get_connection()

    def _init_db(self) -> None:
        """Initialize ledger tables and default cap."""
        self.db.init_schema()
        with self.db.cursor() as cur:
            cur.execute("SELECT id, budget_cap FROM tavily_budget_config WHERE id = 1")
            existing_row = cur.fetchone()
            if not existing_row:
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
                    VALUES (?, 0, ?, 'Initial development budget initialization (5000 credits)')
                    """,
                    (f"audit_{uuid.uuid4().hex[:8]}", self.INITIAL_DEV_CAP),
                )
            elif existing_row["budget_cap"] < self.INITIAL_DEV_CAP:
                old_cap = existing_row["budget_cap"]
                cur.execute(
                    """
                    UPDATE tavily_budget_config
                    SET budget_cap = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                    """,
                    (self.INITIAL_DEV_CAP,),
                )
                cur.execute(
                    """
                    INSERT INTO tavily_budget_audit_log (audit_id, previous_cap, new_cap, change_reason)
                    VALUES (?, ?, ?, 'System migration: extended Tavily budget cap to 5000 credits')
                    """,
                    (f"audit_{uuid.uuid4().hex[:8]}", old_cap, self.INITIAL_DEV_CAP),
                )

    def get_ledger_status(self) -> Dict[str, Any]:
        """Fetch current budget, consumed, reserved, and available credits."""
        with self.db.cursor() as cur:
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
        """Atomically reserve credit for a search request."""
        res_id = f"res_{uuid.uuid4().hex[:10]}"
        try:
            with self.db.cursor() as cur:
                if self.db.is_postgres:
                    cur.execute("SELECT budget_cap, consumed_credits, reserved_credits FROM tavily_budget_config WHERE id = 1 FOR UPDATE")
                else:
                    cur.execute("SELECT budget_cap, consumed_credits, reserved_credits FROM tavily_budget_config WHERE id = 1")
                row = cur.fetchone()
                if not row:
                    return False, "Ledger uninitialized", None

                cap = row["budget_cap"]
                consumed = row["consumed_credits"]
                reserved = row["reserved_credits"]

                if (consumed + reserved + cost) > cap:
                    return False, (
                        f"Tavily development budget exceeded: cap={cap}, consumed={consumed}, "
                        f"reserved={reserved}, requested={cost}. Request blocked to protect budget."
                    ), None

                cur.execute(
                    """
                    UPDATE tavily_budget_config
                    SET reserved_credits = reserved_credits + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                    """,
                    (cost,),
                )
                cur.execute(
                    """
                    INSERT INTO tavily_reservations (reservation_id, query_text, reserved_credits, status)
                    VALUES (?, ?, ?, 'RESERVED')
                    """,
                    (res_id, query, cost),
                )
            return True, "Credit reserved successfully", res_id
        except Exception as exc:
            logger.error(f"Error during credit reservation: {exc}")
            return False, f"Ledger transaction failure: {str(exc)}", None

    def confirm_usage(self, reservation_id: str, actual_cost: int = 1) -> None:
        """Confirm actual cost charged, decrementing reserved and incrementing consumed."""
        try:
            with self.db.cursor() as cur:
                if self.db.is_postgres:
                    cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ? FOR UPDATE", (reservation_id,))
                else:
                    cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ?", (reservation_id,))
                row = cur.fetchone()
                if not row or row["status"] != "RESERVED":
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
        except Exception as exc:
            logger.error(f"Error confirming credit usage for {reservation_id}: {exc}")

    def release_reservation(self, reservation_id: str, reason: str = "") -> None:
        """Release reservation ONLY when provider did not charge."""
        try:
            with self.db.cursor() as cur:
                if self.db.is_postgres:
                    cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ? FOR UPDATE", (reservation_id,))
                else:
                    cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ?", (reservation_id,))
                row = cur.fetchone()
                if not row or row["status"] != "RESERVED":
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
        except Exception as exc:
            logger.error(f"Error releasing reservation {reservation_id}: {exc}")

    def mark_failed_charged(self, reservation_id: str, error_msg: str, actual_cost: int = 1) -> None:
        """Mark as consumed if provider received request but timed out or failed mid-stream."""
        try:
            with self.db.cursor() as cur:
                if self.db.is_postgres:
                    cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ? FOR UPDATE", (reservation_id,))
                else:
                    cur.execute("SELECT reserved_credits, status FROM tavily_reservations WHERE reservation_id = ?", (reservation_id,))
                row = cur.fetchone()
                if not row or row["status"] != "RESERVED":
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
        except Exception as exc:
            logger.error(f"Error marking failed-charged reservation {reservation_id}: {exc}")

    def manual_increase_budget(self, new_cap: int, reason: str) -> Tuple[bool, str]:
        """Manually bump budget cap with audit log."""
        if not reason or not reason.strip():
            return False, "Change reason is required for manual budget modifications."

        try:
            with self.db.cursor() as cur:
                if self.db.is_postgres:
                    cur.execute("SELECT budget_cap, consumed_credits, reserved_credits FROM tavily_budget_config WHERE id = 1 FOR UPDATE")
                else:
                    cur.execute("SELECT budget_cap, consumed_credits, reserved_credits FROM tavily_budget_config WHERE id = 1")
                row = cur.fetchone()
                if not row:
                    return False, "Ledger uninitialized"

                current_cap = row["budget_cap"]
                consumed = row["consumed_credits"]
                reserved = row["reserved_credits"]
                min_required = consumed + reserved

                if new_cap < min_required:
                    return False, f"Cannot decrease budget cap below committed credits ({min_required} = {consumed} consumed + {reserved} reserved)."

                if new_cap > self.MAX_ACCOUNT_BUDGET:
                    return False, f"Cannot increase budget cap beyond account hard ceiling of {self.MAX_ACCOUNT_BUDGET} credits (requested {new_cap})."

                expected_cap = current_cap + self.INCREMENT_STEP
                if new_cap != expected_cap:
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
            return True, f"Budget cap increased from {current_cap} to {new_cap} successfully."
        except Exception as exc:
            return False, f"Failed to increase budget: {str(exc)}"

    def get_audit_logs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Return history of manual budget cap adjustments."""
        with self.db.cursor() as cur:
            cur.execute(
                """
                SELECT audit_id, previous_cap, new_cap, change_reason, created_at
                FROM tavily_budget_audit_log
                ORDER BY created_at DESC LIMIT ?
                """,
                (limit,),
            )
            return cur.fetchall()


# Global singleton ledger instance
tavily_ledger = TavilyCreditLedger()
