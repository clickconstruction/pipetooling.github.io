-- People for Banking attribution, WITH `kind`, so the attribution picker can tag each
-- option (e.g. "Joe · Sub") and surface External Subcontractors (people.kind = 'sub').
-- Mirrors list_people_for_banking_attribution but adds the kind column.
-- SECURITY DEFINER to bypass master-scoped `people` RLS; restricted to dev/master/assistant.

CREATE OR REPLACE FUNCTION public.list_people_with_kind_for_banking_attribution()
RETURNS TABLE (id uuid, name text, kind text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, p.kind
  FROM public.people p
  WHERE p.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ORDER BY p.name;
$$;

COMMENT ON FUNCTION public.list_people_with_kind_for_banking_attribution() IS
  'Non-archived people (id, name, kind) for Mercury attribution pickers (dev/master/assistant). SECURITY DEFINER to bypass master-scoped people RLS.';

REVOKE ALL ON FUNCTION public.list_people_with_kind_for_banking_attribution() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_people_with_kind_for_banking_attribution() TO authenticated;
