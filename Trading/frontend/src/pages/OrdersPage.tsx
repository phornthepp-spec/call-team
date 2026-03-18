import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  X,
  Clock,
  ListOrdered,
  History,
} from "lucide-react";

type Tab = "open" | "history";

// Mock open positions
const openPositions = [
  {
    ticket: 1847201,
    symbol: "XAUUSD",
    side: "BUY" as const,
    volume: 0.05,
    entry: 2385.50,
    current: 2391.20,
    pl: 28.50,
    sl: 2379.00,
    tp: 2399.00,
    openTime: "2026-03-18 13:28",
  },
  {
    ticket: 1847195,
    symbol: "XAUUSD",
    side: "SELL" as const,
    volume: 0.03,
    entry: 2392.30,
    current: 2391.20,
    pl: 3.30,
    sl: 2398.80,
    tp: 2380.00,
    openTime: "2026-03-18 12:45",
  },
  {
    ticket: 1847188,
    symbol: "XAUUSD",
    side: "BUY" as const,
    volume: 0.08,
    entry: 2370.25,
    current: 2391.20,
    pl: 167.60,
    sl: 2363.50,
    tp: 2385.00,
    openTime: "2026-03-18 09:45",
  },
];

// Mock order history
const orderHistory = [
  {
    ticket: 1847180,
    symbol: "XAUUSD",
    side: "SELL" as const,
    volume: 0.05,
    entry: 2405.80,
    exit: 2390.75,
    pl: 75.25,
    duration: "2h 15m",
    closeTime: "2026-03-17 16:30",
  },
  {
    ticket: 1847175,
    symbol: "XAUUSD",
    side: "BUY" as const,
    volume: 0.03,
    entry: 2378.40,
    exit: 2395.20,
    pl: 50.40,
    duration: "1h 42m",
    closeTime: "2026-03-17 14:15",
  },
  {
    ticket: 1847170,
    symbol: "XAUUSD",
    side: "SELL" as const,
    volume: 0.05,
    entry: 2410.00,
    exit: 2415.50,
    pl: -27.50,
    duration: "45m",
    closeTime: "2026-03-17 12:30",
  },
  {
    ticket: 1847165,
    symbol: "XAUUSD",
    side: "BUY" as const,
    volume: 0.04,
    entry: 2365.70,
    exit: 2382.10,
    pl: 65.60,
    duration: "3h 20m",
    closeTime: "2026-03-17 10:45",
  },
  {
    ticket: 1847160,
    symbol: "XAUUSD",
    side: "BUY" as const,
    volume: 0.06,
    entry: 2355.20,
    exit: 2348.90,
    pl: -37.80,
    duration: "1h 05m",
    closeTime: "2026-03-16 15:20",
  },
  {
    ticket: 1847155,
    symbol: "XAUUSD",
    side: "SELL" as const,
    volume: 0.05,
    entry: 2420.50,
    exit: 2405.30,
    pl: 76.00,
    duration: "2h 50m",
    closeTime: "2026-03-16 13:10",
  },
  {
    ticket: 1847150,
    symbol: "XAUUSD",
    side: "BUY" as const,
    volume: 0.04,
    entry: 2372.80,
    exit: 2388.40,
    pl: 62.40,
    duration: "4h 15m",
    closeTime: "2026-03-16 10:55",
  },
  {
    ticket: 1847145,
    symbol: "XAUUSD",
    side: "SELL" as const,
    volume: 0.03,
    entry: 2398.60,
    exit: 2402.10,
    pl: -10.50,
    duration: "30m",
    closeTime: "2026-03-15 16:45",
  },
];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("open");

  const handleClosePosition = (ticket: number) => {
    if (window.confirm(`Close position #${ticket}?`)) {
      alert(`Position #${ticket} close request sent.`);
    }
  };

  const totalOpenPL = openPositions.reduce((sum, p) => sum + p.pl, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage positions and view trade history
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
            <p className="text-xs text-slate-400">Open P/L</p>
            <p
              className={`text-lg font-bold font-mono ${
                totalOpenPL >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {totalOpenPL >= 0 ? "+" : ""}${totalOpenPL.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("open")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "open"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          Open Positions
          <span
            className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
              activeTab === "open"
                ? "bg-blue-500/30 text-blue-200"
                : "bg-slate-700 text-slate-400"
            }`}
          >
            {openPositions.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* Open Positions Table */}
      {activeTab === "open" && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Volume</th>
                  <th>Entry Price</th>
                  <th>Current Price</th>
                  <th>P/L</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>Open Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos) => (
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
                      {pos.entry.toFixed(2)}
                    </td>
                    <td className="text-white font-mono font-medium">
                      {pos.current.toFixed(2)}
                    </td>
                    <td
                      className={`font-medium font-mono ${
                        pos.pl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {pos.pl >= 0 ? "+" : ""}${pos.pl.toFixed(2)}
                    </td>
                    <td className="text-red-400/70 font-mono text-xs">
                      {pos.sl.toFixed(2)}
                    </td>
                    <td className="text-green-400/70 font-mono text-xs">
                      {pos.tp.toFixed(2)}
                    </td>
                    <td className="text-slate-400 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {pos.openTime}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => handleClosePosition(pos.ticket)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
                      >
                        <X className="w-3 h-3" />
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {openPositions.length} open position{openPositions.length !== 1 ? "s" : ""}
            </span>
            <span
              className={`text-sm font-medium font-mono ${
                totalOpenPL >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              Total: {totalOpenPL >= 0 ? "+" : ""}${totalOpenPL.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* History Table */}
      {activeTab === "history" && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Volume</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>P/L</th>
                  <th>Duration</th>
                  <th>Close Time</th>
                </tr>
              </thead>
              <tbody>
                {orderHistory.map((order) => (
                  <tr key={order.ticket}>
                    <td className="text-slate-300 font-mono text-xs">
                      #{order.ticket}
                    </td>
                    <td className="text-white font-medium">{order.symbol}</td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                          order.side === "BUY"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {order.side === "BUY" ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {order.side}
                      </span>
                    </td>
                    <td className="text-slate-300">
                      {order.volume.toFixed(2)}
                    </td>
                    <td className="text-slate-300 font-mono">
                      {order.entry.toFixed(2)}
                    </td>
                    <td className="text-slate-300 font-mono">
                      {order.exit.toFixed(2)}
                    </td>
                    <td
                      className={`font-medium font-mono ${
                        order.pl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {order.pl >= 0 ? "+" : ""}${order.pl.toFixed(2)}
                    </td>
                    <td className="text-slate-400 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {order.duration}
                      </div>
                    </td>
                    <td className="text-slate-400 text-xs">
                      {order.closeTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              {orderHistory.length} closed trades
            </span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">
                Win:{" "}
                <span className="text-green-400 font-medium">
                  {orderHistory.filter((o) => o.pl >= 0).length}
                </span>{" "}
                / Loss:{" "}
                <span className="text-red-400 font-medium">
                  {orderHistory.filter((o) => o.pl < 0).length}
                </span>
              </span>
              <span
                className={`text-sm font-medium font-mono ${
                  orderHistory.reduce((s, o) => s + o.pl, 0) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                Total: +$
                {orderHistory.reduce((s, o) => s + o.pl, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
