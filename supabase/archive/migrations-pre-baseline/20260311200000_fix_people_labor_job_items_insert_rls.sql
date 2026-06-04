-- Fix people_labor_job_items INSERT/UPDATE/DELETE RLS: allow anyone who can see the job to modify items.
-- Previously INSERT required j.master_user_id = auth.uid(), blocking assistants from adding items to
-- jobs created by their master, and devs from adding items to any job.

-- Shared subquery: job is visible to current user (matches people_labor_job_items SELECT policy)
CREATE OR REPLACE FUNCTION public.can_modify_people_labor_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = p_job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = j.master_user_id
        AND viewing_master_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        JOIN public.master_shares ms ON ms.viewing_master_id = ma.master_id
        WHERE ma.assistant_id = auth.uid()
        AND ms.sharing_master_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = auth.uid()
        AND assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma_me
        WHERE ma_me.assistant_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.master_assistants ma_other
          WHERE ma_other.master_id = ma_me.master_id
          AND ma_other.assistant_id = j.master_user_id
        )
      )
    )
  );
$$;
COMMENT ON FUNCTION public.can_modify_people_labor_job(UUID) IS 'Returns true if current user can modify items for this labor job (same visibility as SELECT). Uses SECURITY DEFINER to avoid RLS recursion.';

-- ============================================================================
-- people_labor_job_items: Update INSERT policy
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert people labor job items" ON public.people_labor_job_items;
CREATE POLICY "Devs, masters, assistants, and estimators can insert people labor job items"
ON public.people_labor_job_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_modify_people_labor_job(people_labor_job_items.job_id)
);

-- ============================================================================
-- people_labor_job_items: Update UPDATE policy
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update people labor job items" ON public.people_labor_job_items;
CREATE POLICY "Devs, masters, assistants, and estimators can update people labor job items"
ON public.people_labor_job_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_modify_people_labor_job(people_labor_job_items.job_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- ============================================================================
-- people_labor_job_items: Update DELETE policy
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete people labor job items" ON public.people_labor_job_items;
CREATE POLICY "Devs, masters, assistants, and estimators can delete people labor job items"
ON public.people_labor_job_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_modify_people_labor_job(people_labor_job_items.job_id)
);
