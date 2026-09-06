-- Audit log for inbound bot activity (Slack / Telegram / Discord).
-- One row per inbound message or file, updated in place as it's routed/processed.
CREATE TABLE bot_events (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,                 -- 'telegram' | 'slack' | 'discord'
  external_user TEXT,                          -- sender handle/id on that platform
  kind          TEXT NOT NULL,                 -- 'message' | 'file'
  summary       TEXT,                          -- short human description
  route         TEXT,                          -- endpoint the router picked, e.g. 'pdf-to-json'
  status        TEXT NOT NULL DEFAULT 'received', -- 'received' | 'routed' | 'done' | 'error'
  detail        TEXT,                          -- JSON: router reasoning, result, or error
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_bot_events_created ON bot_events (created_at DESC);
CREATE INDEX idx_bot_events_source ON bot_events (source, created_at DESC);
