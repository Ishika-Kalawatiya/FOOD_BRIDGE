CREATE TABLE IF NOT EXISTS players (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(30) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  id               SERIAL PRIMARY KEY,
  player_id        INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  points           INTEGER NOT NULL CHECK (points >= 0),
  items_saved      INTEGER NOT NULL CHECK (items_saved >= 0),
  items_wasted     INTEGER NOT NULL CHECK (items_wasted >= 0),
  estimated_meals  NUMERIC(10,2) NOT NULL CHECK (estimated_meals >= 0),
  played_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scores_points ON scores (points DESC);

CREATE TABLE IF NOT EXISTS audits (
  id             SERIAL PRIMARY KEY,
  audit_date     DATE NOT NULL,
  location       VARCHAR(80) NOT NULL,
  volunteer      VARCHAR(60) NOT NULL,
  food_type      VARCHAR(40) NOT NULL,
  weight_kg      NUMERIC(8,2) NOT NULL CHECK (weight_kg >= 0),
  meals_served   INTEGER NOT NULL CHECK (meals_served >= 0),
  notes          TEXT,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_date, location, volunteer, food_type)
);

-- ===== Core platform: surplus food listings =====
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(60) NOT NULL,
  role        VARCHAR(10) NOT NULL CHECK (role IN ('donor','volunteer','ngo')),
  org         VARCHAR(80),                       -- restaurant, campus, hostel, NGO name
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id               SERIAL PRIMARY KEY,
  donor_id         INTEGER NOT NULL REFERENCES users(id),
  title            VARCHAR(80) NOT NULL,
  meals            INTEGER NOT NULL CHECK (meals > 0),
  pickup_address   VARCHAR(160) NOT NULL,
  dropoff_address  VARCHAR(160),
  pickup_latitude  DOUBLE PRECISION,
  pickup_longitude DOUBLE PRECISION,
  dropoff_latitude DOUBLE PRECISION,
  dropoff_longitude DOUBLE PRECISION,
  volunteer_latitude DOUBLE PRECISION,
  volunteer_longitude DOUBLE PRECISION,
  volunteer_location_updated_at TIMESTAMPTZ,
  notes            TEXT,
  expires_at       TIMESTAMPTZ NOT NULL,
  status           VARCHAR(24) NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','accepted','arrived_at_pickup','picked_up','out_for_delivery','arrived_at_dropoff','delivered','distributed','expired','cancelled')),
  volunteer_id     INTEGER REFERENCES users(id),
  ngo_id           INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at       TIMESTAMPTZ,
  collected_at     TIMESTAMPTZ,
  arrived_at_pickup_at TIMESTAMPTZ,
  arrived_at_dropoff_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  distributed_at   TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings (status, expires_at);

CREATE TABLE IF NOT EXISTS service_certificates (
  certificate_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(100) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('donor', 'volunteer', 'ngo')),
  lantern_id VARCHAR(40) NOT NULL,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  listing_title VARCHAR(160) NOT NULL,
  meals INTEGER NOT NULL CHECK (meals > 0),
  issued_at TIMESTAMPTZ NOT NULL,
  signature CHAR(64) NOT NULL,
  UNIQUE (user_id, lantern_id)
);
CREATE INDEX IF NOT EXISTS idx_service_certificates_listing
  ON service_certificates (listing_id);
