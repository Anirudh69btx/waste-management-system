import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  CheckCircle2,
  Scale,
  Clock,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Filter,
} from "lucide-react";
import { listIntakes } from "@/api/intakes";
import { listSortingRecords } from "@/api/sorting";
import type { WasteIntakeListItem, SortingRecordRead } from "@/api/types";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";
// @ts-ignore - SortIntakeModal component created in Section F
import { SortIntakeModal } from "../components/SortIntakeModal";

export const SorterConsolePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedIntake, setSelectedIntake] = useState<WasteIntakeListItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // TanStack Query: listIntakes with status="weighed"
  const {
    data: intakesData,
    isLoading: intakesLoading,
    isFetching: intakesFetching,
    error: intakesError,
    refetch: refetchIntakes,
  } = useQuery({
    queryKey: ["intakes", "weighed"],
    queryFn: () => listIntakes({ status: "weighed", limit: 50 }),
  });

  // TanStack Query: recent sorting records (last 5)
  const {
    data: recentRecordsData,
    isLoading: recordsLoading,
    refetch: refetchRecords,
  } = useQuery({
    queryKey: ["sortingRecords", "recent"],
    queryFn: () => listSortingRecords({ limit: 5 }),
  });

  const intakes = intakesData?.items ?? [];
  const recentRecords = recentRecordsData?.items ?? [];

  const handleOpenSort = (intake: WasteIntakeListItem) => {
    setSelectedIntake(intake);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedIntake(null);
  };

  const handleSorted = () => {
    queryClient.invalidateQueries({ queryKey: ["intakes"] });
    queryClient.invalidateQueries({ queryKey: ["sortingRecords"] });
    refetchIntakes();
    refetchRecords();
  };

  const getCategoryName = (intake: WasteIntakeListItem) => {
    if (intake.category?.name) return intake.category.name;
    const catEntry = Object.values(WASTE_CATEGORY_MAP).find(
      (c) => c.id === (typeof intake.category === "object" ? intake.category.id : intake.category)
    );
    return catEntry?.name ?? "Unknown Category";
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "GRADE_A":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "GRADE_B":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "GRADE_C":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default:
        return "bg-slate-700/50 text-slate-300 border-slate-600/30";
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Layers className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Sorter Console</h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Weighed intakes waiting to be sorted and processed into inventory lots
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              refetchIntakes();
              refetchRecords();
            }}
            disabled={intakesFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${intakesFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Weighed Intakes Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>Pending Sorting Queue</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              {intakes.length}
            </span>
          </h2>
        </div>

        {intakesLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-400 mb-4" />
            <p className="text-sm text-slate-400">Loading weighed intakes...</p>
          </div>
        ) : intakesError ? (
          <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-8 text-center text-rose-300">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-400" />
            <p className="font-medium text-sm">Failed to load intake queue</p>
            <p className="text-xs text-rose-400/80 mt-1">Please try refreshing the page</p>
          </div>
        ) : intakes.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <CheckCircle2 className="h-6 w-6 text-brand-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No weighed intakes waiting</h3>
            <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Batch flow: supplier submits → driver picks up → weight recorded → sorter processes.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-6 py-4">Batch Code</th>
                    <th scope="col" className="px-6 py-4">Category</th>
                    <th scope="col" className="px-6 py-4">Declared Weight</th>
                    <th scope="col" className="px-6 py-4">Verified Weight</th>
                    <th scope="col" className="px-6 py-4">Submitted Date</th>
                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {intakes.map((intake) => (
                    <tr
                      key={intake.id}
                      onClick={() => handleOpenSort(intake)}
                      className="cursor-pointer transition-colors hover:bg-slate-800/40 group"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          <span>{intake.batch_code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-200 font-medium">
                          {getCategoryName(intake)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono">
                        {intake.declared_weight_kg.toFixed(1)} kg
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-emerald-400">
                        {intake.verified_weight_kg !== null
                          ? `${intake.verified_weight_kg.toFixed(1)} kg`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(intake.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSort(intake);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-500 text-slate-950 hover:bg-brand-400 transition-colors shadow-sm"
                        >
                          <span>Sort now</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Recent Sorting Records */}
      <section className="space-y-4 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Recent Sorting Records</h2>
            <p className="text-xs text-slate-400">Last 5 completed sorting operations</p>
          </div>
        </div>

        {recordsLoading ? (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
            Loading recent records...
          </div>
        ) : recentRecords.length === 0 ? (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 text-center text-xs text-slate-500">
            No sorting records yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/30 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3">Record ID</th>
                    <th scope="col" className="px-5 py-3">Sorted Weight</th>
                    <th scope="col" className="px-5 py-3">Rejected</th>
                    <th scope="col" className="px-5 py-3">Grade</th>
                    <th scope="col" className="px-5 py-3">Contamination</th>
                    <th scope="col" className="px-5 py-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono">
                  {recentRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/20">
                      <td className="px-5 py-3 text-slate-300 truncate max-w-[140px]">
                        {rec.id.slice(0, 8)}...
                      </td>
                      <td className="px-5 py-3 text-emerald-400 font-semibold">
                        {rec.sorted_weight_kg.toFixed(1)} kg
                      </td>
                      <td className="px-5 py-3 text-rose-400">
                        {rec.rejected_weight_kg.toFixed(1)} kg
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeBadge(
                            rec.sort_grade
                          )}`}
                        >
                          {rec.sort_grade.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {rec.contamination_percent}%
                      </td>
                      <td className="px-5 py-3 text-slate-400 font-sans">
                        {new Date(rec.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Sort Intake Modal */}
      <SortIntakeModal
        open={isModalOpen}
        onClose={handleCloseModal}
        intake={selectedIntake}
        onSorted={handleSorted}
      />
    </div>
  );
};
