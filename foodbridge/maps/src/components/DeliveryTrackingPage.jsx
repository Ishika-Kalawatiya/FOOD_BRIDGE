import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "../styles/delivery-tracking.css";
import { ArrowLeft, Check, Clock3, LocateFixed, MapPin, Navigation, PackageCheck, Pause, Phone, Play, RotateCcw, X } from "lucide-react";

const BENGALURU_PICKUP = [12.9716, 77.5946];
const BENGALURU_DROPOFF = [12.9352, 77.6245];
const DELIVERY_STEPS = ["Accepted", "Heading to Pickup", "Order Picked Up", "Out for Delivery", "Delivered"];

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export function createFallbackDeliveryListing(orderId) {
  const id = String(orderId);
  return {
    id,
    title: `Food rescue delivery #${id}`,
    meals: 35,
    status: "claimed",
    pickup_address: "Green Valley Dining Hall, MG Road, Bengaluru",
    pickup_latitude: BENGALURU_PICKUP[0],
    pickup_longitude: BENGALURU_PICKUP[1],
    donor_name: "Green Valley Dining Hall",
    donor_org: "Campus Canteen",
    donor_phone: "",
    dropoff_address: "Hope Community Shelter, Jayanagar, Bengaluru",
    dropoff_latitude: BENGALURU_DROPOFF[0],
    dropoff_longitude: BENGALURU_DROPOFF[1],
    ngo_org: "Hope Community Shelter",
    ngo_phone: "",
    volunteer_name: "Courier Alex",
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function readCoordinate(value, latitude, longitude, fallback) {
  if (Array.isArray(value) && value.length >= 2) {
    const coordinate = [Number(value[0]), Number(value[1])];
    if (coordinate.every(Number.isFinite)) return coordinate;
  }
  if (value && typeof value === "object") {
    const coordinate = [Number(value.lat ?? value.latitude), Number(value.lng ?? value.lon ?? value.longitude)];
    if (coordinate.every(Number.isFinite)) return coordinate;
  }
  const coordinate = [Number(latitude), Number(longitude)];
  return coordinate.every(Number.isFinite) ? coordinate : fallback;
}

function coordinatesFor(listing, routeState) {
  const pickup = readCoordinate(
    routeState?.pickup?.coordinates ?? routeState?.pickupCoordinates ?? routeState?.pickup ??
      listing.pickup_coordinates ?? listing.pickupCoordinates ?? listing.pickup_location,
    listing.pickup_latitude ?? listing.pickupLat,
    listing.pickup_longitude ?? listing.pickupLng,
    BENGALURU_PICKUP
  );
  const dropoff = readCoordinate(
    routeState?.dropoff?.coordinates ?? routeState?.dropoffCoordinates ?? routeState?.dropoff ??
      listing.dropoff_coordinates ?? listing.dropoffCoordinates ?? listing.dropoff_location,
    listing.dropoff_latitude ?? listing.recipient_latitude,
    listing.dropoff_longitude ?? listing.recipient_longitude,
    BENGALURU_DROPOFF
  );
  return { pickup, dropoff };
}

function interpolateRoute(start, end, bend = 0.12) {
  const latDelta = end[0] - start[0];
  const lngDelta = end[1] - start[1];
  const length = Math.hypot(latDelta, lngDelta) || 1;
  const offsetLat = (-lngDelta / length) * bend * length;
  const offsetLng = (latDelta / length) * bend * length;
  return Array.from({ length: 25 }, (_, index) => {
    const progress = index / 24;
    const curve = Math.sin(progress * Math.PI) * 0.35;
    return [
      start[0] + latDelta * progress + offsetLat * curve,
      start[1] + lngDelta * progress + offsetLng * curve,
    ];
  });
}

function fallbackRoadRoute(start, end) {
  const latDelta = end[0] - start[0];
  const lngDelta = end[1] - start[1];
  const waypoints = [
    start,
    [start[0] + latDelta * 0.18, start[1] + lngDelta * 0.32],
    [start[0] + latDelta * 0.42, start[1] + lngDelta * 0.38],
    [start[0] + latDelta * 0.48, start[1] + lngDelta * 0.72],
    [start[0] + latDelta * 0.78, start[1] + lngDelta * 0.76],
    end,
  ];
  return waypoints.slice(1).reduce((route, waypoint) => {
    const leg = interpolateRoute(route[route.length - 1], waypoint, 0.035);
    return route.concat(leg.slice(1));
  }, [start]);
}

function distanceInKm(points) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const lat1 = radians(previous[0]);
    const lat2 = radians(point[0]);
    const latDelta = radians(point[0] - previous[0]);
    const lngDelta = radians(point[1] - previous[1]);
    const a = Math.sin(latDelta / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
    return total + 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

function pointAt(points, progress) {
  const segmentLengths = points.slice(1).map((point, index) => distanceInKm([points[index], point]));
  const totalLength = segmentLengths.reduce((total, length) => total + length, 0);
  let distanceRemaining = Math.max(0, Math.min(1, progress)) * totalLength;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (distanceRemaining <= segmentLength || index === segmentLengths.length - 1) {
      const fraction = segmentLength ? distanceRemaining / segmentLength : 0;
      const start = points[index];
      const end = points[index + 1];
      return [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ];
    }
    distanceRemaining -= segmentLength;
  }
  return points[points.length - 1];
}

function bearingAt(points, progress) {
  const point = pointAt(points, progress);
  const next = pointAt(points, Math.min(1, progress + 0.01));
  return (Math.atan2(next[1] - point[1], next[0] - point[0]) * 180) / Math.PI;
}

function createPin(label, variant) {
  return L.divIcon({
    className: "delivery-leaflet-icon",
    html: `<div class="delivery-map-pin delivery-map-pin--${variant}"><span></span><b>${label}</b></div>`,
    iconSize: [42, 48],
    iconAnchor: [21, 43],
  });
}

function createBikeIcon() {
  return L.divIcon({
    className: "delivery-leaflet-icon",
    html: '<div class="delivery-bike-marker"><span>🛵</span></div>',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

export function DeliveryTrackingPage({ listing, routeState, onAction, onBack, toast }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const bikeMarkerRef = useRef(null);
  const routeBoundsRef = useRef(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState("");
  const [phase, setPhase] = useState(() =>
    listing.status === "distributed" ? "delivered" :
      listing.status === "collected" ? "out_for_delivery" : "accepted"
  );
  const [segment, setSegment] = useState("pickup");
  const [progress, setProgress] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [mapError, setMapError] = useState("");

  const coordinatesSignature = JSON.stringify({
    pickup: [
      routeState?.pickup?.coordinates, routeState?.pickupCoordinates, routeState?.pickup,
      listing.pickup_coordinates, listing.pickupCoordinates, listing.pickup_location,
      listing.pickup_latitude, listing.pickupLat, listing.pickup_longitude, listing.pickupLng,
    ],
    dropoff: [
      routeState?.dropoff?.coordinates, routeState?.dropoffCoordinates, routeState?.dropoff,
      listing.dropoff_coordinates, listing.dropoffCoordinates, listing.dropoff_location,
      listing.dropoff_latitude, listing.recipient_latitude,
      listing.dropoff_longitude, listing.recipient_longitude,
    ],
  });
  const { pickup, dropoff } = useMemo(
    () => coordinatesFor(listing, routeState),
    [coordinatesSignature]
  );
  const fallbackDeliveryRoute = useMemo(() => fallbackRoadRoute(pickup, dropoff), [pickup, dropoff]);
  const [deliveryRoute, setDeliveryRoute] = useState(fallbackDeliveryRoute);
  useEffect(() => {
    const controller = new AbortController();
    setDeliveryRoute(fallbackDeliveryRoute);

    const routeUrl = new URL(
      `https://router.project-osrm.org/route/v1/driving/${pickup[1]},${pickup[0]};${dropoff[1]},${dropoff[0]}`
    );
    routeUrl.searchParams.set("overview", "full");
    routeUrl.searchParams.set("geometries", "geojson");

    fetch(routeUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const coordinates = data.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          throw new Error("Routing service returned no road geometry");
        }
        const roadCoordinates = coordinates.map(([longitude, latitude]) => [latitude, longitude]);
        if (roadCoordinates.some((coordinate) => coordinate.some((value) => !Number.isFinite(value)))) {
          throw new Error("Routing service returned invalid coordinates");
        }
        setDeliveryRoute(roadCoordinates);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDeliveryRoute(fallbackDeliveryRoute);
      });

    return () => controller.abort();
  }, [dropoff, fallbackDeliveryRoute, pickup]);

  const approachStart = useMemo(() => [pickup[0] + 0.006, pickup[1] - 0.007], [pickup]);
  const pickupRoute = useMemo(() => interpolateRoute(approachStart, pickup, 0.08), [approachStart, pickup]);
  const activeRoute = segment === "pickup" ? pickupRoute : deliveryRoute;
  const legDistance = distanceInKm(activeRoute);
  const pickupDistance = distanceInKm(pickupRoute);
  const deliveryDistance = distanceInKm(deliveryRoute);
  const remainingDistance = isMoving
    ? legDistance * (1 - progress) + (segment === "pickup" ? deliveryDistance : 0)
    : phase === "accepted"
      ? pickupDistance + deliveryDistance
      : phase === "heading_to_pickup"
        ? (progress >= 1 ? deliveryDistance : pickupDistance + deliveryDistance)
      : phase === "picked_up" || phase === "out_for_delivery"
        ? deliveryDistance
        : 0;
  const etaMinutes = Math.ceil(remainingDistance / 0.35);

  const pickupAddress = listing.pickup_address || routeState?.pickup?.address || "Green Valley Dining Hall, Bengaluru";
  const dropoffAddress = listing.dropoff_address || listing.recipient_address ||
    listing.ngo_address || routeState?.dropoff?.address || "Hope Community Shelter, Bengaluru";
  const pickupName = listing.donor_name || listing.donor_org || routeState?.pickup?.contactName || "Donor";
  const dropoffName = listing.recipient_name || listing.ngo_contact ||
    listing.ngo_org || routeState?.dropoff?.contactName || "Hope Community Shelter";
  const pickupPhone = listing.donor_phone || routeState?.pickup?.phone || "+91 98765 43210";
  const dropoffPhone = listing.recipient_phone || listing.ngo_phone || routeState?.dropoff?.phone || "+91 98765 43211";

  useEffect(() => {
    if (!selectedContact) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedContact(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedContact]);

  const recenterRoute = () => {
    if (mapRef.current && routeBoundsRef.current) {
      mapRef.current.fitBounds(routeBoundsRef.current, { padding: [42, 42] });
    }
  };

  const copyPhoneNumber = async () => {
    try {
      await navigator.clipboard.writeText(selectedContact.phone);
      setCopiedPhone(selectedContact.phone);
      window.setTimeout(() => setCopiedPhone(""), 1800);
    } catch (error) {
      toast(error.message || "Could not copy the phone number.", "error");
    }
  };

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return undefined;
    let map;
    try {
      map = L.map(mapElementRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);
      L.polyline(deliveryRoute, { color: "#34d399", opacity: 0.16, weight: 14, lineCap: "round" }).addTo(map);
      L.polyline(deliveryRoute, { color: "#34d399", opacity: 0.95, weight: 5, lineCap: "round" }).addTo(map);
      L.polyline(pickupRoute, { color: "#38bdf8", opacity: 0.75, weight: 4, dashArray: "7 9" }).addTo(map);
      L.marker(pickup, { icon: createPin("PICKUP", "pickup") }).addTo(map);
      L.marker(dropoff, { icon: createPin("DROP-OFF", "dropoff") }).addTo(map);
      const bikeStart = listing.status === "distributed"
        ? dropoff
        : listing.status === "collected" ? pickup : approachStart;
      const bikeMarker = L.marker(bikeStart, { icon: createBikeIcon(), zIndexOffset: 1000 }).addTo(map);
      bikeMarkerRef.current = bikeMarker;
      routeBoundsRef.current = L.latLngBounds([approachStart, ...deliveryRoute]);
      map.fitBounds(routeBoundsRef.current, { padding: [42, 42] });
      mapRef.current = map;
      const resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(mapElementRef.current);
      window.requestAnimationFrame(() => map.invalidateSize());
      map.once("unload", () => resizeObserver.disconnect());
    } catch (error) {
      if (map) map.remove();
      setMapError(error instanceof Error ? error.message : "The map could not be initialized.");
      return undefined;
    }

    return () => {
      map.remove();
      mapRef.current = null;
      bikeMarkerRef.current = null;
      routeBoundsRef.current = null;
    };
  }, [approachStart, deliveryRoute, pickup, pickupRoute, dropoff, listing.status]);

  useEffect(() => {
    if (!isMoving || !bikeMarkerRef.current) return undefined;
    const movingMarker = bikeMarkerRef.current;
    const route = segment === "pickup" ? pickupRoute : deliveryRoute;
    const initialProgress = progress;
    const duration = segment === "pickup" ? 14000 : 28000;
    const startedAt = performance.now() - initialProgress * duration;

    const animate = () => {
      const nextProgress = Math.min(1, (performance.now() - startedAt) / duration);
      movingMarker.setLatLng(pointAt(route, nextProgress));
      const iconElement = movingMarker.getElement()?.querySelector(".delivery-bike-marker");
      if (iconElement) iconElement.style.transform = `rotate(${bearingAt(route, nextProgress)}deg)`;
      setProgress(nextProgress);
      if (nextProgress >= 1) {
        window.clearInterval(animationInterval);
        setIsMoving(false);
        setPhase(segment === "pickup" ? "heading_to_pickup" : "out_for_delivery");
      }
    };
    const animationInterval = window.setInterval(animate, 50);
    return () => window.clearInterval(animationInterval);
  }, [deliveryRoute, isMoving, pickupRoute, segment]);

  const startRide = () => {
    if (phase === "accepted") {
      setSegment("pickup");
      setProgress(0);
      setPhase("heading_to_pickup");
      setIsMoving(true);
    } else if (phase === "picked_up") {
      setSegment("delivery");
      setProgress(0);
      setPhase("out_for_delivery");
      setIsMoving(true);
    } else if (phase === "heading_to_pickup" && progress < 1) {
      setSegment("pickup");
      setIsMoving(true);
    } else if (phase === "out_for_delivery" && progress < 1) {
      setSegment("delivery");
      setIsMoving(true);
    }
  };

  const runAction = async (action, nextPhase) => {
    setIsUpdating(true);
    try {
      await onAction(listing.id, action);
      setPhase(nextPhase);
      setProgress(0);
      if (action === "collect") setSegment("delivery");
    } catch (error) {
      toast(error.message || "Could not update delivery status.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const currentStep = phase === "delivered" ? 4 :
    phase === "out_for_delivery" ? 3 :
      phase === "picked_up" ? 2 :
        phase === "heading_to_pickup" ? 1 : 0;
  const statusLabel = phase === "delivered" ? "Delivered successfully" :
    phase === "out_for_delivery" ? "On the way to recipient" :
      phase === "picked_up" ? "Food picked up" :
        phase === "heading_to_pickup" ? (isMoving ? "Courier heading to pickup" : "Courier arrived at pickup") :
          "Delivery accepted";
  const pickupReady = phase === "heading_to_pickup" && progress >= 1 && !isMoving;
  const deliveryReady = phase === "out_for_delivery" && progress >= 1 && !isMoving;

  return (
    <section className="delivery-tracking-page space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to rescue board" className="delivery-icon-button">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Live delivery tracking</p>
            <h1 className="mt-1 text-xl font-extrabold text-white sm:text-2xl">{listing.title}</h1>
            <p className="mt-1 text-xs text-slate-400">Delivery #{listing.id} <span className="px-1 text-slate-600">/</span> {listing.meals} meals</p>
          </div>
        </div>
        <div className="delivery-live-pill"><span /> LIVE TRACKING</div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <div className="delivery-map-shell glass-card rounded-2xl border border-slate-800 shadow-2xl">
          <div className="delivery-map-topline">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Navigation className="h-4 w-4 text-emerald-400" />
              Bengaluru rescue route
            </div>
            <div className="delivery-map-actions">
              <div className="delivery-map-eta">
                <Clock3 className="h-3.5 w-3.5" />
                {phase === "delivered" ? "Arrived" : `${etaMinutes} min${etaMinutes === 1 ? "" : "s"} away`}
              </div>
              <button type="button" className="delivery-recenter-button" onClick={recenterRoute}>
                <LocateFixed className="h-3.5 w-3.5" /> Recenter Route
              </button>
            </div>
          </div>
          {mapError ? (
            <div className="delivery-map-error" role="alert">{mapError}</div>
          ) : (
            <div ref={mapElementRef} className="delivery-map-canvas" aria-label="Live delivery route map" tabIndex={0} />
          )}
          <div className="delivery-map-legend">
            <span><i className="delivery-legend-dot pickup" /> Pickup</span>
            <span><i className="delivery-legend-dot dropoff" /> Drop-off</span>
            <span><i className="delivery-legend-line" /> Delivery route</span>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap contributors
            </a>
          </div>
        </div>

        <aside className="glass-card rounded-2xl border border-slate-800 p-4 shadow-xl sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Delivery status</p>
              <h2 className="mt-1 text-base font-extrabold text-white">{statusLabel}</h2>
            </div>
            <span className="delivery-distance-badge">{remainingDistance.toFixed(1)} km left</span>
          </div>

          <div className="delivery-progress-list" aria-label="Delivery progress">
            {DELIVERY_STEPS.map((step, index) => (
              <div className={`delivery-progress-step ${index <= currentStep ? "is-complete" : ""} ${index === currentStep ? "is-current" : ""}`} key={step}>
                <span className="delivery-progress-node">{index < currentStep ? <Check className="h-3 w-3" /> : index + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <LocationCard
              icon={<MapPin className="h-4 w-4" />}
              accent="pickup"
              label="PICKUP LOCATION"
              name={pickupName}
              address={pickupAddress}
              phone={pickupPhone}
              onCall={() => setSelectedContact({ name: pickupName, phone: pickupPhone, label: "Pickup contact" })}
            />
            <LocationCard
              icon={<PackageCheck className="h-4 w-4" />}
              accent="dropoff"
              label="DROP-OFF LOCATION"
              name={dropoffName}
              address={dropoffAddress}
              phone={dropoffPhone}
              onCall={() => setSelectedContact({ name: dropoffName, phone: dropoffPhone, label: "Drop-off contact" })}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            {phase === "accepted" && (
              <button type="button" onClick={startRide} disabled={isMoving} className="delivery-primary-button">
                <Play className="h-4 w-4" /> Start / Simulate Ride
              </button>
            )}
            {phase === "heading_to_pickup" && !pickupReady && (
              <button type="button" onClick={() => isMoving ? setIsMoving(false) : startRide()} className="delivery-primary-button">
                {isMoving ? <><Pause className="h-4 w-4" /> Pause Ride</> : <><RotateCcw className="h-4 w-4" /> Resume Ride</>}
              </button>
            )}
            {pickupReady && (
              <button type="button" onClick={() => runAction("collect", "picked_up")} disabled={isUpdating} className="delivery-primary-button">
                <PackageCheck className="h-4 w-4" /> {isUpdating ? "Updating..." : "Mark Picked Up"}
              </button>
            )}
            {phase === "picked_up" && (
              <button type="button" onClick={startRide} disabled={isMoving} className="delivery-primary-button">
                <Play className="h-4 w-4" /> Start Delivery Ride
              </button>
            )}
            {phase === "out_for_delivery" && !deliveryReady && (
              <button type="button" onClick={() => isMoving ? setIsMoving(false) : startRide()} className="delivery-primary-button">
                {isMoving ? <><Pause className="h-4 w-4" /> Pause Ride</> : <><RotateCcw className="h-4 w-4" /> Resume Delivery</>}
              </button>
            )}
            {deliveryReady && (
              <button type="button" onClick={() => runAction("distribute", "delivered")} disabled={isUpdating} className="delivery-primary-button">
                <Check className="h-4 w-4" /> {isUpdating ? "Completing..." : "Complete Delivery"}
              </button>
            )}
            {phase === "delivered" && (
              <div className="delivery-complete-message"><Check className="h-4 w-4" /> Delivery completed</div>
            )}
          </div>
        </aside>
      </div>
      {selectedContact && (
        <div className="delivery-contact-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedContact(null);
        }}>
          <section className="delivery-contact-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-contact-title">
            <button type="button" className="delivery-contact-close" onClick={() => setSelectedContact(null)} aria-label="Close contact details">
              <X className="h-4 w-4" />
            </button>
            <div className="delivery-contact-modal-icon"><Phone className="h-5 w-5" /></div>
            <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-400">{selectedContact.label}</p>
            <h2 id="delivery-contact-title" className="mt-1 text-lg font-extrabold text-white">{selectedContact.name}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-300">{selectedContact.phone}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a className="delivery-primary-button" href={`tel:${selectedContact.phone.replace(/[^\d+]/g, "")}`}>
                <Phone className="h-4 w-4" /> Call Now
              </a>
              <button type="button" className="delivery-secondary-button" onClick={copyPhoneNumber}>
                {copiedPhone === selectedContact.phone ? <Check className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
                {copiedPhone === selectedContact.phone ? "Copied" : "Copy Number"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function LocationCard({ icon, accent, label, name, address, phone, onCall }) {
  return (
    <div className={`delivery-location-card delivery-location-card--${accent}`}>
      <div className="delivery-location-icon">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-extrabold tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-xs font-bold text-slate-200">{name}</p>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{address}</p>
      </div>
      <button className="delivery-call-button" type="button" onClick={onCall} aria-label={`Contact ${name} at ${phone}`}>
        <Phone className="h-3.5 w-3.5" />
        <span>Call</span>
      </button>
    </div>
  );
}
