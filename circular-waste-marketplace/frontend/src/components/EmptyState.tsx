import React from "react";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: "primary" | "secondary";
}

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ElementType;
  title: string;
  description?: string;
  action?: EmptyStateAction | React.ReactNode;
  variant?: "compact" | "full";
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  variant = "full",
  className = "",
}) => {
  const isCompact = variant === "compact";

  const renderIcon = () => {
    if (!icon) {
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400">
          <Inbox className="h-6 w-6 text-brand-400" />
        </div>
      );
    }
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComp = icon as React.ElementType;
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400">
        <IconComp className="h-6 w-6 text-brand-400" />
      </div>
    );
  };

  const renderAction = () => {
    if (!action) return null;
    if (React.isValidElement(action)) return action;

    const actionObj = action as EmptyStateAction;
    const isPrimary = actionObj.variant !== "secondary";
    const btnClasses = isPrimary
      ? "inline-flex items-center justify-center rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-brand-400 shadow-md shadow-brand-500/20"
      : "inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800";

    if (actionObj.to) {
      return (
        <Link to={actionObj.to} className={btnClasses}>
          {actionObj.label}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={actionObj.onClick}
        className={btnClasses}
      >
        {actionObj.label}
      </button>
    );
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        isCompact
          ? "p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40"
          : "p-12 rounded-3xl border border-slate-800 bg-slate-900/50 shadow-sm"
      } ${className}`}
    >
      <div className="mb-4">{renderIcon()}</div>
      <h3
        className={`font-semibold text-white tracking-tight ${
          isCompact ? "text-sm" : "text-base"
        }`}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`mt-1.5 text-slate-400 max-w-sm leading-relaxed ${
            isCompact ? "text-xs" : "text-sm"
          }`}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-5">{renderAction()}</div>}
    </div>
  );
};

export default EmptyState;
