# 📸 Screenshot Capture Guide — Circular Waste Marketplace

This directory holds the 10 canonical demo screenshots referenced in [`README.md`](../../README.md) and [`docs/pitch-deck-outline.md`](../pitch-deck-outline.md).

---

## 🛠️ Capture Setup

1. Ensure the full stack is running (`docker compose up -d`) and demo mode is active (`VITE_DEMO_MODE=true` in `.env`).
2. Open Chrome/Edge at **`http://localhost:5173/login`**.
3. Open DevTools (`F12`) → Toggle Device Toolbar (`Ctrl+Shift+M`) → Set viewport to **Responsive `1440 × 900`**, Device Pixel Ratio **`2x`**.
4. Use Chrome DevTools Command Menu (`Ctrl+Shift+P` → **Capture screenshot**) and save each file into `docs/screenshots/` using the exact filename below.

---

## 📋 The 10 Canonical Screenshots

| # | Filename | Route | Persona (One-Click Demo Login) | What Should Be Visible |
|---|---|---|---|---|
| **01** | `01-login-demo-accounts.png` | `/login` | *(Unauthenticated)* | Login card + **🎬 Demo Accounts** panel showing all 5 one-click role buttons (`Supplier`, `Sorter`, `Driver`, `Buyer`, `Admin`). |
| **02** | `02-supplier-dashboard.png` | `/dashboard` | **Supplier** (`supplier@cwm.io`) | Supplier KPI cards (total batches, verified weight, CO₂e avoided), recent waste intakes table, and quick action buttons. |
| **03** | `03-intake-submission-ai.png` | `/intake/success/:intakeId` | **Supplier** (`supplier@cwm.io`) | Submitted batch confirmation with QR manifest and **`AIAssessmentCard`** showing detected category, confidence progress bar, grade badge (`Grade A`/`B`/`C`), purity %, and contamination status. |
| **04** | `04-batch-traceability.png` | `/dashboard/batches/:id` | **Supplier** (`supplier@cwm.io`) | Batch detail view showing both the **`AIAssessmentCard`** and the cryptographic **Chain-of-Custody Traceability Timeline** (`INTAKE_CREATED` → `PICKUP_SCHEDULED` → `WEIGHED` → `SORTED`). |
| **05** | `05-driver-live-trip.png` | `/driver/trip` | **Driver** (`driver@cwm.io`) | Active trip manifest, stop checklist, GPS telemetry simulator controls, and weighbridge weight ticket recording modal. |
| **06** | `06-sorter-console.png` | `/sorter/console` | **Sorter** (`sorter@cwm.io`) | Inbound intakes queue + **`SortIntakeModal`** open with the compact **`AIAssessmentCard`** above the purity grade and moisture/contamination inputs. |
| **07** | `07-marketplace-b2b.png` | `/marketplace` | **Buyer** (`buyer@cwm.io`) | Certified recyclable feedstock listings grid with purity badges, available tonnage, ask price (`₹/kg`), and category filters. |
| **08** | `08-order-receipt-escrow.png` | `/marketplace/orders/:id` | **Buyer** (`buyer@cwm.io`) | **`OrderReceiptPage`** showing the emerald/blue status hero, Order Summary card, 4-step **Payment & Escrow Timeline**, and printable Tax Invoice card. |
| **09** | `09-rewards-eco-store.png` | `/rewards` | **Supplier** (`supplier@cwm.io`) | Green loyalty **`RewardWallet`** balance, tier progress bar (`BRONZE` → `PLATINUM`), transaction ledger, and Eco-Store redemption tab. |
| **10** | `10-admin-analytics-fleet.png` | `/admin/analytics` | **Admin** (`admin@cwm.io`) | Platform-wide KPIs (total diverted kg, GMV, CO₂e offset, active disputes) + native SVG area, donut, and bar charts. |
