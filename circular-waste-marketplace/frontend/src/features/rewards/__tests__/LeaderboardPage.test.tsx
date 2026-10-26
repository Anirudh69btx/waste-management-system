import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import * as rewardsApi from "@/api/rewards";

vi.mock("@/api/rewards", () => ({
  getLeaderboard: vi.fn(),
}));

vi.mock("@/features/auth/authStore", () => ({
  useAuthStore: () => ({
    user: { id: "user-2", email: "ramesh@cwm.io", role: "GENERATOR" },
  }),
}));

function renderLeaderboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rewardsApi.getLeaderboard).mockResolvedValue({
      period: "week",
      entries: [
        { user_id: "user-1", display_name: "A. Sharma", points: 4200, rank: 1 },
        { user_id: "user-2", display_name: "R. Kumar", points: 3150, rank: 2 },
        { user_id: "user-3", display_name: "P. Patel", points: 2100, rank: 3 },
      ],
    });
  });

  it("renders ranked entries with medal badges", async () => {
    renderLeaderboard();
    expect(await screen.findByText("A. Sharma")).toBeInTheDocument();
    expect(screen.getByText("R. Kumar")).toBeInTheDocument();
    expect(screen.getByText("P. Patel")).toBeInTheDocument();
    expect(screen.getByText("🥇")).toBeInTheDocument();
    expect(screen.getByText("🥈")).toBeInTheDocument();
    expect(screen.getByText("🥉")).toBeInTheDocument();
  });

  it("highlights the current user row in the leaderboard", async () => {
    renderLeaderboard();
    const row2 = await screen.findByTestId("leaderboard-row-2");
    expect(row2).toHaveAttribute("data-current-user", "true");
    expect(screen.getByText("You")).toBeInTheDocument();

    const row1 = screen.getByTestId("leaderboard-row-1");
    expect(row1).toHaveAttribute("data-current-user", "false");
  });
});
