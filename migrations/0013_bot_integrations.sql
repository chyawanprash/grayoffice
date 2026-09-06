-- Bots are now first-class integrations connected from the dashboard, not
-- separate repos. Each org stores its own Slack / Telegram / Discord app
-- credentials; platform webhooks land at /api/bots/<platform>/<orgId>.
ALTER TABLE bot_events ADD COLUMN org_id TEXT;
CREATE INDEX idx_bot_events_org ON bot_events (org_id, created_at DESC);

CREATE TABLE bot_integrations (
  org_id         TEXT NOT NULL,
  platform       TEXT NOT NULL,               -- slack | telegram | discord
  status         TEXT NOT NULL DEFAULT 'active', -- active | disconnected
  bot_token      TEXT,                         -- AES-GCM sealed: Slack xoxb- / BotFather token / Discord bot token
  signing_secret TEXT,                         -- AES-GCM sealed: Slack signing secret / Telegram webhook secret / Discord public key
  app_id         TEXT,                         -- Discord application id / Slack app id (for invite links) — not secret
  workspace_name TEXT,                         -- server / workspace name once known
  extra          TEXT,                         -- JSON
  connected_at   INTEGER,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (org_id, platform)
);

-- Idempotency: platforms retry deliveries; each external event is processed once.
CREATE TABLE bot_processed_events (
  platform          TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  org_id            TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (platform, external_event_id)
);
