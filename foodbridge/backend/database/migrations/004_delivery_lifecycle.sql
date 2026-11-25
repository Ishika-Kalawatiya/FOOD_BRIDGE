ALTER TABLE listings ADD COLUMN IF NOT EXISTS arrived_at_pickup_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ;
ALTER TABLE listings ALTER COLUMN status TYPE VARCHAR(24);

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;

UPDATE listings
SET status = 'accepted'
WHERE status = 'claimed';

UPDATE listings
SET status = 'out_for_delivery',
    arrived_at_pickup_at = COALESCE(arrived_at_pickup_at, collected_at),
    out_for_delivery_at = COALESCE(out_for_delivery_at, collected_at)
WHERE status = 'collected';

ALTER TABLE listings ADD CONSTRAINT listings_status_check
CHECK (status IN (
  'available', 'accepted', 'arrived_at_pickup', 'picked_up',
  'out_for_delivery', 'delivered', 'distributed', 'expired', 'cancelled'
));
