-- Per-page app-activity dimension for the People → Activity drilldown.
-- New user_app_activity_page_daily (UTC day × page-key aggregates) mirrors
-- user_app_activity_daily's access model (own rows / dev / granted viewers; writes only via
-- the SECURITY DEFINER bump RPC). bump_user_app_activity is recreated with an added
-- p_page text DEFAULT NULL parameter — already-deployed clients calling with only p_seconds
-- keep working, so this is safe to apply ahead of the client. Body is verbatim from prod
-- (md5(prosrc) verified) apart from the page-dimension insert.

CREATE TABLE IF NOT EXISTS public.user_app_activity_page_daily (
  user_id uuid NOT NULL,
  activity_date date NOT NULL,
  page text NOT NULL,
  active_seconds integer DEFAULT 0 NOT NULL,
  CONSTRAINT user_app_activity_page_daily_pkey PRIMARY KEY (user_id, activity_date, page),
  CONSTRAINT user_app_activity_page_daily_active_seconds_check CHECK ((active_seconds >= 0) AND (active_seconds <= 86400))
);

COMMENT ON TABLE public.user_app_activity_page_daily IS
  'App-activity heartbeat time split by page key (e.g. bids:pricing) per user per UTC day. Writes only via bump_user_app_activity.';

ALTER TABLE public.user_app_activity_page_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_app_activity_page_daily_select_own_dev_or_viewer"
  ON public.user_app_activity_page_daily FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_dev() OR (EXISTS ( SELECT 1
    FROM public.user_app_activity_viewers v
    WHERE (v.viewer_user_id = ( SELECT auth.uid() AS uid)))));

-- Signature change (added parameter) requires drop + recreate; grants are re-applied below.
DROP FUNCTION IF EXISTS public.bump_user_app_activity(integer);

CREATE OR REPLACE FUNCTION public.bump_user_app_activity(p_seconds integer DEFAULT 60, p_page text DEFAULT NULL) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid;
  v_sec integer;
  v_date date;
  v_page text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_sec := LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 300);
  v_date := (timezone('UTC', now()))::date;

  INSERT INTO public.user_app_activity_daily (user_id, activity_date, first_seen_at, last_seen_at, active_seconds)
  VALUES (v_uid, v_date, now(), now(), LEAST(v_sec, 86400))
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    active_seconds = LEAST(user_app_activity_daily.active_seconds + EXCLUDED.active_seconds, 86400),
    first_seen_at = COALESCE(user_app_activity_daily.first_seen_at, EXCLUDED.first_seen_at),
    last_seen_at = now();

  -- Page dimension: time-only (a zero-second "seen" ping updates last_seen above but adds no page row).
  v_page := NULLIF(LEFT(TRIM(COALESCE(p_page, '')), 80), '');
  IF v_page IS NOT NULL AND v_sec > 0 THEN
    INSERT INTO public.user_app_activity_page_daily (user_id, activity_date, page, active_seconds)
    VALUES (v_uid, v_date, v_page, LEAST(v_sec, 86400))
    ON CONFLICT (user_id, activity_date, page) DO UPDATE SET
      active_seconds = LEAST(user_app_activity_page_daily.active_seconds + EXCLUDED.active_seconds, 86400);
  END IF;
END;
$$;

ALTER FUNCTION public.bump_user_app_activity(p_seconds integer, p_page text) OWNER TO postgres;

COMMENT ON FUNCTION public.bump_user_app_activity(p_seconds integer, p_page text) IS
  'Heartbeat: adds active seconds to user_app_activity_daily (and per-page to user_app_activity_page_daily when p_page is set) for the calling user''s UTC day; p_seconds clamped to [0,300]. p_seconds=0 updates last_seen only.';

REVOKE ALL ON FUNCTION public.bump_user_app_activity(p_seconds integer, p_page text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.bump_user_app_activity(p_seconds integer, p_page text) TO anon;
GRANT ALL ON FUNCTION public.bump_user_app_activity(p_seconds integer, p_page text) TO authenticated;
GRANT ALL ON FUNCTION public.bump_user_app_activity(p_seconds integer, p_page text) TO service_role;
