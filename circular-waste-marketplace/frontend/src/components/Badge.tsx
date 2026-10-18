import React from "react";
import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "purple";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  className,
}) => {
  const styles = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    neutral: "bg-slate-800 text-slate-300 border-slate-700",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  };

  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1 font-medium",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border tracking-wide uppercase font-semibold",
        styles[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
};
