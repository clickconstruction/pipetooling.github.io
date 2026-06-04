-- Add pct_complete to jobs_ledger RPCs for People Review Value Created.
-- Null pct_complete treated as 100% in frontend.

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_ids(uuid[]);

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_ids(p_job_ids uuid[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  pct_complete integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id, COALESCE(jl.hcp_number, '')::text, COALESCE(jl.job_name, '')::text, COALESCE(jl.job_address, '')::text, jl.revenue, jl.pct_complete
  FROM public.jobs_ledger jl
  WHERE jl.id = ANY(p_job_ids);
$$;

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_hcp_numbers(text[]);

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_hcp_numbers(p_hcp_numbers text[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  pct_complete integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id, COALESCE(jl.hcp_number, '')::text, COALESCE(jl.job_name, '')::text, COALESCE(jl.job_address, '')::text, jl.revenue, jl.pct_complete
  FROM public.jobs_ledger jl
  WHERE LOWER(TRIM(COALESCE(jl.hcp_number, ''))) = ANY(
    SELECT LOWER(TRIM(COALESCE(x, ''))) FROM unnest(p_hcp_numbers) AS x
  );
$$;

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_ids_paid_only(uuid[]);

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_ids_paid_only(p_job_ids uuid[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  pct_complete integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id, COALESCE(jl.hcp_number, '')::text, COALESCE(jl.job_name, '')::text, COALESCE(jl.job_address, '')::text, jl.revenue, jl.pct_complete
  FROM public.jobs_ledger jl
  WHERE jl.id = ANY(p_job_ids)
    AND jl.status = 'paid';
$$;

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_hcp_numbers_paid_only(text[]);

CREATE OR REPLACE FUNCTION public.get_jobs_ledger_by_hcp_numbers_paid_only(p_hcp_numbers text[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  pct_complete integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jl.id, COALESCE(jl.hcp_number, '')::text, COALESCE(jl.job_name, '')::text, COALESCE(jl.job_address, '')::text, jl.revenue, jl.pct_complete
  FROM public.jobs_ledger jl
  WHERE jl.status = 'paid'
    AND LOWER(TRIM(COALESCE(jl.hcp_number, ''))) = ANY(
      SELECT LOWER(TRIM(COALESCE(x, ''))) FROM unnest(p_hcp_numbers) AS x
    );
$$;
