import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupplierOverviewPage } from "../pages/SupplierOverviewPage";

vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("@/api/intakes", () => ({
  listIntakes: vi.fn(),
}));

vi.mock("@/api/pickups", () => ({
  listPickups: vi.fn(),
}));

import { listIntakes } from "@/api/intakes";
import { listPickups } from "@/api/pickups";

const mockIntakeItem = {
  id: "intake-001",
  batch_code: "CWM-2026-0001",
  supplier_id: "sup-1",
  category: {
    id: 33,
    code: "ORGANIC_BIOMASS",
    name: "Organic & Food Waste",
    unit_of_measure: "kg",
    carbon_offset_factor: 0.5,
  },
  purity_grade: "GRADE_A",
  declared_weight_kg: 200,
  verified_weight_kg: null,
  weight_discrepancy_kg: null,
  status: "SUBMITTED",
  qr_code_hash: "hash001",
  image_paths: [],
  notes: "Fresh batch",
  scale_operator_id: null,
  verified_at: null,
  created_at: "2026-01-01T10:00:00Z",
};

const mockPickupItem = {
  id: "pickup-001",
  intake_id: "intake-001",
  driver_id: null,
  status: "requested",
  scheduled_start: "2026-01-02T09:00:00Z",
  scheduled_end: "2026-01-02T11:00:00Z",
  notes: "Morning gate",
  created_at: "2026-01-01T12:00:00Z",
  updated_at: "2026-01-01T12:00:00Z",
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SupplierOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 4 stat cards with aggregate metrics when data is loaded", async () => {
    vi.mocked(listIntakes).mockResolvedValueOnce({
      items: [mockIntakeItem as any],
      total: 1,
      limit: 5,
      offset: 0,
    });
    vi.mocked(listPickups).mockResolvedValueOnce({
      items: [mockPickupItem as any],
      total: 1,
      limit: 5,
      offset: 0,
    });

    renderWithClient(<SupplierOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText("Total Batches")).toBeInTheDocument();
      expect(screen.getByText("Declared Weight")).toBeInTheDocument();
      expect(screen.getByText("Est. Payout")).toBeInTheDocument();
      expect(screen.getByText("CO₂e Saved")).toBeInTheDocument();
    });
  });

  it("renders recent batches table with row details and batch code", async () => {
    vi.mocked(listIntakes).mockResolvedValueOnce({
      items: [mockIntakeItem as any],
      total: 1,
      limit: 5,
      offset: 0,
    });
    vi.mocked(listPickups).mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 5,
      offset: 0,
    });

    renderWithClient(<SupplierOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText("CWM-2026-0001")).toBeInTheDocument();
      expect(screen.getAllByText(/200 kg/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/submitted/i).length).toBeGreaterThan(0);
    });
  });

  it("renders upcoming pickups list with scheduled time details", async () => {
    vi.mocked(listIntakes).mockResolvedValueOnce({
      items: [mockIntakeItem as any],
      total: 1,
      limit: 5,
      offset: 0,
    });
    vi.mocked(listPickups).mockResolvedValueOnce({
      items: [mockPickupItem as any],
      total: 1,
      limit: 5,
      offset: 0,
    });

    renderWithClient(<SupplierOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText("Upcoming Pickups")).toBeInTheDocument();
      expect(screen.getByText("Requested")).toBeInTheDocument();
    });
  });

  it("renders empty state with CTA to submit intake when 0 batches exist", async () => {
    vi.mocked(listIntakes).mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 5,
      offset: 0,
    });
    vi.mocked(listPickups).mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 5,
      offset: 0,
    });

    renderWithClient(<SupplierOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText("No batches yet")).toBeInTheDocument();
      expect(screen.getAllByText(/Sell \/ Donate My Waste/i).length).toBeGreaterThan(0);
    });
  });
});
