SET lock_timeout = '3s';

-- Quick Estimate (the field write-up wizard): the wizard's own drafts carry a marker (v2.4068).
--
-- The wizard creates an ordinary `estimates` draft on the first job/customer pick and autosaves
-- into it; until now nothing told a wizard draft apart from a change order the same person drafted
-- in the office editor, so the wizard could not offer to pick a half-done write-up back up
-- (the v2.2293 deferral). `field_write_up` is set by the wizard alone: when it started, the job it
-- was opened on (the row's own job_ledger_id stays reserved for the created-from link), the
-- free-typed phone and customer, and `dismissed_at` once the person chose to leave the draft
-- to the office. Office screens never read it.
--
-- Additive and idempotent; nothing reads the column until the v2.4068 client ships.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS field_write_up jsonb;

COMMENT ON COLUMN public.estimates.field_write_up IS
  'Set only by the Quick Estimate field wizard (v2.4068): { started_at, job: { id, hcp, name, address, customer_id } | null, phone, free_customer, dismissed_at }. NULL on every office-made estimate.';
