import React, { useContext, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  QueryClient,
  QueryClientContext,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Clock,
  ShieldCheck,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Printer,
  ExternalLink,
  ArrowLeft,
  CreditCard,
  AlertCircle,
  Check,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getOrder,
  getListing,
  confirmPayment,
  completeOrder,
} from "@/api/marketplace";
import type { PurchaseOrderRead } from "@/api/types";

const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function getHeroConfig(status: PurchaseOrderRead["status"]) {
  switch (status) {
    case "pending_payment":
      return {
        icon: Clock,
        headline: "Awaiting Payment Confirmation",
        accent: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        iconColor: "text-amber-400",
      };
    case "escrow_held":
    case "confirmed":
      return {
        icon: ShieldCheck,
        headline: "Payment Secured in Escrow",
        accent: "border-blue-500/30 bg-blue-500/10 text-blue-200",
        iconColor: "text-blue-400",
      };
    case "shipped":
      return {
        icon: Truck,
        headline: "Order Shipped — In Transit",
        accent: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
        iconColor: "text-cyan-400",
      };
    case "delivered":
      return {
        icon: PackageCheck,
        headline: "Delivered — Ready to Settle",
        accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        iconColor: "text-emerald-400",
      };
    case "completed":
      return {
        icon: CheckCircle2,
        headline: "Order Completed & Settled",
        accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        iconColor: "text-emerald-400",
      };
    case "cancelled":
    case "refunded":
    default:
      return {
        icon: XCircle,
        headline: "Order Cancelled",
        accent: "border-rose-500/30 bg-rose-500/10 text-rose-200",
        iconColor: "text-rose-400",
      };
  }
}

