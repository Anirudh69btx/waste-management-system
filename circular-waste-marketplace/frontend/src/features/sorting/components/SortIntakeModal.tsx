import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, AlertTriangle, Layers, CheckCircle2, Info } from "lucide-react";
import toast from "react-hot-toast";
import { processSorting } from "@/api/sorting";
import type { WasteIntakeListItem, InventoryLotCreate } from "@/api/types";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";

export interface SortIntakeModalProps {
  open: boolean;
  onClose: () => void;
  intake: WasteIntakeListItem | null;
  onSorted: () => void;
}

interface LotFormItem {
  category_id: number;
  quantity_kg: number | "";
  grade: "GRADE_A" | "GRADE_B" | "GRADE_C";
  contamination_percent: number | "";
  moisture_percent?: number | "" | null;
  hub_location?: string;
}

const STREAM_GROUPS: Record<"DRY_RECYCLABLE" | "ORGANIC" | "HAZARDOUS", number[]> = {
  DRY_RECYCLABLE: [34, 35, 36, 37, 40],
  ORGANIC: [33],
  HAZARDOUS: [38, 39],
};

function getStreamClass(categoryId: number): "DRY_RECYCLABLE" | "ORGANIC" | "HAZARDOUS" | "UNKNOWN" {
  if (STREAM_GROUPS.DRY_RECYCLABLE.includes(categoryId)) return "DRY_RECYCLABLE";
  if (STREAM_GROUPS.ORGANIC.includes(categoryId)) return "ORGANIC";
  if (STREAM_GROUPS.HAZARDOUS.includes(categoryId)) return "HAZARDOUS";
  return "UNKNOWN";
}

