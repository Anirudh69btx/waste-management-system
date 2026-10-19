// =============================================================================
// Circular Waste Marketplace — Route Guards (UX Layer)
// =============================================================================
// CRITICAL ARCHITECTURAL NOTE:
// Client-side route guards are for USER EXPERIENCE ONLY.
// They prevent UI flicker, provide smooth navigation, and direct users to login.
// Backend RBAC and database security policies are the authoritative security controls.
// Never rely on client-side guards alone to protect sensitive marketplace operations.
// =============================================================================

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Role } from "@/api/types";
import { PageLoader } from "@/components/PageLoader";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { useAuthStore } from "./store";

interface GuardProps {
  children: React.ReactNode;
}

interface RequireRoleProps extends GuardProps {
  roles: Role[];
}

/**
 * RequireAuth: Restricts route access to authenticated sessions.
 * Redirects unauthenticated users to /login preserving the requested path in state.from.
 */
export const RequireAuth: React.FC<GuardProps> = ({ children }) => {
  const { status } = useAuthStore();
  const location = useLocation();

  if (status === "loading" || status === "idle") {
    return <PageLoader message="Verifying authentication session..." />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

/**
 * PublicOnly: Restricts route access to unauthenticated sessions.
 * Prevents logged-in users from seeing /login and /register, redirecting to /dashboard or state.from.
 */
export const PublicOnly: React.FC<GuardProps> = ({ children }) => {
  const { status } = useAuthStore();
  const location = useLocation();
  const state = location.state as { from?: string } | null;

  if (status === "loading" || status === "idle") {
    return <PageLoader message="Verifying session..." />;
  }

  if (status === "authenticated") {
    return <Navigate to={state?.from || "/dashboard"} replace />;
  }

  return <>{children}</>;
};

/**
 * RequireRole: Checks authenticated user role against required list.
 * Note: ADMIN role implicitly passes all role requirements client-side (matching backend RBAC).
 * Non-authorized users render ForbiddenPage in-place preserving the target URL.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { status, user, hasRole } = useAuthStore();
  const location = useLocation();

  if (status === "loading" || status === "idle") {
    return <PageLoader message="Verifying role authorizations..." />;
  }

  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!hasRole(roles)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
};
