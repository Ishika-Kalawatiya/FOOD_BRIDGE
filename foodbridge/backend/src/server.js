import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import path from "path";
import { validateEnvironment } from "./config/env.js";
import { pool, checkDbConnection } from "./config/db.js";
import { AppError, globalErrorHandler } from "./middleware/errors.js";
import { authenticate, optionalAuthenticate, requireRole } from "./middleware/auth.js";
import { validateBody } from "./middleware/validation.js";
import {
  signupUser,
  loginUser,
  getMe,
  getPartners,
} from "./controllers/userController.js";
import {
  listListings,
  createListingSchema,
  deliveryLocationSchema,
  ngoAcceptSchema,
  createListing,
  acceptByNgo,
  notifyVolunteers,
  listVolunteerAlerts,
  claimListing,
  collectListing,
  markArrivedAtPickup,
  startDelivery,
  markArrivedAtDropoff,
  distributeListing,
  listDeliveryTracking,
  updateDeliveryLocation,
  markListingDelivered,
  cancelListing,
  monthlyImpact,
  pipelineSummary,
  sweepExpiredListings,
} from "./controllers/listingController.js";
import { geocodeAddress, getMapTile, getRoadRoute, reverseGeocode } from "./controllers/mapController.js";
import { issueCertificate, verifyCertificate } from "./controllers/certificateController.js";
import {
  submitScore,
  getLeaderboard,
  getImpactTotal,
} from "./controllers/scoreController.js";
import {
  bulkInsertAudits,
  getAuditSummary,
  requireApiKey,
} from "./controllers/auditController.js";

// Validate required environment variables at boot
validateEnvironment();

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const origins = (process.env.CORS_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: origins.length ? origins : true,
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "256kb" }));

// Rate limiting (Requirement 10: relaxed limit 100 req/15min on auth)
const isTestEnv = process.env.NODE_ENV === "test" || process.argv.some((a) => a.includes("--test"));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication attempts. Please try again in 15 minutes.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
});

app.use("/api", apiLimiter);

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// --- Auth & Users ---
// Requirement 12: remove/restrict GET /api/users (no raw user dumps)
app.post("/api/users/signup", authLimiter, signupUser);
app.post("/api/users", authLimiter, signupUser); // backwards compatibility
app.post("/api/users/login", authLimiter, loginUser);
app.get("/api/users/me", authenticate, getMe);
app.get("/api/users/partners", getPartners);
app.get("/api/users", getPartners); // backwards-compatible safe partner summary

// --- Core Surplus Food Pipeline ---
app.get("/api/listings", optionalAuthenticate, listListings);
app.post("/api/listings", authenticate, requireRole("donor"), validateBody(createListingSchema), createListing);
app.post("/api/listings/:id/accept-ngo", authenticate, requireRole("ngo"), validateBody(ngoAcceptSchema), acceptByNgo);
app.post("/api/listings/:id/notify-volunteers", authenticate, requireRole("ngo"), notifyVolunteers);
app.get("/api/volunteer-alerts", authenticate, requireRole("volunteer"), listVolunteerAlerts);
app.post("/api/listings/:id/claim", authenticate, requireRole("volunteer"), claimListing);
app.post("/api/listings/:id/collect", authenticate, requireRole("volunteer"), collectListing);
app.post("/api/listings/:id/arrive", authenticate, requireRole("volunteer"), markArrivedAtPickup);
app.post("/api/listings/:id/start-delivery", authenticate, requireRole("volunteer"), startDelivery);
app.post("/api/listings/:id/arrive-dropoff", authenticate, requireRole("volunteer"), markArrivedAtDropoff);
app.post("/api/listings/:id/distribute", authenticate, requireRole("ngo"), distributeListing);
app.post("/api/listings/:id/cancel", authenticate, requireRole("donor"), cancelListing);
app.get("/api/tracking", authenticate, listDeliveryTracking);
app.post("/api/listings/:id/location", authenticate, requireRole("volunteer"), validateBody(deliveryLocationSchema), updateDeliveryLocation);
app.post("/api/listings/:id/deliver", authenticate, requireRole("volunteer"), markListingDelivered);
app.get("/api/map/geocode", authenticate, geocodeAddress);
app.get("/api/map/reverse", authenticate, reverseGeocode);
app.post("/api/map/route", authenticate, getRoadRoute);
app.get("/api/map/tiles/:z/:x/:y", getMapTile);
app.post("/api/certificates", authenticate, issueCertificate);
app.get("/api/certificates/:certificateId", verifyCertificate);

// --- Impact Metrics ---
app.get("/api/impact/summary", pipelineSummary);
app.get("/api/impact/monthly", monthlyImpact);

// --- Community Audit (Independent Verification) ---
app.post("/api/audits/bulk", requireApiKey, bulkInsertAudits);
app.get("/api/audits/summary", getAuditSummary);

// --- Engagement Game (Isolated from real meal totals) ---
app.post("/api/scores", submitScore);
app.get("/api/scores/leaderboard", getLeaderboard);
app.get("/api/scores/impact", getImpactTotal);

// 404 handler for unknown API routes
app.all("/api/*", (req, _res, next) => {
  next(new AppError("NOT_FOUND", 404, `Endpoint ${req.method} ${req.path} not found.`));
});

// Global Error Handler
app.use(globalErrorHandler);

// Expiry Sweeper (Requirement 4: Auto-expire overdue listings every 60 seconds)
const sweeperInterval = setInterval(() => {
  sweepExpiredListings().catch((err) => {
    console.error("[ExpirySweeper] Background sweep failed:", err.message);
  });
}, 60000);
sweeperInterval.unref();

const port = Number(process.env.PORT) || 4000;
let server;

export { app, server };
export default app;

export async function startServer() {
  await checkDbConnection().catch(() => {});
  return new Promise((resolve, reject) => {
    server = app.listen(port, () => {
      console.log(`FoodBridge API server listening on :${port}`);
      resolve(server);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[FATAL] Port ${port} is already in use. Run npm run kill:ports before starting.`);
      }
      reject(err);
    });
  });
}

// Start automatically if run directly as script
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain && !isTestEnv) {
  startServer().catch((err) => {
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  });
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down FoodBridge server...`);
  clearInterval(sweeperInterval);
  if (server) {
    server.close(async () => {
      console.log("HTTP server closed.");
      await pool.end().catch(() => {});
      console.log("Database connection pool closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));