# Key Architectural Decisions Log

This document provides a chronological audit log of all technical, architectural, and design trade-offs made during the development of the **Circular Waste & Resource Marketplace**.

---

## Segment 1: Day 1 - Base Foundation, Docker & Auth

### 1. Backend Framework Selection
- **Decision:** Selected **FastAPI** (Python 3.11+) with Uvicorn ASGI server and Pydantic v2 over Django or Express.js.
- **Context/Rationale:** As a solo developer in an 8-day hackathon, development velocity and self-documenting APIs are paramount. FastAPI delivers asynchronous request concurrency, automatic OpenAPI Swagger schema generation at `/docs`, and native Pydantic validation with minimal boilerplate.
- **Impact:** Speeds up client-server contract verification; eliminates manual API documentation overhead. Requires implementing custom dependency injection for database sessions and role-based route guards.

### 2. Multi-Stage Docker Containerization
- **Decision:** Implemented multi-stage Docker builds (`python:3.11-slim`) orchestrated via Docker Compose, defining services for `web` (FastAPI), `db` (PostGIS), and `redis` (cache/message broker).
- **Context/Rationale:** Avoids environment mismatch across local development setups and simplifies database extension loading (PostGIS).
- **Impact:** Development setup is completely reproducible via `docker compose up --build`. Named Docker volume `postgres_data` guarantees database persistence across restarts.

### 3. PostgreSQL with PostGIS Extension as Primary Datastore
- **Decision:** Configured **PostgreSQL 15** with the **PostGIS** extension (`postgis/postgis:15-3.3`) instead of a NoSQL database (e.g., MongoDB).
- **Context/Rationale:** Circular waste transactions require strict ACID transactional integrity (for custody handovers and payments) combined with geographic spatial queries (e.g., finding recyclers within an $N$-kilometer radius of a waste generator using `ST_DWithin`).
- **Impact:** Enables native spatial queries via GeoAlchemy2. Requires spatial indexing (`GiST`) on coordinates in the `locations` and `facilities` tables.

### 4. Stateless JWT Authentication with Multi-Tenant Role-Based Access Control (RBAC)
- **Decision:** Implemented stateless JSON Web Token (JWT) authentication using `python-jose` and `passlib[bcrypt]`, supporting 4 discrete system roles: `GENERATOR`, `RECYCLER`, `LOGISTICS`, and `ADMIN`.
- **Context/Rationale:** Avoids maintaining stateful server-side sessions, lowers database read pressure on authenticated endpoints, and allows clients to immediately read user claims (`sub`, `role`, `org_id`).
- **Impact:** Token invalidation before expiry requires a Redis blacklist or short-lived access tokens (15-minute access token, 7-day refresh token). Exact auth routes:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `GET /api/v1/auth/me`

### 5. Schema Migration Workflow via Alembic & SQLAlchemy 2.0
- **Decision:** Adopted **SQLAlchemy 2.0** declarative mapping with `asyncpg` async driver and **Alembic** migration scripts.
- **Context/Rationale:** Fast-evolving marketplace entities during the hackathon require reversible, version-controlled schema modifications rather than runtime auto-synchronization (`Base.metadata.create_all()`).
- **Impact:** Prevents schema drift and data corruption; all database schema changes must be accompanied by an Alembic migration file in `alembic/versions/`.

---

## Segment 2: Day 2 - Supplier Registration, Waste Intake, QR & Weight

### 1. Local Filesystem Storage for Media Uploads (`static/uploads/`)
- **Decision:** Using local volume-mounted directory `static/uploads/` with FastAPI `UploadFile` for waste proof images and inspection photos, rather than AWS S3 or Cloudflare R2.
- **Context/Rationale:** In an 8-day sprint, configuring AWS IAM policies, bucket CORS, presigned URL lifecycles, and billing credentials consumes several critical hours. Local storage works immediately out-of-the-box.
- **Impact:** Images are written to local disk mounted into Docker via volume `uploads_data`. If the volume is pruned, uploaded media is lost. Must be migrated to an S3-compatible object store (e.g., MinIO or AWS S3) prior to multi-instance cloud production deployment.

