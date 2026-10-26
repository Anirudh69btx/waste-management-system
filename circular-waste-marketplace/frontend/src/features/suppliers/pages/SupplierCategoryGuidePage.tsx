import React from "react";
import { Link } from "react-router-dom";
import {
  Recycle,
  Leaf,
  FileText,
  Wrench,
  GlassWater,
  Cpu,
  AlertTriangle,
  Shirt,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { WASTE_CATEGORY_MAP, SEGREGATION_INSTRUCTIONS } from "@/constants/wasteCategories";

// ─── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<number, React.ReactNode> = {
  33: <Leaf className="h-7 w-7 text-emerald-400" />,
  34: <Recycle className="h-7 w-7 text-blue-400" />,
  35: <FileText className="h-7 w-7 text-yellow-400" />,
  36: <Wrench className="h-7 w-7 text-slate-300" />,
  37: <GlassWater className="h-7 w-7 text-teal-400" />,
  38: <Cpu className="h-7 w-7 text-purple-400" />,
  39: <AlertTriangle className="h-7 w-7 text-orange-400" />,
  40: <Shirt className="h-7 w-7 text-pink-400" />,
};

const CARBON_FACTORS: Record<number, number> = {
  33: 0.24,
  34: 1.53,
  35: 0.92,
  36: 1.45,
  37: 0.31,
  38: 3.12,
  39: 0.68,
  40: 0.83,
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SupplierCategoryGuidePage: React.FC = () => {
  const categories = Object.values(WASTE_CATEGORY_MAP);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Recycle className="h-6 w-6 text-brand-400" />
          Waste Category Guide
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Learn accepted items, preparation requirements, and payout rates for each waste category.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => {
          const instructions = SEGREGATION_INSTRUCTIONS[cat.id] ?? [];
          const carbonFactor = CARBON_FACTORS[cat.id] ?? 0.5;
          const icon = CATEGORY_ICONS[cat.id] ?? <Recycle className="h-7 w-7 text-brand-400" />;
          const isHazardous = cat.id === 39;

          return (
            <div
              key={cat.id}
              className={`glass-card rounded-2xl p-6 border flex flex-col gap-5 ${
                isHazardous
                  ? "border-orange-500/30 bg-orange-950/10"
                  : "border-white/10"
              }`}
            >
              {/* Card header */}
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl ${
                    isHazardous ? "bg-orange-500/10" : "bg-slate-800/80"
                  }`}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-white leading-tight">{cat.name}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Category #{cat.id}
                  </p>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-900/80 rounded-xl text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Rate</p>
                  <p className="text-base font-extrabold text-emerald-400">
                    ₹{cat.rate.toFixed(2)}
                    <span className="text-xs font-normal text-slate-400">/kg</span>
                  </p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl text-center">
                  <p className="text-xs text-slate-500 mb-0.5">CO₂e/kg</p>
                  <p className="text-base font-extrabold text-teal-400">
                    {carbonFactor}
                    <span className="text-xs font-normal text-slate-400"> kg</span>
                  </p>
                </div>
              </div>

              {/* Accepted items / instructions */}
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Accepted Items & Prep
                </p>
                <ul className="space-y-1.5">
                  {instructions.map((instruction, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hazardous warning */}
              {isHazardous && (
                <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-300">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  Regulated waste — manifest required, certified driver only.
                </div>
              )}

              {/* CTA */}
              <Link
                to={`/intake?category=${cat.id}`}
                className="flex items-center justify-center gap-2 py-2.5 bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-xl text-sm font-medium hover:bg-brand-500/30 transition-colors"
              >
                Submit this category
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-500 text-center pb-4">
        Rates are indicative benchmarks and subject to weighbridge verification and market conditions.
        Final payout is locked at settlement.
      </p>
    </div>
  );
};
