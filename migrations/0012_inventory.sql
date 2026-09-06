-- Inventory / spend tracking. One row per thing the org pays for or owns —
-- a software subscription, a batch of laptops, a stock of consumables. The
-- dashboard renders these as a category → item grid with a month column for
-- the selected year; per-month cost is derived from cadence + start/end.
CREATE TABLE inventory_items (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'software',   -- software | hardware | consumables | services | other
  name         TEXT NOT NULL,
  vendor       TEXT,
  kind         TEXT NOT NULL DEFAULT 'subscription', -- subscription | purchase
  cadence      TEXT NOT NULL DEFAULT 'monthly',    -- monthly | yearly | one_time
  amount_cents INTEGER NOT NULL DEFAULT 0,         -- cost per cadence, per unit (minor units)
  quantity     REAL NOT NULL DEFAULT 1,
  currency     TEXT NOT NULL DEFAULT 'INR',
  start_date   TEXT NOT NULL,                      -- YYYY-MM-DD: acquired / subscription start
  end_date     TEXT,                               -- YYYY-MM-DD: subscription ended (NULL = active)
  notes        TEXT,
  source       TEXT NOT NULL DEFAULT 'manual',     -- manual | agent
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_inventory_org ON inventory_items (org_id, category);
