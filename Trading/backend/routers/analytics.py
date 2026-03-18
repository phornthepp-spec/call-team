"""
Analytics router -- daily/weekly P/L, equity curve, and aggregate trading stats.
"""

from typing import List, Optional
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, case, literal
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.auth import get_current_user
from models.models import (
    User,
    TradingAccount,
    Order,
    AccountSnapshot,
    DailyRiskStats,
)
from schemas.schemas import (
    DailyAnalytics,
    WeeklyAnalytics,
    EquityPoint,
    OverallStats,
)

router = APIRouter()


async def _get_account_ids(db: AsyncSession, user_id: int) -> List[int]:
    """Return all trading account IDs belonging to a user."""
    result = await db.execute(
        select(TradingAccount.id).where(
            TradingAccount.user_id == user_id,
        )
    )
    ids = [row[0] for row in result.all()]
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No trading accounts found",
        )
    return ids


# ── GET /daily ───────────────────────────────────────────────────────────

@router.get("/daily", response_model=List[DailyAnalytics])
async def get_daily_analytics(
    start_date: date = Query(default=None, description="Start date (default: 30 days ago)"),
    end_date: date = Query(default=None, description="End date (default: today)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get daily P/L, trade count, and win rate for a date range.
    Defaults to the last 30 days.
    """

    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date",
        )

    account_ids = await _get_account_ids(db, current_user.id)

    result = await db.execute(
        select(DailyRiskStats)
        .where(
            and_(
                DailyRiskStats.account_id.in_(account_ids),
                DailyRiskStats.date >= start_date,
                DailyRiskStats.date <= end_date,
            )
        )
        .order_by(DailyRiskStats.date.asc())
    )
    stats_rows = result.scalars().all()

    daily_data: List[DailyAnalytics] = []
    for row in stats_rows:
        win_rate = (
            (row.wins / row.trades_count * 100.0)
            if row.trades_count > 0
            else 0.0
        )
        daily_data.append(
            DailyAnalytics(
                date=row.date,
                total_pnl=row.total_pnl,
                trades_count=row.trades_count,
                wins=row.wins,
                losses=row.losses,
                win_rate=round(win_rate, 2),
                max_drawdown=row.max_drawdown,
            )
        )

    return daily_data


# ── GET /weekly ──────────────────────────────────────────────────────────

@router.get("/weekly", response_model=List[WeeklyAnalytics])
async def get_weekly_analytics(
    weeks: int = Query(12, ge=1, le=52, description="Number of past weeks"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get weekly summary: total P/L, trade count, and win rate.
    Aggregated from daily stats.
    """

    account_ids = await _get_account_ids(db, current_user.id)
    end_date = date.today()
    start_date = end_date - timedelta(weeks=weeks)

    result = await db.execute(
        select(DailyRiskStats)
        .where(
            and_(
                DailyRiskStats.account_id.in_(account_ids),
                DailyRiskStats.date >= start_date,
                DailyRiskStats.date <= end_date,
            )
        )
        .order_by(DailyRiskStats.date.asc())
    )
    daily_rows = result.scalars().all()

    # Group by ISO week
    weekly_map: dict = {}
    for row in daily_rows:
        iso_year, iso_week, _ = row.date.isocalendar()
        key = (iso_year, iso_week)
        if key not in weekly_map:
            weekly_map[key] = {
                "week_start": row.date - timedelta(days=row.date.weekday()),
                "total_pnl": 0.0,
                "trades_count": 0,
                "wins": 0,
                "losses": 0,
                "max_drawdown": 0.0,
            }
        week = weekly_map[key]
        week["total_pnl"] += row.total_pnl
        week["trades_count"] += row.trades_count
        week["wins"] += row.wins
        week["losses"] += row.losses
        week["max_drawdown"] = max(week["max_drawdown"], row.max_drawdown)

    weekly_data: List[WeeklyAnalytics] = []
    for key in sorted(weekly_map.keys()):
        week = weekly_map[key]
        win_rate = (
            (week["wins"] / week["trades_count"] * 100.0)
            if week["trades_count"] > 0
            else 0.0
        )
        weekly_data.append(
            WeeklyAnalytics(
                week_start=week["week_start"],
                total_pnl=round(week["total_pnl"], 2),
                trades_count=week["trades_count"],
                wins=week["wins"],
                losses=week["losses"],
                win_rate=round(win_rate, 2),
                max_drawdown=round(week["max_drawdown"], 2),
            )
        )

    return weekly_data


# ── GET /equity-curve ────────────────────────────────────────────────────

@router.get("/equity-curve", response_model=List[EquityPoint])
async def get_equity_curve(
    days: int = Query(90, ge=1, le=365, description="Number of past days"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a time series of balance/equity snapshots for charting the equity curve.
    """

    account_ids = await _get_account_ids(db, current_user.id)
    cutoff = date.today() - timedelta(days=days)

    result = await db.execute(
        select(AccountSnapshot)
        .where(
            and_(
                AccountSnapshot.account_id.in_(account_ids),
                AccountSnapshot.created_at >= cutoff,
            )
        )
        .order_by(AccountSnapshot.created_at.asc())
    )
    snapshots = result.scalars().all()

    return [
        EquityPoint(
            timestamp=snap.created_at,
            balance=snap.balance,
            equity=snap.equity,
            margin=snap.margin,
            free_margin=snap.free_margin,
        )
        for snap in snapshots
    ]


# ── GET /stats ───────────────────────────────────────────────────────────

@router.get("/stats", response_model=OverallStats)
async def get_overall_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Overall trading statistics: win rate, average win/loss,
    expectancy, maximum drawdown, and profit factor.
    """

    account_ids = await _get_account_ids(db, current_user.id)

    # Fetch all closed orders
    result = await db.execute(
        select(Order).where(
            and_(
                Order.account_id.in_(account_ids),
                Order.status == "closed",
                Order.profit.isnot(None),
            )
        )
    )
    orders = result.scalars().all()

    if not orders:
        return OverallStats(
            total_trades=0,
            wins=0,
            losses=0,
            win_rate=0.0,
            avg_win=0.0,
            avg_loss=0.0,
            expectancy=0.0,
            max_drawdown=0.0,
            profit_factor=0.0,
            total_pnl=0.0,
            best_trade=0.0,
            worst_trade=0.0,
        )

    total_trades = len(orders)
    wins = [o for o in orders if o.profit > 0]
    losses = [o for o in orders if o.profit <= 0]

    win_count = len(wins)
    loss_count = len(losses)
    win_rate = (win_count / total_trades * 100.0) if total_trades > 0 else 0.0

    total_win = sum(o.profit for o in wins) if wins else 0.0
    total_loss = sum(abs(o.profit) for o in losses) if losses else 0.0

    avg_win = (total_win / win_count) if win_count > 0 else 0.0
    avg_loss = (total_loss / loss_count) if loss_count > 0 else 0.0

    # Expectancy = (win_rate * avg_win) - (loss_rate * avg_loss)
    win_rate_dec = win_count / total_trades if total_trades > 0 else 0.0
    loss_rate_dec = loss_count / total_trades if total_trades > 0 else 0.0
    expectancy = (win_rate_dec * avg_win) - (loss_rate_dec * avg_loss)

    # Profit factor = gross_profit / gross_loss
    profit_factor = (total_win / total_loss) if total_loss > 0 else float("inf")

    # Max drawdown from cumulative P/L
    cumulative = 0.0
    peak = 0.0
    max_dd = 0.0
    for o in sorted(orders, key=lambda x: x.id):
        cumulative += o.profit
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_dd:
            max_dd = dd

    total_pnl = sum(o.profit for o in orders)
    best_trade = max(o.profit for o in orders)
    worst_trade = min(o.profit for o in orders)

    return OverallStats(
        total_trades=total_trades,
        wins=win_count,
        losses=loss_count,
        win_rate=round(win_rate, 2),
        avg_win=round(avg_win, 2),
        avg_loss=round(avg_loss, 2),
        expectancy=round(expectancy, 2),
        max_drawdown=round(max_dd, 2),
        profit_factor=round(profit_factor, 2) if profit_factor != float("inf") else 0.0,
        total_pnl=round(total_pnl, 2),
        best_trade=round(best_trade, 2),
        worst_trade=round(worst_trade, 2),
    )
