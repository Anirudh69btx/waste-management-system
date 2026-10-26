import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as adminApi from "@/api/admin";
import type { AdminDispute } from "@/api/types";
import { ResolveDisputeModal } from "../components/ResolveDisputeModal";

vi.mock("@/api/admin", () => ({
  resolveDispute: vi.fn(),
}));

const sampleDispute: AdminDispute = {
  id: "ticket-99",
  intake_id: "intake-99",
  batch_code: "BATCH-DISP-99",
  supplier_email: "supplier99@cwm.io",
  declared_weight_kg: 500,
  verified_weight_kg: 440,
  dispute_notes: "Certified weighbridge receipt attached.",
  weight_method: "weighbridge",
  recorded_at: "2026-03-01T12:00:00Z",
  dispute_resolution: null,
  dispute_resolved_at: null,
};

describe("ResolveDisputeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uphold calls resolveDispute with 'upheld' and note", async () => {
    const onResolved = vi.fn();
    const onClose = vi.fn();
    vi.mocked(adminApi.resolveDispute).mockResolvedValue({
      ...sampleDispute,
      dispute_resolution: "upheld",
      dispute_resolved_at: "2026-03-02T10:00:00Z",
    });

    render(
      <ResolveDisputeModal
        open={true}
        onClose={onClose}
        dispute={sampleDispute}
        onResolved={onResolved}
      />
    );

    const upholdBtn = screen.getByRole("button", { name: /uphold dispute/i });
    fireEvent.click(upholdBtn);

    const noteTextarea = screen.getByLabelText(/resolution note/i);
    fireEvent.change(noteTextarea, {
      target: { value: "Verified supplier calibration certificate; upholding." },
    });

    const submitBtn = screen.getByRole("button", {
      name: /submit resolution/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminApi.resolveDispute).toHaveBeenCalledWith(
        "ticket-99",
        "upheld",
        "Verified supplier calibration certificate; upholding."
      );
    });
    expect(onResolved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
