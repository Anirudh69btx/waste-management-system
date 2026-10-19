import React from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Truck,
  Award,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import { useAuthStore } from "@/features/auth/store";
import { Button } from "@/components/Button";

export const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const authed = isAuthenticated();
  const appName = import.meta.env.VITE_APP_NAME || "Circular Waste Marketplace";

  return (
    <div className="space-y-20 py-8 text-text-primary">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto space-y-6 pt-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-semibold text-brand-400">
          <Sparkles className="h-4 w-4" />
          <span>Industrial Secondary Resource Exchange</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Recycle smarter. Earn more.{" "}
          <span className="gradient-text">Save the planet.</span>
        </h1>

        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          The verified circular marketplace connecting waste generators, recyclers, and logistics
          fleets with transparent pricing, quality-gated materials, and authenticated chain-of-custody.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          {authed ? (
            <Link to="/dashboard">
              <Button size="lg" className="shadow-glow-brand">
                <span>Go to Dashboard ({user?.role})</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <Button size="lg" className="shadow-glow-brand">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" size="lg">
                  <span>Sign In</span>
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Value Badges */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-text-muted">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-400" />
            <span>AI Purity Grading</span>
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-400" />
            <span>Real-time Custody Tracking</span>
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-400" />
            <span>Role-Based Access Control</span>
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <span>Token Rotation & Replay Defense</span>
          </span>
        </div>
      </section>

      {/* 3 Core Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {/* Feature 1: Waste Tracking */}
        <div className="glass-card glass-card-hover rounded-2xl p-6 border border-border-subtle space-y-3">
          <div className="h-12 w-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Truck className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-white">Waste Tracking & Custody</h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            Live GPS telemetry, QR manifest verification, and tamper-resistant chain-of-custody
            from generator intake to certified processing yards.
          </p>
        </div>

        {/* Feature 2: Fair Pricing */}
        <div className="glass-card glass-card-hover rounded-2xl p-6 border border-border-subtle space-y-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-white">Fair Dynamic Pricing</h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            Scientific pricing engine calibrated against benchmark indices, purity grades, and moisture
            content deductions for maximum market transparency.
          </p>
        </div>

        {/* Feature 3: Green Rewards */}
        <div className="glass-card glass-card-hover rounded-2xl p-6 border border-border-subtle space-y-3">
          <div className="h-12 w-12 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center text-brand-400">
            <Award className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-white">Green Rewards Wallet</h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            Earn eco-points and circular loyalty incentives for segregated feedstock batches, redeemable
            against eco-products and processing discounts.
          </p>
        </div>
      </section>

      {/* Landing Footer */}
      <footer className="pt-12 border-t border-border-subtle text-center text-xs text-text-muted space-y-2">
        <p>
          {appName} &bull; Version 1.0.0
        </p>
        <p className="text-[11px] text-text-muted/80">
          Built for zero-waste industrial circular supply chains. Protected by RFC-7807 and JWT token rotation.
        </p>
      </footer>
    </div>
  );
};
