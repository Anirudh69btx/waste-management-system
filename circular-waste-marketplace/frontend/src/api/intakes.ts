import { apiClient } from "./client";
import type { WasteIntake } from "./types";

export async function listIntakes(): Promise<WasteIntake[]> {
  const res = await apiClient.get<WasteIntake[]>("/intake/list");
  return res.data;
}
