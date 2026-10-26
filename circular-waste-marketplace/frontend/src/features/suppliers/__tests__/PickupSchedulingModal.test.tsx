import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PickupSchedulingModal } from "../components/PickupSchedulingModal";
import toast from "react-hot-toast";

vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  normalizeApiError: vi.fn((err: any) => {
    return {
      code: err?.status ?? 500,
      detail: err?.message ?? "Error",
      requestId: "req-123",
    };
  }),
}));

vi.mock("@/api/pickups", () => ({
  createPickup: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { createPickup } from "@/api/pickups";

const mockIntake = {
  id: "intake-modal-1",
  batch_code: "CWM-2026-MODAL",
  supplier_id: "sup-1",
  category: {
    id: 33,
    code: "ORGANIC_BIOMASS",
    name: "Organic & Food Waste",
    unit_of_measure: "kg",
    carbon_offset_factor: 0.5,
  },
  purity_grade: "GRADE_A",
  declared_weight_kg: 300,
  verified_weight_kg: null,
  weight_discrepancy_kg: null,
  status: "SUBMITTED",
  qr_code_hash: "hash-modal",
  image_paths: [],
  notes: "",
  scale_operator_id: null,
  verified_at: null,
  created_at: "2026-01-01T10:00:00Z",
};

const mockSupplier = {
  id: "sup-1",
  user_id: "u-1",
  business_name: "Apex Bio Waste Ltd",
  contact_person: "John Doe",
  contact_phone: "+919876543210",
  facility_address: "Plot 42 Industrial Area",
  city: "Bengaluru",
  state: "Karnataka",
  postal_code: "560100",
  verified: true,
  created_at: "2026-01-01T00:00:00Z",
};

describe("PickupSchedulingModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with batch summary and supplier address when open is true", () => {
    render(
      <PickupSchedulingModal
        open={true}
        onClose={vi.fn()}
        intake={mockIntake as any}
        supplier={mockSupplier as any}
        onScheduled={vi.fn()}
      />
    );

    expect(screen.getByText("Schedule Pickup")).toBeInTheDocument();
    expect(screen.getByText("CWM-2026-MODAL")).toBeInTheDocument();
    expect(screen.getByText("Organic & Food Waste")).toBeInTheDocument();
    expect(screen.getByText("Plot 42 Industrial Area")).toBeInTheDocument();
  });

  it("submits pickup request with selected date and time slot and calls createPickup", async () => {
    vi.mocked(createPickup).mockResolvedValueOnce({
      id: "pickup-res-1",
      intake_id: "intake-modal-1",
      requested_by_user_id: "u-1",
      assigned_driver_user_id: null,
      actual_pickup_at: null,
      status: "requested",
      cancellation_reason: null,
      failure_reason: null,
      scheduled_start: "2026-02-01T09:00:00+05:30",
      scheduled_end: "2026-02-01T11:00:00+05:30",
      notes: "Gate #3",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    const handleScheduled = vi.fn();
    const handleClose = vi.fn();

    render(
      <PickupSchedulingModal
        open={true}
        onClose={handleClose}
        intake={mockIntake as any}
        supplier={mockSupplier as any}
        onScheduled={handleScheduled}
      />
    );

    const dateInput = document.body.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: "2026-02-01" } });

    const slotBtn = screen.getByRole("button", { name: "09:00-11:00" });
    fireEvent.click(slotBtn);

    const notesTextarea = document.body.querySelector("textarea") as HTMLTextAreaElement;
    expect(notesTextarea).not.toBeNull();
    fireEvent.change(notesTextarea, { target: { value: "Gate #3" } });

    const form = document.body.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createPickup).toHaveBeenCalledWith({
        intake_id: "intake-modal-1",
        scheduled_start: "2026-02-01T09:00:00+05:30",
        scheduled_end: "2026-02-01T11:00:00+05:30",
        notes: "Gate #3",
      });
      expect(toast.success).toHaveBeenCalledWith("Pickup scheduled!");
      expect(handleScheduled).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it("displays error toast and calls onClose when API returns 409 conflict", async () => {
    vi.mocked(createPickup).mockRejectedValueOnce({
      status: 409,
      message: "Conflict",
    });

    const handleClose = vi.fn();

    render(
      <PickupSchedulingModal
        open={true}
        onClose={handleClose}
        intake={mockIntake as any}
        supplier={mockSupplier as any}
        onScheduled={vi.fn()}
      />
    );

    const dateInput = document.body.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: "2026-02-01" } });

    const slotBtn = screen.getByRole("button", { name: "09:00-11:00" });
    fireEvent.click(slotBtn);

    const form = document.body.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("A pickup already exists for this batch.");
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
