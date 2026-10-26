import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gavel, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { placeBid } from "@/api/marketplace";
import type { MarketplaceListingRead } from "@/api/types";

export interface BidModalProps {
  open: boolean;
  onClose: () => void;
  listing: MarketplaceListingRead | null;
  onBidPlaced: () => void;
}

export const BidModal: React.FC<BidModalProps> = ({
  open,
  onClose,
  listing,
  onBidPlaced,
}) => {
  const minPriceAllowed = listing ? Number((listing.price_per_kg * 0.7).toFixed(2)) : 0;

  const [bidPrice, setBidPrice] = useState<number | "">("");
  const [quantityKg, setQuantityKg] = useState<number | "">("");
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (listing && open) {
      setBidPrice(listing.price_per_kg);
      setQuantityKg(listing.available_kg);
      setMessage("");
      setErrors({});
    }
  }, [listing, open]);

  if (!open || !listing) return null;

  const numBidPrice = typeof bidPrice === "number" ? bidPrice : 0;
  const numQuantity = typeof quantityKg === "number" ? quantityKg : 0;
  const totalAmount = numBidPrice * numQuantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (numBidPrice <= 0) {
      newErrors.price = "Bid price must be greater than 0";
    } else if (numBidPrice < minPriceAllowed) {
      newErrors.price = `Bid price must be at least 70% of asking price (₹${minPriceAllowed}/kg)`;
    }

    if (numQuantity <= 0) {
      newErrors.quantity = "Quantity must be greater than 0 kg";
    } else if (numQuantity > listing.available_kg) {
      newErrors.quantity = `Quantity cannot exceed available stock (${listing.available_kg} kg)`;
    } else if (numQuantity < listing.min_bid_kg) {
      newErrors.quantity = `Quantity cannot be less than minimum bid lot (${listing.min_bid_kg} kg)`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await placeBid(listing.id, {
        bid_price_per_kg: numBidPrice,
        quantity_kg: numQuantity,
        message: message.trim() || undefined,
      });

      toast.success("Bid placed successfully");
      onBidPlaced();
      onClose();
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 422) {
        const msg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
            ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
            : "Invalid bid submission";
        setErrors({ general: msg });
      } else {
        const reqId = err.response?.headers?.["x-request-id"] || "";
        const msg = err.message || "Failed to place bid";
        toast.error(`${msg} ${reqId ? `(${reqId})` : ""}`);
        setErrors({ general: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={submitting ? undefined : onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl z-10 text-slate-100 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Gavel className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white">Place a Bid</h2>
                <p className="text-xs text-slate-400 font-mono truncate max-w-xs">{listing.title}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errors.general && (
              <div className="p-3 text-xs rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Price Input */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Bid Price per kg (₹) <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Asking: ₹{listing.price_per_kg} | Minimum ₹{minPriceAllowed}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min={minPriceAllowed}
                value={bidPrice}
                onChange={(e) =>
                  setBidPrice(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                required
              />
              {errors.price ? (
                <p className="text-[11px] text-rose-400 mt-1">{errors.price}</p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  Propose your offer (minimum 70% of asking price per platform rule)
                </p>
              )}
            </div>

            {/* Quantity Input */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Quantity (kg) <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Max: {listing.available_kg} kg | Min bid: {listing.min_bid_kg} kg
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min={listing.min_bid_kg}
                max={listing.available_kg}
                value={quantityKg}
                onChange={(e) =>
                  setQuantityKg(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                required
              />
              {errors.quantity && (
                <p className="text-[11px] text-rose-400 mt-1">{errors.quantity}</p>
              )}
            </div>

            {/* Message Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Optional Message for Seller (max 500 chars)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="State your logistics pickup timeline, target purity requirements, or long-term contracting interest..."
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>

            {/* Live Total Display */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Proposed Total:</span>
              <span className="text-base font-bold font-mono text-amber-400">
                ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>Placing Bid...</span>
                  </>
                ) : (
                  <>
                    <Gavel className="h-3.5 w-3.5" />
                    <span>Submit Bid Proposal</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BidModal;
