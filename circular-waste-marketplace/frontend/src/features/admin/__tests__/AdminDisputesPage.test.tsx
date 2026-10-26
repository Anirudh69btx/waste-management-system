import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import * as adminApi from "@/api/admin";
import type { AdminDisputeListResponse } from "@/api/types";
import { AdminDisputesPage } from "../pages/AdminDisputesPage";

vi.mock("@/api/admin", () => ({
  listDisputes: vi.fn(),
  resolveDispute: vi.fn(),
}));

const pendingDisputes: AdminDisputeListResponse = {
  items: [
    {
      id: "ticket-1",
      intake_id: "intake-1",
      batch_code: "BATCH-2026-001",
      supplier_email: "supplier@cwm.io",
      declared_weight_kg: 500,
      verified_weight_kg: 420,
      dispute_notes: "Factory weighbridge recorded 500 kg before dispatch.",
      weight_method: "weighbridge",
      recorded_at: "2026-03-01T12:00:00Z",
      dispute_resolution: null,
      dispute_resolved_at: null,
    },
  ],
  total: 1,
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminDisputesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AdminDisputesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.listDisputes).mockResolvedValue(pendingDisputes);
  });

  it("renders pending disputes table with Review button", async () => {
    renderPage();

    expect(await screen.findByText("BATCH-2026-001")).toBeInTheDocument();
    expect(screen.getByText("supplier@cwm.io")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review/i })).toBeInTheDocument();
  });

  it("filter tabs trigger listDisputes with selected resolution filter", async () => {
    renderPage();
    await screen.findByText("BATCH-2026-001");

    const upheldTab = screen.getByRole("tab", { name: /upheld/i });
    fireEvent.click(upheldTab);

    await waitFor(() => {
      expect(adminApi.listDisputes).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: "upheld" })
      );
    });
  });
});
