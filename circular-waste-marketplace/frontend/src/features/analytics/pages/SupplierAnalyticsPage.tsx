import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Scale,
  IndianRupee,
  Leaf,
  Flame,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import { getSupplierAnalytics } from "@/api/analytics";
import type { AnalyticsPeriod } from "@/api/types";
import { StatCard } from "@/components/charts/StatCard";
import { AnimatedCounter } from "@/components/charts/AnimatedCounter";
import { LineChart } from "@/components/charts/LineChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { BarChart } from "@/components/charts/BarChart";
import { AnalyticsPageShell } from "../components/AnalyticsPageShell";

const STATUS_COLORS: Record<string, string> = {
  submitted: "#64748b",
  pickup_requested: "#38bdf8",
  pickup_assigned: "#0ea5e9",
  picked_up: "#8b5cf6",
  weighed: "#f59e0b",
  in_sorting: "#a855f7",
  sorted: "#10b981",
  listed: "#14b8a6",
  sold: "#22c55e",
  cancelled: "#ef4444",
  rejected: "#f43f5e",
};

export const SupplierAnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["supplier-analytics", period],
    queryFn: () => getSupplierAnalytics(period),
  });

  const errMsg = error instanceof Error ? error.message : error ? "Failed to fetch analytics" : null;

  return (
    <AnalyticsPageShell
      title="Supplier Analytics"
      subtitle="Track your waste diversion, verified weights, earnings, and carbon impact."
      period={period}
      onPeriodChange={setPeriod}
      loading={isLoading}
      error={errMsg}
      onRetry={() => {
        void refetch();
      }}
    >
      {!data || data.total_batches === 0 ? (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-12 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">
            No analytics yet
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Once you submit waste batches and they are weighed by our collection team, your earnings and CO₂e metrics will appear here.
          </p>
          <Link
            to="/intake"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            No analytics yet. Submit your first batch →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1 — 4 stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Batches Submitted"
              value={<AnimatedCounter value={data.total_batches} />}
              icon={<Package className="w-4 h-4" />}
              accent="brand"
              subtext={`Declared: ${data.total_declared_kg.toLocaleString("en-IN")} kg`}
            />
            <StatCard
              label="Total kg Verified"
              value={<AnimatedCounter value={data.total_verified_kg} />}
              unit="kg"
              icon={<Scale className="w-4 h-4" />}
              accent="blue"
              subtext={`Avg ${data.avg_kg_per_batch.toLocaleString("en-IN")} kg / batch`}
            />
            <StatCard
              label="Total Earnings"
              value={
                <AnimatedCounter
                  value={data.total_actual_earnings}
                  format={(n) =>
                    `₹${Math.round(n).toLocaleString("en-IN")}`
                  }
                />
              }
              icon={<IndianRupee className="w-4 h-4" />}
              accent="amber"
              subtext={`Est: ₹${Math.round(data.total_estimated_earnings).toLocaleString("en-IN")}`}
            />
            <StatCard
              label="CO₂e Saved"
              value={<AnimatedCounter value={data.total_co2e_saved_kg} />}
              unit="kg"
              icon={<Leaf className="w-4 h-4" />}
              accent="emerald"
              subtext="Verified carbon offset"
            />
          </div>

          {/* Row 2 — 2 columns (2/3 LineChart + 1/3 DonutChart) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Verified Weight Submitted by Day
                </h2>
                <p className="text-xs text-slate-400">
                  Daily verified intake volume (kg)
                </p>
              </div>
              <LineChart
                data={data.kg_by_day}
                height={280}
                yLabel="kg"
                showArea
                ariaLabel="Daily verified kg line chart"
              />
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 flex flex-col justify-between space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Batches by Status
                </h2>
                <p className="text-xs text-slate-400">
                  Current lifecycle distribution
                </p>
              </div>
              <DonutChart
                segments={data.batches_by_status.map((item) => ({
                  label: item.status.replace(/_/g, " "),
                  value: item.count,
                  color: STATUS_COLORS[item.status] || "#10b981",
                }))}
                centerValue={String(data.total_batches)}
                centerLabel="Batches"
                ariaLabel="Batches by status donut chart"
              />
            </div>
          </div>

          {/* Row 3 — 2 columns (BarChart + Your Impact card) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Weight by Material Category
                </h2>
                <p className="text-xs text-slate-400">
                  Top categories contributed (kg)
                </p>
              </div>
              <BarChart
                data={data.kg_by_category.slice(0, 8).map((c) => ({
                  label: c.category_name,
                  value: c.quantity_kg,
                }))}
                height={260}
                ariaLabel="Weight by category bar chart"
              />
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Your Impact
                  </h2>
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Submission streak
                    </span>
                    <span className="text-sm font-bold text-amber-400">
                      {data.submission_streak_days} days
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Avg kg per batch
                    </span>
                    <span className="text-sm font-bold text-slate-100">
                      {data.avg_kg_per_batch.toFixed(1)} kg
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Rejection rate
                    </span>
                    <span className="text-sm font-bold text-slate-100">
                      {data.rejection_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <Link
                to="/intake"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-colors"
              >
                <span>Submit new batch →</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </AnalyticsPageShell>
  );
};

export default SupplierAnalyticsPage;
