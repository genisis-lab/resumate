CREATE TABLE IF NOT EXISTS conversion_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'landing_view', 'signup_started', 'signup_completed', 'email_verified',
    'checkout_started', 'checkout_created', 'purchase_activated', 'ai_action_completed'
  )),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata_json TEXT CHECK (metadata_json IS NULL OR length(metadata_json) <= 1000),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversion_events_name_time
  ON conversion_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_conversion_events_user_time
  ON conversion_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('revoke_sessions')),
  target_user_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 10 AND 300),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON admin_audit_log(created_at);

CREATE TABLE IF NOT EXISTS billing_webhook_failures (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  error_code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_failures_open
  ON billing_webhook_failures(resolved_at, created_at);
