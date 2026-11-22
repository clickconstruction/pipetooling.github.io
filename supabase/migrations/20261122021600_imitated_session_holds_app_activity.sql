SET lock_timeout = '3s';

-- View as and Imitate (v2.8251): the app activity heartbeat refuses a session someone else opened as the person.
--
-- Imitate and View as (the login-as-user edge function) hand a dev a real magic-link session as another account. Its
-- JWT is the person's own, so bump_user_app_activity() saw the person and wrote their last seen time and their app
-- time from the dev's browser. v2.8176 stopped the client sending the heartbeat while View as is on; this is the same
-- rule on the server, so a browser still holding an older build, or any other client, cannot write it either.
--
--   * session_opened_by_imitation(): whether the calling session was opened by an imitation. GoTrue writes how a
--     session signed in into the token's amr claim, one entry per method with the time it was used, kept through
--     every refresh. login-as-user writes a user_imitations row before it makes the link (v2.6290), and the page
--     verifies that link at once. So the session is an imitation when its magic-link sign-in (amr method otp or
--     magiclink) falls from 1 minute before an imitation of the same person to 2 minutes after it.
--     gmail-mine reads back 24 hours for the same question (src/lib/myMail/imitation.ts), because a link lives that
--     long and a wrong pass there shows a person's mail. Here a wrong hold costs a real person their own activity for
--     the life of the session, and the sign-in page offers an emailed link, so the window is the minutes the page
--     takes, not the day the link lives. A password session reads no table. Any failure answers false: the fence
--     must never cost a person their own heartbeat.
--   * bump_user_app_activity(): as before, with one early return for such a session.
--
-- The salary sync (sync_salary_clock_sessions_for_user_day) is left as it is: the server cannot tell the clock
-- button's own sync from the sync after a pressed save, a press in View as saves as that person by design, and the
-- rows it writes are the ones the server's own schedule writes.
--
-- Idempotent: two CREATE OR REPLACE and their comments. No table is made, so no fence call closes the file.

CREATE OR REPLACE FUNCTION public.session_opened_by_imitation() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid;
  v_amr jsonb;
  v_link_at timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- The token's claims as PostgREST hands them to the request, read the way auth.jwt() reads them. That function is
  -- the sign-in service's own and a bare Postgres image has none, so the claim is read here and not through it.
  v_amr := coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb -> 'amr';
  IF v_amr IS NULL OR jsonb_typeof(v_amr) <> 'array' THEN
    RETURN false;
  END IF;

  -- When this session signed in by a magic link: its latest amr entry of that kind. A password session has none.
  SELECT to_timestamp(max((e ->> 'timestamp')::double precision))
    INTO v_link_at
  FROM jsonb_array_elements(v_amr) AS e
  WHERE jsonb_typeof(e) = 'object'
    AND lower(btrim(e ->> 'method')) IN ('magiclink', 'otp')
    AND jsonb_typeof(e -> 'timestamp') = 'number';
  IF v_link_at IS NULL THEN
    RETURN false;
  END IF;

  -- The row is written before the link is made and the page verifies the link at once: minutes, not the day a link lives.
  RETURN EXISTS (
    SELECT 1
    FROM public.user_imitations i
    WHERE i.target_id = v_uid
      AND i.created_at >= v_link_at - interval '2 minutes'
      AND i.created_at <= v_link_at + interval '1 minute'
  );
EXCEPTION WHEN OTHERS THEN
  -- A claim this cannot read is not proof of an imitation, and the caller's own activity must still count.
  RETURN false;
END;
$$;

ALTER FUNCTION public.session_opened_by_imitation() OWNER TO postgres;

COMMENT ON FUNCTION public.session_opened_by_imitation() IS
  'View as and Imitate (v2.8251): true when the calling session signed in by a magic link (the JWT''s amr, method otp or magiclink) from 1 minute before a user_imitations row of the same person to 2 minutes after it, which is how login-as-user opens a session. False for a password session (no table is read), for a person''s own emailed link, and on any failure. bump_user_app_activity() reads it. Says nothing about anyone but the caller.';

REVOKE ALL ON FUNCTION public.session_opened_by_imitation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.session_opened_by_imitation() FROM anon;
GRANT EXECUTE ON FUNCTION public.session_opened_by_imitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_opened_by_imitation() TO service_role;

-- The heartbeat, restated from 20260703120000_user_app_activity_page_daily.sql with the one early return.
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

  -- A session someone else opened as this person (Imitate, View as) is not the person's own use.
  IF public.session_opened_by_imitation() THEN
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

COMMENT ON FUNCTION public.bump_user_app_activity(p_seconds integer, p_page text) IS
  'Heartbeat: adds active seconds to user_app_activity_daily (and per-page to user_app_activity_page_daily when p_page is set) for the calling user''s UTC day; p_seconds clamped to [0,300]. p_seconds=0 updates last_seen only. Writes nothing for a session opened by an imitation (session_opened_by_imitation(), v2.8251): a dev looking as a person is not that person''s use.';
