import { useState } from "react";
import {
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Target,
  TrendingUp,
  ShieldCheck,
  BarChart3,
} from "lucide-react";

// Mock signal data
const mockSignal = {
  id: "sig_20260318_001",
  symbol: "XAUUSD",
  timeframe: "M15",
  side: "BUY" as const,
  entry: 2385.50,
  sl: 2379.00,
  tp: 2399.00,
  rr: 2.08,
  lot_size: 0.05,
  risk_amount: 32.50,
  spread: 18,
  confidence: 87,
  strategy: "EMA_Cross + RSI_Reversal",
  timestamp: "2026-03-18T13:28:00Z",
  market_context: {
    trend: "Bullish",
    volatility: "Normal",
    session: "London/NY Overlap",
    atr_14: 28.5,
  },
};

// Mock risk check results
const mockRiskChecks = [
  { check: "Daily Loss Limit", passed: true, detail: "-$45.20 / -$200.00 limit" },
  { check: "Max Trades Per Day", passed: true, detail: "5 / 10 max" },
  { check: "Consecutive Losses", passed: true, detail: "1 / 3 max" },
  { check: "Minimum R:R", passed: true, detail: "2.08 >= 1.50 min" },
  { check: "Max Spread", passed: true, detail: "18 pts <= 30 pts max" },
  { check: "Position Size", passed: true, detail: "0.05 lots, 1.0% risk" },
  { check: "Weekly Loss Limit", passed: true, detail: "-$120.50 / -$500.00 limit" },
  { check: "Correlation Check", passed: false, detail: "High correlation with existing XAUUSD position" },
];

// Mock signal history
const signalHistory = [
  { id: "sig_003", time: "13:28", side: "BUY", entry: 2385.50, confidence: 87, status: "PENDING" },
  { id: "sig_002", time: "12:45", side: "SELL", entry: 2392.30, confidence: 72, status: "APPROVED" },
  { id: "sig_001", time: "11:15", side: "BUY", entry: 2378.00, confidence: 65, status: "REJECTED" },
  { id: "sig_000", time: "10:30", side: "SELL", entry: 2390.75, confidence: 91, status: "EXECUTED" },
];

export default function SignalsPage() {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [signalData] = useState(mockSignal);

  const handleEvaluate = () => {
    setIsEvaluating(true);
    setTimeout(() => setIsEvaluating(false), 2000);
  };

  const handleApprove = () => {
    alert("Signal approved and sent to execution engine.");
  };

  const handleReject = () => {
    alert("Signal rejected.");
  };

  const passedChecks = mockRiskChecks.filter((c) => c.passed).length;
  const totalChecks = mockRiskChecks.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Signal Evaluation</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Analyze and approve trading signals
          </p>
        </div>
        <button
          onClick={handleEvaluate}
          disabled={isEvaluating}
          className="btn-primary flex items-center gap-2"
        >
          {isEvaluating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isEvaluating ? "Evaluating..." : "Evaluate Signal"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Signal Card */}
        <div className="xl:col-span-2 space-y-6">
          {/* Main Signal */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-14 h-14 rounded-xl ${
                    signalData.side === "BUY"
                      ? "bg-green-500/15"
                      : "bg-red-500/15"
                  }`}
                >
                  {signalData.side === "BUY" ? (
                    <ArrowUpRight className="w-7 h-7 text-green-400" />
                  ) : (
                    <ArrowDownRight className="w-7 h-7 text-red-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">
                      {signalData.symbol}
                    </h2>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-sm font-bold ${
                        signalData.side === "BUY"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {signalData.side}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs">
                      {signalData.timeframe}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {signalData.strategy}
                  </p>
                </div>
              </div>
              {/* Confidence Score */}
              <div className="text-center">
                <div
                  className={`text-3xl font-bold ${
                    signalData.confidence >= 80
                      ? "text-green-400"
                      : signalData.confidence >= 60
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {signalData.confidence}%
                </div>
                <p className="text-xs text-slate-400">Confidence</p>
              </div>
            </div>

            {/* Price Levels */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-400 uppercase">Entry</span>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  {signalData.entry.toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-red-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-slate-400 uppercase">
                    Stop Loss
                  </span>
                </div>
                <p className="text-lg font-bold text-red-400 font-mono">
                  {signalData.sl.toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-green-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-slate-400 uppercase">
                    Take Profit
                  </span>
                </div>
                <p className="text-lg font-bold text-green-400 font-mono">
                  {signalData.tp.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Signal Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Risk:Reward</p>
                <p className="text-sm font-semibold text-white">
                  1:{signalData.rr.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Lot Size</p>
                <p className="text-sm font-semibold text-white">
                  {signalData.lot_size} lots
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Risk Amount</p>
                <p className="text-sm font-semibold text-yellow-400">
                  ${signalData.risk_amount.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Spread</p>
                <p className="text-sm font-semibold text-white">
                  {signalData.spread} pts
                </p>
              </div>
            </div>

            {/* Market Context */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <h4 className="text-xs text-slate-400 uppercase mb-3 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" />
                Market Context
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Trend</p>
                  <p className="text-sm font-medium text-green-400">
                    {signalData.market_context.trend}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Volatility</p>
                  <p className="text-sm font-medium text-white">
                    {signalData.market_context.volatility}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Session</p>
                  <p className="text-sm font-medium text-white">
                    {signalData.market_context.session}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">ATR(14)</p>
                  <p className="text-sm font-medium text-white">
                    {signalData.market_context.atr_14}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-700">
              <button
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                Approve & Execute
              </button>
              <button
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium py-3 rounded-lg transition-colors border border-red-500/20"
              >
                <XCircle className="w-5 h-5" />
                Reject Signal
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Risk Check Results */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Risk Checks
              </h3>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  passedChecks === totalChecks
                    ? "bg-green-500/15 text-green-400"
                    : "bg-yellow-500/15 text-yellow-400"
                }`}
              >
                {passedChecks}/{totalChecks} Passed
              </span>
            </div>
            <div className="space-y-2">
              {mockRiskChecks.map((check, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    check.passed
                      ? "bg-slate-900/30 border-slate-700/50"
                      : "bg-red-500/5 border-red-500/20"
                  }`}
                >
                  {check.passed ? (
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        check.passed ? "text-slate-300" : "text-red-400"
                      }`}
                    >
                      {check.check}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {check.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signal History */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Signal History
            </h3>
            <div className="space-y-2">
              {signalHistory.map((sig) => (
                <div
                  key={sig.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        sig.side === "BUY"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {sig.side}
                    </span>
                    <div>
                      <p className="text-sm text-white font-mono">
                        {sig.entry.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-500">{sig.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">
                      {sig.confidence}%
                    </span>
                    <p
                      className={`text-[10px] font-medium ${
                        sig.status === "EXECUTED"
                          ? "text-green-400"
                          : sig.status === "APPROVED" || sig.status === "PENDING"
                          ? "text-blue-400"
                          : "text-red-400"
                      }`}
                    >
                      {sig.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
