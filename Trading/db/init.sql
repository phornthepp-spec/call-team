-- =============================================================================
-- Trading System Database Schema
-- PostgreSQL init.sql
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. users
-- =============================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'trader'
                        CHECK (role IN ('admin', 'trader', 'viewer')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);

-- =============================================================================
-- 2. trading_accounts
-- =============================================================================
CREATE TABLE trading_accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_name     VARCHAR(150) NOT NULL,
    platform        VARCHAR(20)  NOT NULL DEFAULT 'MT5',
    account_number  VARCHAR(50)  NOT NULL,
    server_name     VARCHAR(150),
    terminal_path   VARCHAR(500),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (broker_name, account_number)
);

CREATE INDEX idx_trading_accounts_user_id   ON trading_accounts (user_id);
CREATE INDEX idx_trading_accounts_active    ON trading_accounts (is_active) WHERE is_active = TRUE;

-- =============================================================================
-- 3. account_snapshots
-- =============================================================================
CREATE TABLE account_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID           NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    balance         NUMERIC(18,2)  NOT NULL DEFAULT 0,
    equity          NUMERIC(18,2)  NOT NULL DEFAULT 0,
    margin          NUMERIC(18,2)  NOT NULL DEFAULT 0,
    free_margin     NUMERIC(18,2)  NOT NULL DEFAULT 0,
    margin_level    NUMERIC(10,2)  DEFAULT 0,
    floating_pl     NUMERIC(18,2)  NOT NULL DEFAULT 0,
    captured_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_snapshots_account_id   ON account_snapshots (account_id);
CREATE INDEX idx_account_snapshots_captured_at  ON account_snapshots (captured_at DESC);
CREATE INDEX idx_account_snapshots_acct_time    ON account_snapshots (account_id, captured_at DESC);

-- =============================================================================
-- 4. market_ticks
-- =============================================================================
CREATE TABLE market_ticks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          VARCHAR(20)    NOT NULL,
    bid             NUMERIC(18,6)  NOT NULL,
    ask             NUMERIC(18,6)  NOT NULL,
    spread          NUMERIC(10,2)  NOT NULL DEFAULT 0,
    timestamp       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_ticks_symbol     ON market_ticks (symbol);
CREATE INDEX idx_market_ticks_timestamp  ON market_ticks (timestamp DESC);
CREATE INDEX idx_market_ticks_sym_time   ON market_ticks (symbol, timestamp DESC);

-- =============================================================================
-- 5. market_bars
-- =============================================================================
CREATE TABLE market_bars (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          VARCHAR(20)    NOT NULL,
    timeframe       VARCHAR(10)    NOT NULL,
    bar_time        TIMESTAMPTZ    NOT NULL,
    open            NUMERIC(18,6)  NOT NULL,
    high            NUMERIC(18,6)  NOT NULL,
    low             NUMERIC(18,6)  NOT NULL,
    close           NUMERIC(18,6)  NOT NULL,
    tick_volume     BIGINT         NOT NULL DEFAULT 0,

    UNIQUE (symbol, timeframe, bar_time)
);

CREATE INDEX idx_market_bars_symbol     ON market_bars (symbol);
CREATE INDEX idx_market_bars_timeframe  ON market_bars (timeframe);
CREATE INDEX idx_market_bars_bar_time   ON market_bars (bar_time DESC);
CREATE INDEX idx_market_bars_sym_tf_bt  ON market_bars (symbol, timeframe, bar_time DESC);

