import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupplierBatchDetailPage } from "../pages/SupplierBatchDetailPage";

vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("@/api/waste", () => ({
  getIntake: vi.fn(),
  getIntakeQr: vi.fn(),
}));

vi.mock("@/api/weightTickets", () => ({
  getWeightTicket: vi.fn(),
  acknowledgeWeight: vi.fn(),
}));

vi.mock("@/api/pickups", () => ({
  listPickups: vi.fn(),
  cancelPickup: vi.fn(),
  createPickup: vi.fn(),
}));

vi.mock("@/api/suppliers", () => ({
  getMySupplier: vi.fn(),
}));

import { getIntake, getIntakeQr } from "@/api/waste";
import { getWeightTicket, acknowledgeWeight } from "@/api/weightTickets";
import { listPickups } from "@/api/pickups";

const mockIntake = {
  id: "intake-900",
  batch_code: "CWM-2026-9000",
  supplier_id: "sup-1",
  category: {
    id: 34,
    code: "PLASTIC_PET",
    name: "PET Plastics (Grade 1)",
    unit_of_measure: "kg",
    carbon_offset_factor: 1.2,
  },
  purity_grade: "GRADE_A",
  declared_weight_kg: 500,
  verified_weight_kg: 490,
  weight_discrepancy_kg: -10,
  status: "SUBMITTED",
  qr_code_hash: "hash900",
  image_paths: [],
  notes: "Color: Clear | Form: Bottles | Freeform: Stored indoors in dry sacks",
  scale_operator_id: null,
  verified_at: null,
  created_at: "2026-01-01T10:00:00Z",
};

const mockQr = {
  intake_id: "intake-900",
  batch_code: "CWM-2026-9000",
  qr_code_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
  manifest_signature: "sig900",
  verification_url: "https://cwm.local/verify/CWM-2026-9000",
};

const mockTicket = {
  id: "ticket-1",
  intake_id: "intake-900",
  scale_id: "SCALE-01",
  scale_calibration_date: "2025-12-01",
  gross_weight_kg: 550,
  tare_weight_kg: 50,
  net_weight_kg: 500,
  weight_method: "digital_scale",
  photo_urls: [],
  discrepancy_flag: false,
  discrepancy_notes: null,
  supplier_confirmed_at: null,
  supplier_dispute_notes: null,
  created_at: "2026-01-02T10:00:00Z",
};

function renderDetailPage(intakeId = "intake-900") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/dashboard/batches/${intakeId}`]}>
        <Routes>
          <Route path="/dashboard/batches/:id" element={<SupplierBatchDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SupplierBatchDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders batch summary, FSM timeline, and parsed notes", async () => {
    vi.mocked(getIntake).mockResolvedValue(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValue(mockQr);
    vi.mocked(getWeightTicket).mockResolvedValue(null);
    vi.mocked(listPickups).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getAllByText("CWM-2026-9000").length).toBeGreaterThan(0);
      expect(screen.getByText("Batch Journey")).toBeInTheDocument();
      expect(screen.getByText("Color")).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
      expect(screen.getByText("Form")).toBeInTheDocument();
      expect(screen.getByText("Bottles")).toBeInTheDocument();
      expect(screen.getByText("Stored indoors in dry sacks")).toBeInTheDocument();
    });
  });

  it("renders QR code card with download link and print button", async () => {
    vi.mocked(getIntake).mockResolvedValue(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValue(mockQr);
    vi.mocked(getWeightTicket).mockResolvedValue(null);
    vi.mocked(listPickups).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByAltText("Batch QR")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Print/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Download/i })).toBeInTheDocument();
    });
  });

  it("renders weight ticket details when ticket exists", async () => {
    vi.mocked(getIntake).mockResolvedValue(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValue(mockQr);
    vi.mocked(getWeightTicket).mockResolvedValue(mockTicket as any);
    vi.mocked(listPickups).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Weight Ticket")).toBeInTheDocument();
      expect(screen.getByText("digital scale")).toBeInTheDocument();
      expect(screen.getByText("Gross weight")).toBeInTheDocument();
      expect(screen.getByText("550 kg")).toBeInTheDocument();
      expect(screen.getByText("Tare weight")).toBeInTheDocument();
      expect(screen.getByText("50 kg")).toBeInTheDocument();
      expect(screen.getByText("Net weight")).toBeInTheDocument();
      expect(screen.getAllByText("500 kg").length).toBeGreaterThan(0);
    });
  });

  it("calls acknowledgeWeight with confirmed: true when confirm weight button is clicked", async () => {
    vi.mocked(getIntake).mockResolvedValue(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValue(mockQr);
    vi.mocked(getWeightTicket).mockResolvedValue(mockTicket as any);
    vi.mocked(acknowledgeWeight).mockResolvedValue({ ...mockTicket, supplier_confirmed_at: "2026-01-02T11:00:00Z" } as any);
    vi.mocked(listPickups).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirm weight/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirm weight/i }));

    await waitFor(() => {
      expect(acknowledgeWeight).toHaveBeenCalledWith("intake-900", { confirmed: true });
    });
  });

  it("calls acknowledgeWeight with dispute notes when dispute is submitted", async () => {
    vi.mocked(getIntake).mockResolvedValue(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValue(mockQr);
    vi.mocked(getWeightTicket).mockResolvedValue(mockTicket as any);
    vi.mocked(acknowledgeWeight).mockResolvedValue({ ...mockTicket, supplier_dispute_notes: "Scale tare miscalibrated by 20kg" } as any);
    vi.mocked(listPickups).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Dispute/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Dispute/i }));

    const textarea = screen.getByPlaceholderText(/Describe the discrepancy/i);
    fireEvent.change(textarea, { target: { value: "Scale tare miscalibrated by 20kg" } });

    const submitDisputeBtn = screen.getByRole("button", { name: /Submit dispute/i });
    expect(submitDisputeBtn).not.toBeDisabled();
    fireEvent.click(submitDisputeBtn);

    await waitFor(() => {
      expect(acknowledgeWeight).toHaveBeenCalledWith("intake-900", {
        confirmed: false,
        dispute_notes: "Scale tare miscalibrated by 20kg",
      });
    });
  });

  it("opens PickupSchedulingModal when Schedule Pickup is clicked", async () => {
    vi.mocked(getIntake).mockResolvedValue(mockIntake as any);
    vi.mocked(getIntakeQr).mockResolvedValue(mockQr);
    vi.mocked(getWeightTicket).mockResolvedValue(null);
    vi.mocked(listPickups).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Schedule Pickup/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Schedule Pickup/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Schedule Pickup").length).toBeGreaterThan(0);
    });
  });
});
