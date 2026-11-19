SET lock_timeout = '3s';

-- A primary reads the test papers of their own jobs (punch list #400, PR 4 of 5; to-dos/primary-job-doors.md).
-- job_test_reports was made on 2026-09-11 (20260911175738), after the primary_scope_* fences of 20260823172141, and
-- took the jobs_ledger_fixtures job predicate without the restrictive policy that sits on top of it there. Its one
-- predicate, can_reach_job_for_test_report(job), runs as the owner and says yes to any primary, so a primary on no
-- job read every job's test paper and, through the bucket's read policy, its PDF. Proven on a whole-schema bed.
--
-- The function below is its live definition (pg_get_functiondef on a bed that holds every migration on main at
-- aa0e5ff7f) with ONE change: the primary leg takes `AND public.primary_can_access_job(j.id)`, the rule every other
-- job child table asks (the job names them as account manager). It is the job check of the table's four policies
-- and of the job-test-reports bucket's read policy, so each follows with no policy rewritten. A primary only ever
-- read here: the write policies never named the role. Dev, master and the assistant-like roles are untouched.
-- CREATE OR REPLACE keeps the function's grants and owner. Idempotent.

-- ---------- can_reach_job_for_test_report(uuid): the primary leg, held to the jobs they account-manage ----------

CREATE OR REPLACE FUNCTION public.can_reach_job_for_test_report(p_job_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs_ledger j
    WHERE j.id = p_job_id
      AND (
        j.master_user_id = (SELECT auth.uid())
        OR public.is_dev()
        OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary') AND public.primary_can_access_job(j.id))
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = (SELECT auth.uid()) AND ma.assistant_id = j.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = j.master_user_id AND ma.assistant_id = (SELECT auth.uid()))
        OR public.assistants_share_master((SELECT auth.uid()), j.master_user_id)
      )
  );
$function$;

