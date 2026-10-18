# Architecture Decision Records (ADRs)

Documenting foundational architecture, schema, API, and technology choices for the **Circular Waste & Resource Marketplace**.

---

<a id="ADR-001"></a>
## ADR-001: Selection of FastAPI as Core Backend Framework

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: The marketplace requires rapid asynchronous request processing, automatic OpenAPI/Swagger documentation for rapid solo hackathon iteration, and strict schema validation for multipart forms (waste listings, images, coordinates).
* **Decision**: Adopt **FastAPI** with Python 3.11+ using Uvicorn as ASGI server.
* **Consequences**:
  * *Pros*: Native async support (`async/await`), fast serialization via Pydantic v2, automated interactive API docs at `/docs`.
  * *Cons*: Requires disciplined dependency injection architecture to manage DB sessions cleanly.

---

<a id="ADR-002"></a>
## ADR-002: Containerization Strategy with Multi-Stage Docker & Docker Compose

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Need a reproducible, zero-configuration local development environment across different operating systems for the 8-day sprint.
* **Decision**: Use Docker Compose with multi-stage builds (`python:3.11-slim`), isolating backend runtime, database, and cache services.
* **Services**:
  * `web`: FastAPI backend mapped to port `8000` with hot-reload enabled.
  * `db`: PostgreSQL 15 with PostGIS enabled on port `5432`.
  * `redis`: Lightweight cache/session broker on port `6379`.
* **Consequences**:
  * Ensures uniform environment between local testing and eventual deployment; avoids local dependency conflicts.

---

<a id="ADR-003"></a>
## ADR-003: Primary Datastore: PostgreSQL with PostGIS for Spatial Waste Matching

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Circular waste transactions rely heavily on geographic proximity (e.g., matching a construction site with 5 tonnes of scrap metal to the nearest recycling facility within 25 km).
* **Decision**: Use **PostgreSQL 15+** with the **PostGIS** extension (`postgis/postgis:15-3.3`).
* **Consequences**:
  * Supports spatial indexing (`GiST`) and spatial distance queries (`ST_DWithin`, `ST_DistanceSphere`).
  * Strong ACID transactional guarantees for resource exchange and logistics tracking.

---

<a id="ADR-004"></a>
## ADR-004: Authentication & Multi-Role Authorization via Stateless JWT & Bcrypt

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Secure access control across multiple participant personas: Waste Generators (industrial/commercial), Recyclers/Processors, Logistics Providers, and Platform Admins.
* **Decision**: Implement stateless JSON Web Token (JWT) bearer authentication with SHA-256 / HS256 and Bcrypt password hashing.
* **Roles**:
  * `GENERATOR`: Publishes waste materials & scheduling.
  * `RECYCLER`: Claims resources, bids, and inspects quality reports.
  * `LOGISTICS`: Accepts transit dispatches and logs chain-of-custody.
  * `ADMIN`: Platform moderation, verification, and audit logs.
* **Exact API Endpoints**:
  * `POST /api/v1/auth/register` - User onboarding with role assignment
  * `POST /api/v1/auth/login` - Credential exchange for access & refresh tokens
  * `POST /api/v1/auth/refresh` - Issue new access token from refresh token
  * `GET /api/v1/auth/me` - Retrieve authenticated identity & permissions
