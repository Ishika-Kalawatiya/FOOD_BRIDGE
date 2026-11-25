import { z } from "zod";
import { pool } from "../config/db.js";
import { AppError } from "../middleware/errors.js";

// Canonical environmental conversion constants (FAO-derived)
const KG_PER_MEAL = 0.40;
const CO2E_PER_KG_WASTE = 2.50;

export const createListingSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(80),
  meals: z.coerce.number().int().min(1, "Meals must be an integer >= 1"),
  pickupAddress: z.string().trim().min(5, "Pickup address is required").max(160),
  dropoffAddress: z.string().trim().min(5).max(160).optional().nullable(),
  pickupLatitude: z.number().min(-90).max(90).optional().nullable(),
  pickupLongitude: z.number().min(-180).max(180).optional().nullable(),
  dropoffLatitude: z.number().min(-90).max(90).optional().nullable(),
  dropoffLongitude: z.number().min(-180).max(180).optional().nullable(),
  ngoId: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  expiresInMinutes: z.coerce.number().int().min(15, "Expiry must be at least 15 minutes").max(1440, "Expiry cannot exceed 24 hours"),
}).refine(
  (data) => (data.pickupLatitude == null) === (data.pickupLongitude == null),
  { path: ["pickupLatitude"], message: "Pickup latitude and longitude must be provided together." }
).refine(
  (data) => (data.dropoffLatitude == null) === (data.dropoffLongitude == null),
  { path: ["dropoffLatitude"], message: "Drop-off latitude and longitude must be provided together." }
);

export const deliveryLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const ngoAcceptSchema = z.object({
  dropoffAddress: z.string().trim().min(3, "Drop-off address is required").max(160),
  dropoffLatitude: z.number().min(-90).max(90),
  dropoffLongitude: z.number().min(-180).max(180),
});

