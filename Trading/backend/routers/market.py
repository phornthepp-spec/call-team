"""
Market router -- live XAUUSD tick data and OHLCV bars.
"""

from enum import Enum
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.auth import get_current_user
from models.models import User, MarketTick, MarketBar
from schemas.schemas import MarketTickRead, MarketBarRead
from services.mt5_service import MT5Service

router = APIRouter()


class Timeframe(str, Enum):
    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"


# ── GET /xauusd/tick ─────────────────────────────────────────────────────

@router.get("/xauusd/tick", response_model=MarketTickRead)
async def get_xauusd_tick(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest XAUUSD bid/ask/spread tick from MT5."""

    mt5 = MT5Service()

    try:
        tick = await mt5.get_tick("XAUUSD")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch tick from MT5: {str(exc)}",
        )

    if tick is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No tick data available for XAUUSD",
        )

    # Persist tick to database
    market_tick = MarketTick(
        symbol="XAUUSD",
        bid=tick["bid"],
        ask=tick["ask"],
        spread=tick["spread"],
        timestamp=tick["timestamp"],
    )
    db.add(market_tick)
    await db.flush()
    await db.refresh(market_tick)

    return market_tick


# ── GET /xauusd/bars ─────────────────────────────────────────────────────

@router.get("/xauusd/bars", response_model=List[MarketBarRead])
async def get_xauusd_bars(
    timeframe: Timeframe = Query(Timeframe.H1, description="Candle timeframe"),
    count: int = Query(100, ge=1, le=1000, description="Number of bars to fetch"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get OHLCV bars for XAUUSD from MT5.

    Supported timeframes: M1, M5, M15, H1, H4, D1.
    Returns up to 1000 bars.
    """

    mt5 = MT5Service()

    try:
        bars = await mt5.get_bars(
            symbol="XAUUSD",
            timeframe=timeframe.value,
            count=count,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch bars from MT5: {str(exc)}",
        )

    if not bars:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No bar data available for XAUUSD",
        )

    # Persist bars to database
    market_bars = []
    for bar in bars:
        market_bar = MarketBar(
            symbol="XAUUSD",
            timeframe=timeframe.value,
            timestamp=bar["timestamp"],
            open=bar["open"],
            high=bar["high"],
            low=bar["low"],
            close=bar["close"],
            volume=bar["volume"],
        )
        db.add(market_bar)
        market_bars.append(market_bar)

    await db.flush()
    for mb in market_bars:
        await db.refresh(mb)

    return market_bars
