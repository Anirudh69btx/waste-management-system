import { apiClient } from "./client";
import type { WeightTicketRead } from "./types";

export async function getWeightTicket(intakeId: string): Promise<WeightTicketRead | null> {
  try {
    const res = await apiClient.get<WeightTicketRead>(`/intake/${intakeId}/weight-ticket`);
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export interface AcknowledgePayload {
  confirmed: boolean;
  dispute_notes?: string;
}

export async function acknowledgeWeight(
  intakeId: string,
  payload: AcknowledgePayload
): Promise<WeightTicketRead> {
  const res = await apiClient.post<WeightTicketRead>(
    `/intake/${intakeId}/weight-ticket/acknowledge`,
    payload
  );
  return res.data;
}

export interface CreateWeightTicketPayload {
  gross_weight_kg: number;
  tare_weight_kg: number;
  weight_method?: "manual" | "demo" | "digital_scale" | "weighbridge";
  scale_id?: string;
  scale_calibration_date?: string;
  photo_urls?: string[];
  notes?: string;
}

export async function createWeightTicket(
  intakeId: string,
  payload: CreateWeightTicketPayload
): Promise<WeightTicketRead> {
  const res = await apiClient.post<WeightTicketRead>(
    `/intake/${intakeId}/weight-ticket`,
    payload
  );
  return res.data;
}

export async function scanIntakeByCode(batchCode: string): Promise<any> {
  const res = await apiClient.get(`/intake/scan/${batchCode}`);
  return res.data;
}