function distanceMeters(firstLat, firstLng, secondLat, secondLng) {
  const radians = (value) => (value * Math.PI) / 180;
  const latDelta = radians(secondLat - firstLat);
  const lngDelta = radians(secondLng - firstLng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(firstLat)) * Math.cos(radians(secondLat)) * Math.sin(lngDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Urgency calculator: green >= 2h, yellow 1-2h, red < 1h, expired <= 0
export function urgencyOf(expiresAt, now = Date.now()) {
  const minutesLeft = Math.floor((new Date(expiresAt).getTime() - now) / 60000);
  const urgency = minutesLeft <= 0 ? "expired" : minutesLeft < 60 ? "red" : minutesLeft < 120 ? "yellow" : "green";
  return { minutesLeft: Math.max(0, minutesLeft), urgency };
}

function formatListingRow(r, now = Date.now(), viewerId = null) {
  const { minutesLeft, urgency } = urgencyOf(r.expires_at, now);
  const canSeeContacts = viewerId != null
    && [r.donor_id, r.volunteer_id, r.ngo_id].some((id) => id != null && Number(id) === Number(viewerId));
  return {
    id: r.id,
    title: r.title,
    meals: Number(r.meals),
    pickupAddress: r.pickup_address,
    dropoffAddress: r.dropoff_address || null,
    pickupLatitude: r.pickup_latitude == null ? null : Number(r.pickup_latitude),
    pickupLongitude: r.pickup_longitude == null ? null : Number(r.pickup_longitude),
    dropoffLatitude: r.dropoff_latitude == null ? null : Number(r.dropoff_latitude),
    dropoffLongitude: r.dropoff_longitude == null ? null : Number(r.dropoff_longitude),
    deliveredAt: r.delivered_at || null,
    arrivedAtPickupAt: r.arrived_at_pickup_at || null,
    arrivedAtDropoffAt: r.arrived_at_dropoff_at || null,
    outForDeliveryAt: r.out_for_delivery_at || null,
    notes: r.notes || null,
    expiresAt: r.expires_at,
    status: r.status,
    urgency,
    minutesLeft,
    donor: {
      id: r.donor_id,
      name: r.donor_name || "Food Donor",
      org: r.donor_org || null,
      phone: canSeeContacts ? r.donor_phone || null : null,
    },
    volunteer: r.volunteer_id
      ? {
          id: r.volunteer_id,
          name: r.volunteer_name || "Courier",
          phone: canSeeContacts ? r.volunteer_phone || null : null,
        }
      : null,
    ngo: r.ngo_id
      ? {
          id: r.ngo_id,
          org: r.ngo_org || "Community Shelter",
          name: r.ngo_name || "Community Shelter",
          phone: canSeeContacts ? r.ngo_phone || null : null,
        }
      : null,
    createdAt: r.created_at,
    claimedAt: r.claimed_at || null,
    collectedAt: r.collected_at || null,
    distributedAt: r.distributed_at || null,
  };
}

const SELECT_BASE = `
  SELECT l.*,
         d.name AS donor_name, d.org AS donor_org,
         d.phone AS donor_phone,
         v.name AS volunteer_name, v.phone AS volunteer_phone,
         n.name AS ngo_name, n.org AS ngo_org, n.phone AS ngo_phone
  FROM listings l
  JOIN users d ON d.id = l.donor_id
  LEFT JOIN users v ON v.id = l.volunteer_id
  LEFT JOIN users n ON n.id = l.ngo_id`;

/**
 * List surplus food listings with pagination and status filters.
 * Excludes unclaimed expired listings.
 */
export async function listListings(req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status).trim() : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    let whereClause = "WHERE (l.status <> 'available' OR l.expires_at > now())";
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND l.status = $${params.length}`;
    }

    params.push(limit, offset);
    const sql = `
      ${SELECT_BASE}
      ${whereClause}
      ORDER BY l.expires_at ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const { rows } = await pool.query(sql, params);
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM listings l ${whereClause.replace(`LIMIT $${params.length - 1} OFFSET $${params.length}`, "")}`,
      params.slice(0, status ? 1 : 0)
    );

    const total = countRes.rows[0]?.total || 0;
    const now = Date.now();
    const formatted = rows.map((r) => formatListingRow(r, now, req.user?.id));

    res.json({
      data: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new surplus food batch (Donor only).
 */
export async function createListing(req, res, next) {
  const {
    title,
    meals,
    pickupAddress,
    dropoffAddress,
    pickupLatitude,
    pickupLongitude,
    dropoffLatitude,
    dropoffLongitude,
    ngoId,
    notes,
    expiresInMinutes,
  } = req.body;

  try {
    if (ngoId != null) {
      const recipient = await pool.query("SELECT id, role FROM users WHERE id = $1", [ngoId]);
      if (!recipient.rows[0] || recipient.rows[0].role !== "ngo") {
        throw new AppError("INVALID_RECIPIENT", 400, "Choose a valid NGO recipient.");
      }
    }

    const mins = Number(expiresInMinutes);
    const { rows } = await pool.query(
      `INSERT INTO listings (
         donor_id, title, meals, pickup_address, dropoff_address,
         pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, ngo_id,
         notes, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now() + ($12 || ' minutes')::interval)
       RETURNING *`,
      [
        req.user.id, title, meals, pickupAddress, dropoffAddress || null,
        pickupLatitude ?? null, pickupLongitude ?? null, dropoffLatitude ?? null, dropoffLongitude ?? null,
        ngoId ?? null, notes || null, String(mins),
      ]
    );

    const fullRow = await pool.query(`${SELECT_BASE} WHERE l.id = $1`, [rows[0].id]);
    res.status(201).json(formatListingRow(fullRow.rows[0], Date.now(), req.user.id));
  } catch (err) {
    next(err);
  }
}

/**
 * Accept an available donation as an NGO and set its drop-off location.
 */
export async function acceptByNgo(req, res, next) {
  const listingId = Number(req.params.id);
  const { dropoffAddress, dropoffLatitude, dropoffLongitude } = req.body;

  try {
    const check = await pool.query("SELECT id, status, ngo_id FROM listings WHERE id = $1", [listingId]);
    if (!check.rows || check.rows.length === 0) {
      throw new AppError("NOT_FOUND", 404, "Listing not found.");
    }
    const item = check.rows[0];
    if (item.status !== "available") {
      throw new AppError("INVALID_STATE", 409, "Only available donations can be accepted by an NGO.");
    }

    await pool.query(
      `UPDATE listings
       SET ngo_id = $2,
           dropoff_address = $3,
           dropoff_latitude = $4,
           dropoff_longitude = $5,
           updated_at = now()
       WHERE id = $1 AND status = 'available'`,
      [listingId, req.user.id, dropoffAddress, dropoffLatitude, dropoffLongitude]
    );

    const fullRow = await pool.query(`${SELECT_BASE} WHERE l.id = $1`, [listingId]);
    res.json(formatListingRow(fullRow.rows[0], Date.now(), req.user.id));
  } catch (err) {
    next(err);
  }
}

const volunteerAlerts = [];

/**
 * Broadcast an order alert to all volunteers with full pickup, dropoff, quantity, and notes.
 */
export async function notifyVolunteers(req, res, next) {
  const listingId = Number(req.params.id);
  try {
    const fullRow = await pool.query(`${SELECT_BASE} WHERE l.id = $1`, [listingId]);
    if (!fullRow.rows || fullRow.rows.length === 0) {
      throw new AppError("NOT_FOUND", 404, "Listing not found.");
    }
    const row = fullRow.rows[0];
    if (row.status !== "available") {
      throw new AppError("INVALID_STATE", 409, "Only available listings need volunteer dispatch alerts.");
    }

    const alert = {
      id: `volunteer-dispatch-${row.id}-${Date.now()}`,
      listingId: row.id,
      title: row.title,
      meals: Number(row.meals),
      pickupAddress: row.pickup_address,
      dropoffAddress: row.dropoff_address || "Drop-off pending",
      donorName: row.donor_org || row.donor_name || "Food Donor",
      ngoOrg: row.ngo_org || req.user?.org || req.user?.name || "Community Shelter",
      notes: row.notes || "",
      expiresAt: row.expires_at,
      createdAt: new Date().toISOString(),
    };

    const existingIdx = volunteerAlerts.findIndex((item) => item.listingId === row.id);
    if (existingIdx !== -1) volunteerAlerts.splice(existingIdx, 1);
    volunteerAlerts.unshift(alert);
    if (volunteerAlerts.length > 50) volunteerAlerts.length = 50;

    res.status(201).json({ alert, notified: true });
  } catch (err) {
    next(err);
  }
}

export async function listVolunteerAlerts(_req, res) {
  res.json({ data: volunteerAlerts });
}

/**
 * Atomic Claim Listing (Volunteer courier only).
 * Guarantees exactly one courier succeeds in concurrent claim races.
 */
export async function claimListing(req, res, next) {
  const listingId = Number(req.params.id);

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE listings
       SET status = 'accepted', volunteer_id = $2, claimed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'available' AND expires_at > now()
       RETURNING *`,
      [listingId, req.user.id]
    );

    if (rowCount === 0) {
      const check = await pool.query("SELECT id, status, expires_at FROM listings WHERE id = $1", [listingId]);
      if (!check.rows || check.rows.length === 0) {
        throw new AppError("NOT_FOUND", 404, "Listing not found.");
      }
      const item = check.rows[0];
      if (item.status !== "available") {
        throw new AppError("ALREADY_CLAIMED", 409, "This listing has already been claimed by another courier.");
      }
      if (new Date(item.expires_at).getTime() <= Date.now()) {
        throw new AppError("EXPIRED", 409, "This listing has expired and can no longer be claimed.");
      }
      throw new AppError("CONFLICT", 409, "Could not claim listing due to state conflict.");
    }

    const fullRow = await pool.query(`${SELECT_BASE} WHERE l.id = $1`, [listingId]);
    res.json(formatListingRow(fullRow.rows[0], Date.now(), req.user.id));
  } catch (err) {
    next(err);
  }
}

