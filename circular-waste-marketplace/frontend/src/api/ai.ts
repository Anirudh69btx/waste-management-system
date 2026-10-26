import { apiClient } from "./client";
import type { WasteAssessment } from "./types";

export async function getAssessment(intakeId: string): Promise<WasteAssessment | null> {
  try {
    const res = await apiClient.get<WasteAssessment>(`/ai/assessments/${intakeId}`);
    return res.data;
  } catch (err: any) {
    // 404 or 202 = Celery hasn't finished yet
    const status = err?.response?.status ?? err?.code;
    if (status === 404 || status === 202) return null;
    throw err;
  }
}

export async function retryAssessment(intakeId: string): Promise<{ queued: boolean }> {
  const res = await apiClient.post<{ queued: boolean }>(`/ai/assessments/${intakeId}/retry`, {});
  return res.data;
}
