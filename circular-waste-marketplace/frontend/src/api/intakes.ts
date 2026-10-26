import { apiClient } from "./client";
import type { IntakeListResponse } from "./types";

export interface ListIntakesParams {
  status?: string;
  category_id?: number;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export async function listIntakes(params: ListIntakesParams = {}): Promise<IntakeListResponse> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  if (params.category_id) q.append("category_id", String(params.category_id));
  if (params.from_date) q.append("from_date", params.from_date);
  if (params.to_date) q.append("to_date", params.to_date);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<IntakeListResponse>(`/intake?${q.toString()}`);
  return res.data;
}
