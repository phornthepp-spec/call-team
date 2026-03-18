"""
Dashboard API — aggregated data endpoints for the trading dashboard.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import AppSettings
from app.core.dependencies import (
    get_auto_trader,
    get_config,
    get_db,
    get_mt5_service,
    get_system_state,
)
from app.core.enums import OrderStatus, SignalStatus
from app.models.account import AccountSnapshot, DailyRiskStats, LockoutEvent
from app.models.order import Order, TradeSignal
from app.services.system_state_service import SystemStateService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
async def dashboard_overview(
    db: AsyncSession = Depends(get_db),
    mt5_service=Depends(get_mt5_service),
    system_state: SystemStateService = Depends(get_system_state),
    auto_trader=Depends(get_auto_trader),
    cfg: AppSettings = Depends(get_config),
) -> Dict[str, Any]:
    """Main dashboard overview data."""
    # Account info from MT5
    account: Dict[str, float] = {"balance": 0, "equity": 0, "margin": 0, "free_margin": 0, "floating_pl": 0, "margin_level": 0}
    if mt5_service and mt5_service.connected:
        try:
            account = mt5_service.get_account_info()
        except Exception:
            pass

    # Today's P&L from orders
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    result = await db.execute(
        select(
            func.coalesce(func.sum(Order.profit), 0),
            func.count(Order.id),
        ).where(
            and_(
                Order.account_id == 1,
                Order.status.in_([OrderStatus.FILLED, OrderStatus.CLOSED]),
                Order.created_at >= today_start,
            )
        )
    )
    row = result.one()
    pnl_today = float(row[0])
    trades_today = int(row[1])

    # Win/loss today
    wins_result = await db.execute(
        select(func.count(Order.id)).where(
            and_(
                Order.account_id == 1,
                Order.status == OrderStatus.CLOSED,
                Order.profit > 0,
                Order.created_at >= today_start,
            )
        )
    )
    wins_today = wins_result.scalar() or 0

    losses_result = await db.execute(
        select(func.count(Order.id)).where(
            and_(
                Order.account_id == 1,
                Order.status == OrderStatus.CLOSED,
                Order.profit < 0,
                Order.created_at >= today_start,
            )
        )
    )
    losses_today = losses_result.scalar() or 0

    # Open positions count
    positions = []
    if mt5_service and mt5_service.connected:
        try:
            positions = mt5_service.get_positions()
        except Exception:
            pass

    # Risk used
    open_risk_pct = 0.0
    if account["equity"] > 0 and account["margin"] > 0:
        open_risk_pct = round(account["margin"] / account["equity"] * 100, 2)

    # System status
    sys_status = "READY"
    if system_state and system_state.kill_switch_active:
        sys_status = "BLOCKED"
    elif system_state and system_state.safe_mode_active:
        sys_status = "PAUSED"

    return {
        "balance": account.get("balance", 0),
        "equity": account.get("equity", 0),
        "free_margin": account.get("free_margin", 0),
        "margin_level": account.get("margin_level", 0),
        "floating_pl": account.get("floating_pl", 0),
        "pnl_today": pnl_today,
        "trades_today": trades_today,
        "wins_today": wins_today,
        "losses_today": losses_today,
        "open_positions": len(positions),
        "risk_used_pct": open_risk_pct,
        "max_risk_pct": cfg.MAX_OPEN_RISK_PCT,
        "system_status": sys_status,
        "kill_switch_active": system_state.kill_switch_active if system_state else False,
        "safe_mode_active": system_state.safe_mode_active if system_state else False,
        "auto_trade_running": auto_trader.running if auto_trader else False,
    }


@router.get("/equity-curve")
async def equity_curve(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Equity curve data from account snapshots."""
    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=hours)

    result = await db.execute(
        select(AccountSnapshot)
        .where(
            and_(
                AccountSnapshot.account_id == 1,
                AccountSnapshot.snapshot_at >= cutoff,
            )
        )
        .order_by(AccountSnapshot.snapshot_at)
        .limit(500)
    )
    snapshots = result.scalars().all()

    return [
        {
            "time": s.snapshot_at.isoformat(),
            "equity": float(s.equity),
            "balance": float(s.balance),
            "floating_pnl": float(s.floating_pnl),
        }
        for s in snapshots
    ]


