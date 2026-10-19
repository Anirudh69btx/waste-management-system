import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock apiClient before importing the module under test
vi.mock("@/api/client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { apiClient } from "@/api/client";

// Dynamically import after mock is in place
const { submitIntake, getIntake, getIntakeQr } = await import("@/api/waste");

describe("waste API module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submitIntake sends FormData with category_id as string and Idempotency-Key header", async () => {
    const mockIntake = { id: "abc-123", batch_code: "CWM-001" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockIntake });

    const result = await submitIntake(
      {
        category_id: 33,
        purity_grade: "GRADE_A",
        declared_weight_kg: 100,
        notes: "test notes",
      },
      []
    );

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, formData, config] = vi.mocked(apiClient.post).mock.calls[0];

    expect(url).toBe("/intake/create");
    expect(formData).toBeInstanceOf(FormData);

    const form = formData as FormData;
    expect(form.get("category_id")).toBe("33"); // string, not number
    expect(form.get("purity_grade")).toBe("GRADE_A");
    expect(form.get("declared_weight_kg")).toBe("100");
    expect(form.get("notes")).toBe("test notes");

    // Idempotency-Key header must be present
    expect(config?.headers?.["Idempotency-Key"]).toBeTruthy();

    expect(result).toEqual(mockIntake);
  });

  it("submitIntake appends images to FormData", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    const file1 = new File(["data1"], "photo1.jpg", { type: "image/jpeg" });
    const file2 = new File(["data2"], "photo2.png", { type: "image/png" });

    await submitIntake(
      { category_id: 34, purity_grade: "GRADE_B", declared_weight_kg: 50 },
      [file1, file2]
    );

    const form = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    const images = form.getAll("images");
    expect(images).toHaveLength(2);
  });

  it("getIntakeQr returns qr_code_data_url", async () => {
    const mockQr = {
      intake_id: "abc-123",
      batch_code: "CWM-001",
      qr_code_data_url: "data:image/png;base64,abc123",
      manifest_signature: "sig",
      verification_url: "https://example.com/verify",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockQr });

    const result = await getIntakeQr("abc-123");

    expect(apiClient.get).toHaveBeenCalledWith("/intake/abc-123/qr");
    expect(result.qr_code_data_url).toBe("data:image/png;base64,abc123");
  });
});
