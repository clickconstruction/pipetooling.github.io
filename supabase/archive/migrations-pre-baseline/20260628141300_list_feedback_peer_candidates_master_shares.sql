-- Add people from master_shares (shared rosters) so peer picker matches visibility of shared subs/crew.

CREATE OR REPLACE FUNCTION public.list_feedback_peer_candidates()
RETURNS TABLE (person_id UUID, peer_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  r TEXT;
  mid UUID;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT u.role INTO r FROM public.users u WHERE u.id = uid;
  IF r IS NULL THEN RETURN; END IF;

  IF r IN ('master_technician', 'dev') THEN
    mid := uid;
  ELSIF r = 'assistant' THEN
    SELECT ma.master_id INTO mid FROM public.master_assistants ma WHERE ma.assistant_id = uid LIMIT 1;
  ELSIF r = 'superintendent' THEN
    SELECT ms.master_id INTO mid FROM public.master_superintendents ms WHERE ms.superintendent_id = uid LIMIT 1;
  ELSE
    SELECT p.master_user_id INTO mid
    FROM public.users u
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE u.id = uid
    LIMIT 1;
  END IF;

  IF mid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT DISTINCT y.person_id, y.peer_name
  FROM (
    SELECT p.id AS person_id, p.name::text AS peer_name
    FROM public.people p
    WHERE p.master_user_id = mid
      AND p.archived_at IS NULL

    UNION

    SELECT p.id AS person_id, p.name::text AS peer_name
    FROM public.master_assistants ma
    INNER JOIN public.users u ON u.id = ma.assistant_id
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE ma.master_id = mid

    UNION

    SELECT p.id AS person_id, p.name::text AS peer_name
    FROM public.master_superintendents ms
    INNER JOIN public.users u ON u.id = ms.superintendent_id
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE ms.master_id = mid

    UNION

    SELECT p.id AS person_id, p.name::text AS peer_name
    FROM public.master_primaries mp
    INNER JOIN public.users u ON u.id = mp.primary_id
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE mp.master_id = mid

    UNION

    SELECT p.id AS person_id, p.name::text AS peer_name
    FROM public.master_shares ms
    INNER JOIN public.people p ON p.master_user_id = ms.sharing_master_id
      AND p.archived_at IS NULL
    WHERE ms.viewing_master_id = mid
  ) y
  ORDER BY y.peer_name
  LIMIT 5000;
END;
$$;

COMMENT ON FUNCTION public.list_feedback_peer_candidates() IS
  'People for peer feedback: master roster, team links (email), shared master_shares rosters, capped at 5000.';
