import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Download,
  Printer,
  ArrowLeft,
  UploadCloud,
  Loader2,
  Truck,
  Scale,
  Layers,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/Button";
import { getIntake, getIntakeQr } from "@/api/waste";
import type { WasteIntake, QRCodeResponse } from "@/api/types";
import { AIAssessmentCard } from "@/features/ai/components/AIAssessmentCard";

export const IntakeSuccessPage: React.FC = () => {
  const { intakeId } = useParams<{ intakeId: string }>();
  const navigate = useNavigate();

  const [intake, setIntake] = useState<WasteIntake | null>(null);
  const [qr, setQr] = useState<QRCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!intakeId) {
      navigate("/intake");
      return;
    }

    let cancelled = false;

    Promise.all([getIntake(intakeId), getIntakeQr(intakeId)])
      .then(([intakeData, qrData]) => {
        if (cancelled) return;
        setIntake(intakeData);
        setQr(qrData);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.code === 404 || err?.response?.status === 404) {
          navigate("/intake");
        } else {
          setError("Failed to load intake details.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [intakeId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <span className="ml-3 text-slate-400">Loading batch details...</span>
      </div>
    );
  }

  if (error || !intake || !qr) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error || "Batch not found."}</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => navigate("/intake")}
        >
          Back to Intake
        </Button>
      </div>
    );
  }

  const steps = [
    { label: "Submitted", status: "complete", icon: CheckCircle2 },
    { label: "Pickup scheduled", status: "upcoming", icon: Truck },
    { label: "Weighed", status: "upcoming", icon: Scale },
    { label: "Sorted", status: "upcoming", icon: Layers },
    { label: "Listed", status: "upcoming", icon: ShoppingBag },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Success card — visible on screen and print */}
      <div
        id="print-region"
        className="glass-card rounded-3xl p-8 border border-emerald-500/30 bg-emerald-950/20 text-center space-y-6 print:bg-white print:border-gray-300 print:text-black"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="inline-flex h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 items-center justify-center print:bg-emerald-100"
        >
          <CheckCircle2 className="h-8 w-8" />
        </motion.div>

        <div>
          <h2 className="text-xl font-bold text-white print:text-black">
            Batch Successfully Submitted!
          </h2>
          <p className="text-sm text-slate-300 mt-1 print:text-gray-600">
            Batch Code:{" "}
            <span className="font-mono font-bold text-emerald-400 print:text-emerald-700">
              {intake.batch_code}
            </span>
          </p>
        </div>

        {/* What happens next mini-timeline */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-left space-y-3 print:hidden">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Consignment Lifecycle
          </div>
          <div className="grid grid-cols-5 gap-1 pt-1">
            {steps.map((st, idx) => {
              const Icon = st.icon;
              const isCurrent = idx === 0;
              return (
                <div key={st.label} className="flex flex-col items-center text-center space-y-1">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center ${
                      isCurrent
                        ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30"
                        : "bg-slate-800 text-slate-500 border border-slate-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span
                    className={`text-[10px] leading-tight ${
                      isCurrent ? "text-emerald-400 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-left space-y-2 text-sm print:bg-gray-50 print:border-gray-200">
          <div className="flex justify-between">
            <span className="text-slate-400 print:text-gray-500">
              Category:
            </span>
            <span className="text-white font-medium print:text-black">
              {intake.category?.name ?? "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 print:text-gray-500">
              Declared Weight:
            </span>
            <span className="text-white font-medium print:text-black">
              {intake.declared_weight_kg} kg
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 print:text-gray-500">
              Purity Grade:
            </span>
            <span className="text-white font-medium print:text-black">
              {intake.purity_grade}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 print:text-gray-500">Status:</span>
            <span className="text-emerald-400 font-semibold print:text-emerald-700">
              {intake.status}
            </span>
          </div>
        </div>

        {/* AI Assessment Card */}
        <div className="text-left">
          <AIAssessmentCard intakeId={intakeId!} variant="full" />
        </div>

        {/* QR Code — direct base64 data URL, no blob */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-white rounded-2xl shadow-2xl">
            <img
              src={qr.qr_code_data_url}
              alt="Batch QR"
              className="w-40 h-40"
            />
          </div>
          <p className="font-mono text-xs text-slate-400 print:text-gray-500">
            {qr.batch_code}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto print:text-gray-500">
            Affix this QR code manifest onto the container. Sorters and
            weighbridge operators will scan it to verify custody.
          </p>
        </div>
      </div>

      {/* Action buttons — hidden on print */}
      <div className="flex flex-wrap justify-center gap-3 print:hidden">
        <Button
          variant="secondary"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          <span>Print Manifest</span>
        </Button>

        <a
          download={`${qr.batch_code}.png`}
          href={qr.qr_code_data_url}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Download QR</span>
        </a>

        <Button variant="secondary" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Button>

        <Button onClick={() => navigate("/intake")}>
          <UploadCloud className="h-4 w-4" />
          <span>Submit Another</span>
        </Button>
      </div>
    </div>
  );
};

export default IntakeSuccessPage;
