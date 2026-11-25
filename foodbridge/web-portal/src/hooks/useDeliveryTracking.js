import { useEffect, useRef, useState } from "react";
import { updateDeliveryLocation } from "../services/api";
import { fetchRoadRoute } from "../services/maps";
import { distanceInMeters } from "../utils/geo";

const SIMULATION_DURATION_SECONDS = 18;
const SIMULATION_INTERVAL_MS = 450;
const ACTIVE_STATUSES = ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff"];

function point(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function roadCoordinates(route) {
  return (route.coordinates || []).map(([longitude, latitude]) => ({ latitude, longitude }));
}

function buildFallbackPath(pickup, dropoff, steps = 40) {
  const path = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const curveOffset = Math.sin(t * Math.PI) * 0.0006;
    path.push({
      latitude: pickup.latitude + (dropoff.latitude - pickup.latitude) * t + curveOffset,
      longitude: pickup.longitude + (dropoff.longitude - pickup.longitude) * t - curveOffset * 0.6,
    });
  }
  return path;
}

function interpolateAlongPath(path, fraction) {
  if (path.length === 0) return null;
  if (path.length === 1 || fraction <= 0) return { ...path[0], heading: headingBetween(path[0], path[1] || path[0]) };
  if (fraction >= 1) {
    const last = path[path.length - 1];
    const prev = path[path.length - 2] || last;
    return { ...last, heading: headingBetween(prev, last) };
  }

  let total = 0;
  const segments = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const len = distanceInMeters(path[i], path[i + 1]) || 1;
    segments.push(len);
    total += len;
  }

  let targetDist = fraction * total;
  for (let i = 0; i < segments.length; i += 1) {
    if (targetDist <= segments[i] || i === segments.length - 1) {
      const localFrac = Math.min(1, Math.max(0, targetDist / segments[i]));
      const a = path[i];
      const b = path[i + 1];
      return {
        latitude: a.latitude + (b.latitude - a.latitude) * localFrac,
        longitude: a.longitude + (b.longitude - a.longitude) * localFrac,
        heading: headingBetween(a, b),
      };
    }
    targetDist -= segments[i];
  }
  return path[path.length - 1];
}

