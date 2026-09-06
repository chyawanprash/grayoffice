-- Bots are now first-class integrations connected from the dashboard, not
-- separate repos. Each org stores its own Slack / Telegram / Discord app
-- credentials; platform webhooks land at /api/bots/<platform>/<orgId>.
ALTER TABLE bot_events ADD COLUMN org_id TEXT;
CREATE INDEX idx_bot_events_org ON bot_events (org_id, created_at DESC);

CREATE TABLE bot_integrations (
  org_id         TEXT NOT NULL,
  platform       TEXT NOT NULL,               -- slack | telegram | discord
  bot_token      TEXT,                         -- Slack xoxb- / BotFather token / Discord bot token
  signing_secret TEXT,                         -- Slack signing secret / Telegram webhook secret / Discord public key
  app_id         TEXT,                         -- Discord application id / Slack app id (for invite links)
  extra          TEXT,                         -- JSON
  connected_at   INTEGER,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (org_id, platform)
);
