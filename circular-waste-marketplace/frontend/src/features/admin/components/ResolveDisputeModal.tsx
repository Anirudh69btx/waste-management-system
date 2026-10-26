import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Scale, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { resolveDispute } from "@/api/admin";
import type { AdminDispute } from "@/api/types";

export interface ResolveDisputeModalProps {
  open: boolean;
  onClose: () => void;
  dispute: AdminDispute;
  onResolved: (updated?: AdminDispute) => void;
}

export const ResolveDisputeModal: React.FC<ResolveDisputeModalProps> = ({
  open,
  onClose,
  dispute,
  onResolved,
}) => {
  const [resolution, setResolution] = useState<"upheld" | "rejected">("upheld");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setResolution("upheld");
      setNote("");
      setError(null);
    }
  }, [open, dispute]);

  if (!open) return null;

  const isReadOnly = dispute.dispute_resolution !== null;
  const diffKg = dispute.verified_weight_kg - dispute.declared_weight_kg;
  const diffPct =
    dispute.declared_weight_kg > 0
      ? ((diffKg / dispute.declared_weight_kg) * 100).toFixed(1)
      : "0.0";

  const isValid = note.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      onClose();
      return;
    }
    if (!isValid) {
      setError("Resolution note must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await resolveDispute(
        dispute.id,
        resolution,
        note.trim()
      );
      toast.success(
        `Dispute ${resolution === "upheld" ? "upheld" : "rejected"}`
      );
      onResolved(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to resolve dispute.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-dispute-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-400" />
            <h2
              id="resolve-dispute-modal-title"
              className="text-lg font-bold text-slate-100"
            >
              {isReadOnly ? "Dispute Resolution Details" : "Review Weight Dispute"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Read-only summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-400">Batch Code: </span>
                <span className="font-mono font-bold text-emerald-400">
                  {dispute.batch_code}
                </span>
              </div>
              <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 font-semibold uppercase text-slate-300">
                {dispute.weight_method}
              </span>
            </div>

            <div>
              <span className="text-slate-400">Supplier: </span>
              <span className="font-medium text-slate-200">
                {dispute.supplier_email}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[11px] text-slate-400">Declared</div>
                <div className="text-sm font-bold text-slate-100">
                  {dispute.declared_weight_kg.toFixed(1)} kg
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[11px] text-slate-400">Verified</div>
                <div className="text-sm font-bold text-slate-100">
                  {dispute.verified_weight_kg.toFixed(1)} kg
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-[11px] text-slate-400">Difference</div>
                <div
                  className={`text-sm font-bold ${
                    diffKg < 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {diffKg > 0 ? "+" : ""}
                  {diffKg.toFixed(1)} kg ({diffPct}%)
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Supplier&apos;s Dispute Notes
              </div>
              <p className="rounded-lg bg-slate-900 p-2.5 text-slate-200 whitespace-pre-wrap">
                {dispute.dispute_notes}
              </p>
            </div>
          </div>

          {isReadOnly ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Resolution Status:</span>
                <span
                  className={`rounded-lg px-2.5 py-0.5 font-bold uppercase ${
                    dispute.dispute_resolution === "upheld"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {dispute.dispute_resolution}
                </span>
              </div>
              {dispute.dispute_resolved_at && (
                <div className="text-slate-400">
                  Resolved at:{" "}
                  {new Date(dispute.dispute_resolved_at).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Decision section */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Decision
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResolution("upheld")}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      resolution === "upheld"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-200 shadow-lg shadow-emerald-500/10"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Uphold dispute
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                      Supplier&apos;s claim is valid. Verified weight will be
                      adjusted.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolution("rejected")}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      resolution === "rejected"
                        ? "border-red-500 bg-red-500/15 text-red-200 shadow-lg shadow-red-500/10"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm text-red-400">
                      <XCircle className="h-4 w-4" />
                      Reject dispute
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                      Original verified weight stands.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="dispute-resolution-note"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Resolution Note (min 10 characters)
                </label>
                <textarea
                  id="dispute-resolution-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Document the evidence and rationale for this decision..."
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>Required for audit trail</span>
                  <span>{note.trim().length}/1000</span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>This action is final and logged.</span>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              {isReadOnly ? "Close" : "Cancel"}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={!isValid || submitting}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  resolution === "upheld"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {submitting ? "Submitting..." : "Submit Resolution"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResolveDisputeModal;