function headingBetween(first, second) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitude1 = toRadians(first.latitude);
  const latitude2 = toRadians(second.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2)
    - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function useDeliveryTracking({
  listings,
  currentUser,
  activeRole,
  onRefresh,
  trackingPreference = "gps",
  deliveryId,
}) {
  const [position, setPosition] = useState(null);
  const [mode, setMode] = useState(null);
  const [error, setError] = useState("");
  const [simRoute, setSimRoute] = useState([]);
  const [simRemainingSeconds, setSimRemainingSeconds] = useState(null);
  const [simProgress, setSimProgress] = useState(0);
  const [routingConsentRevision, setRoutingConsentRevision] = useState(0);
  const positionRef = useRef(null);
  const lastPostedAtRef = useRef(0);
  const trackedListingIdRef = useRef(null);

  useEffect(() => {
    const handleConsent = () => setRoutingConsentRevision((revision) => revision + 1);
    window.addEventListener("foodbridge:routing-consent", handleConsent);
    return () => window.removeEventListener("foodbridge:routing-consent", handleConsent);
  }, []);

  const isOwnedActiveDelivery = (listing) =>
    ACTIVE_STATUSES.includes(listing.status) &&
    Number(listing.volunteer_id) === Number(currentUser?.id);
  const activeDelivery = listings.find(
    (listing) =>
      String(listing.id) === String(deliveryId) &&
      isOwnedActiveDelivery(listing)
  ) || listings.find(isOwnedActiveDelivery);

  useEffect(() => {
    if (!activeDelivery || activeRole !== "volunteer" || !currentUser) {
      positionRef.current = null;
      trackedListingIdRef.current = null;
      setPosition(null);
      setMode(null);
      setError("");
      setSimRoute([]);
      setSimRemainingSeconds(null);
      setSimProgress(0);
      return undefined;
    }

    if (String(trackedListingIdRef.current) !== String(activeDelivery.id)) {
      positionRef.current = null;
      trackedListingIdRef.current = activeDelivery.id;
      lastPostedAtRef.current = 0;
      setPosition(null);
      setSimRoute([]);
      setSimRemainingSeconds(null);
      setSimProgress(0);
    }

    const simulation = trackingPreference === "simulation";
    if (trackingPreference === "paused") {
      setMode("paused");
      setError("");
      return undefined;
    }

    const pickup = point(activeDelivery.pickup_latitude, activeDelivery.pickup_longitude);
    const dropoff = point(activeDelivery.dropoff_latitude, activeDelivery.dropoff_longitude);
    let watchId = null;
    let simulationTimer = null;
    let fallbackTimer = null;
    let receivedGps = false;
    let simulationStarting = false;
    let disposed = false;

    const persistPosition = async (nextPosition, force = false) => {
      const now = Date.now();
      if (!force && now - lastPostedAtRef.current < 3000) return;
      lastPostedAtRef.current = now;
      try {
        const result = await updateDeliveryLocation(activeDelivery.id, nextPosition);
        setError("");
        if (result.status !== activeDelivery.status) onRefresh();
      } catch (requestError) {
        if (!disposed) setError(requestError.message || "Could not share the latest delivery position.");
      }
    };

    const publishPosition = (nextPosition, trackingMode, forcePersist = false) => {
      positionRef.current = nextPosition;
      setPosition(nextPosition);
      setMode(trackingMode);
      persistPosition(nextPosition, forcePersist);
    };

    const startSimulation = async () => {
      if (simulationTimer || simulationStarting || disposed) return;
      simulationStarting = true;
      setMode("simulation");

      try {
        if (!pickup || !dropoff) {
          setError("Simulation needs both Donor pickup and NGO drop-off coordinates.");
          return;
        }

        let path = [];
        try {
          const route = await fetchRoadRoute([pickup, dropoff]);
          if (!disposed) {
            const road = roadCoordinates(route);
            if (road.length >= 2) path = road;
          }
        } catch (_routeErr) {
          // Fallback to smooth interpolated path between exact Donor pickup and NGO dropoff
        }

        if (disposed) return;
        if (path.length < 2) {
          path = buildFallbackPath(pickup, dropoff, 40);
        }

        setSimRoute(path.map((pt) => [pt.latitude, pt.longitude]));
        setError("Demo simulation moving from Donor pickup to NGO drop-off.");

        const startedAt = Date.now();
        const totalMs = SIMULATION_DURATION_SECONDS * 1000;
        setSimRemainingSeconds(SIMULATION_DURATION_SECONDS);
        setSimProgress(0);
        publishPosition({ ...path[0], heading: headingBetween(path[0], path[1]) }, "simulation");

        simulationTimer = window.setInterval(() => {
          const elapsed = Date.now() - startedAt;
          const fraction = Math.min(1, elapsed / totalMs);
          const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
          const nextPos = interpolateAlongPath(path, fraction);

          setSimRemainingSeconds(remaining);
          setSimProgress(Math.round(fraction * 100));

          const reachedEnd = fraction >= 1;
          if (nextPos) publishPosition(nextPos, "simulation", reachedEnd);

          if (reachedEnd) {
            setError("Vehicle reached NGO drop-off · Simulation stopped.");
            if (simulationTimer) {
              window.clearInterval(simulationTimer);
              simulationTimer = null;
            }
          }
        }, SIMULATION_INTERVAL_MS);
      } finally {
        simulationStarting = false;
      }
    };

    if (simulation) {
      startSimulation();
    } else if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        ({ coords }) => {
          receivedGps = true;
          if (fallbackTimer) window.clearTimeout(fallbackTimer);
          if (simulationTimer) {
            window.clearInterval(simulationTimer);
            simulationTimer = null;
          }
          publishPosition({
            latitude: coords.latitude,
            longitude: coords.longitude,
            heading: Number.isFinite(coords.heading) ? coords.heading : 0,
          }, "gps");
        },
        (geoError) => {
          if (fallbackTimer) window.clearTimeout(fallbackTimer);
          setError(`${geoError.message || "GPS permission unavailable."} Use the demo simulation on desktop.`);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
      fallbackTimer = window.setTimeout(() => {
        if (!receivedGps && !disposed) setError("Waiting for GPS. Use the demo simulation if testing on desktop.");
      }, 8000);
    } else {
      setError("This browser does not support GPS. Use the demo simulation instead.");
    }

    return () => {
      disposed = true;
      if (watchId != null) navigator.geolocation?.clearWatch(watchId);
      if (simulationTimer) window.clearInterval(simulationTimer);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, [
    activeDelivery?.id,
    activeRole,
    currentUser,
    deliveryId,
    onRefresh,
    routingConsentRevision,
    trackingPreference,
  ]);

  return {
    activeDelivery,
    position,
    mode,
    error,
    simRoute,
    simRemainingSeconds,
    simTotalSeconds: SIMULATION_DURATION_SECONDS,
    simProgress,
  };
}
