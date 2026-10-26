import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { activateUser, listUsers } from "@/api/admin";
import type { AdminUser } from "@/api/types";
import { useAuthStore } from "@/features/auth/authStore";
import { RoleChangeModal } from "../components/RoleChangeModal";
import { DeactivateModal } from "../components/DeactivateModal";

const PAGE_SIZE = 20;

const ROLE_BADGE_STYLES: Record<AdminUser["role"], string> = {
  ADMIN: "bg-red-500/15 text-red-300 border-red-500/30",
  RECYCLER: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  LOGISTICS: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  GENERATOR: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">(
    ""
  );
  const [page, setPage] = useState(1);

  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [deactivateModalUser, setDeactivateModalUser] =
    useState<AdminUser | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin-users",
      {
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset,
      },
    ],
    queryFn: () =>
      listUsers({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const handleActivate = async (target: AdminUser) => {
    try {
      await activateUser(target.id);
      toast.success(`Activated ${target.email}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to activate user.";
      toast.error(msg);
    }
  };

  const refreshList = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold text-slate-100">
              User Management
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {total} users on platform
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            aria-label="Search users"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All roles</option>
          <option value="GENERATOR">GENERATOR</option>
          <option value="RECYCLER">RECYCLER</option>
          <option value="LOGISTICS">LOGISTICS</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "" | "active" | "inactive");
            setPage(1);
          }}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          type="button"
          onClick={handleClearFilters}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-2 py-1"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No users match filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {users.map((u) => {
                  const isSelf =
                    Boolean(currentUser?.id && currentUser.id === u.id) ||
                    Boolean(currentUser?.email && currentUser.email === u.email);
                  const initial = (u.full_name || u.email || "U")
                    .charAt(0)
                    .toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                            {initial}
                          </div>
                          <span className="font-semibold text-slate-100">
                            {u.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                            ROLE_BADGE_STYLES[u.role] ??
                            "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {u.organization_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Active
                          </span>
                        ) : (
                          <span
                            title={u.deactivation_reason || "Deactivated"}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-xs font-semibold text-red-300"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSelf ? (
                          <span className="inline-flex items-center rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300">
                            You
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setRoleModalUser(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                            >
                              <Shield className="h-3.5 w-3.5 text-emerald-400" />
                              Change role
                            </button>
                            {u.is_active ? (
                              <button
                                type="button"
                                onClick={() => setDeactivateModalUser(u)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                              >
                                <UserX className="h-3.5 w-3.5" />
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleActivate(u)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Activate
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {roleModalUser && (
        <RoleChangeModal
          open={Boolean(roleModalUser)}
          onClose={() => setRoleModalUser(null)}
          user={roleModalUser}
          onChanged={refreshList}
        />
      )}

      {deactivateModalUser && (
        <DeactivateModal
          open={Boolean(deactivateModalUser)}
          onClose={() => setDeactivateModalUser(null)}
          user={deactivateModalUser}
          onDeactivated={refreshList}
        />
      )}
    </div>
  );
};

export default AdminUsersPage;
