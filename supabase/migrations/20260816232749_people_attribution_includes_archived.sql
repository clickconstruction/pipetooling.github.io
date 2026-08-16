SET lock_timeout = '3s';

-- Archived people in attribution pickers (v2.1728): the picker RPC previously
-- hid archived people entirely (`archived_at IS NULL`), which made departed
-- subs untaggable — and let the picker's new "Add …" action mint duplicates of
-- people who exist but are archived. Now every person returns with an
-- `archived` flag; clients list archived people last, tagged "archived".
--
-- The return type gains a column, so this must DROP + CREATE (CREATE OR
-- REPLACE cannot change OUT columns). Runs in one transaction — no window
-- where the function is missing. Old deployed clients simply ignore the extra
-- JSON field.

DROP FUNCTION IF EXISTS public.list_people_with_kind_for_banking_attribution();

CREATE FUNCTION public.list_people_with_kind_for_banking_attribution()
RETURNS TABLE("id" "uuid", "name" "text", "kind" "text", "archived" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.id, p.name, p.kind, (p.archived_at IS NOT NULL) AS archived
  FROM public.people p
  WHERE EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ORDER BY p.name;
$$;

ALTER FUNCTION public.list_people_with_kind_for_banking_attribution() OWNER TO postgres;

COMMENT ON FUNCTION public.list_people_with_kind_for_banking_attribution() IS
  'All people (id, name, kind, archived) for Mercury attribution pickers (dev/master/assistant) — archived included since v2.1728 so history stays taggable; clients de-emphasize them. SECURITY DEFINER to bypass master-scoped people RLS.';

REVOKE ALL ON FUNCTION public.list_people_with_kind_for_banking_attribution() FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_people_with_kind_for_banking_attribution() TO anon;
GRANT ALL ON FUNCTION public.list_people_with_kind_for_banking_attribution() TO authenticated;
GRANT ALL ON FUNCTION public.list_people_with_kind_for_banking_attribution() TO service_role;
