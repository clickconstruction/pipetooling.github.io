SET lock_timeout = '3s';

-- Signing it on paper, PR 6 (to-dos/contract-paper-lane): Edit & re-send while unopened. An
-- agreement the customer has not opened goes back to a draft in place — same row, same link,
-- revision + 1 — instead of void-and-revise, which on 2026-09-03 left three voided rows behind
-- one job in one day. `reopened` records who pulled it back and when. Extends the
-- job_contract_events.event_type CHECK (as 20260903191531 did for `shared`); idempotent.

ALTER TABLE public.job_contract_events DROP CONSTRAINT IF EXISTS job_contract_events_event_type_check;
ALTER TABLE public.job_contract_events
  ADD CONSTRAINT job_contract_events_event_type_check
  CHECK (event_type IN ('sent', 'viewed', 'reminded', 'signed', 'voided', 'recorded', 'shared', 'reopened'));
