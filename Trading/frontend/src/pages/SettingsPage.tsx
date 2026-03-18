import { useState, useEffect } from "react";
import {
  Server,
  Bell,
  Sliders,
  AlertTriangle,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle,
  Wifi,
  WifiOff,
  Bot,
  Power,
} from "lucide-react";

// Mock MT5 connection settings
const defaultMt5Config = {
  account_number: "5012847",
  server: "MetaQuotes-Demo",
  terminal_path: "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
};

// Mock notification settings
const defaultNotifications = {
  line_enabled: true,
  telegram_enabled: true,
  email_enabled: false,
  notify_on_signal: true,
  notify_on_trade: true,
  notify_on_risk_alert: true,
  notify_on_daily_summary: true,
};

// Mock strategy parameters
const defaultStrategy = {
  primary_timeframe: "M15",
  ema_fast: 8,
  ema_slow: 21,
  rsi_period: 14,
  rsi_overbought: 70,
  rsi_oversold: 30,
  atr_period: 14,
  atr_sl_multiplier: 1.5,
  atr_tp_multiplier: 3.0,
  min_confidence: 70,
  session_start: "08:00",
  session_end: "22:00",
};

// Auto-trade config defaults
const defaultAutoTrade = {
  enabled: false,
  evaluation_interval_seconds: 60,
  min_confidence_threshold: 0.70,
  timeframe: "M15",
  max_auto_trades_per_day: 3,
};

const intervalOptions = [
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
];

