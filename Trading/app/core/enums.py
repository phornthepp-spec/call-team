"""
Core enumerations for the Full-Auto XAUUSD Trading System.

All enums are str-backed for JSON serialization and database storage.
"""

from __future__ import annotations

import enum


# ── Risk Guard Verdicts ─────────────────────────────────────────────────

class GuardStatus(str, enum.Enum):
    """Outcome of a single risk guard evaluation."""
    PASS = "PASS"
    WARN = "WARN"
    BLOCK = "BLOCK"


class GuardCategory(str, enum.Enum):
    """Classification of risk guard types."""
    ACCOUNT = "ACCOUNT"
    MARKET = "MARKET"
    STRATEGY = "STRATEGY"
    SYSTEM = "SYSTEM"


class GuardSeverity(str, enum.Enum):
    """How critical a guard failure is."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# ── Decision / Policy ──────────────────────────────────────────────────

class PolicyMode(str, enum.Enum):
    """Trading risk policy mode."""
    STRICT = "strict"
    NORMAL = "normal"
    SAFE = "safe"


class FinalDecision(str, enum.Enum):
    """Final risk engine decision for an order."""
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    REDUCE = "REDUCE"      # approve with reduced lot


# ── Signal ──────────────────────────────────────────────────────────────

class SignalSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class SignalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    EXECUTED = "EXECUTED"


# ── Order / Execution ──────────────────────────────────────────────────

class OrderType(str, enum.Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    STOP_LIMIT = "STOP_LIMIT"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    PLACED = "PLACED"
    FILLED = "FILLED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CLOSED = "CLOSED"


class CloseReason(str, enum.Enum):
    STOP_LOSS = "STOP_LOSS"
    TAKE_PROFIT = "TAKE_PROFIT"
    MANUAL = "MANUAL"
    KILL_SWITCH = "KILL_SWITCH"
    PROFIT_LOCK = "PROFIT_LOCK"
    SIGNAL_EXIT = "SIGNAL_EXIT"
    RECONCILIATION = "RECONCILIATION"
    BROKER_CLOSE = "BROKER_CLOSE"


# ── Lockout / System State ─────────────────────────────────────────────

class LockoutType(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    KILL_SWITCH = "KILL_SWITCH"
    SAFE_MODE = "SAFE_MODE"
    PROFIT_LOCK = "PROFIT_LOCK"


class LockoutTrigger(str, enum.Enum):
    DAILY_LOSS_LIMIT = "DAILY_LOSS_LIMIT"
    WEEKLY_LOSS_LIMIT = "WEEKLY_LOSS_LIMIT"
    MONTHLY_LOSS_LIMIT = "MONTHLY_LOSS_LIMIT"
    MAX_TRADES_PER_DAY = "MAX_TRADES_PER_DAY"
    MAX_CONSECUTIVE_LOSSES = "MAX_CONSECUTIVE_LOSSES"
    DAILY_PROFIT_TARGET = "DAILY_PROFIT_TARGET"
    MT5_DISCONNECT = "MT5_DISCONNECT"
    RECONCILIATION_FAILURE = "RECONCILIATION_FAILURE"
    HARD_MARGIN_BREACH = "HARD_MARGIN_BREACH"
    DUPLICATE_ORDER = "DUPLICATE_ORDER"
    MANUAL = "MANUAL"
    VOLATILITY_ANOMALY = "VOLATILITY_ANOMALY"
    STRATEGY_DRIFT = "STRATEGY_DRIFT"
    SLIPPAGE_CLUSTER = "SLIPPAGE_CLUSTER"
    WARN_CLUSTER = "WARN_CLUSTER"


class SystemHealthStatus(str, enum.Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    CRITICAL = "CRITICAL"
    OFFLINE = "OFFLINE"


# ── Market ──────────────────────────────────────────────────────────────

class MarketSession(str, enum.Enum):
    ASIAN = "Asian"
    LONDON = "London"
    NEW_YORK = "NewYork"
    LONDON_NY_OVERLAP = "NewYorkOverlap"
    OFF_HOURS = "OffHours"
    ROLLOVER = "Rollover"


class MarketRegime(str, enum.Enum):
    TRENDING_UP = "TRENDING_UP"
    TRENDING_DOWN = "TRENDING_DOWN"
    RANGING = "RANGING"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    LOW_VOLATILITY = "LOW_VOLATILITY"
    BREAKOUT = "BREAKOUT"
    UNKNOWN = "UNKNOWN"


class VolatilityState(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    ELEVATED = "ELEVATED"
    EXTREME = "EXTREME"


# ── Timeframe ──────────────────────────────────────────────────────────

class Timeframe(str, enum.Enum):
    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"
    W1 = "W1"
    MN1 = "MN1"


# ── Broker ──────────────────────────────────────────────────────────────

class FillPolicy(str, enum.Enum):
    IOC = "IOC"         # Immediate or Cancel
    FOK = "FOK"         # Fill or Kill
    RETURN = "RETURN"   # Return remainder


class ExecutionMode(str, enum.Enum):
    INSTANT = "INSTANT"
    MARKET = "MARKET"
    EXCHANGE = "EXCHANGE"
    REQUEST = "REQUEST"


# ── Audit ──────────────────────────────────────────────────────────────

class AuditEventType(str, enum.Enum):
    SIGNAL_GENERATED = "SIGNAL_GENERATED"
    RISK_CHECK_RUN = "RISK_CHECK_RUN"
    ORDER_PLACED = "ORDER_PLACED"
    ORDER_FILLED = "ORDER_FILLED"
    ORDER_REJECTED = "ORDER_REJECTED"
    ORDER_CLOSED = "ORDER_CLOSED"
    LOCKOUT_ACTIVATED = "LOCKOUT_ACTIVATED"
    LOCKOUT_CLEARED = "LOCKOUT_CLEARED"
    SAFE_MODE_ACTIVATED = "SAFE_MODE_ACTIVATED"
    SAFE_MODE_DEACTIVATED = "SAFE_MODE_DEACTIVATED"
    KILL_SWITCH_ACTIVATED = "KILL_SWITCH_ACTIVATED"
    KILL_SWITCH_DEACTIVATED = "KILL_SWITCH_DEACTIVATED"
    RECONCILIATION_MISMATCH = "RECONCILIATION_MISMATCH"
    RECONCILIATION_RESOLVED = "RECONCILIATION_RESOLVED"
    SYSTEM_STARTUP = "SYSTEM_STARTUP"
    SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN"
    CONFIG_CHANGED = "CONFIG_CHANGED"
    MT5_CONNECTED = "MT5_CONNECTED"
    MT5_DISCONNECTED = "MT5_DISCONNECTED"
    ALERT_SENT = "ALERT_SENT"


class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"
