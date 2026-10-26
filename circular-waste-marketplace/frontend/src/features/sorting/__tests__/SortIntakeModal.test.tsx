import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SortIntakeModal } from "../components/SortIntakeModal";
import * as sortingApi from "@/api/sorting";
import type { WasteIntakeListItem } from "@/api/types";

vi.mock("@/api/sorting", () => ({
  processSorting: vi.fn(),
}));

describe("SortIntakeModal", () => {
  const mockIntake: WasteIntakeListItem = {
    id: "intake-999",
    batch_code: "CWM-2026-DRY-001",
    supplier_id: "sup-1",
    category: {
      id: 34, // DRY_RECYCLABLE (PET)
      code: "PLASTIC_PET",
      name: "PET Plastics (Grade 1)",
      unit_of_measure: "kg",
      carbon_offset_factor: 1.2,
    },
    purity_grade: "GRADE_A",
    declared_weight_kg: 100,
    verified_weight_kg: 95,
    weight_discrepancy_kg: -5,
    status: "weighed",
    qr_code_hash: "hash-999",
    image_paths: [],
    notes: null,
    verified_at: "2026-02-01T10:00:00Z",
    created_at: "2026-02-01T09:00:00Z",
  };

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    intake: mockIntake,
    onSorted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form with default verified weights and initial lot", () => {
    render(<SortIntakeModal {...defaultProps} />);

    expect(screen.getByText("Process Sorting")).toBeInTheDocument();
    expect(screen.getByText("CWM-2026-DRY-001")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("95").length).toBeGreaterThanOrEqual(1); // input weight, sorted weight, lot quantity
    expect(screen.getByText("Lot #1")).toBeInTheDocument();
  });

  it("supports adding and removing multiple inventory lots", () => {
    render(<SortIntakeModal {...defaultProps} />);

    // Initially 1 lot
    expect(screen.getByText("Lot #1")).toBeInTheDocument();
    expect(screen.queryByText("Lot #2")).not.toBeInTheDocument();

    // Click "Add lot"
    const addLotBtn = screen.getByRole("button", { name: /Add lot/i });
    fireEvent.click(addLotBtn);

    expect(screen.getByText("Lot #2")).toBeInTheDocument();

    // Remove lot #2
    const removeBtns = screen.getAllByTitle("Remove lot");
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[1]);

    expect(screen.queryByText("Lot #2")).not.toBeInTheDocument();
  });

  it("validates weight sums and prevents invalid submission", async () => {
    render(<SortIntakeModal {...defaultProps} />);

    // Sorted weight inputs: Change rejected weight so sorted + rejected > input
    const inputs = screen.getAllByRole("spinbutton");
    const inputWeightInput = inputs[0]; // input weight
    const sortedWeightInput = inputs[1]; // sorted weight
    const rejectedWeightInput = inputs[2]; // rejected weight

    fireEvent.change(inputWeightInput, { target: { value: "100" } });
    fireEvent.change(sortedWeightInput, { target: { value: "80" } });
    fireEvent.change(rejectedWeightInput, { target: { value: "30" } }); // 80 + 30 = 110 > 100

    expect(
      screen.getByText("Sorted + Rejected exceeds Input")
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: /Complete Sorting & Create Lots/i,
    });
    expect(submitBtn).toBeDisabled();
  });

  it("enforces stream compatibility and disables cross-stream categories", () => {
    render(<SortIntakeModal {...defaultProps} />);

    // Stream for category 34 is DRY_RECYCLABLE
    expect(screen.getByText("DRY_RECYCLABLE")).toBeInTheDocument();

    // Find the select dropdown for lot #1
    const selects = screen.getAllByRole("combobox");
    const categorySelect = selects[0];
    const options = categorySelect.querySelectorAll("option");

    // Category 33 (Organic) is ORGANIC stream -> should be disabled
    const organicOption = Array.from(options).find((opt) =>
      opt.textContent?.includes("Organic & Food Waste")
    );
    expect(organicOption).toBeDefined();
    expect(organicOption?.disabled).toBe(true);

    // Category 35 (Paper/Cardboard) is DRY_RECYCLABLE stream -> should be enabled
    const paperOption = Array.from(options).find((opt) =>
      opt.textContent?.includes("Corrugated Cardboard & Paper")
    );
    expect(paperOption).toBeDefined();
    expect(paperOption?.disabled).toBe(false);
  });

  it("submits valid form and calls processSorting with correct payload", async () => {
    vi.mocked(sortingApi.processSorting).mockResolvedValueOnce({
      sorting_record: {
        id: "rec-new-1",
        intake_id: "intake-999",
        sorter_user_id: "u-1",
        input_weight_kg: 95,
        sorted_weight_kg: 90,
        rejected_weight_kg: 5,
        contamination_percent: 2,
        sort_grade: "GRADE_A",
        moisture_percent: null,
        notes: null,
        photos: [],
        created_at: "2026-02-01T10:00:00Z",
        updated_at: "2026-02-01T10:00:00Z",
      },
      inventory_lots: [],
    });

    render(<SortIntakeModal {...defaultProps} />);

    const inputs = screen.getAllByRole("spinbutton");
    const sortedWeightInput = inputs[1];
    const rejectedWeightInput = inputs[2];
    const lotQuantityInput = inputs[5]; // lot quantity (inputs[5])

    fireEvent.change(sortedWeightInput, { target: { value: "90" } });
    fireEvent.change(rejectedWeightInput, { target: { value: "5" } });
    fireEvent.change(lotQuantityInput, { target: { value: "90" } });

    const submitBtn = screen.getByRole("button", {
      name: /Complete Sorting & Create Lots/i,
    });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(sortingApi.processSorting).toHaveBeenCalledTimes(1);
    });

    expect(sortingApi.processSorting).toHaveBeenCalledWith(
      expect.objectContaining({
        intake_id: "intake-999",
        input_weight_kg: 95,
        sorted_weight_kg: 90,
        rejected_weight_kg: 5,
        sort_grade: "GRADE_A",
      })
    );
    expect(defaultProps.onSorted).toHaveBeenCalled();
  });
});
