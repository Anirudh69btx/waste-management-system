import { apiClient } from "./client";
import type { SupplierProfile, SupplierProfileCreateRequest } from "./types";

export async function getMySupplier(): Promise<SupplierProfile | null> {
  try {
    const res = await apiClient.get<SupplierProfile>("/suppliers/me");
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function createSupplier(
  payload: SupplierProfileCreateRequest
): Promise<SupplierProfile> {
  const res = await apiClient.post<SupplierProfile>("/suppliers/profile", payload);
  return res.data;
}
