"""
Auto-Trade API — start/stop/status/config endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_auto_trader, get_system_state
from app.schemas.auto_trade import (
    AutoTradeActionResponse,
    AutoTradeConfigUpdate,
    AutoTradeStatusResponse,
)
from app.services.system_state_service import SystemStateService

router = APIRouter(prefix="/auto-trade", tags=["auto-trade"])


def _require_auto_trader(auto_trader=Depends(get_auto_trader)):
    if auto_trader is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auto-trader not initialized",
        )
    return auto_trader


@router.get("/status", response_model=AutoTradeStatusResponse)
async def get_status(auto_trader=Depends(_require_auto_trader)):
    """Get current auto-trade status."""
    return auto_trader.get_status()


@router.post("/start", response_model=AutoTradeActionResponse)
async def start_auto_trade(
    auto_trader=Depends(_require_auto_trader),
    system_state: SystemStateService = Depends(get_system_state),
):
    """Start the auto-trade background loop."""
    if system_state and system_state.kill_switch_active:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Cannot start auto-trade: kill switch active",
        )

    if auto_trader.running:
        return AutoTradeActionResponse(
            success=False,
            message="Auto-trade is already running",
            status=auto_trader.get_status(),
        )

    started = auto_trader.start()
    return AutoTradeActionResponse(
        success=started,
        message="Auto-trade started" if started else "Failed to start auto-trade",
        status=auto_trader.get_status(),
    )


@router.post("/stop", response_model=AutoTradeActionResponse)
async def stop_auto_trade(auto_trader=Depends(_require_auto_trader)):
    """Stop the auto-trade background loop."""
    await auto_trader.stop()
    return AutoTradeActionResponse(
        success=True,
        message="Auto-trade stopped",
        status=auto_trader.get_status(),
    )


@router.put("/config", response_model=AutoTradeStatusResponse)
async def update_config(
    update: AutoTradeConfigUpdate,
    auto_trader=Depends(_require_auto_trader),
):
    """Update auto-trade configuration."""
    auto_trader.update_config(**update.model_dump(exclude_none=True))
    return auto_trader.get_status()
