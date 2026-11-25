import { isIP } from "node:net";
import { z } from "zod";
import { AppError } from "../middleware/errors.js";

const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const routeSchema = z.object({
  coordinates: z.array(coordinateSchema).min(2).max(5),
});

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const PUBLIC_ROUTING_CONSENT = "public-osrm-v1";

function isPrivateIPv4(hostname) {
  const octets = hostname.split(".").map(Number);
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function configuredLocalService(envName) {
  const configured = process.env[envName];
  if (!configured) {
    throw new AppError("MAP_SERVICE_UNAVAILABLE", 503, `${envName} is not configured. Configure a self-hosted map service to enable this feature.`);
  }

  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new AppError("MAP_SERVICE_MISCONFIGURED", 503, `${envName} must be a valid self-hosted service URL.`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipVersion = isIP(hostname);
  const localHostname = ipVersion === 0 && (
    hostname === "localhost" || hostname.endsWith(".localhost")
    || hostname.endsWith(".local") || !hostname.includes(".")
  );
  const privateAddress = ipVersion === 4
    ? isPrivateIPv4(hostname)
    : ipVersion === 6 && (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:"));

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (!localHostname && !privateAddress)) {
    throw new AppError("MAP_SERVICE_MISCONFIGURED", 503, `${envName} must point to a localhost or private-network service; public map providers are not supported.`);
  }
  return url;
}

function configuredRoutingService() {
  const configured = process.env.OSRM_BASE_URL || DEFAULT_OSRM_BASE_URL;
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new AppError("MAP_SERVICE_MISCONFIGURED", 503, "OSRM_BASE_URL must be a valid routing service URL.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipVersion = isIP(hostname);
  const localHostname = ipVersion === 0 && (
    hostname === "localhost" || hostname.endsWith(".localhost")
    || hostname.endsWith(".local") || !hostname.includes(".")
  );
  const privateAddress = ipVersion === 4
    ? isPrivateIPv4(hostname)
    : ipVersion === 6 && (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:"));

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new AppError("MAP_SERVICE_MISCONFIGURED", 503, "OSRM_BASE_URL must use HTTP(S) and must not contain credentials.");
  }
  return { url, isPublic: !localHostname && !privateAddress };
}

async function requestJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "FoodBridge/1.0 (OSRM route request)" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AppError("MAP_SERVICE_ERROR", 502, `Self-hosted map service returned HTTP ${response.status}.`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("MAP_SERVICE_ERROR", 502, "Could not reach the configured self-hosted map service.");
  } finally {
    clearTimeout(timeout);
  }
}

async function requestImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new AppError("MAP_SERVICE_ERROR", 502, `Self-hosted tile service returned HTTP ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("MAP_SERVICE_ERROR", 502, "Could not reach the configured self-hosted tile service.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMapTile(req, res, next) {
  try {
    const { z, x, y } = req.params;
    const zoom = Number(z);
    const tileLimit = 2 ** zoom;
    if (
      ![z, x, y].every((value) => /^\d+$/.test(value))
      || zoom > 20
      || Number(x) >= tileLimit
      || Number(y) >= tileLimit
    ) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid map tile coordinates.");
    }
    const base = configuredLocalService("MAP_TILES_BASE_URL");
    const url = new URL(`${z}/${x}/${y}.png`, base.href.endsWith("/") ? base : `${base.href}/`);
    const image = await requestImage(url);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(image);
  } catch (error) {
    next(error);
  }
}

export async function getRoadRoute(req, res, next) {
  try {
    const parsed = routeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Provide two to five valid route coordinates.");
    }
    const { url: base, isPublic } = configuredRoutingService();
    if (isPublic && req.get("x-location-routing-consent") !== PUBLIC_ROUTING_CONSENT) {
      throw new AppError(
        "ROUTING_CONSENT_REQUIRED",
        428,
        "Allow sharing route coordinates with the public OSRM service to calculate street directions."
      );
    }
    const coordinatePath = parsed.data.coordinates
      .map(({ latitude, longitude }) => `${longitude},${latitude}`)
      .join(";");
    const url = new URL(`route/v1/driving/${coordinatePath}`, base.href.endsWith("/") ? base : `${base.href}/`);
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "true");

    const payload = await requestJson(url);
    const route = payload.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      throw new AppError("ROUTE_NOT_FOUND", 404, "No road route was found for these locations.");
    }
    res.json({
      route: {
        coordinates: route.geometry.coordinates,
        distance: route.distance,
        duration: route.duration,
        legs: (route.legs || []).map((leg) => ({ distance: leg.distance, duration: leg.duration })),
        steps: (route.legs || []).flatMap((leg) => leg.steps || []).map((step) => ({
          name: step.name || "",
          distance: step.distance,
          duration: step.duration,
          type: step.maneuver?.type || "",
          modifier: step.maneuver?.modifier || "",
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function geocodeAddress(req, res, next) {
  try {
    const query = String(req.query.q || "").trim();
    if (query.length < 3 || query.length > 180) {
      throw new AppError("VALIDATION_ERROR", 400, "Enter an address between 3 and 180 characters.");
    }
    const base = configuredLocalService("NOMINATIM_BASE_URL");
    const url = new URL("search", base.href.endsWith("/") ? base : `${base.href}/`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      url.searchParams.set("viewbox", [
        longitude - 0.3,
        latitude + 0.3,
        longitude + 0.3,
        latitude - 0.3,
      ].join(","));
      url.searchParams.set("bounded", "1");
    }
    res.json({ results: await requestJson(url) });
  } catch (error) {
    next(error);
  }
}

export async function reverseGeocode(req, res, next) {
  try {
    const parsed = coordinateSchema.safeParse({
      latitude: Number(req.query.latitude),
      longitude: Number(req.query.longitude),
    });
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Provide a valid latitude and longitude.");
    }
    const base = configuredLocalService("NOMINATIM_BASE_URL");
    const url = new URL("reverse", base.href.endsWith("/") ? base : `${base.href}/`);
    url.searchParams.set("lat", String(parsed.data.latitude));
    url.searchParams.set("lon", String(parsed.data.longitude));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    res.json(await requestJson(url));
  } catch (error) {
    next(error);
  }
}
