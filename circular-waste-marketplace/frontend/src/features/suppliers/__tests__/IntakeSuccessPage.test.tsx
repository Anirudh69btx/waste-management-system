import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/api/waste", () => ({
  getIntake: vi.fn(),
  getIntakeQr: vi.fn(),
}));

import { getIntake, getIntakeQr } from "@/api/waste";
import { IntakeSuccessPage } from "../pages/IntakeSuccessPage";

const mockIntake = {
  id: "intake-123",
  batch_code: "CWM-2026-0001",
  supplier_id: "sup-1",
  category: {
    id: 33,
    code: "ORGANIC_BIOMASS",
    name: "Organic & Food Waste",
    unit_of_measure: "kg",
    carbon_offset_factor: 0.5,
  },
  purity_grade: "GRADE_A",
  declared_weight_kg: 250,
  verified_weight_kg: null,
  weight_discrepancy_kg: null,
  status: "SUBMITTED",
  qr_code_hash: "hash123",
  image_paths: [],
  notes: "Batch ready for collection",
  scale_operator_id: null,
  verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const mockQr = {
  intake_id: "intake-123",
  batch_code: "CWM-2026-0001",
  qr_code_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6e...",
  manifest_signature: "sig123",
  verification_url: "https://cwm.local/verify/CWM-2026-0001",
};

describe("IntakeSuccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders QR img with src starting with data:image/png;base64", async () => {
    vi.mocked(getIntake).mockResolvedValueOnce(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValueOnce(mockQr);

    render(
      <MemoryRouter initialEntries={["/intake/success/intake-123"]}>
        <Routes>
          <Route path="/intake/success/:intakeId" element={<IntakeSuccessPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Batch Successfully Submitted!")).toBeInTheDocument();
    });

    const qrImage = screen.getByRole("img", { name: "Batch QR" }) as HTMLImageElement;
    expect(qrImage).toBeInTheDocument();
    expect(qrImage.src).toMatch(/^data:image\/png;base64/);
  });

  it("renders download link with download attribute and matching filename", async () => {
    vi.mocked(getIntake).mockResolvedValueOnce(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValueOnce(mockQr);

    render(
      <MemoryRouter initialEntries={["/intake/success/intake-123"]}>
        <Routes>
          <Route path="/intake/success/:intakeId" element={<IntakeSuccessPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Batch Successfully Submitted!")).toBeInTheDocument();
    });

    const downloadLink = screen.getByRole("link", { name: /download qr/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute("download", "CWM-2026-0001.png");
    expect(downloadLink).toHaveAttribute("href", mockQr.qr_code_data_url);
  });
});
