import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Recycle, Mail, Phone, ArrowRight, ShieldCheck } from "lucide-react";

import { login as apiLogin } from "@/api/auth";
import { NormalizedApiError } from "@/api/types";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { PasswordField } from "@/components/PasswordField";
import { CheckboxField } from "@/components/CheckboxField";
import { useAuthStore } from "../store";
import { DemoLoginPanel } from "../components/DemoLoginPanel";

const emailLoginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid corporate email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

const phoneLoginSchema = z.object({
  phone_number: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^\+?[1-9]\d{6,14}$/, "Phone number must be in E.164 format (e.g. +1234567890)"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type EmailLoginFormValues = z.infer<typeof emailLoginSchema>;
type PhoneLoginFormValues = z.infer<typeof phoneLoginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  const state = location.state as { from?: string } | null;
  const redirectTarget = state?.from || "/dashboard";

  // Countdown timer for 429 rate limit
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const interval = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitCountdown]);

  // Email form
  const emailForm = useForm<EmailLoginFormValues>({
    resolver: zodResolver(emailLoginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  // Phone form
  const phoneForm = useForm<PhoneLoginFormValues>({
    resolver: zodResolver(phoneLoginSchema),
    mode: "onBlur",
    defaultValues: { phone_number: "", password: "", rememberMe: false },
  });

  const isSubmitting =
    authMode === "email"
      ? emailForm.formState.isSubmitting
      : phoneForm.formState.isSubmitting;

  const handleLoginError = (err: unknown) => {
    const error = err as NormalizedApiError;

    if (error.code === 429) {
      const waitSeconds = error.retryAfter || 60;
      setRateLimitCountdown(waitSeconds);
      toast.error(`Too many attempts. Try again in ${waitSeconds}s`, { duration: 5000 });
      return;
    }

    if (error.code === 401) {
      toast.error("Invalid email or password", { duration: 5000 });
      return;
    }

    if (error.code >= 500) {
      const ref = error.requestId ? ` (Ref: ${error.requestId.slice(0, 8)})` : "";
      toast.error(`Something went wrong. Reference: ${error.requestId || "internal"}${ref}`, {
        duration: 5000,
      });
      return;
    }

    toast.error(error.detail || "Authentication failed. Please verify your credentials.", {
      duration: 5000,
    });
  };

  const onSubmitEmail = async (values: EmailLoginFormValues) => {
    try {
      const authResult = await apiLogin({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      setAuth(authResult.user, authResult.tokens);
      toast.success(`Welcome back, ${authResult.user.full_name}!`);
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      handleLoginError(err);
    }
  };

  const onSubmitPhone = async (values: PhoneLoginFormValues) => {
    try {
      const authResult = await apiLogin({
        phone_number: values.phone_number.trim(),
        password: values.password,
      });
      setAuth(authResult.user, authResult.tokens);
      toast.success(`Welcome back, ${authResult.user.full_name}!`);
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      handleLoginError(err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base relative overflow-hidden text-text-primary">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <main className="max-w-[420px] w-full glass-card rounded-2xl p-7 border border-border-subtle relative z-10 shadow-2xl">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-brand-gradient p-0.5 shadow-lg shadow-brand-500/20 mb-3">
            <div className="w-full h-full bg-bg-base rounded-[10px] flex items-center justify-center">
              <Recycle className="h-6 w-6 text-brand-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="text-xs text-text-secondary mt-1">Sign in to your circular exchange account</p>
        </div>

        {/* Login Method Toggle (Email vs Phone) */}
        <div className="flex rounded-xl bg-bg-elevated p-1 mb-5 border border-border-subtle" role="tablist" aria-label="Sign in method">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "email"}
            onClick={() => {
              setAuthMode("email");
              emailForm.clearErrors();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === "email"
                ? "bg-brand-500 text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Corporate Email</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "phone"}
            onClick={() => {
              setAuthMode("phone");
              phoneForm.clearErrors();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              authMode === "phone"
                ? "bg-brand-500 text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Phone (E.164)</span>
          </button>
        </div>

        {/* Form Body */}
        {authMode === "email" ? (
          <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4" noValidate>
            <TextField
              label="Corporate Email"
              type="email"
              autoComplete="email"
              placeholder="operator@enterprise.com"
              icon={<Mail className="h-4 w-4" />}
              error={emailForm.formState.errors.email?.message}
              {...emailForm.register("email")}
            />

            <PasswordField
              label="Password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              error={emailForm.formState.errors.password?.message}
              {...emailForm.register("password")}
            />

            <div className="flex items-center justify-between pt-1">
              <CheckboxField
                label="Remember session"
                {...emailForm.register("rememberMe")}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={isSubmitting}
              disabled={rateLimitCountdown !== null}
            >
              {rateLimitCountdown !== null ? (
                <span>Try again in {rateLimitCountdown}s</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={phoneForm.handleSubmit(onSubmitPhone)} className="space-y-4" noValidate>
            <TextField
              label="E.164 Phone Number"
              type="tel"
              autoComplete="tel"
              placeholder="+1234567890"
              icon={<Phone className="h-4 w-4" />}
              helperText="Include country code (+1, +91, etc.)"
              error={phoneForm.formState.errors.phone_number?.message}
              {...phoneForm.register("phone_number")}
            />

            <PasswordField
              label="Password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              error={phoneForm.formState.errors.password?.message}
              {...phoneForm.register("password")}
            />

            <div className="flex items-center justify-between pt-1">
              <CheckboxField
                label="Remember session"
                {...phoneForm.register("rememberMe")}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={isSubmitting}
              disabled={rateLimitCountdown !== null}
            >
              {rateLimitCountdown !== null ? (
                <span>Try again in {rateLimitCountdown}s</span>
              ) : (
                <>
                  <span>Sign In with Phone</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {/* Demo One-Click Sign-In Panel (only rendered when VITE_DEMO_MODE="true") */}
        <DemoLoginPanel />

        {/* Footer Navigation */}
        <div className="mt-6 pt-5 border-t border-border-subtle text-center text-xs text-text-secondary">
          <span>Don't have an industrial account? </span>
          <Link to="/register" className="font-semibold text-brand-400 hover:text-brand-300 underline underline-offset-4">
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
};
