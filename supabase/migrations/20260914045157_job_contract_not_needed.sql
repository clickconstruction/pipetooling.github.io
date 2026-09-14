SET lock_timeout = '3s';

-- Contract sweep, seen first — PR 0: "Not needed" on a job, and the floor.
--
-- The contract count treated every live job the same: a $450 repair counted
-- like a $123,600 commercial job, and the office had no way to answer "this
-- one does not need paper" (a builder's subcontract on file elsewhere, a
-- warranty call, a service call). Three columns record that answer on the
-- job; the dollar floor lives in app_settings (job_contract_floor_cents_v1,
-- dev-written like every org-wide switch) and needs no schema.
--
-- The coverage kernel reads contract_not_needed_at as its own state
-- ("No contract · not needed"): a signed record still wins over it, and it
-- wins over a sent or drafted contract. The nudge, the Pipeline card, the
-- No-contract filter and the sweep leave these jobs out of the count.
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls;
-- jobs_ledger's existing RLS governs writes (the office set that edits jobs).

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS contract_not_needed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_not_needed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_not_needed_reason text;

COMMENT ON COLUMN public.jobs_ledger.contract_not_needed_at IS
  'Contract sweep PR 0 (v2.3384): when the office answered that this job needs no customer agreement of ours. NULL = it does (or nobody said). A signed record still counts over this; the nudge, the Pipeline card and the sweep skip the job while it is set.';
COMMENT ON COLUMN public.jobs_ledger.contract_not_needed_by IS
  'Who answered Not needed (users.id).';
COMMENT ON COLUMN public.jobs_ledger.contract_not_needed_reason IS
  'Why, in the office''s words — the chip shows it ("GC job, their subcontract", "Service call", "Warranty").';
