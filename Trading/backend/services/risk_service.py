"""
Risk Management Engine for XAUUSD Trading System.

Provides pre-trade risk checks, position sizing, session filtering, and
daily statistics tracking. Every order must pass ``risk_check()`` before
being submitted to the broker.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, time, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bangkok time offset (UTC+7)
# ---------------------------------------------------------------------------
UTC_PLUS_7 = timezone(timedelta(hours=7))

# ---------------------------------------------------------------------------
# Default allowed trading session: London/NY overlap in UTC+7
# 14:00 -- 23:00 (UTC+7)  =>  07:00 -- 16:00 UTC
# ---------------------------------------------------------------------------
SESSION_START = time(14, 0)  # 14:00 UTC+7
SESSION_END = time(23, 0)    # 23:00 UTC+7


# ======================================================================
# Daily statistics helper
# ======================================================================

def _empty_daily_stats() -> Dict[str, Any]:
    """Return a blank daily stats dict."""
    return {
        "date": datetime.now(tz=UTC_PLUS_7).date().isoformat(),
        "total_trades": 0,
        "winning_trades": 0,
        "losing_trades": 0,
        "consecutive_losses": 0,
        "realized_pl": 0.0,
        "peak_balance": 0.0,
        "daily_locked": False,
    }


# ======================================================================
# Core risk check
# ======================================================================

def risk_check(
    account_info: Dict[str, float],
    signal: Dict[str, Any],
    daily_stats: Dict[str, Any],
    config: Dict[str, Any],
    current_spread: float,
) -> Dict[str, Any]:
    """
    Run all pre-trade risk validations.

    Args:
        account_info: Output of ``MT5Service.get_account_info()``.
        signal: Signal dict from ``evaluate_xauusd_signal()``.
        daily_stats: Today's running trade statistics.
        config: Risk configuration with the following keys:

            - ``max_trades_per_day`` (int): Maximum trades allowed per day.
            - ``max_consecutive_losses`` (int): Stop trading after N losses
              in a row.
            - ``daily_loss_limit_pct`` (float): Maximum daily loss as a
              fraction of balance (e.g. 0.05 for 5 %).
            - ``max_spread`` (float): Maximum allowable spread in price
              units.
            - ``min_rr_ratio`` (float): Minimum risk/reward ratio.
            - ``news_window_minutes`` (int): Minutes around a news event
              during which trading is blocked.
            - ``news_events`` (list[dict]): Upcoming news events, each
              containing a ``"time"`` key (``datetime``).

        current_spread: Current bid-ask spread in price units.

    Returns:
        Dict with:

        - ``passed`` (bool): ``True`` if all checks pass.
        - ``reasons`` (list[str]): Human-readable list of failed checks
          (empty when ``passed`` is ``True``).
    """
    reasons: List[str] = []

    # 1. Daily lockout
    if check_daily_lockout(daily_stats, config):
        reasons.append(
            "Daily lockout is active -- trading suspended for the rest of "
            "the day."
        )

    # 2. Max trades per day
    max_trades = config.get("max_trades_per_day", 5)
    if daily_stats.get("total_trades", 0) >= max_trades:
        reasons.append(
            f"Maximum daily trades reached ({max_trades})."
        )

    # 3. Consecutive losses
    max_consec = config.get("max_consecutive_losses", 3)
    if daily_stats.get("consecutive_losses", 0) >= max_consec:
        reasons.append(
            f"Consecutive loss limit reached ({max_consec})."
        )

    # 4. Daily loss limit
    daily_loss_limit_pct = config.get("daily_loss_limit_pct", 0.05)
    balance = account_info.get("balance", 0.0)
    if balance > 0:
        daily_loss = daily_stats.get("realized_pl", 0.0)
        max_allowed_loss = balance * daily_loss_limit_pct
        if daily_loss < 0 and abs(daily_loss) >= max_allowed_loss:
            reasons.append(
                f"Daily loss limit breached: "
                f"${abs(daily_loss):.2f} >= "
                f"${max_allowed_loss:.2f} "
                f"({daily_loss_limit_pct * 100:.1f}% of balance)."
            )

    # 5. Spread check
    max_spread = config.get("max_spread", 0.50)
    if current_spread > max_spread:
        reasons.append(
            f"Spread too wide: {current_spread:.2f} > {max_spread:.2f}."
        )

    # 6. Risk/Reward ratio
    min_rr = config.get("min_rr_ratio", 1.5)
    signal_rr = signal.get("rr_ratio", 0.0)
    if signal_rr < min_rr:
        reasons.append(
            f"RR ratio too low: {signal_rr:.2f} < {min_rr:.2f}."
        )

    # 7. Session check
    if not is_allowed_session():
        reasons.append(
            "Outside allowed trading session "
            f"({SESSION_START.strftime('%H:%M')} -- "
            f"{SESSION_END.strftime('%H:%M')} UTC+7)."
        )

    # 8. News window
    news_window_min = config.get("news_window_minutes", 30)
    news_events = config.get("news_events", [])
    if _is_within_news_window(news_events, news_window_min):
        reasons.append(
            f"Within {news_window_min}-minute news exclusion window."
        )

    passed = len(reasons) == 0
    if not passed:
        logger.warning("Risk check FAILED: %s", "; ".join(reasons))
    else:
        logger.info("Risk check PASSED.")

    return {"passed": passed, "reasons": reasons}


# ======================================================================
# Position sizing
# ======================================================================

def calculate_lot_size(
    balance: float,
    risk_pct: float,
    entry: float,
    sl: float,
    symbol_info: Dict[str, float],
) -> float:
    """
    Calculate the position size (in lots) for a given risk percentage.

    Formula::

        risk_amount = balance * risk_pct
        risk_per_lot = |entry - sl| * contract_size
        raw_lots = risk_amount / risk_per_lot
        lots = clamp(round_down(raw_lots, step), vol_min, vol_max)

    Args:
        balance: Account balance in USD.
        risk_pct: Risk per trade as a fraction (e.g. ``0.01`` for 1 %).
        entry: Entry price.
        sl: Stop-loss price.
        symbol_info: Output of ``MT5Service.get_symbol_info()``.

    Returns:
        Lot size rounded down to the nearest volume step, clamped between
        ``volume_min`` and ``volume_max``.
    """
    risk_amount = balance * risk_pct
    pip_distance = abs(entry - sl)

    if pip_distance <= 0:
        logger.error("Invalid SL distance (entry=%.2f, sl=%.2f).", entry, sl)
        return symbol_info.get("volume_min", 0.01)

    contract_size = symbol_info.get("trade_contract_size", 100.0)
    risk_per_lot = pip_distance * contract_size
    raw_lots = risk_amount / risk_per_lot

    # Round down to the nearest volume step
    vol_step = symbol_info.get("volume_step", 0.01)
    lots = math.floor(raw_lots / vol_step) * vol_step
    lots = round(lots, 8)  # avoid float artefacts

    # Clamp to broker limits
    vol_min = symbol_info.get("volume_min", 0.01)
    vol_max = symbol_info.get("volume_max", 100.0)
    lots = max(vol_min, min(lots, vol_max))

    logger.info(
        "Lot size calculated: balance=$%.2f risk=%.2f%% "
        "entry=%.2f sl=%.2f => %.2f lots "
        "(risk_amount=$%.2f, risk_per_lot=$%.2f).",
        balance,
        risk_pct * 100,
        entry,
        sl,
        lots,
        risk_amount,
        risk_per_lot,
    )
    return lots


# ======================================================================
# Session filter
# ======================================================================

def is_allowed_session(
    now: Optional[datetime] = None,
    session_start: time = SESSION_START,
    session_end: time = SESSION_END,
) -> bool:
    """
    Check whether the current time falls within the allowed trading session.

    The default window is the London/New York overlap:
    **14:00 -- 23:00 UTC+7** (07:00 -- 16:00 UTC).

    Args:
        now: Override for the current datetime (for testing).
        session_start: Start of allowed window (UTC+7).
        session_end: End of allowed window (UTC+7).

    Returns:
        True if the current time is inside the allowed session.
    """
    if now is None:
        now = datetime.now(tz=UTC_PLUS_7)
    else:
        now = now.astimezone(UTC_PLUS_7)

    current_time = now.time()

    if session_start <= session_end:
        return session_start <= current_time <= session_end
    else:
        # Wraps past midnight
        return current_time >= session_start or current_time <= session_end


# ======================================================================
# Daily statistics management
# ======================================================================

def update_daily_stats(
    account_id: str,
    session: Any,
    realized_pl: float,
    is_win: bool,
    daily_stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Update daily statistics after a trade closes.

    If *session* is provided and has a compatible ORM interface, the stats
    are also persisted. Otherwise, an in-memory dict is returned.

    Args:
        account_id: Unique account identifier.
        session: Database session (SQLAlchemy or similar). Pass ``None``
                 to use in-memory mode.
        realized_pl: Realised profit/loss of the closed trade.
        is_win: Whether the trade was profitable.
        daily_stats: Existing daily stats dict (in-memory mode). If
                     ``None``, a fresh one is created.

    Returns:
        Updated daily stats dict.
    """
    if daily_stats is None:
        daily_stats = _empty_daily_stats()

    daily_stats["total_trades"] = daily_stats.get("total_trades", 0) + 1
    daily_stats["realized_pl"] = round(
        daily_stats.get("realized_pl", 0.0) + realized_pl, 2
    )

    if is_win:
        daily_stats["winning_trades"] = daily_stats.get("winning_trades", 0) + 1
        daily_stats["consecutive_losses"] = 0
    else:
        daily_stats["losing_trades"] = daily_stats.get("losing_trades", 0) + 1
        daily_stats["consecutive_losses"] = (
            daily_stats.get("consecutive_losses", 0) + 1
        )

    # Persist to DB if session is usable
    if session is not None:
        try:
            _persist_daily_stats(account_id, session, daily_stats)
        except Exception:
            logger.exception(
                "Failed to persist daily stats for account %s.", account_id
            )

    logger.info(
        "Daily stats updated for %s: trades=%d W=%d L=%d consec_losses=%d "
        "PL=$%.2f",
        account_id,
        daily_stats["total_trades"],
        daily_stats["winning_trades"],
        daily_stats["losing_trades"],
        daily_stats["consecutive_losses"],
        daily_stats["realized_pl"],
    )
    return daily_stats


