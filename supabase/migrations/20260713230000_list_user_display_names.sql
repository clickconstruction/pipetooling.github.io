-- Dispatch showed "Unknown" for many people when viewed by non-dev roles:
-- the users SELECT policy hides archived rows from everyone but devs and
-- hides master_technician/dev rows from (e.g.) assistants, so name lookups
-- for schedule-block assignees and job team members came back empty.
--
-- Narrow SECURITY DEFINER lookup: display name + archived flag only, for
-- explicit ids, any authenticated caller. No emails/roles/pay — coworker
-- display names are not sensitive inside the org tool.

CREATE OR REPLACE FUNCTION public.list_user_display_names(p_user_ids uuid[])
RETURNS TABLE(id uuid, name text, archived_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_user_display_names: not authenticated';
  END IF;
  RETURN QUERY
    SELECT u.id, u.name, u.archived_at
    FROM public.users u
    WHERE u.id = ANY(p_user_ids);
END;
$$;

COMMENT ON FUNCTION public.list_user_display_names(uuid[]) IS
  'Display name + archived_at for explicit user ids, bypassing the users SELECT policy (names only; no email/role/pay). Any authenticated user; used by Schedule dispatch name resolution.';

GRANT EXECUTE ON FUNCTION public.list_user_display_names(uuid[]) TO authenticated;
