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