### 2. Standalone Server-Side QR Code Generation via `qrcode` Library
- **Decision:** Employed Python's `qrcode[pil]` library to generate standalone PNG/SVG QR codes containing a cryptographically signed JSON manifest payload, served directly via Base64 string or binary stream.
- **Context/Rationale:** Avoids third-party QR API dependencies and latency. Enables off-grid or intranet verification at scale intake stations.
- **Payload Structure:**
  ```json
  {
    "batch_code": "BATCH-20261017-0941",
    "intake_id": "8f3b6c2a-9e12-4c28-bb73-9a1c6a2b8e4f",
    "supplier_id": "3d5e2a1b-4c6d-4e8f-9a0b-1c2d3e4f5a6b",
    "category": "PLASTIC_PET",
    "declared_weight_kg": 450.0,
    "timestamp": 1792257000,
    "signature": "hmac_sha256_hash_here"
  }
  ```
- **Impact:** Zero external network latency during QR generation. QR codes can be printed directly on physical waste transport manifests and scanned at checkpoint gates.

### 3. Two-Stage Weight Verification Architecture (Declared vs. Scale-Verified)
- **Decision:** Structured waste intake with a two-phase weight lifecycle: `declared_weight_kg` (self-reported by supplier during intake creation) and `verified_weight_kg` (measured on physical weighbridge/scale at drop-off), calculating automatic discrepancy metrics.
- **Context/Rationale:** Real-world circular waste streams fluctuate in mass due to moisture absorption, debris contamination, or reporting error. Directly trusting supplier declarations leads to inventory inaccuracies and payment disputes.
- **Impact:** Introduced automated status transition logic:
  - If $| \text{declared} - \text{verified} | / \text{declared} \le 0.05$ (within 5% tolerance), status transitions to `VERIFIED`.
  - If discrepancy exceeds 5%, status transitions to `FLAGGED_DISCREPANCY`, prompting manual supervisor review.

### 4. Normalized Material Classification Taxonomy with Purity Grading
- **Decision:** Enforced a normalized database classification taxonomy using `waste_categories` with an enum/lookup table (`PLASTIC_PET`, `PLASTIC_HDPE`, `E_WASTE`, `ORGANIC_BIOMASS`, `FERROUS_METAL`, `NON_FERROUS_METAL`, `TEXTILE`, `PAPER_CARDBOARD`) combined with a standardized purity grading scale (`GRADE_A`, `GRADE_B`, `GRADE_C`, `CONTAMINATED`).
- **Context/Rationale:** Free-text descriptions prevent automated matching, recyclability scoring, and dynamic price indexing. Structured grading allows algorithmic evaluation of circular resource value.
- **Impact:** Suppliers must select from standardized dropdowns. Enables instant calculation of estimated carbon offset credits (`co2_saved_kg = weight_kg * carbon_factor`).

### 5. Composite Human-Readable Batch Code Identifier
- **Decision:** Introduced human-readable batch codes in the format `BATCH-YYYYMMDD-[4-HEX-CHAR]` (e.g., `BATCH-20261017-A4F1`) as a secondary unique identifier alongside UUIDv4 primary keys.
- **Context/Rationale:** Warehouse operators, drivers, and scale attendants cannot easily transcribe 36-character UUIDs when operating handheld scanners or writing physical consignment notes.
- **Impact:** Requires a dedicated helper function with collision-retry logic and a unique database index on `waste_intakes.batch_code`.

---

## Technical Specifications: Day 2

### Exact API Endpoints Implemented

| Method | Endpoint | Description | Auth / Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/suppliers/profile` | Complete supplier KYC, business registration & facility coordinates | `GENERATOR` |
| `GET` | `/api/v1/suppliers/me` | Fetch authenticated supplier profile & verification status | `GENERATOR` |
| `POST` | `/api/v1/intake/create` | Submit new waste consignment with photo attachments (`multipart/form-data`) | `GENERATOR` |
| `GET` | `/api/v1/intake/{intake_id}` | Fetch detailed intake record, photos, and verification audit | Any Authenticated |
| `GET` | `/api/v1/intake/{intake_id}/qr` | Generate and download consignment QR code image/data-url | Any Authenticated |
| `GET` | `/api/v1/intake/scan/{batch_code}` | Lookup consignment details via scanned QR batch code | `LOGISTICS`, `RECYCLER`, `ADMIN` |
| `POST` | `/api/v1/intake/{intake_id}/verify-weight` | Record physical scale weight, calculate delta, and update status | `RECYCLER`, `ADMIN` |

### Database Schema Implemented

#### Table: `suppliers`
```sql
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) NOT NULL UNIQUE,
    facility_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_user ON suppliers(user_id);
