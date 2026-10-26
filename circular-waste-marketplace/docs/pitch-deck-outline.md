# 🎤 Pitch Deck Outline (10 Slides) — Circular Waste Marketplace

This outline structures a crisp 5-minute hackathon / investor presentation for **Circular Waste Marketplace (CWM)**.

---

## Slide 1 — Title & Hook
- **Headline:** Circular Waste Marketplace — *Every Kilogram of Waste gets a Digital Twin*
- **Sub-headline:** AI-verified B2B waste-to-resource exchange with cryptographic chain-of-custody, live fleet telemetry, and escrow-backed feedstock trading.
- **Visual:** Dark/emerald hero badge + 4-role loop icon (`Supplier → Driver → Sorter → Industrial Buyer`).
- **Speaker Cue (15s):** *"India generates 62 million tonnes of municipal waste every year, and 70% lands in open dumps—not because recyclers don't want material, but because trust, grading, and logistics between generators and buyers are broken."*

---

## Slide 2 — The Problem: A ₹45,000 Cr Trust & Traceability Gap
- **3 Core Breakdowns:**
  1. **Commercial Generators** (hotels, factories, campuses) face unpredictable pickups, opaque scrap rates, and zero proof of recycling.
  2. **Sorting & Recycling Plants** operate below 55% capacity because inbound material is wet, ungraded, and contaminated.
  3. **Brands & Regulators** face rampant Extended Producer Responsibility (EPR) certificate fraud due to paper weight slips with no audit trail.
- **Visual:** Split graphic contrasting paper weighbridge slips vs. CWM's HMAC-SHA256 hash chain.

---

## Slide 3 — Our Solution: 4-Role Circular Operating System
- **One Integrated Platform Across 4 Personas:**
  - **🏭 Supplier (`GENERATOR`):** Submit waste with photo → instant AI purity & price estimate → book pickup → earn green points.
  - **🚛 Driver (`LOGISTICS`):** Follow optimized stop sequence → stream live GPS → record gross/tare weighbridge tickets.
  - **🔬 Sorter / Seller (`RECYCLER`):** Grade batches with AI assist → mint certified `InventoryLot` → publish B2B `MarketplaceListing`.
  - **🛡️ Admin (`ADMIN`):** Live fleet map, weight dispute arbitration, RBAC audit trail, and Scope-3 ESG analytics.
- **Visual:** Screenshot `01-login-demo-accounts.png`.

---

## Slide 4 — Product Walkthrough (90-Second Live Demo)
- **Step-by-Step Flow:**
  1. **1-Click Demo Login** (`/login`) into Supplier → view AI-classified batch (`89% confidence, Grade A, 94% purity`).
  2. **Switch to Sorter** (`/sorter/console`) → sort intake with AI recommendation → mint certified PET lot.
  3. **Switch to Buyer** (`/marketplace`) → Buy Now → watch escrow hold → view printable GST-ready receipt (`/marketplace/orders/:id`).
  4. **Switch to Admin** (`/admin/analytics` & `/admin/disputes`) → inspect platform diversion KPIs and resolve weight disputes.
- **Visual:** Carousel of `03-intake-submission-ai.png`, `06-sorter-console.png`, `08-order-receipt-escrow.png`.

---

## Slide 5 — AI Classification & Dynamic Pricing Engine
- **How It Works (`backend/ai_engine/`):**
  - **Stage 1 — Image Quality Gate:** Laplacian blur variance, exposure check, and 64-bit perceptual hash ($dHash$) deduplication.
  - **Stage 2 — 8-Category Classifier:** ONNX Runtime inference with deterministic HSV color-histogram fallback so classification works 100% offline in air-gapped containers.
  - **Stage 3 — Dynamic Pricing Formula:** Base category rate adjusted by measured moisture penalty ($\Delta M$), contamination penalty ($\Delta C$), and purity grade multiplier (`Grade A = 1.0x`, `Grade B = 0.85x`, `Grade C = 0.65x`).
  - **Stage 4 — Biogas BMP Estimator:** Converts wet organic mass into $\text{m}^3\text{ CH}_4$, kWh thermal equivalent, and avoided $\text{kg CO}_2e$.
- **Visual:** Diagram from `docs/architecture.md` + `AIAssessmentCard` close-up.

---

## Slide 6 — Cryptographic Chain-of-Custody & Dispute Resolution
- **Tamper-Evident Traceability:**
  - Every state transition (`INTAKE_CREATED → PICKUP_SCHEDULED → WEIGHED → SORTED → LOT_MINTED → ORDER_COMPLETED`) appends a `TraceabilityEvent` linked via `previous_hash → event_hash`.
- **Two-Sided Weight Verification:**
  - Driver records weighbridge `gross_weight_kg` and `tare_weight_kg`.
  - If variance exceeds threshold, Supplier can flag a dispute; Admin resolves with full audit columns (`Upheld` / `Dismissed` / `Adjusted`).
- **Visual:** Screenshot `04-batch-traceability.png`.

---

## Slide 7 — Technical Architecture & Engineering Rigor
- **Production-Grade Stack:**
  - **Backend:** FastAPI + SQLAlchemy 2.0 Async + PostgreSQL 15 + Redis 7 + Celery + MinIO (S3).
  - **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + Zustand + native SVG charts.
  - **Quality Bar:** **391 automated tests** (**228 backend pytest + 163 frontend Vitest**), zero TypeScript errors, GitHub Actions CI/CD, 1-command VPS deploy with TLS.
- **Visual:** System Overview diagram from `docs/architecture.md`.

---

## Slide 8 — Market Opportunity & Business Model
- **Target Market:**
  - **Beachhead:** Commercial bulk waste generators (BWG) mandated under India's Solid Waste Management Rules (>100 kg/day) — hotels, tech parks, food processors, and MRF operators.
  - **TAM / SAM / SOM:** ₹45,000 Cr Indian organized recycling & EPR market; ₹6,200 Cr addressable B2B feedstock brokerage across top 20 metro clusters.
- **3 Revenue Streams:**
  1. **2.5% Marketplace Take-Rate** on settled escrow purchase orders.
  2. **SaaS Subscription** for sorting hubs and municipal fleet operators.
  3. **Verified EPR / Carbon Offset Audit Packs** for FMCG compliance buyers.

---

## Slide 9 — Traction in Demo & Post-Hackathon Roadmap
- **Live Seeded Dataset Ready Today:**
  - **1,930+ waste intakes**, **100 AI assessments**, **835 marketplace purchase orders**, **18 reward wallets**, **10 eco-store products**, and **5 one-click demo personas**.
- **Next 90 Days (Roadmap):**
  - **v1.1:** Live Stripe Connect / Razorpay Route split-escrow payouts + WhatsApp driver bot.
  - **v1.2:** MQTT weighbridge serial port hardware bridge + automated GST e-Way Bill API.
  - **v2.0:** Fine-tuned YOLOv8 multi-object contamination detector trained on Indian MRF conveyor footage.

---

## Slide 10 — Team & Call to Action
- **Why Us:** Full-stack systems engineering combining async Python microservices, computer vision pipelines, geospatial logistics, and high-craft dark-mode UI.
- **Try It Right Now:**
  - Open `/login` → click any **🎬 Demo Account** button → test the complete loop in 90 seconds.
- **Visual:** QR code to live demo / GitHub repo + 391 passing tests badge.
