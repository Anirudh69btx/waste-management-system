export type UserRole = "GENERATOR" | "RECYCLER" | "LOGISTICS" | "ADMIN";

export type WastePurityGrade = "GRADE_A" | "GRADE_B" | "GRADE_C" | "CONTAMINATED";

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

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_name?: string;
  phone_number?: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface WasteCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  base_price_per_kg: number;
  is_active: boolean;
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

export interface WasteIntake {
  id: string;
  batch_code: string;
  supplier_id: string;
  category_id: number;
  purity_grade: WastePurityGrade;
  declared_weight_kg: number;
  verified_weight_kg?: number;
  weight_discrepancy_kg?: number;
  status: IntakeStatus;
  qr_code_hash: string;
  image_paths: string[];
  notes?: string;
  created_at: string;
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
