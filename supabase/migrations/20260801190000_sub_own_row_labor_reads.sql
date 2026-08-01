SET lock_timeout = '3s';

-- RUN_SUBS_PLAN Phase 3, PR 3.1: subs can read their OWN sub sheets.
--
-- The three people_labor_* tables had no subcontractor policies at all — a
-- sub could not see their own balance or payment history (hence the "what am
-- I owed?" phone calls). These are additive SELECT-only policies: office
-- policies are untouched, and subs still cannot write anything.
--
-- Identity is junction-first (people_labor_job_assignees × the sub's
-- people.account_user_id link, maintained by the sync trigger), with the
-- legacy trimmed-name segment match as fallback — the dual-path precedent
-- from the people_pay_config self-read policy. auth.uid() is wrapped in a
-- subselect for InitPlan-once evaluation per house convention.

DROP POLICY IF EXISTS "Subs can read own labor jobs" ON public.people_labor_jobs;
CREATE POLICY "Subs can read own labor jobs" ON public.people_labor_jobs FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.people_labor_job_assignees a
    JOIN public.people p ON p.id = a.person_id
    WHERE a.labor_job_id = people_labor_jobs.id
      AND p.account_user_id = (SELECT auth.uid())
  )
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

-- Children follow the parent: if the caller can read the labor job under ANY
-- of its policies (office or the new sub policy), they can read its rows —
-- the plja_select pattern from 20260722270000.
DROP POLICY IF EXISTS "Subs can read own labor job items" ON public.people_labor_job_items;
CREATE POLICY "Subs can read own labor job items" ON public.people_labor_job_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.people_labor_jobs j WHERE j.id = people_labor_job_items.job_id)
);

DROP POLICY IF EXISTS "Subs can read own labor job payments" ON public.people_labor_job_payments;
CREATE POLICY "Subs can read own labor job payments" ON public.people_labor_job_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.people_labor_jobs j WHERE j.id = people_labor_job_payments.job_id)
);
