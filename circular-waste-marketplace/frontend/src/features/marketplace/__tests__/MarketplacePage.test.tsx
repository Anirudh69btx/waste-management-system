import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MarketplacePage } from "../pages/MarketplacePage";
import * as marketplaceApi from "@/api/marketplace";
import type { MarketplaceListingRead } from "@/api/types";

vi.mock("@/api/marketplace", () => ({
  listListings: vi.fn(),
}));

describe("MarketplacePage", () => {
  let queryClient: QueryClient;

  const mockListings: MarketplaceListingRead[] = [
    {
      id: "listing-1",
      seller_id: "seller-1",
      category_id: 34,
      title: "Clean PET Flakes - Clear Bale",
      description: "High quality optical sorted clear PET flakes.",
      quantity_kg: 500,
      available_kg: 500,
      price_per_kg: 24.5,
      min_bid_kg: 50,
      purity_grade: "GRADE_A",
      status: "active",
      inventory_lot_id: "lot-1",
      created_at: "2026-02-01T10:00:00Z",
      updated_at: "2026-02-01T10:00:00Z",
    },
    {
      id: "listing-2",
      seller_id: "seller-2",
      category_id: 35,
      title: "Sorted Corrugated Cardboard Bales",
      description: "Baled OCC paper waste.",
      quantity_kg: 1000,
      available_kg: 800,
      price_per_kg: 11.0,
      min_bid_kg: 100,
      purity_grade: "GRADE_B",
      status: "active",
      inventory_lot_id: "lot-2",
      created_at: "2026-02-01T11:00:00Z",
      updated_at: "2026-02-01T11:00:00Z",
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
          <MarketplacePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders feedstock listing cards from query mock", async () => {
    vi.mocked(marketplaceApi.listListings).mockResolvedValueOnce({
      items: mockListings,
      total: 2,
    });

    renderComponent();

    expect(await screen.findByText("Clean PET Flakes - Clear Bale")).toBeInTheDocument();
    expect(screen.getByText("Sorted Corrugated Cardboard Bales")).toBeInTheDocument();
    expect(screen.getByText("₹24.5")).toBeInTheDocument();
    expect(screen.getByText("₹11")).toBeInTheDocument();
    expect(screen.getAllByText("View details").length).toBe(2);
  });

  it("filters listings by purity grade client-side", async () => {
    vi.mocked(marketplaceApi.listListings).mockResolvedValueOnce({
      items: mockListings,
      total: 2,
    });

    renderComponent();

    expect(await screen.findByText("Clean PET Flakes - Clear Bale")).toBeInTheDocument();

    // Select purity grade dropdown
    const selects = screen.getAllByRole("combobox");
    const puritySelect = selects[1]; // second dropdown is Purity Grade

    fireEvent.change(puritySelect, { target: { value: "GRADE_A" } });

    // Only Grade A listing remains visible
    expect(screen.getByText("Clean PET Flakes - Clear Bale")).toBeInTheDocument();
    expect(screen.queryByText("Sorted Corrugated Cardboard Bales")).not.toBeInTheDocument();
  });

  it("displays empty state when no listings match", async () => {
    vi.mocked(marketplaceApi.listListings).mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    renderComponent();

    expect(await screen.findByText("No listings available")).toBeInTheDocument();
    expect(screen.getByText("Check back soon or adjust your category and price filters.")).toBeInTheDocument();
  });
});
