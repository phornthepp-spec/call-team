import { useState } from "react";
import {
  Shield,
  AlertTriangle,
  Lock,
  Unlock,
  Activity,
  TrendingDown,
  Hash,
  AlertOctagon,
  Save,
  RotateCcw,
} from "lucide-react";

// Mock risk status
const mockRiskStatus = {
  daily_pl: -145.20,
  daily_pl_limit: -200.00,
  weekly_pl: -320.50,
  weekly_pl_limit: -500.00,
  trades_today: 5,
  max_trades_per_day: 10,
  consecutive_losses: 1,
  max_consecutive_losses: 3,
  is_locked: false,
  lock_reason: null as string | null,
  risk_used_pct: 1.2,
};

// Mock risk config
const defaultConfig = {
  risk_per_trade: 1.0,
  daily_loss_limit: 200.0,
  weekly_loss_limit: 500.0,
  max_trades_per_day: 10,
  max_consecutive_losses: 3,
  min_rr: 1.5,
  max_spread: 30,
  max_position_size: 0.1,
  trailing_stop_enabled: true,
  break_even_enabled: true,
};

export default function RiskPage() {
  const [riskStatus] = useState(mockRiskStatus);
  const [config, setConfig] = useState(defaultConfig);
  const [isLocked, setIsLocked] = useState(mockRiskStatus.is_locked);

  const handleSaveConfig = () => {
    alert("Risk configuration saved successfully.");
  };

  const handleResetConfig = () => {
    setConfig(defaultConfig);
  };

  const handleKillSwitch = () => {
    if (
      window.confirm(
        "KILL SWITCH: This will immediately close all positions and stop all trading. Are you sure?"
      )
    ) {
      setIsLocked(true);
      alert("Kill switch activated. All trading has been stopped.");
    }
  };

  const handleUnlock = () => {
    if (window.confirm("Unlock trading system? Make sure risk conditions are clear.")) {
      setIsLocked(false);
      alert("Trading system unlocked.");
    }
  };

  const dailyUsagePct = Math.abs(riskStatus.daily_pl / riskStatus.daily_pl_limit) * 100;
  const weeklyUsagePct = Math.abs(riskStatus.weekly_pl / riskStatus.weekly_pl_limit) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Monitor and configure risk management
          </p>
        </div>
        {isLocked && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <Lock className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">
              SYSTEM LOCKED
            </span>
          </div>
        )}
      </div>

      {/* Risk Status Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Status */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Current Risk Status
          </h3>

          <div className="space-y-5">
            {/* Daily P/L */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Daily P/L</span>
                <span
                  className={`text-sm font-medium font-mono ${
                    riskStatus.daily_pl >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  ${riskStatus.daily_pl.toFixed(2)} / ${riskStatus.daily_pl_limit.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dailyUsagePct > 80
                      ? "bg-red-500"
                      : dailyUsagePct > 50
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(dailyUsagePct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {dailyUsagePct.toFixed(1)}% of daily limit used
              </p>
            </div>

            {/* Weekly P/L */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Weekly P/L</span>
                <span
                  className={`text-sm font-medium font-mono ${
                    riskStatus.weekly_pl >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  ${riskStatus.weekly_pl.toFixed(2)} / ${riskStatus.weekly_pl_limit.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    weeklyUsagePct > 80
                      ? "bg-red-500"
                      : weeklyUsagePct > 50
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(weeklyUsagePct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {weeklyUsagePct.toFixed(1)}% of weekly limit used
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-slate-400">Trades Today</span>
                </div>
                <p className="text-lg font-bold text-white">
                  {riskStatus.trades_today}
                  <span className="text-sm text-slate-500 font-normal">
                    /{riskStatus.max_trades_per_day}
                  </span>
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs text-slate-400">Consec. Losses</span>
                </div>
                <p className="text-lg font-bold text-white">
                  {riskStatus.consecutive_losses}
                  <span className="text-sm text-slate-500 font-normal">
                    /{riskStatus.max_consecutive_losses}
                  </span>
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs text-slate-400">Risk Used</span>
                </div>
                <p className="text-lg font-bold text-white">
                  {riskStatus.risk_used_pct}%
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  {isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-green-400" />
                  )}
                  <span className="text-xs text-slate-400">Status</span>
                </div>
                <p
                  className={`text-lg font-bold ${
                    isLocked ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {isLocked ? "LOCKED" : "ACTIVE"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Configuration */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Risk Configuration
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Risk Per Trade (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={config.risk_per_trade}
                  onChange={(e) =>
                    setConfig({ ...config, risk_per_trade: parseFloat(e.target.value) })
                  }
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Min R:R Ratio
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={config.min_rr}
                  onChange={(e) =>
                    setConfig({ ...config, min_rr: parseFloat(e.target.value) })
                  }
                  className="input-dark"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Daily Loss Limit ($)
                </label>
                <input
                  type="number"
                  value={config.daily_loss_limit}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      daily_loss_limit: parseFloat(e.target.value),
                    })
                  }
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Weekly Loss Limit ($)
                </label>
                <input
                  type="number"
                  value={config.weekly_loss_limit}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      weekly_loss_limit: parseFloat(e.target.value),
                    })
                  }
                  className="input-dark"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Max Trades/Day
                </label>
                <input
                  type="number"
                  value={config.max_trades_per_day}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_trades_per_day: parseInt(e.target.value),
                    })
                  }
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Max Consec. Losses
                </label>
                <input
                  type="number"
                  value={config.max_consecutive_losses}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_consecutive_losses: parseInt(e.target.value),
                    })
                  }
                  className="input-dark"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Max Spread (pts)
                </label>
                <input
                  type="number"
                  value={config.max_spread}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_spread: parseInt(e.target.value),
                    })
                  }
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Max Position Size
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.max_position_size}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_position_size: parseFloat(e.target.value),
                    })
                  }
                  className="input-dark"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-300">Trailing Stop</span>
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    config.trailing_stop_enabled ? "bg-blue-600" : "bg-slate-600"
                  }`}
                  onClick={() =>
                    setConfig({
                      ...config,
                      trailing_stop_enabled: !config.trailing_stop_enabled,
                    })
                  }
                >
                  <div
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{
                      transform: config.trailing_stop_enabled
                        ? "translateX(22px)"
                        : "translateX(0)",
                    }}
                  />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-300">Break-Even SL</span>
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    config.break_even_enabled ? "bg-blue-600" : "bg-slate-600"
                  }`}
                  onClick={() =>
                    setConfig({
                      ...config,
                      break_even_enabled: !config.break_even_enabled,
                    })
                  }
                >
                  <div
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{
                      transform: config.break_even_enabled
                        ? "translateX(22px)"
                        : "translateX(0)",
                    }}
                  />
                </div>
              </label>
            </div>

            {/* Save / Reset */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
              <button
                onClick={handleSaveConfig}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Configuration
              </button>
              <button
                onClick={handleResetConfig}
                className="btn-outline flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kill Switch & Unlock */}
      <div className="bg-slate-800 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-400" />
          Emergency Controls
        </h3>
        <p className="text-sm text-slate-400 mb-5">
          Use these controls to immediately halt or resume trading operations.
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={handleKillSwitch}
            disabled={isLocked}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
          >
            <AlertTriangle className="w-5 h-5" />
            KILL SWITCH
          </button>

          {isLocked && (
            <button
              onClick={handleUnlock}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors shadow-lg shadow-green-600/20"
            >
              <Unlock className="w-5 h-5" />
              Unlock System
            </button>
          )}

          <div className="flex-1" />

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              isLocked
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-green-500/10 border-green-500/20 text-green-400"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isLocked ? "bg-red-500" : "bg-green-500 animate-pulse"
              }`}
            />
            <span className="text-sm font-medium">
              {isLocked ? "Trading Halted" : "Trading Active"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
