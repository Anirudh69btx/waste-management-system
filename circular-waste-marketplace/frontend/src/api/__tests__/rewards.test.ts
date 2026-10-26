import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWallet, redeemVoucher } from "../rewards";
import { apiClient } from "../client";

vi.mock("../client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("rewards API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getWallet calls GET /rewards/wallet and returns wallet data", async () => {
    const mockWallet = {
      id: "w-1",
      user_id: "u-1",
      points_balance: 850,
      lifetime_points: 1500,
      streak_days: 7,
      last_submission_date: "2026-10-26",
      created_at: "2026-10-01T00:00:00Z",
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockWallet });

    const res = await getWallet();
    expect(apiClient.get).toHaveBeenCalledWith("/rewards/wallet");
    expect(res).toEqual(mockWallet);
  });

  it("redeemVoucher calls POST /rewards/redeem with product_id", async () => {
    const mockOrder = {
      id: "o-1",
      order_code: "ECO-2026-ABC123",
      product_id: "p-1",
      product_title: "Recycled Paper Notebook (A5)",
      points_paid: 200,
      status: "pending",
      created_at: "2026-10-26T10:00:00Z",
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockOrder });

    const res = await redeemVoucher("p-1");
    expect(apiClient.post).toHaveBeenCalledWith("/rewards/redeem", { product_id: "p-1" });
    expect(res).toEqual(mockOrder);
  });
});
