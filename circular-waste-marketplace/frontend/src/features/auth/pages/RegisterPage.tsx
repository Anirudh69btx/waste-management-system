import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Recycle, Mail, User as UserIcon, Phone, Building, ArrowRight } from "lucide-react";

import { register as apiRegister } from "@/api/auth";
import { NormalizedApiError, Role } from "@/api/types";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { PasswordField } from "@/components/PasswordField";
import { SelectField } from "@/components/SelectField";
import { CheckboxField } from "@/components/CheckboxField";
import { useAuthStore } from "../store";

// Allowed public registration roles (ADMIN is strictly excluded from UI and registration endpoint)
const PUBLIC_ROLES = ["GENERATOR", "RECYCLER", "LOGISTICS"] as const;

const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(120, "Full name must not exceed 120 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid corporate email address"),
    phone_number: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^\+?[1-9]\d{6,14}$/.test(val.trim()),
        "Phone number must be a valid E.164 format (e.g. +1234567890)"
      ),
    role: z.enum(PUBLIC_ROLES, {
      errorMap: () => ({ message: "Please select an industrial marketplace role" }),
    }),
    organization_name: z.string().max(255).optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password must not exceed 128 characters")
      .regex(/[A-Za-z]/, "Password must contain at least one letter")
      .regex(/\d/, "Password must contain at least one numeric digit")
      .refine((v) => v.trim().length > 0, "Password cannot be whitespace only"),
    confirm_password: z.string().min(1, "Please confirm your password"),
    terms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and privacy policy to continue",
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function computePasswordStrength(password: string): {
  score: number;
  label: "Weak" | "Fair" | "Strong";
  colorClass: string;
} {
  if (!password) return { score: 0, label: "Weak", colorClass: "bg-border-subtle" };
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  if (points >= 4) {
    return { score: 3, label: "Strong", colorClass: "bg-brand-500" };
  } else if (points >= 2) {
    return { score: 2, label: "Fair", colorClass: "bg-warning-500" };
  }
  return { score: 1, label: "Weak", colorClass: "bg-danger-500" };
}

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  // Rate-limit countdown timer
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

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: {
      full_name: "",
      email: "",
      phone_number: "",
      role: "GENERATOR",
      organization_name: "",
      password: "",
      confirm_password: "",
      terms: false,
    },
  });

  const selectedRole = watch("role");
  const enteredPassword = watch("password") || "";
  const passwordStrength = useMemo(() => computePasswordStrength(enteredPassword), [enteredPassword]);

  const organizationLabel =
    selectedRole === "LOGISTICS"
      ? "Fleet / Carrier Company Name"
      : selectedRole === "RECYCLER"
      ? "Processing Facility / Recycler Name"
      : "Organization / Farm Name (Optional)";

  const roleOptions = [
    { value: "GENERATOR", label: "Waste Generator", description: "Agri-farms, food processors, industrial plants" },
    { value: "RECYCLER", label: "Recycler / Sorter", description: "Material recovery, bioconversion, aggregators" },
    { value: "LOGISTICS", label: "Logistics Fleet", description: "Haulers, certified freight, independent drivers" },
  ];

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const response = await apiRegister({
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase(),
        phone_number: values.phone_number?.trim() || null,
        role: values.role,
        organization_name: values.organization_name?.trim() || null,
        password: values.password,
      });

      setAuth(response.user, response.tokens);
      toast.success("Account created successfully!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const error = err as NormalizedApiError;

      if (error.code === 409) {
        setError("email", { message: "An account with this email already exists" });
        toast.error("An account with this email already exists", { duration: 5000 });
        return;
      }

      if (error.code === 429) {
        const wait = error.retryAfter || 60;
        setRateLimitCountdown(wait);
        toast.error(`Too many attempts. Try again in ${wait}s`, { duration: 5000 });
        return;
      }

      if (error.fieldErrors) {
        Object.entries(error.fieldErrors).forEach(([field, msg]) => {
          if (field in values) {
            setError(field as keyof RegisterFormValues, { message: msg });
          }
        });
        toast.error("Please verify the marked form fields.", { duration: 5000 });
        return;
      }

      toast.error(error.detail || "Registration failed. Please check your inputs.", { duration: 5000 });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base relative overflow-hidden text-text-primary">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-brand-700/10 rounded-full blur-3xl pointer-events-none" />

      <main className="max-w-[480px] w-full glass-card rounded-2xl p-7 border border-border-subtle relative z-10 shadow-2xl my-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-brand-gradient p-0.5 shadow-lg shadow-brand-500/20 mb-3">
            <div className="w-full h-full bg-bg-base rounded-[10px] flex items-center justify-center">
              <Recycle className="h-6 w-6 text-brand-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
          <p className="text-xs text-text-secondary mt-1">Join the verified industrial circular marketplace</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Full Name */}
          <TextField
            label="Full Name / Representative"
            placeholder="Jane Doe"
            autoComplete="name"
            icon={<UserIcon className="h-4 w-4" />}
            error={errors.full_name?.message}
            {...register("full_name")}
          />

          {/* Email */}
          <TextField
            label="Corporate Email"
            type="email"
            placeholder="jane@enterprise.com"
            autoComplete="email"
            icon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            {...register("email")}
          />

          {/* Phone (Optional) */}
          <TextField
            label="Phone Number (Optional)"
            type="tel"
            placeholder="+1234567890"
            autoComplete="tel"
            icon={<Phone className="h-4 w-4" />}
            helperText="E.164 format with country code"
            error={errors.phone_number?.message}
            {...register("phone_number")}
          />

          {/* Role Selector (Excludes ADMIN) */}
          <SelectField
            label="Marketplace Role"
            options={roleOptions}
            error={errors.role?.message}
            helperText="Determines available intake, trading, and logistics workflows"
            {...register("role")}
          />

          {/* Organization Name */}
          <TextField
            label={organizationLabel}
            placeholder="Green Earth Processing Ltd"
            autoComplete="organization"
            icon={<Building className="h-4 w-4" />}
            error={errors.organization_name?.message}
            {...register("organization_name")}
          />

          {/* Password */}
          <div>
            <PasswordField
              label="Password"
              autoComplete="new-password"
              placeholder="Min. 8 chars with 1 letter & 1 digit"
              error={errors.password?.message}
              {...register("password")}
            />
            {/* Visual Password Strength Indicator */}
            {enteredPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>Strength</span>
                  <span className="font-semibold text-text-secondary">{passwordStrength.label}</span>
                </div>
                <div className="h-1.5 w-full bg-bg-elevated rounded-full overflow-hidden flex gap-1">
                  <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 1 ? passwordStrength.colorClass : "bg-border-subtle"}`} />
                  <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 2 ? passwordStrength.colorClass : "bg-border-subtle"}`} />
                  <div className={`h-full flex-1 rounded-full ${passwordStrength.score >= 3 ? passwordStrength.colorClass : "bg-border-subtle"}`} />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <PasswordField
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            error={errors.confirm_password?.message}
            {...register("confirm_password")}
          />

          {/* Terms Checkbox */}
          <div className="pt-2">
            <CheckboxField
              label={
                <>
                  I agree to the{" "}
                  <Link to="/terms" className="text-brand-400 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-brand-400 hover:underline">
                    Privacy Policy
                  </Link>
                </>
              }
              error={errors.terms?.message}
              {...register("terms")}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full mt-3"
            isLoading={isSubmitting}
            disabled={rateLimitCountdown !== null}
          >
            {rateLimitCountdown !== null ? (
              <span>Try again in {rateLimitCountdown}s</span>
            ) : (
              <>
                <span>Create Marketplace Account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 pt-5 border-t border-border-subtle text-center text-xs text-text-secondary">
          <span>Already have an account? </span>
          <Link to="/login" className="font-semibold text-brand-400 hover:text-brand-300 underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
};
