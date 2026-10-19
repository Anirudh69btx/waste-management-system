import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Recycle,
  Globe,
  User as UserIcon,
  LogOut,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuthStore } from "@/features/auth/store";
import { logout as apiLogout } from "@/api/auth";
import { Role } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshToken, isAuthenticated, clearAuth } = useAuthStore();
  const authed = isAuthenticated();

  const toggleLanguage = () => {
    const nextLang = i18n.language === "en" ? "hi" : "en";
    i18n.changeLanguage(nextLang);
  };

  const roleColors: Record<Role, "success" | "info" | "warning" | "purple"> = {
    GENERATOR: "success",
    RECYCLER: "info",
    LOGISTICS: "warning",
    ADMIN: "purple",
  };

  const handleLogout = () => {
    apiLogout(refreshToken).catch(() => {});
    clearAuth();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-border-subtle bg-bg-base/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-brand-gradient p-0.5 shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-bg-base rounded-[10px] flex items-center justify-center">
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

          {/* Right Navigation & User Controls */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-white hover:bg-bg-elevated transition-colors border border-transparent hover:border-border-subtle"
              title="Switch language (EN/HI)"
            >
              <Globe className="h-3.5 w-3.5 text-text-muted" />
              <span>{i18n.language.toUpperCase()}</span>
            </button>

            {authed && user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-border-subtle">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-secondary">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-text-primary leading-tight flex items-center gap-1.5">
                      <span>{user.full_name}</span>
                      <Badge variant={roleColors[user.role]} size="sm">
                        {user.role}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-text-muted truncate max-w-[140px]">
                      {user.organization_name || user.email}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-text-muted hover:text-danger-500 hover:bg-danger-500/10 rounded-lg transition-colors"
                  title="Sign out of marketplace"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    <span>Sign In</span>
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    <span>Get Started</span>
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
