// =============================================================================
// Circular Waste Marketplace — API Types & DTOs
// =============================================================================

export type Role = "GENERATOR" | "RECYCLER" | "LOGISTICS" | "ADMIN";
export type UserRole = Role; // Alias for backward compatibility

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  organization_name?: string | null;
  phone_number?: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at?: string;
  last_login_at?: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number; // Seconds until access token expires
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role: "GENERATOR" | "RECYCLER" | "LOGISTICS";
  organization_name?: string | null;
  phone_number?: string | null;
}

export interface LoginRequest {
  email?: string;
  phone_number?: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface UpdateMeRequest {
  full_name?: string;
  organization_name?: string | null;
  phone_number?: string | null;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// RFC-7807 Problem Details shape returned by backend
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string | Array<{ loc?: string[]; msg?: string; type?: string }>;
  instance?: string;
  request_id?: string;
  errors?: Array<{ loc: string[]; msg: string; type: string }>;
}

export interface NormalizedApiError {
  code: number;
  title: string;
  detail: string;
  requestId?: string;
  retryAfter?: number;
  fieldErrors?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain & Marketplace Types (Preserved for Subsequent Segments)
// ─────────────────────────────────────────────────────────────────────────────

export type WastePurityGrade = "GRADE_A" | "GRADE_B" | "GRADE_C" | "CONTAMINATED";
export type WasteBatchStatus = string; // Free-form from backend (SUBMITTED | AI_ANALYZED | etc.)

export type IntakeStatus =
  | "SUBMITTED"
  | "AI_ANALYZED"
  | "PICKUP_SCHEDULED"
  | "IN_TRANSIT"
  | "ARRIVED_AT_SORTER"
  | "SORTED_VERIFIED"
  | "SETTLED"
  | "REJECTED";

export type ListingStatus = "ACTIVE" | "HELD" | "SOLD" | "CANCELLED";

export interface WasteCategory {
  id: number;
  code: string;
  name: string;
  unit_of_measure: string;
  carbon_offset_factor: number;
  is_active?: boolean;
}

export interface ImageQualityCheck {
  ok: boolean;
  score: number;
  reasons: string[];
  blur_score: number;
  brightness: number;
  width: number;
  height: number;
}

// Segment 2.1b — full WasteIntake response shape from backend
export interface WasteIntake {
  id: string;
  batch_code: string;
  supplier_id: string;
  category: WasteCategory;
  purity_grade: string;
  declared_weight_kg: number;
  verified_weight_kg: number | null;
  weight_discrepancy_kg: number | null;
  status: WasteBatchStatus;
  qr_code_hash: string;
  image_paths: string[];
  notes: string | null;
  scale_operator_id: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface IntakeCreateRequest {
  category_id: number;
  purity_grade: string;
  declared_weight_kg: number;
  notes?: string;
}

export interface QRCodeResponse {
  intake_id: string;
  batch_code: string;
  qr_code_data_url: string;
  manifest_signature: string;
  verification_url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier Profile Types — Segment 2.1b
// ─────────────────────────────────────────────────────────────────────────────

export interface SupplierProfile {
  id: string;
  user_id: string;
  business_name: string;
  registration_number: string;
  facility_address: string;
  latitude: number;
  longitude: number;
  contact_phone: string;
  verification_status: string;
  created_at: string;
}

export interface SupplierProfileCreateRequest {
  business_name: string;
  registration_number: string;
  facility_address: string;
  latitude: number;
  longitude: number;
  contact_phone: string;
}

export interface PricingQuote {
  category_code: string;
  purity_grade: WastePurityGrade;
  base_benchmark_price_per_kg: number;
  floor_price_per_kg: number;
  ceiling_price_per_kg: number;
  moisture_penalty_applied: number;
  contamination_penalty_applied: number;
  effective_price_per_kg: number;
  effective_from?: string;
}

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  category_id: number;
  title: string;
  purity_grade: WastePurityGrade;
  quantity_kg: number;
  price_per_kg: number;
  status: ListingStatus;
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  notes?: string;
  category?: WasteCategory;
  created_at: string;
}

export interface EcoStoreProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  stock_quantity: number;
  category: string;
  unit: string;
  weight_kg: number;
  image_url?: string;
}

export interface RewardWallet {
  points_balance: number;
  lifetime_points: number;
  streak_days: number;
}

export interface TelemetryPoint {
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  heading_deg?: number;
  battery_pct?: number;
  recorded_at: string;
}
// ─── Segment 2.2 types ───

export interface PickupRequestRead {
  id: string;
  intake_id: string;
  requested_by_user_id: string;
  assigned_driver_user_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_pickup_at: string | null;
  status: "requested" | "accepted" | "en_route" | "arrived" | "picked_up" | "completed" | "cancelled" | "failed";
  cancellation_reason: string | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  intake_summary?: { id: string; batch_code: string; category_name: string };
  driver_summary?: { id: string; full_name: string } | null;
}

export interface WeightTicketRead {
  id: string;
  intake_id: string;
  pickup_request_id: string | null;
  weight_method: "manual" | "demo" | "digital_scale" | "weighbridge";
  gross_weight_kg: number;
  tare_weight_kg: number;
  net_weight_kg: number;
  scale_id: string | null;
  scale_calibration_date: string | null;
  photo_urls: string[];
  recorded_by_user_id: string;
  recorded_at: string;
  discrepancy_flag: boolean;
  discrepancy_notes: string | null;
  notes: string | null;
  supplier_confirmed_at: string | null;
  supplier_dispute_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WasteIntakeListItem {
  id: string;
  batch_code: string;
  supplier_id: string;
  category: WasteCategory;
  purity_grade: string;
  declared_weight_kg: number;
  verified_weight_kg: number | null;
  weight_discrepancy_kg: number | null;
  status: string;
  qr_code_hash: string;
  image_paths: string[];
  notes: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface IntakeListResponse {
  items: WasteIntakeListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface PickupListResponse {
  items: PickupRequestRead[];
  total: number;
  limit: number;
  offset: number;
}
