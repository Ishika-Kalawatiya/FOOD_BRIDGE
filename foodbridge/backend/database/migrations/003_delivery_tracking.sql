ALTER TABLE listings ADD COLUMN IF NOT EXISTS dropoff_address VARCHAR(160);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS dropoff_latitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS dropoff_longitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS volunteer_latitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS volunteer_longitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS volunteer_location_updated_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
CHECK (status IN ('available', 'claimed', 'collected', 'delivered', 'distributed', 'expired', 'cancelled'));
