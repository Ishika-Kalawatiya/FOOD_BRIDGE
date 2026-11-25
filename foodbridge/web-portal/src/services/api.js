/**
 * FoodBridge Unified API Client & Resilient Fallback Service
 * 
 * Communicates with backend endpoints (/api/listings, /api/impact/monthly, /api/users, etc.)
 * adding the required `x-user-id` header for authenticated role context.
 * 
 * Provides an in-memory/localStorage fallback when the backend is unreachable,
 * alerting components via isDemoMode flag.
 */

import { calculateWasteKg, calculateCo2eKg } from "../constants/impact";

let demoModeListeners = new Set();
let isDemoModeActive = false;

export function subscribeDemoMode(callback) {
  demoModeListeners.add(callback);
  callback(isDemoModeActive);
  return () => demoModeListeners.delete(callback);
}

function setDemoMode(active) {
  if (isDemoModeActive !== active) {
    isDemoModeActive = active;
    demoModeListeners.forEach((fn) => fn(active));
  }
}

export function getIsDemoMode() {
  return isDemoModeActive;
}

// Initial Seed Data for local fallback mode
export const SEED_USERS = {
  donor: { id: 1, name: "Campus Canteen Manager", role: "donor", org: "Green Valley Dining Hall", phone: "+91 98765 43210" },
  volunteer: { id: 2, name: "Courier Alex", role: "volunteer", org: "Swift Rescue Network", phone: "+91 98765 43211" },
  ngo: { id: 3, name: "Hope Community Shelter", role: "ngo", org: "Hope Shelter Kitchen", phone: "+91 98765 43212" },
};

export const SEED_LISTINGS = [
  {
    id: 1,
    donor_id: 1,
    donor_name: "Green Valley Dining Hall",
    donor_org: "Campus Canteen",
    title: "50 Servings Fresh Veg Curry & Rice",
    meals: 50,
    pickup_address: "Student Center Gate 3, Central Campus",
    pickup_latitude: 12.9716,
    pickup_longitude: 77.5946,
    dropoff_address: null,
    dropoff_latitude: null,
    dropoff_longitude: null,
    notes: "Packed in sanitized hot containers. Ready for immediate pickup.",
    expires_at: new Date(Date.now() + 140 * 60000).toISOString(), // ~2h 20m (Green)
    safe_until: new Date(Date.now() + 140 * 60000).toISOString(),
    status: "available",
    volunteer_id: null,
    volunteer_name: null,
    ngo_id: null,
    ngo_org: null,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 2,
    donor_id: 1,
    donor_name: "Green Valley Dining Hall",
    donor_org: "Campus Canteen",
    title: "35 Packets Fresh Sandwiches & Fruit",
    meals: 35,
    pickup_address: "Faculty Club Dining, West Wing",
    pickup_latitude: 12.9682,
    pickup_longitude: 77.587,
    dropoff_address: "Hope Community Shelter, Central Campus",
    dropoff_latitude: 12.9796,
    dropoff_longitude: 77.604,
    notes: "Vegetarian and vegan options clearly labeled.",
    expires_at: new Date(Date.now() + 75 * 60000).toISOString(), // ~1h 15m (Yellow)
    safe_until: new Date(Date.now() + 75 * 60000).toISOString(),
    status: "available",
    volunteer_id: null,
    volunteer_name: null,
    ngo_id: 3,
    ngo_org: "Hope Community Shelter",
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: 3,
    donor_id: 1,
    donor_name: "Green Valley Dining Hall",
    donor_org: "Campus Canteen",
    title: "20 Servings Bakery Rolls & Muffins",
    meals: 20,
    pickup_address: "Bakery Hub, North Gate Entrance",
    notes: "Freshly baked this morning.",
    expires_at: new Date(Date.now() + 40 * 60000).toISOString(), // ~40m (Red / Urgent)
    safe_until: new Date(Date.now() + 40 * 60000).toISOString(),
    status: "available",
    volunteer_id: null,
    volunteer_name: null,
    ngo_id: null,
    ngo_org: null,
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 4,
    donor_id: 1,
    donor_name: "Green Valley Dining Hall",
    donor_org: "Campus Canteen",
    title: "40 Portions Pasta & Salad Trays",
    meals: 40,
    pickup_address: "Main Kitchen Receiving Dock",
    pickup_latitude: 12.9716,
    pickup_longitude: 77.5946,
    dropoff_address: "Hope Community Shelter, Central Campus",
    dropoff_latitude: 12.9796,
    dropoff_longitude: 77.604,
    notes: "Chilled storage. Van pickup required.",
    expires_at: new Date(Date.now() + 90 * 60000).toISOString(),
    safe_until: new Date(Date.now() + 90 * 60000).toISOString(),
    status: "accepted",
    volunteer_id: 2,
    volunteer_name: "Courier Alex",
    ngo_id: 3,
    ngo_org: "Hope Shelter Kitchen",
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
    claimed_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 5,
    donor_id: 1,
    donor_name: "Green Valley Dining Hall",
    donor_org: "Campus Canteen",
    title: "60 Servings Steamed Rice & Dal",
    meals: 60,
    pickup_address: "Hostel 4 Canteen Kitchen",
    notes: "Delivered to Hope Shelter.",
    expires_at: new Date(Date.now() - 10 * 60000).toISOString(),
    safe_until: new Date(Date.now() - 10 * 60000).toISOString(),
    status: "distributed",
    volunteer_id: 2,
    volunteer_name: "Courier Alex",
    ngo_id: 3,
    ngo_org: "Hope Community Shelter",
    created_at: new Date(Date.now() - 180 * 60000).toISOString(),
    distributed_at: new Date(Date.now() - 20 * 60000).toISOString(),
  },
];

