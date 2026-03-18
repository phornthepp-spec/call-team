import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Shield,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  Square,
} from "lucide-react";
import StatsCard from "../components/StatsCard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import api from "../lib/api";

const statusConfig = {
  READY: { color: "bg-green-500", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  BLOCKED: { color: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  PAUSED: { color: "bg-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
};

interface AutoTradeStatus {
  enabled: boolean;
  running: boolean;
  cycle_count: number;
  signals_evaluated: number;
  trades_executed: number;
  trades_skipped: number;
  last_evaluation_at: string | null;
  last_trade_at: string | null;
  last_error: string | null;
}

interface OverviewData {
  balance: number;
  equity: number;
  free_margin: number;
  floating_pl: number;
  pnl_today: number;
  trades_today: number;
  wins_today: number;
  losses_today: number;
  risk_used_pct: number;
  max_risk_pct: number;
  system_status: "READY" | "BLOCKED" | "PAUSED";
  auto_trade_running: boolean;
}

interface EquityPoint {
  time: string;
  equity: number;
}

interface RecentSignal {
  id: number;
  time: string;
  symbol: string;
  side: string;
  entry: number;
  confidence: number;
  status: string;
}

interface OpenPosition {
  ticket: number;
  symbol: string;
  side: string;
  volume: number;
  price_open: number;
  current_price: number;
  floating_pl: number;
  sl: number;
  tp: number;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [equityData, setEquityData] = useState<EquityPoint[]>([]);
  const [recentSignals, setRecentSignals] = useState<RecentSignal[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [autoStatus, setAutoStatus] = useState<AutoTradeStatus | null>(null);

  // Fetch all dashboard data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [overviewRes, equityRes, signalsRes, positionsRes] = await Promise.allSettled([
          api.get("/dashboard/overview"),
          api.get("/dashboard/equity-curve?hours=24"),
          api.get("/dashboard/recent-trades?limit=5"),
          api.get("/orders/positions"),
        ]);

        if (overviewRes.status === "fulfilled") setOverview(overviewRes.value.data);
        if (equityRes.status === "fulfilled") setEquityData(equityRes.value.data);
        if (signalsRes.status === "fulfilled") setRecentSignals(signalsRes.value.data);
        if (positionsRes.status === "fulfilled") setPositions(positionsRes.value.data);
      } catch {
        // ignore
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  // Poll auto-trade status every 5 seconds
  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/auto-trade/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setAutoStatus(data);
        })
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickStop = async () => {
    try {
      await fetch("/api/auto-trade/stop", { method: "POST" });
      setAutoStatus((prev) => prev ? { ...prev, running: false, enabled: false } : prev);
    } catch {
      // ignore
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString();
  };

  const systemStatus = overview?.system_status || "READY";
  const statusStyle = statusConfig[systemStatus];

  // Equity change
  const equityChange = equityData.length >= 2
    ? equityData[equityData.length - 1].equity - equityData[0].equity
    : 0;

  // Format equity data time for chart display
  const chartData = equityData.map((d) => ({
    ...d,
    time: new Date(d.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            XAUUSD Trading Overview {autoStatus?.running ? "-- Auto" : "-- Live"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {autoStatus?.running && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-blue-500/10 border-blue-500/20">
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium text-blue-400">AUTO</span>
            </div>
          )}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusStyle.bg} ${statusStyle.border}`}
          >
            <div className={`w-2 h-2 rounded-full ${statusStyle.color} animate-pulse`} />
            <span className={`text-sm font-medium ${statusStyle.text}`}>
              {systemStatus}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-sm">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          icon={DollarSign}
          label="Balance"
          value={`$${(overview?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          iconColor="text-blue-400"
        />
        <StatsCard
          icon={TrendingUp}
          label="Equity"
          value={`$${(overview?.equity ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          change={overview?.floating_pl !== undefined ? `${overview.floating_pl >= 0 ? "+" : ""}$${overview.floating_pl.toFixed(2)}` : undefined}
          changeType={overview?.floating_pl !== undefined ? (overview.floating_pl >= 0 ? "up" : "down") : undefined}
          iconColor="text-green-400"
        />
        <StatsCard
          icon={DollarSign}
          label="Free Margin"
          value={`$${(overview?.free_margin ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          iconColor="text-slate-400"
        />
        <StatsCard
          icon={Activity}
          label="P/L Today"
          value={`${(overview?.pnl_today ?? 0) >= 0 ? "+" : ""}$${(overview?.pnl_today ?? 0).toFixed(2)}`}
          changeType={(overview?.pnl_today ?? 0) >= 0 ? "up" : "down"}
          iconColor={(overview?.pnl_today ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
        />
        <StatsCard
          icon={BarChart3}
          label="Trades Today"
          value={String(overview?.trades_today ?? 0)}
          change={`${overview?.wins_today ?? 0}W / ${overview?.losses_today ?? 0}L`}
          changeType="neutral"
          iconColor="text-yellow-400"
        />
        <StatsCard
          icon={Shield}
          label="Risk Used"
          value={`${(overview?.risk_used_pct ?? 0).toFixed(1)}%`}
          change={`of ${overview?.max_risk_pct ?? 0}%`}
          changeType="neutral"
          iconColor="text-purple-400"
        />
      </div>

      {/* Auto-Trade Monitor */}
      {autoStatus && (autoStatus.running || autoStatus.trades_executed > 0) && (
        <div className="bg-slate-800 border border-blue-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <h3 className="text-white font-semibold">Auto-Trade Monitor</h3>
              {autoStatus.running ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-medium text-blue-400">RUNNING</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-700/50 border border-slate-600/50">
                  <span className="text-[10px] font-medium text-slate-400">STOPPED</span>
                </span>
              )}
            </div>
            {autoStatus.running && (
              <button
                onClick={handleQuickStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cycles</p>
              <p className="text-lg font-bold text-white mt-1">{autoStatus.cycle_count}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Evaluated</p>
              <p className="text-lg font-bold text-white mt-1">{autoStatus.signals_evaluated}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Executed</p>
              <p className="text-lg font-bold text-green-400 mt-1">{autoStatus.trades_executed}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Skipped</p>
              <p className="text-lg font-bold text-slate-300 mt-1">{autoStatus.trades_skipped}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Last Eval</p>
              <p className="text-sm font-medium text-slate-300 mt-1">{formatTime(autoStatus.last_evaluation_at)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Last Trade</p>
              <p className="text-sm font-medium text-slate-300 mt-1">{formatTime(autoStatus.last_trade_at)}</p>
            </div>
          </div>
          {autoStatus.last_error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">
                <span className="font-medium">Last error:</span> {autoStatus.last_error}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Charts + Signals Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Equity Chart */}
        <div className="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Equity Curve</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 24 hours</p>
            </div>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${equityChange >= 0 ? "text-green-400" : "text-red-400"}`}>
              {equityChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {equityChange >= 0 ? "+" : ""}${equityChange.toFixed(2)}
            </div>
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <YAxis
                    domain={["dataMin - 50", "dataMax + 50"]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickFormatter={(val: number) => `$${val.toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "13px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Equity"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#3b82f6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No equity data yet. Start auto-trade to begin tracking.
              </div>
            )}
          </div>
        </div>

        {/* Recent Signals */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Recent Signals</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest evaluations</p>
            </div>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="space-y-3">
            {recentSignals.length > 0 ? recentSignals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                      signal.side === "BUY"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {signal.side === "BUY" ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          signal.side === "BUY"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {signal.side}
                      </span>
                      <span className="text-xs text-slate-400">
                        @ {signal.entry.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {signal.time ? new Date(signal.time).toLocaleTimeString() : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-300">
                    {signal.confidence}%
                  </div>
                  <span
                    className={`text-[10px] font-medium ${
                      signal.status === "EXECUTED"
                        ? "text-green-400"
                        : signal.status === "APPROVED"
                        ? "text-blue-400"
                        : "text-red-400"
                    }`}
                  >
                    {signal.status}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center text-slate-500 text-sm py-8">
                No signals yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Open Positions Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Open Positions</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {positions.length} active trade{positions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Volume</th>
                <th>Entry</th>
                <th>Current</th>
                <th>P/L</th>
                <th>SL</th>
                <th>TP</th>
              </tr>
            </thead>
            <tbody>
              {positions.length > 0 ? positions.map((pos) => (
                <tr key={pos.ticket}>
                  <td className="text-slate-300 font-mono text-xs">
                    #{pos.ticket}
                  </td>
                  <td className="text-white font-medium">{pos.symbol}</td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                        pos.side === "BUY"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {pos.side === "BUY" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {pos.side}
                    </span>
                  </td>
                  <td className="text-slate-300">{pos.volume.toFixed(2)}</td>
                  <td className="text-slate-300 font-mono">
                    {pos.price_open.toFixed(2)}
                  </td>
                  <td className="text-white font-mono font-medium">
                    {pos.current_price.toFixed(2)}
                  </td>
                  <td
                    className={`font-medium font-mono ${
                      pos.floating_pl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {pos.floating_pl >= 0 ? "+" : ""}${pos.floating_pl.toFixed(2)}
                  </td>
                  <td className="text-red-400/70 font-mono text-xs">
                    {pos.sl.toFixed(2)}
                  </td>
                  <td className="text-green-400/70 font-mono text-xs">
                    {pos.tp.toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="text-center text-slate-500 py-8">
                    No open positions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
