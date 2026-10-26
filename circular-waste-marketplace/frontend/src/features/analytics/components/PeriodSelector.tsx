import React from "react";
import type { AnalyticsPeriod } from "@/api/types";

export interface PeriodSelectorProps {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
}

const OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Analytics time period"
      className="inline-flex items-center rounded-xl bg-slate-900/90 border border-slate-800 p-1 gap-1"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default PeriodSelector;