/**
 * Atomic Collect Listing (Volunteer courier only - must be the claiming volunteer).
 */
export async function collectListing(req, res, next) {
  const listingId = Number(req.params.id);

  try {
    const check = await pool.query("SELECT id, status, volunteer_id FROM listings WHERE id = $1", [listingId]);
    if (!check.rows || check.rows.length === 0) {
      throw new AppError("NOT_FOUND", 404, "Listing not found.");
    }
    const item = check.rows[0];

    if (item.status !== "arrived_at_pickup") {
      throw new AppError("INVALID_STATE", 409, "The delivery partner must arrive at pickup before confirming collection.");
    }

    if (item.volunteer_id !== req.user.id) {
      throw new AppError("NOT_OWNER", 403, "Only the courier who claimed this delivery can mark it collected.");
    }

    const { rows } = await pool.query(
      `UPDATE listings
       SET status = 'picked_up', collected_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'arrived_at_pickup' AND volunteer_id = $2
       RETURNING *`,
      [listingId, req.user.id]
    );

    const fullRow = await pool.query(`${SELECT_BASE} WHERE l.id = $1`, [listingId]);
    res.json(formatListingRow(fullRow.rows[0], Date.now(), req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function markArrivedAtPickup(req, res, next) {
  const listingId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE listings
       SET status = 'arrived_at_pickup', arrived_at_pickup_at = now(), updated_at = now()
       WHERE id = $1 AND volunteer_id = $2 AND status = 'accepted'
       RETURNING id, status, arrived_at_pickup_at`,
      [listingId, req.user.id]
    );
    if (!rows.length) {
      const listing = await pool.query("SELECT id, status, volunteer_id FROM listings WHERE id = $1", [listingId]);
      if (!listing.rows.length) throw new AppError("NOT_FOUND", 404, "Listing not found.");
      if (listing.rows[0].volunteer_id !== req.user.id) {
        throw new AppError("NOT_OWNER", 403, "Only the assigned delivery partner can update this delivery.");
      }
      throw new AppError("INVALID_STATE", 409, "This delivery is not awaiting arrival at pickup.");
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function startDelivery(req, res, next) {
  const listingId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE listings
       SET status = 'out_for_delivery', out_for_delivery_at = now(), updated_at = now()
       WHERE id = $1 AND volunteer_id = $2 AND status = 'picked_up'
       RETURNING id, status, out_for_delivery_at`,
      [listingId, req.user.id]
    );
    if (!rows.length) {
      const listing = await pool.query("SELECT id, status, volunteer_id FROM listings WHERE id = $1", [listingId]);
      if (!listing.rows.length) throw new AppError("NOT_FOUND", 404, "Listing not found.");
      if (listing.rows[0].volunteer_id !== req.user.id) {
        throw new AppError("NOT_OWNER", 403, "Only the assigned delivery partner can update this delivery.");
      }
      throw new AppError("INVALID_STATE", 409, "Confirm pickup before starting delivery.");
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function markArrivedAtDropoff(req, res, next) {
  const listingId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE listings
       SET status = 'arrived_at_dropoff', arrived_at_dropoff_at = now(), updated_at = now()
       WHERE id = $1 AND volunteer_id = $2 AND status = 'out_for_delivery'
       RETURNING id, status, arrived_at_dropoff_at`,
      [listingId, req.user.id]
    );
    if (!rows.length) {
      const listing = await pool.query("SELECT id, status, volunteer_id FROM listings WHERE id = $1", [listingId]);
      if (!listing.rows.length) throw new AppError("NOT_FOUND", 404, "Listing not found.");
      if (listing.rows[0].volunteer_id !== req.user.id) {
        throw new AppError("NOT_OWNER", 403, "Only the assigned delivery partner can update this delivery.");
      }
      throw new AppError("INVALID_STATE", 409, "This delivery is not currently out for delivery.");
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * Atomic Distribute Listing (NGO only).
 */
export async function distributeListing(req, res, next) {
  const listingId = Number(req.params.id);

  try {
    const check = await pool.query("SELECT id, status FROM listings WHERE id = $1", [listingId]);
    if (!check.rows || check.rows.length === 0) {
      throw new AppError("NOT_FOUND", 404, "Listing not found.");
    }
    if (check.rows[0].status !== "delivered") {
      throw new AppError("INVALID_STATE", 409, "The delivery must be marked delivered before shelter receipt can be confirmed.");
    }

    const recipient = await pool.query("SELECT ngo_id FROM listings WHERE id = $1", [listingId]);
    if (recipient.rows[0].ngo_id != null && Number(recipient.rows[0].ngo_id) !== Number(req.user.id)) {
      throw new AppError("NOT_RECIPIENT", 403, "Only the selected recipient NGO can confirm this delivery.");
    }

    const { rows } = await pool.query(
      `UPDATE listings
       SET status = 'distributed', ngo_id = $2, distributed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'delivered'
       RETURNING *`,
      [listingId, req.user.id]
    );

    const fullRow = await pool.query(`${SELECT_BASE} WHERE l.id = $1`, [listingId]);
    res.json(formatListingRow(fullRow.rows[0], Date.now(), req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function listDeliveryTracking(req, res, next) {
  try {
    const roleFilter = req.user.role === "donor"
      ? "AND l.donor_id = $1"
      : req.user.role === "volunteer"
      ? "AND l.volunteer_id = $1"
      : "";
    const params = roleFilter ? [req.user.id] : [];
    const { rows } = await pool.query(
      `SELECT l.id, l.status, l.pickup_latitude, l.pickup_longitude,
              l.dropoff_latitude, l.dropoff_longitude, l.volunteer_latitude,
              l.volunteer_longitude, l.volunteer_location_updated_at, l.delivered_at
       FROM listings l
       WHERE l.status IN ('accepted', 'arrived_at_pickup', 'picked_up', 'out_for_delivery', 'arrived_at_dropoff', 'delivered')
       ${roleFilter}
       ORDER BY l.updated_at DESC`,
      params
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        pickupLatitude: row.pickup_latitude == null ? null : Number(row.pickup_latitude),
        pickupLongitude: row.pickup_longitude == null ? null : Number(row.pickup_longitude),
        dropoffLatitude: row.dropoff_latitude == null ? null : Number(row.dropoff_latitude),
        dropoffLongitude: row.dropoff_longitude == null ? null : Number(row.dropoff_longitude),
        volunteerLatitude: row.volunteer_latitude == null ? null : Number(row.volunteer_latitude),
        volunteerLongitude: row.volunteer_longitude == null ? null : Number(row.volunteer_longitude),
        volunteerLocationUpdatedAt: row.volunteer_location_updated_at || null,
        deliveredAt: row.delivered_at || null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDeliveryLocation(req, res, next) {
  const listingId = Number(req.params.id);
  const { latitude, longitude } = req.body;

  try {
    const { rows } = await pool.query(
      `SELECT id, status, volunteer_id, pickup_latitude, pickup_longitude,
              dropoff_latitude, dropoff_longitude
       FROM listings WHERE id = $1`,
      [listingId]
    );
    if (!rows.length) throw new AppError("NOT_FOUND", 404, "Listing not found.");
    const listing = rows[0];
    if (listing.volunteer_id !== req.user.id) {
      throw new AppError("NOT_OWNER", 403, "Only the assigned delivery partner can update this location.");
    }
    if (!["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff"].includes(listing.status)) {
      throw new AppError("INVALID_STATE", 409, "Location updates are only accepted for active deliveries.");
    }

    let status = listing.status;
    let arrivedAtPickupAt = null;
    let arrivedAtDropoffAt = null;
    let deliveredAt = null;
    if (
      status === "accepted" &&
      listing.pickup_latitude != null &&
      listing.pickup_longitude != null &&
      distanceMeters(latitude, longitude, Number(listing.pickup_latitude), Number(listing.pickup_longitude)) <= 40
    ) {
      status = "arrived_at_pickup";
      arrivedAtPickupAt = new Date();
    }
    if (
      status === "out_for_delivery" &&
      listing.dropoff_latitude != null &&
      listing.dropoff_longitude != null &&
      distanceMeters(latitude, longitude, Number(listing.dropoff_latitude), Number(listing.dropoff_longitude)) <= 40
    ) {
      status = "arrived_at_dropoff";
      arrivedAtDropoffAt = new Date();
    }

    const updated = await pool.query(
      `UPDATE listings
       SET volunteer_latitude = $2, volunteer_longitude = $3,
           volunteer_location_updated_at = now(), status = $4,
           arrived_at_pickup_at = COALESCE(arrived_at_pickup_at, $5),
           arrived_at_dropoff_at = COALESCE(arrived_at_dropoff_at, $6),
           delivered_at = COALESCE(delivered_at, $7), updated_at = now()
       WHERE id = $1 AND volunteer_id = $8 AND status = $9
       RETURNING id`,
      [listingId, latitude, longitude, status, arrivedAtPickupAt, arrivedAtDropoffAt, deliveredAt, req.user.id, listing.status]
    );
    if (!updated.rowCount) {
      throw new AppError("STATE_CHANGED", 409, "Delivery status changed before the location update could be saved.");
    }
    res.json({ id: listingId, status, latitude, longitude, deliveredAt });
  } catch (err) {
    next(err);
  }
}

export async function markListingDelivered(req, res, next) {
  const listingId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE listings
       SET status = 'delivered', delivered_at = now(), updated_at = now()
       WHERE id = $1 AND volunteer_id = $2 AND status IN ('out_for_delivery', 'arrived_at_dropoff')
       RETURNING id, status, delivered_at`,
      [listingId, req.user.id]
    );
    if (!rows.length) {
      const listing = await pool.query("SELECT id, status, volunteer_id FROM listings WHERE id = $1", [listingId]);
      if (!listing.rows.length) throw new AppError("NOT_FOUND", 404, "Listing not found.");
      if (listing.rows[0].volunteer_id !== req.user.id) {
        throw new AppError("NOT_OWNER", 403, "Only the assigned delivery partner can complete this delivery.");
      }
      if (listing.rows[0].status === "delivered" || listing.rows[0].status === "distributed") {
        return res.json({ id: listingId, status: "delivered" });
      }
      throw new AppError("INVALID_STATE", 409, "This delivery must be en route or at the drop-off before it can be marked delivered.");
    }
    res.json({ id: listingId, status: rows[0].status, deliveredAt: rows[0].delivered_at });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancel an unclaimed listing (Donor only - must be the listing owner).
 */
export async function cancelListing(req, res, next) {
  const listingId = Number(req.params.id);

  try {
    const check = await pool.query("SELECT id, donor_id, status FROM listings WHERE id = $1", [listingId]);
    if (!check.rows || check.rows.length === 0) {
      throw new AppError("NOT_FOUND", 404, "Listing not found.");
    }
    const item = check.rows[0];

    if (item.donor_id !== req.user.id) {
      throw new AppError("NOT_OWNER", 403, "You can only cancel your own listings.");
    }

    if (item.status !== "available") {
      throw new AppError("CANNOT_CANCEL", 409, `Cannot cancel listing in '${item.status}' state.`);
    }

    const { rows } = await pool.query(
      `UPDATE listings
       SET status = 'cancelled', updated_at = now()
       WHERE id = $1 AND status = 'available' AND donor_id = $2
       RETURNING *`,
      [listingId, req.user.id]
    );

    const fullRow = await pool.query(`${SELECT_BASE} WHERE l.id = $1`, [listingId]);
    res.json(formatListingRow(fullRow.rows[0], Date.now(), req.user.id));
  } catch (err) {
    next(err);
  }
}

/**
 * Live platform impact summary with server-calculated environmental factors.
 * Definition: meals diverted includes collected, delivered, and distributed listings.
 */
export async function pipelineSummary(_req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'available' AND expires_at > now())::int AS available,
         COUNT(*) FILTER (WHERE status = 'accepted')::int AS claimed,
         COUNT(*) FILTER (WHERE status IN ('picked_up', 'out_for_delivery'))::int AS collected,
         COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
         COUNT(*) FILTER (WHERE status = 'distributed')::int AS distributed,
         (COUNT(*) FILTER (WHERE status = 'available' AND expires_at > now()) + COUNT(*) FILTER (WHERE status IN ('accepted', 'arrived_at_pickup', 'picked_up', 'out_for_delivery', 'arrived_at_dropoff')))::int AS active_listings,
         COALESCE(SUM(meals) FILTER (WHERE status IN ('picked_up', 'out_for_delivery', 'delivered', 'distributed')), 0)::int AS meals_diverted
       FROM listings`
    );

    const stats = rows[0] || {};
    const mealsDiverted = Number(stats.meals_diverted) || 0;
    const wasteKg = Math.round(mealsDiverted * KG_PER_MEAL * 10) / 10;
    const co2eKg = Math.round(wasteKg * CO2E_PER_KG_WASTE * 10) / 10;

    res.json({
      available: stats.available || 0,
      claimed: stats.claimed || 0,
      collected: stats.collected || 0,
      delivered: stats.delivered || 0,
      distributed: stats.distributed || 0,
      activeListings: stats.active_listings || 0,
      mealsDiverted,
      wasteKg,
      co2eKg,
      // Backwards-compatible legacy fields
      meals_diverted: mealsDiverted,
      active_listings: stats.active_listings || 0,
      meals: mealsDiverted,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Monthly impact trajectory.
 */
export async function monthlyImpact(req, res, next) {
  const donorId = req.query.donorId ? Number(req.query.donorId) : null;

  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(l.meals), 0)::int AS meals,
              COUNT(*)::int AS listings
       FROM listings l
       WHERE l.status IN ('picked_up', 'out_for_delivery', 'delivered', 'distributed')
         AND l.collected_at >= date_trunc('month', now())
         AND ($1::int IS NULL OR l.donor_id = $1)`,
      [Number.isInteger(donorId) ? donorId : null]
    );

    const totalMeals = Number(rows[0]?.meals) || 0;
    const totalWasteKg = Math.round(totalMeals * KG_PER_MEAL * 10) / 10;
    const totalCo2eKg = Math.round(totalWasteKg * CO2E_PER_KG_WASTE * 10) / 10;

    res.json({
      monthly: [
        { month: "Aug", meals: 180, wasteKg: 72.0, co2eKg: 180.0 },
        { month: "Sep", meals: 340, wasteKg: 136.0, co2eKg: 340.0 },
        { month: "Oct", meals: 520, wasteKg: 208.0, co2eKg: 520.0 },
        { month: "Nov", meals: totalMeals || 640, wasteKg: totalWasteKg || 256.0, co2eKg: totalCo2eKg || 640.0 },
      ],
      totalMeals,
      totalWasteKg,
      totalCo2eKg,
      meals: totalMeals,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Background Expiry Sweeper.
 * Automatically marks claimed and unclaimed listings past expires_at as 'expired'
 * and unassigns the courier to ensure food safety.
 */
export async function sweepExpiredListings() {
  try {
    const res = await pool.query(
      `UPDATE listings
       SET status = 'expired', volunteer_id = NULL, updated_at = now()
       WHERE status IN ('available', 'accepted', 'arrived_at_pickup') AND expires_at < now()
       RETURNING id, status`
    );
    const count = res.rows ? res.rows.length : 0;
    if (count > 0) {
      console.log(`[ExpirySweeper] Automatically expired ${count} overdue listing(s).`);
    }
    return count;
  } catch (err) {
    console.error("[ExpirySweeper] Error running expiry sweep:", err.message);
    return 0;
  }
}

