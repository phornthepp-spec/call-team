"""
ACCM (accm.global) broker profile.

Concrete implementation of the broker abstraction layer for ACCM.
All ACCM-specific configuration, symbol mappings, and execution
parameters are defined here.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from app.brokers.base import BaseBrokerProfile
from app.schemas.broker import (
    BrokerConnectionConfig,
    BrokerExecutionProfile,
    BrokerSymbolConfig,
)

logger = logging.getLogger(__name__)


class ACCMBrokerProfile(BaseBrokerProfile):
    """
    ACCM (accm.global) broker profile for MT5 XAUUSD trading.

    Key characteristics:
    - Platform: MetaTrader 5
    - Primary instrument: XAUUSD
    - Execution: Market execution
    - Contract size: 100 oz per lot (standard gold)
    """

    def __init__(self):
        super().__init__()

        # Override defaults with ACCM-specific values
        self.connection_config = BrokerConnectionConfig(
            broker_name="ACCM",
            broker_domain="accm.global",
            mt5_server="ACCM-Live",
        )

        self.execution_profile = BrokerExecutionProfile(
            fill_policy_preferences=["IOC", "RETURN"],
            default_deviation_points=20,
            execution_timeout_seconds=3,
            max_order_retries=1,
            reconnect_attempts=3,
            reconnect_backoff_seconds=2.0,
            slippage_warn_points=12.0,
            slippage_max_points=20.0,
            magic_number_base=999000,
            comment_prefix="7H-AUTO",
        )

        self.symbol_config = BrokerSymbolConfig(
            canonical_symbol="XAUUSD",
            broker_symbol="XAUUSD",
            aliases=self.primary_symbol_aliases,
            contract_size=100.0,    # 1 lot = 100 troy ounces
            volume_min=0.01,
            volume_max=100.0,
            volume_step=0.01,
            point=0.01,
            digits=2,
            stop_level=0,           # Will be updated from MT5
            freeze_level=0,         # Will be updated from MT5
        )

    # ── Identity ──────────────────────────────────────────────────

    @property
    def broker_name(self) -> str:
        return "ACCM"

    @property
    def broker_domain(self) -> str:
        return "accm.global"

    @property
    def mt5_server_candidates(self) -> List[str]:
        """
        Known ACCM MT5 server names.
        The system will try each in order until one connects.
        """
        return [
            "ACCapitalMarket(S)-Real",
            "ACCM-Live",
            "ACCM-Demo",
            "ACCMGlobal-Live",
            "ACCMGlobal-Demo",
            "ACCMGlobal-Server",
        ]

    @property
    def primary_symbol_aliases(self) -> List[str]:
        """
        Known symbol name variants for XAUUSD on ACCM.
        Some brokers use suffixes, prefixes, or alternate names.
        """
        return [
            "XAUUSD",
            "XAUUSD.",
            "XAUUSDm",
            "XAUUSD.a",
            "XAUUSD.b",
            "GOLD",
            "GOLD.",
            "GOLDm",
        ]

    # ── Contract spec overrides ───────────────────────────────────

    def _get_contract_spec_overrides(self) -> Dict[str, Any]:
        """
        ACCM-specific overrides.

        If MT5 returns unexpected contract specs (which can happen with
        some broker configurations), these values take precedence.
        """
        return {
            "contract_size": 100.0,    # Ensure 1 lot = 100 oz
            # volume_min, volume_max, volume_step are usually correct from MT5
            # but can be overridden here if ACCM has specific requirements:
            # "volume_min": 0.01,
            # "volume_step": 0.01,
        }

    # ── ACCM-specific helpers ─────────────────────────────────────

    def get_accm_execution_config(self) -> Dict[str, Any]:
        """Return ACCM-specific execution parameters as a flat dict."""
        return {
            "broker_name": self.broker_name,
            "broker_domain": self.broker_domain,
            "mt5_server_candidates": self.mt5_server_candidates,
            "symbol_aliases": self.primary_symbol_aliases,
            "default_deviation_points": self.execution_profile.default_deviation_points,
            "execution_timeout_seconds": self.execution_profile.execution_timeout_seconds,
            "fill_policy_preferences": self.execution_profile.fill_policy_preferences,
            "reconnect_attempts": self.execution_profile.reconnect_attempts,
            "reconnect_backoff_seconds": self.execution_profile.reconnect_backoff_seconds,
            "magic_number_base": self.execution_profile.magic_number_base,
            "comment_prefix": self.execution_profile.comment_prefix,
            "contract_size": self.symbol_config.contract_size,
            "volume_min": self.symbol_config.volume_min,
            "volume_max": self.symbol_config.volume_max,
            "volume_step": self.symbol_config.volume_step,
        }

    def validate_symbol_visibility(self, symbol_visible: bool, symbol_name: str) -> bool:
        """
        Check if the resolved symbol is visible in the MT5 terminal.

        Some brokers require explicit symbol_select() before trading.
        """
        if not symbol_visible:
            logger.warning(
                "ACCM: Symbol '%s' is not visible in terminal. "
                "Call mt5.symbol_select('%s', True) to enable it.",
                symbol_name, symbol_name,
            )
            return False
        return True

    def check_stop_level_compliance(
        self, entry: float, sl: float, tp: float, stop_level: int
    ) -> Dict[str, bool]:
        """
        Verify SL/TP distances meet ACCM's stop level requirements.

        stop_level is in points. The SL and TP must be at least
        stop_level * point away from the entry price.
        """
        point = self.symbol_config.point
        min_distance = stop_level * point

        sl_distance = abs(entry - sl)
        tp_distance = abs(entry - tp)

        return {
            "sl_compliant": sl_distance >= min_distance,
            "tp_compliant": tp_distance >= min_distance,
            "sl_distance": sl_distance,
            "tp_distance": tp_distance,
            "min_distance": min_distance,
            "stop_level_points": stop_level,
        }


def create_accm_profile() -> ACCMBrokerProfile:
    """Factory function for creating an ACCM broker profile."""
    profile = ACCMBrokerProfile()
    logger.info(
        "ACCM broker profile created: server_candidates=%s, "
        "symbol_aliases=%s, deviation=%d, magic_base=%d",
        profile.mt5_server_candidates,
        profile.primary_symbol_aliases,
        profile.execution_profile.default_deviation_points,
        profile.execution_profile.magic_number_base,
    )
    return profile
