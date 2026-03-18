"""
Profit Allocation Service for XAUUSD Trading System.

Splits net trading profits into three buckets:

1. **Reserve** (default 50 %) -- retained as a capital buffer / emergency fund.
2. **External** (default 30 %) -- withdrawn or transferred to external accounts.
3. **Reinvest** (default 20 %) -- added back to the trading balance.

Also provides reporting utilities for summarising allocation over a date range.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Bangkok timezone (UTC+7)
UTC_PLUS_7 = timezone(timedelta(hours=7))

# ---------------------------------------------------------------------------
# Default allocation percentages
# ---------------------------------------------------------------------------
DEFAULT_RESERVE_PCT: float = 0.50
DEFAULT_EXTERNAL_PCT: float = 0.30
DEFAULT_REINVEST_PCT: float = 0.20


def allocate_profit(
    net_profit: float,
    reserve_pct: float = DEFAULT_RESERVE_PCT,
    external_pct: float = DEFAULT_EXTERNAL_PCT,
    reinvest_pct: float = DEFAULT_REINVEST_PCT,
) -> Dict[str, Any]:
    """
    Allocate *net_profit* into reserve, external, and reinvest buckets.

    The three percentages must sum to 1.0 (100 %). If ``net_profit`` is
    zero or negative the allocation amounts will all be zero (losses are
    not split).

    Args:
        net_profit: Net trading profit for the allocation period (USD).
        reserve_pct: Fraction allocated to the reserve fund.
        external_pct: Fraction allocated to external withdrawal.
        reinvest_pct: Fraction allocated back into trading capital.

    Returns:
        Dict with the following keys:

        - ``net_profit`` (float): The input value.
        - ``reserve_amount`` (float)
        - ``external_amount`` (float)
        - ``reinvest_amount`` (float)
        - ``reserve_pct`` (float)
        - ``external_pct`` (float)
        - ``reinvest_pct`` (float)
        - ``allocated_at`` (str): ISO-8601 timestamp of allocation.
        - ``note`` (str): Human-readable summary or warning.

    Raises:
        ValueError: If the percentages do not sum to 1.0 (within tolerance).
    """
    # ------------------------------------------------------------------
    # Validate percentages
    # ------------------------------------------------------------------
    total_pct = reserve_pct + external_pct + reinvest_pct
    if abs(total_pct - 1.0) > 1e-6:
        raise ValueError(
            f"Allocation percentages must sum to 1.0, got {total_pct:.4f} "
            f"(reserve={reserve_pct}, external={external_pct}, "
            f"reinvest={reinvest_pct})."
        )

    # ------------------------------------------------------------------
    # Calculate amounts
    # ------------------------------------------------------------------
    if net_profit <= 0:
        note = (
            "No profit to allocate."
            if net_profit == 0
            else f"Net loss of ${abs(net_profit):.2f} -- no allocation applied."
        )
        return {
            "net_profit": round(net_profit, 2),
            "reserve_amount": 0.0,
            "external_amount": 0.0,
            "reinvest_amount": 0.0,
            "reserve_pct": reserve_pct,
            "external_pct": external_pct,
            "reinvest_pct": reinvest_pct,
            "allocated_at": datetime.now(tz=UTC_PLUS_7).isoformat(),
            "note": note,
        }

    reserve_amount = round(net_profit * reserve_pct, 2)
    external_amount = round(net_profit * external_pct, 2)
    reinvest_amount = round(net_profit * reinvest_pct, 2)

    # Adjust for rounding so the three parts sum exactly to net_profit
    rounding_diff = round(
        net_profit - (reserve_amount + external_amount + reinvest_amount), 2
    )
    if rounding_diff != 0:
        # Apply the rounding remainder to the largest bucket (reserve)
        reserve_amount = round(reserve_amount + rounding_diff, 2)

    result = {
        "net_profit": round(net_profit, 2),
        "reserve_amount": reserve_amount,
        "external_amount": external_amount,
        "reinvest_amount": reinvest_amount,
        "reserve_pct": reserve_pct,
        "external_pct": external_pct,
        "reinvest_pct": reinvest_pct,
        "allocated_at": datetime.now(tz=UTC_PLUS_7).isoformat(),
        "note": (
            f"Profit of ${net_profit:.2f} allocated: "
            f"reserve=${reserve_amount:.2f} ({reserve_pct*100:.0f}%), "
            f"external=${external_amount:.2f} ({external_pct*100:.0f}%), "
            f"reinvest=${reinvest_amount:.2f} ({reinvest_pct*100:.0f}%)."
        ),
    }

    logger.info(
        "Profit allocated: $%.2f => reserve=$%.2f, external=$%.2f, "
        "reinvest=$%.2f",
        net_profit,
        reserve_amount,
        external_amount,
        reinvest_amount,
    )
    return result


def generate_allocation_report(
    account_id: str,
    period_start: datetime,
    period_end: datetime,
    session: Any = None,
) -> Dict[str, Any]:
    """
    Generate a profit-allocation report for the given period.

    If a database *session* is provided, closed trades are loaded from the
    ``TradeHistory`` model. Otherwise a stub report with zero values is
    returned.

    Args:
        account_id: Unique account identifier.
        period_start: Start of the reporting period (inclusive).
        period_end: End of the reporting period (inclusive).
        session: SQLAlchemy database session (or ``None`` for stub mode).

    Returns:
        Dict containing:

        - ``account_id`` (str)
        - ``period_start`` (str): ISO-8601
        - ``period_end`` (str): ISO-8601
        - ``total_trades`` (int)
        - ``winning_trades`` (int)
        - ``losing_trades`` (int)
        - ``gross_profit`` (float)
        - ``gross_loss`` (float)
        - ``commissions`` (float)
        - ``swaps`` (float)
        - ``net_profit`` (float)
        - ``allocation`` (dict): Output of ``allocate_profit()``
        - ``trades`` (list[dict]): Individual trade summaries
        - ``generated_at`` (str): ISO-8601 timestamp
    """
    trades = _load_trades(account_id, period_start, period_end, session)

    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t.get("profit", 0) > 0)
    losing_trades = sum(1 for t in trades if t.get("profit", 0) < 0)
    gross_profit = round(
        sum(t["profit"] for t in trades if t.get("profit", 0) > 0), 2
    )
    gross_loss = round(
        sum(t["profit"] for t in trades if t.get("profit", 0) < 0), 2
    )
    commissions = round(sum(t.get("commission", 0) for t in trades), 2)
    swaps = round(sum(t.get("swap", 0) for t in trades), 2)
    net_profit = round(gross_profit + gross_loss + commissions + swaps, 2)

    allocation = allocate_profit(net_profit)

    win_rate = (
        round(winning_trades / total_trades * 100, 2) if total_trades > 0 else 0.0
    )
    avg_win = (
        round(gross_profit / winning_trades, 2) if winning_trades > 0 else 0.0
    )
    avg_loss = (
        round(abs(gross_loss) / losing_trades, 2) if losing_trades > 0 else 0.0
    )
    profit_factor = (
        round(gross_profit / abs(gross_loss), 2) if gross_loss != 0 else 0.0
    )

    report: Dict[str, Any] = {
        "account_id": account_id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate_pct": win_rate,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "profit_factor": profit_factor,
        "gross_profit": gross_profit,
        "gross_loss": gross_loss,
        "commissions": commissions,
        "swaps": swaps,
        "net_profit": net_profit,
        "allocation": allocation,
        "trades": trades,
        "generated_at": datetime.now(tz=UTC_PLUS_7).isoformat(),
    }

    logger.info(
        "Allocation report generated for %s (%s to %s): "
        "%d trades, net=$%.2f, win_rate=%.1f%%",
        account_id,
        period_start.date(),
        period_end.date(),
        total_trades,
        net_profit,
        win_rate,
    )
    return report


# ======================================================================
# Internal helpers
# ======================================================================

def _load_trades(
    account_id: str,
    period_start: datetime,
    period_end: datetime,
    session: Any,
) -> List[Dict[str, Any]]:
    """
    Load closed trades for the given account and period.

    Falls back to an empty list when no DB session or model is available.
    """
    if session is None:
        logger.debug(
            "No DB session provided -- returning empty trade list for report."
        )
        return []

    try:
        from backend.models.trade_history import TradeHistory
    except ImportError:
        logger.debug(
            "TradeHistory model not available -- returning empty trade list."
        )
        return []

    try:
        records = (
            session.query(TradeHistory)
            .filter(
                TradeHistory.account_id == account_id,
                TradeHistory.close_time >= period_start,
                TradeHistory.close_time <= period_end,
            )
            .order_by(TradeHistory.close_time.asc())
            .all()
        )
    except Exception:
        logger.exception("Failed to query trade history for %s.", account_id)
        return []

    trades: List[Dict[str, Any]] = []
    for r in records:
        trades.append(
            {
                "ticket": r.ticket,
                "symbol": r.symbol,
                "side": r.side,
                "volume": r.volume,
                "price_open": r.price_open,
                "price_close": r.price_close,
                "profit": r.profit,
                "commission": getattr(r, "commission", 0.0),
                "swap": getattr(r, "swap", 0.0),
                "open_time": (
                    r.open_time.isoformat() if r.open_time else None
                ),
                "close_time": (
                    r.close_time.isoformat() if r.close_time else None
                ),
            }
        )

    return trades
