SET lock_timeout = '3s';

-- Punch list #166 (v2.5840): the office's answer "this job is ours with the owner".
--
-- The Legal desk flags a job that is probably a subcontract set up as if we worked for the owner
-- (no GC on the job, an owner of record who is not the customer, and a second signal). When the
-- office looks and says the job really is ours with the owner, the answer lives on the job so the
-- note does not come back. Two nullable columns, no default, no rewrite; the kernel
-- (src/lib/legal/suspectedSubJob.ts) reads owner_contract_confirmed_at.
--
-- Additive and idempotent; no table is created, so no fence is owed. The office roles already
-- update jobs_ledger (the job form), so no policy changes.

ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS owner_contract_confirmed_at timestamptz;
ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS owner_contract_confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.jobs_ledger.owner_contract_confirmed_at IS 'v2.5840 (punch list #166): the office confirmed this job is ours with the owner, not a subcontract set up with the GC as the customer; the Legal desk''s "Probably a subcontract" note stays away while set.';
COMMENT ON COLUMN public.jobs_ledger.owner_contract_confirmed_by IS 'v2.5840: who confirmed it (users.id).';
