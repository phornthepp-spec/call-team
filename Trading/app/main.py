"""
Full-Auto XAUUSD Trading System — FastAPI application entry point.

Manages the application lifecycle:
- Database connection pool
- MT5 service + broker profile initialization
- System state recovery from DB
- Auto-trade worker initialization
- Router registration
- Static file serving for React frontend
- Graceful shutdown
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    cfg = get_settings()
    setup_logging(cfg.LOG_LEVEL, cfg.LOG_FORMAT)
    logger.info("Starting %s v%s", cfg.APP_NAME, cfg.APP_VERSION)

    # ── Startup ────────────────────────────────────────────────────
    # 1. Database — ensure tables exist
    from app.db.session import engine, SessionLocal
    from app.db.init_db import create_tables, seed_defaults
    await create_tables()
    await seed_defaults()

    # 2. Broker profile
    from app.brokers.accm import create_accm_profile
    broker_profile = create_accm_profile()
    app.state.broker_profile = broker_profile
    logger.info("Broker profile: %s", broker_profile.broker_name)

    # 3. MT5 service
    from app.services.mt5_service import MT5Service
    mt5_service = MT5Service(broker_profile=broker_profile)
    app.state.mt5_service = mt5_service

    # Auto-connect in simulation mode or when credentials provided
    if cfg.MT5_LOGIN and cfg.MT5_PASSWORD:
        connected = mt5_service.connect(
            login=cfg.MT5_LOGIN,
            password=cfg.MT5_PASSWORD,
            server=cfg.MT5_SERVER,
            terminal_path=cfg.MT5_TERMINAL_PATH or None,
        )
        if connected:
            logger.info("MT5 connected (simulation=%s)", mt5_service.simulation_mode)
        else:
            logger.warning("MT5 connection failed at startup")
    elif mt5_service.simulation_mode:
        mt5_service.connect(login=0, password="", server="SIM")
        logger.info("MT5 simulation mode: auto-connected")

    # 4. System state service — recover from DB
    from app.services.system_state_service import SystemStateService
    system_state = SystemStateService()
    app.state.system_state = system_state

    async with SessionLocal() as db:
        await system_state.load_from_db(db)

        # Log startup audit event
        from app.services.audit_service import AuditService
        audit = AuditService()
        from app.core.enums import AuditEventType
        await audit.log_event(
            db, AuditEventType.SYSTEM_STARTUP,
            f"System started: {cfg.APP_NAME} v{cfg.APP_VERSION} "
            f"(policy={cfg.POLICY_MODE}, sim={mt5_service.simulation_mode})",
            details={
                "version": cfg.APP_VERSION,
                "policy_mode": cfg.POLICY_MODE,
                "simulation_mode": mt5_service.simulation_mode,
                "broker": cfg.BROKER_NAME,
                "kill_switch_active": system_state.kill_switch_active,
                "safe_mode_active": system_state.safe_mode_active,
            },
        )
        await db.commit()

    # 5. Auto-trade worker
    from app.workers.auto_trader import AutoTrader
    auto_trader = AutoTrader(
        mt5_service=mt5_service,
        system_state=system_state,
        broker_profile=broker_profile,
    )
    app.state.auto_trader = auto_trader

    # Auto-start trading if MT5 is connected and kill switch is off
    if mt5_service.connected and not system_state.kill_switch_active:
        started = auto_trader.start()
        if started:
            logger.info("AutoTrader AUTO-STARTED on boot (sim=%s)", mt5_service.simulation_mode)
        else:
            logger.warning("AutoTrader failed to auto-start")
    else:
        logger.info(
            "AutoTrader NOT auto-started (mt5=%s, kill_switch=%s)",
            mt5_service.connected, system_state.kill_switch_active,
        )

    logger.info(
        "Startup complete — kill_switch=%s, safe_mode=%s, policy=%s",
        system_state.kill_switch_active,
        system_state.safe_mode_active,
        cfg.POLICY_MODE,
    )

    yield

    # ── Shutdown ───────────────────────────────────────────────────
    logger.info("Shutting down...")

    # Stop auto-trader if running
    if auto_trader.running:
        await auto_trader.stop()
        logger.info("Auto-trader stopped.")

    # Disconnect MT5
    if mt5_service.connected:
        mt5_service.disconnect()

    # Log shutdown
    async with SessionLocal() as db:
        audit = AuditService()
        await audit.log_event(
            db, AuditEventType.SYSTEM_SHUTDOWN, "System shutdown",
        )
        await db.commit()

    # Close DB pool
    await engine.dispose()
    logger.info("Shutdown complete.")


# ── Create FastAPI app ─────────────────────────────────────────────

app = FastAPI(
    title=get_settings().APP_NAME,
    version=get_settings().APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — include Cloud Run URL if set via CORS_ORIGINS env var
_default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_extra_origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ──────────────────────────────────────────────

from app.api.routes.risk import router as risk_router
from app.api.routes.orders import router as orders_router
from app.api.routes.system import router as system_router
from app.api.routes.brokers import router as broker_router
from app.api.routes.auto_trade import router as auto_trade_router
from app.api.routes.dashboard import router as dashboard_router

app.include_router(risk_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(system_router, prefix="/api")
app.include_router(broker_router, prefix="/api")
app.include_router(auto_trade_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")


# ── Serve React frontend (static files) ──────────────────────────

_static_dir = Path(__file__).resolve().parent.parent / "static"

if _static_dir.is_dir():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="assets")

    # SPA catch-all: serve index.html for all non-API routes
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If a static file exists, serve it
        file_path = _static_dir / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for client-side routing
        return FileResponse(_static_dir / "index.html")
else:
    @app.get("/")
    async def root():
        cfg = get_settings()
        return {
            "app": cfg.APP_NAME,
            "version": cfg.APP_VERSION,
            "docs": "/docs",
        }