export const SortIntakeModal: React.FC<SortIntakeModalProps> = ({
  open,
  onClose,
  intake,
  onSorted,
}) => {
  const intakeCatId = useMemo(() => {
    if (!intake) return 34;
    return typeof intake.category === "object" && intake.category !== null
      ? intake.category.id
      : Number(intake.category || 34);
  }, [intake]);

  const intakeStream = useMemo(() => getStreamClass(intakeCatId), [intakeCatId]);

  // Form State
  const [inputWeight, setInputWeight] = useState<number | "">("");
  const [sortedWeight, setSortedWeight] = useState<number | "">("");
  const [rejectedWeight, setRejectedWeight] = useState<number | "">(0);
  const [sortGrade, setSortGrade] = useState<"GRADE_A" | "GRADE_B" | "GRADE_C">("GRADE_A");
  const [contaminationPercent, setContaminationPercent] = useState<number | "">(5);
  const [moisturePercent, setMoisturePercent] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");
  const [inventoryLots, setInventoryLots] = useState<LotFormItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Initialize form when intake changes or modal opens
  useEffect(() => {
    if (intake && open) {
      const initialWeight = intake.verified_weight_kg ?? intake.declared_weight_kg ?? 100;
      setInputWeight(initialWeight);
      setSortedWeight(initialWeight);
      setRejectedWeight(0);
      setSortGrade("GRADE_A");
      setContaminationPercent(2);
      setMoisturePercent("");
      setNotes("");
      setFieldErrors({});

      // Initial default lot
      setInventoryLots([
        {
          category_id: intakeCatId,
          quantity_kg: initialWeight,
          grade: "GRADE_A",
          contamination_percent: 2,
          moisture_percent: "",
          hub_location: "Central Sorting Facility",
        },
      ]);
    }
  }, [intake, open, intakeCatId]);

  // Keyboard shortcut: Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, submitting, onClose]);

  const numInputWeight = typeof inputWeight === "number" ? inputWeight : 0;
  const numSortedWeight = typeof sortedWeight === "number" ? sortedWeight : 0;
  const numRejectedWeight = typeof rejectedWeight === "number" ? rejectedWeight : 0;

  const totalLotQuantity = inventoryLots.reduce((sum, lot) => {
    return sum + (typeof lot.quantity_kg === "number" ? lot.quantity_kg : 0);
  }, 0);

  const weightSumValid = numSortedWeight + numRejectedWeight <= numInputWeight + 0.001;
  const lotSumValid = totalLotQuantity <= numSortedWeight + 0.001;

  const handleAddLot = () => {
    const remainingWeight = Math.max(0, Number((numSortedWeight - totalLotQuantity).toFixed(2)));
    setInventoryLots((prev) => [
      ...prev,
      {
        category_id: intakeCatId,
        quantity_kg: remainingWeight > 0 ? remainingWeight : 0,
        grade: sortGrade,
        contamination_percent: typeof contaminationPercent === "number" ? contaminationPercent : 0,
        moisture_percent: "",
        hub_location: "Central Sorting Facility",
      },
    ]);
  };

  const handleRemoveLot = (index: number) => {
    if (inventoryLots.length <= 1) {
      toast.error("At least one inventory lot is required");
      return;
    }
    setInventoryLots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLot = (index: number, updates: Partial<LotFormItem>) => {
    setInventoryLots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intake) return;

    const errors: Record<string, string> = {};

    if (numInputWeight <= 0) {
      errors.input_weight = "Input weight must be greater than 0 kg";
    }
    if (numSortedWeight <= 0) {
      errors.sorted_weight = "Sorted weight must be greater than 0 kg";
    }
    if (numSortedWeight > numInputWeight) {
      errors.sorted_weight = "Sorted weight cannot exceed input weight";
    }
    if (numRejectedWeight < 0) {
      errors.rejected_weight = "Rejected weight must be at least 0 kg";
    }
    if (!weightSumValid) {
      errors.weight_sum = `Sorted (${numSortedWeight}kg) + Rejected (${numRejectedWeight}kg) exceeds Input (${numInputWeight}kg)`;
    }
    if (typeof contaminationPercent !== "number" || contaminationPercent < 0 || contaminationPercent > 100) {
      errors.contamination = "Contamination must be between 0% and 100%";
    }
    if (inventoryLots.length === 0) {
      errors.lots = "At least one inventory lot is required";
    }
    if (!lotSumValid) {
      errors.lots_sum = `Sum of lot quantities (${totalLotQuantity.toFixed(
        1
      )}kg) exceeds sorted weight (${numSortedWeight.toFixed(1)}kg)`;
    }

    // Check individual lot validations
    for (let i = 0; i < inventoryLots.length; i++) {
      const lot = inventoryLots[i];
      if (typeof lot.quantity_kg !== "number" || lot.quantity_kg <= 0) {
        errors[`lot_${i}_qty`] = `Lot #${i + 1} quantity must be greater than 0`;
      }
      if (
        typeof lot.contamination_percent !== "number" ||
        lot.contamination_percent < 0 ||
        lot.contamination_percent > 100
      ) {
        errors[`lot_${i}_contam`] = `Lot #${i + 1} contamination must be 0-100%`;
      }
      if (getStreamClass(lot.category_id) !== intakeStream) {
        errors[`lot_${i}_category`] = `Category must belong to stream ${intakeStream}`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please resolve the validation errors");
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const payloadLots: InventoryLotCreate[] = inventoryLots.map((lot) => ({
        category_id: lot.category_id,
        quantity_kg: Number(lot.quantity_kg),
        grade: lot.grade,
        contamination_percent: Number(lot.contamination_percent),
        moisture_percent:
          typeof lot.moisture_percent === "number" ? lot.moisture_percent : null,
        hub_location: lot.hub_location || "Central Sorting Facility",
      }));

      const payload = {
        intake_id: intake.id,
        input_weight_kg: numInputWeight,
        sorted_weight_kg: numSortedWeight,
        rejected_weight_kg: numRejectedWeight,
        contamination_percent: Number(contaminationPercent),
        sort_grade: sortGrade,
        moisture_percent: typeof moisturePercent === "number" ? moisturePercent : null,
        notes: notes.trim() ? notes.trim() : null,
        inventory_lots: payloadLots,
      };

      const result = await processSorting(payload);
      toast.success(
        `Sorting complete — ${result.inventory_lots?.length ?? payloadLots.length} inventory lots created`
      );
      onSorted();
      onClose();
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 409) {
        toast.error("Already sorted");
      } else if (status === 422) {
        const errorMsg =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
            ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
            : "Validation error from server";
        toast.error(errorMsg);
        setFieldErrors({ submit: errorMsg });
      } else {
        const reqId = err.response?.headers?.["x-request-id"] || "";
        toast.error(`Sorting failed: ${err.message || "Server error"} ${reqId ? `(${reqId})` : ""}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !intake) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={submitting ? undefined : onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl z-10 text-slate-100 flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <Layers className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Process Sorting</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-brand-300 border border-slate-700">
                    {intake.batch_code}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Stream Class:{" "}
                  <span className="font-semibold text-emerald-400">{intakeStream}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
            {/* Global submit error */}
            {fieldErrors.submit && (
              <div className="p-3 text-xs rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{fieldErrors.submit}</span>
              </div>
            )}

            {/* Section 1: Weight Breakdown */}
            <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>1. Weight Breakdown (kg)</span>
                {!weightSumValid && (
                  <span className="text-[11px] text-rose-400 normal-case font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Sorted + Rejected exceeds Input
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Input Weight (kg) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={inputWeight}
                    onChange={(e) =>
                      setInputWeight(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    required
                  />
                  {fieldErrors.input_weight && (
                    <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.input_weight}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Sorted Weight (kg) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={numInputWeight || undefined}
                    value={sortedWeight}
                    onChange={(e) =>
                      setSortedWeight(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-emerald-400 font-semibold focus:border-brand-500 focus:outline-none"
                    required
                  />
                  {fieldErrors.sorted_weight && (
                    <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.sorted_weight}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Rejected Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={rejectedWeight}
                    onChange={(e) =>
                      setRejectedWeight(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-rose-400 focus:border-brand-500 focus:outline-none"
                  />
                  {fieldErrors.rejected_weight && (
                    <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.rejected_weight}</p>
                  )}
                </div>
              </div>

              {fieldErrors.weight_sum && (
                <p className="text-xs text-rose-400">{fieldErrors.weight_sum}</p>
              )}
            </div>

            {/* Section 2: Quality & Overall Classification */}
            <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Quality & Inspection
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Sort Grade Segmented Control */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Overall Sort Grade
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                    {(["GRADE_A", "GRADE_B", "GRADE_C"] as const).map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setSortGrade(grade)}
                        className={`py-1 text-xs font-bold rounded-md transition-all ${
                          sortGrade === grade
                            ? "bg-brand-500 text-slate-950 shadow"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {grade.replace("GRADE_", "")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contamination % */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Contamination % (0 - 100) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={contaminationPercent}
                    onChange={(e) =>
                      setContaminationPercent(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    required
                  />
                  {fieldErrors.contamination && (
                    <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.contamination}</p>
                  )}
                </div>

                {/* Moisture % */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Moisture % (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g. 12"
                    value={moisturePercent}
                    onChange={(e) =>
                      setMoisturePercent(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sorter Notes (max 1000 chars)
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record optical sort observations, bale conditions, impurities identified..."
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Section 3: Inventory Lots */}
            <div className="space-y-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <span>3. Inventory Lots to Create</span>
                    <span className="text-[10px] lowercase font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      minimum 1 lot
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Allocate sorted materials into inventory lots for the marketplace
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <span className="text-slate-400">Allocated / Sorted: </span>
                    <span
                      className={`font-mono font-bold ${
                        lotSumValid ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {totalLotQuantity.toFixed(1)} / {numSortedWeight.toFixed(1)} kg
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-500 text-slate-950 hover:bg-brand-400 transition-colors shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add lot</span>
                  </button>
                </div>
              </div>

              {fieldErrors.lots_sum && (
                <div className="p-2.5 text-xs rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {fieldErrors.lots_sum}
                </div>
              )}

              {/* Lots List */}
              <div className="space-y-3">
                {inventoryLots.map((lot, idx) => {
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span>Lot #{idx + 1}</span>
                        {inventoryLots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLot(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                            title="Remove lot"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                        {/* Category Dropdown */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Category (Stream: {intakeStream})
                          </label>
                          <select
                            value={lot.category_id}
                            onChange={(e) =>
                              handleUpdateLot(idx, { category_id: parseInt(e.target.value, 10) })
                            }
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                          >
                            {Object.values(WASTE_CATEGORY_MAP).map((cat) => {
                              const catStream = getStreamClass(cat.id);
                              const disabled = catStream !== intakeStream;
                              return (
                                <option
                                  key={cat.id}
                                  value={cat.id}
                                  disabled={disabled}
                                  title={disabled ? `Cannot mix with ${intakeStream}` : undefined}
                                >
                                  {cat.name} {disabled ? `(Stream: ${catStream} - blocked)` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Quantity (kg) */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Quantity (kg)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={lot.quantity_kg}
                            onChange={(e) =>
                              handleUpdateLot(idx, {
                                quantity_kg:
                                  e.target.value === "" ? "" : parseFloat(e.target.value),
                              })
                            }
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-emerald-400 font-semibold focus:border-brand-500 focus:outline-none"
                            required
                          />
                        </div>

                        {/* Grade */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Grade
                          </label>
                          <select
                            value={lot.grade}
                            onChange={(e) =>
                              handleUpdateLot(idx, {
                                grade: e.target.value as "GRADE_A" | "GRADE_B" | "GRADE_C",
                              })
                            }
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                          >
                            <option value="GRADE_A">Grade A</option>
                            <option value="GRADE_B">Grade B</option>
                            <option value="GRADE_C">Grade C</option>
                          </select>
                        </div>

                        {/* Contamination % */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Contam. %
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={lot.contamination_percent}
                            onChange={(e) =>
                              handleUpdateLot(idx, {
                                contamination_percent:
                                  e.target.value === "" ? "" : parseFloat(e.target.value),
                              })
                            }
                            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !weightSumValid || !lotSumValid}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-brand-500 text-slate-950 hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Complete Sorting & Create Lots</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SortIntakeModal;
