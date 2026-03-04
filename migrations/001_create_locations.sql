CREATE TABLE IF NOT EXISTS locations (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy REAL,
  battery_level REAL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_patient_id ON locations(patient_id);
CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp);
