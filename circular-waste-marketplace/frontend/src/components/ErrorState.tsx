import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  requestId?: string;
  onRetry?: () => void;
  variant?: "inline" | "full";
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description = "An unexpected error occurred while loading this data. Please try again.",
  requestId,
  onRetry,
  variant = "full",
  className = "",
}) => {
  const isInline = variant === "inline";

  if (isInline) {
    return (
      <div
        role="alert"
        className={`flex items-center justify-between gap-3 rounded-xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-xs text-rose-300 ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span className="font-medium text-rose-200">{title}</span>
          {description && <span className="text-rose-400/80 truncate">— {description}</span>}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-800/60 bg-rose-900/40 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/60"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-8 rounded-3xl border border-rose-900/40 bg-rose-950/20 text-center shadow-sm ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-900/30 border border-rose-800/50 text-rose-400 mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-200 tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 text-xs text-rose-300/80 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {requestId && (
        <div className="mt-3">
          <span className="font-mono text-[11px] text-rose-400/60 bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-900/40">
            Req ID: {requestId}
          </span>
        </div>
      )}
      {onRetry && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 shadow-md shadow-rose-950"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorState;
