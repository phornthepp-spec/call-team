import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Zap,
  ListOrdered,
  Shield,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  TrendingUp,
  Bot,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/signals", label: "Signals", icon: Zap },
  { to: "/orders", label: "Orders", icon: ListOrdered },
  { to: "/risk", label: "Risk", icon: Shield },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/allocation", label: "Allocation", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [autoTradeRunning, setAutoTradeRunning] = useState(false);

  useEffect(() => {
    const check = () => {
      fetch("/api/auto-trade/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setAutoTradeRunning(data.running);
        })
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-800 border-r border-slate-700">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            7H Trading
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">
            XAUUSD Terminal
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-5 h-5 ${
                    isActive
                      ? "text-blue-400"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Connection Status */}
      <div className={`px-4 py-3 mx-3 mb-3 rounded-lg border ${
        autoTradeRunning
          ? "bg-blue-500/5 border-blue-500/20"
          : "bg-slate-900/60 border-slate-700"
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {autoTradeRunning ? (
            <>
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-blue-400 font-medium">Auto Mode</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-slate-400">MT5 Connected</span>
            </>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          XAUUSD | M15 | {autoTradeRunning ? "Auto" : "Live"}
        </p>
      </div>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
