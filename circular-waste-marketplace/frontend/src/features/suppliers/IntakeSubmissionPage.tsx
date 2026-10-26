import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Scale,
  Cpu,
  FileCheck,
  MapPin,
  Loader2,
  Gift,
  ShoppingBag,
  Info,
  Package,
  FileText,
  Camera,
  Lightbulb,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/Button";
import {
  WASTE_CATEGORY_MAP,
  CATEGORY_SPECIFIC_FIELDS,
  PURITY_GRADES_BY_CATEGORY,
  SEGREGATION_INSTRUCTIONS,
  buildNotesFromCategory,
  estimatePayoutFallback,
} from "@/constants/wasteCategories";
import { ImageUploader } from "./components/ImageUploader";
import { SupplierOnboardingModal } from "./components/SupplierOnboardingModal";
import { getMySupplier } from "@/api/suppliers";
import { submitIntake } from "@/api/waste";
import { apiClient, normalizeApiError } from "@/api/client";
import { useAuthStore } from "@/features/auth/store";
import type { SupplierProfile } from "@/api/types";

// ─── Draft persistence helpers ───────────────────────────────────────────────
interface IntakeDraft {
  category: string;
  purityGrade: string;
  weightKg: string;
  notes: string;
  mode: "sell" | "donate";
  imageMeta: { name: string; size: number; lastModified: number }[];
}

function getDraftKey(userId?: string): string {
  return `cwm.intakeDraft.${userId ?? "anon"}`;
}

function loadDraft(userId?: string): IntakeDraft | null {
  try {
    const raw = localStorage.getItem(getDraftKey(userId));
    return raw ? (JSON.parse(raw) as IntakeDraft) : null;
  } catch {
    return null;
  }
}

function clearDraft(userId?: string) {
  localStorage.removeItem(getDraftKey(userId));
}

// ─── Category entries ────────────────────────────────────────────────────────
const CATEGORY_ENTRIES = Object.entries(WASTE_CATEGORY_MAP);

const HAZARDOUS_CATEGORY_ID = 39;

