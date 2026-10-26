import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Package,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { listIntakes } from "@/api/intakes";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "submitted") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (s === "ai_analyzed") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (s.includes("pickup") || s.includes("scheduled"))
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

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "AI_ANALYZED", label: "AI Analyzed" },
  { value: "PICKUP_SCHEDULED", label: "Pickup Scheduled" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "ARRIVED_AT_SORTER", label: "At Sorter" },
  { value: "SORTED_VERIFIED", label: "Sorted & Verified" },
  { value: "SETTLED", label: "Settled" },
  { value: "REJECTED", label: "Rejected" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const SupplierBatchListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const categoryId = searchParams.get("category_id") ?? "";
  const fromDate = searchParams.get("from_date") ?? "";
  const toDate = searchParams.get("to_date") ?? "";
  const pageStr = searchParams.get("page") ?? "1";
  const page = Math.max(1, parseInt(pageStr, 10));
  const offset = (page - 1) * PAGE_SIZE;

  const queryParams = {
    status: status || undefined,
    category_id: categoryId ? parseInt(categoryId, 10) : undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["intakes", "list", queryParams],
    queryFn: () => listIntakes(queryParams),
    keepPreviousData: true,
  } as any);

  const batches = (data as any)?.items ?? [];
  const total: number = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page"); // reset to page 1 on filter change
      return next;
    });
  }

  function goToPage(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(p));
      return next;
    });
  }

  const categoryOptions = Object.values(WASTE_CATEGORY_MAP).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-brand-400" />
            My Waste Batches
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {total > 0 ? `${total} batch${total !== 1 ? "es" : ""} found` : "No batches match current filters"}
          </p>
        </div>
        <Link
          to="/intake"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <UploadCloud className="h-4 w-4" />
          New Batch
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 border border-white/10">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Status */}
          <select
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Category */}
          <select
            value={categoryId}
            onChange={(e) => setParam("category_id", e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Categories</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* From date */}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setParam("from_date", e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500 [color-scheme:dark]"
            placeholder="From date"
          />

          {/* To date */}
          <input
            type="date"
            value={toDate}
            onChange={(e) => setParam("to_date", e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500 [color-scheme:dark]"
            placeholder="To date"
          />
        </div>
        {(status || categoryId || fromDate || toDate) && (
          <button
            onClick={() => setSearchParams({})}
            className="mt-3 text-xs text-slate-400 hover:text-white underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 border-b border-white/5 flex gap-4">
              <div className="h-4 bg-slate-700 rounded w-1/5" />
              <div className="h-4 bg-slate-800 rounded w-1/4" />
              <div className="h-4 bg-slate-800 rounded w-1/6" />
              <div className="h-4 bg-slate-800 rounded w-1/6" />
              <div className="h-4 bg-slate-700 rounded w-1/5" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-slate-300">Failed to load batches.</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-xl text-sm hover:bg-brand-500/30"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : batches.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 border border-white/10 flex flex-col items-center gap-4">
          <Package className="h-12 w-12 text-slate-600" />
          <p className="text-lg font-semibold text-slate-300">No batches found</p>
          <p className="text-sm text-slate-500">Try changing the filters or submit a new batch.</p>
          <Link
            to="/intake"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-xl text-sm hover:bg-brand-500/30"
          >
            <UploadCloud className="h-4 w-4" />
            Submit new batch
          </Link>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] px-6 py-3 border-b border-white/10 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Batch Code</span>
            <span>Category</span>
            <span>Declared (kg)</span>
            <span>Verified (kg)</span>
            <span>Status</span>
            <span>Submitted</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {batches.map((batch: any) => (
              <button
                key={batch.id}
                onClick={() => navigate(`/dashboard/batches/${batch.id}`)}
                className="w-full lg:grid lg:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-2 hover:bg-white/5 transition-colors text-left"
              >
                <span className="font-mono font-bold text-white text-sm">{batch.batch_code}</span>
                <span className="text-sm text-slate-300">{batch.category.name}</span>
                <span className="text-sm text-slate-200 font-medium">
                  {batch.declared_weight_kg}
                </span>
                <span className="text-sm text-slate-400">
                  {batch.verified_weight_kg ?? "—"}
                </span>
                <span
                  className={`inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full border w-fit ${statusBadgeClass(batch.status)}`}
                >
                  {formatStatus(batch.status)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(batch.created_at).toLocaleDateString("en-IN")}
                </span>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Back */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