CREATE INDEX idx_suppliers_status ON suppliers(verification_status);
```

#### Table: `waste_categories`
```sql
CREATE TABLE waste_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'PLASTIC_PET'
    name VARCHAR(100) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'kg',
    carbon_offset_factor DOUBLE PRECISION NOT NULL DEFAULT 1.5, -- kg CO2e saved per kg recycled
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

#### Table: `waste_intakes`
```sql
CREATE TABLE waste_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_code VARCHAR(50) NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    category_id INTEGER NOT NULL REFERENCES waste_categories(id) ON DELETE RESTRICT,
    purity_grade VARCHAR(20) NOT NULL, -- GRADE_A, GRADE_B, GRADE_C, CONTAMINATED
    declared_weight_kg DOUBLE PRECISION NOT NULL,
    verified_weight_kg DOUBLE PRECISION NULL,
    weight_discrepancy_kg DOUBLE PRECISION NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, IN_TRANSIT, WEIGHED, VERIFIED, FLAGGED_DISCREPANCY
    qr_code_hash VARCHAR(255) NOT NULL,
    image_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT NULL,
    scale_operator_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waste_intakes_batch ON waste_intakes(batch_code);
CREATE INDEX idx_waste_intakes_supplier ON waste_intakes(supplier_id);
CREATE INDEX idx_waste_intakes_status ON waste_intakes(status);
```

---

## Segment 3: Day 3 - GPS Tracking & AI Integration

### 1. Leaflet.js + OpenStreetMap with Ingestion Pings for Real-Time Tracking
- **Decision:** Selected **Leaflet.js** and **OpenStreetMap (OSM)** tiles paired with a FastAPI REST ingestion endpoint (`POST /api/v1/tracking/ping`) and WebSocket broadcaster (`/ws/tracking/{transit_id}`) instead of Google Maps Platform or Mapbox APIs.
- **Context/Rationale:** Live logistics tracking is mandatory to verify waste chain-of-custody between collection and recycling facilities. As a solo developer on an 8-day timeline with zero external budget, commercial mapping APIs introduce credit card dependencies, usage billing risks, and heavy SDK setup.
- **Impact:** Eliminates mapping API billing completely. Real-world physical vehicle testing is bypassed by including a reproducible GPS simulation script (`scripts/simulate_transit.py`) generating realistic route breadcrumbs for hackathon demos. Lacks dynamic road snapping and turn-by-turn ETA recalculation.

### 2. Zero-GPU Serverless Multimodal Vision Inference for Waste Contamination Grading
- **Decision:** Leveraged cloud multimodal Vision inference (Google Gemini 1.5 Flash Vision API) invoked asynchronously through FastAPI `BackgroundTasks` instead of hosting local YOLO/PyTorch object detection models.
- **Context/Rationale:** Unsorted scrap shipments with plastic, metal, and moisture contamination cause massive equipment damage at recyclers. Running local computer vision models inside Docker requires GPU-enabled host infrastructure and bloats containers by gigabytes. Cloud multimodal vision provides instant, zero-shot visual contamination inspection with zero GPU operational cost.
- **Impact:** Keeps the Docker container lightweight (<200MB) and build times under 60 seconds. Requires network connectivity and an API key (`GEMINI_API_KEY`). All predictions are treated as advisory purity scores (`waste_assessments`) with human-in-the-loop review.

### 3. EXIF Sanitization Pipeline for Generator Geolocation Privacy
- **Decision:** Integrated automated EXIF metadata scrubbing using `Pillow` on all uploaded scrap photos before saving to disk or forwarding to the AI vision endpoint.
- **Context/Rationale:** Industrial waste generators frequently handle proprietary materials or scrap storage behind restricted facilities. Phone and camera EXIF data contains exact device GPS coordinates and hardware serial identifiers that pose corporate security liabilities if leaked.
- **Impact:** Strips sensitive GPS and camera metadata while preserving image orientation and visual clarity.

