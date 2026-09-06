-- Google sign-in + multi-factor auth
-- Rebuild `users` so password_hash is nullable (Google-only accounts) and add
-- the OAuth / MFA columns.

PRAGMA foreign_keys=OFF;

ALTER TABLE users RENAME TO users_old;

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT,
  name           TEXT,
  avatar_url     TEXT,
  google_id      TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  totp_secret    TEXT,
  totp_enabled   INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO users (id, email, password_hash, created_at)
  SELECT id, email, password_hash, created_at FROM users_old;

DROP TABLE users_old;

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_google_id ON users (google_id);

-- One-time recovery codes for MFA (SHA-256 hashed, single use)
CREATE TABLE mfa_recovery_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_recovery_user ON mfa_recovery_codes (user_id);

-- Short-lived email one-time passcodes (Resend). purpose: 'mfa' | 'verify' | 'reset'
CREATE TABLE email_otps (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_otp_user ON email_otps (user_id, purpose);

PRAGMA foreign_keys=ON;
