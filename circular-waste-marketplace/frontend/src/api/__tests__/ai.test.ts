import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../client";
import { getAssessment } from "../ai";
import type { WasteAssessment } from "../types";

vi.mock("../client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("api/ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAssessment returns null on 404", async () => {
    vi.mocked(apiClient.get).mockRejectedValue({
      response: { status: 404 },
    });

    const result = await getAssessment("intake-missing");
    expect(result).toBeNull();
  });

  it("getAssessment returns parsed WasteAssessment on 200", async () => {
    const mockAssessment: WasteAssessment = {
      id: "assess-100",
      intake_id: "intake-100",
      detected_category: "FERROUS_METAL",
      confidence_score: 0.96,
      estimated_purity_percentage: 98.2,
      contamination_detected: false,
      contamination_details: [],
      suggested_purity_grade: "A",
      model_version: "waste-classifier-v1.2",
      latency_ms: 210,
      created_at: "2026-10-26T12:00:00Z",
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockAssessment } as never);

    const result = await getAssessment("intake-100");
    expect(result).toEqual(mockAssessment);
    expect(apiClient.get).toHaveBeenCalledWith("/ai/assessments/intake-100");
  });
});
