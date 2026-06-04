-- Fetch project details by IDs. SECURITY DEFINER bypasses projects RLS.
-- Used for AddInspectionModal/NewReportModal when user selects a project (e.g. estimators).

CREATE OR REPLACE FUNCTION public.get_projects_by_ids(p_ids uuid[])
RETURNS TABLE (id uuid, name text, address text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, COALESCE(p.name, '')::text, COALESCE(p.address, '')::text
  FROM public.projects p
  WHERE p.id = ANY(p_ids);
$$;
COMMENT ON FUNCTION public.get_projects_by_ids(uuid[]) IS 'Fetch project details by IDs. Bypasses RLS for report/inspection modals.';
