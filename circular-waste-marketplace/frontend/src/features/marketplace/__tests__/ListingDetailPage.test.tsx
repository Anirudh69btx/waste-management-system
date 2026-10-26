import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ListingDetailPage } from "../pages/ListingDetailPage";
import * as marketplaceApi from "@/api/marketplace";
import { useAuthStore } from "@/features/auth/store";
import type { MarketplaceListingRead } from "@/api/types";

vi.mock("@/api/marketplace", () => ({
  getListing: vi.fn(),
  buyNow: vi.fn(),
  placeBid: vi.fn(),
}));

describe("ListingDetailPage", () => {
  let queryClient: QueryClient;

  const mockListing: MarketplaceListingRead = {
    id: "list-100",
    seller_id: "seller-user-abc",
    category_id: 34,
    title: "1000kg Pure Clear PET Flakes",
    description: "Cold-washed optical sorted post-consumer PET bottles flaked to 10mm.",
    quantity_kg: 1000,
    available_kg: 1000,
    price_per_kg: 28,
    min_bid_kg: 100,
    purity_grade: "GRADE_A",
    status: "active",
    inventory_lot_id: "lot-100",
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-01T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      user: {
        id: "buyer-user-1",
        email: "buyer@recycle.com",
        full_name: "Buyer User",
        role: "RECYCLER",
        organization_name: "Green Recycle Corp",
        is_active: true,
        is_verified: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      status: "authenticated",
    });
  });

  const renderComponent = (listingId = "list-100") =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/marketplace/${listingId}`]}>
          <Routes>
            <Route path="/marketplace/:id" element={<ListingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders listing detail with material specifications and price", async () => {
    vi.mocked(marketplaceApi.getListing).mockResolvedValueOnce(mockListing);

    renderComponent();

    expect(await screen.findByText("1000kg Pure Clear PET Flakes")).toBeInTheDocument();
    expect(screen.getByText("₹28")).toBeInTheDocument();
    expect(screen.getAllByText("1000.0 kg").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Cold-washed optical sorted post-consumer PET bottles flaked to 10mm.")
    ).toBeInTheDocument();
  });

  it("opens Buy Now modal when clicking Buy Now button", async () => {
    vi.mocked(marketplaceApi.getListing).mockResolvedValueOnce(mockListing);

    renderComponent();

    const buyNowBtn = await screen.findByRole("button", { name: /Buy Now/i });
    fireEvent.click(buyNowBtn);

    expect(await screen.findByText("Confirm Buy Now")).toBeInTheDocument();
    expect(screen.getByText("Escrow Protected Transaction")).toBeInTheDocument();
  });

  it("opens Bid modal when clicking Place Bid Proposal button", async () => {
    vi.mocked(marketplaceApi.getListing).mockResolvedValueOnce(mockListing);

    renderComponent();

    const bidBtn = await screen.findByRole("button", { name: /Place Bid Proposal/i });
    fireEvent.click(bidBtn);

    expect(await screen.findByText("Place a Bid")).toBeInTheDocument();
    expect(screen.getByText("Submit Bid Proposal")).toBeInTheDocument();
  });

  it("disables purchase actions when current user is the seller", async () => {
    // Current user matches listing.seller_id
    useAuthStore.setState({
      user: {
        id: "seller-user-abc",
        email: "seller@corp.com",
        full_name: "Seller User",
        role: "RECYCLER",
        organization_name: "Seller Corp",
        is_active: true,
        is_verified: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      status: "authenticated",
    });

    vi.mocked(marketplaceApi.getListing).mockResolvedValueOnce(mockListing);

    renderComponent();

    expect(await screen.findByText("You are the seller")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Buy Now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place Bid Proposal/i })).not.toBeInTheDocument();
  });
});
