import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import {
  Package,
  Scale,
  DollarSign,
  Leaf,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  UploadCloud,
  Calendar,
} from "lucide-react";
import { listIntakes } from "@/api/intakes";
import { listPickups } from "@/api/pickups";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "submitted") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (s === "ai_analyzed") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (s === "pickup_scheduled" || s === "pickup_requested" || s === "pickup_accepted")
    return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  if (s === "in_transit" || s === "picked_up")
    return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  if (s === "arrived_at_sorter" || s === "sorted_verified" || s === "weighed")
    return "bg-teal-500/20 text-teal-300 border-teal-500/30";
  if (s === "settled" || s === "completed")
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (s === "rejected" || s === "cancelled")
    return "bg-red-500/20 text-red-300 border-red-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimatePayout(item: { declared_weight_kg: number; category: { id: number } }): number {
  const entry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === item.category.id);
  if (!entry) return 0;
  return Math.round(entry.rate * item.declared_weight_kg * 0.85);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="glass-card rounded-2xl p-6 border border-white/10 animate-pulse space-y-3">
    <div className="h-3 bg-slate-700 rounded w-2/3" />
    <div className="h-8 bg-slate-700 rounded w-1/3" />
    <div className="h-3 bg-slate-800 rounded w-1/2" />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const SupplierOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data: intakesData,
    isLoading: intakesLoading,
    isError: intakesError,
    refetch: refetchIntakes,
  } = useQuery({
    queryKey: ["intakes", "overview"],
    queryFn: () => listIntakes({ limit: 5 }),
  });

  const {
    data: pickupsData,
    isLoading: pickupsLoading,
    isError: pickupsError,
    refetch: refetchPickups,
  } = useQuery({
    queryKey: ["pickups", "overview"],
    queryFn: () => listPickups({ status: "requested,accepted", limit: 5 }),
  });

  const isLoading = intakesLoading || pickupsLoading;
  const isError = intakesError || pickupsError;

  const batches = intakesData?.items ?? [];
  const pickups = pickupsData?.items ?? [];

  const totalDeclaredWeight = batches.reduce((sum, b) => sum + b.declared_weight_kg, 0);
  const estimatedTotalPayout = batches.reduce((sum, b) => sum + estimatePayout(b), 0);
  // Carbon offset: 0.82 kg CO2e per kg for average mix
  const co2eSaved = batches.reduce((sum, b) => sum + b.declared_weight_kg * 0.82, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="glass-card rounded-2xl p-6 border border-white/10 animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-1/4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-slate-300">Failed to load dashboard data.</p>
        <button
          onClick={() => {
            refetchIntakes();
            refetchPickups();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-xl text-sm hover:bg-brand-500/30 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Supplier Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track your waste batches, pickups, and payouts at a glance.
          </p>
        </div>
        <Link
          to="/intake"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-brand-500/25"
        >
          <UploadCloud className="h-4 w-4" />
          Sell / Donate My Waste
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Batches */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Package className="h-4 w-4 text-brand-400" />
            Total Batches
          </div>
          <div className="text-3xl font-extrabold text-white">
            {intakesData?.total ?? batches.length}
          </div>
          <Link
            to="/dashboard/batches"
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Weight */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Scale className="h-4 w-4 text-blue-400" />
            Declared Weight
          </div>
          <div className="text-3xl font-extrabold text-white">
            {totalDeclaredWeight.toLocaleString()}
            <span className="text-base font-normal text-slate-400 ml-1">kg</span>
          </div>
          <p className="text-xs text-slate-500">Across last 5 batches</p>
        </div>

        {/* Payout */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Est. Payout
          </div>
          <div className="text-3xl font-extrabold text-white">
            ₹{estimatedTotalPayout.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500">At 85% escrow rate</p>
        </div>

        {/* CO2e */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Leaf className="h-4 w-4 text-teal-400" />
            CO₂e Saved
          </div>
          <div className="text-3xl font-extrabold text-white">
            {co2eSaved.toFixed(1)}
            <span className="text-base font-normal text-slate-400 ml-1">kg</span>
          </div>
          <p className="text-xs text-slate-500">Carbon offset estimated</p>
        </div>
      </div>

      {/* Empty state */}
      {batches.length === 0 && (
        <div className="glass-card rounded-2xl p-12 border border-white/10 flex flex-col items-center gap-4">
          <Package className="h-14 w-14 text-slate-600" />
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-300">No batches yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Submit your first waste batch to get started.
            </p>
          </div>
          <Link
            to="/intake"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            Sell / Donate My Waste
          </Link>
        </div>
      )}

      {/* Recent batches */}
      {batches.length > 0 && (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Recent Batches
            </h2>
            <Link
              to="/dashboard/batches"
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => navigate(`/dashboard/batches/${batch.id}`)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-mono font-bold text-white">{batch.batch_code}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{batch.category.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-slate-200">
                      {batch.declared_weight_kg} kg
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(batch.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${statusBadgeClass(batch.status)}`}
                  >
                    {formatStatus(batch.status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming pickups */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-yellow-400" />
            Upcoming Pickups
          </h2>
        </div>
        {pickupsLoading ? (
          <div className="px-6 py-4 text-sm text-slate-400 animate-pulse">Loading pickups…</div>
        ) : pickups.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            No upcoming pickups scheduled.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {pickups.map((pickup) => (
              <div key={pickup.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {pickup.intake_summary?.batch_code ?? pickup.intake_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {pickup.intake_summary?.category_name ?? ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-300">
                    {new Date(pickup.scheduled_start).toLocaleDateString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <span
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${statusBadgeClass(pickup.status)}`}
                  >
                    {formatStatus(pickup.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
