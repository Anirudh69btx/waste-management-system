import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";

export const ForbiddenPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const backTarget = isAuthenticated() ? "/dashboard" : "/";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-bg-base text-text-primary">
      <div className="max-w-md w-full glass-card rounded-2xl p-8 border border-border-subtle text-center shadow-2xl">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-danger-500/10 border border-danger-500/20 items-center justify-center text-danger-500 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">403 — Access Forbidden</h1>
        <p className="text-sm text-text-secondary mb-4 leading-relaxed">
          Your current account role <span className="font-mono font-semibold text-brand-400">[{user?.role || "UNKNOWN"}]</span> does
          not have authorization to view this area.
        </p>
        <p className="text-xs text-text-muted mb-6">
          Client-side role checks reflect authorization UX. Backend RBAC is the authoritative enforcement layer.
        </p>
        <Link
          to={backTarget}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-bg-elevated hover:bg-border-strong text-sm font-medium text-text-primary transition-colors border border-border-subtle"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to {isAuthenticated() ? "Dashboard" : "Home"}</span>
        </Link>
      </div>
    </main>
  );
};
