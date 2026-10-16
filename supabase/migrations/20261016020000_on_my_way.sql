SET lock_timeout = '3s';

-- v2.5573 — On my way and I'm here (punch list #112; docs/migrations/20261016020000_on_my_way.md).
--
-- Job Mode's big button clocks the tech in on the next job as on the way and texts the customer the office's line;
-- while on the way the button reads I'm here and stamps the arrival. Three pieces, each idempotent:
--
--   1. clock_sessions: two instants, travel_started_at and arrived_at, and the arrival's point beside the clock-in's.
--      A visit stays one row; the drive is arrived_at - travel_started_at. Own-row RLS already lets a tech write them.
--   2. quick_replies.phone_press: which live team line each big button sends ('on_my_way' | 'im_here'), one line a
--      press among live lines (a partial unique index).
--   3. set_quick_reply_press(p_id, p_press): the office points a press at a line on the phone, or clears it; the
--      press leaves any other line first; a 'phone' version per line that changed. The quick replies' own refusals.
--   (The job's point for the phone's guess is read from address_geocodes, open to every signed-in user since v2.3131.)
--
-- Then the seeds, once: the first phone line that uses {minutes} becomes the On my way line (or one is added), and an
-- I'm here line is added when none holds that press. Day one works with no office step; the words stay the office's.
-- No table is created, so the three fence appliers are not re-run; the new function says who may in its body.

-- ---------- 1. The two instants and the arrival's point ----------

ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS travel_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_lat numeric,
  ADD COLUMN IF NOT EXISTS arrived_lng numeric,
  ADD COLUMN IF NOT EXISTS arrived_location_source text;

COMMENT ON COLUMN public.clock_sessions.travel_started_at IS
  'Job Mode''s On my way (v2.5573): when the drive to the session''s job began. Null on a row from before the press, or a session that never drove.';
COMMENT ON COLUMN public.clock_sessions.arrived_at IS
  'Job Mode''s I''m here (v2.5573): when the tech reached the job. The drive is arrived_at - travel_started_at.';
COMMENT ON COLUMN public.clock_sessions.arrived_lat IS 'The phone''s point at I''m here, like clock_in_lat. Patched after the press; null when the phone gave none.';
COMMENT ON COLUMN public.clock_sessions.arrived_lng IS 'The phone''s point at I''m here, like clock_in_lng.';
COMMENT ON COLUMN public.clock_sessions.arrived_location_source IS 'gps | ip, like clock_in_location_source.';

-- ---------- 2. Which line each big button sends ----------

ALTER TABLE public.quick_replies
  ADD COLUMN IF NOT EXISTS phone_press text
    CONSTRAINT quick_replies_phone_press_known CHECK (phone_press IN ('on_my_way', 'im_here'));

COMMENT ON COLUMN public.quick_replies.phone_press IS
  'Job Mode''s big button this line is (v2.5573): on_my_way or im_here. One live line a press. Null: an ordinary line on the phone.';

CREATE UNIQUE INDEX IF NOT EXISTS quick_replies_phone_press_one
  ON public.quick_replies (phone_press)
  WHERE phone_press IS NOT NULL AND removed_at IS NULL;

-- ---------- 3. The office points a press at a line ----------

