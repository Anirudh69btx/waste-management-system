import React from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-400">
        <p>Circular Waste Marketplace &copy; 2026 — Verified Industrial Feedstock & Renewable Material Platform</p>
      </footer>
    </div>
  );
};
