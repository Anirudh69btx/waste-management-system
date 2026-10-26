import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { X, Tag, DollarSign, Scale, Layers, AlertCircle, Loader2 } from "lucide-react";
import { createListingFromLot } from "@/api/seller";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";
import type { InventoryLotRead } from "@/api/types";

interface CreateListingModalProps {
  open: boolean;
  onClose: () => void;
  lot: InventoryLotRead;
  onCreated: () => void;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  open,
  onClose,
  lot,
  onCreated,
}) => {
  const catEntry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === lot.category_id);
  const categoryName = catEntry?.name ?? `Category #${lot.category_id}`;
  const baseRate = catEntry?.rate ?? 10;

  const defaultTitle = `${categoryName} — ${lot.grade.replace("_", " ")} — ${lot.available_kg}kg`;

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [pricePerKg, setPricePerKg] = useState<number | "">(baseRate);
  const [minBidKg, setMinBidKg] = useState<number | "">(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription("");
      setPricePerKg(baseRate);
      setMinBidKg(1);
      setInlineError(null);
    }
  }, [open, lot, defaultTitle, baseRate]);

  if (!open) return null;

  const numPrice = typeof pricePerKg === "number" && pricePerKg > 0 ? pricePerKg : 0;
  const numMinBid = typeof minBidKg === "number" && minBidKg > 0 ? minBidKg : 1;
  const estimatedPayout = numPrice * lot.available_kg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    if (!title.trim()) {
      setInlineError("Listing title is required.");
      return;
    }
    if (!numPrice || numPrice <= 0) {
      setInlineError("Price per kg must be greater than zero.");
      return;
    }
    if (!numMinBid || numMinBid <= 0) {
      setInlineError("Minimum bid quantity must be greater than zero.");
      return;
    }
    if (numMinBid > lot.available_kg) {
      setInlineError(`Minimum bid quantity cannot exceed available stock (${lot.available_kg} kg).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await createListingFromLot({
        inventory_lot_id: lot.id,
        title: title.trim(),
        description: description.trim() || undefined,
        price_per_kg: numPrice,
        min_bid_kg: numMinBid,
      });
      toast.success("Listing created successfully");
      onCreated();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: { detail?: string; message?: string };
          headers?: Record<string, string>;
        };
      };
      if (axiosErr.response?.status === 422) {
        setInlineError(
          axiosErr.response.data?.detail || "Invalid listing details. Please check the values."
        );
      } else {
        const reqId =
          axiosErr.response?.headers?.["x-request-id"] ||
          axiosErr.response?.data?.detail ||
          "unknown";
        toast.error(`Failed to create listing (Request ID: ${reqId})`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Create Marketplace Listing</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {inlineError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{inlineError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Listing Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              placeholder="e.g. PET Plastics Grade A Lot"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Packaging details, bale count, moisture or contamination notes..."
            />
          </div>

          {/* Price & Min Bid Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Price per kg (₹) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={pricePerKg}
                  onChange={(e) =>
                    setPricePerKg(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Typical: <span className="text-slate-300 font-semibold">₹{baseRate}/kg</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Min Order Quantity (kg) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max={lot.available_kg}
                value={minBidKg}
                onChange={(e) =>
                  setMinBidKg(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <p className="text-[11px] text-slate-400">
                Max available: <span className="text-slate-300">{lot.available_kg} kg</span>
              </p>
            </div>
          </div>

          {/* Preview Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Lot Reference:</span>
              <span className="font-mono text-slate-200 font-medium">{lot.lot_code}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Category & Grade:</span>
              <span className="text-slate-200 font-medium">
                {categoryName} • {lot.grade.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Contamination:</span>
              <span className="text-slate-200 font-medium">{lot.contamination_percent}%</span>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center">
              <span className="font-semibold text-slate-300">Est. Total Payout:</span>
              <span className="font-mono font-bold text-base text-emerald-400">
                ₹{estimatedPayout.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Publish Listing</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListingModal;
