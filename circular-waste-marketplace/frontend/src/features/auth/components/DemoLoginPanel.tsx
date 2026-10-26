import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Leaf,
  Layers,
  Truck,
  ShoppingBag,
  Shield,
  Loader2,
} from "lucide-react";
import { login } from "@/api/auth";
import { useAuthStore } from "../store";

interface DemoAccount {
  label: string;
  email: string;
  subtitle: string;
  targetRoute: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Supplier",
    email: "supplier@cwm.io",
    subtitle: "Submit waste, track batches",
    targetRoute: "/dashboard",
    icon: Leaf,
    accentClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 group-hover:border-emerald-400/50",
  },
  {
    label: "Sorter",
    email: "sorter@cwm.io",
    subtitle: "Sort intakes, list lots",
    targetRoute: "/sorter/console",
    icon: Layers,
    accentClass:
      "border-blue-500/30 bg-blue-500/10 text-blue-400 group-hover:border-blue-400/50",
  },
  {
    label: "Driver",
    email: "driver@cwm.io",
    subtitle: "Execute pickup trips",
    targetRoute: "/driver/trip",
    icon: Truck,
    accentClass:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 group-hover:border-cyan-400/50",
  },
  {
    label: "Buyer",
    email: "buyer@cwm.io",
    subtitle: "Bid & buy on marketplace",
    targetRoute: "/marketplace",
    icon: ShoppingBag,
    accentClass:
      "border-purple-500/30 bg-purple-500/10 text-purple-400 group-hover:border-purple-400/50",
  },
  {
    label: "Admin",
    email: "admin@cwm.io",
    subtitle: "Fleet, analytics, disputes",
    targetRoute: "/admin/analytics",
    icon: Shield,
    accentClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-400 group-hover:border-amber-400/50",
  },
];

const DEMO_PASSWORD = "Password123!@#";

function isDemoModeEnabled(): boolean {
  const envObj = import.meta.env as Record<string, unknown> | undefined;
  const dynamicVal = envObj ? envObj["VITE_DEMO_MODE"] : undefined;
  if (dynamicVal !== undefined) {
    return String(dynamicVal) === "true";
  }
  return String(import.meta.env.VITE_DEMO_MODE) === "true";
}

export const DemoLoginPanel: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);

  if (!isDemoModeEnabled()) {
    return null;
  }

  const handleDemoLogin = async (account: DemoAccount) => {
    setLoadingEmail(account.email);
    try {
      const authResult = await login({
        email: account.email,
        password: DEMO_PASSWORD,
      });
      setAuth(authResult.user, authResult.tokens);
      toast.success(`Signed in as ${account.label} (${account.email})`);
      navigate(account.targetRoute);
    } catch {
      toast.error("Demo login failed — run seed script");
    } finally {
      setLoadingEmail(null);
    }
  };

  return (
    <section
      aria-label="Demo Accounts"
      className="mt-6 pt-5 border-t border-slate-800/80 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            🎬 Demo Accounts
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            One-click sign-in for reviewers
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          DEMO MODE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => {
          const Icon = account.icon;
          const isCurrentLoading = loadingEmail === account.email;
          const isAnyLoading = loadingEmail !== null;

          return (
            <button
              key={account.email}
              type="button"
              disabled={isAnyLoading}
              onClick={() => handleDemoLogin(account)}
              className="group flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800/70 hover:border-slate-700 text-left transition-all disabled:opacity-50"
            >
              <span
                className={`p-1.5 rounded-lg border shrink-0 transition-colors ${account.accentClass}`}
              >
                {isCurrentLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white">
                    {account.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 truncate">
                    {account.email}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {account.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] font-mono text-slate-500 text-center pt-1">
        Password for all demo accounts: Password123!@#
      </p>
    </section>
  );
};

export default DemoLoginPanel;
