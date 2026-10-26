import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  UploadCloud,
  Calendar,
  Navigation,
  CheckCircle2,
  ShoppingCart,
  PackageOpen,
  Award,
  BarChart3,
  Settings,
  Layers,
  Tag,
  Gavel,
  Truck,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/authStore";

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const role = user?.role || "GENERATOR";

  const allNavItems = [
    {
      to: "/dashboard",
      label: t("nav.dashboard"),
      icon: LayoutDashboard,
      roles: ["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"],
    },
    {
      to: "/intake",
      label: t("nav.intake"),
      icon: UploadCloud,
      roles: ["GENERATOR", "ADMIN"],
    },
    {
      to: "/dashboard/analytics",
      label: "Analytics",
      icon: BarChart3,
      roles: ["GENERATOR"],
    },
    {
      to: "/pickups",
      label: t("nav.pickups"),
      icon: Calendar,
      roles: ["GENERATOR", "LOGISTICS", "ADMIN"],
    },
    {
      to: "/tracking",
      label: t("nav.tracking"),
      icon: Navigation,
      roles: ["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"],
    },
    {
      to: "/sorter/console",
      label: "Sorter Console",
      icon: CheckCircle2,
      roles: ["RECYCLER", "ADMIN"],
    },
    {
      to: "/seller/inventory",
      label: "My Inventory",
      icon: Layers,
      roles: ["RECYCLER", "ADMIN"],
    },
    {
      to: "/seller/listings",
      label: "My Listings",
      icon: Tag,
      roles: ["RECYCLER", "ADMIN"],
    },
    {
      to: "/seller/bids",
      label: "Bids Received",
      icon: Gavel,
      roles: ["RECYCLER", "ADMIN"],
    },
    {
      to: "/seller/orders",
      label: "Seller Orders",
      icon: Truck,
      roles: ["RECYCLER", "ADMIN"],
    },
    {
      to: "/seller/analytics",
      label: "Analytics",
      icon: BarChart3,
      roles: ["RECYCLER", "ADMIN"],
    },
    {
      to: "/admin/analytics",
      label: "Platform Analytics",
      icon: BarChart3,
      roles: ["ADMIN"],
    },
    {
      to: "/marketplace",
      label: "Marketplace",
      icon: ShoppingCart,
      roles: ["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"],
    },
    {
      to: "/eco-store",
      label: t("nav.store"),
      icon: PackageOpen,
      roles: ["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"],
    },
    {
      to: "/rewards",
      label: t("nav.rewards"),
      icon: Award,
      roles: ["GENERATOR", "LOGISTICS", "RECYCLER", "ADMIN"],
    },
    {
      to: "/analytics",
      label: "ESG & Financials",
      icon: BarChart3,
      roles: ["GENERATOR", "RECYCLER", "ADMIN"],
    },
  ];

  const visibleItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 shrink-0 hidden md:block">
      <div className="sticky top-20 p-4 glass-card rounded-2xl border border-white/10 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Workspace Navigation
        </div>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-brand-600/20 text-brand-400 border border-brand-500/30 shadow-lg shadow-brand-500/10"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <div className="pt-4 mt-4 border-t border-slate-800/80">
          <div className="px-3 py-2 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Grid Node: Active
            </span>
            <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
