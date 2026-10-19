import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { X, Building2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/Button";
import { createSupplier } from "@/api/suppliers";
import { normalizeApiError } from "@/api/client";
import type { SupplierProfile } from "@/api/types";

// ─── Validation schema ──────────────────────────────────────────────────────
const supplierSchema = z.object({
  business_name: z.string().min(2, "Min 2 characters").max(200, "Max 200 characters"),
  registration_number: z.string().min(5, "Min 5 characters").max(50, "Max 50 characters"),
  facility_address: z.string().min(5, "Min 5 characters").max(500, "Max 500 characters"),
  latitude: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  longitude: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
  contact_phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, "Phone: 10-15 digits, optional leading +"),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────
export interface SupplierOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (supplier: SupplierProfile) => void;
}

export const SupplierOnboardingModal: React.FC<SupplierOnboardingModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  });

  // Escape key closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const onSubmit = async (data: SupplierFormData) => {
    try {
      const profile = await createSupplier(data);
      toast.success("Supplier profile created!");
      onCreated(profile);
      onClose();
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      if (normalized.code === 409) {
        toast.error("A supplier profile already exists for this account.");
        onClose();
      } else if (normalized.code === 422 && normalized.fieldErrors) {
        Object.entries(normalized.fieldErrors).forEach(([field, msg]) => {
          setError(field as keyof SupplierFormData, { message: msg });
        });
      } else {
        toast.error(
          `Error creating profile: ${normalized.detail}${
            normalized.requestId ? ` (ref: ${normalized.requestId})` : ""
          }`
        );
      }
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors";
  const labelCls = "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5";
  const errorCls = "text-[11px] text-red-400 mt-1";

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="supplier-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-card rounded-2xl border border-white/10 w-full max-w-lg p-6 space-y-5 relative"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Supplier Onboarding</h2>
                  <p className="text-xs text-slate-400">Complete your facility profile to submit waste.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="h-8 w-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className={labelCls}>Business Name</label>
                <input {...register("business_name")} className={inputCls} placeholder="Acme Recyclers Pvt. Ltd." />
                {errors.business_name && <p className={errorCls}>{errors.business_name.message}</p>}
              </div>

              <div>
                <label className={labelCls}>Registration Number</label>
                <input {...register("registration_number")} className={inputCls} placeholder="GSTIN / CIN / SPCB ID" />
                {errors.registration_number && <p className={errorCls}>{errors.registration_number.message}</p>}
              </div>

              <div>
                <label className={labelCls}>Facility Address</label>
                <input {...register("facility_address")} className={inputCls} placeholder="Plot 42, Industrial Area Phase II, Chandigarh" />
                {errors.facility_address && <p className={errorCls}>{errors.facility_address.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Latitude</label>
                  <input {...register("latitude")} type="number" step="any" className={inputCls} placeholder="28.6139" />
                  {errors.latitude && <p className={errorCls}>{errors.latitude.message}</p>}
                </div>
                <div>
                  <label className={labelCls}>Longitude</label>
                  <input {...register("longitude")} type="number" step="any" className={inputCls} placeholder="77.2090" />
                  {errors.longitude && <p className={errorCls}>{errors.longitude.message}</p>}
                </div>
              </div>

              <div>
                <label className={labelCls}>Contact Phone</label>
                <input {...register("contact_phone")} className={inputCls} placeholder="+919876543210" />
                {errors.contact_phone && <p className={errorCls}>{errors.contact_phone.message}</p>}
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating Profile..." : "Create Supplier Profile"}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};
