SET lock_timeout = '3s';

-- v2.3723 · Signing it on paper, the live pass: Edit & re-send (v2.3647) writes a `reopened`
-- event when an unopened agreement goes back to a draft, but the event_type CHECK from
-- 20260903141146 never admitted it — the insert failed quietly on every reopen, so the
-- record showed a revision bump with no line saying why. Widen the CHECK.
ALTER TABLE public.job_contract_events DROP CONSTRAINT IF EXISTS job_contract_events_event_type_check;
ALTER TABLE public.job_contract_events
  ADD CONSTRAINT job_contract_events_event_type_check
  CHECK (event_type IN ('sent', 'viewed', 'reminded', 'signed', 'voided', 'recorded', 'reopened'));
