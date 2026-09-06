-- Per-org flag: show the "populate dummy invoices" tools (calls the synthetic
-- data generator on bank.grayoffice). Off by default.
ALTER TABLE organizations ADD COLUMN dummy_data INTEGER NOT NULL DEFAULT 0;
