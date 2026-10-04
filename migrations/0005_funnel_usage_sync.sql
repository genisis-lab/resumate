-- Upgrade-funnel analytics need more event names than 0004 allowed. SQLite
-- cannot alter a CHECK constraint, so rebuild the table. Event names are now
-- validated by server/analytics.ts; the database only enforces their shape.
CREATE TABLE conversion_events_v2 (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (length(event_name) BETWEEN 3 AND 40 AND event_name NOT GLOB '*[^a-z_]*'),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata_json TEXT CHECK (metadata_json IS NULL OR length(metadata_json) <= 1000),
  created_at INTEGER NOT NULL
);

INSERT INTO conversion_events_v2 (id, event_name, user_id, metadata_json, created_at)
  SELECT id, event_name, user_id, metadata_json, created_at FROM conversion_events;

DROP TABLE conversion_events;
ALTER TABLE conversion_events_v2 RENAME TO conversion_events;

CREATE INDEX IF NOT EXISTS idx_conversion_events_name_time
  ON conversion_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_conversion_events_user_time
  ON conversion_events(user_id, created_at);

-- Free-plan document export and ATS-check counters. Signed-in users are keyed
-- by account; signed-out visitors by a salted, monthly-rotating hash of their
-- IP address, so the raw address is never stored.
CREATE TABLE IF NOT EXISTS free_usage_counters (
  subject_key TEXT NOT NULL CHECK (length(subject_key) BETWEEN 8 AND 120),
  period_key TEXT NOT NULL CHECK (period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  action TEXT NOT NULL CHECK (action IN ('documentExports', 'localAtsChecks')),
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (subject_key, period_key, action)
);

CREATE INDEX IF NOT EXISTS idx_free_usage_counters_period
  ON free_usage_counters(period_key);

-- Opt-in, end-to-end encrypted resume sync (Pro). The browser encrypts the
-- whole workspace with a key derived from a passphrase the server never sees;
-- this table only holds ciphertext and the public KDF parameters.
CREATE TABLE IF NOT EXISTS sync_vaults (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  ciphertext TEXT NOT NULL CHECK (length(ciphertext) <= 1500000),
  iv TEXT NOT NULL CHECK (length(iv) BETWEEN 12 AND 40),
  salt TEXT NOT NULL CHECK (length(salt) BETWEEN 16 AND 64),
  kdf_iterations INTEGER NOT NULL CHECK (kdf_iterations BETWEEN 100000 AND 5000000),
  key_check TEXT NOT NULL CHECK (length(key_check) BETWEEN 16 AND 200),
  device_label TEXT CHECK (device_label IS NULL OR length(device_label) <= 60),
  updated_at INTEGER NOT NULL
);
