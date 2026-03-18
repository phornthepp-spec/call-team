"""
Database initialization — creates all tables and seeds default data.

Run standalone:
    python -m app.db.init_db
"""

from __future__ import annotations

import asyncio
import logging

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import engine, SessionLocal

logger = logging.getLogger(__name__)


async def create_tables() -> None:
    """Create all tables from ORM metadata."""
    from app.models.base import Base
    # Import all models to register them with Base.metadata
    import app.models.account  # noqa: F401
    import app.models.audit  # noqa: F401
    import app.models.broker  # noqa: F401
    import app.models.order  # noqa: F401
    import app.models.risk  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("All tables created successfully.")


async def seed_defaults(skip_if_exists: bool = True) -> None:
    """Seed default broker profile and admin user."""
    from sqlalchemy import select
    from app.models.broker import BrokerProfile

    async with SessionLocal() as db:
        # Check if ACCM broker profile exists
        result = await db.execute(
            select(BrokerProfile).where(BrokerProfile.broker_name == "ACCM").limit(1)
        )
        existing = result.scalar_one_or_none()

        if existing and skip_if_exists:
            logger.info("Default ACCM broker profile already exists (id=%d).", existing.id)
            return

        if not existing:
            from app.brokers.accm import create_accm_profile
            accm = create_accm_profile()

            profile = BrokerProfile(
                broker_name="ACCM",
                broker_domain="accm.global",
                is_active=True,
                mt5_server_candidates=accm.mt5_server_candidates,
                primary_symbol="XAUUSD",
                symbol_aliases=accm.primary_symbol_aliases,
                symbol_mapping={"XAUUSD": "XAUUSD"},
                contract_spec_overrides={"contract_size": 100.0},
                fill_policy_preferences=["IOC", "RETURN"],
                default_order_deviation_points=20,
                execution_timeout_seconds=3,
                reconnect_attempts=3,
                magic_number_base=999000,
                comment_prefix="7H-AUTO",
            )
            db.add(profile)
            await db.commit()
            logger.info("Default ACCM broker profile seeded.")


async def init_db() -> None:
    """Full database initialization."""
    await create_tables()
    await seed_defaults()
    await engine.dispose()


if __name__ == "__main__":
    cfg = get_settings()
    setup_logging(cfg.LOG_LEVEL, cfg.LOG_FORMAT)
    logger.info("Initializing database: %s", cfg.DATABASE_URL.split("@")[-1])
    asyncio.run(init_db())
    logger.info("Database initialization complete.")
