import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PackageCheck,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { listMyOrders, getListing, confirmPayment, completeOrder } from "@/api/marketplace";
import type { PurchaseOrderRead } from "@/api/types";

export const MyOrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const {
    data: ordersData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["myOrders", "buyer"],
    queryFn: () => listMyOrders({ role: "buyer" }),
  });

  const orders = ordersData?.items ?? [];

  // Batch fetch listing titles via Promise.all
  useEffect(() => {
    if (orders.length > 0) {
      const uniqueListingIds = Array.from(new Set(orders.map((o) => o.listing_id)));
      Promise.all(
        uniqueListingIds.map(async (lid) => {
          try {
            const item = await getListing(lid);
            return { id: lid, title: item.title };
          } catch {
            return { id: lid, title: `Listing #${lid.slice(0, 8)}` };
          }
        })
      ).then((results) => {
        const titleMap: Record<string, string> = {};
        results.forEach((r) => {
          titleMap[r.id] = r.title;
        });
        setListingTitles((prev) => ({ ...prev, ...titleMap }));
      });
    }
  }, [orders]);

  const handleConfirmPayment = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await confirmPayment(orderId);
      toast.success("Payment confirmed — Escrow held");
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm payment");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await completeOrder(orderId, "Received and confirmed by buyer");
      toast.success("Delivery confirmed — Order completed");
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete order");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: PurchaseOrderRead["status"]) => {
    switch (status) {
      case "pending_payment":
        return {
          label: "Pending Payment",
          className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        };
      case "escrow_held":
        return {
          label: "Escrow Held",
          className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        };
      case "confirmed":
      case "shipped":
      case "delivered":
        return {
          label: status.replace("_", " "),
          className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        };
      case "completed":
        return {
          label: "Completed",
          className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "cancelled":
      case "refunded":
        return {
          label: status.replace("_", " "),
          className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      default:
        return {
          label: status,
          className: "bg-slate-700/50 text-slate-300 border-slate-600/30",
        };
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <PackageCheck className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Orders</h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Track your feedstock purchases, escrow statuses, and deliveries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-400 mb-4" />
          <p className="text-sm text-slate-400">Loading your purchase orders...</p>
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-8 text-center text-rose-300">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-400" />
          <p className="font-medium text-sm">Failed to load purchase orders</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <ShoppingBag className="h-7 w-7 text-brand-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No orders yet</h3>
          <p className="mt-2 text-xs text-slate-400 max-w-sm mx-auto mb-5">
            You haven't purchased any feedstock lots yet. Explore available listings on the
            marketplace.
          </p>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-brand-500 text-slate-950 hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20"
          >
            <span>Browse marketplace</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-4">Order Code</th>
                  <th scope="col" className="px-6 py-4">Listing Title</th>
                  <th scope="col" className="px-6 py-4">Quantity</th>
                  <th scope="col" className="px-6 py-4">Total Amount</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4">Date</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {orders.map((order) => {
                  const statusInfo = getStatusBadge(order.status);
                  const isActionLoading = actionLoadingId === order.id;
                  const listingTitle = listingTitles[order.listing_id] || "Loading title...";

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white whitespace-nowrap">
                        <Link
                          to={`/marketplace/orders/${order.id}`}
                          className="text-brand-400 hover:text-brand-300 hover:underline"
                        >
                          {order.order_code}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-sans text-slate-200 font-medium max-w-xs truncate">
                        <Link
                          to={`/marketplace/${order.listing_id}`}
                          className="hover:text-brand-300 hover:underline"
                        >
                          {listingTitle}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                        {order.quantity_kg.toFixed(1)} kg
                      </td>
                      <td className="px-6 py-4 text-emerald-400 font-bold whitespace-nowrap">
                        ₹{order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-sans whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <Link
                            to={`/marketplace/orders/${order.id}`}
                            className="px-2.5 py-1 text-xs font-sans font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
                          >
                            View receipt
                          </Link>

                          {order.status === "pending_payment" && (
                            <button
                              type="button"
                              onClick={() => handleConfirmPayment(order.id)}
                              disabled={isActionLoading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-sm disabled:opacity-50"
                            >
                              <CreditCard className="h-3 w-3" />
                              <span>Confirm payment</span>
                            </button>
                          )}

                          {order.status === "escrow_held" && (
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(order.id)}
                              disabled={isActionLoading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-400 transition-colors shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Mark received</span>
                            </button>
                          )}

                          {order.status === "completed" && (
                            <span className="text-emerald-400 text-xs font-sans font-medium flex items-center justify-end gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Settled</span>
                            </span>
                          )}

                          {["cancelled", "refunded"].includes(order.status) && (
                            <span className="text-rose-400 text-xs font-sans">
                              {order.cancellation_reason || "Cancelled"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
