import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RegisterPage } from "../pages/RegisterPage";
import { useAuthStore } from "../store";
import * as authApi from "@/api/auth";

vi.mock("react-hot-toast");

describe("<RegisterPage>", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  it("renders all registration fields and verifies ADMIN role is excluded from selector", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/corporate email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/marketplace role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /terms of service/i })).toBeInTheDocument();

    // Verify ADMIN does NOT exist as an option
    const roleSelect = screen.getByLabelText(/marketplace role/i);
    const options = Array.from((roleSelect as HTMLSelectElement).options).map((opt) => opt.value);
    expect(options).toContain("GENERATOR");
    expect(options).toContain("RECYCLER");
    expect(options).toContain("LOGISTICS");
    expect(options).not.toContain("ADMIN");
  });

  it("password mismatch displays inline validation error", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/corporate email/i), "jane@cwm.io");
    await user.type(screen.getByLabelText(/^password$/i), "Password123");
    await user.type(screen.getByLabelText(/confirm password/i), "Password456");
    await user.click(screen.getByRole("checkbox", { name: /terms of service/i }));
    await user.click(screen.getByRole("button", { name: /create marketplace account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("weak password failing complexity displays validation error", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Password lacking numeric digit
    await user.type(screen.getByLabelText(/^password$/i), "OnlyLettersLong");
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/must contain at least one numeric digit/i)).toBeInTheDocument();
    });
  });

  it("successful registration creates user, saves tokens, and updates auth store", async () => {
    const user = userEvent.setup();
    const mockAuthResponse = {
      user: {
        id: "usr-reg-1",
        email: "newuser@cwm.io",
        full_name: "Alex Smith",
        role: "RECYCLER" as const,
        is_active: true,
        is_verified: true,
      },
      tokens: {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        token_type: "bearer" as const,
        expires_in: 1800,
      },
    };

    vi.spyOn(authApi, "register").mockResolvedValue(mockAuthResponse);

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/full name/i), "Alex Smith");
    await user.type(screen.getByLabelText(/corporate email/i), "newuser@cwm.io");
    await user.selectOptions(screen.getByLabelText(/marketplace role/i), "RECYCLER");
    await user.type(screen.getByLabelText(/^password$/i), "StrongPass123");
    await user.type(screen.getByLabelText(/confirm password/i), "StrongPass123");
    await user.click(screen.getByRole("checkbox", { name: /terms of service/i }));
    await user.click(screen.getByRole("button", { name: /create marketplace account/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        full_name: "Alex Smith",
        email: "newuser@cwm.io",
        phone_number: null,
        role: "RECYCLER",
        organization_name: null,
        password: "StrongPass123",
      });
      expect(useAuthStore.getState().status).toBe("authenticated");
      expect(useAuthStore.getState().accessToken).toBe("new-access-token");
    });
  });
});