function getStoredListings() {
  try {
    const raw = localStorage.getItem("fb_mock_listings");
    if (raw) {
      const listings = JSON.parse(raw).map((listing) => ({
        ...listing,
        status: listing.status === "claimed" ? "accepted" : listing.status === "collected" ? "out_for_delivery" : listing.status,
      }));
      localStorage.setItem("fb_mock_listings", JSON.stringify(listings));
      return listings;
    }
  } catch (_e) {}
  localStorage.setItem("fb_mock_listings", JSON.stringify(SEED_LISTINGS));
  return SEED_LISTINGS;
}

function setStoredListings(listings) {
  try {
    localStorage.setItem("fb_mock_listings", JSON.stringify(listings));
  } catch (_e) {}
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      setDemoMode(false);
      return true;
    }
    setDemoMode(false);
    return false;
  } catch (_networkErr) {
    setDemoMode(true);
    return false;
  }
}

/**
 * Execute HTTP API requests with fallback to local mock store on connection failure.
 */
export async function apiCall(path, { method = "GET", body, userId, headers: extraHeaders = {} } = {}) {
  const currentUserId = userId || localStorage.getItem("fb_user_id") || "1";
  const token = localStorage.getItem("fb_token");

  try {
    const headers = {
      "Content-Type": "application/json",
      "x-user-id": String(currentUserId),
      ...extraHeaders,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        typeof data.error === "object"
          ? data.error?.message || "Operation failed."
          : data.error || data.message || `Request failed with status ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.code = data.error?.code || data.code;
      err.details = data.error?.details || data.details;
      err.data = data;

      // Handle token expiration or unauthorized sessions
      if (res.status === 401 && (err.code === "TOKEN_EXPIRED" || err.code === "UNAUTHENTICATED")) {
        localStorage.removeItem("fb_token");
        window.dispatchEvent(new CustomEvent("foodbridge:session-expired", { detail: { message } }));
      }

      // Real backend response (4xx/5xx) -> not demo mode
      setDemoMode(false);
      throw err;
    }

    setDemoMode(false);
    return data;
  } catch (err) {
    // If backend returns an explicit HTTP error status (400, 401, 403, 409, 500), rethrow it!
    if (err.status) {
      setDemoMode(false);
      throw err;
    }

    // Only for network error (Failed to fetch, connection refused, offline):
    console.warn(`[FoodBridge API] Backend unreachable at ${path}. Using offline fallback.`);
    setDemoMode(true);
    return handleLocalMockApi(path, method, body, currentUserId);
  }
}

function handleLocalMockApi(path, method, body, userId) {
  let listings = getStoredListings();

  // GET /api/listings
  if (path.startsWith("/api/listings") && method === "GET") {
    const now = Date.now();
    return listings.filter((l) => l.status !== "available" || !l.expires_at || new Date(l.expires_at).getTime() > now);
  }

  // POST /api/listings
  if (path === "/api/listings" && method === "POST") {
    const safeUntilDate = body.safe_until
      ? new Date(body.safe_until)
      : new Date(Date.now() + (Number(body.expiresInMinutes) || 120) * 60000);

    const newListing = {
      id: Date.now(),
      donor_id: Number(userId) || 1,
      donor_name: body.donor_name || "Green Valley Dining Hall",
      donor_org: body.donor_org || "Campus Canteen",
      title: body.title,
      meals: Number(body.meals),
      pickup_address: body.pickup_address || body.pickupAddress,
      pickup_latitude: body.pickupLatitude ?? null,
      pickup_longitude: body.pickupLongitude ?? null,
      dropoff_address: body.dropoffAddress || null,
      dropoff_latitude: body.dropoffLatitude ?? null,
      dropoff_longitude: body.dropoffLongitude ?? null,
      notes: body.notes || "",
      expires_at: safeUntilDate.toISOString(),
      safe_until: safeUntilDate.toISOString(),
      status: "available",
      volunteer_id: null,
      volunteer_name: null,
      ngo_id: body.ngoId ? Number(body.ngoId) : null,
      ngo_org: Object.values(SEED_USERS).find((partner) => partner.id === Number(body.ngoId))?.org || null,
      created_at: new Date().toISOString(),
    };
    listings.unshift(newListing);
    setStoredListings(listings);
    return newListing;
  }

  // POST /api/listings/:id/accept-ngo
  if (path.match(/\/api\/listings\/\d+\/accept-ngo/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");
    if (item.status !== "available") {
      const conflictErr = new Error("Only available donations can be accepted by an NGO.");
      conflictErr.status = 409;
      throw conflictErr;
    }
    const ngoUser = Object.values(SEED_USERS).find((partner) => partner.id === Number(userId)) || SEED_USERS.ngo;
    item.ngo_id = Number(userId) || ngoUser.id;
    item.ngo_org = ngoUser.org || ngoUser.name;
    item.dropoff_address = body?.dropoffAddress || item.dropoff_address;
    item.dropoff_latitude = body?.dropoffLatitude ?? item.dropoff_latitude;
    item.dropoff_longitude = body?.dropoffLongitude ?? item.dropoff_longitude;
    setStoredListings(listings);
    return item;
  }

  // POST /api/listings/:id/notify-volunteers
  if (path.match(/\/api\/listings\/\d+\/notify-volunteers/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");
    const alert = {
      id: `volunteer-dispatch-${item.id}-${Date.now()}`,
      listingId: item.id,
      title: item.title,
      meals: Number(item.meals),
      pickupAddress: item.pickup_address || item.pickupAddress,
      dropoffAddress: item.dropoff_address || item.dropoffAddress || "Drop-off pending",
      donorName: item.donor_org || item.donor_name || "Food Donor",
      ngoOrg: item.ngo_org || "Community Shelter",
      notes: item.notes || "",
      expiresAt: item.expires_at || item.safe_until,
      createdAt: new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem("fb_volunteer_broadcasts") || "[]").filter((a) => a.listingId !== alert.listingId);
      existing.unshift(alert);
      localStorage.setItem("fb_volunteer_broadcasts", JSON.stringify(existing.slice(0, 50)));
    } catch (_e) {}
    return { alert, notified: true };
  }

  if (path === "/api/volunteer-alerts" && method === "GET") {
    try {
      return { data: JSON.parse(localStorage.getItem("fb_volunteer_broadcasts") || "[]") };
    } catch (_e) {
      return { data: [] };
    }
  }

  // POST /api/listings/:id/claim
  if (path.match(/\/api\/listings\/\d+\/claim/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");

    if (item.status !== "available") {
      const conflictErr = new Error("This listing has already been claimed by another courier.");
      conflictErr.status = 409;
      throw conflictErr;
    }

    item.status = "accepted";
    item.volunteer_id = Number(userId) || 2;
    const volunteer = Object.values(SEED_USERS).find((partner) => partner.id === item.volunteer_id) || SEED_USERS.volunteer;
    item.volunteer_name = volunteer.name;
    item.claimed_at = new Date().toISOString();
    setStoredListings(listings);
    return item;
  }

  // POST /api/listings/:id/collect
  if (path.match(/\/api\/listings\/\d+\/collect/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");
    if (item.status !== "arrived_at_pickup") {
      const stateError = new Error("Confirm arrival at pickup before confirming collection.");
      stateError.status = 409;
      throw stateError;
    }
    item.status = "picked_up";
    item.collected_at = new Date().toISOString();
    setStoredListings(listings);
    return item;
  }

  if (path.match(/\/api\/listings\/\d+\/arrive/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item || item.status !== "accepted") throw new Error("This delivery is not awaiting pickup arrival.");
    item.status = "arrived_at_pickup";
    item.arrived_at_pickup_at = new Date().toISOString();
    setStoredListings(listings);
    return item;
  }

  if (path.match(/\/api\/listings\/\d+\/start-delivery/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item || item.status !== "picked_up") throw new Error("Confirm pickup before starting delivery.");
    item.status = "out_for_delivery";
    item.out_for_delivery_at = new Date().toISOString();
    setStoredListings(listings);
    return item;
  }

  // POST /api/listings/:id/distribute
  if (path.match(/\/api\/listings\/\d+\/distribute/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");
    item.status = "distributed";
    item.ngo_id = Number(userId) || 3;
    item.ngo_org = "Hope Community Shelter";
    item.distributed_at = new Date().toISOString();
    setStoredListings(listings);
    return item;
  }

  if (path === "/api/tracking" && method === "GET") {
    return {
      data: listings
        .filter((item) => ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff", "delivered"].includes(item.status))
        .map((item) => ({
          id: item.id,
          status: item.status,
          pickupLatitude: item.pickup_latitude ?? null,
          pickupLongitude: item.pickup_longitude ?? null,
          dropoffLatitude: item.dropoff_latitude ?? null,
          dropoffLongitude: item.dropoff_longitude ?? null,
          volunteerLatitude: item.volunteer_latitude ?? null,
          volunteerLongitude: item.volunteer_longitude ?? null,
          volunteerLocationUpdatedAt: item.volunteer_location_updated_at ?? null,
          deliveredAt: item.delivered_at ?? null,
        })),
    };
  }

  if (path.match(/\/api\/listings\/\d+\/location/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((listing) => listing.id === id);
    if (!item) throw new Error("Listing not found");
    item.volunteer_latitude = body.latitude;
    item.volunteer_longitude = body.longitude;
    item.volunteer_location_updated_at = new Date().toISOString();
    const pickup = item.pickup_latitude == null || item.pickup_longitude == null
      ? null
      : { latitude: Number(item.pickup_latitude), longitude: Number(item.pickup_longitude) };
    const dropoff = item.dropoff_latitude == null || item.dropoff_longitude == null
      ? null
      : { latitude: Number(item.dropoff_latitude), longitude: Number(item.dropoff_longitude) };
    const distance = (point) => {
      const radians = (value) => (value * Math.PI) / 180;
      const dLat = radians(point.latitude - body.latitude);
      const dLng = radians(point.longitude - body.longitude);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(radians(body.latitude)) * Math.cos(radians(point.latitude)) * Math.sin(dLng / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    if (item.status === "accepted" && pickup && distance(pickup) <= 40) {
      item.status = "arrived_at_pickup";
      item.arrived_at_pickup_at = new Date().toISOString();
    }
    if (item.status === "out_for_delivery" && dropoff && distance(dropoff) <= 40) {
      item.status = "arrived_at_dropoff";
      item.arrived_at_dropoff_at = new Date().toISOString();
    }
    setStoredListings(listings);
    return { id, status: item.status, latitude: body.latitude, longitude: body.longitude };
  }

  if (path.match(/\/api\/listings\/\d+\/arrive-dropoff/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((listing) => listing.id === id);
    if (!item || item.status !== "out_for_delivery") {
      const stateError = new Error("This delivery is not currently out for delivery.");
      stateError.status = 409;
      throw stateError;
    }
    item.status = "arrived_at_dropoff";
    item.arrived_at_dropoff_at = new Date().toISOString();
    setStoredListings(listings);
    return item;
  }

  if (path.match(/\/api\/listings\/\d+\/deliver/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((listing) => listing.id === id);
    if (!item) throw new Error("Listing not found");
    if (!["out_for_delivery", "arrived_at_dropoff"].includes(item.status)) {
      const stateError = new Error("This delivery must be en route or at the drop-off before it can be marked delivered.");
      stateError.status = 409;
      throw stateError;
    }
    item.status = "delivered";
    item.delivered_at = new Date().toISOString();
    setStoredListings(listings);
    return item;
  }

  // POST /api/listings/:id/cancel
  if (path.match(/\/api\/listings\/\d+\/cancel/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const item = listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");
    item.status = "cancelled";
    setStoredListings(listings);
    return item;
  }

  // POST /api/users/login
  if (path === "/api/users/login" && method === "POST") {
    const roleKey = body?.demoRole || body?.role || "donor";
    const seed = SEED_USERS[roleKey] || SEED_USERS.donor;
    return {
      id: seed.id,
      name: body?.name || seed.name,
      role: roleKey,
      org: body?.org || seed.org,
      phone: seed.phone,
    };
  }

  // POST /api/users
  if (path === "/api/users" && method === "POST") {
    return {
      id: Date.now(),
      name: body?.name || "New Member",
      role: body?.role || "donor",
      org: body?.org || "Community Partner",
      phone: body?.phone || null,
    };
  }

  if ((path === "/api/users/partners" || path === "/api/users") && method === "GET") {
    return { data: Object.values(SEED_USERS).map(({ id, name, role, org }) => ({ id, name, role, org })) };
  }

  // GET /api/impact/monthly or /summary
  if (path.includes("/api/impact")) {
    const now = Date.now();
    const collectedAndDistributed = listings.filter((l) => ["picked_up", "out_for_delivery", "delivered", "distributed"].includes(l.status));
    const totalMeals = collectedAndDistributed.reduce((sum, l) => sum + (l.meals || 0), 0);
    const availableCount = listings.filter((l) => l.status === "available" && (!l.expires_at || new Date(l.expires_at).getTime() > now)).length;
    const activeCount = availableCount + listings.filter((l) => ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff"].includes(l.status)).length;

    return {
      available: availableCount,
      active_listings: activeCount,
      meals_diverted: totalMeals,
      meals: totalMeals,
      waste_kg: calculateWasteKg(totalMeals),
      co2e_kg: calculateCo2eKg(totalMeals),
      monthly: [
        { month: "Aug", meals: 180, waste_kg: 72 },
        { month: "Sep", meals: 340, waste_kg: 136 },
        { month: "Oct", meals: 520, waste_kg: 208 },
        { month: "Nov", meals: totalMeals || 610, waste_kg: Math.round((totalMeals || 610) * 0.4) },
      ],
    };
  }

  // GET /api/audits/summary
  if (path.includes("/api/audits")) {
    return {
      verified_meals: 450,
      total_kg: 180.0,
      audits: 12,
      recent: [
        { audit_date: "2026-10-04", location: "Central Dining Hall", food_type: "Veg Meals", weight_kg: 40, meals_served: 100 },
        { audit_date: "2026-10-03", location: "West Canteen", food_type: "Sandwiches", weight_kg: 15, meals_served: 37 },
      ],
    };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* High-Level Helper Functions                                                */
/* -------------------------------------------------------------------------- */

function normalizeListing(item) {
  const status = item.status === "claimed" ? "accepted" : item.status === "collected" ? "out_for_delivery" : item.status;
  const donorId = item.donor_id ?? item.donor?.id ?? null;
  const volunteerId = item.volunteer_id ?? item.volunteer?.id ?? null;
  const ngoId = item.ngo_id ?? item.ngo?.id ?? null;
  const viewerId = Number(localStorage.getItem("fb_user_id"));
  const signedIn = Boolean(localStorage.getItem("fb_user"));
  const isParticipant = signedIn && [donorId, volunteerId, ngoId].some((id) => id != null && Number(id) === viewerId);
  const demoPhone = (id) => getIsDemoMode()
    ? Object.values(SEED_USERS).find((partner) => partner.id === Number(id))?.phone || null
    : null;
  return {
    ...item,
    status,
    pickup_address: item.pickup_address || item.pickupAddress || "",
    dropoff_address: item.dropoff_address || item.dropoffAddress || "",
    expires_at: item.expires_at || item.expiresAt || null,
    safe_until: item.safe_until || item.safeUntil || item.expiresAt || null,
    created_at: item.created_at || item.createdAt || null,
    pickup_latitude: item.pickup_latitude ?? item.pickupLatitude ?? null,
    pickup_longitude: item.pickup_longitude ?? item.pickupLongitude ?? null,
    dropoff_latitude: item.dropoff_latitude ?? item.dropoffLatitude ?? null,
    dropoff_longitude: item.dropoff_longitude ?? item.dropoffLongitude ?? null,
    volunteer_latitude: item.volunteer_latitude ?? item.volunteerLatitude ?? null,
    volunteer_longitude: item.volunteer_longitude ?? item.volunteerLongitude ?? null,
    volunteer_location_updated_at: item.volunteer_location_updated_at || item.volunteerLocationUpdatedAt || null,
    delivered_at: item.delivered_at || item.deliveredAt || null,
    claimed_at: item.claimed_at || item.claimedAt || null,
    arrived_at_pickup_at: item.arrived_at_pickup_at || item.arrivedAtPickupAt || null,
    arrived_at_dropoff_at: item.arrived_at_dropoff_at || item.arrivedAtDropoffAt || null,
    collected_at: item.collected_at || item.collectedAt || null,
    out_for_delivery_at: item.out_for_delivery_at || item.outForDeliveryAt || null,
    donor_id: donorId,
    donor_name: item.donor_name || item.donor?.name,
    donor_org: item.donor_org || item.donor?.org,
    volunteer_id: volunteerId,
    volunteer_name: item.volunteer_name || item.volunteer?.name,
    ngo_org: item.ngo_org || item.ngo?.org,
    ngo_id: ngoId,
    donor: {
      ...(item.donor || {}),
      id: donorId,
      name: item.donor?.name || item.donor_name || item.donor_org || "Food donor",
      org: item.donor?.org || item.donor_org || null,
      phone: item.donor?.phone || (isParticipant ? item.donor_phone || demoPhone(donorId) : null),
    },
    volunteer: volunteerId == null ? null : {
      ...(item.volunteer || {}),
      id: volunteerId,
      name: item.volunteer?.name || item.volunteer_name || "Delivery partner",
      phone: item.volunteer?.phone || (isParticipant ? item.volunteer_phone || demoPhone(volunteerId) : null),
    },
    ngo: ngoId == null ? null : {
      ...(item.ngo || {}),
      id: ngoId,
      name: item.ngo?.name || item.ngo_name || item.ngo_org || "Community shelter",
      org: item.ngo?.org || item.ngo_org || null,
      phone: item.ngo?.phone || (isParticipant ? item.ngo_phone || demoPhone(ngoId) : null),
    },
  };
}

export async function fetchListings() {
  const response = await apiCall("/api/listings");
  const listings = Array.isArray(response) ? response : response.data || [];
  if (localStorage.getItem("fb_token")) {
    const tracking = await apiCall("/api/tracking");
    const trackingById = new Map((tracking.data || []).map((item) => [item.id, item]));
    return listings.map((item) => normalizeListing({ ...item, ...trackingById.get(item.id) }));
  }
  return listings.map(normalizeListing);
}

export async function createListing(data, user) {
  const mins = Number(data.expiresInMinutes) || (data.safe_until ? Math.max(15, Math.min(1440, Math.floor((new Date(data.safe_until) - Date.now()) / 60000))) : 120);
  const payload = {
    title: data.title,
    meals: Number(data.meals),
    pickupAddress: data.pickupAddress || data.pickup_address,
    dropoffAddress: data.dropoffAddress || data.dropoff_address,
    pickupLatitude: data.pickupLatitude ?? data.pickup_latitude ?? null,
    pickupLongitude: data.pickupLongitude ?? data.pickup_longitude ?? null,
    dropoffLatitude: data.dropoffLatitude ?? data.dropoff_latitude ?? null,
    dropoffLongitude: data.dropoffLongitude ?? data.dropoff_longitude ?? null,
    ngoId: data.ngoId || null,
    notes: data.notes || null,
    expiresInMinutes: mins,
  };
  return normalizeListing(await apiCall("/api/listings", {
    method: "POST",
    body: payload,
    userId: user?.id || 1,
  }));
}

export async function claimListing(id, user) {
  return apiCall(`/api/listings/${id}/claim`, {
    method: "POST",
    userId: user?.id || 2,
  });
}

export async function acceptNgoListing(id, dropoffData, user) {
  return normalizeListing(await apiCall(`/api/listings/${id}/accept-ngo`, {
    method: "POST",
    body: {
      dropoffAddress: dropoffData.dropoffAddress,
      dropoffLatitude: Number(dropoffData.dropoffLatitude),
      dropoffLongitude: Number(dropoffData.dropoffLongitude),
    },
    userId: user?.id || 3,
  }));
}

export async function notifyVolunteersForListing(listing, user) {
  const res = await apiCall(`/api/listings/${listing.id}/notify-volunteers`, {
    method: "POST",
    userId: user?.id || 3,
  });
  const alert = res?.alert || {
    id: `volunteer-dispatch-${listing.id}-${Date.now()}`,
    listingId: listing.id,
    title: listing.title,
    meals: Number(listing.meals),
    pickupAddress: listing.pickup_address || listing.pickupAddress,
    dropoffAddress: listing.dropoff_address || listing.dropoffAddress || "Shelter Drop-off",
    donorName: listing.donor_org || listing.donor_name || "Food Donor",
    ngoOrg: listing.ngo_org || user?.org || "Community Shelter",
    notes: listing.notes || "",
    expiresAt: listing.expires_at || listing.safe_until,
    createdAt: new Date().toISOString(),
  };
  try {
    const existing = JSON.parse(localStorage.getItem("fb_volunteer_broadcasts") || "[]").filter((a) => a.listingId !== alert.listingId);
    existing.unshift(alert);
    localStorage.setItem("fb_volunteer_broadcasts", JSON.stringify(existing.slice(0, 50)));
    window.dispatchEvent(new CustomEvent("foodbridge:volunteer-broadcast", { detail: alert }));
  } catch (_e) {}
  return alert;
}

export async function fetchVolunteerAlerts() {
  const res = await apiCall("/api/volunteer-alerts");
  return res?.data || [];
}

export async function collectListing(id, user) {
  return apiCall(`/api/listings/${id}/collect`, {
    method: "POST",
    userId: user?.id || 2,
  });
}

export async function markArrivedAtPickup(id, user) {
  return apiCall(`/api/listings/${id}/arrive`, { method: "POST", userId: user?.id || 2 });
}

export async function startDelivery(id, user) {
  return apiCall(`/api/listings/${id}/start-delivery`, { method: "POST", userId: user?.id || 2 });
}

export async function markArrivedAtDropoff(id, user) {
  return apiCall(`/api/listings/${id}/arrive-dropoff`, { method: "POST", userId: user?.id || 2 });
}

export async function distributeListing(id, user) {
  return apiCall(`/api/listings/${id}/distribute`, {
    method: "POST",
    userId: user?.id || 3,
  });
}

export async function updateDeliveryLocation(id, position) {
  return apiCall(`/api/listings/${id}/location`, {
    method: "POST",
    body: { latitude: position.latitude, longitude: position.longitude },
  });
}

export async function markListingDelivered(id) {
  return apiCall(`/api/listings/${id}/deliver`, { method: "POST" });
}

export async function cancelListing(id, user) {
  return apiCall(`/api/listings/${id}/cancel`, {
    method: "POST",
    userId: user?.id || 1,
  });
}

export async function loginUser(credentials) {
  return apiCall("/api/users/login", {
    method: "POST",
    body: credentials,
  });
}

export async function registerUser(userData) {
  return apiCall("/api/users", {
    method: "POST",
    body: userData,
  });
}

export async function fetchPartners() {
  const response = await apiCall("/api/users/partners");
  return Array.isArray(response) ? response : response.data || [];
}

export async function fetchImpactSummary() {
  return apiCall("/api/impact/summary");
}

export async function fetchMonthlyImpact() {
  return apiCall("/api/impact/monthly");
}

export async function fetchAuditSummary() {
  return apiCall("/api/audits/summary");
}

function getStoredDemoCertificates() {
  try {
    return JSON.parse(localStorage.getItem("fb_demo_certificates") || "[]");
  } catch (_e) {
    return [];
  }
}

function saveDemoCertificate(cert) {
  try {
    const existing = getStoredDemoCertificates().filter((item) => item.id !== cert.id);
    existing.unshift(cert);
    localStorage.setItem("fb_demo_certificates", JSON.stringify(existing));
  } catch (_e) {}
}

function handleOfflineCertificateIssue({ name, lanternId }) {
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("fb_user") || "null");
    } catch (_e) {
      return null;
    }
  })();
  const role = user?.role || localStorage.getItem("fb_user_role") || "donor";
  const userId = Number(user?.id || localStorage.getItem("fb_user_id") || 0);
  const cleanedName = String(name || user?.name || "").trim().replace(/\s+/g, " ");
  if (!cleanedName) {
    throw new Error("Please enter your name for the certificate.");
  }
  if (user?.name && cleanedName.toLowerCase() !== String(user.name).trim().replace(/\s+/g, " ").toLowerCase()) {
    throw new Error("Use the name on your signed-in FoodBridge account so the certificate can be verified.");
  }

  const listings = getStoredListings();
  const qualifying = listings.find((l) => {
    if (role === "donor") {
      return Number(l.donor_id) === userId && !["cancelled", "expired"].includes(l.status);
    }
    if (role === "volunteer") {
      return Number(l.volunteer_id) === userId && ["delivered", "distributed"].includes(l.status);
    }
    if (role === "ngo") {
      return Number(l.ngo_id) === userId && !["cancelled", "expired"].includes(l.status);
    }
    return false;
  });

  if (!qualifying) {
    const actionHint = role === "donor"
      ? "Make a food donation first before lighting a service lantern."
      : role === "volunteer"
      ? "Deliver a volunteer order first before lighting a service lantern."
      : "Accept and confirm a shelter order first before lighting a service lantern.";
    throw new Error(actionHint);
  }

  const id = `FB-DEMO-${role.toUpperCase()}-${lanternId.toUpperCase()}`;
  const existing = getStoredDemoCertificates().find((item) => item.id === id && item.name.toLowerCase() === cleanedName.toLowerCase());
  if (existing) return existing;

  const cert = {
    id,
    name: user?.name || cleanedName,
    role,
    lanternId,
    serviceTitle: qualifying.title || "Community Food Rescue",
    meals: Number(qualifying.meals || 40),
    issuedAt: new Date().toISOString(),
    demoMode: true,
  };
  saveDemoCertificate(cert);
  return cert;
}

async function certificateCall(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("fb_token");
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (_error) {
    setDemoMode(true);
    if (path === "/api/certificates" && options.method === "POST") {
      return { certificate: handleOfflineCertificateIssue(options.body || {}), verified: true };
    }
    const certId = decodeURIComponent(path.replace("/api/certificates/", ""));
    const found = getStoredDemoCertificates().find((item) => item.id === certId);
    if (found) {
      return { verified: true, certificate: found, message: "Verified in offline demo mode." };
    }
    throw new Error("The certificate registry is unavailable. Please reconnect and try again.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || "Certificate request failed.";
    if (response.status === 401) {
      localStorage.removeItem("fb_token");
      window.dispatchEvent(new CustomEvent("foodbridge:session-expired", { detail: { message } }));
    }
    throw new Error(message);
  }
  setDemoMode(false);
  return data;
}

export async function issueServiceCertificate({ name, lanternId }) {
  const response = await certificateCall("/api/certificates", {
    method: "POST",
    body: { name, lanternId },
  });
  if (!response.certificate?.id || response.verified !== true) {
    throw new Error("The certificate registry returned an invalid credential.");
  }
  return response.certificate;
}

export async function verifyServiceCertificate(certificateId) {
  const response = await certificateCall(`/api/certificates/${encodeURIComponent(certificateId)}`);
  if (!response.certificate || typeof response.verified !== "boolean") {
    throw new Error("The certificate registry returned an invalid verification response.");
  }
  return response;
}