* **Database Schema (`users`)**:
  | Column | Type | Constraints |
  | :--- | :--- | :--- |
  | `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` |
  | `email` | VARCHAR(255) | UNIQUE, NOT NULL, INDEX |
  | `hashed_password` | VARCHAR(255) | NOT NULL |
  | `full_name` | VARCHAR(120) | NOT NULL |
  | `role` | VARCHAR(50) | NOT NULL, CHECK in (`GENERATOR`, `RECYCLER`, `LOGISTICS`, `ADMIN`) |
  | `organization_name` | VARCHAR(255) | NULL |
  | `phone_number` | VARCHAR(30) | NULL |
  | `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE |
  | `is_verified` | BOOLEAN | NOT NULL, DEFAULT FALSE |
  | `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
  | `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

---

<a id="ADR-005"></a>
## ADR-005: Schema Migration and Data Access Strategy (SQLAlchemy 2.0 & Alembic)

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Schema evolution must be versioned, reproducible, and non-destructive as marketplace entities expand over the 8-day sprint.
* **Decision**: Adopt **SQLAlchemy 2.0** (Mapped/Declarative pattern) with `asyncpg` engine and **Alembic** migration tracking.
* **Consequences**:
  * Strongly-typed models matching Pydantic schemas.
  * Clean migration history committed directly to version control.

---

<a id="ADR-006"></a>
## ADR-006: Local Filesystem Storage (`static/uploads/`) for MVP Media Assets

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Need immediate photo proof upload functionality for waste consignment intake and supplier KYC verification without spending critical hackathon time on cloud IAM, S3 bucket policies, and presigned URL lifecycles.
* **Decision**: Mount a Docker named volume (`uploads_data`) to `static/uploads/` in the FastAPI backend, utilizing FastAPI `UploadFile` with SHA-256 content-hash filenames.
* **Consequences**:
  * *Pros*: Zero external cloud latency, no AWS billing/credentials setup required for MVP demo.
  * *Cons*: Ephemeral to local volume; non-scalable horizontally without shared storage (S3/GCS); technical debt logged for post-hackathon cloud migration.

---

<a id="ADR-007"></a>
## ADR-007: Server-Side Cryptographically Signed QR Code Generation for Consignment Tracking

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Physical waste batches moving from waste generator sites to recycling sorting centers require tamper-evident manifest verification that works reliably without third-party QR generation APIs.
* **Decision**: Generate QR codes using Python's `qrcode[pil]` with an embedded HMAC-SHA256 signature calculated over the batch ID, supplier ID, and declared weight.
* **Consequences**:
  * *Pros*: Fast, offline-capable verification at checkpoint scales; zero external network reliance.
  * *Cons*: Requires server secret key management (`HMAC_SECRET_KEY`) to validate incoming scans.

---

<a id="ADR-008"></a>
## ADR-008: Two-Stage Weight Verification Pattern (Declared vs. Scaled Tolerance)

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Bulk scrap and industrial waste weights fluctuate between loading and delivery due to water absorption, evaporation, or dishonest declaration.
* **Decision**: Enforce a two-tier verification workflow: `declared_weight_kg` submitted by the generator, and `verified_weight_kg` entered by an authorized weighbridge operator upon arrival. Tolerances within ±5% automatically mark status as `VERIFIED`; discrepancies beyond 5% flag the lot as `FLAGGED_DISCREPANCY`.
* **Consequences**:
  * *Pros*: Prevents inventory falsification, safeguards buyer trust, and establishes transparent dispute audit trails.
  * *Cons*: Requires state transition checks and weighbridge operator role authorization (`POST /api/v1/intake/{id}/verify-weight`).

---

<a id="ADR-009"></a>
## ADR-009: Normalized Material Classification Taxonomy with Purity Grading

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Unstructured text descriptions prevent automated matching with recycler demand and make dynamic pricing impossible.
* **Decision**: Create a standardized `waste_categories` catalog (`PLASTIC_PET`, `PLASTIC_HDPE`, `E_WASTE`, `ORGANIC_BIOMASS`, `FERROUS_METAL`, `NON_FERROUS_METAL`, `TEXTILE`, `PAPER_CARDBOARD`) tied to a 4-tier purity grade (`GRADE_A`, `GRADE_B`, `GRADE_C`, `CONTAMINATED`).
* **Consequences**:
  * *Pros*: Enables automated pricing algorithms and exact carbon offset calculations (`kg CO2e` avoided per kg recycled).
  * *Cons*: Strict taxonomy requires administrative onboarding if new hybrid materials are introduced.

---

<a id="ADR-010"></a>
## ADR-010: Dual Identifier Scheme: UUIDv4 Relations with Human-Readable Batch Codes

* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Standard UUIDv4 values are unwieldy for truck drivers, physical print manifests, and radio communication between scale operators.
* **Decision**: Maintain standard UUIDv4 for internal database foreign keys while generating a deterministic, collision-checked human-friendly code: `BATCH-YYYYMMDD-[4-HEX-CHAR]` (e.g., `BATCH-20261017-A4F1`).
* **Consequences**:
  * *Pros*: Easy verbal and physical verification while maintaining database referential integrity.
  * *Cons*: Secondary unique constraint and collision retry handler required during intake generation.

---

# Day 3: GPS Tracking & AI Integration

<a id="ADR-011"></a>
## ADR-011: Telemetry & Vehicle GPS Tracking Architecture (Leaflet + OpenStreetMap with Simulated Pings)

* **Title**: Selection of Leaflet + OpenStreetMap with Ingested GPS Telemetry and WebSocket Broadcast for Live Transit Tracking
* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: The marketplace requires live transit tracking for chain-of-custody verification of recyclable waste between generators, sorting hubs, and recyclers. However, as a solo developer in an 8-day hackathon, there is zero budget for commercial Google Maps Platform or Mapbox APIs, and fleet vehicles lack physical OBD-II GPS telematics hardware.
* **Decision**: Adopt open-source **Leaflet.js** paired with free **OpenStreetMap (OSM)** tiles on the frontend, backed by a FastAPI REST telemetry ingestion endpoint (`POST /api/v1/tracking/ping`) and a WebSocket broadcast channel (`/ws/tracking/{transit_id}`). For testing and live demonstration, a background telemetry simulator (`scripts/simulate_transit.py`) streams realistic geographic coordinate pings along predefined logistics routes.
* **Consequences**:
  * *Trade-offs*:
    * **What becomes easier**: Completely free with zero billing risk or API credit limits during hackathon demos. Lightweight frontend bundle (<40 KB Leaflet core) with no heavy vendor SDKs. Deterministic simulation script allows reliable offline presentations to judges without requiring physical driving.
    * **What becomes harder**: Lacks automated turn-by-turn road snapping and real-time traffic-aware dynamic ETA recalculation. Excessive zoom requests on public OSM tile servers can encounter rate-limiting if tile caching is not configured.
* **Compliance/Notes**:
  * *Driver & Facility Privacy*: Exact GPS telemetry pings are only collected and broadcast when a transit order is actively in progress (`status = 'IN_TRANSIT'`). Coordinate streaming automatically ceases the moment arrival weigh-in is validated (`status = 'ARRIVED'`).
  * *Audit Retention*: Telemetry pings are retained for 30 days for regulatory chain-of-custody and carbon savings certification, after which raw pings are downsampled into simplified polyline geometries (`ST_Simplify`).
* **Exact API Endpoints**:
  * `POST /api/v1/tracking/ping` - Ingest single vehicle GPS coordinate ping from driver device or simulator
  * `GET /api/v1/tracking/{transit_id}/trail` - Retrieve chronological coordinate trail for transit route visualization
  * `WS /ws/tracking/{transit_id}` - WebSocket subscription for sub-second vehicle location updates
* **Exact Database Schema**:
  ```sql
  CREATE TABLE waste_transits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      intake_id UUID NOT NULL REFERENCES waste_intakes(id) ON DELETE RESTRICT,
      logistics_provider_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      origin_facility_address TEXT NOT NULL,
      origin_lat DOUBLE PRECISION NOT NULL,
      origin_lon DOUBLE PRECISION NOT NULL,
      destination_facility_address TEXT NOT NULL,
      destination_lat DOUBLE PRECISION NOT NULL,
      destination_lon DOUBLE PRECISION NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, IN_TRANSIT, ARRIVED, DELIVERED, CANCELLED
      departed_at TIMESTAMPTZ NULL,
      arrived_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE vehicle_telemetry (
      id BIGSERIAL PRIMARY KEY,
      transit_id UUID NOT NULL REFERENCES waste_transits(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      altitude_meters DOUBLE PRECISION NULL,
      speed_kmh DOUBLE PRECISION NULL,
      heading_degrees DOUBLE PRECISION NULL,
      battery_level DOUBLE PRECISION NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_telemetry_transit_time ON vehicle_telemetry(transit_id, recorded_at DESC);
  ```

---

<a id="ADR-012"></a>
## ADR-012: AI Waste Quality Assessment & Contamination Classification Pipeline

* **Title**: Asynchronous AI Waste Quality & Contamination Classification using Multimodal Vision Inference (Zero-GPU Architecture)
* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Circular recycling facilities experience severe operational downtime when received waste shipments contain hidden contaminants (e.g., PVC inside PET flakes, industrial hazardous liquids, food residue on paper). Manual visual grading at weighbridges is slow, error-prone, and contentious. However, training and serving custom PyTorch/YOLO object detection models locally inside Docker requires GPU-enabled host machines, ballooning cloud deployment costs and slowing build iteration for a solo hackathon sprint.
* **Decision**: Implement a serverless multimodal Vision classification pipeline using cloud multimodal LLM/Vision inference (Google Gemini 1.5 Flash Vision API) triggered asynchronously via FastAPI `BackgroundTasks`. Uploaded consignment photos are analyzed for material class verification, purity percentage ($0\% - 100\%$), contamination indicators, and an automated recyclability confidence score ($0.0 - 1.0$), stored in `waste_assessments`.
* **Consequences**:
  * *Trade-offs*:
    * **What becomes easier**: Zero local GPU compute infrastructure required; Docker image remains ultra-lightweight (<200MB Python-slim). Exceptional zero-shot visual reasoning over complex, multi-material industrial scrap without maintaining custom labeled training sets.
    * **What becomes harder**: Network call dependency on external API; API throttling or latency (2-4 seconds) requires asynchronous decoupling so intake form submission remains non-blocking.
* **Compliance/Notes**:
  * *Image EXIF Sanitization*: All photo uploads pass through `Pillow` to strip GPS EXIF metadata, camera serial numbers, and device footprints prior to dispatching images to the external Vision API, preserving facility physical privacy.
  * *Human-in-the-Loop Safeguard*: AI classification outputs serve strictly as an advisory score and risk alert. AI predictions never autonomously reject a shipment; they flag high-risk batches for supervisor physical spot-checks.
* **Exact API Endpoints**:
  * `POST /api/v1/ai/inspect/{intake_id}` - Dispatch background visual quality analysis task
  * `GET /api/v1/ai/assessment/{intake_id}` - Fetch AI classification report, contamination score, and visual tags
* **Exact Database Schema**:
  ```sql
  CREATE TABLE waste_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      intake_id UUID NOT NULL UNIQUE REFERENCES waste_intakes(id) ON DELETE CASCADE,
      detected_category VARCHAR(100) NOT NULL,
      confidence_score DOUBLE PRECISION NOT NULL, -- 0.0 to 1.0
      estimated_purity_percentage DOUBLE PRECISION NOT NULL, -- 0 to 100%
      contamination_detected BOOLEAN NOT NULL DEFAULT FALSE,
      contamination_details JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g., ["foreign_metals", "moisture"]
      suggested_purity_grade VARCHAR(20) NOT NULL, -- GRADE_A, GRADE_B, GRADE_C, REJECT
      raw_ai_response JSONB NOT NULL,
      model_version VARCHAR(50) NOT NULL DEFAULT 'gemini-1.5-flash',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_assessments_intake ON waste_assessments(intake_id);
  CREATE INDEX idx_assessments_contamination ON waste_assessments(contamination_detected);
  ```

---

# Day 4: Sorting, B2B Marketplace & Pricing Engine

<a id="ADR-013"></a>
## ADR-013: Inventory Lot Allocation & Escrow-Backed Purchase Order State Machine

* **Title**: Two-Phase Inventory Lot Allocation with Escrow-Backed Purchase Order State Machine
* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: In physical circular waste trading, raw sorted inventory (`inventory_lots`) cannot simply be marked "sold" immediately upon offer creation. Multiple buyers may bid on the same physical lot, and inventory mass must be reserved (`reserved_quantity_kg`) without double-allocating while payment or escrow authorization is verified.
* **Decision**: Implement a two-phase transactional reservation workflow inside PostgreSQL transactions with row-level locking (`SELECT ... FOR UPDATE`):
  1. Placing an active bid or initializing checkout transfers mass from `available_quantity_kg` to `reserved_quantity_kg`.
  2. If the purchase order transitions to `ESCROW_HELD`, `reserved_quantity_kg` is permanently deducted from `initial_quantity_kg` and allocated to the order.
  3. If payment fails, order is cancelled, or bid expires, the reserved mass is rolled back into `available_quantity_kg`.
* **Consequences**:
  * *Trade-offs*:
    * **What becomes easier**: Eliminates double-selling of high-demand scrap lots across competing buyers. Guarantees transactional consistency for physical inventory.
    * **What becomes harder**: Requires strict database lock timeouts and an automated background cron/celery worker to release expired reservations if buyers abandon checkout.
* **Compliance/Notes**:
  * *Financial Escrow Integrity*: Purchase orders lock platform fees and seller receivables into escrow states (`payment_status = 'ESCROW_HELD'`), releasing funds to the seller only upon delivery weigh-in confirmation (`fulfillment_status = 'DELIVERED'`).
* **Exact API Endpoints**:
  * `POST /api/v1/marketplace/listings` - Publish sorted inventory lot to marketplace
  * `POST /api/v1/marketplace/bids` - Submit buyer offer and reserve lot allocation
  * `POST /api/v1/marketplace/orders/checkout` - Create binding purchase order with escrow allocation
* **Database Tables**: [`marketplace_listings`](file:///c:/Users/danny/OneDrive/Documents/coding/sociothon-waste-management/04_Backend_Database_Schema_Reference.md#34-marketplace_listings), [`bids`](file:///c:/Users/danny/OneDrive/Documents/coding/sociothon-waste-management/04_Backend_Database_Schema_Reference.md#35-bids), [`purchase_orders`](file:///c:/Users/danny/OneDrive/Documents/coding/sociothon-waste-management/04_Backend_Database_Schema_Reference.md#36-purchase_orders).

---

<a id="ADR-014"></a>
## ADR-014: Algorithmic Price Floor and Dynamic Penalty Engine for Circular Commodities

* **Title**: Dynamic Pricing Engine with Purity and Moisture Penalty Deduction Rules
* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Scrap material values fluctuate dramatically based on physical quality metrics (e.g., moisture, dirt, foreign polymers). Allowing suppliers to arbitrarily price low-grade waste or buyers to underbid recyclers leads to market breakdown and abandoned shipments.
* **Decision**: Adopt a centralized rules engine (`pricing_rules`) that algorithmically calculates minimum acceptable floor prices and suggested asking prices based on:
  $$\text{Effective Price} = \text{Base Benchmark} \times (1 - (\Delta\text{Moisture} \times M_{\text{penalty}}) - (\Delta\text{Contamination} \times C_{\text{penalty}}))$$
  Where listings below `floor_price_per_kg` are rejected by the API validator.
* **Consequences**:
  * *Trade-offs*:
    * **What becomes easier**: Enforces rational market pricing, protects recyclers from overpaying for contaminated material, and standardizes valuation across all sellers.
    * **What becomes harder**: Administrators must calibrate benchmark prices and penalty multipliers per material category.
* **Compliance/Notes**:
  * *Fair Market Trading*: Transparency guarantees require showing both raw benchmark index price and applied quality deductions to both buyer and seller on listing and invoice views.
* **Exact API Endpoints**:
  * `GET /api/v1/pricing/quote` - Calculate suggested pricing and floor price based on material category, grade, and moisture
  * `GET /api/v1/pricing/rules` - Retrieve active commodity pricing rules
* **Database Tables**: [`pricing_rules`](file:///c:/Users/danny/OneDrive/Documents/coding/sociothon-waste-management/04_Backend_Database_Schema_Reference.md#33-pricing_rules).

---

# Day 6: Premium Commercial Website, Dashboards & B2C Eco-Store

<a id="ADR-015"></a>
## ADR-015: Green Rewards Points Ledger Architecture & Double-Spending Prevention

* **Title**: Double-Entry Ledger Accounting for Green Points Redemption with Database Concurrency Controls
* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: Waste suppliers accrue "Green Points" for segregated high-purity waste deliveries, which can be redeemed for discounts in the B2C Eco-Store. Because points represent monetary value (e.g. 100 points = $1.00), concurrent checkout requests across multiple browser tabs could allow users to double-spend points if balances are read and updated without transactional isolation.
* **Decision**: Implement a double-entry ledger system using `reward_wallets` (tracking current available balance) and `reward_transactions` (immutable append-only transaction ledger). Point redemption operations execute inside an atomic PostgreSQL transaction with row-level locking (`SELECT available_points FROM reward_wallets WHERE user_id = :uid FOR UPDATE`).
* **Consequences**:
  * *Trade-offs*:
    * **What becomes easier**: Strict financial integrity; prevents overdrafts, duplicate redemptions, and race conditions. Provides a complete, verifiable audit trail for ESG regulators and accountants.
    * **What becomes harder**: Requires careful handling of lock timeouts; checkout transactions hold a row lock on the user's wallet until payment authorization confirms or rolls back.
* **Compliance/Notes**:
  * *Anti-Fraud Safeguards*: Maximum points redemption is capped at 50% of the gross order total to prevent platform drainage. All conversion rates ($100\text{ pts} = \$1.00$) are strictly evaluated server-side.
* **Exact API Endpoints**:
  * `GET /api/v1/rewards/wallet` - Retrieve wallet balance and ledger history
  * `POST /api/v1/eco-store/cart/validate` - Server-side cart validation and discount computation
* **Database Tables**: [`reward_wallets`](file:///c:/Users/danny/OneDrive/Documents/coding/sociothon-waste-management/04_Backend_Database_Schema_Reference.md#51-reward_wallets), [`reward_transactions`](file:///c:/Users/danny/OneDrive/Documents/coding/sociothon-waste-management/04_Backend_Database_Schema_Reference.md#52-reward_transactions).

---

<a id="ADR-016"></a>
## ADR-016: Sandboxed Mock UPI Payment Gateway Architecture for Commercial Demo

* **Title**: Simulated UPI / Card Payment Gateway Architecture with Deterministic Testing Triggers
* **Status**: Accepted
* **Date**: 2026-10-17
* **Context**: For hackathon evaluation, judges must experience the complete end-to-end commercial flow of purchasing upcycled goods and redeeming rewards. However, integrating live production payment gateways (e.g. Razorpay, Stripe, or PhonePe) requires corporate banking registration, KYC verification, merchant credentials, and actual debit cards.
* **Decision**: Develop an in-house Sandboxed Payment Simulator (`/api/v1/payments/*`) that generates authentic dynamic UPI QR codes and provides a modal interface with both standard payment polling and an explicit "Simulate Instant Payment Success" action button for judges.
* **Consequences**:
  * *Trade-offs*:
    * **What becomes easier**: 100% reliable demo execution without relying on third-party bank OTPs, merchant webhooks, or test sandbox downtime. Judges can test multiple order lifecycles in seconds.
    * **What becomes harder**: Must be replaced with an official payment aggregator SDK prior to real-world commercial launch.
* **Compliance/Notes**:
  * *Security Demarcation*: The payment simulation service runs in an isolated router, with strict validation ensuring mock endpoints cannot be triggered on production environment flags (`ENVIRONMENT != 'production'`).
* **Exact API Endpoints**:
  * `POST /api/v1/eco-store/orders/checkout` - Create pending order and payment intent
  * `POST /api/v1/payments/mock-webhook` - Simulate gateway success/failure callback
* **Database Tables**: [`eco_orders`](file:///c:/Users/danny/OneDrive/Documents/coding/sociothon-waste-management/04_Backend_Database_Schema_Reference.md#54-eco_orders).




