import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DemoLoginPanel } from "../components/DemoLoginPanel";
import * as authApi from "@/api/auth";
import { useAuthStore } from "../store";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/api/auth", () => ({
  login: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
}));

describe("DemoLoginPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns nothing when VITE_DEMO_MODE !== 'true'", () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");

    const { container } = render(
      <MemoryRouter>
        <DemoLoginPanel />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Demo Accounts/i)).not.toBeInTheDocument();
  });

  it("renders 5 role buttons when VITE_DEMO_MODE === 'true'", () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");

    render(
      <MemoryRouter>
        <DemoLoginPanel />
      </MemoryRouter>
    );

    expect(screen.getByText(/🎬 Demo Accounts/)).toBeInTheDocument();
    expect(screen.getByText("One-click sign-in for reviewers")).toBeInTheDocument();
    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText("Sorter")).toBeInTheDocument();
    expect(screen.getByText("Driver")).toBeInTheDocument();
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("clicking 'Admin' calls login with admin@cwm.io and navigates to /admin/analytics", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");

    vi.mocked(authApi.login).mockResolvedValueOnce({
      user: {
        id: "admin-1",
        email: "admin@cwm.io",
        full_name: "Platform Administrator",
        role: "ADMIN",
        organization_name: "CWM Operations Central",
        is_active: true,
        is_verified: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      tokens: {
        access_token: "demo-access-token",
        refresh_token: "demo-refresh-token",
        token_type: "bearer",
        expires_in: 900,
      },
    });

    render(
      <MemoryRouter>
        <DemoLoginPanel />
      </MemoryRouter>
    );

    const adminBtn = screen.getByRole("button", { name: /Admin/i });
    fireEvent.click(adminBtn);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "admin@cwm.io",
        password: "Password123!@#",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/admin/analytics");
    });
  });
});
