-- Display currency for the organization. Amounts are still stored as minor
-- units; this only changes how they're formatted in the UI.
ALTER TABLE organizations ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';
