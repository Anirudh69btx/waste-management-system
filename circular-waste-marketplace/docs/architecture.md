# 🏗️ System Architecture — Circular Waste Marketplace

This document provides the complete technical architecture of the **Circular Waste Marketplace (CWM)** using four canonical Mermaid diagrams:

1. **System Overview (`flowchart LR`)** — Runtime container and service topology
2. **Domain Data Model (`erDiagram`)** — All 18 core SQLAlchemy 2.0 entities and relationships
3. **Waste Submission & AI Assessment (`sequenceDiagram`)** — End-to-end intake, S3 upload, Celery dispatch, and frontend polling
4. **Authentication & Single-Flight Refresh (`sequenceDiagram`)** — Dual-secret JWT issuance, 401 interception, and replay-safe token rotation

---

## 1. System Overview

```mermaid
flowchart LR
    subgraph Client["Browser Client"]
        Browser["Web Browser (React 18 + TS)"]
    end

    subgraph Edge["Reverse Proxy / Ingress"]
        Nginx["Nginx Reverse Proxy (:80 / :443)"]
    end

    subgraph AppTier["Application Tier"]
        FE["Frontend SPA (Vite / Nginx)"]
        BE["FastAPI Backend (Uvicorn ASGI)"]
        CW["Celery Worker (Async Tasks)"]
        CB["Celery Beat (Cron Scheduler)"]
        AI["AI Engine (Quality Gate + Classifier + Pricing)"]
    end

    subgraph DataTier["Persistence & Messaging Tier"]
        PG[("PostgreSQL 15")]
        RD[("Redis 7 (Cache + Broker)")]
        MN[("MinIO / S3 Object Storage")]
    end

    Browser -->|"HTTPS / WSS"| Nginx
    Nginx -->|"/"| FE
    Nginx -->|"/api/v1 & /ws"| BE

    BE -->|"Async SQLAlchemy 2.0"| PG
    BE -->|"Rate Limits, Locks, Pub/Sub"| RD
    BE -->|"Presigned & Multipart Uploads"| MN
    BE -->|"Enqueue Task"| RD

    CB -->|"Periodic Schedules"| RD
    RD -->|"Consume Tasks"| CW
    CW -->|"Run Vision & Heuristics"| AI
    CW -->|"Write Assessments & Rewards"| PG
    CW -->|"Fetch Image Bytes"| MN
```

---

## 2. Domain Data Model (ER Diagram)

```mermaid
erDiagram
    User ||--o| Supplier : "owns profile"
    User ||--o| RewardWallet : "holds wallet"
    User ||--o{ WasteIntake : "submits"
    User ||--o{ Bid : "places"
    User ||--o{ PurchaseOrder : "buys or sells"

    Supplier ||--o{ WasteIntake : "generates"
    WasteIntake ||--o| WasteAssessment : "analyzed by AI"
    WasteIntake ||--o| PickupRequest : "scheduled for"
    WasteIntake ||--o{ WeightTicket : "weighed via"
    WasteIntake ||--o{ SortingRecord : "sorted in"
    WasteIntake ||--o{ TraceabilityEvent : "logs custody"

    Vehicle ||--o{ Trip : "assigned to"
    Trip ||--o{ TripStop : "contains stops"
    PickupRequest ||--o| TripStop : "fulfilled at"

    SortingRecord ||--o| InventoryLot : "produces"
    InventoryLot ||--o{ MarketplaceListing : "listed as"
    MarketplaceListing ||--o{ Bid : "receives"
    MarketplaceListing ||--o{ PurchaseOrder : "converted to"

    RewardWallet ||--o{ RewardTransaction : "records ledger"
    EcoProduct ||--o{ RewardTransaction : "redeemed via"

    User {
        uuid id PK
        string email UK
        string role "GENERATOR | RECYCLER | LOGISTICS | ADMIN"
        boolean is_active
        uuid last_role_change_by_user_id FK
        uuid deactivated_by_user_id FK
    }

    Supplier {
        uuid id PK
        uuid user_id FK
        string business_name
        string supplier_type
        float latitude
        float longitude
    }

    WasteIntake {
        uuid id PK
        string batch_code UK
        uuid supplier_id FK
        int category_id FK
        float declared_weight_kg
        float verified_weight_kg
        string status
    }

    WasteAssessment {
        uuid id PK
        uuid intake_id FK
        string detected_category
        float confidence_score
        float estimated_purity_percentage
        boolean contamination_detected
        string suggested_purity_grade "A | B | C"
        string model_version
    }

    PickupRequest {
        uuid id PK
        uuid intake_id FK
        date scheduled_date
        string status
    }

    WeightTicket {
        uuid id PK
        string ticket_number UK
        uuid intake_id FK
        float gross_weight_kg
        float tare_weight_kg
        float net_weight_kg
        boolean is_disputed
        string dispute_resolution
    }

    Vehicle {
        uuid id PK
        string registration_number UK
        float capacity_kg
        string status
    }

    Trip {
        uuid id PK
        string trip_code UK
        uuid vehicle_id FK
        uuid driver_id FK
        string status
    }

    TripStop {
        uuid id PK
        uuid trip_id FK
        uuid pickup_request_id FK
        int sequence_order
        string status
    }

    SortingRecord {
        uuid id PK
        uuid intake_id FK
        uuid sorter_user_id FK
        float input_weight_kg
        float sorted_usable_kg
        string purity_grade
    }

    InventoryLot {
        uuid id PK
        string lot_code UK
        int category_id FK
        float available_kg
        string purity_grade
        string status
    }

    MarketplaceListing {
        uuid id PK
        uuid seller_id FK
        uuid inventory_lot_id FK
        float available_kg
        float price_per_kg
        string status
    }

    Bid {
        uuid id PK
        uuid listing_id FK
        uuid bidder_user_id FK
        float quantity_kg
        float bid_price_per_kg
        string status
    }

    PurchaseOrder {
        uuid id PK
        string order_code UK
        uuid listing_id FK
        uuid buyer_user_id FK
        uuid seller_user_id FK
        float quantity_kg
        float total_amount
        string status "pending_payment | escrow_held | shipped | delivered | completed"
    }

    TraceabilityEvent {
        uuid id PK
        uuid intake_id FK
        string event_type
        string previous_hash
        string event_hash
    }

    RewardWallet {
        uuid id PK
        uuid user_id FK
        int balance_points
        int lifetime_points_earned
        string current_tier "BRONZE | SILVER | GOLD | PLATINUM"
    }

    RewardTransaction {
        uuid id PK
        uuid wallet_id FK
        string transaction_type
        int points_delta
        int balance_after
    }

    EcoProduct {
        uuid id PK
        string sku UK
        string name
        int points_cost
        int stock_quantity
    }
```