// ─── Pricing quote fetcher ───────────────────────────────────────────────────
async function fetchPricingQuote(
  categoryId: number,
  purityGrade: string
): Promise<number | null> {
  try {
    const res = await apiClient.get<any>(
      `/pricing/quote?category_id=${categoryId}&purity_grade=${purityGrade}&moisture_content_percent=0&contamination_percent=0`
    );
    return res.data?.effective_price_per_kg ?? null;
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export const IntakeSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  // Supplier state
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // ── Mode: sell or donate ──────────────────────────────────────────────────
  const [mode, setMode] = useState<"sell" | "donate">("sell");

  // Form state
  const [category, setCategory] = useState("ORGANIC_BIOMASS");
  const [purityGrade, setPurityGrade] = useState("GRADE_A");
  const [weightKg, setWeightKg] = useState("250");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<File[]>([]);

  // Category-specific fields state (cleared on category change)
  const [categoryFields, setCategoryFields] = useState<Record<string, string | number>>({});

  // HAZARDOUS gate
  const [hazardousAcknowledged, setHazardousAcknowledged] = useState(false);

  // Pricing estimate
  const [pricingRate, setPricingRate] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // Draft debounce ref
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pricing debounce ref
  const pricingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCategoryEntry = WASTE_CATEGORY_MAP[category];
  const selectedCategoryId = selectedCategoryEntry?.id;
  const isHazardous = selectedCategoryId === HAZARDOUS_CATEGORY_ID;

  // Resolve category from ?category=ID query param on mount
  useEffect(() => {
    const catParam = searchParams.get("category");
    if (catParam) {
      const match = Object.entries(WASTE_CATEGORY_MAP).find(
        ([, v]) => String(v.id) === catParam
      );
      if (match) setCategory(match[0]);
    }
  }, [searchParams]);

  // ── Load supplier on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getMySupplier()
      .then((s) => {
        if (cancelled) return;
        setSupplier(s);
        if (!s) setShowModal(true);
      })
      .catch(() => {
        if (!cancelled) setShowModal(true);
      })
      .finally(() => {
        if (!cancelled) setSupplierLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Restore draft on mount ──────────────────────────────────────────────
  useEffect(() => {
    const draft = loadDraft(user?.id);
    if (draft) {
      setCategory(draft.category);
      setPurityGrade(draft.purityGrade);
      setWeightKg(draft.weightKg);
      setNotes(draft.notes);
      if (draft.mode) setMode(draft.mode);
      setHasDraft(true);
    }
  }, [user?.id]);

  // ── Auto-save draft with debounce ───────────────────────────────────────
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const draft: IntakeDraft = {
        category,
        purityGrade,
        weightKg,
        notes,
        mode,
        imageMeta: images.map((f) => ({
          name: f.name,
          size: f.size,
          lastModified: f.lastModified,
        })),
      };
      localStorage.setItem(getDraftKey(user?.id), JSON.stringify(draft));
    }, 500);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [category, purityGrade, weightKg, notes, mode, images, user?.id]);

  // ── Clear category fields on category change ────────────────────────────
  useEffect(() => {
    setCategoryFields({});
    setHazardousAcknowledged(false);
  }, [category]);

  // ── Debounced pricing quote fetch (sell mode only) ──────────────────────
  useEffect(() => {
    if (mode !== "sell" || !selectedCategoryId) {
      setPricingRate(null);
      return;
    }
    if (pricingTimer.current) clearTimeout(pricingTimer.current);
    pricingTimer.current = setTimeout(async () => {
      setPricingLoading(true);
      const rate = await fetchPricingQuote(selectedCategoryId, purityGrade);
      if (rate !== null) {
        setPricingRate(rate);
      } else {
        // Fallback: use estimatePayoutFallback to get per-kg rate from constants
        const fallbackTotal = estimatePayoutFallback(selectedCategoryId, 1, purityGrade);
        setPricingRate(fallbackTotal > 0 ? fallbackTotal : null);
      }
      setPricingLoading(false);
    }, 400);
    return () => {
      if (pricingTimer.current) clearTimeout(pricingTimer.current);
    };
  }, [mode, selectedCategoryId, purityGrade]);

  // ── Rate calculations (KEPT FROM ORIGINAL) ─────────────────────────────
  const gradeMultipliers: Record<string, number> = {
    GRADE_A: 1.0,
    GRADE_B: 0.85,
    GRADE_C: 0.65,
    CONTAMINATED: 0.40,
  };

  const numericWeight = Number(weightKg) || 0;
  const estimatedRate =
    (WASTE_CATEGORY_MAP[category]?.rate ?? 3.5) *
    (gradeMultipliers[purityGrade] ?? 1.0);
  const estimatedTotalPayout = estimatedRate * numericWeight;

  // Purity grades for selected category
  const purityGradesForCategory = PURITY_GRADES_BY_CATEGORY[selectedCategoryId ?? 0] ?? [
    "GRADE_A",
    "GRADE_B",
    "GRADE_C",
    "CONTAMINATED",
  ];
  const purityGradeLabels: Record<string, { label: string; desc: string }> = {
    GRADE_A: { label: "Grade A", desc: "Pure & uncontaminated (100% payout)" },
    GRADE_B: { label: "Grade B", desc: "Minor moisture / dust (85% payout)" },
    GRADE_C: { label: "Grade C", desc: "Moderate impurities (65% payout)" },
    CONTAMINATED: { label: "Mixed / Dirty", desc: "Heavily fouled (40% payout)" },
  };

  // Category-specific field definitions
  const categoryFieldDefs = CATEGORY_SPECIFIC_FIELDS[selectedCategoryId ?? 0] ?? [];

  // Segregation instructions
  const segregationInstructions = SEGREGATION_INSTRUCTIONS[selectedCategoryId ?? 0] ?? [];

  // Submit disabled if HAZARDOUS and not acknowledged
  const submitDisabled =
    isSubmitting ||
    !selectedCategoryId ||
    images.length === 0 ||
    numericWeight <= 0 ||
    (isHazardous && !hazardousAcknowledged);

  // ── Submit handler ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!selectedCategoryId) {
        setSubmitError("Please select a waste category.");
        return;
      }
      if (numericWeight <= 0) {
        setSubmitError("Weight must be greater than 0.");
        return;
      }
      if (images.length === 0) {
        setSubmitError("At least one evidence photo is required.");
        return;
      }
      if (isHazardous && !hazardousAcknowledged) {
        setSubmitError("You must acknowledge hazardous waste handling requirements.");
        return;
      }

      setIsSubmitting(true);
      setUploadPct(0);

      // Build notes from category-specific fields + freeform
      const encodedNotes = buildNotesFromCategory(selectedCategoryId, categoryFields, notes);

      try {
        const result = await submitIntake(
          {
            category_id: selectedCategoryId,
            purity_grade: purityGrade,
            declared_weight_kg: numericWeight,
            notes: encodedNotes || undefined,
          },
          images,
          setUploadPct
        );
        clearDraft(user?.id);
        navigate(`/intake/success/${result.id}`);
      } catch (err: any) {
        const normalized = normalizeApiError(err);
        if (normalized.code === 413) {
          setSubmitError("One or more files exceed the server size limit.");
        } else if (normalized.code === 415) {
          setSubmitError("Invalid file type. Only JPEG, PNG, and WebP are accepted.");
        } else if (normalized.code === 422 && normalized.fieldErrors) {
          const msgs = Object.values(normalized.fieldErrors).join("; ");
          setSubmitError(msgs);
        } else if (normalized.code === 429) {
          const retryIn = normalized.retryAfter ?? 30;
          setSubmitError(`Rate limited. Please retry in ${retryIn}s.`);
        } else {
          setSubmitError(
            `${normalized.detail}${
              normalized.requestId ? ` (ref: ${normalized.requestId})` : ""
            }`
          );
          toast.error("Submission failed. Please try again.");
        }
      } finally {
        setIsSubmitting(false);
        setUploadPct(0);
      }
    },
    [
      selectedCategoryId,
      purityGrade,
      numericWeight,
      notes,
      categoryFields,
      images,
      user?.id,
      navigate,
      isHazardous,
      hazardousAcknowledged,
    ]
  );

  // ── Render ──────────────────────────────────────────────────────────────
  if (supplierLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <span className="ml-3 text-slate-400">Loading supplier profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Supplier Onboarding Modal */}
      <SupplierOnboardingModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(s) => setSupplier(s)}
      />

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-brand-400" />
          <span>Waste Consignment Manifest Intake</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Register segregated waste consignments, trigger instant AI quality
          gating, and generate tamper-proof QR manifests.
        </p>
      </div>

      {/* ── Sell / Donate Toggle ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-700 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode("sell")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "sell"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Sell
        </button>
        <button
          type="button"
          onClick={() => setMode("donate")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "donate"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Gift className="h-4 w-4" />
          Donate
        </button>
      </div>

      {mode === "donate" && (
        <div className="flex items-start gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Donate mode:</strong> No payout will be issued. Your waste will be matched to a
            certified recycling partner at no cost. This earns you Green Rewards points.
          </span>
        </div>
      )}

      {/* Draft restore banner */}
      {hasDraft && (
        <div className="flex items-center justify-between bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-brand-300">
            Draft restored from your last session.
          </span>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-white underline"
            onClick={() => {
              clearDraft(user?.id);
              setCategory("ORGANIC_BIOMASS");
              setPurityGrade("GRADE_A");
              setWeightKg("250");
              setNotes("");
              setImages([]);
              setMode("sell");
              setHasDraft(false);
            }}
          >
            Clear draft
          </button>
        </div>
      )}

      {/* Supplier address card (read-only) */}
      {supplier && (
        <div className="glass-card rounded-xl p-4 border border-white/10 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-brand-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-white">
              {supplier.business_name}
            </div>
            <div className="text-xs text-slate-400">
              Pickup from: {supplier.facility_address}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Photo Upload Zone — now uses ImageUploader */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Camera className="h-4 w-4 text-brand-400" />
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  1. Waste Evidence Photos
                </label>
              </div>
              <ImageUploader
                value={images}
                onChange={setImages}
                disabled={isSubmitting}
              />
            </div>

            {/* 2. Material Category & Weight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-brand-400" />
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    2. Material Category
                  </label>
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  {CATEGORY_ENTRIES.map(([code, cat]) => (
                    <option key={code} value={code}>
                      {cat.name} (₹{cat.rate.toFixed(2)}/{cat.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="h-4 w-4 text-brand-400" />
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    3. Declared Weight (kg)
                  </label>
                </div>

                {/* Segregation instructions above weight input */}
                {segregationInstructions.length > 0 && (
                  <details className="mb-2">
                    <summary className="cursor-pointer text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 list-none">
                      <Info className="h-3 w-3" />
                      Segregation requirements
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4">
                      {segregationInstructions.map((inst, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                          {inst}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="relative">
                  <Scale className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* Category-specific fields */}
            {categoryFieldDefs.length > 0 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Category-Specific Details
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoryFieldDefs.map((def) => (
                    <div key={def.key}>
                      <label className="block text-xs text-slate-400 mb-1">
                        {def.label}
                        {def.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {def.type === "select" && def.options ? (
                        <select
                          value={String(categoryFields[def.key] ?? "")}
                          onChange={(e) =>
                            setCategoryFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                          }
                          disabled={isSubmitting}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                        >
                          <option value="">Select {def.label}…</option>
                          {def.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : def.type === "number" ? (
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={String(categoryFields[def.key] ?? "")}
                          onChange={(e) =>
                            setCategoryFields((prev) => ({
                              ...prev,
                              [def.key]: e.target.value,
                            }))
                          }
                          disabled={isSubmitting}
                          placeholder={def.label}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(categoryFields[def.key] ?? "")}
                          onChange={(e) =>
                            setCategoryFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                          }
                          disabled={isSubmitting}
                          placeholder={def.label}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Purity Grade — chips from PURITY_GRADES_BY_CATEGORY */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                4. Initial Segregation Grade
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {purityGradesForCategory.map((grade) => {
                  const info = purityGradeLabels[grade] ?? { label: grade, desc: "" };
                  return (
                    <button
                      type="button"
                      key={grade}
                      disabled={isSubmitting}
                      onClick={() => setPurityGrade(grade)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        purityGrade === grade
                          ? "bg-brand-500/10 border-brand-500 text-brand-300"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="font-semibold text-xs text-white">{info.label}</div>
                      <div className="text-[10px] mt-0.5 leading-tight">{info.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* HAZARDOUS gate */}
            {isHazardous && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-3">
                <div className="flex items-start gap-2 text-sm text-orange-300">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Hazardous Waste — Compliance Required</p>
                    <p className="text-xs text-orange-400 mt-1">
                      Industrial Hazardous Waste requires proper manifesting, certified handling,
                      and regulatory compliance. Incorrect disposal is a criminal offence.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hazardousAcknowledged}
                    onChange={(e) => setHazardousAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-slate-300">
                    I confirm this waste is properly classified, contained, and I have the required
                    permits and manifest documentation. I accept liability for regulatory compliance.
                  </span>
                </label>
              </div>
            )}

            {/* 5. Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                5. Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                disabled={isSubmitting}
                rows={3}
                placeholder="E.g., Wet organic from cafeteria, stored <24h..."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
              />
              <div className="text-right text-[11px] text-slate-500 mt-1">
                {notes.length}/500
              </div>
            </div>

            {/* Upload progress bar */}
            {isSubmitting && uploadPct > 0 && uploadPct < 100 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Uploading evidence photos...</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error display */}
            {submitError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitDisabled}
              aria-label={`Submit batch (${images.length} photo${images.length !== 1 ? "s" : ""})`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <FileCheck className="h-5 w-5" />
                  <span>
                    {mode === "sell" ? "Sell" : "Donate"} batch ({images.length} photo
                    {images.length !== 1 ? "s" : ""})
                  </span>
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Right Col: Instant Valuation & Biogas Estimator (KEPT FROM ORIGINAL) */}
        <div className="space-y-6">
          {/* Helpful Intake Guidance Hint */}
          <div className="glass-card rounded-2xl p-5 border border-amber-500/20 bg-amber-950/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span>Inspection Tip</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Clear photos showing top and side angles speed up ONNX AI assessment and reduce gate weight discrepancies during sorting.
            </p>
          </div>

          {/* Estimated payout card — sell mode only */}
          {mode === "sell" && (
            <div className={`glass-card rounded-2xl p-6 border border-white/10 space-y-4 ${pricingLoading ? "animate-pulse" : ""}`}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>Real-Time Valuation Quote</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">
                    Base Benchmark Rate:
                  </span>
                  <span className="text-sm font-semibold text-slate-200">
                    ₹{(WASTE_CATEGORY_MAP[category]?.rate ?? 3.5).toFixed(2)}/kg
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">
                    Grade Multiplier:
                  </span>
                  <span className="text-sm font-semibold text-brand-400">
                    {(gradeMultipliers[purityGrade] ?? 1) * 100}%
                  </span>
                </div>
                {pricingLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Fetching live quote…
                  </div>
                ) : pricingRate !== null ? (
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">
                      Live Effective Rate:
                    </span>
                    <span className="text-sm font-bold text-emerald-400">
                      ₹{pricingRate.toFixed(2)}/kg
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">
                      Effective Unit Price:
                    </span>
                    <span className="text-sm font-bold text-emerald-400">
                      ₹{estimatedRate.toFixed(2)}/kg
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-300">
                    Estimated Escrow Payout:
                  </span>
                  <span className="text-xl font-extrabold text-white">
                    ₹
                    {pricingRate !== null
                      ? Math.round(pricingRate * numericWeight).toLocaleString()
                      : estimatedTotalPayout.toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Final payout is locked upon physical weighbridge verification and
                sorter contamination assay.
              </p>
            </div>
          )}

          {mode === "donate" && (
            <div className="glass-card rounded-2xl p-6 border border-emerald-500/20 bg-emerald-950/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Gift className="h-4 w-4" />
                Donation Impact
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Green Rewards:</span>
                  <span className="font-bold text-emerald-300">
                    +{Math.round(numericWeight * 10)} pts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CO₂e offset:</span>
                  <span className="font-bold text-teal-300">
                    {(numericWeight * 0.82).toFixed(1)} kg
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Organic Biogas & Energy Recovery Yield */}
          {category === "ORGANIC_BIOMASS" && (
            <div className="glass-card rounded-2xl p-6 border border-brand-500/20 bg-brand-950/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider">
                <Cpu className="h-4 w-4" />
                <span>Anaerobic Biogas Estimate</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Est. Methane Yield (CH₄):
                  </span>
                  <span className="font-bold text-white">
                    {(numericWeight * 0.85 * 0.35).toFixed(1)} m³
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Renewable Energy Eqv:</span>
                  <span className="font-bold text-white">
                    {(numericWeight * 0.85 * 0.35 * 9.97).toFixed(1)} kWh
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Grid CO₂e Displacement:
                  </span>
                  <span className="font-bold text-emerald-400">
                    {(numericWeight * 0.85 * 0.35 * 9.97 * 0.82).toFixed(1)} kg
                    CO₂e
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
