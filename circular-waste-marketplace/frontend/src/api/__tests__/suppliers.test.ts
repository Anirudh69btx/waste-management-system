import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { apiClient } from "@/api/client";
import { getMySupplier, createSupplier } from "@/api/suppliers";
import type { SupplierProfile } from "@/api/types";

describe("suppliers API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getMySupplier returns null when backend returns 404", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({
      response: { status: 404 },
    });

    const result = await getMySupplier();
    expect(apiClient.get).toHaveBeenCalledWith("/suppliers/me");
    expect(result).toBeNull();
  });

  it("getMySupplier returns profile when backend returns 200", async () => {
    const mockProfile: SupplierProfile = {
      id: "sup-1",
      user_id: "usr-1",
      business_name: "Green Solutions Ltd",
      registration_number: "REG-9999",
      facility_address: "123 Eco Way",
      latitude: 12.97,
      longitude: 77.59,
      contact_phone: "+919876543210",
      verification_status: "VERIFIED",
      created_at: "2026-01-01T00:00:00Z",
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: mockProfile,
    });

    const result = await getMySupplier();
    expect(apiClient.get).toHaveBeenCalledWith("/suppliers/me");
    expect(result).toEqual(mockProfile);
  });
});
