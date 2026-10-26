import React, { type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { AnalyticsPeriod } from "@/api/types";
import { PeriodSelector } from "./PeriodSelector";

export interface AnalyticsPageShellProps {
  title: string;
  subtitle: string;
  period: AnalyticsPeriod;
  onPeriodChange: (p: AnalyticsPeriod) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}

export const AnalyticsPageShell: React.FC<AnalyticsPageShellProps> = ({
  title,
  subtitle,
  period,
  onPeriodChange,
  loading,
  error,
  onRetry,
  children,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      {loading ? (
        <div
          data-testid="analytics-loading-skeleton"
          className="space-y-6 animate-pulse"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-900/80 border border-slate-800"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 rounded-2xl bg-slate-900/80 border border-slate-800" />
            <div className="h-80 rounded-2xl bg-slate-900/80 border border-slate-800" />
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-rose-950/30 border border-rose-500/30 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-rose-200">
                Unable to load analytics
              </h2>
              <p className="mt-1 text-xs text-rose-300/80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold text-rose-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export default AnalyticsPageShell;
