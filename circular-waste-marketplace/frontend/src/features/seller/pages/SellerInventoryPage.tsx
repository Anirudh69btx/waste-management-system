import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Package,
  Layers,
  Scale,
  CheckCircle,
  Tag,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  PlusCircle,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { listMyInventoryLots } from "@/api/seller";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { CreateListingModal } from "../components/CreateListingModal";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";
import type { InventoryLotRead } from "@/api/types";

export const SellerInventoryPage: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
  const [listingModalLot, setListingModalLot] = useState<InventoryLotRead | null>(null);
  const pageSize = 15;

  // Query to get stats across all lots
  const { data: allLotsData, refetch: refetchAll } = useQuery({
    queryKey: ["sellerInventoryLots", "all"],
    queryFn: () => listMyInventoryLots({ limit: 200, offset: 0 }),
  });

  // Query for current filtered page
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "sellerInventoryLots",
      "filtered",
      selectedStatus,
      selectedCategory,
      page,
    ],
    queryFn: () =>
      listMyInventoryLots({
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        category_id: selectedCategory !== "ALL" ? Number(selectedCategory) : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  const lots = data?.items ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Compute 4 inventory stats
  const stats = useMemo(() => {
    const all = allLotsData?.items ?? [];
    const totalLots = all.length;
    let availableKg = 0;
    let listedKg = 0;
    let soldKg = 0;

    for (const lot of all) {
      if (lot.status === "available") {
        availableKg += lot.available_kg;
      } else if (lot.status === "reserved") {
        listedKg += lot.quantity_kg;
      } else if (lot.status === "sold") {
        soldKg += lot.quantity_kg;
      }
    }

    return {
      totalLots,
      availableKg: Math.round(availableKg),
      listedKg: Math.round(listedKg),
      soldKg: Math.round(soldKg),
    };
  }, [allLotsData]);

  const getCategoryName = (categoryId: number) => {
    const entry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === categoryId);
    return entry?.name ?? `Category #${categoryId}`;
  };

  const getGradeBadgeVariant = (grade: string): "success" | "warning" | "danger" | "neutral" => {
    switch (grade) {
      case "GRADE_A":
        return "success";
      case "GRADE_B":
        return "warning";
      case "GRADE_C":
        return "danger";
      default:
        return "neutral";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Available
          </span>
        );
      case "reserved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Listed
          </span>
        );
      case "sold":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Sold
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Archived
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const toggleRow = (id: string) => {
    setExpandedLotId((prev) => (prev === id ? null : id));
  };

  const handleCreated = () => {
    refetch();
    refetchAll();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-400" />
            <span>My Inventory</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Certified sorted feedstock lots ready for B2B marketplace listing.
          </p>
        </div>
        <Link
          to="/sorter/console"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>Sort Weighed Consignment</span>
        </Link>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Lots"
          value={stats.totalLots}
          icon={Layers}
        />
        <StatCard
          title="Available (kg)"
          value={`${stats.availableKg.toLocaleString()} kg`}
          icon={CheckCircle}
        />
        <StatCard
          title="Listed on Market"
          value={`${stats.listedKg.toLocaleString()} kg`}
          icon={Tag}
        />
        <StatCard
          title="Total Sold (kg)"
          value={`${stats.soldKg.toLocaleString()} kg`}
          icon={Scale}
        />
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Filters:</span>
          </div>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Listed (Reserved)</option>
            <option value="sold">Sold</option>
            <option value="archived">Archived</option>
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Categories</option>
            {Object.values(WASTE_CATEGORY_MAP).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Showing {lots.length} of {totalItems} lots
        </span>
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
          <p className="text-sm text-slate-400">Loading inventory lots...</p>
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-300">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
          <p className="text-sm font-semibold">Failed to load inventory lots</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : lots.length === 0 ? (
        <div className="py-16 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-4">
          <Package className="w-12 h-12 mx-auto text-slate-600" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No inventory yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Execute a physical sorting run on a verified weight ticket to produce certified feedstock lots.
            </p>
          </div>
          <Link
            to="/sorter/console"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all"
          >
            <span>Sort a weighed intake</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Lot Code</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Available / Total</th>
                  <th className="py-3.5 px-4">Grade</th>
                  <th className="py-3.5 px-4">Contam. %</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lots.map((lot) => {
                  const isExpanded = expandedLotId === lot.id;
                  const isAvailable = lot.status === "available" && lot.available_kg > 0;

                  return (
                    <React.Fragment key={lot.id}>
                      <tr
                        onClick={() => toggleRow(lot.id)}
                        className={clsx(
                          "cursor-pointer transition-colors",
                          isExpanded ? "bg-slate-800/40" : "hover:bg-slate-850/50"
                        )}
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400 flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                          <span>{lot.lot_code}</span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-200">
                          {getCategoryName(lot.category_id)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          <span className="font-bold text-white">{lot.available_kg}</span>
                          <span className="text-slate-500"> / {lot.quantity_kg} kg</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={getGradeBadgeVariant(lot.grade)} size="sm">
                            {lot.grade.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {lot.contamination_percent}%
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(lot.status)}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(lot.created_at).toLocaleDateString()}
                        </td>
                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isAvailable ? (
                            <button
                              onClick={() => setListingModalLot(lot)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-all"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              <span>Create listing</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              title={
                                lot.status === "reserved"
                                  ? "Already listed on the marketplace"
                                  : `Cannot list lot in status '${lot.status}'`
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-xs text-slate-500 cursor-not-allowed opacity-60"
                            >
                              <span>{lot.status === "reserved" ? "Listed" : "Unavailable"}</span>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable row content */}
                      {isExpanded && (
                        <tr className="bg-slate-950/70 border-b border-slate-800/80">
                          <td colSpan={8} className="p-4 sm:p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              {/* Hub location & moisture */}
                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                <span className="font-semibold text-slate-400 uppercase tracking-wider block">
                                  Storage & Quality
                                </span>
                                <div className="space-y-1.5 text-slate-300">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Hub: {lot.hub_location || "Central Hub 01"}</span>
                                  </div>
                                  <div>
                                    Moisture:{" "}
                                    <span className="font-mono text-white">
                                      {lot.moisture_percent != null
                                        ? `${lot.moisture_percent}%`
                                        : "N/A"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Upstream intake linkage */}
                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                <span className="font-semibold text-slate-400 uppercase tracking-wider block">
                                  Upstream Intake
                                </span>
                                <div className="space-y-1.5 text-slate-300">
                                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                                    <span>Intake ID:</span>
                                    <span className="text-slate-200">{lot.intake_id}</span>
                                  </div>
                                  <Link
                                    to={`/dashboard/batches/${lot.intake_id}`}
                                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-medium pt-1"
                                  >
                                    <span>View Consignment Traceability</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>

                              {/* Sorting record linkage */}
                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                <span className="font-semibold text-slate-400 uppercase tracking-wider block">
                                  Sorting Record
                                </span>
                                <div className="space-y-1.5 text-slate-300">
                                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                                    <span>Record:</span>
                                    <span className="text-slate-200">{lot.sorting_record_id}</span>
                                  </div>
                                  <div className="text-slate-400 text-[11px]">
                                    Purity grade verified by physical sensor assessment.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Listing Modal */}
      {listingModalLot && (
        <CreateListingModal
          open={Boolean(listingModalLot)}
          lot={listingModalLot}
          onClose={() => setListingModalLot(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default SellerInventoryPage;
