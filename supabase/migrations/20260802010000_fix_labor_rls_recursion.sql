SET lock_timeout = '3s';

-- HOTFIX: 20260801190000's sub own-row policy on people_labor_jobs queried
-- people_labor_job_assignees, whose OWN select policy (plja_select, from
-- 20260722270000) queries people_labor_jobs back — infinite recursion
-- (42P17), which broke EVERY read of the Sub Labor ledger for everyone
-- (Jobs → Sub Labor, Job Detail sub cost, Dashboard AP figure, People →
-- Subs) from the 3.1 push until this fix. Caught by the Phase 4 e2e run.
--
-- The house pattern for exactly this: a SECURITY DEFINER helper evaluates
-- the junction WITHOUT invoking RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION public.user_is_assignee_of_labor_job(p_labor_job_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.people_labor_job_assignees a
    JOIN public.people p ON p.id = a.person_id
    WHERE a.labor_job_id = p_labor_job_id
      AND p.account_user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_is_assignee_of_labor_job(uuid) IS
  'RLS helper: is the caller the account-linked assignee of this sub sheet? SECURITY DEFINER to avoid the people_labor_jobs <-> people_labor_job_assignees policy recursion.';

GRANT ALL ON FUNCTION public.user_is_assignee_of_labor_job(uuid) TO anon;
GRANT ALL ON FUNCTION public.user_is_assignee_of_labor_job(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_is_assignee_of_labor_job(uuid) TO service_role;

DROP POLICY IF EXISTS "Subs can read own labor jobs" ON public.people_labor_jobs;
CREATE POLICY "Subs can read own labor jobs" ON public.people_labor_jobs FOR SELECT USING (
  public.user_is_assignee_of_labor_job(id)
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.name IS NOT NULL
      AND btrim(u.name) IN (
        SELECT btrim(seg)
        FROM unnest(string_to_array(COALESCE(people_labor_jobs.assigned_to_name, ''), ' | ')) AS seg
      )
  )
);
