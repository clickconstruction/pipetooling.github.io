SET lock_timeout = '3s';

-- The Contract window, PR 4 of 5 — a second signer. Counsel's homestead question (Prop. Code
-- § 53.254(c): a homestead's improvement contract is signed by both spouses) needs two frames on
-- one agreement. The office names the second signer on the draft (and an email, when known);
-- the customer's page shows a frame per signer, either may sign first, and the row reads signed
-- only when both frames are filled. The first frame keeps the signer_* columns; the second gets
-- its own set. `co_signed` records a frame filled while the other still waits. Additive,
-- idempotent; a client older than this migration never writes the columns and reads NULLs.

begin;

ALTER TABLE public.job_contracts
  ADD COLUMN IF NOT EXISTS co_signer_name text,
  ADD COLUMN IF NOT EXISTS co_signer_email text,
  ADD COLUMN IF NOT EXISTS co_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS co_signer_printed_name text,
  ADD COLUMN IF NOT EXISTS co_signer_mode text,
  ADD COLUMN IF NOT EXISTS co_signer_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS co_signer_ip text,
  ADD COLUMN IF NOT EXISTS co_signer_user_agent text,
  ADD COLUMN IF NOT EXISTS co_signer_signature_storage_path text;

COMMENT ON COLUMN public.job_contracts.co_signer_name IS 'The second signer the office named on the draft (v2.4186); NULL = one signature closes the agreement.';
COMMENT ON COLUMN public.job_contracts.co_signed_at IS 'When the second frame was signed; the row reads signed only when both frames are filled.';

-- A frame filled while the other still waits (as 20260920220000 did for `reopened`); idempotent.
ALTER TABLE public.job_contract_events DROP CONSTRAINT IF EXISTS job_contract_events_event_type_check;
ALTER TABLE public.job_contract_events
  ADD CONSTRAINT job_contract_events_event_type_check
  CHECK (event_type IN ('sent', 'viewed', 'reminded', 'signed', 'voided', 'recorded', 'shared', 'reopened', 'co_signed'));

commit;
