import React, { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import toast from "react-hot-toast";
import { deactivateUser } from "@/api/admin";
import type { AdminUser } from "@/api/types";

export interface DeactivateModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUser;
  onDeactivated: (updated?: AdminUser) => void;
}

export const DeactivateModal: React.FC<DeactivateModalProps> = ({
  open,
  onClose,
  user,
  onDeactivated,
}) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open, user]);

  if (!open) return null;

  const isValid = reason.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await deactivateUser(user.id, reason.trim());
      toast.success(`User ${user.email} deactivated`);
      onDeactivated(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to deactivate user.";
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
      aria-labelledby="deactivate-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2
            id="deactivate-modal-title"
            className="text-lg font-bold text-slate-100"
          >
            Deactivate User Account
          </h2>
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
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
            <div className="font-semibold text-slate-100">{user.full_name}</div>
            <div className="text-xs text-slate-400">{user.email}</div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span>
              User will not be able to log in. Existing sessions will be
              invalidated on next request.
            </span>
          </div>

          <div>
            <label
              htmlFor="deactivate-reason"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Deactivation Reason (min 10 characters)
            </label>
            <textarea
              id="deactivate-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide reason for deactivating this account..."
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500 focus:outline-none"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>Audit logged permanently</span>
              <span>{reason.trim().length}/500</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Deactivating..." : "Deactivate user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeactivateModal;
