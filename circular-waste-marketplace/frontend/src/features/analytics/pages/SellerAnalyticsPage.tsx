import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  Scale,
  Boxes,
  Percent,
  ArrowRight,
  Gavel,
  Truck,
} from "lucide-react";

import { getSellerAnalytics } from "@/api/analytics";
import type { AnalyticsPeriod } from "@/api/types";
import { StatCard } from "@/components/charts/StatCard";
import { AnimatedCounter } from "@/components/charts/AnimatedCounter";
import { LineChart } from "@/components/charts/LineChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { BarChart } from "@/components/charts/BarChart";
import { AnalyticsPageShell } from "../components/AnalyticsPageShell";

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending_payment: "#64748b",
  escrow_held: "#38bdf8",
  confirmed: "#0ea5e9",
  shipped: "#8b5cf6",
  delivered: "#14b8a6",
  completed: "#10b981",
  cancelled: "#ef4444",
  refunded: "#f43f5e",
};

export const SellerAnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["seller-analytics", period],
    queryFn: () => getSellerAnalytics(period),
  });

  const errMsg = error instanceof Error ? error.message : error ? "Failed to fetch seller analytics" : null;

  const totalOrdersCount =
    data?.orders_by_status.reduce((sum, item) => sum + item.count, 0) ?? 0;

  return (
    <AnalyticsPageShell
      title="Seller Analytics"
      subtitle="Monitor feedstock sales revenue, inventory lot turnover, and marketplace order fulfillment."
      period={period}
      onPeriodChange={setPeriod}
      loading={isLoading}
      error={errMsg}
      onRetry={() => {
        void refetch();
      }}
    >
      {data && (
        <div className="space-y-6">
          {/* Row 1 — 4 stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Revenue"
              value={
                <AnimatedCounter
                  value={data.total_revenue}
                  format={(n) => `₹${Math.round(n).toLocaleString("en-IN")}`}
                />
              }
              icon={<IndianRupee className="w-4 h-4" />}
              accent="brand"
              subtext={`Period: ₹${Math.round(data.revenue_this_period).toLocaleString("en-IN")}`}
            />
            <StatCard
              label="Sold kg"
              value={<AnimatedCounter value={data.sold_kg} />}
              unit="kg"
              icon={<Scale className="w-4 h-4" />}
              accent="emerald"
              subtext={`${data.total_lots_created} lots created`}
            />
            <StatCard
              label="Inventory Available"
              value={<AnimatedCounter value={data.available_kg} />}
              unit="kg"
              icon={<Boxes className="w-4 h-4" />}
              accent="blue"
              subtext={`reserved: ${data.reserved_kg.toLocaleString("en-IN")} kg`}
            />
            <StatCard
              label="Bid Acceptance Rate"
              value={
                <AnimatedCounter
                  value={data.bid_acceptance_rate}
                  format={(n) => `${n.toFixed(1)}%`}
                />
              }
              icon={<Percent className="w-4 h-4" />}
              accent="amber"
              subtext={`${data.pending_bids} pending bids`}
            />
          </div>

          {/* Row 2 — 2 columns (2/3 LineChart + 1/3 DonutChart) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Revenue by Day
                </h2>
                <p className="text-xs text-slate-400">
                  Daily settled & escrow-backed revenue (₹)
                </p>
              </div>
              <LineChart
                data={data.revenue_by_day}
                height={280}
                yLabel="₹"
                showArea
                ariaLabel="Daily seller revenue line chart"
              />
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-between space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Orders by Status
                </h2>
                <p className="text-xs text-slate-400">
                  Purchase order breakdown
                </p>
              </div>
              <DonutChart
                segments={data.orders_by_status.map((item) => ({
                  label: item.status.replace(/_/g, " "),
                  value: item.count,
                  color: ORDER_STATUS_COLORS[item.status] || "#10b981",
                }))}
                centerValue={String(totalOrdersCount)}
                centerLabel="Orders"
                ariaLabel="Orders by status donut chart"
              />
            </div>
          </div>

          {/* Row 3 — 2 columns (BarChart + Operations card) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  kg Sold by Category
                </h2>
                <p className="text-xs text-slate-400">
                  Feedstock volume sold per category
                </p>
              </div>
              <BarChart
                data={data.kg_sold_by_category.map((c) => ({
                  label: c.category_name,
                  value: c.quantity_kg,
                }))}
                height={260}
                ariaLabel="kg sold by category bar chart"
              />
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Operations
                </h2>

                <div className="space-y-3">
                  <Link
                    to="/seller/bids"
                    className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs text-slate-300">
                      <Gavel className="w-3.5 h-3.5 text-amber-400" />
                      Pending bids
                    </span>
                    <span className="text-sm font-bold text-amber-400">
                      {data.pending_bids}
                    </span>
                  </Link>

                  <Link
                    to="/seller/orders"
                    className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs text-slate-300">
                      <Truck className="w-3.5 h-3.5 text-sky-400" />
                      Open orders
                    </span>
                    <span className="text-sm font-bold text-sky-400">
                      {data.open_orders}
                    </span>
                  </Link>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Avg sale price
                    </span>
                    <span className="text-sm font-bold text-slate-100">
                      ₹{data.avg_sale_price_per_kg.toFixed(2)}/kg
                    </span>
                  </div>
                </div>
              </div>

              <Link
                to="/seller/inventory"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-colors"
              >
                <span>Create listing →</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </AnalyticsPageShell>
  );
};

export default SellerAnalyticsPage;
