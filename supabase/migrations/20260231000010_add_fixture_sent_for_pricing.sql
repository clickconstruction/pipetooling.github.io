-- Fixture sent for pricing: allow part_id NULL, add fixture_cost
-- When part_id IS NULL: fixture sent to office for them to price; fixture_cost editable by office

ALTER TABLE public.jobs_tally_parts ALTER COLUMN part_id DROP NOT NULL;

ALTER TABLE public.jobs_tally_parts ADD COLUMN IF NOT EXISTS fixture_cost NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.jobs_tally_parts.fixture_cost IS 'Office-entered cost for fixture-only entries (part_id IS NULL). Used when sub sends fixture to office for pricing.';
