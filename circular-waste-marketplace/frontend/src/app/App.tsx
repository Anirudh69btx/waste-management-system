import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MainLayout } from "@/layouts/MainLayout";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/features/auth/LoginPage";
import { IntakeSubmissionPage } from "@/features/suppliers/IntakeSubmissionPage";
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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* App shell layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<RoleDashboardPage />} />
            <Route path="/intake" element={<IntakeSubmissionPage />} />
            <Route path="/pickups" element={<PickupSchedulerPage />} />
            <Route path="/tracking" element={<LiveTrackingPage />} />
            <Route path="/sorting" element={<SorterIntakePage />} />
            <Route path="/marketplace" element={<MarketplaceFeedPage />} />
            <Route path="/eco-store" element={<EcoStorePage />} />
            <Route path="/rewards" element={<GreenRewardsPage />} />
            <Route path="/analytics" element={<RoleDashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
