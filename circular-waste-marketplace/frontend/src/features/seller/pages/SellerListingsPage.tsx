import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import clsx from "clsx";
import {
  Tag,
  ShoppingBag,
  ExternalLink,
  Ban,
  Clock,
  Filter,
  AlertCircle,
  PlusCircle,
  ArrowRight,
  Loader2,
  X,
  Scale,
  Package,
} from "lucide-react";
import { listMyListings, cancelListing } from "@/api/seller";
import { Badge } from "@/components/Badge";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";
import type { MarketplaceListingRead } from "@/api/types";

export const SellerListingsPage: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [cancellingListing, setCancellingListing] = useState<MarketplaceListingRead | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["sellerMyListings", selectedStatus],
    queryFn: () =>
      listMyListings({
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        limit: 50,
      }),
  });

  const listings = data?.items ?? [];

  const getCategoryName = (categoryId: number) => {
    const entry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === categoryId);
    return entry?.name ?? `Category #${categoryId}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        );
      case "sold":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Sold
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Cancelled
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingListing) return;
    setIsCancelling(true);
    try {
      await cancelListing(cancellingListing.id, {
        reason: cancelReason.trim() || undefined,
      });
      toast.success("Listing cancelled and returned to inventory");
      setCancellingListing(null);
      setCancelReason("");
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { detail?: string } };
      };
      toast.error(axiosErr.response?.data?.detail || "Failed to cancel listing");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Tag className="w-7 h-7 text-emerald-400" />
            <span>My Listings</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your active, sold, and archived marketplace listings.
          </p>
        </div>
        <Link
          to="/seller/inventory"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create from Inventory</span>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {["ALL", "active", "sold", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={clsx(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all",
                selectedStatus === st
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              )}
            >
              {st}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {listings.length} {listings.length === 1 ? "listing" : "listings"}
        </span>
      </div>

      {/* Listings Content */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
          <p className="text-sm text-slate-400">Loading your listings...</p>
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-300">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
          <p className="text-sm font-semibold">Failed to load listings</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : listings.length === 0 ? (
        <div className="py-16 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-4">
          <Tag className="w-12 h-12 mx-auto text-slate-600" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No listings yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven't listed any feedstock yet. Publish listings from your certified inventory lots.
            </p>
          </div>
          <Link
            to="/seller/inventory"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all"
          >
            <span>Go to My Inventory</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {listings.map((item) => {
            const isActive = item.status === "active";
            const isSold = item.status === "sold";

            return (
              <div
                key={item.id}
                className={clsx(
                  "rounded-2xl border p-5 sm:p-6 space-y-4 transition-all shadow-lg backdrop-blur-sm",
                  isActive
                    ? "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                    : isSold
                    ? "bg-slate-950/60 border-slate-850 opacity-90"
                    : "bg-slate-950/40 border-slate-900 opacity-60"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {getCategoryName(item.category_id)}
                      </span>
                      <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                        {item.purity_grade.replace("_", " ")}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white truncate pt-1">{item.title}</h3>
                  </div>
                  <div>{getStatusBadge(item.status)}</div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-800/80 text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px] block">Stock</span>
                    <span className="text-white font-bold text-sm">
                      {item.available_kg} <span className="text-slate-500 font-normal">/ {item.quantity_kg} kg</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px] block">Ask Price</span>
                    <span className="text-emerald-400 font-bold text-base">
                      ₹{item.price_per_kg} <span className="text-slate-500 font-normal text-xs">/ kg</span>
                    </span>
                  </div>
                </div>

                {/* Sub-info */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <span>Min order: {item.min_bid_kg} kg</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Link
                    to={`/marketplace/${item.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                  >
                    <span>View on marketplace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  {isActive && (
                    <button
                      onClick={() => setCancellingListing(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal (Section G.1) */}
      {cancellingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>Cancel Listing</span>
              </h3>
              <button
                onClick={() => setCancellingListing(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Cancel listing <span className="font-semibold text-white">"{cancellingListing.title}"</span>? It will be removed from the marketplace. Any pending buyer bids will be rejected, and the lot will return to available inventory.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Reason (Optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder="Reason for cancellation..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setCancellingListing(null)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
              >
                Keep Listing
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-900/30 disabled:opacity-50"
              >
                {isCancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerListingsPage;
