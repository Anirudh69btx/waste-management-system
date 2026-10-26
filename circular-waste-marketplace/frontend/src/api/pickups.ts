import { apiClient } from "./client";
import type { PickupRequestRead, PickupListResponse } from "./types";

export interface CreatePickupPayload {
  intake_id: string;
  scheduled_start: string;
  scheduled_end: string;
  notes?: string;
}

export async function createPickup(payload: CreatePickupPayload): Promise<PickupRequestRead> {
  const res = await apiClient.post<PickupRequestRead>("/pickups", payload);
  return res.data;
}

export async function listPickups(params: {
  status?: string;
  intake_id?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PickupListResponse> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  if (params.intake_id) q.append("intake_id", params.intake_id);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<PickupListResponse>(`/pickups?${q.toString()}`);
  return res.data;
}

export async function getPickup(id: string): Promise<PickupRequestRead> {
  const res = await apiClient.get<PickupRequestRead>(`/pickups/${id}`);
  return res.data;
}

export async function cancelPickup(id: string, reason: string): Promise<PickupRequestRead> {
  const res = await apiClient.patch<PickupRequestRead>(`/pickups/${id}/status`, {
    new_status: "cancelled",
    reason,
  });
  return res.data;
}
