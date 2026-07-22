-- Team member tenure (v2.951): "time at company" for the Prospects → Team →
-- Review Reflect cards. Preferred source is the roster employment field
-- (people.start_date), resolved account link first (people.account_user_id),
-- then the legacy trimmed-name match; falls back to the user's earliest
-- approved clock-session work_date when no roster row carries a start date.
-- Zero rows (not an error) without prospects access, per the v2.914 pattern.

CREATE OR REPLACE FUNCTION public.list_team_member_start_dates()
RETURNS TABLE (user_id uuid, started_on date, source text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    COALESCE(ps.start_date, cs.first_work_date) AS started_on,
    CASE WHEN ps.start_date IS NOT NULL THEN 'roster' ELSE 'first_clock_session' END AS source
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT p.start_date
    FROM public.people p
    WHERE p.archived_at IS NULL
      AND p.start_date IS NOT NULL
      AND (
        p.account_user_id = u.id
        OR (p.account_user_id IS NULL AND lower(trim(p.name)) = lower(trim(COALESCE(u.name, ''))))
      )
    ORDER BY (p.account_user_id = u.id) DESC, p.start_date ASC
    LIMIT 1
  ) ps ON true
  LEFT JOIN LATERAL (
    SELECT MIN(c.work_date) AS first_work_date
    FROM public.clock_sessions c
    WHERE c.user_id = u.id AND c.approved_at IS NOT NULL
  ) cs ON true
  WHERE u.archived_at IS NULL
    AND COALESCE(ps.start_date, cs.first_work_date) IS NOT NULL
    AND public.user_has_prospects_staff_access()
$$;

COMMENT ON FUNCTION public.list_team_member_start_dates() IS 'Reflect-card tenure (v2.951): per active user, people.start_date (account link first, then trimmed-name match) or earliest approved clock-session date. Empty without prospects staff access.';

REVOKE ALL ON FUNCTION public.list_team_member_start_dates() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_team_member_start_dates() TO authenticated;
