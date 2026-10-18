# UI/UX Design Specification

**Project:** Circular Waste & Resource Marketplace  
**Document Code:** UX-SPEC-001  
**Sprint Cycle:** Day 6 - Commercial Landing Page, Dashboards & Admin Console UI  
**Lead UI/UX Architect:** Solutions Architect & Technical Documentation Writer  
**Status:** Approved for Implementation  

---

## 1. Global Design System Foundations

### 1.1. Color Palette

The visual identity embodies an industrial yet sophisticated circular economy aesthetic, employing deep forest tones, eco-emerald accents, neutral slate backgrounds, and high-contrast status signifiers.

| Token Name | Hex Code | HSL Value | Usage Description |
| :--- | :--- | :--- | :--- |
| `primary-forest` | `#1B4332` | `hsl(153, 42%, 18%)` | Primary brand identity, dark headers, active nav items |
| `primary-emerald` | `#2D6A4F` | `hsl(153, 40%, 30%)` | Primary CTA buttons, interactive hover highlights |
| `accent-mint` | `#52B788` | `hsl(152, 41%, 52%)` | Badges, success indicators, progress bars, chart accents |
| `accent-lime` | `#74C69D` | `hsl(150, 42%, 62%)` | Stat highlights, eco-points badges, subtle glow borders |
| `surface-canvas` | `#0D1117` | `hsl(215, 28%, 7%)` | Dark mode base app canvas, page viewport background |
| `surface-card` | `#161B22` | `hsl(215, 21%, 11%)` | Card surface, table rows, modal backdrops |
| `surface-elevated` | `#21262D` | `hsl(215, 14%, 15%)` | Dropdown menus, tooltips, drawer sidebars |
| `border-subtle` | `#30363D` | `hsl(215, 12%, 21%)` | Card borders, table dividers, input bounding outlines |
| `text-primary` | `#F0F6FC` | `hsl(210, 56%, 96%)` | Primary headings, body copy, high-contrast labels |
| `text-secondary` | `#8B949E` | `hsl(215, 8%, 58%)` | Subtitles, table headers, metadata timestamps |
| `status-warning` | `#D29922` | `hsl(41, 72%, 48%)` | Discrepancy alerts, pending weighbridge status |
| `status-error` | `#F85149` | `hsl(3, 93%, 63%)` | Rejected intakes, validation errors, out-of-stock items |

---

### 1.2. Typography Stack

* **Display & Heading Font:** **Outfit** (Google Fonts)
  * Weights: `600 (Semi-Bold)`, `700 (Bold)`
  * Letter Spacing: `-0.02em` for modern geometric authority.
* **Interface & Body Font:** **Inter** (Google Fonts)
  * Weights: `400 (Regular)`, `500 (Medium)`, `600 (Semi-Bold)`
  * Line Height: `1.5` for extended readability.
* **Monospace Font (Data & IDs):** **JetBrains Mono**
  * Weights: `400 (Regular)`, `500 (Medium)`
  * Used for: Batch codes (`BATCH-20261017-7F3A`), order numbers (`PO-20261017-0941`), GPS coordinates, and hashes.

---

## 2. Screen Specifications

---

### Screen 1: Public Commercial Landing Page (`/`)

#### 1. Screen Name
**Commercial Marketplace Portal & Impact Showcase (`/`)**

#### 2. Layout & Wireframe Description
* **Global Header (Sticky, Glassmorphic):**
  * Left: Circular logo with animated green recycle icon + "CirculaX Marketplace".
  * Center: Navigation links ("Platform", "B2B Marketplace", "Eco-Store", "Impact Calculator").
  * Right: "Sign In" button (ghost variant) + "Register Facility" (emerald fill CTA).
* **Hero Section (Full Viewport Height):**
  * Left 60%: High-impact headline ("Turn Industrial Waste into Verified Circular Capital"), value proposition subtext, dual CTA group ("Browse Live Listings" and "Calculate ESG Savings"), and Trust Badges (ISO 14001 Compliant, PostGIS Verified Chain-of-Custody).
  * Right 40%: Interactive 3D glass card featuring a live simulated consignment batch passing through AI purity assessment with animated confidence gauges ($98.4\%$).
* **Live Telemetry Ticker (Full Width Strip):**
  * Dark emerald backdrop banner displaying auto-incrementing odometer statistics:
    * `14,820 Metric Tonnes` Diverted from Landfills
    * `22,450,000 kg CO2e` Greenhouse Emissions Prevented
    * `412 Verified Facilities` Connected
