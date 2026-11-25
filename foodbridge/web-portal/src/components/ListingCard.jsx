import React, { useState } from "react";
import { MapPin, Clock, Truck, Building2, Utensils, CheckCircle2, User } from "lucide-react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { ExpiryBadge } from "./ui/ExpiryBadge";
import { DeliveryTimeline } from "./DeliveryTimeline";
import { ListingContacts } from "./ListingContacts";

export function ListingCard({ listing, activeRole, currentUser, onAction, onNgoAccept, onNgoClaimAsVolunteer, onOpenMap, isWaitingForVolunteer = false }) {
  const [loading, setLoading] = useState(false);

  const expiresAt = listing.expires_at || listing.safe_until;
  const isAvailable = listing.status === "available";
  const isClaimed = ["accepted", "arrived_at_pickup"].includes(listing.status);
  const isDistributed = listing.status === "distributed";
  const hasPickupCoords = listing.pickup_latitude != null && listing.pickup_longitude != null;
  const hasDropoffCoords = listing.dropoff_latitude != null && listing.dropoff_longitude != null;
  const hasNgoDropoff = Boolean((listing.dropoff_address || listing.dropoffAddress) && hasDropoffCoords);

  const handleActionClick = async (actionType) => {
    setLoading(true);
    try {
      await onAction(listing.id, actionType);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (listing.status) {
      case "available":
        return <Badge variant="leaf">Available</Badge>;
      case "accepted":
        return <Badge variant="warning">Order Accepted &bull; En Route</Badge>;
      case "arrived_at_pickup":
        return <Badge variant="warning">Arrived at Pickup</Badge>;
      case "picked_up":
        return <Badge variant="mango">Picked Up</Badge>;
      case "out_for_delivery":
        return <Badge variant="mango">Out for Delivery</Badge>;
      case "arrived_at_dropoff":
        return <Badge variant="warning">At Delivery Location</Badge>;
      case "delivered":
        return <Badge variant="success">Delivered</Badge>;
      case "distributed":
        return <Badge variant="success">Distributed &bull; Delivered</Badge>;
      case "cancelled":
        return <Badge variant="neutral">Cancelled</Badge>;
      case "expired":
        return <Badge variant="danger">Expired</Badge>;
      default:
        return <Badge variant="neutral">{listing.status}</Badge>;
    }
  };

  return (
    <Card hoverable className="food-listing-card flex flex-col justify-between border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <div>
        {/* Card Header: Title & Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-['Fraunces'] text-base font-bold text-[var(--color-forest-text)] leading-snug">
            {listing.title}
          </h3>
          {getStatusBadge()}
        </div>

        {/* Portion size & Expiry countdown */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] text-xs font-bold font-['Quicksand'] text-[var(--color-forest-text)] border border-[var(--color-border)]">
            <Utensils className="w-3.5 h-3.5 text-[var(--color-leaf-green)]" />
            <span>{listing.meals} Verified Servings</span>
          </span>

          {isAvailable && expiresAt && <ExpiryBadge expiresAt={expiresAt} />}
          {expiresAt && (
            <span className="pickup-window">
              <Clock className="w-3.5 h-3.5" />
              Pickup by {new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Pickup & Donor Info */}
        <div className="space-y-1.5 text-xs text-[var(--color-text-muted)] font-['Inter'] mb-3">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-4 h-4 text-[var(--color-tomato-orange)] shrink-0 mt-0.5" />
            <span className="text-[var(--color-forest-text)] font-medium">
              {listing.pickup_address || listing.pickupAddress || "Campus Canteen"}
            </span>
          </div>

          {(listing.dropoff_address || listing.dropoffAddress) && (
            <div className="flex items-start gap-1.5">
              <Building2 className="w-4 h-4 text-[var(--color-leaf-green)] shrink-0 mt-0.5" />
              <span className="text-[var(--color-forest-text)] font-medium">
                Drop-off: {listing.dropoff_address || listing.dropoffAddress}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-[var(--color-leaf-green)] shrink-0" />
            <span>
              Donor: <strong className="text-[var(--color-forest-text)]">{listing.donor_name || listing.donor_org || "Campus Dining"}</strong>
            </span>
          </div>

          {listing.notes && (
            <p className="p-2 rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)]/60 border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] italic">
              &ldquo;{listing.notes}&rdquo;
            </p>
          )}

          {listing.volunteer_name && (
            <div className="text-[11px] text-[var(--color-text-muted)] pt-1 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-[var(--color-leaf-green)]" />
              <span>Courier: <strong>{listing.volunteer_name}</strong></span>
            </div>
          )}

          {listing.ngo_org && (
            <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Recipient: <strong>{listing.ngo_org}</strong></span>
            </div>
          )}
        </div>
      </div>

      {["available", "accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff", "delivered", "distributed"].includes(listing.status) && (
        <DeliveryTimeline listing={listing} compact />
      )}
      <ListingContacts listing={listing} activeRole={activeRole} currentUser={currentUser} />

      {/* Action Footer */}
      <div className="pt-3 border-t border-[var(--color-border)] mt-2">
        {activeRole === "volunteer" && isAvailable && (
          hasPickupCoords && hasNgoDropoff ? (
            <Button
              variant="primary"
              size="sm"
              className="w-full font-bold"
              loading={loading}
              onClick={() => handleActionClick("claim")}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Accept Order</span>
            </Button>
          ) : (
            <div className="space-y-1.5 text-center">
              <div className="py-1.5 px-2.5 text-xs font-semibold text-amber-800 bg-amber-50 rounded-[var(--radius-sm)] border border-amber-200">
                Awaiting NGO to accept &amp; set drop-off location
              </div>
            </div>
          )
        )}

        {activeRole === "volunteer" && ["accepted", "arrived_at_pickup", "picked_up", "out_for_delivery", "arrived_at_dropoff"].includes(listing.status) && (
          <div className="space-y-2">
            {isClaimed && (
              <Button
                variant="mango"
                size="sm"
                className="w-full font-bold"
                loading={loading}
                onClick={() => handleActionClick(listing.status === "accepted" ? "arrive" : "collect")}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{listing.status === "accepted" ? "Confirm Arrival at Pickup" : "Confirm Pickup"}</span>
              </Button>
            )}
            {listing.status === "picked_up" && (
              <Button variant="primary" size="sm" className="w-full font-bold" loading={loading} onClick={() => handleActionClick("start_delivery")}>
                <Truck className="w-3.5 h-3.5" />
                <span>Start Delivery</span>
              </Button>
            )}
            {listing.status === "out_for_delivery" && (
              <Button variant="mango" size="sm" className="w-full font-bold" loading={loading} onClick={() => handleActionClick("arrive_dropoff")}>
                <MapPin className="w-3.5 h-3.5" />
                <span>Arrived at Drop-off</span>
              </Button>
            )}
            {listing.status === "arrived_at_dropoff" && (
              <Button variant="primary" size="sm" className="w-full font-bold" loading={loading} onClick={() => handleActionClick("deliver")}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark as Delivered</span>
              </Button>
            )}
            {onOpenMap && (
              <Button variant="secondary" size="sm" className="w-full font-bold" onClick={() => onOpenMap(listing.id)}>
                <MapPin className="w-3.5 h-3.5" />
                <span>Track Live Map</span>
              </Button>
            )}
          </div>
        )}

        {activeRole === "ngo" && isAvailable && (
          <div className="space-y-2">
            {hasNgoDropoff && listing.ngo_id && (
              <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-bold text-amber-900 bg-amber-50 rounded-[var(--radius-sm)] border border-amber-200 text-center">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  {isWaitingForVolunteer
                    ? "Waiting for delivery agent to accept..."
                    : "Drop-off Set · Ready for delivery partner"}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full font-bold bg-purple-700 hover:bg-purple-800"
                onClick={() => onNgoAccept?.(listing)}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Claim Order</span>
              </Button>
              <Button
                variant="mango"
                size="sm"
                className="w-full font-bold"
                loading={loading}
                onClick={() => onNgoClaimAsVolunteer?.(listing)}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Claim as Volunteer</span>
              </Button>
            </div>
          </div>
        )}

        {activeRole === "ngo" && listing.status === "accepted" && (
          <div className="mb-2 flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded-[var(--radius-sm)] border border-emerald-200">
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Order accepted by {listing.volunteer_name || "delivery partner"}</span>
          </div>
        )}

        {activeRole === "ngo" && listing.status === "delivered" && (
          <Button
            variant="primary"
            size="sm"
            className="w-full font-bold bg-purple-700 hover:bg-purple-800"
            loading={loading}
            onClick={() => handleActionClick("distribute")}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Confirm Receipt</span>
          </Button>
        )}

        {(listing.status === "delivered" || isDistributed) && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 mt-2 text-xs font-bold font-['Quicksand'] text-emerald-800 bg-emerald-50 rounded-[var(--radius-sm)] border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{listing.status === "delivered" ? "Delivered · Delivery done successfully" : "Delivered & Distributed to Community"}</span>
          </div>
        )}

        {/* If user is donor */}
        {activeRole === "donor" && isAvailable && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              Awaiting courier claim
            </span>
            <Button
              variant="outline"
              size="xs"
              loading={loading}
              onClick={() => handleActionClick("cancel")}
              className="text-red-700 border-red-200 hover:bg-red-50 text-[11px] py-1 px-2.5 font-bold"
            >
              Cancel Batch
            </Button>
          </div>
        )}

        {activeRole === "donor" && isClaimed && (
          <div className="text-center text-[11px] font-semibold text-[var(--color-text-muted)] py-1">
            Courier en route to collect
          </div>
        )}

        {listing.status === "cancelled" && (
          <div className="text-center py-1.5 text-xs font-semibold text-stone-500 bg-stone-100 rounded-[var(--radius-sm)] border border-stone-200">
            Cancelled by Donor
          </div>
        )}

        {listing.status === "expired" && (
          <div className="text-center py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 rounded-[var(--radius-sm)] border border-rose-200">
            Expired past safe consumption window
          </div>
        )}
      </div>
    </Card>
  );
}
