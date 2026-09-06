-- Document extraction: uploaded PDFs converted to structured JSON (invoice /
-- PO / GRN / statement / receipt / tax doc fields + line items). Distinct from
-- the knowledge base (0005), which does semantic chunk retrieval - these are
-- machine-readable records the finance agent pulls as context.

CREATE TABLE doc_extracts (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  size       INTEGER,
  status     TEXT NOT NULL DEFAULT 'processing', -- processing | ready | error
  doc_type   TEXT,                               -- invoice | purchase_order | grn | bank_statement | ...
  json       TEXT,                               -- extracted { document_type, summary, data } (stringified)
  error      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_doc_extracts_org ON doc_extracts (org_id, created_at DESC);
