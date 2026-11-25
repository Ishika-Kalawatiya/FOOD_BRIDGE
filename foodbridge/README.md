# FoodBridge: Surplus Food to Nearby People

**SDG 2 (Zero Hunger) and SDG 12 (Responsible Consumption & Production)**

Restaurants, college canteens, hostels, and catered events often have safe, edible surplus while communities nearby need food. FoodBridge connects them in real time through an integrated React SPA before food safety countdowns lapse.

---

## Unified Rescue Pipeline

```
Donor Posts Surplus ➔ Available ➔ Accepted ➔ Arrived at Pickup ➔ Picked Up ➔ Out for Delivery ➔ Delivered
```

* **Live Expiry Countdown**:
  * 🟢 **2+ hours remaining**: Standard safe window.
  * 🟡 **1 to 2 hours remaining**: Urgent pickup window.
  * 🔴 **Under 1 hour remaining**: Critical window (priority dispatch).
  * Expired unclaimed listings automatically clear from the board.

* **Quantified Community Impact**:
  * Live tracking of verified meals diverted, organic food waste averted (`0.40 kg/meal`), and equivalent greenhouse gas emissions avoided (`2.50 kg CO2e/kg waste`).

---

## Role Pathways

| Role | Route | Description |
|------|-------|-------------|
| **Landing** | `/` | Mission, problem statement, live workflow simulator, four action pathways, and impact preview |
| **Donor / Canteen** | `/donate` | Post surplus food listings with portions, pickup dock address, and safe expiry window |
| **Delivery Partner** | `/courier` | View urgent listings, accept pickups, and deliver food |
| **NGO Shelter Hub** | `/ngo` | View incoming deliveries, confirm receipt, and log distributed portions |
| **Unified Portal** | `/portal`, `/portal/:role` | Multi-role command center with search, status filters, and live stats |
| **Impact & Audits** | `/impact` | Monthly progress trajectory, carbon calculations, and verified physical audit ledger |
| **Side Game** | `/game` | Launch 2D Food Rescue Runner (Phaser mini-game on port 5173) |

---

## Quick Start

### 1. Install Dependencies
```bash
# In project root:
npm --prefix backend install
npm --prefix web-portal install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Start Development Servers
```bash
# Run both Backend API (:4000) and Web Portal (:5174):
npm run dev:all

# Or run separately:
npm run dev:backend   # Express API listening on :4000
npm run dev:portal    # Vite React SPA on http://localhost:5174
```

### 4. Build for Production
```bash
npm run build         # Builds web-portal to dist/ with Vite
```

---

## Architecture & Technology Stack

* **Frontend**: `web-portal/` — Vite 5 + React 19 + Tailwind 4 + Lucide React + React Router v7. Single SPA entry at `web-portal/index.html`.
* **Design System**: Warm Earth & Harvest palette (Cream `#FFF8EC`, Leaf Green `#2F5D3A`, Mango `#F2B33D`, Tomato `#E8643C`) with `Fraunces` display serif and `Quicksand` / `Inter` body sans.
* **Backend**: `backend/` — Node.js Express REST API on `:4000` with PostgreSQL connection and graceful memory-store fallback when local database is offline.
* **Authentication**: Simulated role context via `x-user-id` header (`1` for donor, `2` for volunteer, `3` for ngo).

## Live Delivery Tracking

After signing in, use the fixed **Track Live Map** button to open the full-screen map. Posting a donation opens its pickup-to-drop-off route; accepting a delivery opens navigation automatically. The delivery partner's browser location is shared with the donor and selected NGO views, while location updates require an authenticated courier session. A 40-meter geofence advances the order to **Arrived at Pickup** and **At Delivery Location**; the courier then confirms **Delivered**. Manual arrival, pickup, and delivery controls remain available when GPS geofencing is unavailable.

The map centers on the viewer's device location after browser permission, and the donation form provides current-location and map-pin buttons for either stop without requiring coordinate entry. OpenStreetMap street tiles load by default with attribution; set `VITE_MAP_TILES_URL` to override the tile URL. To use a private tile server, set `MAP_TILES_BASE_URL` on the API and set `VITE_MAP_TILES_URL=/api/map/tiles/{z}/{x}/{y}` in the portal environment. Turn-by-turn routing defaults to the public OSRM demo service, with optional `OSRM_BASE_URL` (API proxy) and `VITE_OSRM_BASE_URL` (direct browser) overrides. Before public routing is used, the map asks for one-time consent because pickup, drop-off, and rider coordinates are sent to the configured public route provider. For production, use a managed or self-hosted router and follow its terms and usage limits. Address lookup and reverse geocoding continue to use self-hosted Nominatim configured by `NOMINATIM_BASE_URL`.

Delivery partners can choose **Start Demo Simulation**, **Pause Demo**, or **Use Live GPS** in the tracking panel. The demo vehicle follows the OSRM street polyline, updates its heading and location, and advances the lifecycle at the pickup and drop-off geofences. The landing page tells a scroll-driven zero-gravity rescue story: meal tins lift from a kitchen counter, cross a glowing portal bridge, and settle at a shelter table, followed by a role-aware bento dashboard, live rescue feed, route preview, and impact counters. Demo listings include pickup/drop-off coordinates so the map and simulated routes work immediately.

Authenticated listing participants can access each other's profile phone numbers for handoff calls; unauthenticated listing responses do not include phone numbers. Status updates are polled every five seconds, shown as in-app toasts and a per-user notification feed persisted in browser storage, and also use the browser Notification API when permission is granted.

Apply database changes before using the live tracking API:

```bash
npm run db:migrate
```

The delivery arrival-at-drop-off stage and timestamp are included in migration `005_delivery_handoff_contacts.sql`.
