import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock API modules
vi.mock("@/api/suppliers", () => ({
  getMySupplier: vi.fn(),
  createSupplier: vi.fn(),
}));

vi.mock("@/api/waste", () => ({
  submitIntake: vi.fn(),
  getIntake: vi.fn(),
  getIntakeQr: vi.fn(),
}));

vi.mock("@/features/auth/store", () => ({
  useAuthStore: () => ({
    user: { id: "user-test-123", email: "generator@example.com", role: "GENERATOR" },
  }),
}));

import { getMySupplier } from "@/api/suppliers";
import { submitIntake } from "@/api/waste";
import { IntakeSubmissionPage } from "../IntakeSubmissionPage";

const mockSupplier = {
  id: "sup-1",
  user_id: "usr-1",
  business_name: "Apex Bio Waste Ltd",
  registration_number: "REG-12345",
  facility_address: "Plot 42 Industrial Area",
  latitude: 12.9,
  longitude: 77.6,
  contact_phone: "+919876543210",
  verification_status: "VERIFIED",
  created_at: "2026-01-01T00:00:00Z",
};

describe("IntakeSubmissionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn();
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    }
    vi.spyOn(window.URL, "createObjectURL").mockImplementation(() => "blob:mock-url");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("opens onboarding modal when supplier profile is null", async () => {
    vi.mocked(getMySupplier).mockResolvedValueOnce(null);

    render(
      <MemoryRouter>
        <IntakeSubmissionPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Supplier Onboarding")).toBeInTheDocument();
    });
  });

  it("renders 8 waste categories in the select dropdown", async () => {
    vi.mocked(getMySupplier).mockResolvedValueOnce(mockSupplier);

    const { container } = render(
      <MemoryRouter>
        <IntakeSubmissionPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Apex Bio Waste Ltd")).toBeInTheDocument();
    });

    const select = container.querySelector("select");
    expect(select).toBeTruthy();
    const options = select?.querySelectorAll("option");
    expect(options?.length).toBe(8);
  });

  it("shows error or disables submit when weight is 0", async () => {
    vi.mocked(getMySupplier).mockResolvedValueOnce(mockSupplier);

    const { container } = render(
      <MemoryRouter>
        <IntakeSubmissionPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Apex Bio Waste Ltd")).toBeInTheDocument();
    });

    const weightInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: "0" } });

    const submitBtn = screen.getByRole("button", { name: /submit batch/i });
    expect(submitBtn).toBeDisabled();

    // Also trigger form submit to verify inline error
    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Weight must be greater than 0.")).toBeInTheDocument();
    });
  });

  it("submits the form and calls submitIntake with valid payload", async () => {
    vi.mocked(getMySupplier).mockResolvedValueOnce(mockSupplier);
    vi.mocked(submitIntake).mockResolvedValueOnce({
      id: "intake-999",
      batch_code: "CWM-TEST-001",
    } as any);

    const { container } = render(
      <MemoryRouter>
        <IntakeSubmissionPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Apex Bio Waste Ltd")).toBeInTheDocument();
    });

    // Add a valid JPEG image
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bytes = new Uint8Array(12);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    const validFile = new File([bytes], "evidence.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText("evidence.jpg")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /submit batch \(1 photo\)/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitIntake).toHaveBeenCalledTimes(1);
      expect(submitIntake).toHaveBeenCalledWith(
        expect.objectContaining({
          category_id: 33, // Default ORGANIC_BIOMASS ID
          purity_grade: "GRADE_A",
          declared_weight_kg: 250,
        }),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  it("keeps submit button disabled when no images have been uploaded", async () => {
    vi.mocked(getMySupplier).mockResolvedValueOnce(mockSupplier);

    render(
      <MemoryRouter>
        <IntakeSubmissionPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Apex Bio Waste Ltd")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /submit batch \(0 photos\)/i });
    expect(submitBtn).toBeDisabled();
  });
});
