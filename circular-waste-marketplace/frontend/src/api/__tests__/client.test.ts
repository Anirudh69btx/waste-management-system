import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";
import { apiClient, generateRequestId } from "../client";
import { TokenPair } from "../types";

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});

describe("API Client & Interceptors", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("generateRequestId returns non-empty UUID string", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).toBeTruthy();
    expect(typeof id1).toBe("string");
    expect(id1).not.toBe(id2);
  });

  it("request interceptor attaches Bearer token and X-Request-ID", async () => {
    localStorage.setItem("cwm.accessToken", "test-bearer-token-123");

    // Interceptor check by inspecting request configuration handlers
    // @ts-expect-error accessing axios internal handlers for testing
    const requestHandler = apiClient.interceptors.request.handlers[0].fulfilled as any;
    const config = await requestHandler({
      headers: {},
    });

    expect(config.headers.Authorization).toBe("Bearer test-bearer-token-123");
    expect(config.headers["X-Request-ID"]).toBeTruthy();
  });

  it("response interceptor handles single-flight refresh on 401 and retries original request", async () => {
    localStorage.setItem("cwm.accessToken", "expired-token");
    localStorage.setItem("cwm.refreshToken", "valid-refresh-token");

    const mockNewTokens: TokenPair = {
      access_token: "new-rotated-access-token",
      refresh_token: "new-rotated-refresh-token",
      token_type: "bearer",
      expires_in: 1800,
    };

    // Mock the direct axios.post for /auth/refresh
    const axiosPostMock = vi.mocked(axios.post).mockResolvedValue({
      data: mockNewTokens,
      status: 200,
    });

    // Mock apiClient retry execution
    const retrySpy = vi.spyOn(apiClient, "request").mockResolvedValue({
      data: { success: true },
      status: 200,
    });

    // @ts-expect-error accessing axios internal handlers for testing
    const errorHandler = apiClient.interceptors.response.handlers[0].rejected as any;

    const mock401Error = {
      isAxiosError: true,
      config: {
        url: "/feedstock/listings",
        headers: {},
      },
      response: {
        status: 401,
        data: { detail: "Token expired" },
      },
    };

    // Simulate 3 concurrent 401 failures
    const [res1, res2, res3] = await Promise.all([
      errorHandler(mock401Error),
      errorHandler({ ...mock401Error, config: { url: "/analytics/stats", headers: {} } }),
      errorHandler({ ...mock401Error, config: { url: "/profile", headers: {} } }),
    ]);

    // Single-flight assertion: Exactly 1 POST to /auth/refresh was fired
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("cwm.accessToken")).toBe("new-rotated-access-token");
    expect(localStorage.getItem("cwm.refreshToken")).toBe("new-rotated-refresh-token");
  });

  it("refresh failure clears auth storage and redirects", async () => {
    localStorage.setItem("cwm.accessToken", "expired-token");
    localStorage.setItem("cwm.refreshToken", "revoked-refresh-token");

    // Mock /auth/refresh rejection (e.g. 401 replay attack revoked)
    vi.mocked(axios.post).mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { detail: "Token revoked" } },
    });

    // @ts-expect-error accessing axios internal handlers for testing
    const errorHandler = apiClient.interceptors.response.handlers[0].rejected as any;

    const mock401Error = {
      isAxiosError: true,
      config: {
        url: "/waste/categories",
        headers: {},
      },
      response: {
        status: 401,
        data: { detail: "Token expired" },
      },
    };

    await expect(errorHandler(mock401Error)).rejects.toMatchObject({
      code: 401,
    });

    // Confirm credentials wiped
    expect(localStorage.getItem("cwm.accessToken")).toBeNull();
    expect(localStorage.getItem("cwm.refreshToken")).toBeNull();
    expect(localStorage.getItem("cwm.user")).toBeNull();
  });
});
