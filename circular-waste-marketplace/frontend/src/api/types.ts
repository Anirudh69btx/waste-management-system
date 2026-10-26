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

// ─── Segment 3.1 Fleet & GPS types ───

export interface VehicleRead {
  id: string;
  plate_number: string;
  capacity_kg: number;
  fuel_type: string;
  status: string;
  assigned_driver_user_id: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_ping_at: string | null;
  last_ping_source: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreatePayload {
  plate_number: string;
  capacity_kg: number;
  fuel_type?: "petrol" | "diesel" | "electric" | "cng" | "hybrid";
  notes?: string;
}

export interface VehicleUpdatePayload {
  capacity_kg?: number;
  fuel_type?: "petrol" | "diesel" | "electric" | "cng" | "hybrid";
  status?: "available" | "in_use" | "maintenance" | "inactive";
  notes?: string;
}

export interface VehicleListResponse {
  items: VehicleRead[];
  total: number;
}

export interface TripStopRead {
  id: string;
  trip_id: string;
  pickup_request_id: string;
  sequence: number;
  status: string;
  arrived_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  notes: string | null;
}

export interface TripRead {
  id: string;
  vehicle_id: string;
  driver_user_id: string;
  status: string;
  planned_distance_km: number | null;
  actual_distance_km: number | null;
  started_at: string | null;
  ended_at: string | null;
  total_weight_kg: number | null;
  stops: TripStopRead[];
  created_at: string;
  updated_at: string;
}

export interface TripListResponse {
  items: TripRead[];
  total: number;
}

export interface CreateTripStopInput {
  pickup_request_id: string;
  sequence: number;
}

export interface CreateTripPayload {
  vehicle_id: string;
  driver_user_id: string;
  stops: CreateTripStopInput[];
}

export interface VehicleLocationRead {
  vehicle_id: string;
  plate_number: string;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  heading: number | null;
  recorded_at: string | null;
  source: string | null;
  is_simulated: boolean;
}

export interface GpsPingRead {
  id: string;
  vehicle_id: string;
  trip_id: string | null;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  heading: number | null;
  source: string;
  recorded_at: string;
}

export interface RecordPingPayload {
  lat: number;
  lng: number;
  speed_kmh?: number;
  heading?: number;
  trip_id?: string;
}

export interface RouteSuggestionRequest {
  vehicle_id: string;
  max_stops?: number;
}

export interface RouteStopSuggestion {
  pickup_request_id: string;
  supplier_id: string;
  supplier_name: string;
  latitude: number;
  longitude: number;
  waste_stream: string;
  declared_weight_kg: number;
  sequence: number;
  distance_from_prev_km: number;
}

export interface RouteSuggestionResponse {
  vehicle_id: string;
  total_distance_km: number;
  total_weight_kg: number;
  waste_stream: string;
  suggested_stops: RouteStopSuggestion[];
}

// ─── Segment 3.2 types ───

export interface SortingRecordRead {
  id: string;
  intake_id: string;
  sorter_user_id: string;
  input_weight_kg: number;
  sorted_weight_kg: number;
  rejected_weight_kg: number;
  contamination_percent: number;
  sort_grade: "GRADE_A" | "GRADE_B" | "GRADE_C";
  moisture_percent: number | null;
  notes: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface InventoryLotRead {
  id: string;
  lot_code: string;
  intake_id: string;
  sorting_record_id: string;
  category_id: number;
  quantity_kg: number;
  available_kg: number;
  grade: "GRADE_A" | "GRADE_B" | "GRADE_C";
  contamination_percent: number;
  moisture_percent: number | null;
  status: "available" | "reserved" | "sold" | "archived";
  hub_location: string | null;
  created_at: string;
}

export interface InventoryLotCreate {
  category_id: number;
  quantity_kg: number;
  grade: "GRADE_A" | "GRADE_B" | "GRADE_C";
  contamination_percent: number;
  moisture_percent?: number | null;
  hub_location?: string | null;
}

export interface SortingRecordCreate {
  intake_id: string;
  input_weight_kg: number;
  sorted_weight_kg: number;
  rejected_weight_kg: number;
  contamination_percent: number;
  sort_grade: "GRADE_A" | "GRADE_B" | "GRADE_C";
  moisture_percent?: number | null;
  notes?: string | null;
  inventory_lots: InventoryLotCreate[];
}

export interface MarketplaceListingRead {
  id: string;
  seller_id: string;
  category_id: number;
  title: string;
  description: string | null;
  quantity_kg: number;
  available_kg: number;
  price_per_kg: number;
  min_bid_kg: number;
  purity_grade: "GRADE_A" | "GRADE_B" | "GRADE_C";
  status: "active" | "sold" | "cancelled" | "expired";
  inventory_lot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingListResponse {
  items: MarketplaceListingRead[];
  total: number;
}

export interface BidCreate {
  bid_price_per_kg: number;
  quantity_kg: number;
  message?: string | null;
}

export interface BidRead {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  bid_price_per_kg: number;
  quantity_kg: number;
  total_amount: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  created_at: string;
}

export interface BuyNowRequest {
  quantity_kg: number;
}

export interface PurchaseOrderRead {
  id: string;
  order_code: string;
  listing_id: string;
  buyer_user_id: string;
  seller_user_id: string;
  quantity_kg: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  status: "pending_payment" | "escrow_held" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded";
  escrow_held_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  items: PurchaseOrderRead[];
  total: number;
}

export interface TraceabilityEventRead {
  id: string;
  batch_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  metadata_json: Record<string, unknown>;
  request_id: string | null;
  created_at: string;
}

export interface TraceabilityTimelineResponse {
  batch_id: string;
  events: TraceabilityEventRead[];
}

// ─── Segment 3.2b types ───

export interface BidActionRequest {
  note?: string | null;
}

export interface OrderShipRequest {
  tracking_number?: string | null;
  note?: string | null;
}

export interface OrderDeliverRequest {
  note?: string | null;
}

export interface ListingCancelRequest {
  reason?: string | null;
}

export interface SellerInventoryStats {
  total_lots: number;
  total_available_kg: number;
  total_listed_kg: number;
  total_sold_kg: number;
  active_listings: number;
  pending_bids: number;
  open_orders: number;
}

export interface TraceabilityEventDisplay extends TraceabilityEventRead {
  human_label: string;
  icon_name: string;
}

export interface CreateListingFromLotPayload {
  inventory_lot_id: string;
  title: string;
  description?: string | null;
  price_per_kg: number;
  min_bid_kg: number;
}