* **Interactive Circular Savings Calculator Section:**
  * Two-column split card:
    * Left: Sliders for Material Type (PET, HDPE, Scrap Iron, Organic) and Monthly Volume (1 to 500 tonnes).
    * Right: Real-time projection card showing projected revenue ($ / ₹), Green Points generated, and equivalent passenger vehicle emissions eliminated.
* **Curated Upcycled Eco-Store Showcase:**
  * 4-column responsive grid showcasing featured circular products (e.g. Bio-Compost, Recycled Pavers) with direct "Buy Now / Redeem Points" links.
* **Footer:** Comprehensive sitemap, legal disclaimer, and REST API documentation link (`/docs`).

#### 3. Design System
* **Colors:** `surface-canvas` (`#0D1117`), `primary-emerald` (`#2D6A4F`), `accent-mint` (`#52B788`), `text-primary` (`#F0F6FC`).
* **Typography:** Outfit Bold 56px for Hero Title, Inter 18px for body, JetBrains Mono 14px for ticker counters.
* **Components Used:**
  * Glassmorphism Navbar (`backdrop-filter: blur(12px)`).
  * Interactive Sliders with dual-tone fill track.
  * Odometer Number Counter with smooth rolling animations.
  * Product Preview Cards with badge overlays (`Embodied Carbon: -2.4kg`).

#### 4. User Interactions
* **Navbar Glass Transition:** Navbar background darkens from transparent to `rgba(22, 27, 34, 0.85)` with a 1px border `border-subtle` once scrolled past 50px.
* **Calculator Sliders:** Dragging the volume slider dynamically recomputes monetary values and CO2 savings without page reloading, utilizing subtle spring physics on the numerical output cards.
* **CTA Button Hover:** Hovering over the primary CTA button triggers a subtle radial green gradient expansion and shifts the button upward by `2px` with a drop-shadow glow (`0 8px 24px rgba(45, 106, 79, 0.4)`).

#### 5. Responsive Behavior
* **Desktop ($> 1024\text{px}$):** Two-column hero, 4-column product showcase, horizontal ticker strip.
* **Tablet ($768\text{px} - 1024\text{px}$):** Hero shifts to single-column centered layout; product grid collapses to 2 columns.
* **Mobile ($< 768\text{px}$):**
  * Navbar collapses into a full-screen drawer triggered by a 48px hamburger icon.
  * Ticker items stack into a swipeable horizontal snap carousel.
  * Calculator controls stack vertically above the projection output card.

---

### Screen 2: Platform Administrator Console UI (`/admin/dashboard`)

#### 1. Screen Name
**Executive Admin Control Center & Audit Console (`/admin/dashboard`)**

#### 2. Layout & Wireframe Description
* **Fixed Left Sidebar ($260\text{px}$ width):**
  * Top: Platform logo + "Admin Console" badge.
  * Nav items: "Overview", "Weighbridge Audits", "Pricing Rules Engine", "Consignment Pipeline", "Dispute Resolution", "System Health".
  * Bottom: Super-admin user avatar, name, and "Log Out" icon.
* **Top Header Bar ($64\text{px}$ height):**
  * Breadcrumb navigation (`Admin / Overview`).
  * Live status pill indicator: "PostGIS Cluster: Healthy", "WebSocket Broker: Active".
  * Quick-search input with shortcut badge (`Ctrl + K`).
  * Bell icon with unread audit notification counter.
* **Main Content Area (Fluid Container):**
  * **Top Metrics Row (4 KPI Cards):**
    1. *Platform Gross Value (GMV):* `$384,920` (+14.2% week-on-week).
    2. *Total Material Ingested:* `1,420 Tonnes` (94% verified purity).
    3. *Active Transits in Motion:* `18 Vehicles` (live GPS broadcasting).
    4. *Flagged Discrepancies:* `3 Consignments` (requires supervisor action).
  * **Split Main Panel (65% / 35%):**
    * *Left Panel (65%):* **Weighbridge Audit & Discrepancy Reconciliation Table** displaying batch code, supplier name, declared vs verified weight, variance percentage badge, and inline action buttons ("Approve Tolerance", "Flag Investigation", "Inspect AI Photo").
    * *Right Panel (35%):* **Dynamic Pricing Engine Controller** showing live benchmark prices per commodity with quick-edit inputs for floor prices and moisture penalty multipliers.

