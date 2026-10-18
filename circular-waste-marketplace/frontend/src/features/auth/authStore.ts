import { create } from "zustand";
import { User, UserRole } from "@/api/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  demoLogin: (role: UserRole) => void;
}

const DEMO_USERS: Record<UserRole, User> = {
  GENERATOR: {
    id: "demo-supplier-01",
    email: "supplier@cwm.io",
    full_name: "Green Earth Organics Ltd",
    role: "GENERATOR",
    organization_name: "Green Earth Farms & Food",
    is_active: true,
    is_verified: true,
  },
  RECYCLER: {
    id: "demo-sorter-01",
    email: "sorter@cwm.io",
    full_name: "Apex Sorting Hub",
    role: "RECYCLER",
    organization_name: "Apex Resource Recovery Yard 3",
    is_active: true,
    is_verified: true,
  },
  LOGISTICS: {
    id: "demo-driver-01",
    email: "driver@cwm.io",
    full_name: "Ramesh Kumar (Logistics)",
    role: "LOGISTICS",
    organization_name: "City Green Fleet Logistics",
    is_active: true,
    is_verified: true,
  },
  ADMIN: {
    id: "demo-admin-01",
    email: "admin@cwm.io",
    full_name: "Platform Administrator",
    role: "ADMIN",
    organization_name: "CWM Central Operations",
    is_active: true,
    is_verified: true,
  },
};

export const useAuthStore = create<AuthState>((set) => {
  // Read persisted initial state
  const savedToken = localStorage.getItem("cwm_access_token");
  const savedUserJson = localStorage.getItem("cwm_user");
  let savedUser: User | null = null;
  try {
    if (savedUserJson) savedUser = JSON.parse(savedUserJson);
  } catch {
    savedUser = null;
  }

  // Default to a demo supplier user if none saved, so UI is instantly interactive
  const initialUser = savedUser || DEMO_USERS.GENERATOR;
  const initialToken = savedToken || "demo-jwt-token-active";

  return {
    user: initialUser,
    token: initialToken,
    isAuthenticated: true,
    login: (token: string, user: User) => {
      localStorage.setItem("cwm_access_token", token);
      localStorage.setItem("cwm_user", JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },
    logout: () => {
      localStorage.removeItem("cwm_access_token");
      localStorage.removeItem("cwm_user");
      set({ token: null, user: null, isAuthenticated: false });
    },
    demoLogin: (role: UserRole) => {
      const demoUser = DEMO_USERS[role];
      const demoToken = `demo-${role.toLowerCase()}-token`;
      localStorage.setItem("cwm_access_token", demoToken);
      localStorage.setItem("cwm_user", JSON.stringify(demoUser));
      set({ token: demoToken, user: demoUser, isAuthenticated: true });
    },
  };
});
