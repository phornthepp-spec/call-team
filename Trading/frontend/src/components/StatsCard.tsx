import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  iconColor?: string;
}

export default function StatsCard({
  icon: Icon,
  label,
  value,
  change,
  changeType = "neutral",
  iconColor = "text-blue-400",
}: StatsCardProps) {
  const changeColor =
    changeType === "up"
      ? "text-green-400"
      : changeType === "down"
      ? "text-red-400"
      : "text-slate-400";

  const changeBg =
    changeType === "up"
      ? "bg-green-500/10"
      : changeType === "down"
      ? "bg-red-500/10"
      : "bg-slate-700/50";

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors duration-200">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconColor
            .replace("text-", "bg-")
            .replace("400", "500/15")}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {change && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${changeBg} ${changeColor}`}
          >
            {changeType === "up" && <TrendingUp className="w-3 h-3" />}
            {changeType === "down" && <TrendingDown className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-0.5">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
