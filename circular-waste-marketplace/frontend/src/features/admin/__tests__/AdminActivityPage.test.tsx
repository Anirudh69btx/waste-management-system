import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import * as adminApi from "@/api/admin";
import type { ActivityFeedResponse } from "@/api/types";
import { AdminActivityPage } from "../pages/AdminActivityPage";

vi.mock("@/api/admin", () => ({
  getActivityFeed: vi.fn(),
}));

const firstPageFeed: ActivityFeedResponse = {
  items: [
    {
      id: "ev-1",
      event_type: "batch.submitted",
      batch_id: "batch-101",
      batch_code: "BATCH-ACT-101",
      actor_user_id: "user-1",
      actor_name: "Anirudh Sharma",
      actor_role: "GENERATOR",
      from_status: null,
      to_status: "submitted",
      metadata_json: { weight_kg: 320 },
      created_at: new Date().toISOString(),
    },
  ],
  total: 60,
};

const secondPageFeed: ActivityFeedResponse = {
  items: [
    {
      id: "ev-2",
      event_type: "weight.recorded",
      batch_id: "batch-102",
      batch_code: "BATCH-ACT-102",
      actor_user_id: "user-2",
      actor_name: "Rajesh Logistics",
      actor_role: "LOGISTICS",
      from_status: "submitted",
      to_status: "weighed",
      metadata_json: { net_kg: 315 },
      created_at: new Date().toISOString(),
    },
  ],
  total: 60,
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminActivityPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AdminActivityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.getActivityFeed).mockImplementation(async (params) => {
      if (params?.offset && params.offset > 0) {
        return secondPageFeed;
      }
      return firstPageFeed;
    });
  });

  it("renders traceability events grouped by day", async () => {
    renderPage();

    expect(
      await screen.findByText("Batch submitted by supplier")
    ).toBeInTheDocument();
    expect(screen.getByText("BATCH-ACT-101")).toBeInTheDocument();
    expect(screen.getByText("Anirudh Sharma")).toBeInTheDocument();
  });

  it("clicking Load more appends next page of events", async () => {
    renderPage();

    expect(await screen.findByText("BATCH-ACT-101")).toBeInTheDocument();

    const loadMoreBtn = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(screen.getByText("BATCH-ACT-102")).toBeInTheDocument();
    });
    expect(screen.getByText("BATCH-ACT-101")).toBeInTheDocument();
    expect(screen.getByText("Weight recorded")).toBeInTheDocument();
  });
});
