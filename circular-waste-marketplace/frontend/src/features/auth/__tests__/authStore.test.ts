import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../store";
import { User, TokenPair } from "@/api/types";
import * as authApi from "@/api/auth";

const mockUser: User = {
  id: "usr-12345",
  email: "operator@circular.io",
  full_name: "Circular Operator",
  role: "GENERATOR",
  organization_name: "Green Feedstock Hub",
  phone_number: "+1234567890",
  is_active: true,
  is_verified: true,
};

const mockTokens: TokenPair = {
  access_token: "mock-access-token-xyz",
  refresh_token: "mock-refresh-token-abc",
  token_type: "bearer",
  expires_in: 1800,
};

describe("AuthStore (Zustand)", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  it("setAuth populates store state and sets localStorage keys", () => {
    useAuthStore.getState().setAuth(mockUser, mockTokens);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe("mock-access-token-xyz");
    expect(state.refreshToken).toBe("mock-refresh-token-abc");
    expect(state.status).toBe("authenticated");
    expect(state.isAuthenticated()).toBe(true);

    expect(localStorage.getItem("cwm.accessToken")).toBe("mock-access-token-xyz");
    expect(localStorage.getItem("cwm.refreshToken")).toBe("mock-refresh-token-abc");
    expect(JSON.parse(localStorage.getItem("cwm.user") || "{}")).toEqual(mockUser);
  });

  it("clearAuth wipes store state and deletes localStorage keys", () => {
    useAuthStore.getState().setAuth(mockUser, mockTokens);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.status).toBe("unauthenticated");
    expect(state.isAuthenticated()).toBe(false);

    expect(localStorage.getItem("cwm.accessToken")).toBeNull();
    expect(localStorage.getItem("cwm.refreshToken")).toBeNull();
    expect(localStorage.getItem("cwm.user")).toBeNull();
  });

  it("hydrate loads tokens from storage and calls me() to verify", async () => {
    localStorage.setItem("cwm.accessToken", "saved-token-123");
    localStorage.setItem("cwm.refreshToken", "saved-refresh-456");
    localStorage.setItem("cwm.user", JSON.stringify(mockUser));

    vi.spyOn(authApi, "me").mockResolvedValue(mockUser);

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.accessToken).toBe("saved-token-123");
    expect(authApi.me).toHaveBeenCalledWith("saved-token-123");
  });

  it("hydrate falls back to refresh when me() returns 401", async () => {
    localStorage.setItem("cwm.accessToken", "expired-token");
    localStorage.setItem("cwm.refreshToken", "valid-refresh-token");

    const newTokens: TokenPair = {
      access_token: "refreshed-token-999",
      refresh_token: "refreshed-refresh-888",
      token_type: "bearer",
      expires_in: 1800,
    };

    // First me() fails with 401
    vi.spyOn(authApi, "me")
      .mockRejectedValueOnce({ code: 401, detail: "Expired" })
      .mockResolvedValueOnce(mockUser);

    vi.spyOn(authApi, "refresh").mockResolvedValue(newTokens);

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(authApi.refresh).toHaveBeenCalledWith("valid-refresh-token");
    expect(state.status).toBe("authenticated");
    expect(state.accessToken).toBe("refreshed-token-999");
  });

  it("hasRole accurately evaluates roles and grants ADMIN implicit access", () => {
    useAuthStore.getState().setAuth(mockUser, mockTokens); // Role: GENERATOR
    expect(useAuthStore.getState().hasRole(["GENERATOR"])).toBe(true);
    expect(useAuthStore.getState().hasRole(["RECYCLER", "LOGISTICS"])).toBe(false);

    // ADMIN user
    const adminUser: User = { ...mockUser, role: "ADMIN" };
    useAuthStore.getState().setAuth(adminUser, mockTokens);
    expect(useAuthStore.getState().hasRole(["LOGISTICS"])).toBe(true);
    expect(useAuthStore.getState().hasRole(["RECYCLER"])).toBe(true);
    expect(useAuthStore.getState().hasRole(["GENERATOR"])).toBe(true);
  });
});
