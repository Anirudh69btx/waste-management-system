import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, ShoppingCart, AlertCircle, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { buyNow } from "@/api/marketplace";
import type { MarketplaceListingRead } from "@/api/types";

export interface BuyNowModalProps {
  open: boolean;
  onClose: () => void;
  listing: MarketplaceListingRead | null;
  quantityKg: number;
  onPurchased?: () => void;
}

export const BuyNowModal: React.FC<BuyNowModalProps> = ({
  open,
  onClose,
  listing,
  quantityKg,
  onPurchased,
}) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open || !listing) return null;

  const totalAmount = quantityKg * listing.price_per_kg;

  const handleConfirm = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const order = await buyNow(listing.id, { quantity_kg: quantityKg });
      toast.success(`Order created — ${order.order_code}`);
      if (onPurchased) onPurchased();
      onClose();
      navigate("/marketplace/orders");
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 422) {
        const msg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
            ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
            : "Insufficient quantity or invalid order parameters";
        setErrorMsg(msg);
      } else {
        const reqId = err.response?.headers?.["x-request-id"] || "";
        const msg = err.message || "Failed to process purchase";
        toast.error(`${msg} ${reqId ? `(${reqId})` : ""}`);
        setErrorMsg(msg);
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
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white">Confirm Buy Now</h2>
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

          <div className="p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 text-xs rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Order Breakdown */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="font-sans text-slate-400">Order Quantity:</span>
                <span className="font-bold text-white">{quantityKg.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="font-sans text-slate-400">Unit Price:</span>
                <span>₹{listing.price_per_kg.toFixed(2)} / kg</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold">
                <span className="font-sans text-slate-200">Total Purchase Amount:</span>
                <span className="text-emerald-400 font-bold">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Escrow Notice */}
            <div className="rounded-xl border border-blue-900/40 bg-blue-950/30 p-3.5 flex items-start gap-3 text-xs text-blue-300">
              <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-200">Escrow Protected Transaction</p>
                <p className="text-blue-300/80 mt-0.5 leading-relaxed">
                  Payment will be held in escrow until delivery is confirmed.
                </p>
              </div>
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
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-brand-500 text-slate-950 hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Pay ₹{totalAmount.toLocaleString()}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BuyNowModal;
