import React, { forwardRef, useId } from "react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, options, error, helperText, id, className, disabled, ...props }, ref) => {
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
          <select
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={clsx(
              "w-full rounded-xl bg-bg-surface border text-sm text-text-primary px-4 py-2.5 appearance-none transition-all duration-150",
              "focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500",
              error
                ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                : "border-border-subtle hover:border-border-strong",
              disabled && "opacity-50 cursor-not-allowed bg-bg-elevated",
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-bg-surface text-text-primary py-1">
                {opt.label} {opt.description ? `— ${opt.description}` : ""}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger-500 mt-1" role="alert">
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

SelectField.displayName = "SelectField";
