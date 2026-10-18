import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Recycle, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";
import { useAuthStore } from "./authStore";
import { UserRole } from "@/api/types";
import { Button } from "@/components/Button";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, demoLogin } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      // Simulate successful login
      login("jwt-token-" + Date.now(), {
        id: "usr-" + Date.now(),
        email: email || "supplier@cwm.io",
        full_name: "Green Earth Organics Ltd",
        role: "GENERATOR",
        organization_name: "Green Earth Agro",
        is_active: true,
        is_verified: true,
      });
      setIsLoading(false);
      navigate("/dashboard");
    }, 600);
  };

  const handleQuickDemo = (role: UserRole) => {
    demoLogin(role);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-card rounded-3xl p-8 border border-white/10 relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-xl shadow-brand-500/20 mb-4">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Recycle className="h-7 w-7 text-brand-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Circular Waste Marketplace</h1>
          <p className="text-xs text-slate-400 mt-1">Sign in to your industrial circular exchange account</p>
        </div>

        {/* Quick Demo One-Click Access */}
        <div className="mb-6 p-4 rounded-2xl bg-brand-950/40 border border-brand-500/20">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 mb-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Instant Demo Switcher (No Password Required)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickDemo("GENERATOR")}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-700 hover:border-brand-500 text-slate-200 transition-colors"
            >
              🌱 Supplier
            </button>
            <button
              onClick={() => handleQuickDemo("RECYCLER")}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-700 hover:border-brand-500 text-slate-200 transition-colors"
            >
              🏭 Sorter / Recycler
            </button>
            <button
              onClick={() => handleQuickDemo("LOGISTICS")}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-700 hover:border-brand-500 text-slate-200 transition-colors"
            >
              🚛 Driver
            </button>
            <button
              onClick={() => handleQuickDemo("ADMIN")}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-700 hover:border-brand-500 text-slate-200 transition-colors"
            >
              ⚡ Admin
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Corporate Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full mt-2">
            <span>Continue to Platform</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          <span>Need an industrial feedstock account? </span>
          <Link to="/" className="text-brand-400 hover:underline">
            View public marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};
