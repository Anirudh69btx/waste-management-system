import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MyOrdersPage } from "../pages/MyOrdersPage";
import * as marketplaceApi from "@/api/marketplace";
import type { PurchaseOrderRead } from "@/api/types";

vi.mock("@/api/marketplace", () => ({
  listMyOrders: vi.fn(),
  getListing: vi.fn(),
  confirmPayment: vi.fn(),
  completeOrder: vi.fn(),
}));

describe("MyOrdersPage", () => {
  let queryClient: QueryClient;

  const mockOrders: PurchaseOrderRead[] = [
    {
      id: "ord-1",
      order_code: "ORD-2026-0001",
      listing_id: "list-1",
      buyer_user_id: "buyer-1",
      seller_user_id: "seller-1",
      quantity_kg: 200,
      unit_price: 25,
      total_amount: 5000,
      currency: "INR",
      status: "pending_payment",
      escrow_held_at: null,
      completed_at: null,
      cancellation_reason: null,
      created_at: "2026-02-01T10:00:00Z",
      updated_at: "2026-02-01T10:00:00Z",
    },
    {
      id: "ord-2",
      order_code: "ORD-2026-0002",
      listing_id: "list-2",
      buyer_user_id: "buyer-1",
      seller_user_id: "seller-2",
      quantity_kg: 500,
      unit_price: 10,
      total_amount: 5000,
      currency: "INR",
      status: "escrow_held",
      escrow_held_at: "2026-02-01T11:00:00Z",
      completed_at: null,
      cancellation_reason: null,
      created_at: "2026-02-01T10:30:00Z",
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

    vi.mocked(marketplaceApi.getListing).mockImplementation(async (id) => ({
      id,
      seller_id: "seller",
      category_id: 34,
      title: id === "list-1" ? "Clear PET Flakes" : "OCC Cardboard Bales",
      description: null,
      quantity_kg: 500,
      available_kg: 300,
      price_per_kg: 25,
      min_bid_kg: 50,
      purity_grade: "GRADE_A",
      status: "active",
      inventory_lot_id: "lot",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
    }));
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyOrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders orders list with codes, titles, and statuses", async () => {
    vi.mocked(marketplaceApi.listMyOrders).mockResolvedValueOnce({
      items: mockOrders,
      total: 2,
    });

    renderComponent();

    expect(await screen.findByText("ORD-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("ORD-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Pending Payment")).toBeInTheDocument();
    expect(screen.getByText("Escrow Held")).toBeInTheDocument();
    expect(screen.getByText("Confirm payment")).toBeInTheDocument();
    expect(screen.getByText("Mark received")).toBeInTheDocument();
  });

  it("calls confirmPayment API when clicking 'Confirm payment'", async () => {
    vi.mocked(marketplaceApi.listMyOrders).mockResolvedValueOnce({
      items: mockOrders,
      total: 2,
    });
    vi.mocked(marketplaceApi.confirmPayment).mockResolvedValueOnce({
      ...mockOrders[0],
      status: "escrow_held",
    });

    renderComponent();

    const confirmBtn = await screen.findByRole("button", { name: /Confirm payment/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(marketplaceApi.confirmPayment).toHaveBeenCalledWith("ord-1");
    });
  });

  it("displays empty state when buyer has no orders", async () => {
    vi.mocked(marketplaceApi.listMyOrders).mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    renderComponent();

    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    expect(screen.getByText("Browse marketplace")).toBeInTheDocument();
  });
});
