"""
Position reconciliation service.

Compares open positions in the database with live MT5 positions to detect
mismatches. A mismatch blocks new trades until resolved.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Set

logger = logging.getLogger(__name__)


@dataclass
class ReconciliationResult:
    """Outcome of a position reconciliation check."""
    is_clean: bool = True
    db_only_tickets: List[int] = field(default_factory=list)     # in DB but not in MT5
    mt5_only_tickets: List[int] = field(default_factory=list)    # in MT5 but not in DB
    matched_tickets: List[int] = field(default_factory=list)
    mismatched_details: List[Dict[str, Any]] = field(default_factory=list)
    message: str = "Positions reconciled"

    @property
    def has_mismatch(self) -> bool:
        return len(self.db_only_tickets) > 0 or len(self.mt5_only_tickets) > 0


class ReconciliationService:
    """
    Ensures DB and MT5 positions are in sync before allowing new trades.
    """

    def reconcile(
        self,
        db_positions: List[Dict[str, Any]],
        mt5_positions: List[Dict[str, Any]],
    ) -> ReconciliationResult:
        """
        Compare DB open positions with MT5 live positions.

        Args:
            db_positions: List of dicts with at least {"ticket": int, "status": str}
            mt5_positions: List of dicts with at least {"ticket": int}

        Returns:
            ReconciliationResult
        """
        result = ReconciliationResult()

        db_tickets: Set[int] = {
            p["ticket"] for p in db_positions
            if p.get("status") in ("OPEN", "FILLED", "PLACED")
        }
        mt5_tickets: Set[int] = {p["ticket"] for p in mt5_positions}

        result.matched_tickets = sorted(db_tickets & mt5_tickets)
        result.db_only_tickets = sorted(db_tickets - mt5_tickets)
        result.mt5_only_tickets = sorted(mt5_tickets - db_tickets)

        if result.db_only_tickets:
            result.is_clean = False
            for ticket in result.db_only_tickets:
                result.mismatched_details.append({
                    "ticket": ticket,
                    "issue": "IN_DB_NOT_MT5",
                    "action_required": "Close in DB or re-sync",
                })
                logger.warning("RECON: ticket %d in DB but not in MT5", ticket)

        if result.mt5_only_tickets:
            result.is_clean = False
            for ticket in result.mt5_only_tickets:
                result.mismatched_details.append({
                    "ticket": ticket,
                    "issue": "IN_MT5_NOT_DB",
                    "action_required": "Create DB record or investigate",
                })
                logger.warning("RECON: ticket %d in MT5 but not in DB", ticket)

        if result.is_clean:
            result.message = f"Clean: {len(result.matched_tickets)} positions matched"
        else:
            result.message = (
                f"MISMATCH: {len(result.db_only_tickets)} DB-only, "
                f"{len(result.mt5_only_tickets)} MT5-only, "
                f"{len(result.matched_tickets)} matched"
            )
            logger.error("RECONCILIATION: %s", result.message)

        return result

    def auto_resolve_mt5_only(
        self,
        mt5_positions: List[Dict[str, Any]],
        magic_number: int = 999999,
    ) -> List[Dict[str, Any]]:
        """
        For positions in MT5 but not in DB, generate DB records if they
        match our magic number (i.e., they were placed by this system).
        """
        to_create = []
        for pos in mt5_positions:
            if pos.get("magic") == magic_number:
                to_create.append({
                    "ticket": pos["ticket"],
                    "symbol": pos.get("symbol", "XAUUSD"),
                    "side": pos.get("side", "BUY"),
                    "volume": pos.get("volume", 0.01),
                    "price_open": pos.get("price_open", 0),
                    "sl": pos.get("sl", 0),
                    "tp": pos.get("tp", 0),
                    "comment": pos.get("comment", ""),
                    "source": "reconciliation_auto_resolve",
                })
                logger.info(
                    "RECON auto-resolve: creating DB record for MT5 ticket %d",
                    pos["ticket"],
                )
        return to_create
