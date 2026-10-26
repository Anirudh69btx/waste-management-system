import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SellerInventoryPage } from "../pages/SellerInventoryPage";
import * as sellerApi from "@/api/seller";
import type { InventoryLotRead } from "@/api/types";

vi.mock("@/api/seller", () => ({
  listMyInventoryLots: vi.fn(),
  createListingFromLot: vi.fn(),
}));

describe("SellerInventoryPage", () => {
  let queryClient: QueryClient;

  const mockLots: InventoryLotRead[] = [
    {
      id: "lot-1",
      lot_code: "LOT-PET-001",
      intake_id: "intake-1",
      sorting_record_id: "sr-1",
      category_id: 34,
      quantity_kg: 500,
      available_kg: 500,
      grade: "GRADE_A",
      contamination_percent: 2.5,
      moisture_percent: 1.0,
      status: "available",
      hub_location: "Hub 01",
      created_at: "2026-02-01T10:00:00Z",
    },
    {
      id: "lot-2",
      lot_code: "LOT-OCC-002",
      intake_id: "intake-2",
      sorting_record_id: "sr-2",
      category_id: 35,
      quantity_kg: 800,
      available_kg: 0,
      grade: "GRADE_B",
      contamination_percent: 5.0,
      moisture_percent: 4.0,
      status: "sold",
      hub_location: "Hub 02",
      created_at: "2026-02-01T11:00:00Z",
    },
  ];

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
          <SellerInventoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders lots table with stat metrics", async () => {
    vi.mocked(sellerApi.listMyInventoryLots).mockResolvedValue({
      items: mockLots,
      total: 2,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("LOT-PET-001")).toBeInTheDocument();
      expect(screen.getByText("LOT-OCC-002")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Lots")).toBeInTheDocument();
    expect(screen.getByText("Available (kg)")).toBeInTheDocument();
  });

  it("opens create listing modal when clicking action on available lot", async () => {
    vi.mocked(sellerApi.listMyInventoryLots).mockResolvedValue({
      items: mockLots,
      total: 2,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Create listing")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create listing"));

    await waitFor(() => {
      expect(screen.getByText("Create Marketplace Listing")).toBeInTheDocument();
    });
  });

  it("renders empty state when no lots exist in inventory", async () => {
    vi.mocked(sellerApi.listMyInventoryLots).mockResolvedValue({
      items: [],
      total: 0,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No inventory yet")).toBeInTheDocument();
    });
  });
});