---

## 3. Waste Submission & AI Classification Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Supplier as Supplier (Browser)
    participant FE as React SPA
    participant BE as FastAPI Backend
    participant S3 as MinIO / S3
    participant DB as PostgreSQL 15
    participant Q as Redis + Celery Worker
    participant AI as AI Engine

    Supplier->>FE: Fill intake form + attach batch photo
    FE->>BE: POST /api/v1/intake (multipart/form-data)
    BE->>S3: Store uploaded photo object
    S3-->>BE: Object URI / key
    BE->>DB: INSERT WasteIntake + TraceabilityEvent (HMAC-SHA256)
    BE->>Q: Enqueue run_waste_assessment_task(intake_id)
    BE-->>FE: 201 Created (WasteIntake + QR manifest)
    FE->>Supplier: Navigate to /intake/success/:intakeId

    par Async AI Classification
        Q->>AI: Run quality gate + 8-class classifier + purity grade
        AI-->>Q: WasteAssessment metrics (category, confidence, grade, contamination)
        Q->>DB: INSERT WasteAssessment row
    and Frontend Polling (every 2s, up to 30s)
        loop Until 200 OK or 30s timeout
            FE->>BE: GET /api/v1/ai/assessments/:intakeId
            BE->>DB: SELECT WasteAssessment WHERE intake_id = :id
            alt Assessment Ready
                DB-->>BE: WasteAssessment row
                BE-->>FE: 200 OK (WasteAssessment JSON)
                FE->>Supplier: Render AIAssessmentCard (confidence bar, grade badge, purity %)
            else Still Queued
                BE-->>FE: 404 Not Found
                FE->>Supplier: Show "Analyzing waste photo..." skeleton
            end
        end
    end
```

---

## 4. Authentication & Single-Flight Refresh Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant FE as React + Axios Client
    participant Store as Zustand AuthStore
    participant BE as FastAPI Auth Router
    participant DB as PostgreSQL (RefreshToken Table)

    User->>FE: Sign in (Form or 1-Click Demo Account)
    FE->>BE: POST /api/v1/auth/login { email, password }
    BE->>DB: Verify Argon2/Bcrypt hash + insert RefreshToken JTI
    BE-->>FE: 200 OK { access_token (15m), refresh_token (7d) }
    FE->>BE: GET /api/v1/auth/me (Bearer access_token)
    BE-->>FE: 200 OK (User profile + role)
    FE->>Store: setAuth(user, tokens)

    Note over FE,BE: Access token expires after 15 minutes; 3 concurrent API calls fire

    par Concurrent API Calls
        FE->>BE: GET /api/v1/dashboards/supplier
        BE-->>FE: 401 Unauthorized
    and
        FE->>BE: GET /api/v1/rewards/wallet
        BE-->>FE: 401 Unauthorized
    end

    Note over FE: Axios interceptor acquires single-flight refreshPromise mutex

    FE->>BE: POST /api/v1/auth/refresh { refresh_token }
    BE->>DB: Verify JTI not revoked -> revoke old JTI -> mint new token pair
    BE-->>FE: 200 OK { new access_token, new refresh_token }
    FE->>Store: Persist rotated token pair

    par Replay Queued Requests with New Access Token
        FE->>BE: GET /api/v1/dashboards/supplier (New Bearer token)
        BE-->>FE: 200 OK
    and
        FE->>BE: GET /api/v1/rewards/wallet (New Bearer token)
        BE-->>FE: 200 OK
    end
```
