import React, { useState } from "react";
import { PlusCircle, Sparkles, CheckCircle2, LocateFixed, Building2 } from "lucide-react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input, Textarea } from "./ui/FormField";
import { useToast } from "./ui/Toast";
import { parseCoordinatePair } from "../utils/geo";
import { CoordinatePicker } from "./CoordinatePicker";
import { geocodeAddress, reverseGeocode } from "../services/maps";

export function DonorForm({ onPostListing, currentUser }) {
  const [title, setTitle] = useState("");
  const [meals, setMeals] = useState(30);
  const [expiresInMinutes, setExpiresInMinutes] = useState(120);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLatitude, setPickupLatitude] = useState("");
  const [pickupLongitude, setPickupLongitude] = useState("");
  const [locationBias, setLocationBias] = useState(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const expiryPresets = [
    { label: "45 Mins (Urgent)", val: 45 },
    { label: "1.5 Hours", val: 90 },
    { label: "2 Hours (Standard)", val: 120 },
    { label: "4 Hours", val: 240 },
    { label: "8 Hours", val: 480 },
  ];

  const fillSample = () => {
    setTitle("75 Portions Fresh Veg Biryani & Curry");
    setMeals(75);
    setExpiresInMinutes(90);
    setPickupAddress("Campus Student Center, Gate 2 Loading Bay");
    setPickupLatitude("12.971600");
    setPickupLongitude("77.594600");
    setNotes("100% Pure Vegetarian. Packed in sanitized thermal boxes. Hot and ready for dispatch.");
    toast.info("Auto-filled sample donor pickup details.");
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("This browser does not support device location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { latitude: coords.latitude, longitude: coords.longitude };
        setLocationBias(coordinates);
        setPickupLatitude(coords.latitude.toFixed(6));
        setPickupLongitude(coords.longitude.toFixed(6));
        reverseGeocode(coords.latitude, coords.longitude)
          .then((address) => {
            setPickupAddress(address);
            toast.success("Current pickup location added.");
          })
          .catch((error) => {
            if (!pickupAddress.trim()) {
              setPickupAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
            }
            toast.info(`Pickup coordinates added. ${error.message}`);
          });
      },
      (error) => toast.error(error.message || "Could not read device location."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const savePickedLocation = (coordinates) => {
    setPickupLatitude(coordinates.latitude.toFixed(6));
    setPickupLongitude(coordinates.longitude.toFixed(6));
    setLocationPickerOpen(false);
    reverseGeocode(coordinates.latitude, coordinates.longitude)
      .then((address) => {
        setPickupAddress(address);
        toast.success("Pickup address updated from the map pin.");
      })
      .catch((error) => {
        if (!pickupAddress.trim()) {
          setPickupAddress(`${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`);
        }
        toast.info(`Pickup map pin saved. ${error.message}`);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a surplus food description.");
      return;
    }
    const mealCount = Number(meals);
    if (!Number.isInteger(mealCount) || mealCount < 1) {
      toast.error("Number of meals must be a positive integer.");
      return;
    }
    if (!pickupAddress.trim()) {
      toast.error("Please specify a pickup location address.");
      return;
    }

    const pickupPair = parseCoordinatePair(pickupAddress);
    if (Boolean(pickupLatitude) !== Boolean(pickupLongitude)) {
      toast.error("Enter both latitude and longitude for pickup, or choose a point on the map.");
      return;
    }

    const needsAddressLookup = (!pickupLatitude || !pickupLongitude) && !pickupPair;
    let bias = locationBias;
    if (needsAddressLookup && !bias && navigator.geolocation) {
      bias = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      });
      if (bias) setLocationBias(bias);
    }
    if (needsAddressLookup && !bias) {
      toast.error("Pin your pickup location on the map or allow device location.");
      return;
    }

    let resolvedPickup = { latitude: pickupLatitude, longitude: pickupLongitude };
    try {
      if ((!resolvedPickup.latitude || !resolvedPickup.longitude) && !pickupPair) {
        const result = (await geocodeAddress(pickupAddress, bias))[0];
        if (result) resolvedPickup = { latitude: result.latitude, longitude: result.longitude };
      }
    } catch (error) {
      toast.error(error.message || "Could not locate the entered pickup address.");
      return;
    }

    const lat = resolvedPickup.latitude === "" ? pickupPair?.latitude : Number(resolvedPickup.latitude);
    const lng = resolvedPickup.longitude === "" ? pickupPair?.longitude : Number(resolvedPickup.longitude);
    if (lat == null || lng == null || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      toast.error("Pin your pickup location on the map before publishing.");
      return;
    }

    const safeUntilDate = new Date(Date.now() + Number(expiresInMinutes) * 60000);

    setIsSubmitting(true);
    try {
      await onPostListing({
        title: title.trim(),
        meals: mealCount,
        expiresInMinutes: Number(expiresInMinutes),
        safe_until: safeUntilDate.toISOString(),
        pickup_address: pickupAddress.trim(),
        pickupAddress: pickupAddress.trim(),
        pickupLatitude: lat,
        pickupLongitude: lng,
        notes: notes.trim(),
        donor_name: currentUser?.name || "Campus Dining Hall",
        donor_org: currentUser?.org || "Campus Canteen",
      });

      setTitle("");
      setMeals(30);
      setPickupAddress("");
      setPickupLatitude("");
      setPickupLongitude("");
      setNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-[var(--color-bg-surface)] border-[var(--color-border)]">
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)]">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-['Fraunces'] text-lg font-bold text-[var(--color-forest-text)]">
              Post Surplus Food Listing
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Set your pickup location; accepting NGOs set the drop-off location.
            </p>
          </div>
        </div>

        <Button size="sm" variant="secondary" onClick={fillSample} title="Fill demo data">
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-mustard-dark)]" />
          <span>Demo Data</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Food Item Description"
          placeholder="e.g., 50 Servings Fresh Vegetarian Pasta & Salad Trays"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Estimated Portions / Meals"
            type="number"
            min="1"
            value={meals}
            onChange={(e) => setMeals(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold font-['Quicksand'] text-[var(--color-forest-text)] uppercase tracking-wider mb-1.5">
              Safe Window Preset
            </label>
            <div className="flex flex-wrap gap-1.5">
              {expiryPresets.map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setExpiresInMinutes(preset.val)}
                  className={`px-2.5 py-1.5 text-xs font-bold font-['Quicksand'] rounded-[var(--radius-sm)] border transition-all ${
                    expiresInMinutes === preset.val
                      ? "bg-[var(--color-leaf-green)] text-white border-[var(--color-leaf-green)] shadow-xs"
                      : "bg-[var(--color-bg-subtle)] text-[var(--color-forest-text)] border-[var(--color-border)] hover:bg-[#ebded0]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Input
          label="Pickup Address / Dock Location"
          placeholder="e.g., Dining Hall Gate 3, West Kitchen Loading Dock"
          value={pickupAddress}
          onChange={(e) => setPickupAddress(e.target.value)}
          required
        />

        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/60 p-3">
          <p className="text-xs font-bold text-[var(--color-forest-text)]">Confirm Donor Pickup Map Pin (required)</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Pin the exact pickup spot using GPS or the interactive map. Once posted, any NGO can accept this donation and set their drop-off pin.
          </p>
          <div className="location-confirmation">
            <span>
              <strong>Pickup pin</strong>
              {pickupLatitude && pickupLongitude ? `${Number(pickupLatitude).toFixed(4)}, ${Number(pickupLongitude).toFixed(4)}` : "Not set"}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={useCurrentLocation}>
                <LocateFixed className="w-3.5 h-3.5" /> Use My Current Location
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setLocationPickerOpen(true)}>
                Choose on map
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/40 px-3 py-2.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Building2 className="w-4 h-4 text-[var(--color-leaf-green)] shrink-0" />
          <span>Drop-off location will be updated automatically once an NGO accepts this donation on the NGO Hub.</span>
        </div>

        <Textarea
          label="Food Safety & Packaging Notes"
          placeholder="e.g., Allergen info, thermal container requirements, contact phone"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)] font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--color-leaf-green)]" />
            <span>Pickup pin saved with donation</span>
          </span>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Publish Surplus Listing
          </Button>
        </div>
      </form>
      {locationPickerOpen && (
        <CoordinatePicker
          label="pickup"
          initialPosition={pickupLatitude && pickupLongitude
            ? { latitude: Number(pickupLatitude), longitude: Number(pickupLongitude) }
            : null}
          onSelect={savePickedLocation}
          onClose={() => setLocationPickerOpen(false)}
        />
      )}
    </Card>
  );
}
