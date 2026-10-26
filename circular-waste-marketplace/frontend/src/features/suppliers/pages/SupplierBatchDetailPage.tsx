import React, { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Scale,
  QrCode,
  Download,
  Printer,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  AlertCircle,
  Camera,
  Truck,
  Package,
  BarChart3,
} from "lucide-react";
import { getIntake, getIntakeQr } from "@/api/waste";
import { getWeightTicket, acknowledgeWeight } from "@/api/weightTickets";
import { listPickups, cancelPickup, createPickup } from "@/api/pickups";
import { PickupSchedulingModal } from "../components/PickupSchedulingModal";
import { TraceabilityTimeline } from "@/features/traceability/components/TraceabilityTimeline";
import type { WasteIntake, PickupRequestRead, WeightTicketRead } from "@/api/types";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FSM_STEPS: { key: string; label: string }[] = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "AI_ANALYZED", label: "AI Analyzed" },
  { key: "PICKUP_SCHEDULED", label: "Pickup Scheduled" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "ARRIVED_AT_SORTER", label: "At Sorter" },
  { key: "WEIGHED", label: "Weighed" },
  { key: "SORTED_VERIFIED", label: "Sorted & Verified" },
  { key: "SETTLED", label: "Settled" },
];

const TERMINAL_FAILED = ["REJECTED", "CANCELLED"];

function getStepIndex(status: string): number {
  const idx = FSM_STEPS.findIndex((s) => s.key === status.toUpperCase());
  return idx;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "submitted") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (s === "ai_analyzed") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (s.includes("pickup") || s.includes("scheduled"))
    return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  if (s === "in_transit" || s === "picked_up")
    return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  if (s === "arrived_at_sorter" || s === "sorted_verified" || s === "weighed")
    return "bg-teal-500/20 text-teal-300 border-teal-500/30";
  if (s === "settled" || s === "completed")
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (s === "rejected" || s === "cancelled")
    return "bg-red-500/20 text-red-300 border-red-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseNotes(notes: string | null): { kvPairs: [string, string][]; freeform: string } {
  if (!notes) return { kvPairs: [], freeform: "" };
  const parts = notes.split("|").map((p) => p.trim());
  const kvPairs: [string, string][] = [];
  let freeform = "";
  for (const part of parts) {
    if (part.startsWith("Freeform:")) {
      freeform = part.slice("Freeform:".length).trim();
    } else if (part.includes(":")) {
      const colon = part.indexOf(":");
      kvPairs.push([part.slice(0, colon).trim(), part.slice(colon + 1).trim()]);
    }
  }
  return { kvPairs, freeform };
}

function estimatePayout(intake: WasteIntake): number {
  const entry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === intake.category.id);
  if (!entry) return 0;
  return Math.round(entry.rate * intake.declared_weight_kg * 0.85);
}

