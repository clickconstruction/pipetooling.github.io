-- Full roster for Banking "Person" dropdown when RLS-scoped SELECT returns too few rows
-- (e.g. linked project missing the banking_staff SELECT policy). Same role gate as mercury attributions.

CREATE OR REPLACE FUNCTION public.list_people_for_banking_attribution()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name
  FROM public.people p
  WHERE p.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_people_for_banking_attribution() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_people_for_banking_attribution() TO authenticated;

COMMENT ON FUNCTION public.list_people_for_banking_attribution() IS
  'Returns all non-archived people for Mercury transaction person attribution (dev, master, assistant only). SECURITY DEFINER to bypass master-scoped people RLS.';
