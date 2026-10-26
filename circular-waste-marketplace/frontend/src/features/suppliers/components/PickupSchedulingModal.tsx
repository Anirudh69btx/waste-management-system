import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { X, Calendar, Clock, Loader2, Package, MapPin, FileText } from "lucide-react";
import { createPickup } from "@/api/pickups";
import type { WasteIntakeListItem, SupplierProfile } from "@/api/types";
import { normalizeApiError } from "@/api/client";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PickupSchedulingModalProps {
  open: boolean;
  onClose: () => void;
  intake: WasteIntakeListItem;
  supplier: SupplierProfile | null;
  onScheduled: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIME_SLOTS = ["09:00-11:00", "11:00-13:00", "14:00-16:00", "16:00-18:00"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function slotToISO(date: string, slot: string): { start: string; end: string } {
  const [startTime, endTime] = slot.split("-");
  return {
    start: `${date}T${startTime}:00+05:30`,
    end: `${date}T${endTime}:00+05:30`,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const PickupSchedulingModal: React.FC<PickupSchedulingModalProps> = ({
  open,
  onClose,
  intake,
  supplier,
  onScheduled,
}) => {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setDate("");
      setSlot("");
      setNotes("");
      setInlineError(null);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus trap: tab cycles within modal
  useEffect(() => {
    if (!open) return;
    const modal = overlayRef.current?.querySelector("[data-modal-content]") as HTMLElement | null;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    modal.addEventListener("keydown", trap);
    return () => modal.removeEventListener("keydown", trap);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    if (!date || !slot) {
      setInlineError("Please select a date and time slot.");
      return;
    }

    setSubmitting(true);
    try {
      const { start, end } = slotToISO(date, slot);
      await createPickup({
        intake_id: intake.id,
        scheduled_start: start,
        scheduled_end: end,
        notes: notes.trim() || undefined,
      });
      toast.success("Pickup scheduled!");
      onScheduled();
      onClose();
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      if (normalized.code === 409) {
        toast.error("A pickup already exists for this batch.");
        onClose();
      } else if (normalized.code === 422) {
        setInlineError(normalized.detail || "Validation error.");
      } else {
        toast.error(
          `Failed to schedule pickup.${normalized.requestId ? ` (ref: ${normalized.requestId})` : ""}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        data-modal-content
        className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          animation: "slideInModal 0.2s ease-out",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideInModal {
            from { opacity: 0; transform: translateY(-16px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2
            id="pickup-modal-title"
            className="text-base font-bold text-white flex items-center gap-2"
          >
            <Calendar className="h-5 w-5 text-brand-400" />
            Schedule Pickup
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Batch summary */}
        <div className="px-6 py-4 bg-slate-800/60 border-b border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Package className="h-4 w-4 text-brand-400 flex-shrink-0" />
            <span className="font-mono font-bold">{intake.batch_code}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">{intake.category.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{supplier?.facility_address ?? "Address not on file"}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Date picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Pickup Date
            </label>
            <input
              ref={firstInputRef}
              type="date"
              value={date}
              min={todayStr()}
              max={maxDateStr()}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500 [color-scheme:dark]"
            />
          </div>

          {/* Time slot chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Time Slot
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={submitting}
                  onClick={() => setSlot(s)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    slot === s
                      ? "bg-brand-500/20 border-brand-500 text-brand-300"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Optional notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={2}
              maxLength={200}
              placeholder="Gate code, contact person, etc…"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          {/* Inline error */}
          {inlineError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
              {inlineError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !date || !slot}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Schedule
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
