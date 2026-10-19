import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Shield, Sparkles, Building, Mail, Phone, Calendar } from "lucide-react";
import toast from "react-hot-toast";

import { useAuthStore } from "@/features/auth/store";
import { logout as apiLogout } from "@/api/auth";
import { Button } from "@/components/Button";

export const DashboardPlaceholderPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshToken, clearAuth } = useAuthStore();

  const handleLogout = () => {
    // Fire-and-forget server logout; local state is cleared unconditionally
    apiLogout(refreshToken).catch(() => {});
    clearAuth();
    toast.success("Signed out successfully");
    navigate("/login", { replace: true });
  };

  const roleColorMap = {
    GENERATOR: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    RECYCLER: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    LOGISTICS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ADMIN: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  const roleClass = user?.role ? roleColorMap[user.role] : "bg-brand-500/10 text-brand-400 border-brand-500/20";

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-8 text-text-primary">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-card rounded-2xl border border-border-subtle shadow-xl">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-brand-gradient p-0.5 shadow-lg shadow-brand-500/20">
            <div className="w-full h-full bg-bg-base rounded-[14px] flex items-center justify-center">
              <UserIcon className="h-7 w-7 text-brand-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Welcome, {user?.full_name || "Operator"}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleClass}`}>
                {user?.role || "GUEST"}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Verified Marketplace Session &bull; ID: <span className="font-mono text-brand-400">{user?.id?.slice(0, 8)}...</span>
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleLogout}
          className="self-start sm:self-auto hover:border-danger-500 hover:text-danger-500 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* Main Segment 1.4 Status Card */}
      <div className="glass-card rounded-2xl p-8 border border-border-subtle text-center space-y-4">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 items-center justify-center text-brand-400 mb-2">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Your account is ready.</h2>
        <p className="text-sm text-text-secondary max-w-lg mx-auto leading-relaxed">
          Authentication, session storage, and route authorization are fully active.
          Domain modules (intake submissions, certified marketplace, fleet pickups, and eco-rewards)
          will be connected in Segments 1.5+.
        </p>
      </div>

      {/* Account Profile Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 border border-border-subtle space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Mail className="h-3.5 w-3.5" />
            <span>Email</span>
          </div>
          <p className="text-sm font-semibold text-text-primary truncate">{user?.email}</p>
        </div>

        <div className="glass-card rounded-xl p-4 border border-border-subtle space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Building className="h-3.5 w-3.5" />
            <span>Organization</span>
          </div>
          <p className="text-sm font-semibold text-text-primary truncate">
            {user?.organization_name || "Independent"}
          </p>
        </div>

        <div className="glass-card rounded-xl p-4 border border-border-subtle space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Phone className="h-3.5 w-3.5" />
            <span>Phone</span>
          </div>
          <p className="text-sm font-semibold text-text-primary truncate">
            {user?.phone_number || "Not provided"}
          </p>
        </div>

        <div className="glass-card rounded-xl p-4 border border-border-subtle space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Shield className="h-3.5 w-3.5" />
            <span>Verification Status</span>
          </div>
          <p className="text-sm font-semibold text-brand-400">
            {user?.is_verified ? "Certified Active" : "Pending Verification"}
          </p>
        </div>
      </div>
    </div>
  );
};
