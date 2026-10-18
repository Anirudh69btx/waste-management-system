# Architecture Decision Records (ADR) Index

This document tracks all foundational architecture decisions for the **Circular Waste & Resource Marketplace**.

---

### Day 1: Base Foundation, Docker & Auth

| ADR ID | Title | Status | Date | Linked File |
| :--- | :--- | :--- | :--- | :--- |
| ADR-001 | Selection of FastAPI as Core Backend Framework | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-001](03_Architecture_Decision_Records.md#ADR-001) |
| ADR-002 | Containerization Strategy with Multi-Stage Docker & Docker Compose | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-002](03_Architecture_Decision_Records.md#ADR-002) |
| ADR-003 | Primary Datastore: PostgreSQL with PostGIS for Spatial Waste Matching | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-003](03_Architecture_Decision_Records.md#ADR-003) |
| ADR-004 | Authentication & Multi-Role Authorization via Stateless JWT & Bcrypt | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-004](03_Architecture_Decision_Records.md#ADR-004) |
| ADR-005 | Schema Migration and Data Access Strategy (SQLAlchemy 2.0 & Alembic) | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-005](03_Architecture_Decision_Records.md#ADR-005) |

---

### Day 2: Supplier Registration, Waste Intake, QR & Weight

| ADR ID | Title | Status | Date | Linked File |
| :--- | :--- | :--- | :--- | :--- |
| ADR-006 | Local Filesystem Storage (`static/uploads/`) for MVP Media Assets | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-006](03_Architecture_Decision_Records.md#ADR-006) |
| ADR-007 | Server-Side Cryptographically Signed QR Code Generation for Consignment Tracking | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-007](03_Architecture_Decision_Records.md#ADR-007) |
| ADR-008 | Two-Stage Weight Verification Pattern (Declared vs. Scaled Tolerance) | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-008](03_Architecture_Decision_Records.md#ADR-008) |
| ADR-009 | Normalized Material Classification Taxonomy with Purity Grading | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-009](03_Architecture_Decision_Records.md#ADR-009) |
| ADR-010 | Dual Identifier Scheme: UUIDv4 Relations with Human-Readable Batch Codes | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-010](03_Architecture_Decision_Records.md#ADR-010) |

---

### Day 3: GPS Tracking & AI Integration

| ADR ID | Title | Status | Date | Linked File |
| :--- | :--- | :--- | :--- | :--- |
| ADR-011 | Telemetry & Vehicle GPS Tracking Architecture (Leaflet + OpenStreetMap with Simulated Pings) | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-011](03_Architecture_Decision_Records.md#ADR-011) |
| ADR-012 | AI Waste Quality Assessment & Contamination Classification Pipeline (Zero-GPU Architecture) | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-012](03_Architecture_Decision_Records.md#ADR-012) |

---

### Day 4: Sorting, B2B Marketplace & Pricing Engine

| ADR ID | Title | Status | Date | Linked File |
| :--- | :--- | :--- | :--- | :--- |
| ADR-013 | Inventory Lot Allocation & Escrow-Backed Purchase Order State Machine | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-013](03_Architecture_Decision_Records.md#ADR-013) |
| ADR-014 | Algorithmic Price Floor and Dynamic Penalty Engine for Circular Commodities | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-014](03_Architecture_Decision_Records.md#ADR-014) |

---

### Day 6: Premium Commercial Website, Dashboards & B2C Eco-Store

| ADR ID | Title | Status | Date | Linked File |
| :--- | :--- | :--- | :--- | :--- |
| ADR-015 | Green Rewards Points Ledger Architecture & Double-Spending Prevention | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-015](03_Architecture_Decision_Records.md#ADR-015) |
| ADR-016 | Sandboxed Mock UPI Payment Gateway Architecture for Commercial Demo | Accepted | 2026-10-17 | [03_Architecture_Decision_Records.md#ADR-016](03_Architecture_Decision_Records.md#ADR-016) |