def check_daily_lockout(
    daily_stats: Dict[str, Any],
    config: Dict[str, Any],
) -> bool:
    """
    Determine whether trading should be locked out for the rest of the day.

    Lockout triggers:

    1. ``daily_stats["daily_locked"]`` is already ``True``.
    2. Consecutive losses >= ``config["max_consecutive_losses"]``.
    3. Absolute realised loss >= ``config["daily_loss_limit_pct"]`` of
       ``config.get("reference_balance", 10000)``.

    Args:
        daily_stats: Current daily statistics dict.
        config: Risk configuration dict.

    Returns:
        ``True`` if trading should be locked.
    """
    if daily_stats.get("daily_locked", False):
        return True

    max_consec = config.get("max_consecutive_losses", 3)
    if daily_stats.get("consecutive_losses", 0) >= max_consec:
        daily_stats["daily_locked"] = True
        logger.warning(
            "Daily lockout triggered by %d consecutive losses.",
            daily_stats["consecutive_losses"],
        )
        return True

    daily_loss_limit_pct = config.get("daily_loss_limit_pct", 0.05)
    ref_balance = config.get("reference_balance", 10_000.0)
    realized_pl = daily_stats.get("realized_pl", 0.0)
    if realized_pl < 0 and abs(realized_pl) >= ref_balance * daily_loss_limit_pct:
        daily_stats["daily_locked"] = True
        logger.warning(
            "Daily lockout triggered by loss of $%.2f (limit $%.2f).",
            abs(realized_pl),
            ref_balance * daily_loss_limit_pct,
        )
        return True

    return False