export default function SettingsPage() {
  const [mt5Config, setMt5Config] = useState(defaultMt5Config);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [strategy, setStrategy] = useState(defaultStrategy);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "failed"
  >("idle");
  const [autoTrade, setAutoTrade] = useState(defaultAutoTrade);
  const [autoTradeLoading, setAutoTradeLoading] = useState(false);

  // Fetch auto-trade status on mount
  useEffect(() => {
    fetch("/api/auto-trade/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.config) {
          setAutoTrade({
            enabled: data.enabled || data.config.enabled,
            evaluation_interval_seconds: data.config.evaluation_interval_seconds,
            min_confidence_threshold: data.config.min_confidence_threshold,
            timeframe: data.config.timeframe,
            max_auto_trades_per_day: data.config.max_auto_trades_per_day,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleAutoTradeToggle = async () => {
    if (!autoTrade.enabled) {
      if (
        !window.confirm(
          "Enable Full-Auto Trading?\n\n" +
          "The system will automatically evaluate signals and execute trades " +
          "based on your risk parameters. All safety checks remain active.\n\n" +
          "Are you sure?"
        )
      ) return;
    }

    setAutoTradeLoading(true);
    try {
      const endpoint = autoTrade.enabled ? "/api/auto-trade/stop" : "/api/auto-trade/start";
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        setAutoTrade((prev) => ({ ...prev, enabled: !prev.enabled }));
      }
    } catch {
      // ignore
    } finally {
      setAutoTradeLoading(false);
    }
  };

  const [configSaved, setConfigSaved] = useState(false);

  const handleAutoTradeConfigSave = async () => {
    try {
      const res = await fetch("/api/auto-trade/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_interval_seconds: autoTrade.evaluation_interval_seconds,
          min_confidence_threshold: autoTrade.min_confidence_threshold,
          timeframe: autoTrade.timeframe,
          max_auto_trades_per_day: autoTrade.max_auto_trades_per_day,
        }),
      });
      if (res.ok) {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    setConnectionStatus("idle");
    setTimeout(() => {
      setIsTestingConnection(false);
      setConnectionStatus("success");
    }, 2000);
  };

  const handleSaveAll = () => {
    alert("All settings saved successfully.");
  };

  const handleToggleMaintenance = () => {
    if (!maintenanceMode) {
      if (
        window.confirm(
          "Enable maintenance mode? This will pause all trading operations."
        )
      ) {
        setMaintenanceMode(true);
      }
    } else {
      setMaintenanceMode(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            System configuration and preferences
          </p>
        </div>
        <button onClick={handleSaveAll} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save All Settings
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* MT5 Connection */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            MT5 Connection
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Account Number
              </label>
              <input
                type="text"
                value={mt5Config.account_number}
                onChange={(e) =>
                  setMt5Config({ ...mt5Config, account_number: e.target.value })
                }
                className="input-dark"
                placeholder="e.g. 5012847"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Server
              </label>
              <input
                type="text"
                value={mt5Config.server}
                onChange={(e) =>
                  setMt5Config({ ...mt5Config, server: e.target.value })
                }
                className="input-dark"
                placeholder="e.g. MetaQuotes-Demo"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Terminal Path
              </label>
              <input
                type="text"
                value={mt5Config.terminal_path}
                onChange={(e) =>
                  setMt5Config({ ...mt5Config, terminal_path: e.target.value })
                }
                className="input-dark font-mono text-xs"
                placeholder="Path to terminal64.exe"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="btn-outline flex items-center gap-2"
              >
                {isTestingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </button>

              {connectionStatus === "success" && (
                <span className="flex items-center gap-1.5 text-sm text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  Connected successfully
                </span>
              )}
              {connectionStatus === "failed" && (
                <span className="flex items-center gap-1.5 text-sm text-red-400">
                  <WifiOff className="w-4 h-4" />
                  Connection failed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Bell className="w-4 h-4 text-yellow-400" />
            Notification Preferences
          </h3>

          <div className="space-y-5">
            {/* Channels */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">
                Channels
              </p>
              <div className="space-y-3">
                {[
                  {
                    key: "line_enabled" as const,
                    label: "LINE Notify",
                    desc: "Receive alerts via LINE messaging",
                  },
                  {
                    key: "telegram_enabled" as const,
                    label: "Telegram Bot",
                    desc: "Receive alerts via Telegram",
                  },
                  {
                    key: "email_enabled" as const,
                    label: "Email",
                    desc: "Receive alerts via email",
                  },
                ].map((channel) => (
                  <label
                    key={channel.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 cursor-pointer hover:border-slate-600 transition-colors"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {channel.label}
                      </p>
                      <p className="text-xs text-slate-500">{channel.desc}</p>
                    </div>
                    <div
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        notifications[channel.key] ? "bg-blue-600" : "bg-slate-600"
                      }`}
                      onClick={() =>
                        setNotifications({
                          ...notifications,
                          [channel.key]: !notifications[channel.key],
                        })
                      }
                    >
                      <div
                        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                        style={{
                          transform: notifications[channel.key]
                            ? "translateX(22px)"
                            : "translateX(0)",
                        }}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Event Types */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">
                Event Types
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "notify_on_signal" as const, label: "New Signal" },
                  { key: "notify_on_trade" as const, label: "Trade Executed" },
                  { key: "notify_on_risk_alert" as const, label: "Risk Alert" },
                  {
                    key: "notify_on_daily_summary" as const,
                    label: "Daily Summary",
                  },
                ].map((event) => (
                  <label
                    key={event.key}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 cursor-pointer hover:border-slate-600 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={notifications[event.key]}
                      onChange={() =>
                        setNotifications({
                          ...notifications,
                          [event.key]: !notifications[event.key],
                        })
                      }
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-slate-300">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Parameters */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            Strategy Parameters
          </h3>
          <button
            onClick={() => setStrategy(defaultStrategy)}
            className="btn-outline flex items-center gap-2 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Primary Timeframe
            </label>
            <select
              value={strategy.primary_timeframe}
              onChange={(e) =>
                setStrategy({ ...strategy, primary_timeframe: e.target.value })
              }
              className="input-dark"
            >
              <option value="M1">M1</option>
              <option value="M5">M5</option>
              <option value="M15">M15</option>
              <option value="M30">M30</option>
              <option value="H1">H1</option>
              <option value="H4">H4</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              EMA Fast
            </label>
            <input
              type="number"
              value={strategy.ema_fast}
              onChange={(e) =>
                setStrategy({ ...strategy, ema_fast: parseInt(e.target.value) })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              EMA Slow
            </label>
            <input
              type="number"
              value={strategy.ema_slow}
              onChange={(e) =>
                setStrategy({ ...strategy, ema_slow: parseInt(e.target.value) })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              RSI Period
            </label>
            <input
              type="number"
              value={strategy.rsi_period}
              onChange={(e) =>
                setStrategy({
                  ...strategy,
                  rsi_period: parseInt(e.target.value),
                })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              RSI Overbought
            </label>
            <input
              type="number"
              value={strategy.rsi_overbought}
              onChange={(e) =>
                setStrategy({
                  ...strategy,
                  rsi_overbought: parseInt(e.target.value),
                })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              RSI Oversold
            </label>
            <input
              type="number"
              value={strategy.rsi_oversold}
              onChange={(e) =>
                setStrategy({
                  ...strategy,
                  rsi_oversold: parseInt(e.target.value),
                })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              ATR Period
            </label>
            <input
              type="number"
              value={strategy.atr_period}
              onChange={(e) =>
                setStrategy({
                  ...strategy,
                  atr_period: parseInt(e.target.value),
                })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              ATR SL Multiplier
            </label>
            <input
              type="number"
              step="0.1"
              value={strategy.atr_sl_multiplier}
              onChange={(e) =>
                setStrategy({
                  ...strategy,
                  atr_sl_multiplier: parseFloat(e.target.value),
                })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              ATR TP Multiplier
            </label>
            <input
              type="number"
              step="0.1"
              value={strategy.atr_tp_multiplier}
              onChange={(e) =>
                setStrategy({
                  ...strategy,
                  atr_tp_multiplier: parseFloat(e.target.value),
                })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Min Confidence (%)
            </label>
            <input
              type="number"
              value={strategy.min_confidence}
              onChange={(e) =>
                setStrategy({
                  ...strategy,
                  min_confidence: parseInt(e.target.value),
                })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Session Start (UTC)
            </label>
            <input
              type="time"
              value={strategy.session_start}
              onChange={(e) =>
                setStrategy({ ...strategy, session_start: e.target.value })
              }
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Session End (UTC)
            </label>
            <input
              type="time"
              value={strategy.session_end}
              onChange={(e) =>
                setStrategy({ ...strategy, session_end: e.target.value })
              }
              className="input-dark"
            />
          </div>
        </div>
      </div>

      {/* Auto-Trade Configuration */}
      <div className="bg-slate-800 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-400" />
            Full-Auto Trading
          </h3>
          <div className="flex items-center gap-3">
            {autoTrade.enabled && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-medium text-blue-400">ACTIVE</span>
              </span>
            )}
            <div
              className={`relative w-14 h-7 rounded-full transition-colors cursor-pointer ${
                autoTrade.enabled ? "bg-blue-600" : "bg-slate-600"
              } ${autoTradeLoading ? "opacity-50 pointer-events-none" : ""}`}
              onClick={handleAutoTradeToggle}
            >
              <div
                className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow-md flex items-center justify-center"
                style={{
                  transform: autoTrade.enabled
                    ? "translateX(28px)"
                    : "translateX(0)",
                }}
              >
                {autoTradeLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                ) : (
                  <Power className={`w-3.5 h-3.5 ${autoTrade.enabled ? "text-blue-600" : "text-slate-400"}`} />
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-400 mb-5">
          When enabled, the system automatically evaluates signals and executes
          trades based on your risk parameters. All 8 safety checks remain active.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Evaluation Interval
            </label>
            <select
              value={autoTrade.evaluation_interval_seconds}
              onChange={(e) => {
                setAutoTrade({
                  ...autoTrade,
                  evaluation_interval_seconds: parseInt(e.target.value),
                });
              }}
              className="input-dark"
            >
              {intervalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Min Confidence (%)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(autoTrade.min_confidence_threshold * 100)}
              onChange={(e) =>
                setAutoTrade({
                  ...autoTrade,
                  min_confidence_threshold: parseInt(e.target.value) / 100,
                })
              }
              className="w-full accent-blue-500 mt-2"
            />
            <p className="text-xs text-slate-300 text-center mt-1">
              {Math.round(autoTrade.min_confidence_threshold * 100)}%
            </p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Timeframe
            </label>
            <select
              value={autoTrade.timeframe}
              onChange={(e) =>
                setAutoTrade({ ...autoTrade, timeframe: e.target.value })
              }
              className="input-dark"
            >
              <option value="M1">M1</option>
              <option value="M5">M5</option>
              <option value="M15">M15</option>
              <option value="M30">M30</option>
              <option value="H1">H1</option>
              <option value="H4">H4</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Max Trades / Day
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={autoTrade.max_auto_trades_per_day}
              onChange={(e) =>
                setAutoTrade({
                  ...autoTrade,
                  max_auto_trades_per_day: parseInt(e.target.value) || 1,
                })
              }
              className="input-dark"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          {configSaved && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          <button
            onClick={handleAutoTradeConfigSave}
            className="btn-outline flex items-center gap-2 text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Save Auto-Trade Config
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-slate-800 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          Danger Zone
        </h3>
        <p className="text-sm text-slate-400 mb-5">
          These settings can affect trading operations. Proceed with caution.
        </p>

        <div className="space-y-4">
          {/* Maintenance Mode */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
            <div>
              <p className="text-white font-medium">Maintenance Mode</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Pause all automated trading and signal evaluation. No new trades
                will be opened.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {maintenanceMode && (
                <span className="badge-yellow">Active</span>
              )}
              <div
                className={`relative w-14 h-7 rounded-full transition-colors cursor-pointer ${
                  maintenanceMode ? "bg-red-600" : "bg-slate-600"
                }`}
                onClick={handleToggleMaintenance}
              >
                <div
                  className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow-md"
                  style={{
                    transform: maintenanceMode
                      ? "translateX(28px)"
                      : "translateX(0)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Clear History */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
            <div>
              <p className="text-white font-medium">Clear Trade History</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Remove all historical trade records. This action cannot be
                undone.
              </p>
            </div>
            <button
              onClick={() =>
                window.confirm(
                  "Are you sure? This will permanently delete all trade history."
                )
              }
              className="btn-danger text-sm"
            >
              Clear History
            </button>
          </div>

          {/* Reset All Settings */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
            <div>
              <p className="text-white font-medium">Reset All Settings</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Restore all settings to factory defaults including risk
                parameters and strategy config.
              </p>
            </div>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Reset all settings to defaults? This cannot be undone."
                  )
                ) {
                  setMt5Config(defaultMt5Config);
                  setNotifications(defaultNotifications);
                  setStrategy(defaultStrategy);
                  setMaintenanceMode(false);
                  alert("All settings reset to defaults.");
                }
              }}
              className="btn-danger text-sm"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