function co2eSaved(intake: WasteIntake): number {
  return parseFloat((intake.declared_weight_kg * 0.82).toFixed(1));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Timeline: React.FC<{ status: string }> = ({ status }) => {
  const isFailed = TERMINAL_FAILED.includes(status.toUpperCase());
  const currentIdx = getStepIndex(status);

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-brand-400" />
        Batch Journey
      </h3>
      {isFailed ? (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">{formatStatus(status)}</p>
            <p className="text-xs text-red-400 mt-0.5">This batch has been {formatStatus(status).toLowerCase()}.</p>
          </div>
        </div>
      ) : (
        <ol className="relative">
          {FSM_STEPS.map((step, idx) => {
            const isPast = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            const isFuture = currentIdx < idx;

            return (
              <li key={step.key} className="flex gap-4 pb-6 last:pb-0 relative">
                {/* Connector */}
                {idx < FSM_STEPS.length - 1 && (
                  <div
                    className={`absolute left-[11px] top-6 w-0.5 h-full ${isPast ? "bg-emerald-500" : "bg-slate-700"}`}
                  />
                )}
                {/* Node */}
                <div className="relative z-10 flex-shrink-0">
                  {isPast ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  ) : isCurrent ? (
                    <div className="h-6 w-6 rounded-full border-2 border-brand-500 bg-brand-500/20 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-slate-700 bg-slate-800" />
                  )}
                </div>
                {/* Label */}
                <div className="pt-0.5">
                  <p
                    className={`text-sm font-medium ${
                      isPast
                        ? "text-emerald-400"
                        : isCurrent
                        ? "text-white font-semibold"
                        : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-brand-400 mt-0.5">Current status</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

const WeightTicketPanel: React.FC<{
  ticket: WeightTicketRead;
  intakeId: string;
  onAcknowledged: () => void;
}> = ({ ticket, intakeId, onAcknowledged }) => {
  const qc = useQueryClient();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState("");

  const confirmMutation = useMutation({
    mutationFn: () => acknowledgeWeight(intakeId, { confirmed: true }),
    onSuccess: () => {
      toast.success("Weight confirmed!");
      qc.invalidateQueries({ queryKey: ["weight-ticket", intakeId] });
      onAcknowledged();
    },
    onError: () => toast.error("Failed to confirm weight."),
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      acknowledgeWeight(intakeId, { confirmed: false, dispute_notes: disputeNotes }),
    onSuccess: () => {
      toast.success("Dispute submitted.");
      setDisputeOpen(false);
      qc.invalidateQueries({ queryKey: ["weight-ticket", intakeId] });
      onAcknowledged();
    },
    onError: () => toast.error("Failed to submit dispute."),
  });

  const methodBadge: Record<string, string> = {
    manual: "bg-slate-500/20 text-slate-300",
    demo: "bg-purple-500/20 text-purple-300",
    digital_scale: "bg-blue-500/20 text-blue-300",
    weighbridge: "bg-teal-500/20 text-teal-300",
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Scale className="h-4 w-4 text-blue-400" />
          Weight Ticket
        </h3>
        <span
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${methodBadge[ticket.weight_method] ?? "bg-slate-500/20 text-slate-300"}`}
        >
          {ticket.weight_method.replace(/_/g, " ")}
        </span>
      </div>

      {/* Discrepancy banner */}
      {ticket.discrepancy_flag && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Weight discrepancy flagged</p>
            {ticket.discrepancy_notes && (
              <p className="mt-1 text-amber-400">{ticket.discrepancy_notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Weight table */}
      <table className="w-full text-sm">
        <tbody className="divide-y divide-white/5">
          <tr>
            <td className="py-2 text-slate-400">Gross weight</td>
            <td className="py-2 text-right text-slate-200">{ticket.gross_weight_kg} kg</td>
          </tr>
          <tr>
            <td className="py-2 text-slate-400">Tare weight</td>
            <td className="py-2 text-right text-slate-200">{ticket.tare_weight_kg} kg</td>
          </tr>
          <tr>
            <td className="py-2 text-slate-300 font-medium">Net weight</td>
            <td className="py-2 text-right text-white font-bold text-base">{ticket.net_weight_kg} kg</td>
          </tr>
        </tbody>
      </table>

      {/* Scale info */}
      {(ticket.scale_id || ticket.scale_calibration_date) && (
        <p className="text-xs text-slate-500">
          {ticket.scale_id && `Scale: ${ticket.scale_id}`}
          {ticket.scale_calibration_date &&
            ` · Calibrated: ${new Date(ticket.scale_calibration_date).toLocaleDateString("en-IN")}`}
        </p>
      )}

      {/* Photo thumbnails */}
      {ticket.photo_urls.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {ticket.photo_urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={`Weight photo ${i + 1}`}
                className="h-16 w-16 object-cover rounded-lg border border-white/10 hover:border-brand-400 transition-colors"
              />
            </a>
          ))}
        </div>
      )}

      {/* Acknowledgement section */}
      {ticket.supplier_confirmed_at === null && ticket.supplier_dispute_notes === null ? (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <p className="text-xs text-slate-400">Please confirm or dispute the recorded weight.</p>
          {!disputeOpen ? (
            <div className="flex gap-3">
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-60"
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirm weight
              </button>
              <button
                onClick={() => setDisputeOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-medium hover:bg-amber-500/30"
              >
                <AlertTriangle className="h-4 w-4" />
                Dispute
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={disputeNotes}
                onChange={(e) => setDisputeNotes(e.target.value)}
                rows={3}
                placeholder="Describe the discrepancy (min 10 characters)…"
                className="w-full px-3 py-2 bg-slate-900 border border-amber-500/30 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => disputeMutation.mutate()}
                  disabled={disputeNotes.trim().length < 10 || disputeMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-medium hover:bg-amber-500/30 disabled:opacity-60"
                >
                  {disputeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Submit dispute"
                  )}
                </button>
                <button
                  onClick={() => setDisputeOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : ticket.supplier_confirmed_at ? (
        <div className="flex items-center gap-2 text-xs text-emerald-400 pt-2 border-t border-white/10">
          <CheckCircle2 className="h-4 w-4" />
          Confirmed on{" "}
          {new Date(ticket.supplier_confirmed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      ) : (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1 pt-2 border-t border-white/10">
          <p className="font-semibold text-amber-300 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Dispute submitted
          </p>
          {ticket.supplier_dispute_notes && (
            <p className="text-amber-400">{ticket.supplier_dispute_notes}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SupplierBatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPickupOpen, setCancelPickupOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const { data: intake, isLoading: intakeLoading, isError: intakeError } = useQuery({
    queryKey: ["intake", id],
    queryFn: () => getIntake(id!),
    enabled: !!id,
  });

  const { data: qrData } = useQuery({
    queryKey: ["intake-qr", id],
    queryFn: () => getIntakeQr(id!),
    enabled: !!id,
  });

  const { data: weightTicket, refetch: refetchTicket } = useQuery({
    queryKey: ["weight-ticket", id],
    queryFn: () => getWeightTicket(id!),
    enabled: !!id,
  });

  const { data: pickupsData } = useQuery({
    queryKey: ["pickups", "detail", id],
    queryFn: () => listPickups({ limit: 20 }),
    enabled: !!id,
  });

  // Client-side filter by intake_id
  const pickups: PickupRequestRead[] = (pickupsData?.items ?? []).filter(
    (p) => p.intake_id === id
  );
  const activePickup = pickups.find((p) =>
    ["requested", "accepted", "en_route", "arrived"].includes(p.status)
  );

  const cancelPickupMutation = useMutation({
    mutationFn: () => cancelPickup(activePickup!.id, cancelReason),
    onSuccess: () => {
      toast.success("Pickup cancelled.");
      setCancelPickupOpen(false);
      qc.invalidateQueries({ queryKey: ["pickups", "detail", id] });
    },
    onError: () => toast.error("Failed to cancel pickup."),
  });

  if (intakeLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (intakeError || !intake) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-slate-300">Batch not found or failed to load.</p>
        <Link
          to="/dashboard/batches"
          className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to batches
        </Link>
      </div>
    );
  }

  const notes = parseNotes(intake.notes);
  const est = estimatePayout(intake);
  const co2 = co2eSaved(intake);

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="Full size"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
        </div>
      )}

      <div className="space-y-6">
        {/* Back */}
        <Link
          to="/dashboard/batches"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All Batches
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Traceability Timeline */}
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-400" />
                Batch Journey
              </h3>
              <TraceabilityTimeline batchId={id!} />
            </div>

            {/* Weight ticket */}
            {weightTicket && (
              <WeightTicketPanel
                ticket={weightTicket}
                intakeId={id!}
                onAcknowledged={refetchTicket}
              />
            )}

            {/* Evidence images */}
            {intake.image_paths.length > 0 && (
              <div className="glass-card rounded-2xl p-6 border border-white/10">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-brand-400" />
                  Evidence Photos ({intake.image_paths.length})
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {intake.image_paths.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxSrc(url)}
                      className="aspect-square overflow-hidden rounded-xl border border-white/10 hover:border-brand-400 transition-colors"
                    >
                      <img
                        src={url}
                        alt={`Evidence ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {intake.notes && (
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Batch Notes
                </h3>
                {notes.kvPairs.length > 0 && (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-white/5">
                      {notes.kvPairs.map(([k, v]) => (
                        <tr key={k}>
                          <td className="py-2 text-slate-400 w-1/3">{k}</td>
                          <td className="py-2 text-slate-200 font-medium">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {notes.freeform && (
                  <p className="text-sm text-slate-300 leading-relaxed">{notes.freeform}</p>
                )}
              </div>
            )}
          </div>

          {/* Right: 1/3 */}
          <div className="space-y-5">
            {/* Summary card */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Package className="h-4 w-4 text-brand-400" />
                Batch Summary
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Batch code</span>
                  <span className="font-mono font-bold text-white">{intake.batch_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category</span>
                  <span className="text-slate-200">{intake.category.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusBadgeClass(intake.status)}`}
                  >
                    {formatStatus(intake.status)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Declared weight</span>
                  <span className="text-slate-200 font-medium">{intake.declared_weight_kg} kg</span>
                </div>
                {intake.verified_weight_kg != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Verified weight</span>
                    <span className="text-white font-bold">{intake.verified_weight_kg} kg</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <span className="text-slate-300 font-medium">Est. payout</span>
                  <span className="text-emerald-400 font-bold">₹{est.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CO₂e saved</span>
                  <span className="text-teal-400 font-semibold">{co2} kg</span>
                </div>
              </div>
            </div>

            {/* QR code card */}
            {qrData && (
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4 print:block">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-brand-400" />
                  Batch QR Code
                </h3>
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={qrData.qr_code_data_url}
                    alt="Batch QR"
                    className="w-48 h-48 rounded-xl border border-white/10"
                  />
                  <p className="font-mono text-xs text-slate-400">{qrData.batch_code}</p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs hover:bg-slate-700"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </button>
                  <a
                    download={`${qrData.batch_code}.png`}
                    href={qrData.qr_code_data_url}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs hover:bg-slate-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              </div>
            )}

            {/* Actions card */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Actions
              </h3>

              {/* Client-side guards are UX only. Backend RBAC is the real control. */}
              {intake.status === "SUBMITTED" && (
                <>
                  <button
                    onClick={() => setScheduleOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-xl text-sm font-medium hover:bg-brand-500/30 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    Schedule Pickup
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Cancel this batch?"))
                        toast.error("Cancel batch not yet implemented in this segment.");
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Batch
                  </button>
                </>
              )}

              {/* Client-side guards are UX only. Backend RBAC is the real control. */}
              {(intake.status === "PICKUP_REQUESTED" ||
                intake.status === "PICKUP_SCHEDULED") &&
                activePickup && (
                  <>
                    {cancelPickupOpen ? (
                      <div className="space-y-2">
                        <textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          rows={2}
                          placeholder="Reason for cancellation…"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-400 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => cancelPickupMutation.mutate()}
                            disabled={!cancelReason.trim() || cancelPickupMutation.isPending}
                            className="flex-1 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl text-sm font-medium disabled:opacity-50"
                          >
                            {cancelPickupMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                              "Confirm cancel"
                            )}
                          </button>
                          <button
                            onClick={() => setCancelPickupOpen(false)}
                            className="px-3 py-2 text-slate-400 hover:text-white text-sm rounded-xl"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCancelPickupOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel Pickup
                      </button>
                    )}
                  </>
                )}

              {/* Client-side guards are UX only. Backend RBAC is the real control. */}
              {intake.status === "PICKUP_ASSIGNED" && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-3 bg-slate-800/60 rounded-xl">
                  <Truck className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  A driver has been assigned. Actions locked until pickup.
                </div>
              )}

              {intake.status === "IN_TRANSIT" && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-3 bg-slate-800/60 rounded-xl">
                  <Truck className="h-4 w-4 text-orange-400 flex-shrink-0 animate-pulse" />
                  Your batch is in transit to the sorting facility.
                </div>
              )}

              {intake.status === "WEIGHED" && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <Scale className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  Batch weighed. Please review and acknowledge above.
                </div>
              )}

              {TERMINAL_FAILED.includes(intake.status) && (
                <Link
                  to="/intake"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-xl text-sm font-medium hover:bg-brand-500/30"
                >
                  Submit New Batch
                </Link>
              )}

              <Link
                to="/dashboard/batches"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to List
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Pickup scheduling modal */}
      <PickupSchedulingModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        intake={
          {
            id: intake.id,
            batch_code: intake.batch_code,
            supplier_id: intake.supplier_id,
            category: intake.category,
            purity_grade: intake.purity_grade,
            declared_weight_kg: intake.declared_weight_kg,
            verified_weight_kg: intake.verified_weight_kg,
            weight_discrepancy_kg: intake.weight_discrepancy_kg,
            status: intake.status,
            qr_code_hash: intake.qr_code_hash,
            image_paths: intake.image_paths,
            notes: intake.notes,
            verified_at: intake.verified_at,
            created_at: intake.created_at,
          }
        }
        supplier={null}
        onScheduled={() => {
          setScheduleOpen(false);
          qc.invalidateQueries({ queryKey: ["pickups", "detail", id] });
        }}
      />
    </>
  );
};