-- =============================================================================
-- 6. trade_signals
-- =============================================================================
CREATE TABLE trade_signals (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id       UUID           NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    symbol           VARCHAR(20)    NOT NULL,
    timeframe        VARCHAR(10)    NOT NULL,
    strategy_name    VARCHAR(100)   NOT NULL,
    signal_type      VARCHAR(4)     NOT NULL
                         CHECK (signal_type IN ('BUY', 'SELL')),
    entry_price      NUMERIC(18,6)  NOT NULL,
    stop_loss        NUMERIC(18,6),
    take_profit      NUMERIC(18,6),
    risk_reward      NUMERIC(6,2),
    confidence_score NUMERIC(5,2)   DEFAULT 0
                         CHECK (confidence_score >= 0 AND confidence_score <= 100),
    lot_size         NUMERIC(10,4),
    risk_amount      NUMERIC(18,2),
    status           VARCHAR(20)    NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_signals_account_id     ON trade_signals (account_id);
CREATE INDEX idx_trade_signals_status         ON trade_signals (status);
CREATE INDEX idx_trade_signals_symbol         ON trade_signals (symbol);
CREATE INDEX idx_trade_signals_strategy       ON trade_signals (strategy_name);
CREATE INDEX idx_trade_signals_created_at     ON trade_signals (created_at DESC);
CREATE INDEX idx_trade_signals_acct_status    ON trade_signals (account_id, status);

-- =============================================================================
-- 7. risk_checks
-- =============================================================================
CREATE TABLE risk_checks (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id            UUID           NOT NULL REFERENCES trade_signals(id) ON DELETE CASCADE,
    account_id           UUID           NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    risk_per_trade_pct   NUMERIC(5,2)   NOT NULL DEFAULT 0,
    risk_amount          NUMERIC(18,2)  NOT NULL DEFAULT 0,
    daily_loss_pct_if_hit NUMERIC(5,2)  DEFAULT 0,
    spread_ok            BOOLEAN        NOT NULL DEFAULT FALSE,
    volatility_ok        BOOLEAN        NOT NULL DEFAULT FALSE,
    session_ok           BOOLEAN        NOT NULL DEFAULT FALSE,
    max_trades_ok        BOOLEAN        NOT NULL DEFAULT FALSE,
    margin_ok            BOOLEAN        NOT NULL DEFAULT FALSE,
    final_decision       BOOLEAN        NOT NULL DEFAULT FALSE,
    reason_json          JSONB          DEFAULT '{}',
    checked_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_checks_signal_id   ON risk_checks (signal_id);
CREATE INDEX idx_risk_checks_account_id  ON risk_checks (account_id);
CREATE INDEX idx_risk_checks_decision    ON risk_checks (final_decision);
CREATE INDEX idx_risk_checks_checked_at  ON risk_checks (checked_at DESC);

-- =============================================================================
-- 8. orders
-- =============================================================================
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID           NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    signal_id       UUID           REFERENCES trade_signals(id) ON DELETE SET NULL,
    mt5_ticket      BIGINT,
    symbol          VARCHAR(20)    NOT NULL,
    side            VARCHAR(4)     NOT NULL
                        CHECK (side IN ('BUY', 'SELL')),
    volume          NUMERIC(10,4)  NOT NULL,
    entry_price     NUMERIC(18,6),
    stop_loss       NUMERIC(18,6),
    take_profit     NUMERIC(18,6),
    status          VARCHAR(30)    NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                            'PENDING', 'OPEN', 'CLOSED',
                            'CANCELLED', 'PARTIALLY_FILLED', 'FAILED'
                        )),
    opened_at       TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ
);

CREATE INDEX idx_orders_account_id   ON orders (account_id);
CREATE INDEX idx_orders_signal_id    ON orders (signal_id);
CREATE INDEX idx_orders_mt5_ticket   ON orders (mt5_ticket);
CREATE INDEX idx_orders_symbol       ON orders (symbol);
CREATE INDEX idx_orders_status       ON orders (status);
CREATE INDEX idx_orders_opened_at    ON orders (opened_at DESC);
CREATE INDEX idx_orders_acct_status  ON orders (account_id, status);

-- =============================================================================
-- 9. executions
-- =============================================================================
CREATE TABLE executions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id         UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    requested_price  NUMERIC(18,6)  NOT NULL,
    executed_price   NUMERIC(18,6)  NOT NULL,
    slippage         NUMERIC(10,2)  NOT NULL DEFAULT 0,
    commission       NUMERIC(12,4)  NOT NULL DEFAULT 0,
    swap             NUMERIC(12,4)  NOT NULL DEFAULT 0,
    profit           NUMERIC(18,2)  NOT NULL DEFAULT 0,
    execution_time   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executions_order_id        ON executions (order_id);
CREATE INDEX idx_executions_execution_time  ON executions (execution_time DESC);

