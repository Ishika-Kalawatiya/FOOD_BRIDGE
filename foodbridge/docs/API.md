# FoodBridge API Specification & Contract Reference

**Version**: 2.0.0 (Hardened)  
**Base URL**: `http://localhost:4000` (or `FOODBRIDGE_API_URL`)  
**Standard Error Envelope**: `{ "error": { "code": string, "message": string, "details"?: any } }`

---

## 1. Breaking Changes from v1.0

1. **Authentication Mechanism**:
   - `x-user-id` header is removed for all identity derivation.
   - All protected endpoints now require:
     ```http
     Authorization: Bearer <jwt_token>
     ```
   - Tokens have a **24-hour expiration** and are issued upon successful login or signup.
2. **Login & Signup Endpoints**:
   - `POST /api/users/login` now requires `{ email, password }`. In development only, `{ demoRole: "donor"|"volunteer"|"ngo" }` is permitted when `DEMO_MODE=true` and `NODE_ENV !== 'production'`.
   - `POST /api/users/signup` is introduced for new registrations with `{ name, email, password, role, org? }`.
   - `POST /api/users` legacy endpoint redirects to `/api/users/signup` or requires authentication.
3. **Transition Response Shapes**:
   - `POST /api/listings/:id/claim`, `/collect`, `/distribute` previously returned `{ ok: true }`. They now return the **full updated Listing resource** (`{ id, title, meals, status, ... }`).
4. **Impact Calculation & Definitions**:
   - **"Meals Diverted" Definition**: A meal is counted once pickup is confirmed (`status IN ('picked_up', 'out_for_delivery', 'delivered', 'distributed')`). Unclaimed listings and listings expired prior to collection are never counted.
   - Environmental factors are computed canonically by the backend:
     - `waste_kg = meals * 0.40` (Assumes ~0.4 kg edible portions per meal)
     - `co2e_kg = waste_kg * 2.50` (FAO-derived factor of ~2.5 kg CO2e per kg food waste)
   - `GET /api/impact/summary` returns server-computed `mealsDiverted`, `wasteKg`, and `co2eKg`.
   - `GET /api/impact/monthly` returns `{ monthly: [ ... ], totalMeals, totalWasteKg, totalCo2eKg }`. `?donorId=` optionally scopes to a specific donor's contributions.
5. **Collection Responses & Pagination**:
   - Collections (e.g. `GET /api/listings`) return `{ data: [...], pagination: { total, limit, offset, hasMore } }`.
6. **User Dump Restriction**:
   - `GET /api/users` is restricted. To fetch current profile, use `GET /api/users/me`.
7. **Listing Expiry & Claim Abandonment**:
   - When a listing passes `expires_at` while `status = 'available'`, it is marked `'expired'`.
   - Accepted and not-yet-collected listings that pass `expires_at` are automatically transitioned to `'expired'` and courier assignment is revoked.
8. **Delivery Lifecycle**: `available -> accepted -> arrived_at_pickup -> picked_up -> out_for_delivery -> arrived_at_dropoff -> delivered`. Pickup and drop-off geofences use a 40-meter radius; the courier confirms final delivery manually.

---

## 2. Authentication & User Endpoints

### 2.1 POST /api/users/signup
Registers a new platform user.

**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securePassword123",
  "role": "donor",
  "org": "Downtown Bakery"
}
```
- `role`: Must be one of `"donor"`, `"volunteer"`, `"ngo"`.
- `password`: Minimum 8 characters.

**Success Response `201 Created`**:
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": 4,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "donor",
    "org": "Downtown Bakery",
    "createdAt": "2026-11-25T12:00:00.000Z"
  }
}
```

**Errors**:
- `400 / 422`: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`
- `409`: `{ "error": { "code": "EMAIL_EXISTS", "message": "An account with this email already exists." } }`

---

### 2.2 POST /api/users/login
Authenticates an existing user and returns a 24h JWT.

**Request Body (Standard)**:
```json
{
  "email": "jane@example.com",
  "password": "securePassword123"
}
```

**Request Body (Dev Demo Quick-Login)** *(Only when `DEMO_MODE=true` & `NODE_ENV!=='production'`)*:
```json
{
  "demoRole": "volunteer"
}
```

**Success Response `200 OK`**:
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": 2,
    "name": "Courier Alex",
    "email": "volunteer@foodbridge.org",
    "role": "volunteer",
    "org": "Swift Rescue Network"
  }
}
```

