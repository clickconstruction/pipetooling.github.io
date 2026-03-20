-- get_archived_user_names: returns names of archived users for filtering.
-- SECURITY DEFINER so non-devs can call it (RLS blocks direct users select).
CREATE OR REPLACE FUNCTION public.get_archived_user_names()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(name) FROM users
  WHERE archived_at IS NOT NULL AND name IS NOT NULL AND trim(name) != '';
$$;
