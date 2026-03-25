-- First-party app activity: daily UTC aggregates (60s heartbeats via bump_user_app_activity).

CREATE TABLE public.user_app_activity_daily (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  active_seconds integer NOT NULL DEFAULT 0 CHECK (active_seconds >= 0 AND active_seconds <= 86400),
  PRIMARY KEY (user_id, activity_date)
);

COMMENT ON COLUMN public.user_app_activity_daily.activity_date IS
  'UTC calendar date for aggregation; always use (timezone(''UTC'', now()))::date when writing.';

CREATE INDEX idx_user_app_activity_daily_activity_date ON public.user_app_activity_daily (activity_date DESC);

ALTER TABLE public.user_app_activity_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_app_activity_daily_select_own_or_dev"
  ON public.user_app_activity_daily
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_dev());

REVOKE ALL ON TABLE public.user_app_activity_daily FROM PUBLIC;
GRANT SELECT ON TABLE public.user_app_activity_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_user_app_activity(p_seconds integer DEFAULT 60)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_sec integer;
  v_date date;
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
END;
$$;

REVOKE ALL ON FUNCTION public.bump_user_app_activity(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_user_app_activity(integer) TO authenticated;
