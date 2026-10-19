import React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";

export const NotFoundPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const backTarget = isAuthenticated() ? "/dashboard" : "/";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-bg-base text-text-primary">
      <div className="max-w-md w-full glass-card rounded-2xl p-8 border border-border-subtle text-center shadow-2xl">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 items-center justify-center text-brand-400 mb-4">
          <HelpCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">404 — Page Not Found</h1>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          The requested marketplace route does not exist or has been relocated.
        </p>
        <Link
          to={backTarget}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gradient hover:opacity-90 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to {isAuthenticated() ? "Dashboard" : "Home"}</span>
        </Link>
      </div>
    </main>
  );
};
