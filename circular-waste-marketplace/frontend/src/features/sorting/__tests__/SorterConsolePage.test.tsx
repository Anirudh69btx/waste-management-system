import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SorterConsolePage } from "../pages/SorterConsolePage";
import * as intakesApi from "@/api/intakes";
import * as sortingApi from "@/api/sorting";
import type { WasteIntakeListItem, SortingRecordRead } from "@/api/types";

vi.mock("@/api/intakes", () => ({
  listIntakes: vi.fn(),
}));

vi.mock("@/api/sorting", () => ({
  listSortingRecords: vi.fn(),
  processSorting: vi.fn(),
}));

describe("SorterConsolePage", () => {
  let queryClient: QueryClient;

  const mockIntake: WasteIntakeListItem = {
    id: "intake-123",
    batch_code: "CWM-2026-SORT-001",
    supplier_id: "sup-99",
    category: {
      id: 34,
      code: "PLASTIC_PET",
      name: "PET Plastics (Grade 1)",
      unit_of_measure: "kg",
      carbon_offset_factor: 1.2,
    },
    purity_grade: "GRADE_A",
    declared_weight_kg: 150,
    verified_weight_kg: 148.5,
    weight_discrepancy_kg: -1.5,
    status: "weighed",
    qr_code_hash: "hash-sort-1",
    image_paths: [],
    notes: "Awaiting sorting",
    verified_at: "2026-02-01T10:00:00Z",
    created_at: "2026-02-01T09:00:00Z",
  };

  const mockRecord: SortingRecordRead = {
    id: "rec-001",
    intake_id: "intake-123",
    sorter_user_id: "sorter-1",
    input_weight_kg: 150,
    sorted_weight_kg: 140,
    rejected_weight_kg: 10,
    contamination_percent: 3,
    sort_grade: "GRADE_A",
    moisture_percent: null,
    notes: "Clean batch",
    photos: [],
    created_at: "2026-02-01T12:00:00Z",
    updated_at: "2026-02-01T12:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SorterConsolePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders weighed intakes in queue", async () => {
    vi.mocked(intakesApi.listIntakes).mockResolvedValueOnce({
      items: [mockIntake],
      total: 1,
      limit: 50,
      offset: 0,
    });
    vi.mocked(sortingApi.listSortingRecords).mockResolvedValueOnce({
      items: [mockRecord],
      total: 1,
    });

    renderComponent();

    expect(await screen.findByText("CWM-2026-SORT-001")).toBeInTheDocument();
    expect(screen.getByText("PET Plastics (Grade 1)")).toBeInTheDocument();
    expect(screen.getByText("148.5 kg")).toBeInTheDocument();
    expect(screen.getByText("Sort now")).toBeInTheDocument();
  });

  it("renders empty state when no weighed intakes are waiting", async () => {
    vi.mocked(intakesApi.listIntakes).mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });
    vi.mocked(sortingApi.listSortingRecords).mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    renderComponent();

    expect(await screen.findByText("No weighed intakes waiting")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Batch flow: supplier submits → driver picks up → weight recorded → sorter processes."
      )
    ).toBeInTheDocument();
  });

  it("opens SortIntakeModal when clicking 'Sort now'", async () => {
    vi.mocked(intakesApi.listIntakes).mockResolvedValueOnce({
      items: [mockIntake],
      total: 1,
      limit: 50,
      offset: 0,
    });
    vi.mocked(sortingApi.listSortingRecords).mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    renderComponent();

    const sortNowButton = await screen.findByRole("button", { name: /Sort now/i });
    fireEvent.click(sortNowButton);

    // Modal title should appear
    expect(await screen.findByText("Process Sorting")).toBeInTheDocument();
    expect(screen.getByText("Complete Sorting & Create Lots")).toBeInTheDocument();
  });
});
