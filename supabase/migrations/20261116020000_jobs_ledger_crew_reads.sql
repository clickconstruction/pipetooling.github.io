SET lock_timeout = '3s';

-- The crew reads the row of a job they are on (punch list #355, v2.7375).
--
-- jobs_ledger opened to a field role three ways: a subcontractor on the job's team or schedule
-- (subcontractor_can_read_jobs_ledger_row), anyone through a clock session of their own on the job, and the office.
-- A helper, a superintendent or an estimator put on a job's crew therefore read no row of it until their first
-- clock-in there. Found 2026-11-15 on the crew's job window as the sample superintendent: the Plans section, whose
-- first read is the job's row, answered "Could not read the job", and the window fell back to the Dashboard's row,
-- which carries no customer, no status and no development. On prod that day 20 of the helpers' 58 crew rows on
-- working jobs, and 13 of the superintendents' 23, had no clock session behind them.
--
-- The predicate is helper_on_job (20261014220000), the one the plan parts' crew read (20261106234500) and the
-- checklist rules already ask: the team table, or a schedule block on the job this week or last. It is a SECURITY
-- DEFINER read with row security off of the team table and the blocks, never of jobs_ledger, so the policy does not
-- come back into itself. Read only: no write policy moves, and the restrictive fences (archived, primary scope)
-- still stand over it.

DROP POLICY IF EXISTS "Crew can read jobs ledger for team or schedule" ON public.jobs_ledger;
CREATE POLICY "Crew can read jobs ledger for team or schedule" ON public.jobs_ledger
  FOR SELECT TO authenticated
  USING (public.helper_on_job(id));

COMMENT ON POLICY "Crew can read jobs ledger for team or schedule" ON public.jobs_ledger IS
  'Punch list #355: a person on the job''s crew (helper_on_job: the team table, or a schedule block this week or last) reads the job''s row before their first clock-in there.';
