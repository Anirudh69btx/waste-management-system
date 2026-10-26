import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SellerAnalyticsPage } from "../pages/SellerAnalyticsPage";
import * as analyticsApi from "@/api/analytics";
import type { SellerAnalytics } from "@/api/types";

vi.mock("@/api/analytics", () => ({
  getSellerAnalytics: vi.fn(),
}));

const mockSellerData: SellerAnalytics = {
  period_start: "2026-09-26",
  period_end: "2026-10-26",
  total_lots_created: 32,
  available_kg: 1240,
  reserved_kg: 380,
  sold_kg: 2150,
  total_revenue: 64500,
  revenue_this_period: 48200,
  avg_sale_price_per_kg: 22.42,
  bid_acceptance_rate: 76.5,
  pending_bids: 5,
  open_orders: 4,
  revenue_by_day: [
    { date: "2026-10-24", value: 4200 },
    { date: "2026-10-25", value: 5800 },
  ],
  kg_sold_by_category: [
    {
      category_id: 34,
      category_name: "PET Plastics (Grade 1)",
      quantity_kg: 1400,
      count: 12,
    },
  ],
  orders_by_status: [
    { status: "completed", count: 14 },
    { status: "escrow_held", count: 4 },
  ],
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SellerAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SellerAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsApi.getSellerAnalytics).mockResolvedValue(mockSellerData);
  });

  it("renders total revenue card and inventory stats", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    });

    expect(screen.getByText("₹64,500")).toBeInTheDocument();
    expect(screen.getByText("reserved: 380 kg")).toBeInTheDocument();
    expect(screen.getByText("₹22.42/kg")).toBeInTheDocument();
  });

  it("renders orders by status donut chart and legend", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Orders by status donut chart" })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("escrow held")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });
});
