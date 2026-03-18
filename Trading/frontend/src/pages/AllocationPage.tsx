import { useState } from "react";
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Building2,
  Play,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";
import StatsCard from "../components/StatsCard";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// Mock allocation donut data
const allocationData = [
  { name: "Reserve Fund (50%)", value: 50, amount: 272.50, color: "#3b82f6" },
  { name: "External Invest (30%)", value: 30, amount: 163.50, color: "#8b5cf6" },
  { name: "Reinvest (20%)", value: 20, amount: 109.00, color: "#22c55e" },
];

// Mock monthly allocation bar chart
const monthlyAllocation = [
  { month: "Oct", reserve: 150, external: 90, reinvest: 60 },
  { month: "Nov", reserve: 210, external: 126, reinvest: 84 },
  { month: "Dec", reserve: 180, external: 108, reinvest: 72 },
  { month: "Jan", reserve: 250, external: 150, reinvest: 100 },
  { month: "Feb", reserve: 195, external: 117, reinvest: 78 },
  { month: "Mar", reserve: 272, external: 163, reinvest: 109 },
];

// Mock allocation history with status
const allocationHistory = [
  {
    period: "Mar 10 - Mar 16",
    netProfit: 312.45,
    reserve: 156.23,
    external: 93.74,
    reinvest: 62.49,
    status: "COMPLETED" as const,
  },
  {
    period: "Mar 3 - Mar 9",
    netProfit: 245.80,
    reserve: 122.90,
    external: 73.74,
    reinvest: 49.16,
    status: "COMPLETED" as const,
  },
  {
    period: "Feb 24 - Mar 2",
    netProfit: 189.50,
    reserve: 94.75,
    external: 56.85,
    reinvest: 37.90,
    status: "COMPLETED" as const,
  },
  {
    period: "Feb 17 - Feb 23",
    netProfit: 278.30,
    reserve: 139.15,
    external: 83.49,
    reinvest: 55.66,
    status: "COMPLETED" as const,
  },
  {
    period: "Feb 10 - Feb 16",
    netProfit: 156.00,
    reserve: 78.00,
    external: 46.80,
    reinvest: 31.20,
    status: "COMPLETED" as const,
  },
  {
    period: "Feb 3 - Feb 9",
    netProfit: -42.30,
    reserve: 0,
    external: 0,
    reinvest: 0,
    status: "SKIPPED" as const,
  },
];

export default function AllocationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const totalProfit = 545.00;

  const handleRunAllocation = () => {
    if (
      window.confirm(
        "Run profit allocation for the current period? This will split the net profit according to the 50/30/20 rule."
      )
    ) {
      setIsRunning(true);
      setTimeout(() => {
        setIsRunning(false);
        alert("Allocation completed successfully.");
      }, 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Profit Allocation</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            50% Reserve / 30% External Invest / 20% Reinvest
          </p>
        </div>
        <button
          onClick={handleRunAllocation}
          disabled={isRunning}
          className="btn-primary flex items-center gap-2"
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isRunning ? "Running..." : "Run Allocation"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Wallet}
          label="Net Profit"
          value={`$${totalProfit.toFixed(2)}`}
          change="This period"
          changeType="up"
          iconColor="text-green-400"
        />
        <StatsCard
          icon={PiggyBank}
          label="Reserve Fund"
          value="$272.50"
          change="50%"
          changeType="neutral"
          iconColor="text-blue-400"
        />
        <StatsCard
          icon={Building2}
          label="External Invest"
          value="$163.50"
          change="30%"
          changeType="neutral"
          iconColor="text-purple-400"
        />
        <StatsCard
          icon={TrendingUp}
          label="Reinvest"
          value="$109.00"
          change="20%"
          changeType="neutral"
          iconColor="text-green-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Allocation Donut/Pie */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">
            Current Period Allocation
          </h3>
          <div className="flex items-center gap-8">
            <div className="h-56 w-56 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {allocationData.map((entry, i) => (
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
                    formatter={(value: number) => [`${value}%`, "Share"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4 flex-1">
              {allocationData.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-slate-300">{item.name}</span>
                  </div>
                  <p className="text-lg font-bold text-white ml-5">
                    ${item.amount.toFixed(2)}
                  </p>
                </div>
              ))}
              <div className="pt-3 ml-5 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  Total Net Profit:{" "}
                  <span className="text-green-400 font-medium font-mono">
                    ${totalProfit.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Allocation Stacked Bar */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">
            Monthly Allocation History
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAllocation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
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
                  formatter={(value: number) => [`$${value}`, ""]}
                />
                <Bar
                  dataKey="reserve"
                  stackId="a"
                  fill="#3b82f6"
                  name="Reserve"
                />
                <Bar
                  dataKey="external"
                  stackId="a"
                  fill="#8b5cf6"
                  name="External"
                />
                <Bar
                  dataKey="reinvest"
                  stackId="a"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  name="Reinvest"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            <span className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span className="text-slate-400">Reserve</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              <span className="text-slate-400">External</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
              <span className="text-slate-400">Reinvest</span>
            </span>
          </div>
        </div>
      </div>

      {/* Allocation History Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Allocation History</h3>
          <span className="text-xs text-slate-400">
            {allocationHistory.length} periods
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th>Period</th>
                <th>Net Profit</th>
                <th>Reserve (50%)</th>
                <th>External (30%)</th>
                <th>Reinvest (20%)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allocationHistory.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-slate-300 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {row.period}
                    </div>
                  </td>
                  <td
                    className={`font-mono text-sm font-medium ${
                      row.netProfit >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {row.netProfit >= 0 ? "+" : ""}${row.netProfit.toFixed(2)}
                  </td>
                  <td className="text-blue-400 font-mono text-sm">
                    ${row.reserve.toFixed(2)}
                  </td>
                  <td className="text-purple-400 font-mono text-sm">
                    ${row.external.toFixed(2)}
                  </td>
                  <td className="text-green-400 font-mono text-sm">
                    ${row.reinvest.toFixed(2)}
                  </td>
                  <td>
                    {row.status === "COMPLETED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Completed
                      </span>
                    ) : row.status === "SKIPPED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/15 text-slate-400">
                        Skipped
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Cumulative allocations across all completed periods
          </span>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-blue-400 font-mono font-medium">
              R: $591.03
            </span>
            <span className="text-purple-400 font-mono font-medium">
              E: $354.62
            </span>
            <span className="text-green-400 font-mono font-medium">
              I: $236.41
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
