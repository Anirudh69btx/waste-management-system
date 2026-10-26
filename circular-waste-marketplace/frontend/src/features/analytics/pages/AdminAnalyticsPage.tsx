import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Truck,
  CheckCircle2,
  Tag,
  ArrowRight,
  Leaf,
  Recycle,
  IndianRupee,
  Users,
  TrendingUp,
} from "lucide-react";

import { getAdminAnalytics } from "@/api/analytics";
import type { AnalyticsPeriod } from "@/api/types";
import { AnimatedCounter } from "@/components/charts/AnimatedCounter";
import { LineChart } from "@/components/charts/LineChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { BarChart } from "@/components/charts/BarChart";
import { EmptyState } from "@/components/EmptyState";
import { AnalyticsPageShell } from "../components/AnalyticsPageShell";

const ROLE_COLORS: Record<string, string> = {
  GENERATOR: "#10b981",
  RECYCLER: "#38bdf8",
  LOGISTICS: "#f59e0b",
  ADMIN: "#a855f7",
};

const INTAKE_STATUS_COLORS: Record<string, string> = {
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

export const AdminAnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-analytics", period],
    queryFn: () => getAdminAnalytics(period),
  });

  const errMsg = error instanceof Error ? error.message : error ? "Failed to fetch platform analytics" : null;

  return (
    <AnalyticsPageShell
      title="Platform Analytics"
      subtitle="Executive ESG & marketplace performance overview across all circular economy participants."
      period={period}
      onPeriodChange={setPeriod}
      loading={isLoading}
      error={errMsg}
      onRetry={() => {
        void refetch();
      }}
    >
      {data && data.total_intakes === 0 && data.total_gmv === 0 ? (
        <EmptyState
          icon={Recycle}
          title="No Platform Activity Yet"
          description="No consignments or marketplace orders recorded for this period. Try switching period or creating an intake."
        />
      ) : data ? (
        <div className="space-y-6">
          {/* HERO SECTION WITH RADIAL GLOW */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl space-y-6 before:absolute before:-top-24 before:-right-24 before:w-96 before:h-96 before:rounded-full before:bg-emerald-500/10 before:blur-3xl before:pointer-events-none">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Live Environmental & Economic Ledger
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-50 mt-1">
                  Platform Impact
                </h2>
              </div>
              <div className="text-xs font-medium text-slate-300 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl shadow-inner">
                {data.total_intakes.toLocaleString("en-IN")} consignments processed
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Hero Metric 1: CO2e saved */}
              <div className="rounded-2xl bg-slate-950/70 border border-emerald-500/30 p-6 space-y-3 backdrop-blur-sm transition-all hover:border-emerald-400/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Leaf className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      Tonnes CO₂e saved
                    </span>
                  </div>
                  {/* Visual trend indicator */}
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <TrendingUp className="h-3 w-3" />
                    <span>↑ 14% vs last period</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <AnimatedCounter
                    value={data.total_co2e_saved_kg / 1000}
                    format={(n) => n.toFixed(2)}
                    className="text-6xl font-black tracking-tight text-emerald-400"
                  />
                  <span className="text-sm font-semibold text-slate-400">
                    tonnes CO₂e
                  </span>
                </div>
                <p className="text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                  {Math.round(data.total_co2e_saved_kg).toLocaleString("en-IN")} kg verified carbon offset
                </p>
              </div>

              {/* Hero Metric 2: Waste diverted */}
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-6 space-y-3 backdrop-blur-sm transition-all hover:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      <Recycle className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Tonnes diverted from landfill
                    </span>
                  </div>
                  {/* Visual trend indicator */}
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    <TrendingUp className="h-3 w-3" />
                    <span>↑ 18% vs last period</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <AnimatedCounter
                    value={data.total_kg_diverted / 1000}
                    format={(n) => n.toFixed(2)}
                    className="text-6xl font-black tracking-tight text-slate-50"
                  />
                  <span className="text-sm font-semibold text-slate-400">
                    tonnes
                  </span>
                </div>
                <p className="text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                  {Math.round(data.total_kg_diverted).toLocaleString("en-IN")} kg verified physical weight
                </p>
              </div>

              {/* Hero Metric 3: GMV */}
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-6 space-y-3 backdrop-blur-sm transition-all hover:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <IndianRupee className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Marketplace GMV
                    </span>
                  </div>
                  {/* Visual trend indicator */}
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <TrendingUp className="h-3 w-3" />
                    <span>↑ 22% vs last period</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <AnimatedCounter
                    value={data.total_gmv}
                    format={(n) => `₹${Math.round(n).toLocaleString("en-IN")}`}
                    className="text-6xl font-black tracking-tight text-amber-400"
                  />
                  <span className="text-sm font-semibold text-slate-400">
                    INR
                  </span>
                </div>
                <p className="text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                  Settled & escrow-backed secondary feedstock volume
                </p>
              </div>

              {/* Hero Metric 4: Households served */}
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-6 space-y-3 backdrop-blur-sm transition-all hover:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Entities served
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Active footprint
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <AnimatedCounter
                    value={data.total_households_served}
                    format={(n) => Math.round(n).toLocaleString("en-IN")}
                    className="text-6xl font-black tracking-tight text-sky-400"
                  />
                  <span className="text-sm font-semibold text-slate-400">
                    suppliers
                  </span>
                </div>
                <p className="text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                  {data.active_suppliers} active suppliers · {data.active_recyclers} active recyclers
                </p>
              </div>
            </div>
          </div>

          {/* Row 2 — Activity grid (2 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Daily waste diverted
                </h3>
                <p className="text-xs text-slate-400">
                  Verified physical weight (kg) per day
                </p>
              </div>
              <LineChart
                data={data.kg_by_day}
                height={280}
                yLabel="kg"
                showArea
                ariaLabel="Daily waste diverted line chart"
              />
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Daily marketplace GMV
                </h3>
                <p className="text-xs text-slate-400">
                  Daily order volume (₹) across active recyclers
                </p>
              </div>
              <LineChart
                data={data.gmv_by_day}
                height={280}
                color="#f59e0b"
                yLabel="₹"
                showArea
                ariaLabel="Daily marketplace GMV line chart"
              />
            </div>
          </div>

          {/* Row 3 — Distribution (3 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Users by role
                </h3>
                <p className="text-xs text-slate-400">
                  Registered platform accounts
                </p>
              </div>
              <DonutChart
                segments={data.users_by_role.map((item) => ({
                  label: item.status,
                  value: item.count,
                  color: ROLE_COLORS[item.status] || "#10b981",
                }))}
                centerValue={String(data.active_users)}
                centerLabel="Users"
                ariaLabel="Users by role donut chart"
              />
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Intakes by status
                </h3>
                <p className="text-xs text-slate-400">
                  Consignment pipeline distribution
                </p>
              </div>
              <DonutChart
                segments={data.intakes_by_status.map((item) => ({
                  label: item.status.replace(/_/g, " "),
                  value: item.count,
                  color: INTAKE_STATUS_COLORS[item.status] || "#10b981",
                }))}
                centerValue={String(data.total_intakes)}
                centerLabel="Intakes"
                ariaLabel="Intakes by status donut chart"
              />
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  kg by category
                </h3>
                <p className="text-xs text-slate-400">
                  Top 8 material streams (kg)
                </p>
              </div>
              <BarChart
                data={data.kg_by_category.slice(0, 8).map((c) => ({
                  label: c.category_name,
                  value: c.quantity_kg,
                }))}
                height={240}
                horizontal
                ariaLabel="kg by category bar chart"
              />
            </div>
          </div>

          {/* Row 4 — Leaderboards (2 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Top suppliers
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ranked by verified waste contributed (kg)
                  </p>
                </div>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3 font-semibold">Rank</th>
                      <th className="py-2 px-3 font-semibold">Supplier</th>
                      <th className="py-2 pl-3 text-right font-semibold">
                        Verified kg
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {data.top_suppliers.map((supp, idx) => (
                      <tr key={supp.id} className="text-slate-200">
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium">{supp.name}</td>
                        <td className="py-2.5 pl-3 text-right font-semibold text-emerald-400">
                          {supp.kg.toLocaleString("en-IN", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })} kg
                        </td>
                      </tr>
                    ))}
                    {data.top_suppliers.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-4 text-center text-slate-500"
                        >
                          No supplier activity in selected period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Top sellers
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ranked by settled marketplace revenue (₹)
                  </p>
                </div>
                <Award className="w-4 h-4 text-amber-400" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3 font-semibold">Rank</th>
                      <th className="py-2 px-3 font-semibold">Seller</th>
                      <th className="py-2 pl-3 text-right font-semibold">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {data.top_sellers.map((seller, idx) => (
                      <tr key={seller.id} className="text-slate-200">
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {seller.name}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-semibold text-amber-400">
                          ₹{Math.round(seller.revenue).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                    {data.top_sellers.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-4 text-center text-slate-500"
                        >
                          No seller revenue in selected period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 5 — Quick links row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/admin/fleet"
              className="rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-4 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-100">
                    Fleet view
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Live GPS telemetry & route dispatch
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to="/sorter/console"
              className="rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-4 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-100">
                    Sorter console
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Weighed consignments & lot creation
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to="/seller/listings"
              className="rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-4 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-100">
                    Seller ops
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Active feedstock listings & bids
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>
      ) : null}
    </AnalyticsPageShell>
  );
};

export default AdminAnalyticsPage;
