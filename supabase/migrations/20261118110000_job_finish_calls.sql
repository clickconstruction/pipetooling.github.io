SET lock_timeout = '3s';

-- My finish date (punch list #396, PR 3a): a person's own word on when a job finishes.
--
-- WHY. The superintendent's pace card reads a planned finish the office froze at award and the day this pace
-- lands on, worked out from hours. Neither is what the man on the job thinks. The owner asked for a press where
-- he reports when he thinks the job will finish. This table keeps that word.
--
-- WHAT. One row is one saying: who, which job, the day, an optional line on what is in the way, and the planned
-- day as it stood when he said it. A new saying is a new row. Nothing is changed and nothing is taken back, so
-- the list is the history of what he said and when. The newest row a person has on a job is his word today.
--
-- It moves nothing. No function reads it into the planned finish, the pace line or the score: those stay the
-- office's (the owner's call of 2026-11-18). The card and the Projects board read it beside the plan.
--
-- WHO. A person writes his own row on a job he can read: the check asks jobs_ledger under his own row-level
-- security. A person reads his own rows, and anyone who can read the job reads what was said on it, the same
-- way. No update and no delete for anyone signed in.
--
-- Idempotent: IF NOT EXISTS, DROP POLICY IF EXISTS, and the four fences create only what is missing.

CREATE TABLE IF NOT EXISTS public.job_finish_calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  finish_on   date NOT NULL,
  plan_was    date,
  why         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_finish_calls_why_has_words CHECK (why IS NULL OR (btrim(why) <> '' AND char_length(why) <= 300))
);

COMMENT ON TABLE public.job_finish_calls IS
  'My finish date (punch list #396): a person''s own word on when a job finishes. One row a saying, never changed: finish_on is the day, why is what is in the way, plan_was is the planned finish as it stood then. The newest row a person has on a job is his word today. It moves neither the planned finish nor the score. v2.7807.';
COMMENT ON COLUMN public.job_finish_calls.plan_was IS 'The job''s planned finish when this was said, so *the plan* can be told from a day of his own. Null when the job had none.';

CREATE INDEX IF NOT EXISTS idx_job_finish_calls_job_newest
  ON public.job_finish_calls (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_finish_calls_user
  ON public.job_finish_calls (user_id);

ALTER TABLE public.job_finish_calls ENABLE ROW LEVEL SECURITY;

-- A person reads his own rows. Anyone else reads a saying when they can read its job: the sub-select runs under
-- the caller's own row-level security on jobs_ledger.
DROP POLICY IF EXISTS job_finish_calls_select ON public.job_finish_calls;
CREATE POLICY job_finish_calls_select ON public.job_finish_calls
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_finish_calls.job_id)
  );

-- A person writes his own row, on a job he can read.
DROP POLICY IF EXISTS job_finish_calls_insert ON public.job_finish_calls;
CREATE POLICY job_finish_calls_insert ON public.job_finish_calls
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_finish_calls.job_id)
  );

REVOKE ALL ON public.job_finish_calls FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.job_finish_calls TO authenticated;
GRANT ALL ON public.job_finish_calls TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
