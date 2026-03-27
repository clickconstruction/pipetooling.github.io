-- Final authoritative definition: peers sharing at least one label_id with the reviewer only.
-- Supersedes roster/dev-resolution implementations of list_feedback_peer_candidates from
-- 20260628141000 through 20260628141700 for databases that applied those migrations.

-- Team Feedback peers: only users/people who share at least one label_id with the reviewer
-- (reviewer via user_labels; peers via user_labels or people_labels). No master/roster union.

DROP FUNCTION IF EXISTS public.list_feedback_peer_candidates();

CREATE OR REPLACE FUNCTION public.list_feedback_peer_candidates()
RETURNS TABLE (
  person_id UUID,
  peer_user_id UUID,
  peer_name TEXT,
  shared_tag_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH reviewer_labels AS (
    SELECT DISTINCT ul.label_id
    FROM public.user_labels ul
    WHERE ul.user_id = uid
  ),
  user_peers AS (
    SELECT
      NULL::uuid AS person_id,
      u.id AS peer_user_id,
      COALESCE(NULLIF(trim(u.name), ''), u.email::text) AS peer_name,
      (
        SELECT COUNT(*)::int
        FROM public.user_labels ul2
        INNER JOIN reviewer_labels rl ON rl.label_id = ul2.label_id
        WHERE ul2.user_id = u.id
      ) AS shared_tag_count
    FROM public.users u
    WHERE u.archived_at IS NULL
      AND u.id <> uid
      AND EXISTS (
        SELECT 1
        FROM public.user_labels ul
        INNER JOIN reviewer_labels rl ON rl.label_id = ul.label_id
        WHERE ul.user_id = u.id
      )
  ),
  people_peers AS (
    SELECT
      p.id AS person_id,
      NULL::uuid AS peer_user_id,
      p.name::text AS peer_name,
      (
        SELECT COUNT(*)::int
        FROM public.people_labels pl2
        INNER JOIN reviewer_labels rl ON rl.label_id = pl2.label_id
        WHERE pl2.person_id = p.id
      ) AS shared_tag_count
    FROM public.people p
    WHERE p.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = uid
          AND p.email IS NOT NULL
          AND trim(p.email) <> ''
          AND u.email IS NOT NULL
          AND trim(u.email) <> ''
          AND lower(trim(p.email)) = lower(trim(u.email))
      )
      AND EXISTS (
        SELECT 1
        FROM public.people_labels pl
        INNER JOIN reviewer_labels rl ON rl.label_id = pl.label_id
        WHERE pl.person_id = p.id
      )
  )
  SELECT combined.person_id, combined.peer_user_id, combined.peer_name, combined.shared_tag_count
  FROM (
    SELECT * FROM user_peers
    UNION ALL
    SELECT * FROM people_peers
  ) AS combined
  ORDER BY combined.shared_tag_count DESC, combined.peer_name ASC
  LIMIT 5000;
END;
$$;

COMMENT ON FUNCTION public.list_feedback_peer_candidates() IS
  'Team Feedback peer picker: users and people who share at least one label_id with the reviewer (reviewer labels from user_labels; peer match via user_labels or people_labels). Excludes self as user peer (id <> auth.uid()) and as people peer when people.email matches reviewer email. shared_tag_count is the intersection size. Empty when reviewer has no user_labels. Same human may appear twice (p: and u:) if both rows exist. SECURITY DEFINER; cap 5000.';

GRANT EXECUTE ON FUNCTION public.list_feedback_peer_candidates() TO authenticated;
