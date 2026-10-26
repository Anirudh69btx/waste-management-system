import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CreateListingModal } from "../components/CreateListingModal";
import * as sellerApi from "@/api/seller";
import type { InventoryLotRead, MarketplaceListingRead } from "@/api/types";

vi.mock("@/api/seller", () => ({
  createListingFromLot: vi.fn(),
}));

describe("CreateListingModal", () => {
  const mockLot: InventoryLotRead = {
    id: "lot-123",
    lot_code: "LOT-PET-001",
    intake_id: "intake-99",
    sorting_record_id: "sr-99",
    category_id: 34,
    quantity_kg: 500,
    available_kg: 400,
    grade: "GRADE_A",
    contamination_percent: 2.0,
    moisture_percent: 1.0,
    status: "available",
    hub_location: "Central Hub",
    created_at: "2026-02-01T10:00:00Z",
  };

  const mockCreatedListing: MarketplaceListingRead = {
    id: "listing-new",
    seller_id: "seller-1",
    category_id: 34,
    title: "PET Plastics (Grade 1) — GRADE A — 400kg",
    description: null,
    quantity_kg: 400,
    available_kg: 400,
    price_per_kg: 18,
    min_bid_kg: 1,
    purity_grade: "GRADE_A",
    status: "active",
    inventory_lot_id: "lot-123",
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-01T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with pre-filled title and lot reference", () => {
    render(
      <CreateListingModal
        open={true}
        onClose={vi.fn()}
        lot={mockLot}
        onCreated={vi.fn()}
      />
    );

    expect(screen.getByText("Create Marketplace Listing")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/PET Plastics.*GRADE A/)).toBeInTheDocument();
    expect(screen.getByText("LOT-PET-001")).toBeInTheDocument();
  });

  it("submits form and calls createListingFromLot with payload", async () => {
    const onCreatedMock = vi.fn();
    const onCloseMock = vi.fn();
    vi.mocked(sellerApi.createListingFromLot).mockResolvedValueOnce(mockCreatedListing);

    render(
      <CreateListingModal
        open={true}
        onClose={onCloseMock}
        lot={mockLot}
        onCreated={onCreatedMock}
      />
    );

    fireEvent.click(screen.getByText("Publish Listing"));

    await waitFor(() => {
      expect(sellerApi.createListingFromLot).toHaveBeenCalledWith(
        expect.objectContaining({
          inventory_lot_id: "lot-123",
          price_per_kg: 18,
          min_bid_kg: 1,
        })
      );
      expect(onCreatedMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });
});
