import React from "react";

const stages = [
  { status: "available", label: "Available", time: "created_at" },
  { status: "accepted", label: "Accepted", time: "claimed_at" },
  { status: "arrived_at_pickup", label: "Arrived at Pickup", time: "arrived_at_pickup_at" },
  { status: "picked_up", label: "Picked Up", time: "collected_at" },
  { status: "out_for_delivery", label: "Out for Delivery", time: "out_for_delivery_at" },
  { status: "arrived_at_dropoff", label: "At Drop-off", time: "arrived_at_dropoff_at" },
  { status: "delivered", label: "Delivered", time: "delivered_at" },
];

export function DeliveryTimeline({ listing, compact = false }) {
  const status = listing.status === "distributed" ? "delivered" : listing.status;
  const activeIndex = stages.findIndex((stage) => stage.status === status);
  if (activeIndex < 0) return null;

  return (
    <ol className={`delivery-timeline${compact ? " delivery-timeline--compact" : ""}`} aria-label="Delivery status timeline">
      {stages.map((stage, index) => {
        const complete = index <= activeIndex;
        const timestamp = listing[stage.time];
        return (
          <li key={stage.status} className={complete ? "is-complete" : ""} aria-current={index === activeIndex ? "step" : undefined}>
            <span className="delivery-timeline-dot" />
            <span className="delivery-timeline-label">{stage.label}</span>
            {timestamp && index <= activeIndex && (
              <time dateTime={timestamp}>{new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            )}
          </li>
        );
      })}
    </ol>
  );
}
