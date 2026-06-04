-- Add address to search_jobs_for_reports for Add Inspection and New Report job search
DROP FUNCTION IF EXISTS public.search_jobs_for_reports(text);

CREATE OR REPLACE FUNCTION public.search_jobs_for_reports(search_text TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  source TEXT,
  display_name TEXT,
  hcp_number TEXT,
  address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sub.id, sub.source, sub.display_name, sub.hcp_number, sub.address
  FROM (
    (SELECT jl.id, 'job_ledger'::TEXT AS source, jl.job_name AS display_name, COALESCE(jl.hcp_number, '')::TEXT AS hcp_number, COALESCE(jl.job_address, '')::TEXT AS address
     FROM public.jobs_ledger jl
     WHERE (search_text IS NULL OR search_text = '' OR jl.hcp_number ILIKE '%' || search_text || '%' OR jl.job_name ILIKE '%' || search_text || '%' OR jl.job_address ILIKE '%' || search_text || '%')
     LIMIT 25)
    UNION ALL
    (SELECT p.id, 'project'::TEXT, p.name, COALESCE(p.housecallpro_number, '')::TEXT, COALESCE(p.address, '')::TEXT
     FROM public.projects p
     WHERE (search_text IS NULL OR search_text = '' OR COALESCE(p.housecallpro_number, '') ILIKE '%' || search_text || '%' OR p.name ILIKE '%' || search_text || '%' OR COALESCE(p.address, '') ILIKE '%' || search_text || '%')
     LIMIT 25)
  ) sub
  ORDER BY (CASE WHEN sub.hcp_number = '' THEN 1 ELSE 0 END), sub.hcp_number DESC
$$;;
