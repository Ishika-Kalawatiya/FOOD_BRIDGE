ALTER TABLE listings ADD COLUMN IF NOT EXISTS arrived_at_dropoff_at TIMESTAMPTZ;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
CHECK (status IN (
  'available', 'accepted', 'arrived_at_pickup', 'picked_up',
  'out_for_delivery', 'arrived_at_dropoff', 'delivered', 'distributed',
  'expired', 'cancelled'
));
