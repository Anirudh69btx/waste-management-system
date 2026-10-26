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
  Cpu,
  BarChart3,
  Layers,
  ShoppingBag,
  Camera,
  Scale,
} from "lucide-react";

import { useAuthStore } from "@/features/auth/store";
import { Button } from "@/components/Button";
import { AnimatedCounter } from "@/components/charts/AnimatedCounter";
import { PageTransition } from "@/components/PageTransition";

export const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const authed = isAuthenticated();

  return (
    <PageTransition className="space-y-20 py-8 text-slate-100">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto space-y-6 pt-6 sm:pt-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
          <Sparkles className="h-4 w-4" />
          <span>🌱 AI-powered circular economy</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Turn waste into value.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-brand-400 bg-clip-text text-transparent">
            Save the planet.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          The verified circular marketplace connecting waste generators, recyclers, and logistics
          fleets with AI purity assessment, live telemetry, and instant escrow settlements.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          {authed ? (
            <Link to="/dashboard">
              <Button size="lg" className="shadow-lg shadow-brand-500/20">
                <span>Go to Dashboard ({user?.role})</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button size="lg" className="shadow-lg shadow-brand-500/20">
                  <span>Try the demo</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="secondary" size="lg">
                  <span>Get Started</span>
                </Button>
              </Link>
            </>
          )}

          <Link to={authed ? "/admin/analytics" : "/login"}>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-sm font-semibold text-slate-200 transition-colors"
            >
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              <span>See impact dashboard</span>
            </button>
          </Link>
        </div>

        {/* Proof Strip */}
        <div className="pt-3">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-medium text-slate-400 bg-slate-900/70 border border-slate-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            394 tests · 12 subsystems · Production-ready
          </span>
        </div>

        {/* Value Badges */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>AI Purity Grading</span>
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Real-time Custody Tracking</span>
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Role-Based Access Control</span>
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Token Rotation & Escrow Lock</span>
          </span>
        </div>
      </section>

      {/* 4-Column Impact Stats Strip */}
      <section className="max-w-5xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Diverted Material
            </p>
            <div className="text-3xl sm:text-4xl font-extrabold text-white flex items-center justify-center">
              <AnimatedCounter value={24.5} />
              <span className="text-xl sm:text-2xl text-emerald-400 ml-1">t</span>
            </div>
            <p className="text-[11px] text-slate-400">From verified landfills</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              CO₂e Offset
            </p>
            <div className="text-3xl sm:text-4xl font-extrabold text-white flex items-center justify-center">
              <AnimatedCounter value={18.3} />
              <span className="text-xl sm:text-2xl text-teal-400 ml-1">t</span>
            </div>
            <p className="text-[11px] text-slate-400">Avoided carbon emissions</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Transactions Settled
            </p>
            <div className="text-3xl sm:text-4xl font-extrabold text-white">
              <AnimatedCounter value={835} />
            </div>
            <p className="text-[11px] text-slate-400">Escrow backed orders</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Hubs
            </p>
            <div className="text-3xl sm:text-4xl font-extrabold text-white flex items-center justify-center">
              <AnimatedCounter value={25} />
              <span className="text-xl sm:text-2xl text-emerald-400 ml-0.5">+</span>
            </div>
            <p className="text-[11px] text-slate-400">Regional sorting centers</p>
          </div>
        </div>
      </section>

      {/* 3 Core Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="glass-card rounded-2xl p-6 border border-slate-800 hover:border-emerald-500/40 transition-all duration-200 hover:-translate-y-1 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Cpu className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-white">AI Classification</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Computer Vision edge models assess feedstock contamination, detect polymer categories,
            and assign objective purity grades (A/B/C) in under 120ms.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-slate-800 hover:border-brand-500/40 transition-all duration-200 hover:-translate-y-1 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Truck className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-white">Live Logistics</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Real-time GPS telemetry, digital weight tickets, and tamper-resistant chain-of-custody
            from generator intake to certified processing yards.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-slate-800 hover:border-teal-500/40 transition-all duration-200 hover:-translate-y-1 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-white">Fair Marketplace</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Traceable inventory lots, transparent bidding, and two-stage escrow settlements
            that protect both generators and industrial recyclers.
          </p>
        </div>
      </section>

      {/* 4-Step How It Works Flow */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">How the Platform Works</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            From initial batch intake to secondary material trade in 4 verified steps
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-brand-400">
                <Camera className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">01</span>
            </div>
            <h3 className="text-sm font-semibold text-white">1. 📸 Upload + AI</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generator logs intake and photo. Edge AI instantly validates category and detects contamination.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-brand-400">
                <Truck className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">02</span>
            </div>
            <h3 className="text-sm font-semibold text-white">2. 🚚 Pickup</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dispatched driver picks up batch, scans QR custody code, and records verified weight ticket.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-emerald-400">
                <Layers className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">03</span>
            </div>
            <h3 className="text-sm font-semibold text-white">3. ♻️ Sort</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sorter console records sorting output, assigns purity grade, and creates clean inventory lots.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-teal-400">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">04</span>
            </div>
            <h3 className="text-sm font-semibold text-white">4. 🛒 Sell</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lots list on the secondary marketplace with automated bid matching and escrow payment locks.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Strip */}
      <section className="max-w-4xl mx-auto rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 p-8 text-center space-y-4 shadow-xl">
        <h2 className="text-2xl font-bold text-white">Ready to see it live?</h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
          Explore all 5 personas with pre-loaded demo credentials and live sample data.
        </p>
        <div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <span>Open the demo →</span>
          </Link>
        </div>
      </section>
    </PageTransition>
  );
};

export default HomePage;
