-- Superintendent reports policies used EXISTS over jobs_ledger inside policy expressions.
-- Those subqueries run as the invoking role and respect jobs_ledger RLS; after narrowing
-- superintendent jobs_ledger SELECT, the EXISTS returned false for WITH CHECK on INSERT.
-- Evaluate job-anchor eligibility in SECURITY DEFINER helpers so access logic matches
-- prior intent (project-linked job + can_access_project_row) without jobs_ledger RLS hiding rows.

CREATE OR REPLACE FUNCTION public.superintendent_report_job_anchor_allowed(p_job_ledger_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_ledger_id
      AND jl.project_id IS NOT NULL
      AND public.can_access_project_row(jl.project_id)
  );
$$;

COMMENT ON FUNCTION public.superintendent_report_job_anchor_allowed(uuid) IS
  'reports RLS: superintendent job-anchor branch; reads jobs_ledger without invoker RLS blocking EXISTS.';

GRANT EXECUTE ON FUNCTION public.superintendent_report_job_anchor_allowed(uuid) TO authenticated;

DROP POLICY IF EXISTS "Superintendent can do all on reports (assigned projects)" ON public.reports;
CREATE POLICY "Superintendent can do all on reports (assigned projects)"
ON public.reports
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(job_ledger_id))
    OR
    (bid_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bids b
      WHERE b.id = bid_id
        AND public.superintendent_can_access_bid(b)
    ))
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(job_ledger_id))
    OR
    (bid_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bids b
      WHERE b.id = bid_id
        AND public.superintendent_can_access_bid(b)
    ))
  )
);
