import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Scale,
} from "lucide-react";
import { listDisputes } from "@/api/admin";
import type { AdminDispute } from "@/api/types";
import { ResolveDisputeModal } from "../components/ResolveDisputeModal";

type ResolutionTab = "pending" | "upheld" | "rejected" | "all";

const TABS: Array<{ id: ResolutionTab; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "upheld", label: "Upheld" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

const PAGE_SIZE = 20;

export const AdminDisputesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ResolutionTab>("pending");
  const [page, setPage] = useState(1);
  const [selectedDispute, setSelectedDispute] = useState<AdminDispute | null>(
    null
  );

  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin-disputes",
      { resolution: activeTab, limit: PAGE_SIZE, offset },
    ],
    queryFn: () =>
      listDisputes({ resolution: activeTab, limit: PAGE_SIZE, offset }),
  });

  const disputes = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const emptyMessage: Record<ResolutionTab, string> = {
    pending: "No pending disputes",
    upheld: "No upheld disputes",
    rejected: "No rejected disputes",
    all: "No disputes found",
  };

  const refreshDisputes = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-slate-100">
              Weight Disputes
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Supplier-flagged weight tickets awaiting review
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Dispute resolution filter"
        className="inline-flex rounded-2xl border border-slate-800 bg-slate-900/70 p-1"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Loading disputes...
          </div>
        ) : disputes.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            {emptyMessage[activeTab]}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Batch Code</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Declared (kg)</th>
                  <th className="px-4 py-3">Verified (kg)</th>
                  <th className="px-4 py-3">Diff %</th>
                  <th className="px-4 py-3">Dispute Notes</th>
                  <th className="px-4 py-3">Recorded</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {disputes.map((d) => {
                  const diffKg = d.verified_weight_kg - d.declared_weight_kg;
                  const diffPct =
                    d.declared_weight_kg > 0
                      ? ((diffKg / d.declared_weight_kg) * 100).toFixed(1)
                      : "0.0";
                  const isPending = d.dispute_resolution === null;

                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/batches/${d.intake_id}`}
                          className="font-mono text-xs font-bold text-emerald-400 hover:underline"
                        >
                          {d.batch_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {d.supplier_email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-semibold uppercase text-slate-300">
                          <Scale className="h-3 w-3 text-amber-400" />
                          {d.weight_method}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {d.declared_weight_kg.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {d.verified_weight_kg.toFixed(1)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold ${
                            diffKg < 0 ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          {diffKg > 0 ? "+" : ""}
                          {diffPct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <span
                          title={d.dispute_notes}
                          className="block truncate text-xs text-slate-300"
                        >
                          {d.dispute_notes}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(d.recorded_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDispute(d)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
                          >
                            Review
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedDispute(d)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View resolution
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selectedDispute && (
        <ResolveDisputeModal
          open={Boolean(selectedDispute)}
          onClose={() => setSelectedDispute(null)}
          dispute={selectedDispute}
          onResolved={refreshDisputes}
        />
      )}
    </div>
  );
};

export default AdminDisputesPage;
