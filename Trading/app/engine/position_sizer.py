"""
Conservative XAUUSD position sizer.

Calculates lot size based on risk percentage, stop distance, and account
balance, then applies broker constraints, WARN reductions, and safe mode
multipliers.
"""

from __future__ import annotations

import logging
import math
from typing import Optional

from app.core.config import get_settings
from app.schemas.broker import BrokerSymbolConfig
from app.schemas.risk import PositionSizeResult

logger = logging.getLogger(__name__)


def calculate_position_size(
    balance: float,
    equity: float,
    entry_price: float,
    stop_loss: float,
    symbol_config: BrokerSymbolConfig,
    warn_count: int = 0,
    safe_mode_active: bool = False,
    open_risk_pct: float = 0.0,
) -> PositionSizeResult:
    """
    Calculate position size with all safety reductions.

    Steps:
    1. Compute raw lot from risk budget
    2. Normalize to broker volume step
    3. Apply WARN-based lot reduction
    4. Apply safe mode multiplier
    5. Cap at max_position_size_lot
    6. Validate against broker constraints
    7. Re-check open risk
    """
    cfg = get_settings()
    result = PositionSizeResult()

    # ── Use the safer of balance / equity ──────────────────────────
    base_capital = min(balance, equity)
    if base_capital <= 0:
        result.is_valid = False
        result.rejection_reason = "Zero or negative capital"
        return result

    # ── Risk budget ────────────────────────────────────────────────
    risk_pct = cfg.MAX_RISK_PER_TRADE_PCT / 100.0  # convert from % to fraction
    if safe_mode_active:
        risk_pct *= cfg.SAFE_MODE_RISK_MULTIPLIER

    result.risk_pct_used = risk_pct * 100
    risk_amount = base_capital * risk_pct
    result.risk_amount = round(risk_amount, 2)

    # ── Stop distance ─────────────────────────────────────────────
    stop_distance = abs(entry_price - stop_loss)
    if stop_distance <= 0:
        result.is_valid = False
        result.rejection_reason = "Zero or negative stop distance"
        return result

    result.stop_distance = round(stop_distance, 5)

    # ── Value per point per lot ────────────────────────────────────
    # For XAUUSD: 1 lot = 100 oz, so $1 move per lot = $100
    contract_size = symbol_config.contract_size
    point = symbol_config.point
    value_per_point_per_lot = contract_size * point
    result.value_per_point_per_lot = value_per_point_per_lot

    # ── Raw lot calculation ────────────────────────────────────────
    stop_points = stop_distance / point if point > 0 else 0
    risk_per_lot = stop_points * value_per_point_per_lot
    if risk_per_lot <= 0:
        result.is_valid = False
        result.rejection_reason = "Invalid risk per lot calculation"
        return result

    raw_lot = risk_amount / risk_per_lot
    result.raw_lot = round(raw_lot, 6)

    # ── Normalize to volume step ──────────────────────────────────
    vol_step = symbol_config.volume_step
    normalized = math.floor(raw_lot / vol_step) * vol_step if vol_step > 0 else raw_lot
    normalized = round(normalized, 8)
    result.normalized_lot = normalized

    # ── WARN-based lot reduction ──────────────────────────────────
    reduced = normalized
    reduction_reasons = []

    if warn_count > 0:
        # Each WARN reduces lot by 15%, up to 60% total
        reduction_factor = max(1.0 - (warn_count * 0.15), 0.40)
        reduced = math.floor((normalized * reduction_factor) / vol_step) * vol_step
        reduced = round(reduced, 8)
        reduction_reasons.append(
            f"{warn_count} WARN(s) → {(1 - reduction_factor) * 100:.0f}% reduction"
        )

    result.reduced_lot = reduced

    # ── Safe mode further reduction ───────────────────────────────
    if safe_mode_active:
        reduced = math.floor((reduced * cfg.SAFE_MODE_RISK_MULTIPLIER) / vol_step) * vol_step
        reduced = round(reduced, 8)
        reduction_reasons.append(
            f"Safe mode → {cfg.SAFE_MODE_RISK_MULTIPLIER * 100:.0f}% multiplier"
        )

    # ── Cap at max position size ──────────────────────────────────
    max_lot = cfg.MAX_POSITION_SIZE_LOT
    if reduced > max_lot:
        reduced = max_lot
        reduction_reasons.append(f"Capped at max lot {max_lot}")

    # ── Broker constraints ────────────────────────────────────────
    broker_reasons = []
    if reduced < symbol_config.volume_min:
        if normalized < symbol_config.volume_min:
            result.is_valid = False
            result.rejection_reason = (
                f"Lot {normalized:.4f} below broker minimum {symbol_config.volume_min}"
            )
            result.broker_constraint_reason = result.rejection_reason
            return result
        reduced = symbol_config.volume_min
        broker_reasons.append(f"Raised to broker min {symbol_config.volume_min}")

    if reduced > symbol_config.volume_max:
        reduced = symbol_config.volume_max
        broker_reasons.append(f"Capped at broker max {symbol_config.volume_max}")

    # Final re-normalize
    reduced = math.floor(reduced / vol_step) * vol_step
    reduced = round(reduced, 8)

    result.final_lot = reduced
    result.lot_reduction_reason = "; ".join(reduction_reasons) if reduction_reasons else None
    result.broker_constraint_reason = "; ".join(broker_reasons) if broker_reasons else None

    # ── Re-check open risk budget ─────────────────────────────────
    new_trade_risk_pct = (risk_amount / base_capital * 100) if base_capital > 0 else 0
    total_risk = open_risk_pct + new_trade_risk_pct
    max_open = cfg.MAX_OPEN_RISK_PCT
    if total_risk > max_open:
        result.is_valid = False
        result.rejection_reason = (
            f"Total open risk {total_risk:.2f}% would exceed limit {max_open}%"
        )
        return result

    result.is_valid = reduced > 0
    if not result.is_valid:
        result.rejection_reason = "Final lot is zero after all reductions"

    logger.info(
        "Position size: balance=$%.2f risk=%.3f%% stop_dist=%.2f "
        "raw=%.4f norm=%.4f reduced=%.4f final=%.4f warns=%d safe=%s",
        base_capital, risk_pct * 100, stop_distance,
        raw_lot, normalized, result.reduced_lot, reduced,
        warn_count, safe_mode_active,
    )
    return result
