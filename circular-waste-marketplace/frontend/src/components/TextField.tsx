import React, { forwardRef, useId } from "react";
import clsx from "clsx";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, helperText, icon, id, className, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const describedBy = clsx(
      error && errorId,
      helperText && !error && helperId
    ) || undefined;

    return (
      <div className="w-full space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-text-secondary tracking-wide uppercase"
        >
          {label}
        </label>
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={clsx(
              "w-full rounded-xl bg-bg-surface/90 border text-sm text-text-primary placeholder:text-text-muted transition-all duration-150",
              "focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500",
              icon ? "pl-10 pr-4 py-2.5" : "px-4 py-2.5",
              error
                ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                : "border-border-subtle hover:border-border-strong",
              disabled && "opacity-50 cursor-not-allowed bg-bg-elevated",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger-500 mt-1 animate-fadeIn" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-text-muted mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

TextField.displayName = "TextField";