**Errors**:
- `401`: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }`
- `403`: `{ "error": { "code": "DEMO_DISABLED", "message": "Demo quick login is disabled in this environment." } }`

---

### 2.3 GET /api/users/me
Retrieves current authenticated profile.

**Headers**: `Authorization: Bearer <token>`

**Success Response `200 OK`**:
```json
{
  "id": 2,
  "name": "Courier Alex",
  "email": "volunteer@foodbridge.org",
  "role": "volunteer",
  "org": "Swift Rescue Network"
}
```

---

## 3. Surplus Food Listings Endpoints

### 3.1 GET /api/listings
Returns active and historical surplus listings.

**Query Parameters**:
- `status` (optional): `available`, `accepted`, `arrived_at_pickup`, `picked_up`, `out_for_delivery`, `arrived_at_dropoff`, `delivered`, `distributed`, `expired`, `cancelled`
- `limit` (optional, default: 50, max: 100)
- `offset` (optional, default: 0)

**Success Response `200 OK`**:
```json
{
  "data": [
    {
      "id": 1,
      "title": "50 Servings Fresh Veg Curry & Rice",
      "meals": 50,
      "pickupAddress": "Student Center Gate 3, Central Campus",
      "notes": "Packed in sanitized containers",
      "expiresAt": "2026-11-25T14:30:00.000Z",
      "status": "available",
      "urgency": "green",
      "minutesLeft": 135,
      "donor": {
        "id": 1,
        "name": "Campus Canteen Manager",
        "org": "Green Valley Dining Hall",
        "phone": null
      },
      "volunteer": null,
      "ngo": null,
      "createdAt": "2026-11-25T11:45:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

Phone numbers are included only for authenticated listing participants (the donor, assigned volunteer, or selected recipient NGO). Anonymous responses omit contact numbers.

---

### 3.2 POST /api/listings
Creates a new surplus batch.

**Headers**: `Authorization: Bearer <token>` (Must have role: `donor`)

**Request Body**:
```json
{
  "title": "40 Servings Rice & Dal",
  "meals": 40,
  "pickupAddress": "Hostel 3 Kitchen Dock",
  "dropoffAddress": "Hope Community Shelter",
  "ngoId": 3,
  "notes": "Chilled, ready for bicycle or van transport",
  "expiresInMinutes": 120
}
```

**Success Response `201 Created`**:
Returns the complete created `Listing` resource.

---

### 3.3 POST /api/listings/:id/claim
Volunteer courier reserves a batch for delivery.

**Headers**: `Authorization: Bearer <token>` (Must have role: `volunteer`)

**Success Response `200 OK`**:
Returns the complete updated `Listing` resource with `status: "accepted"`, `volunteerId`, and `claimedAt`.

**Errors**:
- `409`: `{ "error": { "code": "ALREADY_CLAIMED", "message": "This listing has already been claimed or has expired." } }`

---

### 3.4 POST /api/listings/:id/arrive
Assigned volunteer confirms arrival when GPS geofencing is unavailable. GPS updates within 40 meters advance to the same status automatically.

**Headers**: `Authorization: Bearer <token>` (Must have role: `volunteer`, must be the claiming volunteer)

**Success Response `200 OK`**:
Returns `{ "id": 1, "status": "arrived_at_pickup", "arrived_at_pickup_at": "..." }`.

### 3.5 POST /api/listings/:id/collect
Assigned volunteer confirms physical pickup after arrival. Returns the updated listing with `status: "picked_up"`.

### 3.6 POST /api/listings/:id/start-delivery
Assigned volunteer starts the drop-off leg after pickup confirmation. Returns `status: "out_for_delivery"`.

### 3.7 POST /api/listings/:id/arrive-dropoff
Assigned volunteer confirms arrival when GPS is unavailable. GPS updates within 40 meters advance to `arrived_at_dropoff`.

### 3.8 POST /api/listings/:id/deliver
Assigned volunteer confirms final handoff after arrival (or directly while en route as a manual fallback). Returns `status: "delivered"`.

### 3.9 POST /api/listings/:id/distribute
Shelter / NGO confirms meal receipt.

**Headers**: `Authorization: Bearer <token>` (Must have role: `ngo`)

**Success Response `200 OK`**:
Returns the updated `Listing` resource with `status: "distributed"`, `ngoId`, and `distributedAt`.

---

### 3.10 POST /api/listings/:id/cancel
Donor cancels an unclaimed surplus posting.

**Headers**: `Authorization: Bearer <token>` (Must have role: `donor`, must be posting owner)

**Success Response `200 OK`**:
Returns the updated `Listing` resource with `status: "cancelled"`.

**Errors**:
- `409`: `{ "error": { "code": "CANNOT_CANCEL", "message": "Cannot cancel a listing that is already claimed or collected." } }`

---

### 3.11 Delivery tracking and map services

- `GET /api/tracking` returns role-scoped courier GPS/status data for authenticated users.
- `POST /api/listings/:id/location` accepts authenticated courier coordinates and automatically advances pickup/drop-off geofences.
- `POST /api/map/route` defaults to `https://router.project-osrm.org`; set `OSRM_BASE_URL` to override the API-side route service. The portal may instead use `VITE_OSRM_BASE_URL` for a direct browser-side override.
- Public routing requires `X-Location-Routing-Consent: public-osrm-v1`. The portal asks once before sending pickup, drop-off, or rider coordinates to the public provider and remembers the choice in local storage. Private/local OSRM deployments do not require that header.
- `GET /api/map/geocode` and `GET /api/map/reverse` use the self-hosted Nominatim service configured by `NOMINATIM_BASE_URL`; those endpoints have no public default.
- The portal uses OpenStreetMap street tiles by default; `VITE_MAP_TILES_URL` can override the tile template. A private tile server can be proxied through `GET /api/map/tiles/:z/:x/:y` with `MAP_TILES_BASE_URL`.
- The public OSRM service is suitable for development demos; production deployments should use a managed or self-hosted router and observe provider terms and usage limits.

## 4. Impact & Community Audit Endpoints

### 4.1 GET /api/impact/summary
Live community diversion metrics.

**Success Response `200 OK`**:
```json
{
  "available": 2,
  "claimed": 1,
  "collected": 3,
  "distributed": 12,
  "activeListings": 3,
  "mealsDiverted": 640,
  "wasteKg": 256.0,
  "co2eKg": 640.0
}
```

---

### 4.2 GET /api/impact/monthly
Monthly diversion trajectory.

**Query Parameters**:
- `donorId` (optional): Filter to single donor organization.

**Success Response `200 OK`**:
```json
{
  "monthly": [
    { "month": "Aug", "meals": 180, "wasteKg": 72.0, "co2eKg": 180.0 },
    { "month": "Sep", "meals": 340, "wasteKg": 136.0, "co2eKg": 340.0 },
    { "month": "Oct", "meals": 520, "wasteKg": 208.0, "co2eKg": 520.0 },
    { "month": "Nov", "meals": 640, "wasteKg": 256.0, "co2eKg": 640.0 }
  ],
  "totalMeals": 640,
  "totalWasteKg": 256.0,
  "totalCo2eKg": 640.0
}
```

---

### 4.3 POST /api/audits/bulk
Bulk upload for physical canteen waste inspection logs. Maintained for `community-audit/audit_sync.py`.

**Headers**: `x-api-key: <AUDIT_API_KEY>`

**Request Body**:
```json
{
  "rows": [
    {
      "audit_date": "2026-11-20",
      "location": "North Campus Canteen",
      "volunteer": "Rohan Gupta",
      "food_type": "Cooked Rice & Lentils",
      "weight_kg": 45.5,
      "meals_served": 110,
      "notes": "Inspected fresh before dispatch"
    }
  ]
}
```

**Success Response `201 Created`**:
```json
{
  "received": 1,
  "inserted": 1,
  "skippedDuplicates": 0
}
```

---

### 4.4 GET /api/audits/summary
Returns physical inspection totals and 8 most recent audits.

---

## 5. System Health & Side Game Endpoints

### 5.1 GET /api/health
Checks database connectivity and server uptime.

**Success Response `200 OK`**:
```json
{
  "status": "ok",
  "uptime": 142.3,
  "database": "connected",
  "version": "0.1.0"
}
```

### 5.2 POST /api/scores & GET /api/scores/leaderboard & GET /api/scores/impact
Side runner game score submissions. Isolated from platform meal totals.

---

## 6. Known Limitations
1. **Unverified NGO Registrations**: Any visitor can register with `role: "ngo"`. Physical verification of NGO certificates (e.g. 12A/80G or Darpan registration) is currently an offline process.
2. **Client-Side JWT Storage**: Tokens are stored in browser `localStorage` and cannot be revoked server-side before their 24h expiration (mitigated by short 24h TTL).
