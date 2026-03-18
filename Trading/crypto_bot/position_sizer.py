"""
Position Sizer — calculates order size based on risk parameters.

Uses fixed-fraction sizing: risk a percentage of balance per trade,
adjusted by WARN count and policy mode.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from crypto_bot.config import Config, get_config

logger = logging.getLogger(__name__)


@dataclass
class PositionSizeResult:
    """Output of position size calculation."""
    amount: float = 0.0              # Base currency amount (e.g. BTC)
    risk_usd: float = 0.0           # Dollar amount at risk
    risk_pct: float = 0.0           # Percentage of balance at risk
    sl_distance_pct: float = 0.0    # SL distance as % of entry
    is_valid: bool = False
    rejection_reason: Optional[str] = None


def calculate_position_size(
    balance_usd: float,
    entry_price: float,
    stop_loss: float,
    warn_count: int = 0,
    reduction_factor: Optional[float] = None,
    config: Optional[Config] = None,
) -> PositionSizeResult:
    """
    Calculate position size using fixed-fraction risk management.

    Formula:
        risk_usd = balance × risk_pct
        sl_distance = |entry - stop_loss| / entry
        position_value = risk_usd / sl_distance
        amount = position_value / entry_price

    Args:
        balance_usd: Total account balance in USD
        entry_price: Planned entry price
        stop_loss: Planned stop loss price
        warn_count: Number of WARNs from risk engine (reduces size)
        reduction_factor: Optional override reduction factor (0.0-1.0)
        config: Config override

    Returns:
        PositionSizeResult with calculated amount and risk details.
    """
    cfg = config or get_config()
    result = PositionSizeResult()

    # ── Validate inputs ───────────────────────────────────────────
    if balance_usd <= 0:
        result.rejection_reason = f"Invalid balance: ${balance_usd}"
        return result

    if entry_price <= 0:
        result.rejection_reason = f"Invalid entry price: {entry_price}"
        return result

    if stop_loss <= 0:
        result.rejection_reason = f"Invalid stop loss: {stop_loss}"
        return result

    # ── Compute SL distance ───────────────────────────────────────
    sl_distance = abs(entry_price - stop_loss)
    sl_distance_pct = sl_distance / entry_price

    if sl_distance_pct <= 0:
        result.rejection_reason = "Stop loss distance is zero"
        return result

    if sl_distance_pct > 0.10:  # 10% SL distance max
        result.rejection_reason = f"SL distance {sl_distance_pct:.2%} exceeds 10% max"
        return result

    result.sl_distance_pct = sl_distance_pct

    # ── Compute risk amount ───────────────────────────────────────
    risk_pct = cfg.risk_per_trade_pct / 100.0
    risk_usd = balance_usd * risk_pct

    # ── Apply WARN reduction ──────────────────────────────────────
    if reduction_factor is not None:
        risk_usd *= reduction_factor
    elif warn_count > 0:
        factor = 1.0
        for _ in range(warn_count):
            factor *= cfg.warn_reduction_factor
        factor = max(factor, cfg.min_lot_reduction)
        risk_usd *= factor

    result.risk_usd = round(risk_usd, 2)
    result.risk_pct = round(risk_usd / balance_usd * 100, 4) if balance_usd > 0 else 0

    # ── Compute position size ─────────────────────────────────────
    position_value = risk_usd / sl_distance_pct
    amount = position_value / entry_price

    # ── Enforce max risk ──────────────────────────────────────────
    max_position_value = balance_usd * (cfg.max_open_risk_pct / 100.0)
    if position_value > max_position_value:
        position_value = max_position_value
        amount = position_value / entry_price
        logger.debug("Position capped by max open risk: $%.2f", max_position_value)

    # ── Enforce minimum trade ─────────────────────────────────────
    min_amount = 0.00001  # 1 satoshi for BTC
    if amount < min_amount:
        result.rejection_reason = f"Position size {amount:.8f} below minimum {min_amount}"
        return result

    result.amount = amount
    result.is_valid = True

    logger.info(
        "POSITION SIZE: amount=%.8f risk=$%.2f (%.2f%%) sl_dist=%.4f%%",
        amount, risk_usd, result.risk_pct, sl_distance_pct * 100,
    )

    return result
