import React, { forwardRef, useId } from "react";
import clsx from "clsx";

export interface CheckboxFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  error?: string;
  helperText?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, error, helperText, id, className, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full space-y-1">
        <label htmlFor={inputId} className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={clsx(
              "mt-0.5 h-4 w-4 rounded bg-bg-surface border border-border-subtle text-brand-500",
              "focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-bg-base",
              "checked:bg-brand-500 checked:border-brand-500 transition-colors cursor-pointer",
              error && "border-danger-500",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            {...props}
          />
          <span className="text-xs text-text-secondary leading-snug">
            {label}
          </span>
        </label>
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger-500 pl-6" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

CheckboxField.displayName = "CheckboxField";
