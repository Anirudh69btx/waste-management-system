import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AdminAnalyticsPage } from "../pages/AdminAnalyticsPage";
import * as analyticsApi from "@/api/analytics";
import type { AdminAnalytics } from "@/api/types";

vi.mock("@/api/analytics", () => ({
  getAdminAnalytics: vi.fn(),
}));

const mockAdminData: AdminAnalytics = {
  period_start: "2026-09-26",
  period_end: "2026-10-26",
  total_intakes: 1930,
  total_kg_diverted: 21450,
  total_co2e_saved_kg: 38610,
  total_gmv: 482000,
  active_users: 64,
  active_suppliers: 15,
  active_recyclers: 10,
  total_households_served: 15,
  kg_by_day: [
    { date: "2026-10-24", value: 680 },
    { date: "2026-10-25", value: 740 },
  ],
  gmv_by_day: [
    { date: "2026-10-24", value: 14500 },
    { date: "2026-10-25", value: 18200 },
  ],
  kg_by_category: [
    {
      category_id: 34,
      category_name: "PET Plastics (Grade 1)",
      quantity_kg: 8200,
      count: 420,
    },
  ],
  users_by_role: [
    { status: "GENERATOR", count: 38 },
    { status: "RECYCLER", count: 14 },
    { status: "LOGISTICS", count: 10 },
    { status: "ADMIN", count: 2 },
  ],
  intakes_by_status: [
    { status: "sorted", count: 1180 },
    { status: "weighed", count: 380 },
  ],
  top_suppliers: [
    { id: "supp-1", name: "Green Earth Organics Ltd", kg: 4120.5 },
    { id: "supp-2", name: "Danny Farm", kg: 3680.0 },
  ],
  top_sellers: [
    { id: "sell-1", name: "Apex Sorting Hub", revenue: 186000 },
  ],
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AdminAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsApi.getAdminAnalytics).mockResolvedValue(mockAdminData);
  });

  it("renders hero impact metrics", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Platform Impact")).toBeInTheDocument();
    });

    expect(screen.getByText("Tonnes CO₂e saved")).toBeInTheDocument();
    expect(screen.getByText("38.61")).toBeInTheDocument();
    expect(screen.getByText("Tonnes diverted from landfill")).toBeInTheDocument();
    expect(screen.getByText("21.45")).toBeInTheDocument();
    expect(screen.getByText("Marketplace GMV")).toBeInTheDocument();
    expect(screen.getByText("₹4,82,000")).toBeInTheDocument();
  });

  it("renders top suppliers and top sellers leaderboard tables", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Green Earth Organics Ltd")).toBeInTheDocument();
    });

    expect(screen.getByText("Danny Farm")).toBeInTheDocument();
    expect(screen.getByText("4,120.5 kg")).toBeInTheDocument();
    expect(screen.getByText("Apex Sorting Hub")).toBeInTheDocument();
    expect(screen.getByText("₹1,86,000")).toBeInTheDocument();
  });

  it("renders users by role donut chart", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Users by role donut chart" })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("GENERATOR")).toBeInTheDocument();
    expect(screen.getByText("RECYCLER")).toBeInTheDocument();
    expect(screen.getByText("LOGISTICS")).toBeInTheDocument();
  });
});
