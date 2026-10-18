import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Recycle,
  Sparkles,
  Flame,
  Globe,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/authStore";
import { UserRole } from "@/api/types";
import { Badge } from "@/components/Badge";

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, logout, demoLogin } = useAuthStore();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language === "en" ? "hi" : "en";
    i18n.changeLanguage(nextLang);
  };

  const roleColors: Record<UserRole, "success" | "info" | "warning" | "purple"> = {
    GENERATOR: "success",
    RECYCLER: "info",
    LOGISTICS: "warning",
    ADMIN: "purple",
  };

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Recycle className="h-5 w-5 text-brand-400" />
              </div>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Circular<span className="text-brand-400">Waste</span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded border border-brand-500/30">
                  Marketplace
                </span>
              </span>
            </div>
          </Link>

          {/* Center: Live Role Switcher (Crucial for Pair Programming & Review) */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 hover:border-brand-500/50 transition-colors text-xs font-medium text-slate-200"
              title="Switch demo persona to test different role workflows"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
              <span>Persona:</span>
              <Badge variant={user ? roleColors[user.role] : "neutral"} size="sm">
                {user?.role || "GUEST"}
              </Badge>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl glass-card border border-white/10 bg-slate-900/95 shadow-2xl p-1.5 z-50">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Role
                </div>
                {(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      demoLogin(r);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg text-left transition-colors ${
                      user?.role === r ? "bg-brand-500/20 text-brand-300 font-semibold" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{t(`roles.${r}`)}</span>
                    <Badge variant={roleColors[r]} size="sm">
                      {r}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Gamified Stats, Language Toggle & User Menu */}
          <div className="flex items-center gap-3">
            {/* Eco Points Chip */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>1,250 pts</span>
              <span className="text-slate-500">|</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Flame className="h-3 w-3 fill-amber-400" /> 14d streak
              </span>
            </div>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              title="Switch language (EN/HI)"
            >
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span>{i18n.language.toUpperCase()}</span>
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-tight">
                  {user?.full_name || "Guest"}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                  {user?.organization_name || user?.email}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
                title={t("nav.logout")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
