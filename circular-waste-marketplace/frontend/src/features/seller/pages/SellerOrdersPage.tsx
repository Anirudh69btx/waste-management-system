import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import clsx from "clsx";
import {
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  AlertCircle,
  Loader2,
  Package,
  X,
  Send,
  Check,
} from "lucide-react";
import { listSellerOrders, shipOrder } from "@/api/seller";
import { getListing, completeOrder } from "@/api/marketplace";
import type { PurchaseOrderRead } from "@/api/types";

export const SellerOrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [shippingOrder, setShippingOrder] = useState<PurchaseOrderRead | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [shipNote, setShipNote] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const {
    data: ordersData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sellerOrders", selectedStatus],
    queryFn: () =>
      listSellerOrders({
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        limit: 50,
      }),
  });

  const orders = ordersData?.items ?? [];

  // Batch fetch listing titles
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

  const handleConfirmShip = async () => {
    if (!shippingOrder) return;
    setActionLoadingId(shippingOrder.id);
    try {
      await shipOrder(shippingOrder.id, {
        tracking_number: trackingNumber.trim() || undefined,
        note: shipNote.trim() || undefined,
      });
      toast.success(`Order ${shippingOrder.order_code} marked as shipped`);
      setShippingOrder(null);
      setTrackingNumber("");
      setShipNote("");
      queryClient.invalidateQueries({ queryKey: ["sellerOrders"] });
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || "Failed to ship order");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await completeOrder(orderId, "Delivered and confirmed by seller");
      toast.success("Order marked as completed");
      queryClient.invalidateQueries({ queryKey: ["sellerOrders"] });
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || "Failed to complete order");
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
        return {
          label: "Confirmed",
          className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        };
      case "shipped":
        return {
          label: "Shipped",
          className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        };
      case "delivered":
        return {
          label: "Delivered",
          className: "bg-teal-500/10 text-teal-400 border-teal-500/20",
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
          className: "bg-slate-800 text-slate-400 border-slate-700",
        };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-emerald-400" />
            <span>Orders Received</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Fulfill and manage orders resulting from accepted bids and Buy Now purchases.
          </p>
        </div>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-2.5">
          <Filter className="w-4 h-4 text-emerald-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="escrow_held">Escrow Held (Ready to Ship)</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Content */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
          <p className="text-sm text-slate-400">Loading received orders...</p>
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-rose-300">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
          <p className="text-sm font-semibold">Failed to load orders</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-4">
          <Package className="w-12 h-12 mx-auto text-slate-600" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No orders yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No orders received yet. Accept buyer bids or wait for Buy Now purchases.
            </p>
          </div>
          <Link
            to="/seller/bids"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition-all"
          >
            <span>Review Pending Bids</span>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Order Code</th>
                  <th className="py-3.5 px-4">Listing</th>
                  <th className="py-3.5 px-4">Buyer</th>
                  <th className="py-3.5 px-4">Quantity</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const buyerInitial = order.buyer_user_id
                    ? order.buyer_user_id.slice(0, 2).toUpperCase()
                    : "BY";
                  const title = listingTitles[order.listing_id] || "Loading listing...";

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Order Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                        {order.order_code}
                      </td>

                      {/* Listing Title */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          to={`/marketplace/${order.listing_id}`}
                          className="font-medium text-slate-200 hover:text-emerald-400 transition-colors truncate block"
                          title={title}
                        >
                          {title}
                        </Link>
                      </td>

                      {/* Buyer Initial */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-blue-400 shrink-0">
                            {buyerInitial}
                          </div>
                          <span className="font-mono text-xs text-slate-400">
                            {order.buyer_user_id.slice(0, 8)}...
                          </span>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {order.quantity_kg} kg
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        ₹{order.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {order.status === "pending_payment" && (
                          <span className="text-xs text-slate-500 italic">
                            Waiting for buyer payment
                          </span>
                        )}

                        {order.status === "escrow_held" && (
                          <button
                            onClick={() => setShippingOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition-all"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Ship order</span>
                          </button>
                        )}

                        {order.status === "shipped" && (
                          <span className="text-xs text-cyan-400/90 font-medium flex items-center justify-end gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Awaiting delivery</span>
                          </span>
                        )}

                        {order.status === "delivered" && (
                          <button
                            onClick={() => handleCompleteOrder(order.id)}
                            disabled={actionLoadingId === order.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
                          >
                            {actionLoadingId === order.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Mark completed</span>
                          </button>
                        )}

                        {order.status === "completed" && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Done</span>
                          </span>
                        )}

                        {(order.status === "cancelled" || order.status === "refunded") && (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ship Order Modal */}
      {shippingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-400" />
                <span>Dispatch & Ship Order</span>
              </h3>
              <button
                onClick={() => setShippingOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Dispatching order <span className="font-mono font-bold text-white">{shippingOrder.order_code}</span> ({shippingOrder.quantity_kg} kg).
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tracking Number / Waybill (Optional)
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. TRK-KA-2026-9921"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Dispatch Notes (Optional)
                </label>
                <textarea
                  value={shipNote}
                  onChange={(e) => setShipNote(e.target.value)}
                  rows={2}
                  placeholder="Carrier name, vehicle plate, or dispatch timestamp..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShippingOrder(null)}
                disabled={Boolean(actionLoadingId)}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmShip}
                disabled={Boolean(actionLoadingId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 disabled:opacity-50"
              >
                {actionLoadingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Shipment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerOrdersPage;
