SET lock_timeout = '3s';

-- Signed agreement view, PR B (v2.2712): "Email a copy…" logs a `shared`
-- event on the contract so the office can prove who received the signed
-- copy. Extends the job_contract_events.event_type CHECK; idempotent.

ALTER TABLE public.job_contract_events DROP CONSTRAINT IF EXISTS job_contract_events_event_type_check;
ALTER TABLE public.job_contract_events
  ADD CONSTRAINT job_contract_events_event_type_check
  CHECK (event_type IN ('sent', 'viewed', 'reminded', 'signed', 'voided', 'recorded', 'shared'));
