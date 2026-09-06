-- Organization's own registered details - shown on invoices it raises and used
-- as the seller side for GST place of supply. (home_state / home_country from
-- 0008 stay; this adds the address and tax id the user actually thinks in.)
ALTER TABLE organizations ADD COLUMN address TEXT;
ALTER TABLE organizations ADD COLUMN tax_id TEXT;   -- GSTIN (IN) or VAT ID
