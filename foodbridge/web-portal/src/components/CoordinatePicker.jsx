import React, { useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";
import { LocateFixed, MapPin, X } from "lucide-react";
import { Button } from "./ui/Button";
import { MAP_TILE_URL } from "../services/maps";
import "leaflet/dist/leaflet.css";

const selectionIcon = divIcon({
  className: "delivery-map-pin",
  html: '<span class="delivery-map-pin__dot delivery-map-pin__dropoff"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function LocationClickHandler({ onChoose }) {
  useMapEvents({
    click(event) {
      onChoose({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function LocatePickerUser({ onError }) {
  const map = useMap();
  const locate = () => {
    if (!navigator.geolocation) {
      onError("Device location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => map.setView([coords.latitude, coords.longitude], 16, { animate: true }),
      (error) => onError(error.message || "Could not read device location."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
  React.useEffect(() => {
    locate();
  }, []);
  return (
    <button className="location-picker-recenter" type="button" onClick={locate}>
      <LocateFixed className="w-4 h-4" /> Recenter on Me
    </button>
  );
}

export function CoordinatePicker({ label, initialPosition, onSelect, onClose }) {
  const [selected, setSelected] = useState(initialPosition || null);
  const [locationError, setLocationError] = useState("");
  const center = initialPosition
    ? [initialPosition.latitude, initialPosition.longitude]
    : [0, 0];

  return (
    <div className="location-picker-shell" role="dialog" aria-modal="true" aria-label={`Choose ${label} point`}>
      <header className="location-picker-header">
        <div>
          <strong>Choose {label} on the map</strong>
          <span>{locationError || "Zoom in and click the exact point. The address label will be filled in when geocoding is available."}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close location picker"><X className="w-5 h-5" /></button>
      </header>
      <MapContainer center={center} zoom={initialPosition ? 14 : 2} className="location-picker-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={MAP_TILE_URL}
        />
        <LocationClickHandler onChoose={setSelected} />
        {!initialPosition && <LocatePickerUser onError={setLocationError} />}
        {selected && <Marker position={[selected.latitude, selected.longitude]} icon={selectionIcon} />}
      </MapContainer>
      <footer className="location-picker-footer">
        <span>{selected ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : "Click the map to place a pin"}</span>
        <div>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!selected} onClick={() => onSelect(selected)}>
            <MapPin className="w-4 h-4" /> Use this point
          </Button>
        </div>
      </footer>
    </div>
  );
}
