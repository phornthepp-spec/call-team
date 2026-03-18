"""
XAUUSD Trading System - FastAPI Backend (Semi-Auto + Full-Auto)
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from routers import auth, accounts, market, signals, orders, risk, analytics, allocation
from routers import auto_trade
from database import engine, Base, SessionLocal
from models.models import AutoTradeConfig
from services.auto_trader import AutoTrader

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create AutoTrader and store on app state
    auto_trader = AutoTrader()
    app.state.auto_trader = auto_trader

    # Auto-resume: if any account has auto-trade enabled, start the loop
    try:
        async with SessionLocal() as db:
            result = await db.execute(
                select(AutoTradeConfig).where(AutoTradeConfig.enabled.is_(True))
            )
            enabled_config = result.scalars().first()
            if enabled_config:
                logger.info(
                    "Auto-trade resume: starting for account %s",
                    enabled_config.account_id,
                )
                await auto_trader.start(enabled_config.account_id)
    except Exception:
        logger.exception("Failed to auto-resume auto-trader on startup.")

    yield

    # Shutdown
    await auto_trader.stop()
    await engine.dispose()


app = FastAPI(
    title="XAUUSD Trading System",
    description="Risk-first trading system for XAUUSD on Exness/MT5 with full-auto mode",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
app.include_router(market.router, prefix="/market", tags=["Market"])
app.include_router(signals.router, prefix="/signals", tags=["Signals"])
app.include_router(orders.router, prefix="/orders", tags=["Orders"])
app.include_router(risk.router, prefix="/risk", tags=["Risk"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(allocation.router, prefix="/allocation", tags=["Allocation"])
app.include_router(auto_trade.router, prefix="/auto-trade", tags=["Auto-Trade"])


@app.get("/health")
async def health():
    auto_trader = getattr(app.state, "auto_trader", None)
    auto_running = auto_trader.get_state().running if auto_trader else False
    return {
        "status": "ok",
        "service": "xauusd-trading-system",
        "auto_trade_running": auto_running,
    }
