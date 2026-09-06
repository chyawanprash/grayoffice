-- Compatibility layer for the standalone chat bots (discord/telegram/slack.grayoffice).
-- Those repos POST to /api/bots/ingest and use /login codes; the dashboard-connect
-- webhook model (0013) doesn't cover them. These two tables back that flow.

-- Short-lived, single-use codes minted by a bot's /login command.
CREATE TABLE bot_link_codes (
  code          TEXT PRIMARY KEY,             -- human-typed, e.g. 'K7Q-2F9'
  source        TEXT NOT NULL,                -- 'discord' | 'slack' | 'telegram'
  external_user TEXT NOT NULL,                -- stable platform user id
  display_name  TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at    INTEGER NOT NULL
);

-- Confirmed links. One (source, external_user) -> one Gray Office user + org.
CREATE TABLE bot_links (
  source        TEXT NOT NULL,
  external_user TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  org_id        TEXT NOT NULL,
  display_name  TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source, external_user)
);
CREATE INDEX idx_bot_links_user ON bot_links (user_id);
