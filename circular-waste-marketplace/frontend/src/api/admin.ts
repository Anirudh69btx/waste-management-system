import { apiClient } from "./client";
import type {
  AdminUser, AdminUserListResponse, AdminRoleChangeRequest,
  AdminDispute, AdminDisputeListResponse, ActivityFeedResponse,
} from "./types";

export async function listUsers(params: {
  role?: string; status?: "active" | "inactive";
  search?: string; limit?: number; offset?: number;
} = {}): Promise<AdminUserListResponse> {
  const q = new URLSearchParams();
  if (params.role) q.append("role", params.role);
  if (params.status) q.append("status", params.status);
  if (params.search) q.append("search", params.search);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<AdminUserListResponse>(`/admin/users?${q}`);
  return res.data;
}

export async function changeUserRole(userId: string, payload: AdminRoleChangeRequest): Promise<AdminUser> {
  const res = await apiClient.patch<AdminUser>(`/admin/users/${userId}/role`, payload);
  return res.data;
}

export async function deactivateUser(userId: string, reason: string): Promise<AdminUser> {
  const res = await apiClient.patch<AdminUser>(`/admin/users/${userId}/deactivate`, { reason });
  return res.data;
}

export async function activateUser(userId: string): Promise<AdminUser> {
  const res = await apiClient.patch<AdminUser>(`/admin/users/${userId}/activate`);
  return res.data;
}

export async function listDisputes(params: {
  resolution?: "pending" | "upheld" | "rejected" | "all";
  limit?: number; offset?: number;
} = {}): Promise<AdminDisputeListResponse> {
  const q = new URLSearchParams();
  q.append("resolution", params.resolution ?? "pending");
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<AdminDisputeListResponse>(`/admin/disputes?${q}`);
  return res.data;
}

export async function resolveDispute(
  ticketId: string, resolution: "upheld" | "rejected", note: string
): Promise<AdminDispute> {
  const res = await apiClient.post<AdminDispute>(`/admin/disputes/${ticketId}/resolve`, { resolution, note });
  return res.data;
}

export async function getActivityFeed(params: {
  event_type?: string; limit?: number; offset?: number;
} = {}): Promise<ActivityFeedResponse> {
  const q = new URLSearchParams();
  if (params.event_type) q.append("event_type", params.event_type);
  q.append("limit", String(params.limit ?? 50));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<ActivityFeedResponse>(`/admin/activity?${q}`);
  return res.data;
}
