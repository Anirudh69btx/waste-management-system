import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { WalletBadge } from "../components/WalletBadge";
import * as rewardsApi from "@/api/rewards";

vi.mock("@/api/rewards", () => ({
  getWallet: vi.fn(),
}));

describe("WalletBadge", () => {
  it("renders points balance and navigates to /rewards on click", async () => {
    vi.mocked(rewardsApi.getWallet).mockResolvedValue({
      id: "w-1",
      user_id: "u-1",
      points_balance: 1450,
      lifetime_points: 2000,
      streak_days: 14,
      last_submission_date: "2026-10-26",
      created_at: "2026-10-01T00:00:00Z",
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<WalletBadge />} />
            <Route path="/rewards" element={<div data-testid="rewards-dest">Rewards Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const badge = await screen.findByTestId("wallet-badge");
    expect(await screen.findByText(/1,450 pts/i)).toBeInTheDocument();
    expect(screen.getByTestId("wallet-badge-streak")).toHaveTextContent("14d");

    fireEvent.click(badge);
    expect(await screen.findByTestId("rewards-dest")).toBeInTheDocument();
  });
});
