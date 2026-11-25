import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchListings,
  createListing as apiCreateListing,
  acceptNgoListing as apiAcceptNgoListing,
  claimListing as apiClaimListing,
  collectListing as apiCollectListing,
  markArrivedAtPickup as apiMarkArrivedAtPickup,
  markArrivedAtDropoff as apiMarkArrivedAtDropoff,
  startDelivery as apiStartDelivery,
  distributeListing as apiDistributeListing,
  markListingDelivered as apiMarkListingDelivered,
  cancelListing as apiCancelListing,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { useNotifications } from "../context/NotificationContext";

const statusLabels = {
  accepted: "Accepted",
  arrived_at_pickup: "Arrived at Pickup",
  picked_up: "Pickup Successful",
  out_for_delivery: "Out for Delivery",
  arrived_at_dropoff: "At Delivery Location",
  delivered: "Delivered",
  distributed: "Received by NGO",
};

export function useListings(pollIntervalMs = 20000) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const toast = useToast();
  const { addNotification } = useNotifications();
  const previousListingsRef = useRef(null);
  const previousUserIdRef = useRef(currentUser?.id ?? null);

  const loadListings = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await fetchListings();
      if (Array.isArray(data)) {
        const userId = currentUser?.id;
        if (String(previousUserIdRef.current) !== String(userId ?? null)) {
          previousListingsRef.current = null;
          previousUserIdRef.current = userId ?? null;
        }
        const previousById = new Map((previousListingsRef.current || []).map((item) => [String(item.id), item]));
        if (userId != null) {
          data.forEach((listing) => {
            const previous = previousById.get(String(listing.id));
            const label = statusLabels[listing.status];
            const participants = [
              listing.donor_id,
              listing.volunteer_id,
              listing.ngo_id,
              listing.donor?.id,
              listing.volunteer?.id,
              listing.ngo?.id,
            ];
            if (
              previous
              && previous.status !== listing.status
              && label
              && participants.some((id) => id != null && Number(id) === Number(userId))
            ) {
              const message = `${listing.title || "A rescue order"} is now ${label}.`;
              addNotification({
                id: `delivery-${listing.id}-${listing.status}`,
                listingId: listing.id,
                status: listing.status,
                title: `${label} update`,
                message,
              });
            }
          });
        }
        previousListingsRef.current = data;
        setListings(data);
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Failed to load listings");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [addNotification, currentUser?.id]);

  // Initial load and visibility-aware periodic polling
  useEffect(() => {
    loadListings();
    if (pollIntervalMs <= 0) return;

    let interval = null;

    function startPolling() {
      if (!interval) {
        interval = setInterval(() => {
          if (!document.hidden) {
            loadListings(true);
          }
        }, pollIntervalMs);
      }
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        loadListings(true);
        startPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadListings, pollIntervalMs]);

  // Actions
  const addListing = async (formData) => {
    try {
      const created = await apiCreateListing(formData, currentUser);
      toast.success(`Success! Listed ${created.meals || formData.meals} meals for rescue.`);
      await loadListings(true);
      return created;
    } catch (err) {
      toast.error(err.message || "Failed to create listing.");
      throw err;
    }
  };

  const claim = async (id) => {
    try {
      const updated = await apiClaimListing(id, currentUser);
      toast.success("Order accepted. Opening live tracking map.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not claim listing.");
      throw err;
    }
  };

  const acceptNgo = async (id, dropoffData) => {
    try {
      const updated = await apiAcceptNgoListing(id, dropoffData, currentUser);
      toast.success("Donation accepted! Drop-off location updated for delivery partners.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not accept donation.");
      throw err;
    }
  };

  const collect = async (id) => {
    try {
      const updated = await apiCollectListing(id, currentUser);
      toast.success("Pickup confirmed.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not mark collected.");
      throw err;
    }
  };

  const arrive = async (id) => {
    try {
      const updated = await apiMarkArrivedAtPickup(id, currentUser);
      toast.success("Arrival at pickup confirmed.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not confirm arrival.");
      throw err;
    }
  };

  const arriveDropoff = async (id) => {
    try {
      const updated = await apiMarkArrivedAtDropoff(id, currentUser);
      toast.success("Arrival at drop-off confirmed.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not confirm arrival at drop-off.");
      throw err;
    }
  };

  const startDelivery = async (id) => {
    try {
      const updated = await apiStartDelivery(id, currentUser);
      toast.success("Delivery started. The recipient can now track the route.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not start delivery.");
      throw err;
    }
  };

  const distribute = async (id) => {
    try {
      const updated = await apiDistributeListing(id, currentUser);
      toast.success("Distribution confirmed! Impact metrics updated.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not confirm distribution.");
      throw err;
    }
  };

  const deliver = async (id) => {
    try {
      const updated = await apiMarkListingDelivered(id, currentUser);
      toast.success("Delivery confirmed. The order is marked delivered.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not mark this delivery complete.");
      throw err;
    }
  };

  const cancel = async (id) => {
    try {
      const updated = await apiCancelListing(id, currentUser);
      toast.success("Listing cancelled successfully.");
      await loadListings(true);
      return updated;
    } catch (err) {
      toast.error(err.message || "Could not cancel listing.");
      throw err;
    }
  };

  // Filtered views
  const now = Date.now();
  const availableListings = listings.filter((l) => {
    const isAvailable = l.status === "available";
    const expiry = l.expires_at || l.safe_until;
    const notExpired = !expiry || new Date(expiry).getTime() > now;
    return isAvailable && notExpired;
  });

  const claimedListings = listings.filter((l) => ["accepted", "arrived_at_pickup"].includes(l.status));
  const collectedListings = listings.filter((l) => ["picked_up", "out_for_delivery", "arrived_at_dropoff"].includes(l.status));
  const distributedListings = listings.filter((l) => l.status === "distributed");
  const cancelledListings = listings.filter((l) => l.status === "cancelled");
  const expiredListings = listings.filter((l) => l.status === "expired");

  const totalDivertedMeals = listings
    .filter((l) => ["picked_up", "out_for_delivery", "delivered", "distributed"].includes(l.status))
    .reduce((sum, l) => sum + (Number(l.meals) || 0), 0);

  const refresh = useCallback(() => loadListings(false), [loadListings]);

  return {
    listings,
    loading,
    error,
    refresh,
    addListing,
    acceptNgo,
    claim,
    collect,
    arrive,
    arriveDropoff,
    startDelivery,
    distribute,
    deliver,
    cancel,
    availableListings,
    claimedListings,
    collectedListings,
    distributedListings,
    cancelledListings,
    expiredListings,
    totalDivertedMeals,
  };
}
