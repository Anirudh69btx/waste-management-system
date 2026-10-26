import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OrderReceiptPage } from "../pages/OrderReceiptPage";
import * as marketplaceApi from "@/api/marketplace";
import type { PurchaseOrderRead, MarketplaceListingRead } from "@/api/types";

vi.mock("@/api/marketplace", () => ({
  getOrder: vi.fn(),
  getListing: vi.fn(),
  confirmPayment: vi.fn(),
  completeOrder: vi.fn(),
}));

describe("OrderReceiptPage", () => {
  let queryClient: QueryClient;

  const baseOrder: PurchaseOrderRead = {
    id: "ord-500",
    order_code: "ORD-2026-0500",
    listing_id: "list-500",
    buyer_user_id: "buyer-1",
    seller_user_id: "seller-1",
    quantity_kg: 400,
    unit_price: 25,
    total_amount: 10000,
    currency: "INR",
    status: "escrow_held",
    escrow_held_at: "2026-02-01T12:00:00Z",
    completed_at: null,
    cancellation_reason: null,
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-01T12:00:00Z",
  };

  const baseListing: MarketplaceListingRead = {
    id: "list-500",
    seller_id: "seller-1",
    category_id: 34,
    title: "Certified Clear PET Flakes Lot",
    description: "Washed Grade A PET flakes",
    quantity_kg: 1000,
    available_kg: 600,
    price_per_kg: 25,
    min_bid_kg: 100,
    purity_grade: "GRADE_A",
    status: "active",
    inventory_lot_id: "lot-500",
    created_at: "2026-02-01T08:00:00Z",
    updated_at: "2026-02-01T08:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.mocked(marketplaceApi.getListing).mockResolvedValue(baseListing);
  });

  const renderReceipt = (orderId = "ord-500") =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/marketplace/orders/${orderId}`]}>
          <Routes>
            <Route
              path="/marketplace/orders/:id"
              element={<OrderReceiptPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders order_code and total when order status is escrow_held", async () => {
    vi.mocked(marketplaceApi.getOrder).mockResolvedValueOnce(baseOrder);

    renderReceipt();

    expect(
      await screen.findByText("Payment Secured in Escrow")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/ORD-2026-0500/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/10,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Mark as received")).toBeInTheDocument();
  });

  it("shows 'Confirm payment' button for pending_payment orders", async () => {
    vi.mocked(marketplaceApi.getOrder).mockResolvedValueOnce({
      ...baseOrder,
      status: "pending_payment",
      escrow_held_at: null,
    });

    renderReceipt();

    expect(
      await screen.findByText("Awaiting Payment Confirmation")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm payment/i })
    ).toBeInTheDocument();
  });

  it("shows 'Download invoice' button for completed orders", async () => {
    vi.mocked(marketplaceApi.getOrder).mockResolvedValueOnce({
      ...baseOrder,
      status: "completed",
      completed_at: "2026-02-02T15:00:00Z",
    });

    renderReceipt();

    expect(
      await screen.findByText("Order Completed & Settled")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Download invoice/i })
    ).toBeInTheDocument();
  });
});