#### 3. Design System
* **Colors:** `surface-canvas` (`#0D1117`), `surface-card` (`#161B22`), `border-subtle` (`#30363D`), `status-warning` (`#D29922`), `status-error` (`#F85149`).
* **Typography:** Outfit Semi-Bold 24px for page titles, Inter Medium 14px for table cells, JetBrains Mono 13px for batch codes and monetary values.
* **Components Used:**
  * Sidebar Nav with active item indicator (4px emerald vertical pill).
  * Data Table with sortable headers, sticky table header, and row hover states.
  * Status Badge component with colored dot pulse indicator.
  * Modal dialog for Discrepancy Inspection.

#### 4. User Interactions
* **Table Row Hover:** Hovering over a table row shifts background to `surface-elevated` (`#21262D`) and reveals quick-action button icons.
* **Discrepancy Inspection Modal:** Clicking "Inspect AI Photo" triggers an animated modal popup displaying the original supplier photo alongside the Gemini multimodal vision contamination bounding boxes and suggested grade.
* **Pricing Multiplier Update:** Editing a price floor input inline shows a micro-spinner for 300ms, followed by an emerald checkmark and an ephemeral toast notification ("Rule updated for PLASTIC_PET").

#### 5. Responsive Behavior
* **Desktop ($> 1280\text{px}$):** Standard layout with 260px sidebar, 4 metric cards, and 65/35 split tables.
* **Tablet ($768\text{px} - 1280\text{px}$):** Sidebar collapses to a 64px icon-only rail with tooltips on hover; metric cards wrap to a 2x2 grid.
* **Mobile ($< 768\text{px}$):** Sidebar hidden off-canvas, accessible via hamburger button; tables convert to stacked vertical card lists with horizontal scroll for numeric data.

---

### Screen 3: B2C Eco-Store & Checkout Modal (`/store`)

#### 1. Screen Name
**B2C Eco-Store & Green Reward Points Redemption (`/store`)**

#### 2. Layout & Wireframe Description
* **Store Top Bar:**
  * Search bar with instant autocomplete ("Search compost, recycled planters, upcycled goods...").
  * Category Pill Filters: "All Products", "Organic Compost", "Recycled Polymers", "Eco Building Materials", "Featured Deals".
  * User Rewards Balance Badge: Top right displays "Green Wallet: 1,250 Points ($12.50 value)" with a coin icon.
  * Cart Icon with animated badge counter.
* **Product Catalog Grid (4 Columns):**
  * Individual product cards with:
    * High-res product photograph with an "Upcycled Origin" badge (`From: 100% Post-Industrial PET`).
    * Title and weight/unit specification.
    * Dual Price Display: Fiat Price (e.g., `$24.00`) and Points Option (`or $12.00 + 1,200 pts`).
    * Carbon Avoided Pill: `🌱 -4.5 kg CO2e`.
    * Full-width "Add to Cart" button.
* **Cart Slide-Over Drawer (Right Side, $400\text{px}$ width):**
  * Header with item count and close icon (`X`).
  * Scrollable list of cart items with quantity steppers (`-`, `+`) and trash button.
  * **Green Reward Redemption Slider:** Interactive slider allowing users to slide between 0% and 50% discount using available Green Points.
  * Price Breakdown: Subtotal, Points Applied, Estimated Delivery, Net Total.
  * Primary Button: "Proceed to Checkout (Mock UPI)".
* **Mock UPI Payment Modal Dialog ($480\text{px}$ centered):**
  * Header: "Complete Your Sustainable Purchase".
  * Dynamic UPI QR Code image centered with a countdown timer (5:00 minutes).
  * UPI ID display (`merchant.circular@bank`) with a "Copy UPI ID" button.
  * **Judge Testing Sandbox Strip:** High-contrast yellow/black dashed container labeled *"Hackathon Evaluation Sandbox"* featuring a single-click button: `"⚡ Simulate Instant Payment Success"`.

#### 3. Design System
* **Colors:** `surface-canvas` (`#0D1117`), `surface-card` (`#161B22`), `accent-mint` (`#52B788`), `accent-lime` (`#74C69D`), `text-primary` (`#F0F6FC`).
* **Typography:** Outfit Semi-Bold 20px for product titles, Inter Regular 14px for product descriptions, JetBrains Mono 16px for pricing and currency totals.
* **Components Used:**
  * Slide-over Cart Drawer (`transform: translateX(0)` with smooth ease-out curve).
  * Discount Slider with points equivalent tooltip.
  * Modal overlay with backdrop blur (`backdrop-filter: blur(8px)`).
  * Toast Notifications for "Added to Cart" and "Payment Confirmed".

