import React from "react";
import { PhoneAction } from "./PhoneAction";

const activeStatuses = new Set([
  "accepted",
  "arrived_at_pickup",
  "picked_up",
  "out_for_delivery",
  "arrived_at_dropoff",
  "delivered",
  "distributed",
]);

export function ListingContacts({ listing, activeRole, currentUser }) {
  if (!activeStatuses.has(listing.status)) return null;

  let contacts = [];
  const viewerRole = currentUser?.role || activeRole;
  if (viewerRole === "volunteer") {
    contacts = [
      ["Call Donor", listing.donor?.phone],
      ["Call NGO", listing.ngo?.phone],
    ];
  } else if (viewerRole === "donor") {
    contacts = [
      ["Call Rider", listing.volunteer?.phone],
      ["Call NGO", listing.ngo?.phone],
    ];
  } else if (viewerRole === "ngo") {
    contacts = [
      ["Call Rider", listing.volunteer?.phone],
      ["Call Donor", listing.donor?.phone],
    ];
  }

  const availableContacts = contacts.filter(([, phone]) => phone);
  if (!availableContacts.length) return null;

  return (
    <div className="listing-contacts" aria-label="Delivery contacts">
      {availableContacts.map(([label, phone]) => (
        <PhoneAction key={label} label={label} phone={phone} compact />
      ))}
    </div>
  );
}
