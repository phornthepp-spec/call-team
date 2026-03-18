"""
Auto-trade router -- start / stop / status / config for full-auto trading.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.auth import get_current_user
from models.models import User, TradingAccount, AutoTradeConfig
from schemas.schemas import (
    AutoTradeConfigUpdate,
    AutoTradeConfigResponse,
    AutoTradeStatusResponse,
)

router = APIRouter()


async def _get_active_account(db: AsyncSession, user_id: int) -> TradingAccount:
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


async def _get_or_create_config(
    db: AsyncSession, account_id: int
) -> AutoTradeConfig:
    result = await db.execute(
        select(AutoTradeConfig).where(
            AutoTradeConfig.account_id == account_id,
        )
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = AutoTradeConfig(account_id=account_id)
        db.add(config)
        await db.flush()
        await db.refresh(config)
    return config


# ── GET /status ──────────────────────────────────────────────────────

@router.get("/status", response_model=AutoTradeStatusResponse)
async def get_auto_trade_status(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current auto-trade status and configuration."""
    account = await _get_active_account(db, current_user.id)
    config = await _get_or_create_config(db, account.id)

    auto_trader = request.app.state.auto_trader
    state = auto_trader.get_state()

    return AutoTradeStatusResponse(
        enabled=state.enabled,
        running=state.running,
        cycle_count=state.cycle_count,
        signals_evaluated=state.signals_evaluated,
        trades_executed=state.trades_executed,
        trades_skipped=state.trades_skipped,
        last_evaluation_at=state.last_evaluation_at,
        last_trade_at=state.last_trade_at,
        last_error=state.last_error,
        config=AutoTradeConfigResponse.model_validate(config),
    )


# ── POST /start ──────────────────────────────────────────────────────

@router.post("/start", response_model=AutoTradeStatusResponse)
async def start_auto_trade(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the auto-trade loop for the active account."""
    account = await _get_active_account(db, current_user.id)
    config = await _get_or_create_config(db, account.id)

    # Enable in DB
    config.enabled = True
    await db.flush()
    await db.refresh(config)

    auto_trader = request.app.state.auto_trader
    await auto_trader.start(account.id)

    state = auto_trader.get_state()
    return AutoTradeStatusResponse(
        enabled=state.enabled,
        running=state.running,
        cycle_count=state.cycle_count,
        signals_evaluated=state.signals_evaluated,
        trades_executed=state.trades_executed,
        trades_skipped=state.trades_skipped,
        last_evaluation_at=state.last_evaluation_at,
        last_trade_at=state.last_trade_at,
        last_error=state.last_error,
        config=AutoTradeConfigResponse.model_validate(config),
    )


# ── POST /stop ───────────────────────────────────────────────────────

@router.post("/stop", response_model=AutoTradeStatusResponse)
async def stop_auto_trade(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop the auto-trade loop and disable in DB."""
    account = await _get_active_account(db, current_user.id)
    config = await _get_or_create_config(db, account.id)

    auto_trader = request.app.state.auto_trader
    await auto_trader.stop()

    # Ensure disabled in DB
    config.enabled = False
    await db.flush()
    await db.refresh(config)

    state = auto_trader.get_state()
    return AutoTradeStatusResponse(
        enabled=state.enabled,
        running=state.running,
        cycle_count=state.cycle_count,
        signals_evaluated=state.signals_evaluated,
        trades_executed=state.trades_executed,
        trades_skipped=state.trades_skipped,
        last_evaluation_at=state.last_evaluation_at,
        last_trade_at=state.last_trade_at,
        last_error=state.last_error,
        config=AutoTradeConfigResponse.model_validate(config),
    )


# ── PUT /config ──────────────────────────────────────────────────────

@router.put("/config", response_model=AutoTradeConfigResponse)
async def update_auto_trade_config(
    payload: AutoTradeConfigUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update auto-trade settings. Restarts the loop if running."""
    account = await _get_active_account(db, current_user.id)
    config = await _get_or_create_config(db, account.id)

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

    # If running, restart with new config
    auto_trader = request.app.state.auto_trader
    if auto_trader.get_state().running:
        await auto_trader.stop()
        if config.enabled:
            await auto_trader.start(account.id)

    return AutoTradeConfigResponse.model_validate(config)
