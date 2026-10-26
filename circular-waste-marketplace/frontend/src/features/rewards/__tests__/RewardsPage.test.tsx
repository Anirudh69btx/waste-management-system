import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { RewardsPage } from "../pages/RewardsPage";
import * as rewardsApi from "@/api/rewards";

vi.mock("@/api/rewards", () => ({
  getWallet: vi.fn(),
  listProducts: vi.fn(),
  listTransactions: vi.fn(),
  listMyEcoOrders: vi.fn(),
  redeemVoucher: vi.fn(),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RewardsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("RewardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rewardsApi.getWallet).mockResolvedValue({
      id: "w-1",
      user_id: "u-1",
      points_balance: 350,
      lifetime_points: 1200,
      streak_days: 7,
      last_submission_date: "2026-10-26",
      created_at: "2026-10-01T00:00:00Z",
    });
    vi.mocked(rewardsApi.listProducts).mockResolvedValue({
      items: [
        {
          id: "p-notebook",
          title: "Recycled Paper Notebook (A5)",
          description: "100% post-consumer paper journal",
          price: 95,
          stock_quantity: 500,
          category: "LIFESTYLE",
          unit: "piece",
          weight_kg: 0.2,
          points_cost: 200,
          is_active: true,
        },
        {
          id: "p-compost",
          title: "Fortified Organic Compost (25kg)",
          description: "Circular compost from segregated municipal waste",
          price: 280,
          stock_quantity: 450,
          category: "AGRICULTURE",
          unit: "bag",
          weight_kg: 25.0,
          points_cost: 500,
          is_active: true,
        },
      ],
      total: 2,
    });
    vi.mocked(rewardsApi.listTransactions).mockResolvedValue({
      items: [
        {
          id: "tx-1",
          points_delta: 350,
          transaction_type: "earn_intake",
          description: "Verified weight reward for batch B-101",
          reference_type: "intake",
          reference_id: "i-1",
          created_at: new Date().toISOString(),
        },
      ],
      total: 1,
    });
    vi.mocked(rewardsApi.listMyEcoOrders).mockResolvedValue({
      items: [],
      total: 0,
    });
  });

  it("renders wallet points balance and streak badge", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("wallet-points-balance")).toHaveTextContent("350");
    });
    expect(screen.getByTestId("streak-badge")).toHaveTextContent("7-day streak");
  });

  it("renders vouchers grid with product titles and costs", async () => {
    renderPage();
    expect(await screen.findByText("Recycled Paper Notebook (A5)")).toBeInTheDocument();
    expect(screen.getByText("Fortified Organic Compost (25kg)")).toBeInTheDocument();
    expect(screen.getByText("200 pts")).toBeInTheDocument();
    expect(screen.getByText("500 pts")).toBeInTheDocument();
  });

  it("disables redeem button when points_balance < points_cost", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("voucher-card-p-compost")).toBeInTheDocument();
    });

    const notebookCard = screen.getByTestId("voucher-card-p-notebook");
    const compostCard = screen.getByTestId("voucher-card-p-compost");

    const notebookBtn = notebookCard.querySelector("button");
    const compostBtn = compostCard.querySelector("button");

    expect(notebookBtn).not.toBeDisabled();
    expect(compostBtn).toBeDisabled();
  });
});
