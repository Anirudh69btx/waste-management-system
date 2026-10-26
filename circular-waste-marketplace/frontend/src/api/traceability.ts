import { apiClient } from "./client";
import type { TraceabilityTimelineResponse, TraceabilityEventRead } from "./types";

export async function getBatchTimeline(batchId: string): Promise<TraceabilityTimelineResponse> {
  const res = await apiClient.get<TraceabilityTimelineResponse>(`/traceability/batch/${batchId}`);
  return res.data;
}

export function mapEventToDisplay(event: TraceabilityEventRead): {
  human_label: string;
  icon_name: string;
  color: string;
} {
  const map: Record<string, { label: string; icon: string; color: string }> = {
    "batch.submitted": { label: "Batch submitted by supplier", icon: "FilePlus", color: "text-blue-400" },
    "batch.created": { label: "Batch created", icon: "FilePlus", color: "text-blue-400" },
    "pickup.created": { label: "Pickup requested", icon: "Truck", color: "text-indigo-400" },
    "pickup.assigned": { label: "Driver assigned", icon: "UserCheck", color: "text-indigo-400" },
    "pickup.status_changed": { label: "Pickup status updated", icon: "Truck", color: "text-indigo-400" },
    "pickup.completed": { label: "Pickup completed", icon: "Truck", color: "text-emerald-400" },
    "weight.recorded": { label: "Weight recorded", icon: "Scale", color: "text-amber-400" },
    "weight.acknowledged": { label: "Weight confirmed by supplier", icon: "CheckCircle", color: "text-emerald-400" },
    "sorting.completed": { label: "Sorting completed", icon: "Layers", color: "text-purple-400" },
    "listing.created": { label: "Listed on marketplace", icon: "Tag", color: "text-emerald-400" },
    "listing.cancelled": { label: "Listing cancelled", icon: "Tag", color: "text-red-400" },
    "bid.placed": { label: "Bid placed", icon: "Gavel", color: "text-amber-400" },
    "order.created_from_bid": { label: "Order created from bid", icon: "ShoppingCart", color: "text-emerald-400" },
    "order.created_buy_now": { label: "Order created (buy now)", icon: "ShoppingCart", color: "text-emerald-400" },
    "order.escrow_held": { label: "Payment held in escrow", icon: "Lock", color: "text-blue-400" },
    "order.shipped": { label: "Order shipped", icon: "Truck", color: "text-indigo-400" },
    "order.delivered": { label: "Order delivered", icon: "PackageCheck", color: "text-emerald-400" },
    "order.completed": { label: "Order completed", icon: "CheckCircle2", color: "text-emerald-500" },
    "order.cancelled": { label: "Order cancelled", icon: "XCircle", color: "text-red-400" },
  };
  const entry = map[event.event_type] ?? {
    label: event.event_type.replace(/[._]/g, " "),
    icon: "Circle",
    color: "text-slate-400",
  };
  return { human_label: entry.label, icon_name: entry.icon, color: entry.color };
}