---

## Technical Specifications: Day 3

### Exact API Endpoints Implemented

| Method | Endpoint | Description | Auth / Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/tracking/ping` | Ingest vehicle GPS coordinate ping from driver device or simulator | `LOGISTICS`, `ADMIN` |
| `GET` | `/api/v1/tracking/{transit_id}/trail` | Retrieve chronological GPS coordinate history for map polylines | Any Authenticated |
| `WS` | `/ws/tracking/{transit_id}` | WebSocket stream pushing real-time coordinate updates | Any Authenticated |
| `POST` | `/api/v1/ai/inspect/{intake_id}` | Asynchronously trigger multimodal AI waste quality & contamination assessment | `GENERATOR`, `RECYCLER`, `ADMIN` |
| `GET` | `/api/v1/ai/assessment/{intake_id}` | Retrieve AI purity percentage, contamination flags, and suggested grade | Any Authenticated |

### Database Schema Implemented

#### Table: `waste_transits`
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
```

#### Table: `vehicle_telemetry`
```sql
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

#### Table: `waste_assessments`
```sql
CREATE TABLE waste_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id UUID NOT NULL UNIQUE REFERENCES waste_intakes(id) ON DELETE CASCADE,
    detected_category VARCHAR(100) NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL, -- 0.0 to 1.0
    estimated_purity_percentage DOUBLE PRECISION NOT NULL, -- 0 to 100%
    contamination_detected BOOLEAN NOT NULL DEFAULT FALSE,
    contamination_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    suggested_purity_grade VARCHAR(20) NOT NULL, -- GRADE_A, GRADE_B, GRADE_C, REJECT
    raw_ai_response JSONB NOT NULL,
    model_version VARCHAR(50) NOT NULL DEFAULT 'gemini-1.5-flash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_intake ON waste_assessments(intake_id);
CREATE INDEX idx_assessments_contamination ON waste_assessments(contamination_detected);
```

---

## Segment 4: Day 4 - Sorting, B2B Marketplace & Pricing Engine

### 1. Two-Tier Inventory Decoupling via `sorting_records` and `inventory_lots`
- **Decision:** Decoupled raw consignments (`waste_intakes`) from tradable market commodities by introducing intermediate `sorting_records` that yield certified `inventory_lots`.
- **Context/Rationale:** Bulk waste collected from suppliers is rarely pure. A single 10-tonne intake consignment of mixed plastics yields multiple discrete products (e.g., 6 tonnes of Clear PET flakes, 3 tonnes of Colored HDPE, and 1 tonne of non-recyclable residue). Directly listing raw intakes on the marketplace creates severe fulfillment and quality mismatches.
- **Impact:** Guarantees that buyers on the B2B marketplace purchase standardized, quality-graded inventory with measured moisture and purity specifications.

### 2. ACID Row-Level Locking (`FOR UPDATE`) for Inventory Lot Reservation
- **Decision:** Implemented PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) during bid acceptance and checkout creation to handle concurrent buyer claims on limited inventory lots.
- **Context/Rationale:** When high-grade recyclable material is listed at favorable pricing, multiple industrial buyers simultaneously attempt to place purchase orders. Without concurrency controls, race conditions result in catastrophic double-selling of physical inventory.
- **Impact:** Eliminates overselling. Requires lock timeouts to prevent transaction deadlock under high load.

### 3. Dynamic Quality Penalty Formulation in Pricing Engine
- **Decision:** Centralized pricing logic into a declarative `pricing_rules` table that automatically computes price deductions based on measured contamination and moisture percentage deviations from standard benchmarks.
- **Context/Rationale:** Buyers refuse to pay uniform market rates when scrap lots exhibit high moisture or minor polymer impurities. Codifying dynamic penalty rules prevents prolonged manual price haggling and guarantees fair market clearing rates.
- **Impact:** Automates instant pricing quotes (`GET /api/v1/pricing/quote`) and enforces hard price floors (`floor_price_per_kg`) to protect sellers from predatory down-bidding.

---

## Technical Specifications: Day 4

### Exact API Endpoints Implemented

| Method | Endpoint | Description | Auth / Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/sorting/process` | Log sorting run, calculate yield %, and generate inventory lots | `RECYCLER`, `ADMIN` |
| `GET` | `/api/v1/inventory/lots` | List certified warehouse inventory lots with grade and moisture filters | Any Authenticated |
| `POST` | `/api/v1/marketplace/listings` | Publish inventory lot as fixed-price or auction marketplace listing | `GENERATOR`, `RECYCLER` |
| `GET` | `/api/v1/marketplace/listings` | Browse active marketplace catalog with multi-facet category filters | Any Authenticated |
| `POST` | `/api/v1/marketplace/bids` | Place procurement bid and reserve inventory mass allocation | `RECYCLER` |
| `POST` | `/api/v1/marketplace/orders/checkout` | Create purchase order and hold buyer funds in escrow state | `RECYCLER` |
| `GET` | `/api/v1/pricing/quote` | Query algorithmic price floor and dynamic penalty quote | Any Authenticated |