#### 4. User Interactions
* **Add to Cart Animation:** Clicking "Add to Cart" temporarily shifts button text to "Added!" with an emerald checkmark for 1 second while the cart badge in the header pulses (`scale(1.2) -> scale(1.0)`).
* **Points Slider Drag:** Moving the points slider in real time updates the subtotal, points balance debit, and cash total dynamically with no page refresh.
* **Simulate Payment Click:** Clicking "Simulate Instant Payment Success" triggers an instant loading spinner for 600ms, plays a subtle chime sound, renders a green checkmark animation, and transitions the modal to an **Order Success & Impact Receipt** celebrating total $\text{kg CO}_2\text{e}$ averted.

#### 5. Responsive Behavior
* **Desktop ($> 1024\text{px}$):** 4-column product grid, 400px fixed slide-over cart drawer.
* **Tablet ($768\text{px} - 1024\text{px}$):** 3-column product grid; cart drawer expands to 450px.
* **Mobile ($< 768\text{px}$):**
  * Product grid switches to a 2-column compact card layout.
  * Cart drawer takes over full screen width ($100\text{vw}$).
  * Mock UPI modal spans edge-to-edge as a bottom sheet.

---

### Screen 4: Supplier Intake & Green Rewards Dashboard (`/dashboard/supplier`)

#### 1. Screen Name
**Supplier Consignment & Green Rewards Portal (`/dashboard/supplier`)**

#### 2. Layout & Wireframe Description
* **Left Navigation Sidebar ($240\text{px}$ width):**
  * Nav links: "Overview", "New Intake Declaration", "Active Batches", "Weighbridge Receipts", "Rewards Wallet", "Facility Profile".
* **Dashboard Header:**
  * Greeting ("Welcome back, Apex Polymers").
  * Facility ID badge (`FACILITY-BLR-042`).
  * Prominent "+ New Consignment Intake" emerald CTA button on top right.
* **KPI Metric Cards (3 Columns):**
  1. *Total Diversion:* `48.2 Tonnes` (All-time verified recyclable scrap).
  2. *Segregation Quality Score:* `96.8% Grade A` (AI verified purity).
  3. *Available Green Points:* `3,450 Points` (`$34.50` credit) with a "Redeem in Store" link.
* **Active Consignments Data Table:**
  * Columns: Batch ID, Waste Category, Declared Weight, Verified Weight, Status Badge, QR Code, Actions.
  * Status Badges:
    * `SUBMITTED` (Blue)
    * `IN_TRANSIT` (Purple)
    * `WEIGHED` (Yellow)
    * `VERIFIED` (Green)
    * `FLAGGED_DISCREPANCY` (Red)
* **QR Manifest Quick-Preview Card:**
  * Clicking any QR icon in the table opens an instant slide-out showing the high-resolution printable consignment QR manifest token with batch metadata.

#### 3. Design System
* **Colors:** `surface-canvas` (`#0D1117`), `surface-card` (`#161B22`), `primary-emerald` (`#2D6A4F`), `status-warning` (`#D29922`), `status-error` (`#F85149`).
* **Typography:** Outfit Semi-Bold 22px for section headings, Inter 14px for table rows, JetBrains Mono 13px for batch codes.
* **Components Used:**
  * Metric summary cards with background accent glow.
  * Status Pill badges with high contrast.
  * QR Code canvas render component.
  * Floating action button for intake submission.

#### 4. User Interactions
* **QR Manifest Click:** Clicking the QR thumbnail triggers a modal preview with an instant "Print Manifest Sticker" button that triggers browser print stylesheet formatted for standard 4x6 inch thermal label printers.
* **New Consignment Modal:** Clicking "+ New Consignment Intake" opens a step-by-step modal with drag-and-drop file upload for photos, automatic image preview thumbnails, and a real-time carbon offset estimator based on entered weight.

#### 5. Responsive Behavior
* **Desktop ($> 1024\text{px}$):** Full sidebar, 3-card metric row, full data table.
* **Mobile ($< 768\text{px}$):**
  * Sidebar converts to a mobile bottom navigation bar with icons ("Home", "Intakes", "New (+)", "Wallet", "Profile").
  * Data table transforms into touch-friendly cards showing batch code, status pill, and a large "View QR" button.
