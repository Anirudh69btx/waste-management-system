import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { MainLayout } from "@/layouts/MainLayout";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPlaceholderPage } from "@/pages/DashboardPlaceholderPage";
import { AdminOnlyPage } from "@/pages/AdminOnlyPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { TermsPage } from "@/pages/TermsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";

import { RequireAuth, PublicOnly, RequireRole } from "@/features/auth/guards";
import { useAuthStore } from "@/features/auth/store";

// Placeholder pages from Segment 1.1 scaffold
import { IntakeSubmissionPage } from "@/features/suppliers/IntakeSubmissionPage";
import { IntakeSuccessPage } from "@/features/suppliers/pages/IntakeSuccessPage";
import { PickupSchedulerPage } from "@/features/pickups/PickupSchedulerPage";
import { LiveTrackingPage } from "@/features/tracking/LiveTrackingPage";
import { SorterIntakePage } from "@/features/sorting/SorterIntakePage";
import { MarketplaceFeedPage } from "@/features/marketplace/MarketplaceFeedPage";
import { EcoStorePage } from "@/features/products/EcoStorePage";
import { GreenRewardsPage } from "@/features/rewards/GreenRewardsPage";
import { RoleDashboardPage } from "@/features/analytics/RoleDashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export const App: React.FC = () => {
  const { hydrate } = useAuthStore();

  useEffect(() => {
    // Hydrate tokens from localStorage and verify session with backend /auth/me on app mount
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Dark-themed global toast notification container */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #1e293b",
              borderRadius: "0.75rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
              fontSize: "0.875rem",
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: "#10b981",
                secondary: "#030712",
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: "#ef4444",
                secondary: "#030712",
              },
            },
          }}
        />

        <Routes>
          {/* Public-only authentication routes */}
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <RegisterPage />
              </PublicOnly>
            }
          />

          {/* Standalone informational public routes */}
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          {/* App shell layout */}
          <Route element={<MainLayout />}>
            {/* Landing page accessible to all */}
            <Route path="/" element={<HomePage />} />

            {/* Protected dashboard route */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPlaceholderPage />
                </RequireAuth>
              }
            />

            {/* Test role-restricted route: ADMIN only */}
            <Route
              path="/admin-only"
              element={
                <RequireAuth>
                  <RequireRole roles={["ADMIN"]}>
                    <AdminOnlyPage />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Reserved domain routes for Segment 1.5+ */}
            <Route
              path="/intake"
              element={
                <RequireAuth>
                  <RequireRole roles={["GENERATOR"]}>
                    <IntakeSubmissionPage />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/intake/success/:intakeId"
              element={
                <RequireAuth>
                  <IntakeSuccessPage />
                </RequireAuth>
              }
            />
            <Route
              path="/pickups"
              element={
                <RequireAuth>
                  <PickupSchedulerPage />
                </RequireAuth>
              }
            />
            <Route
              path="/tracking"
              element={
                <RequireAuth>
                  <LiveTrackingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sorting"
              element={
                <RequireAuth>
                  <SorterIntakePage />
                </RequireAuth>
              }
            />
            <Route
              path="/marketplace"
              element={
                <RequireAuth>
                  <MarketplaceFeedPage />
                </RequireAuth>
              }
            />
            <Route
              path="/eco-store"
              element={
                <RequireAuth>
                  <EcoStorePage />
                </RequireAuth>
              }
            />
            <Route
              path="/rewards"
              element={
                <RequireAuth>
                  <GreenRewardsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/analytics"
              element={
                <RequireAuth>
                  <RoleDashboardPage />
                </RequireAuth>
              }
            />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
