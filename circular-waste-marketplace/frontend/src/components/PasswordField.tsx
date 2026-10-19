import React, { forwardRef, useId, useState } from "react";
import clsx from "clsx";
import { Eye, EyeOff, Lock } from "lucide-react";

export interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  helperText?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, helperText, id, className, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const [showPassword, setShowPassword] = useState(false);

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
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            <Lock className="h-4 w-4" />
          </div>
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? "text" : "password"}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={clsx(
              "w-full rounded-xl bg-bg-surface/90 border text-sm text-text-primary placeholder:text-text-muted transition-all duration-150 pl-10 pr-11 py-2.5",
              "focus:outline-none focus:ring-1 focus:border-brand-500 focus:ring-brand-500",
              error
                ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                : "border-border-subtle hover:border-border-strong",
              disabled && "opacity-50 cursor-not-allowed bg-bg-elevated",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary focus:outline-none focus:text-brand-400 rounded-lg transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
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

PasswordField.displayName = "PasswordField";
