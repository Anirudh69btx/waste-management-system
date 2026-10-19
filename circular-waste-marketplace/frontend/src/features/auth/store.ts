// =============================================================================
// Circular Waste Marketplace — Global Auth Store (Zustand)
// =============================================================================

import { create } from "zustand";
import { Role, TokenPair, User } from "@/api/types";
import { me, refresh } from "@/api/auth";

export type AuthStatus = "idle" | "authenticated" | "unauthenticated" | "loading";

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: AuthStatus;

  // Actions
  setAuth: (user: User, tokens: TokenPair) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
  setStatus: (status: AuthStatus) => void;
  hydrate: () => Promise<void>;

  // Convenience computed helpers
  isAuthenticated: () => boolean;
  hasRole: (allowedRoles: Role[]) => boolean;
}

const STORAGE_KEY_ACCESS = "cwm.accessToken";
const STORAGE_KEY_REFRESH = "cwm.refreshToken";
const STORAGE_KEY_USER = "cwm.user";

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  status: "idle",

  setAuth: (user: User, tokens: TokenPair) => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCESS, tokens.access_token);
      localStorage.setItem(STORAGE_KEY_REFRESH, tokens.refresh_token);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      // Ignore localStorage write failures in restricted environments
    }

    set({
      user,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      status: "authenticated",
    });
  },

  clearAuth: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_ACCESS);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      // Ignore
    }

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: "unauthenticated",
    });
  },

  setUser: (user: User) => {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      // Ignore
    }
    set({ user });
  },

  setStatus: (status: AuthStatus) => set({ status }),

  hydrate: async () => {
    // Prevent redundant hydration cycles if already initialized or active
    if (get().status === "loading") return;

    set({ status: "loading" });

    let savedAccess: string | null = null;
    let savedRefresh: string | null = null;
    let savedUser: User | null = null;

    try {
      savedAccess = localStorage.getItem(STORAGE_KEY_ACCESS);
      savedRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
      const rawUser = localStorage.getItem(STORAGE_KEY_USER);
      if (rawUser) {
        savedUser = JSON.parse(rawUser) as User;
      }
    } catch {
      // Corrupt or inaccessible storage
      savedAccess = null;
      savedRefresh = null;
      savedUser = null;
    }

    if (!savedAccess && !savedRefresh) {
      get().clearAuth();
      return;
    }

    // Populate optimistic local state
    set({
      user: savedUser,
      accessToken: savedAccess,
      refreshToken: savedRefresh,
    });

    // Verify token validity with backend /auth/me
    try {
      if (savedAccess) {
        const liveUser = await me(savedAccess);
        get().setUser(liveUser);
        set({ status: "authenticated" });
        return;
      }
    } catch (err: unknown) {
      const errorObj = err as { code?: number };
      // If 401, attempt silent refresh before failing
      if (errorObj?.code === 401 && savedRefresh) {
        try {
          const newTokens = await refresh(savedRefresh);
          const liveUser = await me(newTokens.access_token);
          get().setAuth(liveUser, newTokens);
          return;
        } catch {
          // Refresh failed
        }
      }
    }

    // If both access token check and refresh failed, wipe storage
    get().clearAuth();
  },

  isAuthenticated: () => {
    const { status, accessToken } = get();
    return status === "authenticated" && Boolean(accessToken);
  },

  hasRole: (allowedRoles: Role[]) => {
    const { user } = get();
    if (!user) return false;
    // ADMIN implicitly satisfies all role checks
    if (user.role === "ADMIN") return true;
    return allowedRoles.includes(user.role);
  },
}));
