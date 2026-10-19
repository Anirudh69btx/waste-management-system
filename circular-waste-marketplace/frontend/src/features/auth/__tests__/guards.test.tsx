import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth, PublicOnly, RequireRole } from "../guards";
import { useAuthStore } from "../store";
import { User, TokenPair } from "@/api/types";

const mockUser: User = {
  id: "usr-1",
  email: "user@cwm.io",
  full_name: "Test User",
  role: "GENERATOR",
  is_active: true,
  is_verified: true,
};

const mockTokens: TokenPair = {
  access_token: "mock-access",
  refresh_token: "mock-refresh",
  token_type: "bearer",
  expires_in: 1800,
};

describe("Route Guards", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  describe("<RequireAuth>", () => {
    it("redirects unauthenticated users to /login", () => {
      useAuthStore.getState().setStatus("unauthenticated");

      render(
        <MemoryRouter initialEntries={["/protected"]}>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div>Protected Content</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div>Login Page Target</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText("Login Page Target")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("renders children when user is authenticated", () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      render(
        <MemoryRouter initialEntries={["/protected"]}>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div>Protected Content</div>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("<PublicOnly>", () => {
    it("redirects authenticated users to /dashboard", () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <div>Login Form</div>
                </PublicOnly>
              }
            />
            <Route path="/dashboard" element={<div>Dashboard Target</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText("Dashboard Target")).toBeInTheDocument();
      expect(screen.queryByText("Login Form")).not.toBeInTheDocument();
    });

    it("renders children when user is unauthenticated", () => {
      useAuthStore.getState().setStatus("unauthenticated");

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <div>Login Form</div>
                </PublicOnly>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText("Login Form")).toBeInTheDocument();
    });
  });

  describe("<RequireRole>", () => {
    it("renders ForbiddenPage (403) when user lacks required role", () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens); // Role: GENERATOR

      render(
        <MemoryRouter initialEntries={["/sorter-intake"]}>
          <Routes>
            <Route
              path="/sorter-intake"
              element={
                <RequireRole roles={["RECYCLER"]}>
                  <div>Sorter Workspace</div>
                </RequireRole>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/403 — Access Forbidden/i)).toBeInTheDocument();
      expect(screen.queryByText("Sorter Workspace")).not.toBeInTheDocument();
    });

    it("renders children when user possesses required role", () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens); // Role: GENERATOR

      render(
        <MemoryRouter initialEntries={["/generator-intake"]}>
          <Routes>
            <Route
              path="/generator-intake"
              element={
                <RequireRole roles={["GENERATOR"]}>
                  <div>Generator Workspace</div>
                </RequireRole>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText("Generator Workspace")).toBeInTheDocument();
    });

    it("implicitly authorizes ADMIN user for any role gate", () => {
      const adminUser: User = { ...mockUser, role: "ADMIN" };
      useAuthStore.getState().setAuth(adminUser, mockTokens);

      render(
        <MemoryRouter initialEntries={["/fleet-telemetry"]}>
          <Routes>
            <Route
              path="/fleet-telemetry"
              element={
                <RequireRole roles={["LOGISTICS"]}>
                  <div>Fleet Telemetry Console</div>
                </RequireRole>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText("Fleet Telemetry Console")).toBeInTheDocument();
    });
  });
});
