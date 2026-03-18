import {
  BarChart3,
  TrendingUp,
  Target,
  Award,
  TrendingDown,
  Activity,
} from "lucide-react";
import StatsCard from "../components/StatsCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Mock daily P/L data
const dailyPL = [
  { day: "Mar 4", pl: 85 },
  { day: "Mar 5", pl: -32 },
  { day: "Mar 6", pl: 125 },
  { day: "Mar 7", pl: 42 },
  { day: "Mar 10", pl: -18 },
  { day: "Mar 11", pl: 156 },
  { day: "Mar 12", pl: -45 },
  { day: "Mar 13", pl: 210 },
  { day: "Mar 14", pl: 68 },
  { day: "Mar 17", pl: -27 },
  { day: "Mar 18", pl: 312 },
];

// Mock equity history (for AreaChart)
const equityHistory = [
  { date: "Feb 17", equity: 10000 },
  { date: "Feb 19", equity: 10085 },
  { date: "Feb 21", equity: 10053 },
  { date: "Feb 24", equity: 10178 },
  { date: "Feb 26", equity: 10220 },
  { date: "Feb 28", equity: 10202 },
  { date: "Mar 3", equity: 10358 },
  { date: "Mar 5", equity: 10313 },
  { date: "Mar 7", equity: 10480 },
  { date: "Mar 10", equity: 10548 },
  { date: "Mar 12", equity: 10503 },
  { date: "Mar 14", equity: 10713 },
  { date: "Mar 17", equity: 10781 },
  { date: "Mar 18", equity: 10858 },
];

// Mock win/loss pie chart data
const winLossData = [
  { name: "Wins", value: 35, color: "#22c55e" },
  { name: "Losses", value: 15, color: "#ef4444" },
];

// Mock trade direction distribution
const tradeDistribution = [
  { name: "BUY", value: 28, color: "#22c55e" },
  { name: "SELL", value: 22, color: "#ef4444" },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Performance metrics and trade analysis
        </p>
      </div>

      {/* Stats Cards - 6 key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          icon={Target}
          label="Win Rate"
          value="70.0%"
          change="35W / 15L"
          changeType="up"
          iconColor="text-blue-400"
        />
        <StatsCard
          icon={TrendingUp}
          label="Avg Win"
          value="+$42.50"
          change="per trade"
          changeType="up"
          iconColor="text-green-400"
        />
        <StatsCard
          icon={TrendingDown}
          label="Avg Loss"
          value="-$18.30"
          change="per trade"
          changeType="down"
          iconColor="text-red-400"
        />
        <StatsCard
          icon={Activity}
          label="Expectancy"
          value="+$24.46"
          change="per trade"
          changeType="up"
          iconColor="text-yellow-400"
        />
        <StatsCard
          icon={BarChart3}
          label="Max Drawdown"
          value="-2.1%"
          change="-$215.40"
          changeType="down"
          iconColor="text-red-400"
        />
        <StatsCard
          icon={Award}
          label="Profit Factor"
          value="2.35"
          change="above 1.5"
          changeType="up"
          iconColor="text-purple-400"
        />
      </div>

      {/* Equity Curve (AreaChart) */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Equity Curve</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Account equity over time
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
            <TrendingUp className="w-4 h-4" />
            +$858.00 (+8.58%)
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityHistory}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                domain={["dataMin - 100", "dataMax + 100"]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v: number) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString()}`,
                  "Equity",
                ]}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#equityGradient)"
                dot={{ fill: "#3b82f6", r: 3 }}
                activeDot={{ r: 5, fill: "#3b82f6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily P/L Bar Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Daily P/L</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Profit and loss by trading day
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
              <span className="text-slate-400">Profit</span>
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span className="text-slate-400">Loss</span>
            </span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyPL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [
                  `${value >= 0 ? "+" : ""}$${value}`,
                  "P/L",
                ]}
              />
              <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                {dailyPL.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.pl >= 0 ? "#22c55e" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Win/Loss Ratio */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Win / Loss Ratio</h3>
          <div className="flex items-center gap-8">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {winLossData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "13px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {winLossData.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-300">
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  Win Rate:{" "}
                  <span className="text-white font-medium">70.0%</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trade Distribution */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Trade Direction</h3>
          <div className="flex items-center gap-8">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tradeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {tradeDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "13px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {tradeDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-300">
                    {item.name}: {item.value} trades
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  Total:{" "}
                  <span className="text-white font-medium">50 trades</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Detailed Statistics</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Trades", value: "50" },
            { label: "Avg Win", value: "+$42.50" },
            { label: "Avg Loss", value: "-$18.30" },
            { label: "Expectancy", value: "+$24.46" },
            { label: "Largest Win", value: "+$85.00" },
            { label: "Largest Loss", value: "-$35.50" },
            { label: "Avg Duration", value: "47 min" },
            { label: "Max Drawdown", value: "-2.1%" },
            { label: "Profit Factor", value: "2.35" },
            { label: "Sharpe Ratio", value: "1.82" },
            { label: "Commissions", value: "-$14.70" },
            { label: "Net Profit", value: "+$858.00" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50"
            >
              <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
              <p
                className={`text-white font-medium font-mono ${
                  stat.value.startsWith("+")
                    ? "text-green-400"
                    : stat.value.startsWith("-")
                    ? "text-red-400"
                    : "text-white"
                }`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
