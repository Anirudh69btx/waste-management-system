# 🎬 90-Second Live Demo Script

## Pre-Demo Checklist (5 min before)
- [ ] `docker compose ps` — all 7 containers `Up (healthy)`
- [ ] `.env` has `VITE_DEMO_MODE=true`
- [ ] Browser open at `http://localhost:5173/login` (zoom 100%, dark mode, notifications cleared)
- [ ] Second tab open at `http://localhost:8000/docs` (Swagger backup)

---

## Timeline

| Time | Action | What to Say |
|---|---|---|
| **0:00–0:15** | On `/login` — point to **🎬 Demo Accounts** panel → click **Supplier** | *"We built an end-to-end B2B waste marketplace across 4 roles. Let's sign in as a commercial waste generator with one click."* |
| **0:15–0:35** | Land on `/dashboard` → click any batch in list → show **AI Waste Assessment card** + **Traceability Timeline** → click **Wallet badge** in topbar (`/rewards`) | *"Every batch submitted gets an AI quality & purity assessment — 89% confidence, Grade A — plus a cryptographic hash-chained audit trail and green reward points."* |
| **0:35–0:55** | Log out → `/login` → click **Sorter** → `/sorter/console` → click **Sort** on an intake → show compact AI card inside modal → switch to `/marketplace` | *"At the sorting facility, operators see the AI suggestion right inside the grading modal, convert sorted waste into inventory lots, and list them on the B2B marketplace."* |
| **0:55–1:15** | Click any active listing → click **Buy Now** → watch 2.5s escrow animation → land on **Order Receipt Page** → click **Download Invoice** | *"Industrial recyclers buy certified feedstock with escrow protection. Funds are held until delivery is confirmed, with instant GST-ready receipts."* |
| **1:15–1:30** | Log out → `/login` → click **Admin** → `/admin/analytics` → show KPIs + charts → click `/admin/fleet` (live map) → click `/admin/disputes` | *"Finally, platform admins get real-time fleet telemetry, platform-wide CO₂e analytics, and one-click weight dispute resolution. 391 automated tests, deployable in one command."* |

---

## 🛟 Recovery Moves (if anything hiccups)

| Hiccup | Recovery |
|---|---|
| Demo login slow (>3s) | Say *"Cold container wakeup"* — keep talking through the 4-role table |
| Map tiles slow to load | Switch immediately to `/admin/analytics` — native SVG charts render in <16ms |
| Modal validation error | Click Cancel → open an existing order from `/marketplace/orders` to show the receipt page |
| Browser tab crash | Switch to Swagger tab (`localhost:8000/docs`) — show the 19 API router groups live |
