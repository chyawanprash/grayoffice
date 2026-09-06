-- Account linking ("login") for the external bots. A platform user
-- (Discord / Slack / Telegram) runs /login in the bot to get a short code, then
-- enters it at <APP_URL>/link while signed in to Gray Office. Once linked, the
-- backend attaches their Gray Office user to every inbound bot event.

-- Short-lived, single-use codes minted by the bot's /login command.
CREATE TABLE bot_link_codes (
  code          TEXT PRIMARY KEY,             -- human-typed, e.g. 'K7Q-2F9'
  source        TEXT NOT NULL,                -- 'discord' | 'slack' | 'telegram'
  external_user TEXT NOT NULL,                -- stable platform user id
  display_name  TEXT,                         -- platform handle, shown on the confirm screen
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at    INTEGER NOT NULL
);

-- Confirmed links. One Gray Office account per (source, external_user).
CREATE TABLE bot_links (
  source        TEXT NOT NULL,
  external_user TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (source, external_user)
);

CREATE INDEX idx_bot_links_user ON bot_links (user_id);

-- Tie audit rows to the linked Gray Office user when there is one.
ALTER TABLE bot_events ADD COLUMN user_id TEXT;
