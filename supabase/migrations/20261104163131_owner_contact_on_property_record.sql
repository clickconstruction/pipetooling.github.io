SET lock_timeout = '3s';

-- The owner's email and phone on the property record (v2.6497, Taunya's report on job 663, 2026-11-03).
--
-- The courtesy notice before a lien (punch list #231) reaches the owner of record by email, and the only
-- column that held an owner's email was job_property_owners.owner_email — the per-job override that only
-- the supply-house share window writes. The property record itself (customer_addresses: county, legal
-- description, owner of record, owner mailing address) is where the office types the owner, so the
-- owner's email and phone go beside the mailing address there. The per-job override gains the phone so
-- it keeps a whole owner block: it wins the owner block when it names one (resolveLienProperty in
-- src/lib/jobs/lienProperty.ts), and a blank there falls back to the property record's.
--
-- Additive and idempotent. No CREATE TABLE, so no fence calls: both tables already carry the read-only
-- blocks and the twin fence. The client reads the new columns through select('*') and writes them only
-- when a row carries them, so nothing fails before the push; the deploy still wants the push right after
-- the merge, since a typed email cannot be saved until the column exists.

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_phone text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.customer_addresses.owner_email IS
  'The owner of record''s email, typed by the office beside the mailing address (v2.6497). The courtesy notice before a lien goes here; the appraisal roll never fills it.';
COMMENT ON COLUMN public.customer_addresses.owner_phone IS
  'The owner of record''s phone, typed by the office (v2.6497). For a call from the Lien desk, and for the courtesy text when the number already belongs to a Messages contact.';

ALTER TABLE public.job_property_owners
  ADD COLUMN IF NOT EXISTS owner_phone text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.job_property_owners.owner_phone IS
  'The per-job owner''s phone (v2.6497), beside owner_email: the override wins the owner block when it names one, and a blank here falls back to the property record''s owner_phone.';
