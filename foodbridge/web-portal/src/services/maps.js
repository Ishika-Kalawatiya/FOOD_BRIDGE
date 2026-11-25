import { apiCall } from "./api";

export const MAP_TILE_URL = import.meta.env.VITE_MAP_TILES_URL
  || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ROUTING_CONSENT_KEY = "foodbridge_public_osrm_consent_v1";

function isPublicRoutingUrl(baseUrl) {
  const { hostname } = new URL(baseUrl);
  const host = hostname.toLowerCase();
  return host !== "localhost"
    && !host.endsWith(".localhost")
    && !host.endsWith(".local")
    && !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    && host !== "::1"
    && !host.startsWith("fc")
    && !host.startsWith("fd")
    && !host.startsWith("fe80:");
}

function consentRequiredError() {
  const error = new Error("Allow sharing route coordinates with the public OSRM service to calculate street directions.");
  error.code = "ROUTING_CONSENT_REQUIRED";
  error.status = 428;
  return error;
}

export function hasPublicRoutingConsent() {
  return localStorage.getItem(ROUTING_CONSENT_KEY) === "granted";
}

export function allowPublicRouting() {
  localStorage.setItem(ROUTING_CONSENT_KEY, "granted");
  window.dispatchEvent(new Event("foodbridge:routing-consent"));
}

function normalizeOsrmRoute(payload) {
  const route = payload.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error("No road route was found for these locations.");
  }
  return {
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
  };
}

export async function fetchRoadRoute(points) {
  const configuredBase = import.meta.env.VITE_OSRM_BASE_URL;
  if (configuredBase) {
    if (isPublicRoutingUrl(configuredBase) && !hasPublicRoutingConsent()) {
      throw consentRequiredError();
    }
    const coordinatePath = points.map(({ latitude, longitude }) => `${longitude},${latitude}`).join(";");
    const base = new URL(configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`);
    const url = new URL(`route/v1/driving/${coordinatePath}`, base);
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "true");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`);
    return normalizeOsrmRoute(await response.json());
  }

  const response = await apiCall("/api/map/route", {
    method: "POST",
    body: {
      coordinates: points.map(({ latitude, longitude }) => ({ latitude, longitude })),
    },
    headers: hasPublicRoutingConsent()
      ? { "X-Location-Routing-Consent": "public-osrm-v1" }
      : {},
  });
  if (!response.route) {
    throw new Error("Road routing is unavailable. Check your OSRM service configuration.");
  }
  return response.route;
}

export async function geocodeAddress(query, bias) {
  const params = new URLSearchParams({ q: query });
  if (bias) {
    params.set("latitude", String(bias.latitude));
    params.set("longitude", String(bias.longitude));
  }
  const response = await apiCall(`/api/map/geocode?${params}`);
  if (!Array.isArray(response.results)) {
    throw new Error("Address lookup is unavailable. Configure a self-hosted Nominatim service.");
  }
  return response.results.map((result) => ({
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    label: result.display_name,
  }));
}

export async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  const response = await apiCall(`/api/map/reverse?${params}`);
  if (!response.display_name) {
    throw new Error("Address lookup is unavailable. Configure a self-hosted Nominatim service.");
  }
  return response.display_name;
}
