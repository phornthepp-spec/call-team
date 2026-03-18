"""
Risk router -- risk status, strategy config, lockout management, kill switch.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timezone

from database import get_db
from core.auth import get_current_user
from models.models import (
    User,
    TradingAccount,
    DailyRiskStats,
    StrategyConfig,
    Order,
    Execution,
)
from schemas.schemas import (
    RiskStatusResponse,
    StrategyConfigUpdate,
    StrategyConfigRead,
    RiskUnlockResponse,
    KillSwitchResponse,
)
from services.risk_service import check_daily_lockout, is_allowed_session
from services.mt5_service import MT5Service

router = APIRouter()


async def _get_active_account(
    db: AsyncSession, user_id: int
) -> TradingAccount:
    """Return the user's first active trading account or raise 400."""
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_active.is_(True),
        )
    )
    account = result.scalars().first()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active trading account found",
        )
    return account


async def _get_or_create_daily_stats(
    db: AsyncSession, account_id: int
) -> DailyRiskStats:
    """Fetch today's risk stats or create a fresh row."""
    today = date.today()
    result = await db.execute(
        select(DailyRiskStats).where(
            DailyRiskStats.account_id == account_id,
            DailyRiskStats.date == today,
        )
    )
    stats = result.scalar_one_or_none()

    if stats is None:
        stats = DailyRiskStats(
            account_id=account_id,
            date=today,
            trades_count=0,
            wins=0,
            losses=0,
            total_pnl=0.0,
            max_drawdown=0.0,
            consecutive_losses=0,
            is_locked=False,
        )
        db.add(stats)
        await db.flush()
        await db.refresh(stats)

    return stats


async def _get_or_create_config(
    db: AsyncSession, account_id: int
) -> StrategyConfig:
    """Fetch strategy config or create defaults."""
    result = await db.execute(
        select(StrategyConfig).where(
            StrategyConfig.account_id == account_id,
        )
    )
    config = result.scalar_one_or_none()

    if config is None:
        config = StrategyConfig(
            account_id=account_id,
            risk_per_trade=0.5,
            daily_loss_limit=1.0,
            weekly_loss_limit=3.0,
            max_trades_per_day=3,
            max_consecutive_losses=2,
            min_risk_reward=1.5,
            max_spread=30,
        )
        db.add(config)
        await db.flush()
        await db.refresh(config)

    return config


# ── GET /status ──────────────────────────────────────────────────────────

@router.get("/status", response_model=RiskStatusResponse)
async def get_risk_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current risk status: daily stats, lockout state,
    trade counts, consecutive losses, and session allowance.
    """

    account = await _get_active_account(db, current_user.id)
    stats = await _get_or_create_daily_stats(db, account.id)
    config = await _get_or_create_config(db, account.id)

    is_locked = await check_daily_lockout(db=db, account_id=account.id)
    session_allowed = await is_allowed_session()

    return RiskStatusResponse(
        date=stats.date,
        trades_count=stats.trades_count,
        wins=stats.wins,
        losses=stats.losses,
        total_pnl=stats.total_pnl,
        max_drawdown=stats.max_drawdown,
        consecutive_losses=stats.consecutive_losses,
        is_locked=is_locked,
        session_allowed=session_allowed,
        max_trades_per_day=config.max_trades_per_day,
        daily_loss_limit=config.daily_loss_limit,
        risk_per_trade=config.risk_per_trade,
    )


# ── PUT /config ──────────────────────────────────────────────────────────

@router.put("/config", response_model=StrategyConfigRead)
async def update_strategy_config(
    payload: StrategyConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update strategy configuration (risk per trade, daily loss limit, etc.)."""

    account = await _get_active_account(db, current_user.id)
    config = await _get_or_create_config(db, account.id)

    # Apply only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update",
        )

    for field, value in update_data.items():
        setattr(config, field, value)

    await db.flush()
    await db.refresh(config)

    return config


# ── POST /unlock ─────────────────────────────────────────────────────────

@router.post("/unlock", response_model=RiskUnlockResponse)
async def unlock_daily_lockout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually unlock daily lockout (use with caution)."""

    account = await _get_active_account(db, current_user.id)
    stats = await _get_or_create_daily_stats(db, account.id)

    if not stats.is_locked:
        return RiskUnlockResponse(
            success=True,
            message="Account was not locked",
            was_locked=False,
        )

    stats.is_locked = False
    await db.flush()
    await db.refresh(stats)

    return RiskUnlockResponse(
        success=True,
        message="Daily lockout has been manually unlocked",
        was_locked=True,
    )


# ── POST /kill-switch ───────────────────────────────────────────────────

@router.post("/kill-switch", response_model=KillSwitchResponse)
async def kill_switch(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Emergency kill switch: stop auto-trader, close ALL open positions,
    and lock the account for the rest of the day.
    """

    # Stop auto-trader first
    auto_trader = getattr(request.app.state, "auto_trader", None)
    if auto_trader is not None:
        await auto_trader.stop()

    account = await _get_active_account(db, current_user.id)
    mt5 = MT5Service()

    # Close all positions
    closed_count = 0
    failed_count = 0

    try:
        positions = await mt5.get_open_positions(
            login=account.mt5_login,
            password=account.mt5_password,
            server=account.mt5_server,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch positions: {str(exc)}",
        )

    for pos in positions:
        try:
            result = await mt5.close_position(
                login=account.mt5_login,
                password=account.mt5_password,
                server=account.mt5_server,
                ticket=pos["ticket"],
            )
            if result.get("success", False):
                closed_count += 1

                # Update DB
                order_result = await db.execute(
                    select(Order).where(
                        Order.account_id == account.id,
                        Order.ticket == pos["ticket"],
                    )
                )
                order = order_result.scalar_one_or_none()
                if order is not None:
                    order.status = "closed"
                    order.close_price = result.get("price", 0.0)
                    order.profit = result.get("profit", order.profit)

                    exec_record = Execution(
                        order_id=order.id,
                        ticket=pos["ticket"],
                        action="close",
                        price=result.get("price", 0.0),
                        lot=order.lot,
                        comment="Kill switch",
                    )
                    db.add(exec_record)
            else:
                failed_count += 1
        except Exception:
            failed_count += 1

    # Lock daily trading
    stats = await _get_or_create_daily_stats(db, account.id)
    stats.is_locked = True
    await db.flush()

    return KillSwitchResponse(
        success=True,
        positions_closed=closed_count,
        positions_failed=failed_count,
        is_locked=True,
        message=f"Kill switch activated. Closed {closed_count} positions. Account locked.",
    )
