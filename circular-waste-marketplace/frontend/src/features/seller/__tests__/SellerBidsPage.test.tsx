import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SellerBidsPage } from "../pages/SellerBidsPage";
import * as sellerApi from "@/api/seller";
import type { MarketplaceListingRead, BidRead, PurchaseOrderRead } from "@/api/types";

vi.mock("@/api/seller", () => ({
  listMyListings: vi.fn(),
  listListingBids: vi.fn(),
  acceptBid: vi.fn(),
  rejectBid: vi.fn(),
}));

describe("SellerBidsPage", () => {
  let queryClient: QueryClient;

  const mockListing: MarketplaceListingRead = {
    id: "listing-1",
    seller_id: "seller-1",
    category_id: 34,
    title: "Optical Sorted PET Bottles",
    description: null,
    quantity_kg: 500,
    available_kg: 500,
    price_per_kg: 20.0,
    min_bid_kg: 50,
    purity_grade: "GRADE_A",
    status: "active",
    inventory_lot_id: "lot-1",
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-01T10:00:00Z",
  };

  const mockBids: BidRead[] = [
    {
      id: "bid-1",
      listing_id: "listing-1",
      buyer_user_id: "buyer-uuid-1234",
      bid_price_per_kg: 19.5,
      quantity_kg: 100,
      total_amount: 1950,
      message: "Can pickup tomorrow morning",
      status: "pending",
      created_at: "2026-02-01T10:30:00Z",
    },
  ];

  const mockOrder: PurchaseOrderRead = {
    id: "po-1",
    order_code: "PO-2026-000001",
    listing_id: "listing-1",
    buyer_user_id: "buyer-uuid-1234",
    seller_user_id: "seller-1",
    quantity_kg: 100,
    unit_price: 19.5,
    total_amount: 1950,
    currency: "INR",
    status: "pending_payment",
    escrow_held_at: null,
    completed_at: null,
    cancellation_reason: null,
    created_at: "2026-02-01T11:00:00Z",
    updated_at: "2026-02-01T11:00:00Z",
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
          <SellerBidsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders bids grouped by listing", async () => {
    vi.mocked(sellerApi.listMyListings).mockResolvedValue({
      items: [mockListing],
      total: 1,
    });
    vi.mocked(sellerApi.listListingBids).mockResolvedValue({
      items: mockBids,
      total: 1,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Optical Sorted PET Bottles")).toBeInTheDocument();
      expect(screen.getByText("₹19.5")).toBeInTheDocument();
      expect(screen.getByText("Can pickup tomorrow morning")).toBeInTheDocument();
    });
  });

  it("accept button opens confirmation modal and calls acceptBid", async () => {
    vi.mocked(sellerApi.listMyListings).mockResolvedValue({
      items: [mockListing],
      total: 1,
    });
    vi.mocked(sellerApi.listListingBids).mockResolvedValue({
      items: mockBids,
      total: 1,
    });
    vi.mocked(sellerApi.acceptBid).mockResolvedValue(mockOrder);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Accept")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => {
      expect(screen.getByText("Confirm & Create Order")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Confirm & Create Order"));

    await waitFor(() => {
      expect(sellerApi.acceptBid).toHaveBeenCalledWith("listing-1", "bid-1");
    });
  });
});
