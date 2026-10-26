import React, { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import toast from "react-hot-toast";
import { changeUserRole } from "@/api/admin";
import type { AdminUser } from "@/api/types";

const ALL_ROLES: Array<AdminUser["role"]> = [
  "GENERATOR",
  "RECYCLER",
  "LOGISTICS",
  "ADMIN",
];

export interface RoleChangeModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUser;
  onChanged: (updated?: AdminUser) => void;
}

export const RoleChangeModal: React.FC<RoleChangeModalProps> = ({
  open,
  onClose,
  user,
  onChanged,
}) => {
  const availableRoles = ALL_ROLES.filter((r) => r !== user.role);
  const [newRole, setNewRole] = useState<AdminUser["role"]>(
    availableRoles[0] ?? "GENERATOR"
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const next = ALL_ROLES.filter((r) => r !== user.role)[0] ?? "GENERATOR";
      setNewRole(next);
      setReason("");
      setError(null);
    }
  }, [open, user]);

  if (!open) return null;

  const isValid = reason.trim().length >= 10 && newRole !== user.role;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await changeUserRole(user.id, {
        new_role: newRole,
        reason: reason.trim(),
      });
      toast.success(`Role updated to ${newRole}`);
      onChanged(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to change user role.";
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
      aria-labelledby="role-change-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2
            id="role-change-modal-title"
            className="text-lg font-bold text-slate-100"
          >
            Change User Role
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
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-slate-400">Current Role:</span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 font-semibold text-emerald-400">
                {user.role}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="new-role-select"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              New Role
            </label>
            <select
              id="new-role-select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminUser["role"])}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {ALL_ROLES.map((roleOpt) => (
                <option
                  key={roleOpt}
                  value={roleOpt}
                  disabled={roleOpt === user.role}
                >
                  {roleOpt}
                  {roleOpt === user.role ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          {user.role === "ADMIN" && newRole !== "ADMIN" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>This user will lose all admin privileges</span>
            </div>
          )}

          {user.role !== "ADMIN" && newRole === "ADMIN" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>This user will gain full platform access</span>
            </div>
          )}

          <div>
            <label
              htmlFor="role-change-reason"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Reason for Change (min 10 characters)
            </label>
            <textarea
              id="role-change-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this user's role is being changed..."
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
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
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Updating..." : "Update Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleChangeModal;
