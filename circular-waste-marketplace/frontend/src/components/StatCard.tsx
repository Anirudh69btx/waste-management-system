import React from "react";
import clsx from "clsx";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive = true,
  className,
}) => {
  return (
    <div className={clsx("glass-card glass-card-hover rounded-2xl p-6", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-white tracking-tight">{value}</span>
        {trend && (
          <span
            className={clsx(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              trendPositive
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            )}
          >
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
};