---

## Segment 6: Day 6 - Premium Commercial Website, Dashboards & B2C Eco-Store

### 1. Double-Entry Green Rewards Ledger with Row-Level Concurrency Locking
- **Decision:** Implemented an immutable ledger architecture using `reward_wallets` and `reward_transactions`, requiring `SELECT ... FOR UPDATE` row locks on point redemption in the Eco-Store.
- **Context/Rationale:** Waste generators accumulate points from pure recyclables that translate into fiat discounts. If users open multiple checkout sessions, race conditions could enable double-spending points beyond their true balance.
- **Impact:** Eliminates fraudulent point redemptions and provides a transparent audit trail for ESG verification. Maximum redemption is capped at 50% of the cart value.

### 2. Standalone Sandboxed UPI / Card Payment Gateway Simulator
- **Decision:** Created an internal mock payment processing gateway (`/api/v1/payments/*`) that generates scannable UPI QR codes and provides a deterministic "Simulate Instant Payment Success" webhook trigger for evaluators.
- **Context/Rationale:** Real payment processors require legal business entities, merchant credentials, and active banking accounts that are inaccessible during an 8-day solo hackathon.
- **Impact:** Zero dependency on external banking networks or test sandbox downtime during live presentations. Enables full-cycle demonstration of consumer purchasing and rewards redemption.

### 3. Server-Side Monetary and Points Recomputation
- **Decision:** Mandated that all cart totals, point values, discounts, and shipping charges be calculated strictly on the FastAPI backend during checkout (`POST /api/v1/eco-store/orders/checkout`).
- **Context/Rationale:** Preventing client-side payload tampering where malicious actors could alter cart price or inflated reward values in transit.
- **Impact:** Enforces strict financial security; frontend payload only supplies product IDs, quantities, and requested points to redeem.

---

## Technical Specifications: Day 6

### Exact API Endpoints Implemented

| Method | Endpoint | Description | Auth / Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/metrics/public-impact` | Public aggregate circular metrics for landing page | None |
| `GET` | `/api/v1/dashboards/supplier/summary` | Tonnage, intake statuses, purity trends, and reward wallet balance | `GENERATOR` |
| `GET` | `/api/v1/dashboards/recycler/summary` | Active bids, escrow purchases, transit tracking, ESG procurement stats | `RECYCLER` |
| `GET` | `/api/v1/dashboards/admin/overview` | Platform GMV, total tonnage, active transit count, dispute flags | `ADMIN` |
| `GET` | `/api/v1/eco-store/products` | Browse upcycled/consumer products with stock and points pricing | None / Optional |
| `POST` | `/api/v1/eco-store/cart/validate` | Validate cart items, inventory availability, and applicable reward points | Any Authenticated |
| `POST` | `/api/v1/eco-store/orders/checkout` | Create B2C order, apply point deduction, and generate mock payment session | Any Authenticated |
| `POST` | `/api/v1/payments/mock-webhook` | Process mock UPI payment gateway callback | System / Mock |
| `GET` | `/api/v1/rewards/wallet` | Query authenticated user's current points balance & transaction log | Any Authenticated |



