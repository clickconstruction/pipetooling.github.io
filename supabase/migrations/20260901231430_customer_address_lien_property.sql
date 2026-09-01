SET lock_timeout = '3s';

-- The property ledger (v2.2614, phase 1 of the Lien Instruments plan):
-- customer_addresses rows grow the property's LEGAL identity — the county the
-- lien paperwork files in, the appraisal-district legal description, the
-- residential/homestead classification the Chapter 53 deadlines fork on, and
-- the owner of record with their MAILING address. Entered once per property,
-- reused by every job there via the new jobs_ledger.customer_address_id
-- pointer (per-job job_property_owners overrides still win at resolution).
-- Additive and idempotent; no CREATE TABLE (existing tables already carry the
-- read-only training-mode blocks).

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS county text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS legal_description text NOT NULL DEFAULT '',
  -- '' = unknown; 'residential' | 'non_residential' once classified.
  ADD COLUMN IF NOT EXISTS property_kind text NOT NULL DEFAULT ''
    CONSTRAINT customer_addresses_property_kind_check CHECK (property_kind IN ('', 'residential', 'non_residential')),
  ADD COLUMN IF NOT EXISTS homestead boolean NOT NULL DEFAULT false,
  -- '' = unset; mirrors job_property_owners.owner_mode values.
  ADD COLUMN IF NOT EXISTS owner_mode text NOT NULL DEFAULT ''
    CONSTRAINT customer_addresses_owner_mode_check CHECK (owner_mode IN ('', 'homeowner', 'building_owner')),
  ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_company text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_mailing_address text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.customer_addresses.county IS
  'Texas county the property files in (lien affidavits go to this County Clerk). Suggested from the city, always human-confirmed.';
COMMENT ON COLUMN public.customer_addresses.legal_description IS
  'County Appraisal District legal description — required on a mechanic''s lien affidavit (Tex. Prop. Code § 53.054).';
COMMENT ON COLUMN public.customer_addresses.homestead IS
  'Owner-occupied homestead: Chapter 53 lien rights require a recorded pre-work contract signed by both spouses (§ 53.254).';

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS customer_address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.jobs_ledger.customer_address_id IS
  'Which customer_addresses property this job is at (v2.2614). Feeds lien documents (county / legal description / owner of record); job_property_owners still overrides the owner block.';

CREATE INDEX IF NOT EXISTS jobs_ledger_customer_address_id_idx
  ON public.jobs_ledger (customer_address_id)
  WHERE customer_address_id IS NOT NULL;
