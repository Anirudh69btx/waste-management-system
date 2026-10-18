import axios, { AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request interceptor to inject JWT bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("cwm_access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle session expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login if not already on auth page
      if (!window.location.pathname.startsWith("/login")) {
        localStorage.removeItem("cwm_access_token");
        localStorage.removeItem("cwm_user");
        window.location.href = "/login?expired=1";
      }
    }
    return Promise.reject(error);
  }
);
