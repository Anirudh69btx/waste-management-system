import React, { useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  QrCode,
  DollarSign,
  Scale,
  Cpu,
  FileCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface QualityMetric {
  ok: boolean;
  score: number;
  blur_score: number;
  brightness: number;
  resolution: string;
}

export const IntakeSubmissionPage: React.FC = () => {
  const [category, setCategory] = useState("ORGANIC_BIOMASS");
  const [weightKg, setWeightKg] = useState<number>(250);
  const [purityGrade, setPurityGrade] = useState("GRADE_A");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [qualityResult, setQualityResult] = useState<QualityMetric | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  // Benchmarks by category
  const baseRates: Record<string, number> = {
    ORGANIC_BIOMASS: 3.50,
    PLASTIC_PET: 18.00,
    PAPER_CARDBOARD: 9.50,
    FERROUS_METAL: 28.00,
    GLASS: 4.00,
    E_WASTE: 65.00,
    HAZARDOUS: 12.00,
    TEXTILE: 14.00,
  };

  const gradeMultipliers: Record<string, number> = {
    GRADE_A: 1.0,
    GRADE_B: 0.85,
    GRADE_C: 0.65,
    CONTAMINATED: 0.40,
  };

  const estimatedRate = (baseRates[category] || 3.50) * (gradeMultipliers[purityGrade] || 1.0);
  const estimatedTotalPayout = estimatedRate * weightKg;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setImagePreview(url);
      setAnalyzingImage(true);

      // Simulate AI quality gate inspection
      setTimeout(() => {
        setQualityResult({
          ok: true,
          score: 0.88,
          blur_score: 342.5,
          brightness: 138.2,
          resolution: "1280 x 960 px",
        });
        setAnalyzingImage(false);
      }, 800);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const batchId = "CWM-LOT-" + Math.floor(100000 + Math.random() * 900000);
    setSubmissionSuccess(batchId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-brand-400" />
          <span>Waste Consignment Manifest Intake</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Register segregated waste consignments, trigger instant AI quality gating, and generate tamper-proof QR manifests.
        </p>
      </div>

      {submissionSuccess ? (
        <div className="glass-card rounded-3xl p-8 border border-emerald-500/30 bg-emerald-950/20 text-center space-y-6">
          <div className="inline-flex h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Consignment Successfully Registered!</h2>
            <p className="text-sm text-slate-300 mt-1">
              Batch Manifest ID: <span className="font-mono font-bold text-emerald-400">{submissionSuccess}</span>
            </p>
          </div>

          <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-2xl">
            <QRCodeSVG value={`https://cwm.io/manifest/${submissionSuccess}`} size={160} />
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Affix this cryptographic QR code manifest onto the container. Sorters and weighbridge operators will scan this to verify custody.
          </p>

          <div className="flex justify-center gap-4">
            <Button onClick={() => setSubmissionSuccess(null)} variant="secondary">
              Submit Another Batch
            </Button>
            <Button onClick={() => (window.location.href = "/pickups")}>Schedule Logistics Pickup</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Upload Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  1. Waste Evidence Photos (AI Quality Gated)
                </label>
                <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500/60 rounded-2xl p-6 text-center transition-colors bg-slate-900/40">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {imagePreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={imagePreview}
                        alt="Uploaded batch evidence"
                        className="h-44 w-auto rounded-xl object-cover border border-slate-700 shadow-md"
                      />
                      <span className="text-xs text-brand-400 font-medium">Click or drag to replace photo</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="h-12 w-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-semibold text-slate-200">
                        Drop high-resolution photos here, or click to browse
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Images are checked in real-time for motion blur (Laplacian variance), brightness, and resolution.
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Gating Status Indicator */}
                {analyzingImage && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl animate-pulse">
                    <Sparkles className="h-4 w-4" />
                    <span>Evaluating Laplacian blur variance and perceptual similarity...</span>
                  </div>
                )}

                {qualityResult && (
                  <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>AI Quality Gate Passed (Composite Score: {qualityResult.score})</span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                      <span>Sharpness: {qualityResult.blur_score}</span>
                      <span>Res: {qualityResult.resolution}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Material Category & Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    2. Material Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="ORGANIC_BIOMASS">Organic & Food Waste (₹3.50/kg)</option>
                    <option value="PLASTIC_PET">PET Plastics Bottle Flakes (₹18.00/kg)</option>
                    <option value="PAPER_CARDBOARD">Corrugated Cardboard (₹9.50/kg)</option>
                    <option value="FERROUS_METAL">Ferrous Scrap Metal (₹28.00/kg)</option>
                    <option value="GLASS">Flint & Bottle Glass (₹4.00/kg)</option>
                    <option value="E_WASTE">Non-Hazardous E-Waste (₹65.00/kg)</option>
                    <option value="TEXTILE">Textile & Fabric Offcuts (₹14.00/kg)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    3. Declared Wet Weight (kg)
                  </label>
                  <div className="relative">
                    <Scale className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="number"
                      min="1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Purity Grade Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  4. Initial Segregation Grade
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { grade: "GRADE_A", label: "Grade A", desc: "Pure & uncontaminated (100% payout)" },
                    { grade: "GRADE_B", label: "Grade B", desc: "Minor moisture / dust (85% payout)" },
                    { grade: "GRADE_C", label: "Grade C", desc: "Moderate impurities (65% payout)" },
                    { grade: "CONTAMINATED", label: "Mixed / Dirty", desc: "Heavily fouled (40% payout)" },
                  ].map((g) => (
                    <button
                      type="button"
                      key={g.grade}
                      onClick={() => setPurityGrade(g.grade)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        purityGrade === g.grade
                          ? "bg-brand-500/10 border-brand-500 text-brand-300"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="font-semibold text-xs text-white">{g.label}</div>
                      <div className="text-[10px] mt-0.5 leading-tight">{g.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full">
                <FileCheck className="h-5 w-5" />
                <span>Submit & Generate Custody Manifest</span>
              </Button>
            </form>
          </div>

          {/* Right Col: Instant Valuation & Biogas Estimator */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>Real-Time Valuation Quote</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">Base Benchmark Rate:</span>
                  <span className="text-sm font-semibold text-slate-200">₹{baseRates[category]?.toFixed(2)}/kg</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">Grade Multiplier:</span>
                  <span className="text-sm font-semibold text-brand-400">{gradeMultipliers[purityGrade] * 100}%</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">Effective Unit Price:</span>
                  <span className="text-sm font-bold text-emerald-400">₹{estimatedRate.toFixed(2)}/kg</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-300">Estimated Escrow Payout:</span>
                  <span className="text-xl font-extrabold text-white">₹{estimatedTotalPayout.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Final payout is locked upon physical weighbridge verification and sorter contamination assay.
              </p>
            </div>

            {/* Organic Biogas & Energy Recovery Yield */}
            {category === "ORGANIC_BIOMASS" && (
              <div className="glass-card rounded-2xl p-6 border border-brand-500/20 bg-brand-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider">
                  <Cpu className="h-4 w-4" />
                  <span>Anaerobic Biogas Estimate</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. Methane Yield (CH₄):</span>
                    <span className="font-bold text-white">{(weightKg * 0.85 * 0.35).toFixed(1)} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Renewable Energy Eqv:</span>
                    <span className="font-bold text-white">{(weightKg * 0.85 * 0.35 * 9.97).toFixed(1)} kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Grid CO₂e Displacement:</span>
                    <span className="font-bold text-emerald-400">
                      {(weightKg * 0.85 * 0.35 * 9.97 * 0.82).toFixed(1)} kg CO₂e
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
