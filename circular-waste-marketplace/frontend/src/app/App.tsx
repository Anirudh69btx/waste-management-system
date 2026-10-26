import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { MainLayout } from "@/layouts/MainLayout";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPlaceholderPage } from "@/pages/DashboardPlaceholderPage";
import { SupplierOverviewPage } from "@/features/suppliers/pages/SupplierOverviewPage";
import { SupplierBatchListPage } from "@/features/suppliers/pages/SupplierBatchListPage";
import { SupplierBatchDetailPage } from "@/features/suppliers/pages/SupplierBatchDetailPage";
import { SupplierCategoryGuidePage } from "@/features/suppliers/pages/SupplierCategoryGuidePage";
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
import { AdminFleetPage } from "@/features/fleet/pages/AdminFleetPage";
import { DriverTripPage } from "@/features/fleet/pages/DriverTripPage";
import { SorterConsolePage } from "@/features/sorting/pages/SorterConsolePage";
import { MarketplacePage } from "@/features/marketplace/pages/MarketplacePage";
import { MyOrdersPage } from "@/features/marketplace/pages/MyOrdersPage";
import { ListingDetailPage } from "@/features/marketplace/pages/ListingDetailPage";
import SellerInventoryPage from "@/features/seller/pages/SellerInventoryPage";
import SellerListingsPage from "@/features/seller/pages/SellerListingsPage";
import SellerBidsPage from "@/features/seller/pages/SellerBidsPage";
import SellerOrdersPage from "@/features/seller/pages/SellerOrdersPage";

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
            {/* Client-side guards are UX only. Backend RBAC is the real control. */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <RequireRole roles={["GENERATOR", "ADMIN"]}>
                    <SupplierOverviewPage />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Client-side guards are UX only. Backend RBAC is the real control. */}
            <Route
              path="/dashboard/batches"
              element={
                <RequireAuth>
                  <RequireRole roles={["GENERATOR", "ADMIN"]}>
                    <SupplierBatchListPage />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Client-side guards are UX only. Backend RBAC is the real control. */}
            <Route
              path="/dashboard/batches/:id"
              element={
                <RequireAuth>
                  <RequireRole roles={["GENERATOR", "ADMIN"]}>
                    <SupplierBatchDetailPage />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Client-side guards are UX only. Backend RBAC is the real control. */}
            <Route
              path="/dashboard/guide"
              element={
                <RequireAuth>
                  <RequireRole roles={["GENERATOR", "ADMIN"]}>
                    <SupplierCategoryGuidePage />
                  </RequireRole>
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

            {/* Segment 3.1: Fleet & Live Map routes */}
            <Route
              path="/admin/fleet"
              element={
                <RequireAuth>
                  <RequireRole roles={["ADMIN"]}>
                    <AdminFleetPage />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/driver/trip"
              element={
                <RequireAuth>
                  <RequireRole roles={["LOGISTICS", "ADMIN"]}>
                    <DriverTripPage />
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
            {/* Segment 3.2: Sorter Console & Marketplace */}
            <Route
              path="/sorter/console"
              element={
                <RequireAuth>
                  <RequireRole roles={["RECYCLER", "ADMIN"]}>
                    <SorterConsolePage />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/marketplace"
              element={
                <RequireAuth>
                  <MarketplacePage />
                </RequireAuth>
              }
            />
            <Route
              path="/marketplace/orders"
              element={
                <RequireAuth>
                  <RequireRole roles={["RECYCLER", "ADMIN"]}>
                    <MyOrdersPage />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/marketplace/:id"
              element={
                <RequireAuth>
                  <ListingDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/seller/inventory"
              element={
                <RequireAuth>
                  <RequireRole roles={["RECYCLER", "ADMIN"]}>
                    <SellerInventoryPage />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/seller/listings"
              element={
                <RequireAuth>
                  <RequireRole roles={["RECYCLER", "ADMIN"]}>
                    <SellerListingsPage />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/seller/bids"
              element={
                <RequireAuth>
                  <RequireRole roles={["RECYCLER", "ADMIN"]}>
                    <SellerBidsPage />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/seller/orders"
              element={
                <RequireAuth>
                  <RequireRole roles={["RECYCLER", "ADMIN"]}>
                    <SellerOrdersPage />
                  </RequireRole>
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