# ======================================================================
# Internal helpers
# ======================================================================

def _is_within_news_window(
    news_events: List[Dict[str, Any]],
    window_minutes: int,
) -> bool:
    """Check if the current time is within *window_minutes* of any event."""
    if not news_events:
        return False

    now = datetime.now(tz=timezone.utc)
    window = timedelta(minutes=window_minutes)

    for event in news_events:
        event_time = event.get("time")
        if event_time is None:
            continue
        if isinstance(event_time, str):
            try:
                event_time = datetime.fromisoformat(event_time)
            except ValueError:
                continue
        if not event_time.tzinfo:
            event_time = event_time.replace(tzinfo=timezone.utc)
        if abs(now - event_time) <= window:
            return True

    return False


def _persist_daily_stats(
    account_id: str,
    session: Any,
    stats: Dict[str, Any],
) -> None:
    """
    Persist daily stats to the database.

    This is a thin adapter -- the actual ORM model is expected to live in
    ``models/``. We keep a loose coupling here so that the risk service
    remains testable without a real database.
    """
    try:
        from backend.models.daily_stats import DailyStats as DailyStatsModel
    except ImportError:
        logger.debug(
            "DailyStats model not available -- skipping DB persistence."
        )
        return

    today = stats.get("date", datetime.now(tz=UTC_PLUS_7).date().isoformat())

    record = (
        session.query(DailyStatsModel)
        .filter_by(account_id=account_id, date=today)
        .first()
    )

    if record is None:
        record = DailyStatsModel(account_id=account_id, date=today)
        session.add(record)

    record.total_trades = stats["total_trades"]
    record.winning_trades = stats["winning_trades"]
    record.losing_trades = stats["losing_trades"]
    record.consecutive_losses = stats["consecutive_losses"]
    record.realized_pl = stats["realized_pl"]
    record.daily_locked = stats.get("daily_locked", False)

    session.commit()
