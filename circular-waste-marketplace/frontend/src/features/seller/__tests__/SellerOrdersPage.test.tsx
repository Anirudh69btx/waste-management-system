import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SellerOrdersPage } from "../pages/SellerOrdersPage";
import * as sellerApi from "@/api/seller";
import * as marketplaceApi from "@/api/marketplace";
import type { PurchaseOrderRead, MarketplaceListingRead } from "@/api/types";

vi.mock("@/api/seller", () => ({
  listSellerOrders: vi.fn(),
  shipOrder: vi.fn(),
}));

vi.mock("@/api/marketplace", () => ({
  getListing: vi.fn(),
  completeOrder: vi.fn(),
}));

describe("SellerOrdersPage", () => {
  let queryClient: QueryClient;

  const mockOrder: PurchaseOrderRead = {
    id: "po-100",
    order_code: "PO-2026-000100",
    listing_id: "listing-1",
    buyer_user_id: "buyer-uuid-9999",
    seller_user_id: "seller-1",
    quantity_kg: 250,
    unit_price: 20.0,
    total_amount: 5000,
    currency: "INR",
    status: "escrow_held",
    escrow_held_at: "2026-02-01T12:00:00Z",
    completed_at: null,
    cancellation_reason: null,
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-01T12:00:00Z",
  };

  const mockListing: MarketplaceListingRead = {
    id: "listing-1",
    seller_id: "seller-1",
    category_id: 34,
    title: "Optical Sorted Clear PET Bales",
    description: null,
    quantity_kg: 500,
    available_kg: 250,
    price_per_kg: 20.0,
    min_bid_kg: 50,
    purity_grade: "GRADE_A",
    status: "active",
    inventory_lot_id: "lot-1",
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
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SellerOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders orders table with order code and total payout", async () => {
    vi.mocked(sellerApi.listSellerOrders).mockResolvedValue({
      items: [mockOrder],
      total: 1,
    });
    vi.mocked(marketplaceApi.getListing).mockResolvedValue(mockListing);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("PO-2026-000100")).toBeInTheDocument();
      expect(screen.getByText("250 kg")).toBeInTheDocument();
      expect(screen.getByText("₹5,000")).toBeInTheDocument();
    });
  });

  it("opens ship order modal for escrow_held order and dispatches shipment", async () => {
    vi.mocked(sellerApi.listSellerOrders).mockResolvedValue({
      items: [mockOrder],
      total: 1,
    });
    vi.mocked(marketplaceApi.getListing).mockResolvedValue(mockListing);
    vi.mocked(sellerApi.shipOrder).mockResolvedValue({
      ...mockOrder,
      status: "shipped",
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Ship order")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Ship order"));

    await waitFor(() => {
      expect(screen.getByText("Dispatch & Ship Order")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Confirm Shipment"));

    await waitFor(() => {
      expect(sellerApi.shipOrder).toHaveBeenCalledWith("po-100", expect.any(Object));
    });
  });
});
