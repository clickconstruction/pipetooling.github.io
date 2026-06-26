-- Global "next job number" suggestion: highest numeric HCP-or-Click number across
-- ALL jobs, +1. Used to pre-fill the C# field on a New Job so every job gets its
-- own company-wide-unique number. Mirrors next_numeric_hcp_suggestion_for_master
-- but global + both columns; SECURITY DEFINER so it sees all jobs past RLS.
-- Only purely-numeric values count; empty -> '1'. It's a suggestion (editable),
-- not an enforced unique constraint.

CREATE OR REPLACE FUNCTION public.next_job_number_suggestion()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (COALESCE(MAX(n), 0) + 1)::text
  FROM (
    SELECT CAST(trim(jl.hcp_number) AS bigint) AS n
    FROM public.jobs_ledger jl
    WHERE trim(COALESCE(jl.hcp_number, '')) ~ '^[0-9]+$'
    UNION ALL
    SELECT CAST(trim(jl.click_number) AS bigint) AS n
    FROM public.jobs_ledger jl
    WHERE trim(COALESCE(jl.click_number, '')) ~ '^[0-9]+$'
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.next_job_number_suggestion() TO anon, authenticated, service_role;
