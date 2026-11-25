import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { pool } from "../config/db.js";
import { AppError } from "../middleware/errors.js";

const roles = {
  donor: {
    ownerColumn: "donor_id",
    completedStatuses: "('available', 'accepted', 'arrived_at_pickup', 'picked_up', 'out_for_delivery', 'arrived_at_dropoff', 'delivered', 'distributed')",
  },
  volunteer: { ownerColumn: "volunteer_id", completedStatuses: "('delivered', 'distributed')" },
  ngo: {
    ownerColumn: "ngo_id",
    completedStatuses: "('available', 'accepted', 'arrived_at_pickup', 'picked_up', 'out_for_delivery', 'arrived_at_dropoff', 'delivered', 'distributed')",
  },
};

const lanternIds = new Set(["hope", "kindness", "community", "gratitude", "courage", "care"]);

function normalizedName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function certificatePayload(certificate) {
  return [
    certificate.certificate_id,
    certificate.user_id,
    certificate.user_name,
    certificate.role,
    certificate.lantern_id,
    certificate.listing_id,
    certificate.listing_title,
    certificate.meals,
    new Date(certificate.issued_at).toISOString(),
  ].join("\n");
}

function signCertificate(certificate) {
  const secret = process.env.CERTIFICATE_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("Certificate signing secret is not configured.");
  return createHmac("sha256", secret).update(certificatePayload(certificate)).digest("hex");
}

function toPublicCertificate(certificate) {
  return {
    id: certificate.certificate_id,
    name: certificate.user_name,
    role: certificate.role,
    lanternId: certificate.lantern_id,
    serviceTitle: certificate.listing_title,
    meals: Number(certificate.meals),
    issuedAt: new Date(certificate.issued_at).toISOString(),
  };
}

export async function issueCertificate(req, res, next) {
  const user = req.user;
  const name = String(req.body?.name ?? "").trim().replace(/\s+/g, " ");
  const lanternId = String(req.body?.lanternId ?? "");
  const roleConfig = roles[user?.role];

  if (!roleConfig || !name || name.length > 100 || !lanternIds.has(lanternId)) {
    return next(new AppError("VALIDATION_ERROR", 400, "A valid account name and lantern selection are required."));
  }
  if (normalizedName(name) !== normalizedName(user.name)) {
    return next(new AppError("NAME_MISMATCH", 422, "Use the name on your signed-in FoodBridge account so the certificate can be verified."));
  }

  try {
    const { rows: completedListings } = await pool.query(
      `SELECT id, title, meals, status
       FROM listings
       WHERE ${roleConfig.ownerColumn} = $1
         AND status IN ${roleConfig.completedStatuses}
       ORDER BY id DESC
       LIMIT 1`,
      [user.id]
    );
    const listing = completedListings[0];
    if (!listing) {
      return next(new AppError("SERVICE_NOT_COMPLETED", 409, "Complete a verified FoodBridge rescue before lighting a service lantern."));
    }

    const newCertificate = {
      certificate_id: `FB-${randomUUID().toUpperCase()}`,
      user_id: user.id,
      user_name: user.name,
      role: user.role,
      lantern_id: lanternId,
      listing_id: listing.id,
      listing_title: listing.title,
      meals: Number(listing.meals),
      issued_at: new Date().toISOString(),
    };
    newCertificate.signature = signCertificate(newCertificate);

    await pool.query(
      `INSERT INTO service_certificates
         (certificate_id, user_id, user_name, role, lantern_id, listing_id, listing_title, meals, issued_at, signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, lantern_id) DO NOTHING`,
      [
        newCertificate.certificate_id,
        newCertificate.user_id,
        newCertificate.user_name,
        newCertificate.role,
        newCertificate.lantern_id,
        newCertificate.listing_id,
        newCertificate.listing_title,
        newCertificate.meals,
        newCertificate.issued_at,
        newCertificate.signature,
      ]
    );

    const { rows } = await pool.query(
      "SELECT * FROM service_certificates WHERE user_id = $1 AND lantern_id = $2",
      [user.id, lanternId]
    );
    res.status(201).json({ certificate: toPublicCertificate(rows[0]), verified: true });
  } catch (error) {
    next(error);
  }
}

export async function verifyCertificate(req, res, next) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM service_certificates WHERE certificate_id = $1",
      [req.params.certificateId]
    );
    const certificate = rows[0];
    if (!certificate) {
      return next(new AppError("NOT_FOUND", 404, "Certificate was not found in the FoodBridge registry."));
    }

    const expected = Buffer.from(signCertificate(certificate), "hex");
    const recorded = Buffer.from(certificate.signature, "hex");
    const verified = expected.length === recorded.length && timingSafeEqual(expected, recorded);
    res.status(verified ? 200 : 409).json({
      verified,
      certificate: toPublicCertificate(certificate),
      message: verified ? "This certificate is authentic in the FoodBridge registry." : "This certificate could not be verified.",
    });
  } catch (error) {
    next(error);
  }
}
