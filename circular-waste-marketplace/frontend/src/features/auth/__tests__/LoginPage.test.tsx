import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { useAuthStore } from "../store";
import * as authApi from "@/api/auth";
import toast from "react-hot-toast";

vi.mock("react-hot-toast");

describe("<LoginPage>", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  it("renders email and password inputs and submit button", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/corporate email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("submitting empty form displays validation errors", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it("valid credentials trigger apiLogin and store tokens", async () => {
    const user = userEvent.setup();
    const mockAuthResponse = {
      user: {
        id: "usr-1",
        email: "operator@cwm.io",
        full_name: "Jane Doe",
        role: "GENERATOR" as const,
        is_active: true,
        is_verified: true,
      },
      tokens: {
        access_token: "token-123",
        refresh_token: "refresh-456",
        token_type: "bearer" as const,
        expires_in: 1800,
      },
    };

    vi.spyOn(authApi, "login").mockResolvedValue(mockAuthResponse);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/corporate email/i), "operator@cwm.io");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePassword123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "operator@cwm.io",
        password: "SecurePassword123",
      });
      expect(useAuthStore.getState().status).toBe("authenticated");
    });
  });

  it("401 credentials failure displays error toast", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue({
      code: 401,
      title: "Unauthorized",
      detail: "Invalid email or password",
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/corporate email/i), "wrong@cwm.io");
    await user.type(screen.getByLabelText(/^password$/i), "WrongPassword1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid email or password",
        expect.anything()
      );
    });
  });

  it("429 response disables submit button with visible countdown", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue({
      code: 429,
      title: "Too Many Requests",
      detail: "Rate limit exceeded",
      retryAfter: 30,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/corporate email/i), "rate@cwm.io");
    await user.type(screen.getByLabelText(/^password$/i), "Password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/try again in 30s/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again in 30s/i })).toBeDisabled();
    });
  });
});
