-- Per-user payment gateway connections (Stripe, Razorpay, Cashfree, Polar, Dodo Payments).
-- ponytail: secrets stored in D1 as-is. Fine for dev/single-tenant; encrypt at rest
-- or move to a secrets manager before multi-tenant production.
CREATE TABLE payment_integrations (
  user_id        TEXT NOT NULL,
  provider       TEXT NOT NULL,                 -- stripe | razorpay | cashfree | polar | dodopayments
  mode           TEXT NOT NULL DEFAULT 'test',  -- test | live
  api_key        TEXT,                          -- secret key / access token / client id
  api_secret     TEXT,                          -- key secret / client secret (when the gateway needs two)
  webhook_secret TEXT,
  extra          TEXT,                          -- JSON: e.g. { "organization_id": "..." } for Polar
  connected_at   INTEGER,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, provider)
);

-- Verified webhook events received from the gateways.
CREATE TABLE payment_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  provider   TEXT NOT NULL,
  type       TEXT,                              -- e.g. payment.succeeded, payment.captured
  summary    TEXT,
  payload    TEXT,                              -- raw JSON body
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_payment_events_user ON payment_events (user_id, provider, created_at DESC);
