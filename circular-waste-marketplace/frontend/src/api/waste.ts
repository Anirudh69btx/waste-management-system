import { apiClient } from "./client";
import type { WasteIntake, QRCodeResponse, IntakeCreateRequest } from "./types";

export async function submitIntake(
  payload: IntakeCreateRequest,
  images: File[],
  onProgress?: (pct: number) => void
): Promise<WasteIntake> {
  const form = new FormData();
  form.append("category_id", String(payload.category_id));
  form.append("purity_grade", payload.purity_grade);
  form.append("declared_weight_kg", String(payload.declared_weight_kg));
  if (payload.notes) form.append("notes", payload.notes);
  images.forEach((img) => form.append("images", img));

  const idem =
    globalThis.crypto?.randomUUID?.() ??
    `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const res = await apiClient.post<WasteIntake>("/intake/create", form, {
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
    headers: { "Idempotency-Key": idem },
  });
  return res.data;
}

export async function getIntake(id: string): Promise<WasteIntake> {
  const res = await apiClient.get<WasteIntake>(`/intake/${id}`);
  return res.data;
}

export async function getIntakeQr(id: string): Promise<QRCodeResponse> {
  const res = await apiClient.get<QRCodeResponse>(`/intake/${id}/qr`);
  return res.data;
}
