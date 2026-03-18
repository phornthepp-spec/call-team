"""
Broker profile & MT5 connection API endpoints.

- Broker profile info
- MT5 connection management
- Symbol info
- Account info
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import AppSettings
from app.core.dependencies import (
    get_broker_profile,
    get_config,
    get_db,
    get_mt5_service,
)
from app.schemas.broker import SymbolInfoResponse

router = APIRouter(prefix="/broker", tags=["broker"])


# ── Broker profile ─────────────────────────────────────────────────

@router.get("/profile")
async def get_broker_info(
    broker=Depends(get_broker_profile),
) -> Dict[str, Any]:
    """Get current broker profile configuration."""
    if not broker:
        raise HTTPException(status_code=404, detail="No broker profile configured")

    sym = broker.symbol_config
    exec_p = broker.execution_profile
    conn = broker.connection_config

    return {
        "broker_name": conn.broker_name,
        "broker_domain": conn.broker_domain,
        "mt5_server": conn.mt5_server,
        "mt5_server_candidates": broker.mt5_server_candidates,
        "symbol": sym.canonical_symbol,
        "broker_symbol": sym.broker_symbol,
        "symbol_aliases": sym.aliases,
        "contract_size": sym.contract_size,
        "volume_min": sym.volume_min,
        "volume_max": sym.volume_max,
        "volume_step": sym.volume_step,
        "point": sym.point,
        "digits": sym.digits,
        "stop_level": sym.stop_level,
        "freeze_level": sym.freeze_level,
        "fill_policy_preferences": exec_p.fill_policy_preferences,
        "default_deviation_points": exec_p.default_deviation_points,
        "magic_number_base": exec_p.magic_number_base,
        "comment_prefix": exec_p.comment_prefix,
    }


# ── MT5 connection ─────────────────────────────────────────────────

@router.post("/connect")
async def connect_mt5(
    login: Optional[int] = None,
    password: Optional[str] = None,
    server: Optional[str] = None,
    cfg: AppSettings = Depends(get_config),
    mt5_service=Depends(get_mt5_service),
) -> Dict[str, Any]:
    """Connect to MT5 terminal."""
    if not mt5_service:
        raise HTTPException(status_code=503, detail="MT5 service not initialized")

    actual_login = login or cfg.MT5_LOGIN
    actual_password = password or cfg.MT5_PASSWORD
    actual_server = server or cfg.MT5_SERVER

    if not actual_login or not actual_password:
        raise HTTPException(status_code=400, detail="MT5 login/password required")

    success = mt5_service.connect(
        login=actual_login,
        password=actual_password,
        server=actual_server,
        terminal_path=cfg.MT5_TERMINAL_PATH or None,
    )

    if success:
        return {
            "status": "connected",
            "simulation_mode": mt5_service.simulation_mode,
            "login": actual_login,
            "server": actual_server,
        }
    else:
        raise HTTPException(status_code=502, detail="MT5 connection failed")


@router.post("/disconnect")
async def disconnect_mt5(
    mt5_service=Depends(get_mt5_service),
) -> Dict[str, str]:
    """Disconnect from MT5."""
    if mt5_service:
        mt5_service.disconnect()
    return {"status": "disconnected"}


# ── Account info ───────────────────────────────────────────────────

@router.get("/account")
async def get_account_info(
    mt5_service=Depends(get_mt5_service),
) -> Dict[str, Any]:
    """Get MT5 account info (balance, equity, margin)."""
    if not mt5_service or not mt5_service.connected:
        raise HTTPException(status_code=503, detail="MT5 not connected")

    info = mt5_service.get_account_info()
    return {
        "connected": True,
        "simulation_mode": mt5_service.simulation_mode,
        **info,
    }


# ── Symbol info ────────────────────────────────────────────────────

@router.get("/symbol/{symbol}", response_model=SymbolInfoResponse)
async def get_symbol_info(
    symbol: str,
    mt5_service=Depends(get_mt5_service),
    broker=Depends(get_broker_profile),
):
    """Get symbol specification from MT5."""
    if not mt5_service or not mt5_service.connected:
        raise HTTPException(status_code=503, detail="MT5 not connected")

    # Resolve alias
    resolved = mt5_service.resolve_symbol(symbol)
    info = mt5_service.get_symbol_info(resolved)

    return SymbolInfoResponse(
        canonical_symbol=symbol,
        broker_symbol=resolved,
        resolved_from_alias=resolved != symbol,
        volume_min=info["volume_min"],
        volume_max=info["volume_max"],
        volume_step=info["volume_step"],
        point=info["point"],
        digits=info["digits"],
        contract_size=info["trade_contract_size"],
        stop_level=info["stop_level"],
        freeze_level=info["freeze_level"],
        spread=info["spread"],
        filling_mode=info["filling_mode"],
        execution_mode=info["execution_mode"],
    )


# ── Market data ────────────────────────────────────────────────────

@router.get("/tick/{symbol}")
async def get_tick(
    symbol: str,
    mt5_service=Depends(get_mt5_service),
) -> Dict[str, Any]:
    """Get current tick data."""
    if not mt5_service or not mt5_service.connected:
        raise HTTPException(status_code=503, detail="MT5 not connected")
    resolved = mt5_service.resolve_symbol(symbol)
    return mt5_service.get_tick(resolved)


@router.get("/market-snapshot/{symbol}")
async def get_market_snapshot(
    symbol: str,
    timeframe: str = "M15",
    mt5_service=Depends(get_mt5_service),
) -> Dict[str, Any]:
    """Get full market snapshot (tick + bars + ATR + regime)."""
    if not mt5_service or not mt5_service.connected:
        raise HTTPException(status_code=503, detail="MT5 not connected")

    from app.services.market_data_service import MarketDataService

    resolved = mt5_service.resolve_symbol(symbol)
    tick = mt5_service.get_tick(resolved)
    bars = mt5_service.get_bars(resolved, timeframe, count=300)

    mds = MarketDataService()
    snapshot = mds.get_market_snapshot(tick, bars)
    return snapshot
