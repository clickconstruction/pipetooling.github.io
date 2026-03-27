-- Dev users preview Team Feedback from Settings; they are not usually master_user_id = auth.uid().
-- Resolve master from the dev's people row (email match) when present so the peer list matches the real org;
-- otherwise fall back to uid (same as before).

CREATE OR REPLACE FUNCTION public.list_feedback_peer_candidates()
RETURNS TABLE (
  person_id UUID,
  peer_user_id UUID,
  peer_name TEXT
)
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

  IF r = 'master_technician' THEN
    mid := uid;
  ELSIF r = 'assistant' THEN
    SELECT ma.master_id INTO mid FROM public.master_assistants ma WHERE ma.assistant_id = uid LIMIT 1;
  ELSIF r = 'superintendent' THEN
    SELECT ms.master_id INTO mid FROM public.master_superintendents ms WHERE ms.superintendent_id = uid LIMIT 1;
  ELSIF r = 'dev' THEN
    SELECT p.master_user_id INTO mid
    FROM public.users u
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE u.id = uid
    LIMIT 1;
    IF mid IS NULL THEN
      SELECT ma.master_id INTO mid FROM public.master_assistants ma WHERE ma.assistant_id = uid LIMIT 1;
    END IF;
    IF mid IS NULL THEN
      SELECT ms.master_id INTO mid FROM public.master_superintendents ms WHERE ms.superintendent_id = uid LIMIT 1;
    END IF;
    IF mid IS NULL THEN
      SELECT mp.master_id INTO mid FROM public.master_primaries mp WHERE mp.primary_id = uid LIMIT 1;
    END IF;
    IF mid IS NULL THEN
      mid := uid;
    END IF;
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
  SELECT DISTINCT z.person_id, z.peer_user_id, z.peer_name
  FROM (
    SELECT p.id AS person_id, NULL::uuid AS peer_user_id, p.name::text AS peer_name
    FROM public.people p
    WHERE p.master_user_id = mid
      AND p.archived_at IS NULL

    UNION

    SELECT p.id, NULL::uuid, p.name::text
    FROM public.master_assistants ma
    INNER JOIN public.users u ON u.id = ma.assistant_id
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE ma.master_id = mid

    UNION

    SELECT p.id, NULL::uuid, p.name::text
    FROM public.master_superintendents ms
    INNER JOIN public.users u ON u.id = ms.superintendent_id
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE ms.master_id = mid

    UNION

    SELECT p.id, NULL::uuid, p.name::text
    FROM public.master_primaries mp
    INNER JOIN public.users u ON u.id = mp.primary_id
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE mp.master_id = mid

    UNION

    SELECT p.id, NULL::uuid, p.name::text
    FROM public.master_shares ms
    INNER JOIN public.people p ON p.master_user_id = ms.sharing_master_id
      AND p.archived_at IS NULL
    WHERE ms.viewing_master_id = mid

    UNION

    SELECT NULL::uuid, u.id, COALESCE(NULLIF(trim(u.name), ''), u.email::text) AS peer_name
    FROM public.users u
    INNER JOIN (
      SELECT mid AS team_uid
      UNION
      SELECT assistant_id FROM public.master_assistants WHERE master_id = mid
      UNION
      SELECT superintendent_id FROM public.master_superintendents WHERE master_id = mid
      UNION
      SELECT primary_id FROM public.master_primaries WHERE master_id = mid
    ) team ON u.id = team.team_uid
    WHERE u.archived_at IS NULL
      AND u.id <> uid
      AND NOT EXISTS (
        SELECT 1
        FROM public.people p
        WHERE p.archived_at IS NULL
          AND p.email IS NOT NULL
          AND trim(p.email) <> ''
          AND lower(trim(p.email)) = lower(trim(u.email))
      )
  ) z
  ORDER BY z.peer_name
  LIMIT 5000;
END;
$$;

COMMENT ON FUNCTION public.list_feedback_peer_candidates() IS
  'Peer picker: people (roster, links, shares) plus user-only team members without a people row; capped at 5000. For dev role, master is resolved from people.email when possible so Settings preview matches the org roster.';
