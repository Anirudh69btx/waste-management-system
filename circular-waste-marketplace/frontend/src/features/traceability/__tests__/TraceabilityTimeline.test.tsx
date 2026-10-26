import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TraceabilityTimeline } from "../components/TraceabilityTimeline";
import * as traceabilityApi from "@/api/traceability";
import type { TraceabilityEventRead } from "@/api/types";

vi.mock("@/api/traceability", async () => {
  const actual = await vi.importActual<typeof traceabilityApi>("@/api/traceability");
  return {
    ...actual,
    getBatchTimeline: vi.fn(),
  };
});

describe("TraceabilityTimeline", () => {
  let queryClient: QueryClient;

  const mockEvents: TraceabilityEventRead[] = [
    {
      id: "event-1",
      batch_id: "batch-100",
      event_type: "batch.submitted",
      from_status: null,
      to_status: "submitted",
      actor_user_id: "user-1",
      actor_role: "GENERATOR",
      metadata_json: { declared_weight: 150 },
      request_id: "req-1",
      created_at: "2026-02-01T10:00:00Z",
    },
    {
      id: "event-2",
      batch_id: "batch-100",
      event_type: "sorting.completed",
      from_status: "weighed",
      to_status: "sorted",
      actor_user_id: "user-2",
      actor_role: "RECYCLER",
      metadata_json: { purity_grade: "GRADE_A", sorted_weight: 145 },
      request_id: "req-2",
      created_at: "2026-02-01T12:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderWithClient = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  it("renders chronological events with labels and actor roles", async () => {
    vi.mocked(traceabilityApi.getBatchTimeline).mockResolvedValueOnce({
      batch_id: "batch-100",
      events: mockEvents,
    });

    renderWithClient(<TraceabilityTimeline batchId="batch-100" />);

    await waitFor(() => {
      expect(screen.getByText("Batch submitted by supplier")).toBeInTheDocument();
      expect(screen.getByText("Sorting completed")).toBeInTheDocument();
    });

    expect(screen.getByText("GENERATOR")).toBeInTheDocument();
    expect(screen.getByText("RECYCLER")).toBeInTheDocument();
  });

  it("hides metadata expansion in compact mode", async () => {
    vi.mocked(traceabilityApi.getBatchTimeline).mockResolvedValueOnce({
      batch_id: "batch-100",
      events: mockEvents,
    });

    renderWithClient(<TraceabilityTimeline batchId="batch-100" compact />);

    await waitFor(() => {
      expect(screen.getByText("Sorting completed")).toBeInTheDocument();
    });

    // In compact mode, metadata table cannot be toggled open
    expect(screen.queryByText("purity_grade")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Sorting completed"));
    expect(screen.queryByText("purity_grade")).not.toBeInTheDocument();
  });

  it("renders empty state when consignment has no recorded events", async () => {
    vi.mocked(traceabilityApi.getBatchTimeline).mockResolvedValueOnce({
      batch_id: "batch-empty",
      events: [],
    });

    renderWithClient(<TraceabilityTimeline batchId="batch-empty" />);

    await waitFor(() => {
      expect(screen.getByText("No events recorded yet")).toBeInTheDocument();
    });
  });
});
