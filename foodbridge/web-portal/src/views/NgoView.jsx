import React, { useState } from "react";
import { Building2, CheckCircle2, PackageCheck, Utensils, ShieldCheck, LocateFixed, MapPin, X, Truck, BellRing } from "lucide-react";
import { ListingCard } from "../components/ListingCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/FormField";
import { CoordinatePicker } from "../components/CoordinatePicker";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { reverseGeocode } from "../services/maps";
import { notifyVolunteersForListing } from "../services/api";

export function NgoView({ listings, onAction }) {
  const { currentUser, activeRole, setActiveRole, openAuthModal, login } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("available"); // "available" | "incoming" | "distributed"
  const [acceptingListing, setAcceptingListing] = useState(null);
  const [modalStep, setModalStep] = useState("location"); // "location" | "dispatch"
  const [claimAfterSave, setClaimAfterSave] = useState(false);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLatitude, setDropoffLatitude] = useState("");
  const [dropoffLongitude, setDropoffLongitude] = useState("");
  const [showDropoffPicker, setShowDropoffPicker] = useState(false);
  const [savingDropoff, setSavingDropoff] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [waitingIds, setWaitingIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fb_waiting_volunteers") || "[]");
    } catch (_e) {
      return [];
    }
  });

  const isNgo = activeRole === "ngo";

  const availableBatches = listings.filter((l) => l.status === "available");
  const incomingBatches = listings.filter((l) => ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff", "delivered"].includes(l.status));
  const distributedBatches = listings.filter((l) => l.status === "distributed");
  const deliveredBatches = listings.filter((l) => ["delivered", "distributed"].includes(l.status));

  const totalDeliveredMeals = deliveredBatches.reduce((sum, l) => sum + (Number(l.meals) || 0), 0);

  const openNgoAcceptModal = (listing, shouldClaimDirectly = false) => {
    if (!currentUser || currentUser.role !== "ngo") {
      toast.info("Please sign in as an NGO to accept this order and set your drop-off location.");
      openAuthModal({ role: "ngo", tab: "quick" });
      return;
    }
    setAcceptingListing(listing);
    setClaimAfterSave(shouldClaimDirectly);
    setModalStep("location");
    setDropoffAddress(listing.dropoff_address || currentUser.org || "Hope Community Shelter");
    setDropoffLatitude(listing.dropoff_latitude != null ? String(listing.dropoff_latitude) : "12.979600");
    setDropoffLongitude(listing.dropoff_longitude != null ? String(listing.dropoff_longitude) : "77.604000");
  };

  const switchToVolunteerAndClaim = (listing) => {
    setAcceptingListing(null);
    openAuthModal({
      role: "volunteer",
      tab: "quick",
      message: "Log in as a Delivery Partner to claim this order and open Track Live Map.",
      onLoginSuccess: async () => {
        await onAction(listing.id, "claim");
      },
    });
  };

  const handleClaimAsVolunteerFromNgo = async (listing) => {
    const hasCoords = listing.dropoff_latitude != null && listing.dropoff_longitude != null && Boolean(listing.dropoff_address || listing.dropoffAddress);
    if (!hasCoords) {
      openNgoAcceptModal(listing, true);
      toast.info("Set your NGO drop-off location first, then you'll be redirected to Volunteer Track Live Map.");
      return;
    }
    await switchToVolunteerAndClaim(listing);
  };

  const handleLookingForVolunteer = async () => {
    if (!acceptingListing) return;
    setDispatching(true);
    try {
      const alert = await notifyVolunteersForListing(acceptingListing, currentUser);
      setWaitingIds((prev) => {
        const next = Array.from(new Set([...prev, acceptingListing.id]));
        try {
          localStorage.setItem("fb_waiting_volunteers", JSON.stringify(next));
        } catch (_e) {}
        return next;
      });
      toast.success(
        `All nearby delivery partners notified! Waiting for a delivery agent to accept (${alert.meals} servings · ${alert.pickupAddress} → ${alert.dropoffAddress}).`
      );
      setAcceptingListing(null);
    } catch (err) {
      toast.error(err?.message || "Could not notify volunteers.");
    } finally {
      setDispatching(false);
    }
  };

  const useCurrentDropoffLocation = () => {
    if (!navigator.geolocation) {
      toast.error("This browser does not support device location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDropoffLatitude(coords.latitude.toFixed(6));
        setDropoffLongitude(coords.longitude.toFixed(6));
        reverseGeocode(coords.latitude, coords.longitude)
          .then((addr) => {
            setDropoffAddress(addr);
            toast.success("Current NGO drop-off location added.");
          })
          .catch(() => {
            if (!dropoffAddress.trim()) {
              setDropoffAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
            }
            toast.info("Coordinates added for drop-off.");
          });
      },
      (err) => toast.error(err.message || "Could not read device location."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSaveDropoffPin = (coords) => {
    setDropoffLatitude(coords.latitude.toFixed(6));
    setDropoffLongitude(coords.longitude.toFixed(6));
    setShowDropoffPicker(false);
    reverseGeocode(coords.latitude, coords.longitude)
      .then((addr) => {
        setDropoffAddress(addr);
        toast.success("Drop-off address updated from map pin.");
      })
      .catch(() => {
        if (!dropoffAddress.trim()) {
          setDropoffAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        }
        toast.info("Drop-off pin saved.");
      });
  };

  const handleSubmitNgoAccept = async (e) => {
    e.preventDefault();
    if (!acceptingListing) return;
    const lat = Number(dropoffLatitude);
    const lng = Number(dropoffLongitude);
    if (!dropoffAddress.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Please enter a drop-off address and pin its location on the map.");
      return;
    }
    setSavingDropoff(true);
    try {
      const updated = await onAction(acceptingListing.id, "accept_ngo", {
        dropoffAddress: dropoffAddress.trim(),
        dropoffLatitude: lat,
        dropoffLongitude: lng,
      });
      const updatedListing = updated || {
        ...acceptingListing,
        dropoff_address: dropoffAddress.trim(),
        dropoffAddress: dropoffAddress.trim(),
        dropoff_latitude: lat,
        dropoff_longitude: lng,
        ngo_org: currentUser?.org || currentUser?.name,
      };
      setAcceptingListing(updatedListing);
      if (claimAfterSave) {
        switchToVolunteerAndClaim(updatedListing);
      } else {
        setModalStep("dispatch");
      }
    } catch (err) {
      toast.error(err?.message || "Could not save drop-off location.");
    } finally {
      setSavingDropoff(false);
    }
  };

  const activeList =
    tab === "available"
      ? availableBatches
      : tab === "incoming"
      ? incomingBatches
      : distributedBatches;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-['Quicksand'] bg-purple-100 text-purple-800">
              Community Shelter &bull; NGO Hub
            </span>
          </div>
          <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-extrabold text-[var(--color-forest-text)]">
            Food Distribution &amp; Receipt Ledger
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1">
            Accept available orders to set your drop-off location, then either claim as a Volunteer or notify all Volunteers.
          </p>
        </div>

        {!isNgo && (
          <Button
            size="sm"
            variant="mango"
            onClick={() => setActiveRole("ngo")}
            className="self-start sm:self-auto font-bold"
          >
            Switch to NGO Mode
          </Button>
        )}
      </div>

      {/* Shelter Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-[var(--color-bg-surface)] border-[var(--color-border)]">
          <div className="flex items-center justify-between text-xs font-bold font-['Quicksand'] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            <span>Available to Accept</span>
            <MapPin className="w-4 h-4 text-[var(--color-tomato-orange)]" />
          </div>
          <div className="font-['Fraunces'] text-3xl font-bold text-[var(--color-tomato-orange)]">
            {availableBatches.length}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Donations ready for NGO drop-off assignment
          </p>
        </Card>

        <Card className="p-4 bg-[var(--color-bg-surface)] border-[var(--color-border)]">
          <div className="flex items-center justify-between text-xs font-bold font-['Quicksand'] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            <span>Incoming for Delivery</span>
            <PackageCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="font-['Fraunces'] text-3xl font-bold text-purple-700">
            {incomingBatches.length}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Couriers currently en route to your kitchen dock
          </p>
        </Card>

        <Card className="p-4 bg-[var(--color-bg-surface)] border-[var(--color-border)]">
          <div className="flex items-center justify-between text-xs font-bold font-['Quicksand'] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
            <span>Total Meals Delivered</span>
            <Utensils className="w-4 h-4 text-[var(--color-leaf-green)]" />
          </div>
          <div className="font-['Fraunces'] text-3xl font-bold text-[var(--color-leaf-green)]">
            {totalDeliveredMeals.toLocaleString()}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Verified portions delivered ({deliveredBatches.length} orders)
          </p>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="inline-flex flex-wrap p-1 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs font-bold font-['Quicksand']">
        <button
          onClick={() => setTab("available")}
          className={`px-4 py-2 rounded-[var(--radius-sm)] transition-all flex items-center gap-1.5 ${
            tab === "available"
              ? "bg-[var(--color-leaf-green)] text-white shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-forest-text)]"
          }`}
        >
          <span>Available Donations ({availableBatches.length})</span>
        </button>
        <button
          onClick={() => setTab("incoming")}
          className={`px-4 py-2 rounded-[var(--radius-sm)] transition-all flex items-center gap-1.5 ${
            tab === "incoming"
              ? "bg-[var(--color-leaf-green)] text-white shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-forest-text)]"
          }`}
        >
          <span>Incoming Deliveries ({incomingBatches.length})</span>
        </button>
        <button
          onClick={() => setTab("distributed")}
          className={`px-4 py-2 rounded-[var(--radius-sm)] transition-all flex items-center gap-1.5 ${
            tab === "distributed"
              ? "bg-[var(--color-leaf-green)] text-white shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-forest-text)]"
          }`}
        >
          <span>Verified History ({distributedBatches.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeList.length === 0 ? (
        <EmptyState
          icon={tab === "distributed" ? CheckCircle2 : Building2}
          title={
            tab === "available"
              ? "No open donations waiting for NGO acceptance"
              : tab === "incoming"
              ? "No incoming food batches awaiting confirmation"
              : "No completed distributions yet"
          }
          message={
            tab === "available"
              ? "When donors publish surplus food with a pickup location, it will appear here so you can accept it and set your drop-off location."
              : tab === "incoming"
              ? "Your accepted donations and volunteer courier progress will appear here."
              : "When you confirm received food batches, they will be archived here."
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeList.map((item) => (
            <ListingCard
              key={item.id}
              listing={item}
              activeRole="ngo"
              currentUser={currentUser}
              onAction={onAction}
              onNgoAccept={(l) => openNgoAcceptModal(l, false)}
              onNgoClaimAsVolunteer={handleClaimAsVolunteerFromNgo}
              isWaitingForVolunteer={waitingIds.includes(item.id)}
            />
          ))}
        </div>
      )}

      {/* NGO Accept & Drop-off Location -> Volunteer Choice Modal */}
      {acceptingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-label="NGO Order Acceptance">
          <Card className="w-full max-w-lg bg-[var(--color-bg-surface)] border-[var(--color-border)] p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-leaf-green)]">
                  {modalStep === "location"
                    ? "Step 1 · Claim Order & Enter Drop-off Location"
                    : "Step 2 · Volunteer Availability"}
                </span>
                <h2 className="font-['Fraunces'] text-xl font-bold text-[var(--color-forest-text)] mt-0.5">
                  {acceptingListing.title}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Qty: <strong>{acceptingListing.meals} servings</strong> &bull; Pickup: {acceptingListing.pickup_address || acceptingListing.pickupAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAcceptingListing(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-full hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalStep === "location" ? (
              <form onSubmit={handleSubmitNgoAccept} className="space-y-4">
                <Input
                  label="NGO Drop-off Address"
                  placeholder="e.g., Hope Community Shelter, North Gate"
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  required
                />

                <div className="location-confirmation">
                  <span>
                    <strong>Drop-off map pin</strong>
                    {dropoffLatitude && dropoffLongitude
                      ? `${Number(dropoffLatitude).toFixed(4)}, ${Number(dropoffLongitude).toFixed(4)}`
                      : "Not set"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={useCurrentDropoffLocation}>
                      <LocateFixed className="w-3.5 h-3.5" /> Use My Current Location
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowDropoffPicker(true)}>
                      Choose Drop-off on Map
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setAcceptingListing(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={savingDropoff}>
                    <ShieldCheck className="w-4 h-4" /> Save Drop-off Location
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs space-y-1 text-[var(--color-forest-text)]">
                  <div><strong>Order:</strong> {acceptingListing.title} ({acceptingListing.meals} servings)</div>
                  <div><strong>Pickup:</strong> {acceptingListing.pickup_address || acceptingListing.pickupAddress}</div>
                  <div><strong>Drop-off:</strong> {acceptingListing.dropoff_address || dropoffAddress}</div>
                  {acceptingListing.notes && <div><strong>Notes:</strong> {acceptingListing.notes}</div>}
                </div>

                <p className="text-sm font-bold text-[var(--color-forest-text)]">
                  Do you have a volunteer to deliver this food, or are you looking for a volunteer?
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  If you have a volunteer, proceed to the Delivery Partner login page to claim &amp; track the live map. Otherwise, notify all nearby volunteers and wait for acceptance.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="mango"
                    className="w-full font-bold"
                    loading={dispatching}
                    onClick={() => switchToVolunteerAndClaim(acceptingListing)}
                  >
                    <Truck className="w-4 h-4" />
                    <span>Have Volunteer · Login</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full font-bold"
                    loading={dispatching}
                    onClick={handleLookingForVolunteer}
                  >
                    <BellRing className="w-4 h-4" />
                    <span>Looking for Volunteer</span>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {showDropoffPicker && (
        <CoordinatePicker
          label="drop-off"
          initialPosition={
            dropoffLatitude && dropoffLongitude
              ? { latitude: Number(dropoffLatitude), longitude: Number(dropoffLongitude) }
              : acceptingListing?.pickup_latitude && acceptingListing?.pickup_longitude
              ? { latitude: Number(acceptingListing.pickup_latitude), longitude: Number(acceptingListing.pickup_longitude) }
              : null
          }
          onSelect={handleSaveDropoffPin}
          onClose={() => setShowDropoffPicker(false)}
        />
      )}
    </div>
  );
}
