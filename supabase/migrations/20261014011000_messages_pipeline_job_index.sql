SET lock_timeout = '3s';

-- Messages, cut 10: a Pipeline job's calls, texts and emails in its Job activity (to-dos/gc-mode/messages/BUILD_PLAN.md,
-- cut 10, on branch spike/gc-mode). On the spine (20261012010000_messages_spine.sql), whose indexes on messages and
-- contact_jobs all lead with the contact, so a read by job had none.
--
--   * messages_pipeline_job: the lines tied to one Pipeline job, newest first. Job activity reads them when a row's
--     activity opens (jobs_ledger_id = the job).
--   * contact_jobs_pipeline_job: the people the office put on one Pipeline job. Job activity reads their lines tied to
--     no job yet through messages_thread (contact_id, at DESC), and shows them on each of their open jobs until someone
--     ties them in the thread.
--   * No table, column, policy or function changes, so no fences: an index reads under the policies its table has.
--   * Both tables are small today, so a plain CREATE INDEX builds in a moment. The lock timeout fails the push fast if
--     a write holds either table.

CREATE INDEX IF NOT EXISTS messages_pipeline_job ON public.messages (jobs_ledger_id, at DESC)
  WHERE jobs_ledger_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contact_jobs_pipeline_job ON public.contact_jobs (jobs_ledger_id)
  WHERE jobs_ledger_id IS NOT NULL;
