SET lock_timeout = '3s';

-- v2.2342: Settings → Usage (dev-only readout of the CX measurement plan).
-- Three SECURITY DEFINER aggregate readers so the client never needs broad
-- SELECT on the underlying ledgers; each gates on is_dev() itself. Aggregate
-- shapes validated read-only against prod before this migration was written.

CREATE OR REPLACE FUNCTION public.usage_page_minutes(p_days integer DEFAULT 30)
RETURNS TABLE (role text, page text, minutes integer, people integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'usage_page_minutes: dev only';
  END IF;
  RETURN QUERY
  SELECT u.role::text, a.page::text,
         (sum(a.active_seconds) / 60)::int,
         count(DISTINCT a.user_id)::int
  FROM public.user_app_activity_page_daily a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.activity_date >= current_date - LEAST(GREATEST(COALESCE(p_days, 30), 1), 365)
  GROUP BY u.role, a.page;
END;
$$;

CREATE OR REPLACE FUNCTION public.usage_nav_clicks(p_days integer DEFAULT 30)
RETURNS TABLE (role text, control text, target text, clicks integer, people integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'usage_nav_clicks: dev only';
  END IF;
  RETURN QUERY
  SELECT c.role::text, c.control::text, c.target::text,
         count(*)::int, count(DISTINCT c.user_id)::int
  FROM public.ui_nav_clicks c
  WHERE c.occurred_at >= now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365))
  GROUP BY c.role, c.control, c.target;
END;
$$;

-- Both customer-side series in one call: portal loads (public_page_views)
-- and estimate opens (estimate_customer_events.public_link_view), bucketed
-- by week.
CREATE OR REPLACE FUNCTION public.usage_customer_views(p_days integer DEFAULT 30)
RETURNS TABLE (surface text, bucket date, views integer, entities integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'usage_customer_views: dev only';
  END IF;
  RETURN QUERY
  SELECT 'portal'::text, date_trunc('week', v.occurred_at)::date,
         count(*)::int, count(DISTINCT v.entity_id)::int
  FROM public.public_page_views v
  WHERE v.surface = 'portal' AND v.occurred_at >= now() - make_interval(days => v_days)
  GROUP BY 2
  UNION ALL
  SELECT 'estimate_accept'::text, date_trunc('week', e.occurred_at)::date,
         count(*)::int, count(DISTINCT e.estimate_id)::int
  FROM public.estimate_customer_events e
  WHERE e.event_type = 'public_link_view' AND e.occurred_at >= now() - make_interval(days => v_days)
  GROUP BY 2;
END;
$$;

-- Per-user drill-down (owner request): one row per user × page so the client
-- can render role → person → their top pages without further round-trips.
CREATE OR REPLACE FUNCTION public.usage_user_minutes(p_days integer DEFAULT 30)
RETURNS TABLE (user_name text, role text, page text, minutes integer, active_days integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'usage_user_minutes: dev only';
  END IF;
  RETURN QUERY
  SELECT COALESCE(NULLIF(trim(u.name), ''), u.email)::text, u.role::text, a.page::text,
         (sum(a.active_seconds) / 60)::int,
         count(DISTINCT a.activity_date)::int
  FROM public.user_app_activity_page_daily a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.activity_date >= current_date - LEAST(GREATEST(COALESCE(p_days, 30), 1), 365)
  GROUP BY u.id, u.name, u.email, u.role, a.page;
END;
$$;

REVOKE ALL ON FUNCTION public.usage_user_minutes(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.usage_user_minutes(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.usage_page_minutes(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.usage_nav_clicks(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.usage_customer_views(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.usage_page_minutes(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_nav_clicks(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_customer_views(integer) TO authenticated;
