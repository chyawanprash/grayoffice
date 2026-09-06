-- Finance data model for the agent: companies, invoices, a general ledger
-- (journal entries + lines), and accruals. Everything scopes to org_id.

ALTER TABLE organizations ADD COLUMN home_state TEXT;
ALTER TABLE organizations ADD COLUMN home_country TEXT DEFAULT 'IN';

CREATE TABLE companies (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'both',   -- customer | vendor | both
  gstin      TEXT,
  state      TEXT,                            -- place-of-supply state (IN)
  country    TEXT DEFAULT 'IN',
  email      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_companies_org ON companies (org_id, name);

CREATE TABLE invoices (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  company_id      TEXT NOT NULL,
  direction       TEXT NOT NULL,              -- receivable (we bill) | payable (we owe)
  number          TEXT NOT NULL,
  issue_date      TEXT NOT NULL,              -- YYYY-MM-DD
  due_date        TEXT,
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | open | paid | void
  place_of_supply TEXT,
  reverse_charge  INTEGER NOT NULL DEFAULT 0,
  subtotal_cents  INTEGER NOT NULL DEFAULT 0,
  tax_cents       INTEGER NOT NULL DEFAULT 0,
  total_cents     INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  source          TEXT NOT NULL DEFAULT 'agent', -- agent | manual | document
  source_ref      TEXT,                        -- doc_extracts id when from a PDF
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_invoices_org ON invoices (org_id, issue_date DESC);
CREATE UNIQUE INDEX idx_invoices_dedupe ON invoices (org_id, company_id, number);

CREATE TABLE invoice_lines (
  id               TEXT PRIMARY KEY,
  invoice_id       TEXT NOT NULL,
  description      TEXT NOT NULL,
  hsn_sac          TEXT,
  qty              REAL NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  gst_rate         REAL NOT NULL DEFAULT 0,    -- percent, e.g. 18
  taxable_cents    INTEGER NOT NULL DEFAULT 0,
  cgst_cents       INTEGER NOT NULL DEFAULT 0,
  sgst_cents       INTEGER NOT NULL DEFAULT 0,
  igst_cents       INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_invoice_lines_inv ON invoice_lines (invoice_id);

CREATE TABLE journal_entries (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  date       TEXT NOT NULL,                    -- YYYY-MM-DD
  memo       TEXT,
  status     TEXT NOT NULL DEFAULT 'draft',    -- draft | posted | needs_review
  review_note TEXT,
  source     TEXT NOT NULL DEFAULT 'manual',   -- manual | invoice | bank | accrual | agent
  source_ref TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_journal_org ON journal_entries (org_id, date DESC);

CREATE TABLE journal_lines (
  id           TEXT PRIMARY KEY,
  entry_id     TEXT NOT NULL,
  account      TEXT NOT NULL,
  debit_cents  INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  memo         TEXT
);
CREATE INDEX idx_journal_lines_entry ON journal_lines (entry_id);

CREATE TABLE accruals (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  period      TEXT NOT NULL,                   -- YYYY-MM the accrual belongs to
  status      TEXT NOT NULL DEFAULT 'open',    -- open | confirmed | reversed
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_accruals_org ON accruals (org_id, period);

-- Which bank transactions have been tied to a ledger entry / invoice.
CREATE TABLE bank_reconciliations (
  org_id      TEXT NOT NULL,
  bank_txn_id TEXT NOT NULL,
  matched_type TEXT NOT NULL,                  -- invoice | journal_entry
  matched_id  TEXT NOT NULL,
  confidence  REAL NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (org_id, bank_txn_id)
);
