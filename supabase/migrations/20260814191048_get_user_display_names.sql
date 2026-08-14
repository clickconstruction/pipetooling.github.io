SET lock_timeout = '3s';

-- v2.1652: id → display-name resolver for historical references. The users
-- SELECT policy hides archived rows from every non-dev viewer, so surfaces
-- that label old records by user id (Edit Job team chips, vehicle possession
-- history) rendered raw uuids for assistants once the person was archived
-- (Mario/Juan/Chelsea/Zack/Mike Z/Jesse on job 258's crew, 2026-08-14 owner
-- screenshot). SECURITY DEFINER, name-only payload (no email/phone), any
-- authenticated caller — names of past crew are not sensitive; contact info
-- stays behind the users policies.

CREATE OR REPLACE FUNCTION public.get_user_display_names(p_user_ids uuid[])
RETURNS TABLE (id uuid, name text, role text, archived boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name, u.role::text, (u.archived_at IS NOT NULL)
  FROM public.users u
  WHERE auth.uid() IS NOT NULL
    AND u.id = ANY(p_user_ids)
$$;

COMMENT ON FUNCTION public.get_user_display_names(uuid[]) IS
  'Resolve user ids to display names for labeling historical records (v2.1652) — includes archived users, name/role/archived only. Any authenticated caller.';

REVOKE ALL ON FUNCTION public.get_user_display_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_display_names(uuid[]) TO authenticated;
