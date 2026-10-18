import React from "react";
import { Link } from "react-router-dom";
import {
  Recycle,
  ShieldCheck,
  Cpu,
  TrendingUp,
  Truck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <div className="relative text-center max-w-4xl mx-auto space-y-6 pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-semibold text-brand-400">
          <Sparkles className="h-4 w-4" />
          <span>Next-Generation Secondary Material Marketplace</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Turn Segregated Waste into{" "}
          <span className="gradient-text">High-Purity Circular Feedstock</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Empowering suppliers, sorters, and industrial buyers with automated AI quality gating,
          dynamic benchmark pricing, real-time custody tracking, and escrow settlement.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link to="/intake">
            <Button size="lg">
              <span>Submit Waste Batch</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="secondary" size="lg">
              <span>Browse Certified Feedstock</span>
            </Button>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> AI Laplacian Quality Gating
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Scientific BMP Biogas Yield
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Cryptographic QR Custody
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Automated Escrow Payouts
          </span>
        </div>
      </div>

      {/* 4 Pillars Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card glass-card-hover rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Cpu className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">AI Vision & Quality Gate</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Laplacian blur detection, brightness evaluation, resolution gates, and ONNX classification ensure only clean feedstock enters the pipeline.
          </p>
        </div>

        <div className="glass-card glass-card-hover rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">Dynamic Pricing Engine</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Market-aligned ₹/kg pricing algorithm adjusting for moisture content variance, contamination deductions, and purity grades.
          </p>
        </div>

        <div className="glass-card glass-card-hover rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Truck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">Custody & Live Tracking</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            HMAC-SHA256 signed QR manifests, live vehicle GPS telemetry via Redis Pub/Sub, and weighbridge tare calibration.
          </p>
        </div>

        <div className="glass-card glass-card-hover rounded-2xl p-6 border border-white/10 space-y-3">
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">Escrow & Loyalty Rewards</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Stripe/Razorpay escrow protects both sellers and buyers, while eco-points reward consistent daily recycling streaks.
          </p>
        </div>
      </div>
    </div>
  );
};
