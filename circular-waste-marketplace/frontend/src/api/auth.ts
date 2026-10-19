// =============================================================================
// Circular Waste Marketplace — Auth API Services
// =============================================================================

import { apiClient, normalizeApiError } from "./client";
import {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  TokenPair,
  UpdateMeRequest,
  User,
} from "./types";

/**
 * Register a new user account and obtain initial authentication tokens.
 * Endpoint: POST /api/v1/auth/register
 */
export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>("/auth/register", payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * Authenticate with corporate email or phone number and password.
 * Endpoint: POST /api/v1/auth/login
 * Note: Backend issues tokens; client then retrieves live profile via /auth/me
 * to return a complete { user, tokens } AuthResponse structure.
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  try {
    // 1. Post JSON credentials to obtain token pair
    const tokenResponse = await apiClient.post<TokenPair>("/auth/login", payload);
    const tokens = tokenResponse.data;

    // 2. Temporarily set access token to fetch current profile
    const userResponse = await apiClient.get<User>("/auth/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    return {
      user: userResponse.data,
      tokens,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * Rotate an active refresh token to issue a new access and refresh token pair.
 * Endpoint: POST /api/v1/auth/refresh
 */
export async function refresh(refreshToken: string): Promise<TokenPair> {
  try {
    const payload: RefreshRequest = { refresh_token: refreshToken };
    const response = await apiClient.post<TokenPair>("/auth/refresh", payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * Revoke the presented refresh token and terminate the user session.
 * Endpoint: POST /api/v1/auth/logout (Idempotent 204)
 */
export async function logout(refreshToken?: string | null): Promise<void> {
  try {
    if (refreshToken) {
      const payload: RefreshRequest = { refresh_token: refreshToken };
      await apiClient.post("/auth/logout", payload);
    }
  } catch {
    // Idempotent client logout: ignore server network/revocation failures
  }
}

/**
 * Fetch the authenticated user's live profile from the database.
 * Endpoint: GET /api/v1/auth/me
 */
export async function me(accessToken?: string): Promise<User> {
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    const response = await apiClient.get<User>("/auth/me", { headers });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * Update the authenticated user's editable profile fields.
 * Endpoint: PATCH /api/v1/auth/me
 */
export async function updateMe(payload: UpdateMeRequest): Promise<User> {
  try {
    const response = await apiClient.patch<User>("/auth/me", payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * Change the authenticated user's password and revoke all active refresh tokens.
 * Endpoint: POST /api/v1/auth/change-password
 */
export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  try {
    await apiClient.post("/auth/change-password", payload);
  } catch (error) {
    throw normalizeApiError(error);
  }
}
