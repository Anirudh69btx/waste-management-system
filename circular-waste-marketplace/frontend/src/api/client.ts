import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { NormalizedApiError, ProblemDetail, TokenPair } from "./types";
import toast from "react-hot-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// Safe UUID generation with fallback
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "req-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
  },
});

// Single-flight refresh token mutex promise
let activeRefreshPromise: Promise<string | null> | null = null;

// Normalize backend RFC-7807 problem details or Axios errors
export function normalizeApiError(error: unknown): NormalizedApiError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "title" in error &&
    "detail" in error
  ) {
    return error as NormalizedApiError;
  }

  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ProblemDetail>;
    const status = axiosErr.response?.status || (axiosErr.code === "ECONNABORTED" ? 408 : 0);
    const data = axiosErr.response?.data;
    const requestId =
      (axiosErr.response?.headers?.["x-request-id"] as string) ||
      data?.request_id ||
      (axiosErr.config?.headers?.["X-Request-ID"] as string);

    const retryAfterHeader = axiosErr.response?.headers?.["retry-after"];
    const retryAfter = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : undefined;

    let detail = "An unexpected error occurred.";
    let fieldErrors: Record<string, string> | undefined = undefined;

    if (data?.detail) {
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        fieldErrors = {};
        const messages: string[] = [];
        data.detail.forEach((err: { loc?: string[]; msg?: string }) => {
          const field = err.loc ? err.loc[err.loc.length - 1] : "field";
          const msg = err.msg || "Invalid value";
          if (field) fieldErrors![field] = msg;
          messages.push(msg);
        });
        detail = messages.join("; ");
      }
    } else if (axiosErr.message) {
      detail = axiosErr.message === "Network Error" ? "Network error. Please check your connection." : axiosErr.message;
    }

    const title = data?.title || (status === 429 ? "Too Many Requests" : status === 401 ? "Unauthorized" : "Request Failed");

    return {
      code: status,
      title,
      detail,
      requestId,
      retryAfter,
      fieldErrors,
    };
  }

  return {
    code: 500,
    title: "Application Error",
    detail: error instanceof Error ? error.message : String(error),
  };
}

// Request Interceptor: Attach Bearer Token & X-Request-ID
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("cwm.accessToken");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Ensure an X-Request-ID header exists on every outgoing request
  if (config.headers && !config.headers["X-Request-ID"]) {
    config.headers["X-Request-ID"] = generateRequestId();
  }

  return config;
});

// Response Interceptor: Handle 401 with Single-Flight Refresh Token Rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // Check if error is 401 from an endpoint that can be refreshed
    const url = originalRequest?.url || "";
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      const storedRefreshToken = localStorage.getItem("cwm.refreshToken");
      if (!storedRefreshToken) {
        // No refresh token available — force logout
        clearAuthStorage();
        handleSessionExpiration();
        return Promise.reject(normalizeApiError(error));
      }

      // Execute single-flight refresh
      if (!activeRefreshPromise) {
        activeRefreshPromise = (async () => {
          try {
            // Raw axios call to bypass apiClient interceptors and avoid loops
            const response = await axios.post<TokenPair>(
              `${API_BASE_URL}/auth/refresh`,
              { refresh_token: storedRefreshToken },
              {
                headers: {
                  "Content-Type": "application/json",
                  "X-Request-ID": generateRequestId(),
                },
                timeout: 10000,
              }
            );

            const tokens = response.data;
            if (tokens.access_token) {
              localStorage.setItem("cwm.accessToken", tokens.access_token);
              if (tokens.refresh_token) {
                localStorage.setItem("cwm.refreshToken", tokens.refresh_token);
              }
              return tokens.access_token;
            }
            return null;
          } catch {
            return null;
          } finally {
            activeRefreshPromise = null;
          }
        })();
      }

      const newAccessToken = await activeRefreshPromise;

      if (newAccessToken) {
        // Update header and retry original request once
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        try {
          return await apiClient.request(originalRequest);
        } catch (retryError) {
          return Promise.reject(normalizeApiError(retryError));
        }
      } else {
        // Refresh failed (token expired or revoked)
        clearAuthStorage();
        handleSessionExpiration();
        return Promise.reject(normalizeApiError(error));
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

function clearAuthStorage(): void {
  localStorage.removeItem("cwm.accessToken");
  localStorage.removeItem("cwm.refreshToken");
  localStorage.removeItem("cwm.user");
}

function handleSessionExpiration(): void {
  if (typeof window !== "undefined") {
    // Only redirect if not already on an auth page
    const pathname = window.location.pathname;
    if (!pathname.startsWith("/login") && !pathname.startsWith("/register") && pathname !== "/") {
      toast.error("Session expired. Please sign in again.");
      window.location.href = `/login?from=${encodeURIComponent(pathname)}`;
    }
  }
}
