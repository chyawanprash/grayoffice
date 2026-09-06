-- Organizations: Gray Office is a team product. Every user belongs to one or
-- more orgs via `memberships`; app data (payments, bank, knowledge base)
-- scopes to `org_id`.

CREATE TABLE organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE memberships (
  org_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',      -- owner | admin | member
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships (user_id);

CREATE TABLE org_invites (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  token_hash  TEXT NOT NULL,
  invited_by  TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_org_invites_email ON org_invites (email);
CREATE INDEX idx_org_invites_org ON org_invites (org_id);

-- Per-org connection to bank.grayoffice.app (bearer API key + created account).
CREATE TABLE org_bank (
  org_id       TEXT PRIMARY KEY,
  bank_url     TEXT NOT NULL,
  api_key      TEXT NOT NULL,
  account_id   TEXT,
  branch_code  TEXT,
  connected_at INTEGER,
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Knowledge base: uploaded PDFs, one row per document. Chunks + embeddings
-- live in Pinecone under namespace kb_<org_id>.
CREATE TABLE kb_documents (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  size       INTEGER,
  status     TEXT NOT NULL DEFAULT 'processing', -- processing | ready | error
  chunks     INTEGER DEFAULT 0,
  error      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_kb_documents_org ON kb_documents (org_id, created_at DESC);

-- Existing per-user payment data becomes per-org. Dev/single-tenant so far
-- (see 0004's ponytail note) - rebuild rather than migrate rows.
DROP TABLE IF EXISTS payment_integrations;
DROP TABLE IF EXISTS payment_events;

CREATE TABLE payment_integrations (
  org_id         TEXT NOT NULL,
  provider       TEXT NOT NULL,
  mode           TEXT NOT NULL DEFAULT 'test',
  api_key        TEXT,
  api_secret     TEXT,
  webhook_secret TEXT,
  extra          TEXT,
  connected_at   INTEGER,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (org_id, provider)
);

CREATE TABLE payment_events (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  provider   TEXT NOT NULL,
  type       TEXT,
  summary    TEXT,
  payload    TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_payment_events_org ON payment_events (org_id, provider, created_at DESC);
