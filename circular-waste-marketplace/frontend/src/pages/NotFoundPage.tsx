import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Home, LifeBuoy } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";

export const NotFoundPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const authed = isAuthenticated();

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-4 text-slate-100">
      <div className="max-w-md w-full glass-card rounded-3xl p-8 border border-slate-800 text-center shadow-2xl space-y-6">
        <div>
          <span className="text-7xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-brand-400 to-teal-300 bg-clip-text text-transparent select-none">
            404
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Page Not Found
          </h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            The requested marketplace route does not exist or has been relocated.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {authed && (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          )}
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-all"
          >
            <Home className="h-4 w-4" />
            <span>Go Home</span>
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-800/80">
          <a
            href="mailto:support@cwm.io?subject=Broken%20Link%20Report"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-400 transition-colors"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            <span>Report broken link</span>
          </a>
        </div>
      </div>
    </main>
  );
};

export default NotFoundPage;
