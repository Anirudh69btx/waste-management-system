import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupplierAnalyticsPage } from "../pages/SupplierAnalyticsPage";
import * as analyticsApi from "@/api/analytics";
import type { SupplierAnalytics } from "@/api/types";

vi.mock("@/api/analytics", () => ({
  getSupplierAnalytics: vi.fn(),
}));

const mockSupplierData: SupplierAnalytics = {
  period_start: "2026-09-26",
  period_end: "2026-10-26",
  total_batches: 24,
  total_declared_kg: 520,
  total_verified_kg: 495.5,
  total_estimated_earnings: 12400,
  total_actual_earnings: 11890,
  total_co2e_saved_kg: 743.2,
  avg_kg_per_batch: 20.6,
  rejection_rate: 4.2,
  submission_streak_days: 12,
  kg_by_day: [
    { date: "2026-10-24", value: 45 },
    { date: "2026-10-25", value: 60 },
  ],
  batches_by_status: [
    { status: "sorted", count: 18 },
    { status: "weighed", count: 6 },
  ],
  kg_by_category: [
    {
      category_id: 34,
      category_name: "PET Plastics (Grade 1)",
      quantity_kg: 310,
      count: 15,
    },
  ],
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SupplierAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SupplierAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsApi.getSupplierAnalytics).mockResolvedValue(mockSupplierData);
  });

  it("renders 4 stat cards and impact summary", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Total Batches Submitted")).toBeInTheDocument();
    });

    expect(screen.getByText("Total kg Verified")).toBeInTheDocument();
    expect(screen.getByText("Total Earnings")).toBeInTheDocument();
    expect(screen.getByText("CO₂e Saved")).toBeInTheDocument();
    expect(screen.getByText("12 days")).toBeInTheDocument();
  });

  it("updates query when period selector is clicked", async () => {
    renderPage();

    await waitFor(() => {
      expect(analyticsApi.getSupplierAnalytics).toHaveBeenCalledWith("30d");
    });

    fireEvent.click(screen.getByRole("button", { name: "90 days" }));

    await waitFor(() => {
      expect(analyticsApi.getSupplierAnalytics).toHaveBeenCalledWith("90d");
    });
  });
});