const OrderReceiptPageInner: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [actionBusy, setActionBusy] = useState(false);

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["orderReceipt", id],
    queryFn: () => getOrder(id),
    enabled: Boolean(id),
  });

  const { data: listing } = useQuery({
    queryKey: ["listing", order?.listing_id],
    queryFn: () => getListing(order!.listing_id),
    enabled: Boolean(order?.listing_id),
  });

  const handleConfirmPayment = async () => {
    if (!order) return;
    setActionBusy(true);
    try {
      await confirmPayment(order.id);
      toast.success("Payment confirmed — Funds held in escrow");
      queryClient.invalidateQueries({ queryKey: ["orderReceipt", id] });
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      await refetch();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || "Failed to confirm payment");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCompleteOrder = async (note: string) => {
    if (!order) return;
    setActionBusy(true);
    try {
      await completeOrder(order.id, note);
      toast.success("Order confirmed and settled");
      queryClient.invalidateQueries({ queryKey: ["orderReceipt", id] });
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      await refetch();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || "Failed to update order");
    } finally {
      setActionBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-3" />
        <p className="text-sm text-slate-400">Loading order receipt...</p>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-8 text-center text-rose-300 space-y-3">
        <AlertCircle className="h-8 w-8 mx-auto text-rose-400" />
        <p className="font-semibold text-sm">Order receipt could not be found</p>
        <Link
          to="/marketplace/orders"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to my orders</span>
        </Link>
      </div>
    );
  }

  const hero = getHeroConfig(order.status);
  const HeroIcon = hero.icon;

  const isEscrowStepDone = [
    "escrow_held",
    "confirmed",
    "shipped",
    "delivered",
    "completed",
  ].includes(order.status);
  const isTransitStepDone = ["shipped", "delivered", "completed"].includes(
    order.status
  );
  const isReleasedStepDone = order.status === "completed";

  const timelineSteps = [
    {
      label: "Order Placed",
      timestamp: formatDate(order.created_at),
      done: true,
    },
    {
      label: "Escrow Held",
      timestamp: order.escrow_held_at
        ? formatDate(order.escrow_held_at)
        : isEscrowStepDone
        ? "Verified"
        : "Pending",
      done: isEscrowStepDone,
    },
    {
      label: "Shipped & Delivered",
      timestamp: isTransitStepDone ? "In custody chain" : "Awaiting dispatch",
      done: isTransitStepDone,
    },
    {
      label: "Funds Released",
      timestamp: order.completed_at
        ? formatDate(order.completed_at)
        : isReleasedStepDone
        ? "Settled"
        : "Held in escrow",
      done: isReleasedStepDone,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Print-scoped styles for the invoice card */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #cwm-printable-invoice,
          #cwm-printable-invoice * {
            visibility: visible;
          }
          #cwm-printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/marketplace/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>← Back to my orders</span>
        </Link>
        <span className="text-xs font-mono text-slate-500">
          Receipt ID: {order.id.slice(0, 8)}
        </span>
      </div>

      {/* 1. Success / Status Hero */}
      <div
        className={`rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${hero.accent}`}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 shrink-0">
            <HeroIcon className={`h-7 w-7 ${hero.iconColor}`} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {hero.headline}
            </h1>
            <p className="text-xs font-mono text-slate-300 mt-1">
              Order {order.order_code} • Created {formatDate(order.created_at)}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
            Escrow Settlement Total
          </span>
          <span className="text-2xl font-extrabold font-mono text-emerald-400">
            ₹{order.total_amount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* 2. Printable Invoice & Order Summary Card */}
      <div
        id="cwm-printable-invoice"
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                Certified Feedstock Purchase Receipt
              </h2>
              <p className="text-xs text-slate-400">
                Circular Waste Marketplace — Escrow Tax & Custody Summary
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {order.order_code}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
              {order.currency || "INR"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
              Feedstock Listing
            </span>
            <p className="text-sm font-bold text-white mt-1 truncate">
              {listing?.title || `Listing #${order.listing_id.slice(0, 8)}`}
            </p>
            {listing?.purity_grade && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {listing.purity_grade}
              </span>
            )}
          </div>

          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
              Verified Quantity
            </span>
            <p className="text-base font-bold font-mono text-white mt-1">
              {order.quantity_kg} kg
            </p>
            <span className="text-[11px] text-slate-500">
              Net certified lot weight
            </span>
          </div>

          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
              Unit Rate
            </span>
            <p className="text-base font-bold font-mono text-white mt-1">
              ₹{order.unit_price}/kg
            </p>
            <span className="text-[11px] text-slate-500">
              Currency: {order.currency || "INR"}
            </span>
          </div>

          <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/30 p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-emerald-300/80 block">
              Total Paid
            </span>
            <p className="text-lg font-extrabold font-mono text-emerald-400 mt-1">
              ₹{order.total_amount.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-emerald-300/70">
              Escrow protected
            </span>
          </div>
        </div>

        {/* Timestamps Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500">Order Created: </span>
            <span className="font-mono text-slate-300">
              {formatDate(order.created_at)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Escrow Held At: </span>
            <span className="font-mono text-slate-300">
              {formatDate(order.escrow_held_at)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Completed At: </span>
            <span className="font-mono text-slate-300">
              {formatDate(order.completed_at)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Payment Status Timeline (Horizontal 4-Step Stepper) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Escrow & Settlement Timeline
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {timelineSteps.map((step, index) => (
            <div
              key={step.label}
              className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                step.done
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-950/40 opacity-70"
              }`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step.done
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">{step.label}</p>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  {step.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Role-Appropriate Actions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {order.status === "pending_payment" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleConfirmPayment}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              <span>Confirm payment</span>
            </button>
          )}

          {order.status === "escrow_held" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                handleCompleteOrder("Received and confirmed by buyer")
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Mark as received</span>
            </button>
          )}

          {order.status === "shipped" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                handleCompleteOrder("Delivered and confirmed by buyer")
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <PackageCheck className="h-4 w-4" />
              <span>Mark as delivered</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors"
          >
            <Printer className="h-4 w-4 text-emerald-400" />
            <span>Download invoice</span>
          </button>
        </div>

        <Link
          to={`/marketplace/${order.listing_id}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-emerald-400 transition-colors"
        >
          <span>View on marketplace</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
};

export const OrderReceiptPage: React.FC = () => {
  const existingClient = useContext(QueryClientContext);
  if (!existingClient) {
    return (
      <QueryClientProvider client={fallbackQueryClient}>
        <OrderReceiptPageInner />
      </QueryClientProvider>
    );
  }
  return <OrderReceiptPageInner />;
};

export default OrderReceiptPage;
