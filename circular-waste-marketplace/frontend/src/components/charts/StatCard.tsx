import React, { type ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  trend?: {
    delta: number;
    direction: "up" | "down" | "flat";
  };
  icon?: ReactNode;
  accent?: "brand" | "amber" | "blue" | "emerald";
  subtext?: string;
}

const ACCENT_STYLES: Record<
  NonNullable<StatCardProps["accent"]>,
  { border: string; iconBg: string; iconText: string; valueText: string }
> = {
  brand: {
    border: "border-emerald-500/30 hover:border-emerald-500/50",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    iconText: "text-emerald-400",
    valueText: "text-slate-50",
  },
  emerald: {
    border: "border-emerald-500/40 hover:border-emerald-400/60",
    iconBg: "bg-emerald-500/15 border-emerald-500/30",
    iconText: "text-emerald-400",
    valueText: "text-emerald-400",
  },
  amber: {
    border: "border-amber-500/30 hover:border-amber-500/50",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconText: "text-amber-400",
    valueText: "text-slate-50",
  },
  blue: {
    border: "border-sky-500/30 hover:border-sky-500/50",
    iconBg: "bg-sky-500/10 border-sky-500/20",
    iconText: "text-sky-400",
    valueText: "text-slate-50",
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  trend,
  icon,
  accent = "brand",
  subtext,
}) => {
  const styles = ACCENT_STYLES[accent];

  return (
    <div
      className={`rounded-2xl bg-slate-900/80 border p-5 transition-all shadow-lg ${styles.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon && (
          <div
            className={`p-2 rounded-xl border ${styles.iconBg} ${styles.iconText}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className={`text-4xl font-bold tracking-tight ${styles.valueText}`}>
          {value}
        </div>
        {unit && (
          <span className="text-sm font-medium text-slate-400">{unit}</span>
        )}
      </div>

      {(trend || subtext) && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          {trend ? (
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                trend.direction === "up"
                  ? "text-emerald-400"
                  : trend.direction === "down"
                  ? "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {trend.direction === "up" && <ArrowUpRight className="w-3.5 h-3.5" />}
              {trend.direction === "down" && <ArrowDownRight className="w-3.5 h-3.5" />}
              {trend.direction === "flat" && <Minus className="w-3.5 h-3.5" />}
              {Math.abs(trend.delta).toFixed(1)}%
            </span>
          ) : (
            <span />
          )}
          {subtext && <span className="text-slate-400 truncate">{subtext}</span>}
        </div>
      )}
    </div>
  );
};

export default StatCard;