@router.get("/recent-trades")
async def recent_trades(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Recent trade signals with their order outcomes."""
    result = await db.execute(
        select(TradeSignal)
        .where(TradeSignal.account_id == 1)
        .order_by(desc(TradeSignal.created_at))
        .limit(limit)
    )
    signals = result.scalars().all()

    trades = []
    for sig in signals:
        trades.append({
            "id": sig.id,
            "time": sig.created_at.isoformat() if sig.created_at else None,
            "symbol": sig.symbol,
            "side": sig.direction.value,
            "entry": float(sig.entry_price),
            "sl": float(sig.stop_loss),
            "tp": float(sig.take_profit),
            "rr": float(sig.risk_reward_ratio),
            "confidence": round(sig.confidence * 100, 1) if sig.confidence else 0,
            "status": sig.status.value,
            "strategy": sig.strategy_name,
        })

    return trades


@router.get("/performance")
async def performance_stats(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Aggregated performance statistics."""
    # All closed orders
    result = await db.execute(
        select(Order).where(
            and_(
                Order.account_id == 1,
                Order.status == OrderStatus.CLOSED,
            )
        )
    )
    closed_orders = result.scalars().all()

    total = len(closed_orders)
    if total == 0:
        return {
            "total_trades": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "expectancy": 0,
            "max_drawdown_pct": 0,
            "total_pnl": 0,
            "avg_win": 0,
            "avg_loss": 0,
            "best_trade": 0,
            "worst_trade": 0,
        }

    wins = [o for o in closed_orders if float(o.profit) > 0]
    losses = [o for o in closed_orders if float(o.profit) < 0]

    total_profit = sum(float(o.profit) for o in wins)
    total_loss = abs(sum(float(o.profit) for o in losses))

    profit_factor = round(total_profit / total_loss, 2) if total_loss > 0 else float("inf") if total_profit > 0 else 0
    win_rate = round(len(wins) / total * 100, 1) if total > 0 else 0
    avg_win = round(total_profit / len(wins), 2) if wins else 0
    avg_loss = round(-total_loss / len(losses), 2) if losses else 0
    expectancy = round((win_rate / 100 * avg_win) + ((1 - win_rate / 100) * avg_loss), 2)

    profits = [float(o.profit) for o in closed_orders]
    best_trade = max(profits) if profits else 0
    worst_trade = min(profits) if profits else 0

    # Max drawdown from daily stats
    dd_result = await db.execute(
        select(func.max(DailyRiskStats.max_drawdown_pct)).where(
            DailyRiskStats.account_id == 1
        )
    )
    max_dd = float(dd_result.scalar() or 0)

    return {
        "total_trades": total,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "max_drawdown_pct": max_dd,
        "total_pnl": round(total_profit - total_loss, 2),
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2),
    }


@router.get("/risk-status")
async def risk_status(
    db: AsyncSession = Depends(get_db),
    system_state: SystemStateService = Depends(get_system_state),
) -> Dict[str, Any]:
    """Current risk status for dashboard."""
    # Active lockouts
    result = await db.execute(
        select(LockoutEvent).where(
            and_(
                LockoutEvent.account_id == 1,
                LockoutEvent.is_active == True,
            )
        )
    )
    lockouts = result.scalars().all()

    return {
        "kill_switch_active": system_state.kill_switch_active if system_state else False,
        "safe_mode_active": system_state.safe_mode_active if system_state else False,
        "active_lockouts": [
            {
                "type": lo.lockout_type.value,
                "trigger": lo.trigger.value,
                "activated_at": lo.activated_at.isoformat(),
                "expires_at": lo.expires_at.isoformat() if lo.expires_at else None,
                "reason": lo.reason,
            }
            for lo in lockouts
        ],
        "lockout_count": len(lockouts),
    }
