import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Scale,
  Percent,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

export const SorterIntakePage: React.FC = () => {
  const [batchCode, setBatchCode] = useState("CWM-LOT-882194");
  const [declaredWeight, setDeclaredWeight] = useState(450.0);
  const [grossWeight, setGrossWeight] = useState(620.0);
  const [tareWeight, setTareWeight] = useState(180.0);
  const [moisturePercent, setMoisturePercent] = useState(6.5);
  const [contaminationPercent, setContaminationPercent] = useState(2.0);
  const [verifiedLotCreated, setVerifiedLotCreated] = useState<string | null>(null);

  const netWeight = Math.max(0, grossWeight - tareWeight);
  const discrepancyPercent = declaredWeight > 0 ? ((netWeight - declaredWeight) / declaredWeight) * 100 : 0;
  const isDiscrepant = Math.abs(discrepancyPercent) > 5.0;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const lotId = "LOT-CERT-" + Math.floor(1000 + Math.random() * 9000);
    setVerifiedLotCreated(lotId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-brand-400" />
          <span>Aggregator Sorter Verification & Weighbridge Console</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Inbound consignment weighbridge calibration, automated tare subtraction, and moisture/contamination assay.
        </p>
      </div>

      {verifiedLotCreated ? (
        <div className="glass-card rounded-3xl p-8 border border-emerald-500/30 bg-emerald-950/20 text-center space-y-5">
          <div className="inline-flex h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 items-center justify-center">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Consignment Verified & Certified!</h2>
            <p className="text-xs text-slate-300 mt-1">
              Certified Lot Token: <span className="font-mono text-emerald-400 font-bold">{verifiedLotCreated}</span>
            </p>
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Net weight of {netWeight.toFixed(1)} kg recorded with {contaminationPercent}% contamination deduction.
            The batch has been forwarded to the certified feedstock marketplace.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setVerifiedLotCreated(null)}>
              Scan Next Batch
            </Button>
            <Button onClick={() => (window.location.href = "/marketplace")}>
              View in Marketplace Feed
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Inspection Form */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10 space-y-6">
            <form onSubmit={handleVerify} className="space-y-6">
              {/* Scan Bar */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Inbound Batch QR Scan
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <QrCode className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={batchCode}
                      onChange={(e) => setBatchCode(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100"
                    />
                  </div>
                  <Button type="button" variant="secondary">
                    Lookup Manifest
                  </Button>
                </div>
              </div>

              {/* Weighbridge Gross & Tare */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Gross Weight on Scale (kg)
                  </label>
                  <input
                    type="number"
                    value={grossWeight}
                    onChange={(e) => setGrossWeight(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Tare / Container Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={tareWeight}
                    onChange={(e) => setTareWeight(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100"
                  />
                </div>
              </div>

              {/* Lab Assay Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Moisture Content (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={moisturePercent}
                    onChange={(e) => setMoisturePercent(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Contamination Ratio (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={contaminationPercent}
                    onChange={(e) => setContaminationPercent(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100"
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full">
                <CheckCircle2 className="h-5 w-5" />
                <span>Certify Lot & Settle Custody</span>
              </Button>
            </form>
          </div>

          {/* Right Col: Tare Breakdown & Discrepancy Gate */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Scale className="h-4 w-4 text-brand-400" />
                <span>Weighbridge Calculation</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Declared Weight:</span>
                  <span className="font-mono text-slate-200">{declaredWeight.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Measured Net Weight:</span>
                  <span className="font-mono font-bold text-white">{netWeight.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Scale Variance:</span>
                  <span
                    className={`font-mono font-bold ${
                      isDiscrepant ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {discrepancyPercent >= 0 ? "+" : ""}
                    {discrepancyPercent.toFixed(1)}%
                  </span>
                </div>

                {isDiscrepant && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-start gap-2 text-[11px]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Weight variance exceeds &plusmn;5% threshold. An automated escrow adjustment ticket will be generated.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
