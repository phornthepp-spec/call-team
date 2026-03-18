#!/usr/bin/env python3
"""
Crypto Auto Trading Bot — Entry Point

Usage:
    python run.py                    # Start with default settings
    python run.py --dry-run          # Force DRY RUN mode
    python run.py --live             # Force LIVE mode (careful!)
    python run.py --policy balanced  # Override policy mode
    python run.py --symbol ETH/USDT  # Override trading pair
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from crypto_bot.config import get_config

# ── ASCII Banner ──────────────────────────────────────────────────

BANNER = r"""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗██████╗ ██╗   ██╗██████╗ ████████╗ ██████╗          ║
║  ██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔═══██╗        ║
║  ██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   ██║   ██║        ║
║  ██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██║   ██║        ║
║  ╚██████╗██║  ██║   ██║   ██║        ██║   ╚██████╔╝        ║
║   ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝    ╚═════╝        ║
║                                                              ║
║   ████████╗██████╗  █████╗ ██████╗ ███████╗██████╗           ║
║   ╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗         ║
║      ██║   ██████╔╝███████║██║  ██║█████╗  ██████╔╝         ║
║      ██║   ██╔══██╗██╔══██║██║  ██║██╔══╝  ██╔══██╗         ║
║      ██║   ██║  ██║██║  ██║██████╔╝███████╗██║  ██║         ║
║      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝      ║
║                                                              ║
║   Auto Trading Bot v1.0.0                                    ║
║   Multi-Strategy • Risk-Managed • Production-Ready           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crypto Auto Trading Bot",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=None,
        help="Force DRY RUN mode (no real orders)",
    )
    parser.add_argument(
        "--live", action="store_true", default=False,
        help="Force LIVE mode (real orders — use with caution!)",
    )
    parser.add_argument(
        "--policy", choices=["aggressive", "balanced", "conservative"],
        help="Override policy mode",
    )
    parser.add_argument(
        "--symbol", type=str,
        help="Override trading pair (e.g. ETH/USDT)",
    )
    parser.add_argument(
        "--timeframe", type=str,
        help="Override timeframe (e.g. 5m, 15m, 1h)",
    )
    parser.add_argument(
        "--interval", type=int,
        help="Override evaluation interval in seconds",
    )
    return parser.parse_args()


def setup_logging(level: str = "INFO") -> None:
    """Configure logging with colored console output."""
    fmt = (
        "%(asctime)s │ %(levelname)-7s │ %(name)-25s │ %(message)s"
    )
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=fmt,
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(
                Path(__file__).resolve().parent / "logs" / "bot.log",
                encoding="utf-8",
            ),
        ],
    )

    # Suppress noisy loggers
    logging.getLogger("ccxt").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


async def main() -> None:
    args = parse_args()

    # Load config
    cfg = get_config(force_reload=True)

    # Apply CLI overrides
    if args.dry_run:
        cfg.dry_run = True
    elif args.live:
        cfg.dry_run = False
    if args.policy:
        cfg.policy_mode = args.policy
        cfg.apply_policy_overrides()
    if args.symbol:
        cfg.symbol = args.symbol
    if args.timeframe:
        cfg.timeframe = args.timeframe
    if args.interval:
        cfg.evaluation_interval_seconds = args.interval

    # Setup logging
    setup_logging(cfg.log_level)
    logger = logging.getLogger(__name__)

    # Ensure log directory exists
    (Path(__file__).resolve().parent / "logs").mkdir(exist_ok=True)

    # Print banner
    print(BANNER)
    mode = "🧪 DRY RUN" if cfg.dry_run else "🔴 LIVE TRADING"
    print(f"  Mode: {mode}")
    print(f"  Exchange: {cfg.exchange_id}")
    print(f"  Symbol: {cfg.symbol}")
    print(f"  Timeframe: {cfg.timeframe}")
    print(f"  Policy: {cfg.policy_mode}")
    print(f"  Interval: {cfg.evaluation_interval_seconds}s")
    print(f"  Risk/Trade: {cfg.risk_per_trade_pct}%")
    print(f"  Daily Loss Limit: {cfg.daily_loss_limit_pct}%")
    print(f"  Max Positions: {cfg.max_open_positions}")
    print()

    if not cfg.dry_run:
        print("=" * 60)
        print("⚠️  WARNING: LIVE TRADING MODE IS ACTIVE!")
        print("⚠️  Real orders will be placed on the exchange.")
        print("⚠️  Press Ctrl+C within 10 seconds to cancel.")
        print("=" * 60)
        try:
            await asyncio.sleep(10)
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\nAborted by user.")
            return

    if cfg.dry_run and not cfg.api_key:
        logger.info("No API key configured — DRY RUN will use simulated data")

    # Create and start auto trader
    from crypto_bot.auto_trader import AutoTrader
    trader = AutoTrader(config=cfg)

    # Handle graceful shutdown
    loop = asyncio.get_event_loop()

    def handle_signal(signum, frame):
        logger.info("Received signal %d — shutting down...", signum)
        trader._running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # Start trading
    await trader.start()


if __name__ == "__main__":
    asyncio.run(main())
