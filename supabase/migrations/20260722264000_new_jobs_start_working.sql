-- New jobs start in Working, not Waiting.
--
-- Both job-creation paths omit `status` and inherit this column default:
--   1. New Job modal            — src/components/jobs/JobFormModal.tsx (client insert)
--   2. create_job_from_estimate — both overloads (6-arg and 7-arg/p_fixtures)
-- so flipping the default moves both at once. The split-job RPCs
-- (split_job_ledger_fixtures_to_new_job) set `status` explicitly — they copy the
-- source job's stage — and are deliberately unaffected.
--
-- Waiting stays in the pipeline as a manual parking stage you can send a job
-- back to; the clock-out trigger clock_sessions_promote_job_waiting_to_working
-- still promotes those, it just no longer fires for freshly created jobs.
--
-- Idempotent: SET DEFAULT is a no-op when already 'working'. Existing rows keep
-- their current status — this only affects newly inserted jobs.

ALTER TABLE public.jobs_ledger
  ALTER COLUMN status SET DEFAULT 'working'::text;

COMMENT ON COLUMN public.jobs_ledger.status IS
  'Job billing status: waiting, working, ready_to_bill, billed, paid. New jobs default to working (Waiting is a manual send-back parking stage).';
