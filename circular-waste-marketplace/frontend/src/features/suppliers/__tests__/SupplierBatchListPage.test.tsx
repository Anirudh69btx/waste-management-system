import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupplierBatchListPage } from "../pages/SupplierBatchListPage";

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

import { listIntakes } from "@/api/intakes";

const mockBatch = {
  id: "intake-101",
  batch_code: "CWM-2026-0101",
  supplier_id: "sup-1",
  category: {
    id: 34,
    code: "PLASTIC_PET",
    name: "PET Plastics (Grade 1)",
    unit_of_measure: "kg",
    carbon_offset_factor: 1.2,
  },
  purity_grade: "GRADE_A",
  declared_weight_kg: 500,
  verified_weight_kg: 495,
  weight_discrepancy_kg: -5,
  status: "SORTED_VERIFIED",
  qr_code_hash: "hash101",
  image_paths: [],
  notes: "Sorted clean PET bottles",
  scale_operator_id: "op-1",
  verified_at: "2026-01-02T10:00:00Z",
  created_at: "2026-01-01T08:00:00Z",
};

function renderWithClient(ui: React.ReactElement, initialEntries = ["/dashboard/batches"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SupplierBatchListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders list of batches with code, category, weights, and status badges", async () => {
    vi.mocked(listIntakes).mockResolvedValue({
      items: [mockBatch as any],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithClient(<SupplierBatchListPage />);

    await waitFor(() => {
      expect(screen.getByText("CWM-2026-0101")).toBeInTheDocument();
      expect(screen.getAllByText("PET Plastics (Grade 1)").length).toBeGreaterThan(0);
      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("495")).toBeInTheDocument();
      expect(screen.getAllByText(/SORTED VERIFIED/i).length).toBeGreaterThan(0);
    });
  });

  it("filters by status when status select changes", async () => {
    vi.mocked(listIntakes).mockResolvedValue({
      items: [mockBatch as any],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithClient(<SupplierBatchListPage />);

    await waitFor(() => {
      expect(screen.getByText("CWM-2026-0101")).toBeInTheDocument();
    });

    const statusSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(statusSelect, { target: { value: "SORTED_VERIFIED" } });

    await waitFor(() => {
      expect(listIntakes).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SORTED_VERIFIED",
        })
      );
    });
  });

  it("filters by category when category select changes", async () => {
    vi.mocked(listIntakes).mockResolvedValue({
      items: [mockBatch as any],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithClient(<SupplierBatchListPage />);

    await waitFor(() => {
      expect(screen.getByText("CWM-2026-0101")).toBeInTheDocument();
    });

    const categorySelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(categorySelect, { target: { value: "34" } });

    await waitFor(() => {
      expect(listIntakes).toHaveBeenCalledWith(
        expect.objectContaining({
          category_id: 34,
        })
      );
    });
  });

  it("renders pagination controls and navigates between pages", async () => {
    vi.mocked(listIntakes).mockResolvedValue({
      items: [mockBatch as any],
      total: 45,
      limit: 20,
      offset: 0,
    });

    renderWithClient(<SupplierBatchListPage />);

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(listIntakes).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 20,
        })
      );
    });
  });

  it("displays empty state when no batches match filters", async () => {
    vi.mocked(listIntakes).mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    renderWithClient(<SupplierBatchListPage />);

    await waitFor(() => {
      expect(screen.getByText("No batches match current filters")).toBeInTheDocument();
      expect(screen.getByText("No batches found")).toBeInTheDocument();
    });
  });
});
