import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import clsx from "clsx";
import {
  Gavel,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  User,
  AlertCircle,
  Loader2,
  Tag,
  ArrowRight,
  MessageSquare,
  X,
  Check,
} from "lucide-react";
import { listMyListings, listListingBids, acceptBid, rejectBid } from "@/api/seller";
import type { MarketplaceListingRead, BidRead, PurchaseOrderRead } from "@/api/types";

interface ListingWithBids {
  listing: MarketplaceListingRead;
  bids: BidRead[];
}

export const SellerBidsPage: React.FC = () => {
  const navigate = useNavigate();

  const [acceptingBid, setAcceptingBid] = useState<{
    listing: MarketplaceListingRead;
    bid: BidRead;
  } | null>(null);
  const [rejectingBid, setRejectingBid] = useState<{
    listing: MarketplaceListingRead;
    bid: BidRead;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Fetch active listings, then fetch bids for each
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["sellerBidsGrouped"],
    queryFn: async (): Promise<ListingWithBids[]> => {
      const listingsRes = await listMyListings({ status: "active", limit: 50 });
      const activeListings = listingsRes.items ?? [];

      const results = await Promise.all(
        activeListings.map(async (listing) => {
          try {
            const bidsRes = await listListingBids(listing.id);
            return {
              listing,
              bids: (bidsRes.items ?? []).sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ),
            };
          } catch {
            return { listing, bids: [] };
          }
        })
      );

      return results;
    },
  });

  const listingsWithBids = data ?? [];
  const totalActiveListings = listingsWithBids.length;
  const totalBidsCount = listingsWithBids.reduce((sum, item) => sum + item.bids.length, 0);

  const handleConfirmAccept = async () => {
    if (!acceptingBid) return;
    setIsProcessing(true);
    try {
      const order = await acceptBid(acceptingBid.listing.id, acceptingBid.bid.id);
      toast.success(`Order created — ${order.order_code}`, {
        duration: 4000,
      });
      setAcceptingBid(null);
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || "Failed to accept bid");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingBid) return;
    setIsProcessing(true);
    try {
      await rejectBid(rejectingBid.listing.id, rejectingBid.bid.id, {
        note: rejectNote.trim() || undefined,
      });
      toast.success("Bid rejected");
      setRejectingBid(null);
      setRejectNote("");
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || "Failed to reject bid");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Gavel className="w-7 h-7 text-amber-400" />
            <span>Bids Received</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and respond to procurement bids across your active feedstock listings.
          </p>
        </div>
        <Link
          to="/seller/orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
        >
          <span>View Orders</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          <p className="text-sm text-slate-400">Loading bids received...</p>
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-300">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
          <p className="text-sm font-semibold">Failed to load bids</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : totalBidsCount === 0 ? (
        <div className="py-16 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-4">
          <Gavel className="w-12 h-12 mx-auto text-slate-600" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No bids received yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You have {totalActiveListings} active {totalActiveListings === 1 ? "listing" : "listings"} on the marketplace. Bids placed by industrial recyclers will appear here.
            </p>
          </div>
          <Link
            to="/seller/listings"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition-all"
          >
            <span>Manage Listings ({totalActiveListings})</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {listingsWithBids.map(({ listing, bids }) => {
            if (bids.length === 0) return null;

            return (
              <div
                key={listing.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl"
              >
                {/* Listing Group Header */}
                <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                      <h2 className="text-base font-bold text-white truncate">{listing.title}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>Available: <strong className="text-white">{listing.available_kg} kg</strong></span>
                      <span>•</span>
                      <span>Ask: <strong className="text-emerald-400">₹{listing.price_per_kg}/kg</strong></span>
                      <span>•</span>
                      <span>{bids.length} {bids.length === 1 ? "bid" : "bids"}</span>
                    </div>
                  </div>

                  <Link
                    to={`/marketplace/${listing.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                  >
                    <span>View listing</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Bids Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/90 border-b border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="py-3 px-4">Buyer</th>
                        <th className="py-3 px-4">Bid Price</th>
                        <th className="py-3 px-4">Quantity</th>
                        <th className="py-3 px-4">Total Amount</th>
                        <th className="py-3 px-4">Message</th>
                        <th className="py-3 px-4">Submitted</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {bids.map((bid) => {
                        const buyerInitial = bid.buyer_user_id
                          ? bid.buyer_user_id.slice(0, 2).toUpperCase()
                          : "BY";
                        const isPending = bid.status === "pending";
                        const isAccepted = bid.status === "accepted";
                        const isRejected = bid.status === "rejected";

                        return (
                          <tr key={bid.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* Buyer */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                                  {buyerInitial}
                                </div>
                                <div className="text-xs font-mono text-slate-300">
                                  {bid.buyer_user_id.slice(0, 8)}...
                                </div>
                              </div>
                            </td>

                            {/* Price */}
                            <td className="py-3.5 px-4 font-mono font-bold text-white">
                              ₹{bid.bid_price_per_kg}
                              <span className="text-xs font-normal text-slate-500"> / kg</span>
                            </td>

                            {/* Quantity */}
                            <td className="py-3.5 px-4 font-mono text-slate-200 font-semibold">
                              {bid.quantity_kg} kg
                            </td>

                            {/* Total */}
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                              ₹{bid.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </td>

                            {/* Message */}
                            <td className="py-3.5 px-4 text-xs text-slate-300 max-w-xs truncate">
                              {bid.message || <span className="text-slate-600">—</span>}
                            </td>

                            {/* Date */}
                            <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                              {new Date(bid.created_at).toLocaleDateString()}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {isPending ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => setAcceptingBid({ listing, bid })}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-all"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    onClick={() => setRejectingBid({ listing, bid })}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/30 text-xs font-semibold text-slate-300 hover:text-rose-300 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : isAccepted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Order Created</span>
                                </span>
                              ) : isRejected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-medium">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Rejected</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500 uppercase">{bid.status}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept Bid Confirmation Modal */}
      {acceptingBid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Accept Buyer Bid</span>
              </h3>
              <button
                onClick={() => setAcceptingBid(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Accept <span className="font-semibold text-emerald-400">₹{acceptingBid.bid.bid_price_per_kg}/kg</span> for{" "}
              <span className="font-semibold text-white">{acceptingBid.bid.quantity_kg} kg</span>?
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Listing:</span>
                <span className="text-slate-200 truncate max-w-[200px]">{acceptingBid.listing.title}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Payout:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ₹{acceptingBid.bid.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Confirming will accept the bid, decrement available listing inventory, and generate a binding purchase order awaiting buyer escrow deposit.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setAcceptingBid(null)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAccept}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 disabled:opacity-50"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Create Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Bid Confirmation Modal */}
      {rejectingBid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                <span>Reject Bid</span>
              </h3>
              <button
                onClick={() => setRejectingBid(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Reject bid of <span className="font-semibold text-white">₹{rejectingBid.bid.bid_price_per_kg}/kg</span> for{" "}
              <span className="font-semibold text-white">{rejectingBid.bid.quantity_kg} kg</span>?
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Reason / Note for Buyer (Optional)
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                placeholder="e.g. Price too low, batch already reserved..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRejectingBid(null)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
              >
                Keep Bid
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-900/30 disabled:opacity-50"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Reject Bid</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerBidsPage;
