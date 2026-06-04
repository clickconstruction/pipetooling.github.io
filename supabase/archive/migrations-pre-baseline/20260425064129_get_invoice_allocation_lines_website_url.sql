-- Job Summary: include supply_houses.website_url on invoice allocation lines (Materials portal / Open website)
-- PostgreSQL cannot change OUT/RETURNS TABLE shape with CREATE OR REPLACE; drop first.
DROP FUNCTION IF EXISTS public.get_invoice_allocation_lines_for_jobs(uuid[]);

CREATE OR REPLACE FUNCTION public.get_invoice_allocation_lines_for_jobs(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid,
  invoice_id uuid,
  allocated_amount numeric,
  invoice_number text,
  invoice_date date,
  invoice_total_amount numeric,
  supply_house_name text,
  website_url text,
  pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    a.invoice_id,
    (i.amount * a.pct / 100)::numeric AS allocated_amount,
    i.invoice_number::text,
    i.invoice_date::date AS invoice_date,
    i.amount::numeric AS invoice_total_amount,
    COALESCE(sh.name, '')::text AS supply_house_name,
    sh.website_url::text AS website_url,
    a.pct
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN public.supply_houses sh ON sh.id = i.supply_house_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  ORDER BY a.job_id, i.invoice_date DESC NULLS LAST, i.invoice_number;
$$;

COMMENT ON FUNCTION public.get_invoice_allocation_lines_for_jobs(uuid[]) IS
  'Per-invoice lines allocated to jobs for Job Summary Parts Cost. Includes supply_houses.website_url. Visibility matches get_invoice_amounts_for_jobs.';

GRANT EXECUTE ON FUNCTION public.get_invoice_allocation_lines_for_jobs(uuid[]) TO authenticated;
