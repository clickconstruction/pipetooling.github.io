-- Expose customer_id so Dashboard Ready to Bill can gate Invoice/Update without a second fetch.
-- DROP + CREATE: Postgres does not allow CREATE OR REPLACE when the function return row type changes.

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_status(text);

CREATE FUNCTION public.get_jobs_ledger_by_status(p_status text)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  payments_made numeric,
  google_drive_link text,
  job_plans_link text,
  created_at timestamptz,
  customer_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id,
         COALESCE(jl.hcp_number, '')::text,
         COALESCE(jl.job_name, '')::text,
         COALESCE(jl.job_address, '')::text,
         jl.revenue,
         jl.payments_made,
         jl.google_drive_link,
         jl.job_plans_link,
         jl.created_at,
         jl.customer_id
  FROM public.jobs_ledger jl
  WHERE jl.status = p_status
  ORDER BY jl.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_jobs_ledger_by_status(text) IS 'Fetch jobs by status. Bypasses RLS for Dashboard. Includes customer_id for billing gates.';