-- =============================================================================
-- 10. daily_risk_stats
-- =============================================================================
CREATE TABLE daily_risk_stats (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id           UUID           NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    date                 DATE           NOT NULL,
    starting_balance     NUMERIC(18,2)  NOT NULL DEFAULT 0,
    realized_pl          NUMERIC(18,2)  NOT NULL DEFAULT 0,
    floating_pl          NUMERIC(18,2)  NOT NULL DEFAULT 0,
    max_drawdown_pct     NUMERIC(6,2)   NOT NULL DEFAULT 0,
    trades_count         INTEGER        NOT NULL DEFAULT 0,
    consecutive_losses   INTEGER        NOT NULL DEFAULT 0,
    is_locked            BOOLEAN        NOT NULL DEFAULT FALSE,

    UNIQUE (account_id, date)
);

CREATE INDEX idx_daily_risk_stats_account_id  ON daily_risk_stats (account_id);
CREATE INDEX idx_daily_risk_stats_date        ON daily_risk_stats (date DESC);
CREATE INDEX idx_daily_risk_stats_locked      ON daily_risk_stats (is_locked) WHERE is_locked = TRUE;

-- =============================================================================
-- 11. profit_allocations
-- =============================================================================
CREATE TABLE profit_allocations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id              UUID           NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    period_start            DATE           NOT NULL,
    period_end              DATE           NOT NULL,
    net_profit              NUMERIC(18,2)  NOT NULL DEFAULT 0,
    reserve_amount          NUMERIC(18,2)  NOT NULL DEFAULT 0,
    reinvest_amount         NUMERIC(18,2)  NOT NULL DEFAULT 0,
    external_invest_amount  NUMERIC(18,2)  NOT NULL DEFAULT 0,
    allocation_status       VARCHAR(30)    NOT NULL DEFAULT 'DRAFT'
                                CHECK (allocation_status IN (
                                    'DRAFT', 'CONFIRMED', 'DISTRIBUTED'
                                )),
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CHECK (period_end >= period_start)
);

CREATE INDEX idx_profit_alloc_account_id  ON profit_allocations (account_id);
CREATE INDEX idx_profit_alloc_period      ON profit_allocations (period_start, period_end);
CREATE INDEX idx_profit_alloc_status      ON profit_allocations (allocation_status);

-- =============================================================================
-- 12. strategy_configs
-- =============================================================================
CREATE TABLE strategy_configs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id              UUID           REFERENCES trading_accounts(id) ON DELETE CASCADE,
    strategy_name           VARCHAR(100)   NOT NULL,
    timeframe               VARCHAR(10)    NOT NULL DEFAULT 'H1',
    risk_per_trade_pct      NUMERIC(5,2)   NOT NULL DEFAULT 1.00,
    daily_loss_limit_pct    NUMERIC(5,2)   NOT NULL DEFAULT 3.00,
    weekly_loss_limit_pct   NUMERIC(5,2)   NOT NULL DEFAULT 7.00,
    max_trades_per_day      INTEGER        NOT NULL DEFAULT 3,
    max_consecutive_losses  INTEGER        NOT NULL DEFAULT 3,
    max_spread_points       NUMERIC(6,2)   NOT NULL DEFAULT 30.00,
    atr_multiplier_sl       NUMERIC(5,2)   NOT NULL DEFAULT 1.50,
    rr_target               NUMERIC(5,2)   NOT NULL DEFAULT 2.00,
    min_rr                  NUMERIC(5,2)   NOT NULL DEFAULT 1.50,
    allowed_sessions        JSONB          NOT NULL DEFAULT '["London", "NewYork"]',
    enabled                 BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strategy_configs_account_id      ON strategy_configs (account_id);
CREATE INDEX idx_strategy_configs_strategy_name   ON strategy_configs (strategy_name);
CREATE INDEX idx_strategy_configs_enabled         ON strategy_configs (enabled) WHERE enabled = TRUE;

-- =============================================================================
-- Seed: Default Strategy Config (no account_id -- serves as a global template)
-- =============================================================================
INSERT INTO strategy_configs (
    id,
    account_id,
    strategy_name,
    timeframe,
    risk_per_trade_pct,
    daily_loss_limit_pct,
    weekly_loss_limit_pct,
    max_trades_per_day,
    max_consecutive_losses,
    max_spread_points,
    atr_multiplier_sl,
    rr_target,
    min_rr,
    allowed_sessions,
    enabled
) VALUES (
    uuid_generate_v4(),
    NULL,
    'SMC_Default',
    'H1',
    1.00,
    3.00,
    7.00,
    3,
    3,
    30.00,
    1.50,
    2.00,
    1.50,
    '["London", "NewYork", "LondonNewYorkOverlap"]',
    TRUE
);
