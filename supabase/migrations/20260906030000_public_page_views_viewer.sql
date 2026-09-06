SET lock_timeout = '3s';

-- v2.2922: who looked at a public page — the outside (the sub, or whoever they
-- forwarded the link to) vs the team vs the office's own previews. Until now
-- only counted (outside) loads were written; office looks were dropped at the
-- door (journey-map #37). The sub-portal function now writes every validated
-- load with `viewer`, and two RPCs read the trail back for office viewers.
-- Additive + idempotent. NULL viewer = written before this migration under the
-- count rule, i.e. an outside open.

ALTER TABLE public.public_page_views ADD COLUMN IF NOT EXISTS viewer text;
ALTER TABLE public.public_page_views ADD COLUMN IF NOT EXISTS viewer_user_id uuid;
ALTER TABLE public.public_page_views DROP CONSTRAINT IF EXISTS public_page_views_viewer_check;
ALTER TABLE public.public_page_views
  ADD CONSTRAINT public_page_views_viewer_check
  CHECK (viewer IS NULL OR viewer IN ('outside', 'staff', 'preview'));
COMMENT ON COLUMN public.public_page_views.viewer IS
  'outside = counted open (no company session, no preview flag) · staff = a signed-in teammate opened the real link · preview = the office''s own openers (?preview=1). NULL = pre-v2.2922 row, always outside.';
COMMENT ON COLUMN public.public_page_views.viewer_user_id IS
  'users.id behind a staff look; NULL otherwise. No FK on purpose — a removed account must not erase the trail.';

CREATE INDEX IF NOT EXISTS public_page_views_surface_entity_occurred_idx
  ON public.public_page_views (surface, entity_id, occurred_at DESC);

-- Office readers of the sub-portal trail: the same set that may read sub_portal_links,
-- plus superintendents (they read Jobs → Sub Labor).
CREATE OR REPLACE FUNCTION public._sub_portal_visits_gate()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_dev()
      OR public.is_assistant()
      OR public.is_superintendent()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
         );
$$;
REVOKE ALL ON FUNCTION public._sub_portal_visits_gate() FROM public, anon;
GRANT EXECUTE ON FUNCTION public._sub_portal_visits_gate() TO authenticated, service_role;

-- Per person: outside opens (count, first, last) and the last team look (when, who).
CREATE OR REPLACE FUNCTION public.sub_portal_visit_summary(p_person_ids uuid[])
RETURNS TABLE (
  person_id uuid,
  outside_opens integer,
  first_outside_at timestamptz,
  last_outside_at timestamptz,
  staff_looks integer,
  last_staff_at timestamptz,
  last_staff_user_id uuid,
  last_staff_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (
    SELECT DISTINCT unnest(coalesce(p_person_ids, '{}'::uuid[])) AS pid
  ),
  o AS (
    SELECT v.entity_id, count(*)::int AS n, min(v.occurred_at) AS first_at, max(v.occurred_at) AS last_at
    FROM public.public_page_views v
    WHERE v.surface = 'sub_portal'
      AND v.entity_id = ANY (coalesce(p_person_ids, '{}'::uuid[]))
      AND (v.viewer IS NULL OR v.viewer = 'outside')
    GROUP BY v.entity_id
  ),
  sc AS (
    SELECT v.entity_id, count(*)::int AS n
    FROM public.public_page_views v
    WHERE v.surface = 'sub_portal'
      AND v.entity_id = ANY (coalesce(p_person_ids, '{}'::uuid[]))
      AND v.viewer = 'staff'
    GROUP BY v.entity_id
  ),
  s AS (
    SELECT DISTINCT ON (v.entity_id) v.entity_id, v.occurred_at, v.viewer_user_id
    FROM public.public_page_views v
    WHERE v.surface = 'sub_portal'
      AND v.entity_id = ANY (coalesce(p_person_ids, '{}'::uuid[]))
      AND v.viewer = 'staff'
    ORDER BY v.entity_id, v.occurred_at DESC
  )
  SELECT ids.pid,
         coalesce(o.n, 0),
         o.first_at,
         o.last_at,
         coalesce(sc.n, 0),
         s.occurred_at,
         s.viewer_user_id,
         u.name
  FROM ids
  LEFT JOIN o  ON o.entity_id  = ids.pid
  LEFT JOIN sc ON sc.entity_id = ids.pid
  LEFT JOIN s  ON s.entity_id  = ids.pid
  LEFT JOIN public.users u ON u.id = s.viewer_user_id
  WHERE public._sub_portal_visits_gate();
$$;
REVOKE ALL ON FUNCTION public.sub_portal_visit_summary(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sub_portal_visit_summary(uuid[]) TO authenticated, service_role;

-- The trail for one person, newest first. Previews are never on it.
CREATE OR REPLACE FUNCTION public.sub_portal_visits(p_person_id uuid, p_limit integer DEFAULT 200)
RETURNS TABLE (
  occurred_at timestamptz,
  viewer text,
  via text,
  staff_user_id uuid,
  staff_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.occurred_at,
         coalesce(v.viewer, 'outside'),
         v.via,
         v.viewer_user_id,
         u.name
  FROM public.public_page_views v
  LEFT JOIN public.users u ON u.id = v.viewer_user_id
  WHERE v.surface = 'sub_portal'
    AND v.entity_id = p_person_id
    AND coalesce(v.viewer, 'outside') <> 'preview'
    AND public._sub_portal_visits_gate()
  ORDER BY v.occurred_at DESC
  LIMIT least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
REVOKE ALL ON FUNCTION public.sub_portal_visits(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sub_portal_visits(uuid, integer) TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
