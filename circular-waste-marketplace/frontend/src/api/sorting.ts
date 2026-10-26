import { apiClient } from "./client";
import type { SortingRecordRead, SortingRecordCreate, InventoryLotRead } from "./types";

export async function processSorting(payload: SortingRecordCreate): Promise<{
  sorting_record: SortingRecordRead;
  inventory_lots: InventoryLotRead[];
}> {
  const res = await apiClient.post<{
    sorting_record: SortingRecordRead;
    inventory_lots: InventoryLotRead[];
  }>("/sorting/process", payload);
  return res.data;
}

export async function listSortingRecords(params: {
  intake_id?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: SortingRecordRead[]; total: number }> {
  const q = new URLSearchParams();
  if (params.intake_id) q.append("intake_id", params.intake_id);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<{ items: SortingRecordRead[]; total: number }>(
    `/sorting/records?${q.toString()}`
  );
  return res.data;
}

export async function getSortingRecord(id: string): Promise<SortingRecordRead> {
  const res = await apiClient.get<SortingRecordRead>(`/sorting/records/${id}`);
  return res.data;
}
