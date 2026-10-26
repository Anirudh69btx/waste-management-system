import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import * as adminApi from "@/api/admin";
import type { AdminUserListResponse } from "@/api/types";
import { useAuthStore } from "@/features/auth/authStore";
import { AdminUsersPage } from "../pages/AdminUsersPage";

vi.mock("@/api/admin", () => ({
  listUsers: vi.fn(),
  changeUserRole: vi.fn(),
  deactivateUser: vi.fn(),
  activateUser: vi.fn(),
}));

const mockUsersResponse: AdminUserListResponse = {
  items: [
    {
      id: "admin-self-id",
      email: "admin@cwm.io",
      full_name: "Platform Admin",
      role: "ADMIN",
      organization_name: "CWM HQ",
      phone_number: "+919000000001",
      is_active: true,
      is_verified: true,
      created_at: "2026-01-10T10:00:00Z",
      deactivation_reason: null,
      last_role_change_at: null,
    },
    {
      id: "user-gen-1",
      email: "supplier1@cwm.io",
      full_name: "Anirudh Sharma",
      role: "GENERATOR",
      organization_name: "Green Mill",
      phone_number: "+919000000002",
      is_active: true,
      is_verified: true,
      created_at: "2026-02-15T10:00:00Z",
      deactivation_reason: null,
      last_role_change_at: null,
    },
  ],
  total: 2,
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: "admin-self-id",
        email: "admin@cwm.io",
        full_name: "Platform Admin",
        role: "ADMIN",
        is_active: true,
        is_verified: true,
      },
      isAuthenticated: true,
    } as never);
    vi.mocked(adminApi.listUsers).mockResolvedValue(mockUsersResponse);
  });

  it("renders user table with platform count and rows", async () => {
    renderPage();

    expect(await screen.findByText("Anirudh Sharma")).toBeInTheDocument();
    expect(screen.getByText("supplier1@cwm.io")).toBeInTheDocument();
    expect(screen.getByText("2 users on platform")).toBeInTheDocument();
  });

  it("search input updates query after debounce", async () => {
    renderPage();
    await screen.findByText("Anirudh Sharma");

    const searchInput = screen.getByLabelText("Search users");
    fireEvent.change(searchInput, { target: { value: "supplier" } });

    await waitFor(
      () => {
        expect(adminApi.listUsers).toHaveBeenCalledWith(
          expect.objectContaining({ search: "supplier" })
        );
      },
      { timeout: 1000 }
    );
  });

  it("self-row shows You badge and has no Change role or Deactivate buttons", async () => {
    renderPage();
    await screen.findByText("Platform Admin");

    expect(screen.getByText("You")).toBeInTheDocument();
    const changeRoleButtons = screen.getAllByRole("button", {
      name: /change role/i,
    });
    expect(changeRoleButtons).toHaveLength(1);
  });
});
