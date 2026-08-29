-- Atomic monthly hosted-AI accounting. Each request is first reserved, then
-- committed only after a valid provider response. Abandoned reservations are
-- released before later requests so provider failures never become permanent
-- usage.
CREATE TABLE IF NOT EXISTS ai_action_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL CHECK (period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'committed', 'released')),
  created_at INTEGER NOT NULL,
  finalized_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ai_action_reservations_quota
  ON ai_action_reservations(user_id, period_key, status);

CREATE INDEX IF NOT EXISTS idx_ai_action_reservations_stale
  ON ai_action_reservations(status, created_at);

-- Provider-neutral subscription state. Provider IDs stay mapping data rather
-- than becoming application entitlements, so Whop can be replaced cleanly.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  provider_product_id TEXT NOT NULL,
  provider_plan_id TEXT NOT NULL,
  internal_plan TEXT NOT NULL CHECK (internal_plan IN ('sprint', 'pro')),
  status TEXT NOT NULL,
  current_period_start INTEGER,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider),
  UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_status
  ON billing_subscriptions(user_id, status);

-- Whop retries and does not guarantee ordering. Store only the event envelope
-- needed for idempotency; never persist raw resume/customer payloads here.
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  PRIMARY KEY (provider, event_id)
);
