"""
Broker abstraction layer.

Defines the interface that all broker implementations must satisfy.
Handles symbol resolution, connection management, and execution profile.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.schemas.broker import (
    BrokerConnectionConfig,
    BrokerExecutionProfile,
    BrokerHealthSnapshot,
    BrokerSymbolConfig,
)

logger = logging.getLogger(__name__)


class BaseBrokerProfile(ABC):
    """
    Abstract broker profile.

    Each broker (ACCM, Exness, IC Markets, etc.) subclasses this and provides
    broker-specific defaults, symbol mappings, and execution parameters.
    """

    def __init__(self):
        self.connection_config = BrokerConnectionConfig()
        self.execution_profile = BrokerExecutionProfile()
        self.symbol_config = BrokerSymbolConfig()
        self.health = BrokerHealthSnapshot()
        self._symbol_cache: Dict[str, str] = {}

    # ── Identity ──────────────────────────────────────────────────

    @property
    @abstractmethod
    def broker_name(self) -> str: ...

    @property
    @abstractmethod
    def broker_domain(self) -> str: ...

    @property
    @abstractmethod
    def mt5_server_candidates(self) -> List[str]: ...

    @property
    @abstractmethod
    def primary_symbol_aliases(self) -> List[str]: ...

    # ── Symbol resolution ─────────────────────────────────────────

    def resolve_symbol(self, canonical: str, available_symbols: List[str]) -> Optional[str]:
        """
        Resolve a canonical symbol name to the broker's actual symbol.

        Tries the canonical name first, then all known aliases. Caches the
        result for subsequent lookups.
        """
        if canonical in self._symbol_cache:
            return self._symbol_cache[canonical]

        aliases = self.primary_symbol_aliases if canonical == "XAUUSD" else [canonical]
        candidates = [canonical] + aliases

        for candidate in candidates:
            if candidate in available_symbols:
                self._symbol_cache[canonical] = candidate
                logger.info(
                    "Symbol resolved: %s → %s (broker: %s)",
                    canonical, candidate, self.broker_name,
                )
                return candidate

        logger.warning(
            "Symbol resolution failed: %s not found in %d available symbols "
            "(tried aliases: %s)",
            canonical, len(available_symbols), candidates,
        )
        return None

    def get_symbol_config(
        self,
        mt5_symbol_info: Optional[Dict[str, Any]] = None,
    ) -> BrokerSymbolConfig:
        """
        Build symbol config by merging MT5 data with broker overrides.

        Broker-specific overrides take precedence when MT5 returns
        unexpected values (e.g. wrong contract size).
        """
        config = BrokerSymbolConfig(
            canonical_symbol="XAUUSD",
            broker_symbol=self.symbol_config.broker_symbol,
            aliases=self.primary_symbol_aliases,
        )

        if mt5_symbol_info:
            config.contract_size = mt5_symbol_info.get("trade_contract_size", config.contract_size)
            config.volume_min = mt5_symbol_info.get("volume_min", config.volume_min)
            config.volume_max = mt5_symbol_info.get("volume_max", config.volume_max)
            config.volume_step = mt5_symbol_info.get("volume_step", config.volume_step)
            config.point = mt5_symbol_info.get("point", config.point)
            config.digits = mt5_symbol_info.get("digits", config.digits)
            config.stop_level = mt5_symbol_info.get("stop_level", config.stop_level)
            config.freeze_level = mt5_symbol_info.get("freeze_level", config.freeze_level)
            config.spread = mt5_symbol_info.get("spread", 0.0)
            config.filling_mode = mt5_symbol_info.get("filling_mode", 0)
            config.execution_mode = mt5_symbol_info.get("execution_mode", 0)
            config.visible = mt5_symbol_info.get("visible", True)

        # Apply broker-specific overrides
        overrides = self._get_contract_spec_overrides()
        if "contract_size" in overrides:
            config.contract_size = overrides["contract_size"]
        if "volume_min" in overrides:
            config.volume_min = overrides["volume_min"]
        if "volume_max" in overrides:
            config.volume_max = overrides["volume_max"]
        if "volume_step" in overrides:
            config.volume_step = overrides["volume_step"]

        return config

    @abstractmethod
    def _get_contract_spec_overrides(self) -> Dict[str, Any]:
        """Return broker-specific contract spec overrides."""
        ...

    # ── Execution parameters ──────────────────────────────────────

    def get_order_deviation(self) -> int:
        return self.execution_profile.default_deviation_points

    def get_fill_policy(self) -> str:
        prefs = self.execution_profile.fill_policy_preferences
        return prefs[0] if prefs else "IOC"

    def get_magic_number(self, sequence: int = 0) -> int:
        return self.execution_profile.magic_number_base + sequence

    def get_comment(self, tag: str = "") -> str:
        prefix = self.execution_profile.comment_prefix
        return f"{prefix}|{tag}" if tag else prefix

    # ── Connection ────────────────────────────────────────────────

    def get_connection_config(
        self,
        login: int,
        password: str,
        server: Optional[str] = None,
    ) -> BrokerConnectionConfig:
        """Build connection config for MT5 initialization."""
        return BrokerConnectionConfig(
            broker_name=self.broker_name,
            broker_domain=self.broker_domain,
            mt5_server=server or self.mt5_server_candidates[0],
            mt5_login=login,
            mt5_password=password,
            terminal_path=self.connection_config.terminal_path,
            terminal_data_path=self.connection_config.terminal_data_path,
        )

    # ── Health ────────────────────────────────────────────────────

    def update_health(self, **kwargs) -> None:
        for k, v in kwargs.items():
            if hasattr(self.health, k):
                setattr(self.health, k, v)

    def is_healthy(self) -> bool:
        return (
            self.health.connected
            and self.health.consecutive_failures < 3
            and self.health.success_rate > 0.8
        )