CREATE OR REPLACE FUNCTION public.set_quick_reply_press(p_id uuid, p_press text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('change a quick reply');
  v public.quick_replies%ROWTYPE;
  v_press text := nullif(btrim(coalesce(p_press, '')), '');
  v_other uuid;
  v_wrote integer := 0;
BEGIN
  IF v_press IS NOT NULL AND v_press NOT IN ('on_my_way', 'im_here') THEN
    RAISE EXCEPTION 'The phone has no such big button.' USING ERRCODE = 'P0001';
  END IF;
  SELECT q.* INTO v FROM public.quick_replies q WHERE q.id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bring the line back before you change it.' USING ERRCODE = 'P0001';
  END IF;
  IF v_press IS NOT NULL AND (v.scope <> 'team' OR v.for_kind <> 'customer' OR v.phone_order IS NULL) THEN
    RAISE EXCEPTION 'Only a team line for customers on the phone can be a big button.' USING ERRCODE = 'P0001';
  END IF;
  IF v_press IS NOT DISTINCT FROM v.phone_press THEN
    RETURN 0;
  END IF;
  -- The press leaves the line that held it, with its own version.
  IF v_press IS NOT NULL THEN
    FOR v_other IN
      SELECT q.id FROM public.quick_replies q
      WHERE q.phone_press = v_press AND q.removed_at IS NULL AND q.id <> p_id
      FOR UPDATE
    LOOP
      UPDATE public.quick_replies SET phone_press = NULL WHERE id = v_other;
      INSERT INTO public.quick_reply_versions (quick_reply_id, kind, by_user_id) VALUES (v_other, 'phone', v_me);
      v_wrote := v_wrote + 1;
    END LOOP;
  END IF;
  UPDATE public.quick_replies SET phone_press = v_press WHERE id = p_id;
  INSERT INTO public.quick_reply_versions (quick_reply_id, kind, by_user_id) VALUES (p_id, 'phone', v_me);
  RETURN v_wrote + 1;
END;
$$;

COMMENT ON FUNCTION public.set_quick_reply_press(uuid, text) IS
  'Job Mode''s big buttons (v2.5573): points On my way or I''m here at a team line for customers on the phone, or clears it (null). The press leaves the line that held it. A phone version per line that changed; returns how many. The quick replies'' own refusals: signed out, a training account, a twin, off the office team.';

REVOKE ALL ON FUNCTION public.set_quick_reply_press(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_quick_reply_press(uuid, text) TO authenticated;

-- ---------- 4. The seeds, once ----------

DO $$
DECLARE
  v_id uuid;
  v_place integer;
BEGIN
  -- On my way: the first live team line for customers on the phone that uses {minutes}; else a new one.
  IF NOT EXISTS (SELECT 1 FROM public.quick_replies WHERE phone_press = 'on_my_way' AND removed_at IS NULL) THEN
    SELECT q.id INTO v_id FROM public.quick_replies q
    WHERE q.removed_at IS NULL AND q.scope = 'team' AND q.for_kind = 'customer' AND q.phone_order IS NOT NULL
      AND q.text LIKE '%{minutes}%'
    ORDER BY q.phone_order, q.added_at
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE public.quick_replies SET phone_press = 'on_my_way' WHERE id = v_id;
      INSERT INTO public.quick_reply_versions (quick_reply_id, kind) VALUES (v_id, 'phone');
    ELSE
      SELECT coalesce(max(q.phone_order), 0) + 1 INTO v_place FROM public.quick_replies q WHERE q.removed_at IS NULL;
      INSERT INTO public.quick_replies (text, for_kind, step_key, scope, phone_order, phone_name, phone_press)
      VALUES ('{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', 'customer', NULL, 'team', v_place, 'On my way', 'on_my_way')
      RETURNING id INTO v_id;
      INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_text, to_for_kind) VALUES (v_id, 'added', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', 'customer');
      INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_phone_order) VALUES (v_id, 'phone', v_place);
    END IF;
  END IF;
  -- I'm here: a new line when none holds the press.
  IF NOT EXISTS (SELECT 1 FROM public.quick_replies WHERE phone_press = 'im_here' AND removed_at IS NULL) THEN
    SELECT coalesce(max(q.phone_order), 0) + 1 INTO v_place FROM public.quick_replies q WHERE q.removed_at IS NULL;
    INSERT INTO public.quick_replies (text, for_kind, step_key, scope, phone_order, phone_name, phone_press)
    VALUES ('{first}, this is {me} with Click Plumbing. I am here at {address}.', 'customer', NULL, 'team', v_place, 'I’m here', 'im_here')
    RETURNING id INTO v_id;
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_text, to_for_kind) VALUES (v_id, 'added', '{first}, this is {me} with Click Plumbing. I am here at {address}.', 'customer');
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_phone_order) VALUES (v_id, 'phone', v_place);
  END IF;
END $$;
