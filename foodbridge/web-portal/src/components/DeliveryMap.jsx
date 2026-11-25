import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { divIcon } from "leaflet";
import { CheckCircle2, LocateFixed, MapPin, Minimize2, Navigation, Truck } from "lucide-react";
import { Button } from "./ui/Button";
import { formatDistance } from "../utils/geo";
import {
  allowPublicRouting,
  fetchRoadRoute,
  hasPublicRoutingConsent,
  MAP_TILE_URL,
} from "../services/maps";
import { DeliveryTimeline } from "./DeliveryTimeline";
import { ListingContacts } from "./ListingContacts";
import "leaflet/dist/leaflet.css";

const pickupIcon = divIcon({
  className: "delivery-map-pin",
  html: '<span class="delivery-map-pin__dot delivery-map-pin__pickup"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
const dropoffIcon = divIcon({
  className: "delivery-map-pin",
  html: '<span class="delivery-map-pin__dot delivery-map-pin__dropoff"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
const userLocationIcon = divIcon({
  className: "delivery-map-pin",
  html: '<span class="delivery-map-pin__dot delivery-map-pin__user"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function SmoothRiderMarker({ position }) {
  const markerRef = useRef(null);
  const initialPosition = useRef([position.latitude, position.longitude]);
  const icon = useMemo(() => divIcon({
    className: "delivery-map-pin",
    html: `<span class="delivery-map-vehicle" style="--vehicle-bearing:${Number(position.heading) || 0}deg"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M7 14.5h15.2a3 3 0 0 1 2.5 1.3l3.1 4.7H31a2 2 0 0 1 2 2v3H4v-8a3 3 0 0 1 3-3Z" fill="#e8643c" stroke="#fff" stroke-width="1.8"/><path d="M11 18h8v4h-8zM21 18h3l2.2 4H21z" fill="#fff3df"/><circle cx="10" cy="27.5" r="3" fill="#21352a" stroke="#fff" stroke-width="1.5"/><circle cx="27" cy="27.5" r="3" fill="#21352a" stroke="#fff" stroke-width="1.5"/></svg></span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  }), [position.heading]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return undefined;
    const start = marker.getLatLng();
    const end = { lat: position.latitude, lng: position.longitude };
    const startedAt = performance.now();
    let frameId;
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / 800);
      const eased = 1 - (1 - progress) ** 3;
      marker.setLatLng([
        start.lat + (end.lat - start.lat) * eased,
        start.lng + (end.lng - start.lng) * eased,
      ]);
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [position.latitude, position.longitude]);

  return <Marker ref={markerRef} position={initialPosition.current} icon={icon} />;
}

function FitRouteBounds({ listing }) {
  const map = useMap();
  useEffect(() => {
    const points = [
      [listing.pickup_latitude, listing.pickup_longitude],
      [listing.dropoff_latitude, listing.dropoff_longitude],
    ].filter(([latitude, longitude]) => latitude != null && longitude != null);
    if (points.length === 2) {
      map.fitBounds(points.map(([latitude, longitude]) => [Number(latitude), Number(longitude)]), { padding: [48, 48], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView([Number(points[0][0]), Number(points[0][1])], 14);
    }
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timer);
  }, [map, listing.id, listing.pickup_latitude, listing.pickup_longitude, listing.dropoff_latitude, listing.dropoff_longitude]);
  return null;
}

function FitRiderBounds({ listing, riderPosition }) {
  const map = useMap();
  const fittedListingId = useRef(null);
  useEffect(() => {
    if (!riderPosition || String(fittedListingId.current) === String(listing.id)) return;
    const points = [riderPosition, point(listing.pickup_latitude, listing.pickup_longitude), point(listing.dropoff_latitude, listing.dropoff_longitude)]
      .filter(Boolean)
      .map(({ latitude, longitude }) => [latitude, longitude]);
    if (points.length > 1) {
      map.fitBounds(points, { padding: [48, 48] });
      fittedListingId.current = listing.id;
    }
  }, [map, listing, riderPosition]);
  return null;
}

function FitRoadBounds({ coordinates, routeKey }) {
  const map = useMap();
  const fittedKey = useRef(null);
  useEffect(() => {
    if (coordinates.length > 1 && fittedKey.current !== routeKey) {
      map.fitBounds(coordinates, { padding: [48, 48], maxZoom: 16 });
      fittedKey.current = routeKey;
    }
  }, [coordinates, map, routeKey]);
  return null;
}

function LocateUser({ onLocation, onError }) {
  const map = useMap();
  const locate = () => {
    if (!navigator.geolocation) {
      onError("This browser does not support device location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { latitude: coords.latitude, longitude: coords.longitude };
        onLocation(position);
        map.setView([position.latitude, position.longitude], 16, { animate: true });
      },
      (error) => onError(error.message || "Could not read device location."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    locate();
  }, []);

  return (
    <button type="button" className="delivery-map-recenter" onClick={locate} aria-label="Recenter on my location">
      <LocateFixed className="w-4 h-4" /> <span>Recenter on Me</span>
    </button>
  );
}

function useRoadRoute(points, routeKey) {
  const pointsRef = useRef(points);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  pointsRef.current = points;

  useEffect(() => {
    let disposed = false;
    let requestId = 0;
    let retryDelay = 15000;
    let timer = null;
    const request = async () => {
      const currentRequestId = ++requestId;
      const currentPoints = pointsRef.current;
      if (currentPoints.length < 2) {
        setRoute(null);
        setError(new Error("Add pickup and drop-off coordinates to calculate road routing."));
        retryDelay = 15000;
        return;
      }
      try {
        const result = await fetchRoadRoute(currentPoints);
        if (disposed || currentRequestId !== requestId) return;
        setRoute({ ...result, receivedAt: Date.now() });
        setError("");
        retryDelay = 5000;
      } catch (routeError) {
        if (!disposed && currentRequestId === requestId) {
          setRoute(null);
          setError(routeError);
          retryDelay = routeError.code === "ROUTING_CONSENT_REQUIRED" ? 60000 : 15000;
        }
      }
    };
    const scheduleNext = () => {
      if (disposed) return;
      timer = window.setTimeout(async () => {
        await request();
        scheduleNext();
      }, retryDelay);
    };
    request().then(scheduleNext);
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [routeKey]);

  return { route, error };
}

function point(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function EmptyDeliveryMap({ onClose }) {
  const [viewerPosition, setViewerPosition] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [tileError, setTileError] = useState(false);
  return (
    <div className="delivery-map-shell" role="dialog" aria-modal="true" aria-label="Live delivery map">
      <div className="delivery-map-topbar">
        <div>
          <p className="delivery-map-eyebrow"><Navigation className="w-3.5 h-3.5" /> LIVE DELIVERY TRACKING</p>
          <h2>Nearby delivery map</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose} aria-label="Return to dashboard">
          <Minimize2 className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
        </Button>
      </div>
      <div className="delivery-map-content">
        <MapContainer center={[0, 0]} zoom={2} scrollWheelZoom className="delivery-map-canvas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={MAP_TILE_URL}
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <LocateUser onLocation={setViewerPosition} onError={setLocationError} />
          {viewerPosition && <Marker position={[viewerPosition.latitude, viewerPosition.longitude]} icon={userLocationIcon}><Tooltip>You are here</Tooltip></Marker>}
        </MapContainer>
        <aside className="delivery-map-panel">
          <MapPin className="w-10 h-10 text-[var(--color-leaf-green)]" />
          <h2>No delivery locations yet</h2>
          <p>Post a donation with pickup and drop-off locations to see its route here.</p>
          {locationError && <p className="delivery-map-note" role="status">{locationError}</p>}
          {tileError && <p className="delivery-map-note" role="status">Map tiles are unavailable. Configure a self-hosted tile source with MAP_TILES_BASE_URL.</p>}
        </aside>
      </div>
    </div>
  );
}

export function DeliveryMap(props) {
  const activeListing = props.listings.find((item) => String(item.id) === String(props.selectedListingId))
    || props.listings.find((item) => ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff", "delivered"].includes(item.status))
    || props.listings[0];
  if (!activeListing) {
    return <EmptyDeliveryMap onClose={props.onClose} />;
  }
  return <DeliveryMapContent {...props} activeListing={activeListing} />;
}

function DeliveryMapContent({
  listings,
  activeListing,
  selectedListingId,
  currentUser,
  activeRole,
  riderPosition,
  trackingMode,
  trackingError,
  trackingDeliveryId,
  trackingPreference,
  simRoute = [],
  simRemainingSeconds = null,
  simTotalSeconds = 18,
  simProgress = 0,
  onSelectListing,
  onClose,
  onAction,
  onStartSimulation,
  onPauseSimulation,
  onUseLiveGPS,
}) {
  const [updatingStep, setUpdatingStep] = useState("");
  const pickup = point(activeListing.pickup_latitude, activeListing.pickup_longitude);
  const dropoff = point(activeListing.dropoff_latitude, activeListing.dropoff_longitude);
  const isCourier = activeRole === "volunteer" && (Number(activeListing.volunteer_id) === Number(currentUser?.id) || currentUser?.role === "volunteer");
  const tracksSelectedDelivery = selectedListingId == null || String(selectedListingId) === String(trackingDeliveryId);
  const rider = (isCourier && tracksSelectedDelivery ? riderPosition : null) || point(activeListing.volunteer_latitude, activeListing.volunteer_longitude);
  const isComplete = ["delivered", "distributed"].includes(activeListing.status);
  const routePoints = pickup && dropoff ? [pickup, dropoff] : [rider, pickup, dropoff].filter(Boolean);
  const usableRoutePoints = routePoints.filter(Boolean);
  const routeKey = [
    activeListing.id,
    pickup?.latitude,
    pickup?.longitude,
    dropoff?.latitude,
    dropoff?.longitude,
  ].join("|");
  const [routingConsentRevision, setRoutingConsentRevision] = useState(0);
  useEffect(() => {
    const handleConsent = () => setRoutingConsentRevision((revision) => revision + 1);
    window.addEventListener("foodbridge:routing-consent", handleConsent);
    return () => window.removeEventListener("foodbridge:routing-consent", handleConsent);
  }, []);
  const { route: roadRoute, error: routeError } = useRoadRoute(
    usableRoutePoints,
    `${routeKey}|${routingConsentRevision}`
  );
  const route = useMemo(() => {
    const roadCoords = roadRoute?.coordinates?.map(([longitude, latitude]) => [latitude, longitude]);
    if (roadCoords?.length > 1) return roadCoords;
    if (simRoute?.length > 1) return simRoute;
    if (pickup && dropoff) return [[pickup.latitude, pickup.longitude], [dropoff.latitude, dropoff.longitude]];
    return [];
  }, [roadRoute, simRoute, pickup, dropoff]);
  const activeLegIndex = 0;
  const activeLeg = roadRoute?.legs?.[activeLegIndex];
  const fallbackDistanceMeters = pickup && dropoff
    ? Math.round(
      6371000 * 2 * Math.atan2(
        Math.sqrt(
          Math.sin(((dropoff.latitude - pickup.latitude) * Math.PI) / 360) ** 2 +
          Math.cos((pickup.latitude * Math.PI) / 180) *
          Math.cos((dropoff.latitude * Math.PI) / 180) *
          Math.sin(((dropoff.longitude - pickup.longitude) * Math.PI) / 360) ** 2
        ),
        Math.sqrt(
          1 - (
            Math.sin(((dropoff.latitude - pickup.latitude) * Math.PI) / 360) ** 2 +
            Math.cos((pickup.latitude * Math.PI) / 180) *
            Math.cos((dropoff.latitude * Math.PI) / 180) *
            Math.sin(((dropoff.longitude - pickup.longitude) * Math.PI) / 360) ** 2
          )
        )
      )
    )
    : null;
  const rawDistance = isComplete ? 0 : activeLeg?.distance ?? roadRoute?.distance ?? fallbackDistanceMeters;
  const rawDuration = activeLeg?.duration ?? roadRoute?.duration ?? null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remainingDuration = rawDuration == null ? null : Math.max(0, rawDuration - (now - (roadRoute?.receivedAt || now)) / 1000);
  const activeCountdownSeconds = trackingPreference === "simulation" && simRemainingSeconds != null
    ? simRemainingSeconds
    : remainingDuration;
  const etaLabel = isComplete || (trackingPreference === "simulation" && simRemainingSeconds === 0)
    ? "Arrived (0:00)"
    : activeCountdownSeconds == null
    ? "--"
    : `${Math.floor(activeCountdownSeconds / 60)}:${String(Math.ceil(activeCountdownSeconds % 60)).padStart(2, "0")}`;

  const deliverySteps = [
    { action: "arrive", status: "arrived_at_pickup", label: "1. Arrived at Pickup" },
    { action: "collect", status: "picked_up", label: "2. Confirm Pickup" },
    { action: "start_delivery", status: "out_for_delivery", label: "3. Start Delivery" },
    { action: "arrive_dropoff", status: "arrived_at_dropoff", label: "4. Arrived at Drop-off" },
    { action: "deliver", status: "delivered", label: "5. Mark as Delivered" },
  ];
  const statusOrder = ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff", "delivered", "distributed"];
  const currentStepIndex = statusOrder.indexOf(activeListing.status);

  const handleStepSelect = async (stepAction) => {
    setUpdatingStep(stepAction);
    try {
      await onAction(activeListing.id, stepAction);
    } finally {
      setUpdatingStep("");
    }
  };
  const mapCenter = pickup
    ? [pickup.latitude, pickup.longitude]
    : dropoff
    ? [dropoff.latitude, dropoff.longitude]
    : [0, 0];
  const [viewerPosition, setViewerPosition] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [tileError, setTileError] = useState(false);

  return (
    <div className="delivery-map-shell" role="dialog" aria-modal="true" aria-label="Live delivery map">
      <div className="delivery-map-topbar">
        <div className="min-w-0">
          <p className="delivery-map-eyebrow"><Navigation className="w-3.5 h-3.5" /> LIVE DELIVERY TRACKING</p>
          <h2 className="truncate">{activeListing.title || `Delivery #${activeListing.id}`}</h2>
        </div>
        <div className="flex items-center gap-2">
          {listings.length > 1 && (
            <select
              aria-label="Select delivery"
              value={activeListing.id}
              onChange={(event) => onSelectListing(event.target.value)}
              className="delivery-map-select"
            >
              {listings.map((item) => <option key={item.id} value={item.id}>{item.title || `Delivery #${item.id}`}</option>)}
            </select>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="Minimize map and return to dashboard">
            <Minimize2 className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
          </Button>
        </div>
      </div>

      <div className="delivery-map-content">
        <MapContainer center={mapCenter} zoom={pickup || dropoff ? 13 : 2} scrollWheelZoom className="delivery-map-canvas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={MAP_TILE_URL}
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <FitRouteBounds listing={activeListing} />
          <FitRiderBounds listing={activeListing} riderPosition={rider} />
          <FitRoadBounds coordinates={route} routeKey={routeKey} />
          <LocateUser onLocation={setViewerPosition} onError={setLocationError} />
          {pickup && <Marker position={[pickup.latitude, pickup.longitude]} icon={pickupIcon}><Tooltip permanent direction="top">Pickup</Tooltip></Marker>}
          {dropoff && <Marker position={[dropoff.latitude, dropoff.longitude]} icon={dropoffIcon}><Tooltip permanent direction="top">Drop-off</Tooltip></Marker>}
          {rider && <SmoothRiderMarker position={rider} />}
          {viewerPosition && <Marker position={[viewerPosition.latitude, viewerPosition.longitude]} icon={userLocationIcon}><Tooltip>You are here</Tooltip></Marker>}
          {route.length > 1 && <Polyline positions={route} pathOptions={{ color: "#2f6d43", weight: 6, opacity: 0.9 }} />}
        </MapContainer>

        <aside className="delivery-map-panel">
          <div className={`delivery-status-banner ${activeListing.status === "delivered" || activeListing.status === "distributed" ? "is-delivered" : ""}`}>
            <span className="delivery-status-indicator" />
            <div>
              <span className="delivery-status-label">ORDER STATUS</span>
              <strong>
                {isComplete
                  ? `Delivered · Delivery Done Successfully (${activeListing.meals || 0} meals)`
                  : activeListing.status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
              </strong>
            </div>
            {(activeListing.status === "delivered" || activeListing.status === "distributed") && <CheckCircle2 className="w-5 h-5" />}
          </div>

          <div className="delivery-route-summary">
            <div className="delivery-route-stop">
              <span className="route-stop-dot pickup-dot" />
              <div>
                <small>DONOR PICKUP</small>
                <span>{activeListing.pickup_address || activeListing.pickupAddress || "Pickup location"}</span>
                {pickup && <small className="font-mono text-[10px]">{pickup.latitude.toFixed(5)}, {pickup.longitude.toFixed(5)}</small>}
              </div>
            </div>
            <div className="delivery-route-line" />
            <div className="delivery-route-stop">
              <span className="route-stop-dot dropoff-dot" />
              <div>
                <small>NGO DROP-OFF</small>
                <span>{activeListing.dropoff_address || activeListing.dropoffAddress || "Awaiting NGO drop-off"}</span>
                {dropoff && <small className="font-mono text-[10px]">{dropoff.latitude.toFixed(5)}, {dropoff.longitude.toFixed(5)}</small>}
              </div>
            </div>
          </div>

          <div className="delivery-metrics">
            <div><strong>{formatDistance(rawDistance)}</strong><span>Route distance</span></div>
            <div><strong>{etaLabel}</strong><span>{trackingPreference === "simulation" ? "Demo Countdown" : "Road ETA (min:sec)"}</span></div>
          </div>

          {trackingPreference === "simulation" && (
            <div className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span>Vehicle Demo Simulation</span>
                <span>{simRemainingSeconds === 0 ? "Arrived (100%)" : `${simProgress}% · ${etaLabel}`}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-amber-200 overflow-hidden">
                <div className="h-full bg-[var(--color-leaf-green)] transition-all duration-300" style={{ width: `${simProgress}%` }} />
              </div>
            </div>
          )}
          {roadRoute?.steps?.length > 0 && (
            <ol className="delivery-directions" aria-label="Road directions">
              {roadRoute.steps.map((step, index) => (
                <li key={`${step.name}-${index}`}>
                  <span>{[step.type, step.modifier, step.name].filter(Boolean).join(" ") || "Continue on route"}</span>
                  <small>{formatDistance(step.distance)}</small>
                </li>
              ))}
            </ol>
          )}
          <DeliveryTimeline listing={activeListing} compact />
          <ListingContacts listing={activeListing} activeRole={activeRole} currentUser={currentUser} />

          {activeListing.volunteer_name && (
            <div className="delivery-rider-chip"><Truck className="w-4 h-4" /> {activeListing.volunteer_name}
              {isCourier && tracksSelectedDelivery && trackingMode && <span className={`tracking-mode-pill ${trackingMode}`}>{trackingMode === "gps" ? "LIVE GPS" : trackingMode === "simulation" ? "DEMO RIDE" : "PAUSED"}</span>}
            </div>
          )}
          {trackingError && tracksSelectedDelivery && <p className="delivery-map-note" role="status">{trackingError}</p>}
          {locationError && <p className="delivery-map-note" role="status">{locationError}</p>}
          {tileError && <p className="delivery-map-note" role="status">Map tiles could not be loaded. Check your connection or set VITE_MAP_TILES_URL to another tile source.</p>}
          {routeError?.code === "ROUTING_CONSENT_REQUIRED" && !hasPublicRoutingConsent() ? (
            <div className="delivery-map-note delivery-map-privacy-note" role="status">
              <p>Public OSRM can draw street routes by default. Allowing it sends pickup, drop-off, and rider coordinates to the configured public service (router.project-osrm.org by default).</p>
              <Button size="sm" variant="secondary" onClick={allowPublicRouting}>Allow public road routing</Button>
            </div>
          ) : routeError && (
            <p className="delivery-map-note" role="status">{routeError.message || routeError}</p>
          )}
          {isCourier && tracksSelectedDelivery && ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff"].includes(activeListing.status) && (
            <div className="delivery-sim-controls">
              {trackingPreference === "simulation" ? (
                <Button variant="secondary" size="sm" onClick={onPauseSimulation}>Pause Demo</Button>
              ) : (
                <Button variant="primary" size="sm" onClick={onStartSimulation}>Start Demo Simulation</Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={onUseLiveGPS}
                disabled={trackingPreference === "gps"}
              >
                {trackingPreference === "gps" ? "Live GPS Active" : "Use Live GPS"}
              </Button>
            </div>
          )}
          {(!pickup || !dropoff) && (
            <p className="delivery-map-note">
              Add pickup and drop-off coordinates to pin both stops and show their street route.
            </p>
          )}

          {activeRole === "volunteer" && activeListing.status === "available" && (
            <Button className="w-full" variant="mango" onClick={() => onAction(activeListing.id, "claim")}>
              <Truck className="w-4 h-4" /> Accept Order
            </Button>
          )}
          {(isCourier || activeRole === "volunteer") && activeListing.status !== "available" && (
            <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3" aria-label="Update delivery completion step">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-forest-text)]">
                Select Completed Delivery Step
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {deliverySteps.map((step, index) => {
                  const targetIdx = index + 1;
                  const completed = currentStepIndex >= targetIdx;
                  const isNext = currentStepIndex === targetIdx - 1;
                  return (
                    <Button
                      key={step.action}
                      type="button"
                      size="sm"
                      variant={completed ? "secondary" : isNext ? "primary" : "outline"}
                      disabled={completed || isComplete || updatingStep !== ""}
                      loading={updatingStep === step.action}
                      onClick={() => handleStepSelect(step.action)}
                      className="w-full justify-between text-xs font-bold"
                    >
                      <span>{step.label}</span>
                      <span>{completed ? "Done ✓" : isNext ? "Mark Done" : "Complete"}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          {activeRole === "ngo" && activeListing.status === "delivered" && (
            <Button className="w-full" variant="primary" onClick={() => onAction(activeListing.id, "distribute")}>
              <CheckCircle2 className="w-4 h-4" /> Confirm receipt
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
