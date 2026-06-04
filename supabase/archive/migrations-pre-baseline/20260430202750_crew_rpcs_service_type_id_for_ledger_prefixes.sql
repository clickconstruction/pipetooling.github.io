-- Add service_type_id to job/bid detail RPCs for trade-specific ledger prefixes (JP/BP, etc.).

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_ids(uuid[]);

CREATE FUNCTION public.get_jobs_ledger_by_ids(p_job_ids uuid[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  service_type_id uuid
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
         jl.service_type_id
  FROM public.jobs_ledger jl
  WHERE jl.id = ANY(p_job_ids);
$$;

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_ids_paid_only(uuid[]);

CREATE FUNCTION public.get_jobs_ledger_by_ids_paid_only(p_job_ids uuid[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  service_type_id uuid
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
         jl.service_type_id
  FROM public.jobs_ledger jl
  WHERE jl.id = ANY(p_job_ids)
    AND jl.status = 'paid';
$$;

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_hcp_numbers(text[]);

CREATE FUNCTION public.get_jobs_ledger_by_hcp_numbers(p_hcp_numbers text[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  service_type_id uuid
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
         jl.service_type_id
  FROM public.jobs_ledger jl
  WHERE LOWER(TRIM(COALESCE(jl.hcp_number, ''))) = ANY(
    SELECT LOWER(TRIM(COALESCE(x, ''))) FROM unnest(p_hcp_numbers) AS x
  );
$$;

DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_hcp_numbers_paid_only(text[]);

CREATE FUNCTION public.get_jobs_ledger_by_hcp_numbers_paid_only(p_hcp_numbers text[])
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text,
  revenue numeric,
  service_type_id uuid
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
         jl.service_type_id
  FROM public.jobs_ledger jl
  WHERE jl.status = 'paid'
    AND LOWER(TRIM(COALESCE(jl.hcp_number, ''))) = ANY(
      SELECT LOWER(TRIM(COALESCE(x, ''))) FROM unnest(p_hcp_numbers) AS x
    );
$$;

DROP FUNCTION IF EXISTS public.get_bids_by_ids(uuid[]);

CREATE FUNCTION public.get_bids_by_ids(p_bid_ids uuid[])
RETURNS TABLE (
  id uuid,
  bid_number text,
  project_name text,
  address text,
  service_type_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id,
         COALESCE(b.bid_number, '')::text,
         COALESCE(b.project_name, '')::text,
         COALESCE(b.address, '')::text,
         b.service_type_id
  FROM public.bids b
  WHERE b.id = ANY(p_bid_ids);
$$;
