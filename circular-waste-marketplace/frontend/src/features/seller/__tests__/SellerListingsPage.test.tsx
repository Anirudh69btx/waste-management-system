import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SellerListingsPage } from "../pages/SellerListingsPage";
import * as sellerApi from "@/api/seller";
import type { MarketplaceListingRead } from "@/api/types";

vi.mock("@/api/seller", () => ({
  listMyListings: vi.fn(),
  cancelListing: vi.fn(),
}));

describe("SellerListingsPage", () => {
  let queryClient: QueryClient;

  const mockListings: MarketplaceListingRead[] = [
    {
      id: "listing-1",
      seller_id: "seller-1",
      category_id: 34,
      title: "Clean PET Flakes Bale",
      description: "Standard optical sorted flake",
      quantity_kg: 500,
      available_kg: 500,
      price_per_kg: 22.5,
      min_bid_kg: 50,
      purity_grade: "GRADE_A",
      status: "active",
      inventory_lot_id: "lot-1",
      created_at: "2026-02-01T10:00:00Z",
      updated_at: "2026-02-01T10:00:00Z",
    },
    {
      id: "listing-2",
      seller_id: "seller-1",
      category_id: 35,
      title: "OCC Cardboard Bundle",
      description: null,
      quantity_kg: 1000,
      available_kg: 0,
      price_per_kg: 10.0,
      min_bid_kg: 100,
      purity_grade: "GRADE_B",
      status: "sold",
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
          <SellerListingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders listings cards with stock and price metrics", async () => {
    vi.mocked(sellerApi.listMyListings).mockResolvedValue({
      items: mockListings,
      total: 2,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Clean PET Flakes Bale")).toBeInTheDocument();
      expect(screen.getByText("OCC Cardboard Bundle")).toBeInTheDocument();
    });

    expect(screen.getByText("₹22.5")).toBeInTheDocument();
    expect(screen.getByText("₹10")).toBeInTheDocument();
  });

  it("opens cancel confirmation modal when clicking cancel button", async () => {
    vi.mocked(sellerApi.listMyListings).mockResolvedValue({
      items: mockListings,
      total: 2,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Cancel")).toBeInTheDocument();
    });
  });
});
