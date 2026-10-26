import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ShoppingBag,
  Tag,
  Scale,
  Calendar,
  User,
  ShieldCheck,
  Gavel,
  ShoppingCart,
  AlertCircle,
  Clock,
  Info,
} from "lucide-react";
import { getListing } from "@/api/marketplace";
import { apiClient } from "@/api/client";
import type { InventoryLotRead } from "@/api/types";
import { TraceabilityTimeline } from "@/features/traceability/components/TraceabilityTimeline";
import { useAuthStore } from "@/features/auth/store";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";
import { BuyNowModal } from "../components/BuyNowModal";
import { BidModal } from "../components/BidModal";

export const ListingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const [quantityInput, setQuantityInput] = useState<number | "">("");
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);

  const {
    data: listing,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["marketplaceListing", id],
    queryFn: () => getListing(id!),
    enabled: Boolean(id),
  });

  const { data: inventoryLot } = useQuery({
    queryKey: ["inventoryLot", listing?.inventory_lot_id],
    queryFn: async () => {
      const res = await apiClient.get<InventoryLotRead>(`/inventory/lots/${listing!.inventory_lot_id}`);
      return res.data;
    },
    enabled: Boolean(listing?.inventory_lot_id),
  });

  const getCategoryName = (categoryId: number) => {
    const entry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === categoryId);
    return entry?.name ?? `Category #${categoryId}`;
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

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-400 mb-4" />
        <p className="text-sm text-slate-400">Loading feedstock listing details...</p>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-12 text-center text-rose-300">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 text-rose-400" />
        <h2 className="text-lg font-bold">Listing not found</h2>
        <p className="text-xs text-rose-400/80 mt-1 max-w-sm mx-auto">
          The requested feedstock listing may have been sold or removed.
        </p>
        <Link
          to="/marketplace"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>
    );
  }

  const isSeller = Boolean(user && user.id === listing.seller_id);
  const isAvailable = listing.status === "active" && listing.available_kg > 0;
  const numQuantity =
    typeof quantityInput === "number" && quantityInput > 0
      ? quantityInput
      : listing.available_kg;
  const liveTotal = numQuantity * listing.price_per_kg;
  const sellerInitial = listing.seller_id ? listing.seller_id.slice(0, 2).toUpperCase() : "SL";

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Back button */}
      <div>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-sm">
            {/* Header badges & Title */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 text-brand-300 border border-slate-700/60">
                  <Tag className="h-3.5 w-3.5 text-brand-400" />
                  <span>{getCategoryName(listing.category_id)}</span>
                </span>
                <span
                  className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border ${getGradeBadge(
                    listing.purity_grade
                  )}`}
                >
                  {listing.purity_grade.replace("_", " ")}
                </span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    listing.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {listing.status}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {listing.title}
              </h1>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Listed on {new Date(listing.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  ID: {listing.id.slice(0, 8)}...
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="pt-4 border-t border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Description & Material Specifications
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {listing.description || "No additional description provided by the seller."}
              </p>
            </div>

            {/* Traceability */}
            {listing.inventory_lot_id && (
              <div className="pt-4 border-t border-slate-800/80">
                <h3 className="text-lg font-semibold text-white mb-3">Traceability</h3>
                <TraceabilityTimeline
                  batchId={inventoryLot?.intake_id ?? listing.inventory_lot_id}
                  compact
                />
              </div>
            )}

            {/* Quantity Metrics */}
            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="block text-xs text-slate-400 mb-1">Available Stock</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {listing.available_kg.toFixed(1)} kg
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="block text-xs text-slate-400 mb-1">Total Lot Size</span>
                <span className="text-xl font-bold font-mono text-white">
                  {listing.quantity_kg.toFixed(1)} kg
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="block text-xs text-slate-400 mb-1">Min Bid Quantity</span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {listing.min_bid_kg.toFixed(1)} kg
                </span>
              </div>
            </div>

            {/* Seller Info Card */}
            <div className="pt-4 border-t border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Verified Seller
              </h2>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-brand-400 shrink-0">
                  {sellerInitial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">
                      Seller #{listing.seller_id.slice(0, 8)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      RECYCLER
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Verified Industrial Sorting Hub & Material Provider
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1/3) — Action Card */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 shadow-2xl backdrop-blur-md">
            {/* Price display */}
            <div>
              <span className="text-xs text-slate-400 font-medium">Asking Price</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-white font-mono tracking-tight">
                  ₹{listing.price_per_kg}
                </span>
                <span className="text-sm text-slate-400 font-medium">/ kg</span>
              </div>
            </div>

            {!isAvailable ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Listing Sold Out
                </span>
                <p className="text-xs text-slate-400">
                  All available stock for this listing has been acquired.
                </p>
              </div>
            ) : isSeller ? (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-blue-400">
                  You are the seller
                </span>
                <p className="text-xs text-blue-300/80">
                  This listing was created from your inventory lot. You cannot buy or bid on your own listing.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Quantity Input */}
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="text-xs font-medium text-slate-300">Purchase Quantity (kg)</label>
                    <button
                      type="button"
                      onClick={() => setQuantityInput(listing.available_kg)}
                      className="text-[11px] text-brand-400 hover:underline font-mono"
                    >
                      Max: {listing.available_kg} kg
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max={listing.available_kg}
                    value={quantityInput}
                    placeholder={String(listing.available_kg)}
                    onChange={(e) =>
                      setQuantityInput(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Live Total Display */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Estimated Total:</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    ₹{liveTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setIsBuyModalOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-500 text-slate-950 font-bold text-sm hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/20 active:scale-[0.99]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span>Buy Now (₹{listing.price_per_kg}/kg)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBidModalOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 transition-all active:scale-[0.99]"
                  >
                    <Gavel className="h-4 w-4 text-amber-400" />
                    <span>Place Bid Proposal</span>
                  </button>
                </div>

                {/* Platform Notice */}
                <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                  <p>
                    <strong className="text-slate-300">Buy Now</strong> = instant purchase at asking
                    price. <strong className="text-slate-300">Bid</strong> = propose lower price,
                    seller can accept.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buy Now Modal */}
      <BuyNowModal
        open={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
        listing={listing}
        quantityKg={numQuantity}
        onPurchased={() => refetch()}
      />

      {/* Bid Modal */}
      <BidModal
        open={isBidModalOpen}
        onClose={() => setIsBidModalOpen(false)}
        listing={listing}
        onBidPlaced={() => refetch()}
      />
    </div>
  );
};

export default ListingDetailPage;
