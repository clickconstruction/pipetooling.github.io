SET lock_timeout = '3s';

-- v2.6774 — Send later: a text the office hands to a time, not only a morning (punch list #291 PR 4;
-- docs/migrations/20261109090000_nudge_send_at.md).
--
-- The owner, 2026-11-09: "when it comes to send in the morning I would like for the user to be able to know exactly
-- when that is and to potentially change the time". The Tell the customer sheet's Send in the morning becomes Send
-- later, with the exact time shown and changeable, and Today's sends shows the time on the row and lets the office
-- change it. Three pieces, each idempotent:
--
--   1. nudge_offers.send_at: the instant an office-made text goes. send_on stays the day (the run's morning path and
--      every older reader keep it); a row with send_at goes at that instant inside 8 AM to 9 PM Central, read by the
--      run every fifteen minutes.
--   2. nudge_offer_make gains p_send_at (default null). The old eight-argument function is dropped first, as v2.6387
--      did: a second overload would leave PostgREST two matches. A client behind the push calls it with eight and takes
--      the default; the new client's ninth argument needs the push, so push right after the merge (the client falls
--      back to the morning when the function is not there yet).
--   3. nudge_offer_retime: Today's sends changes the time of an open office-made text. The quick replies' own
--      refusals, and a time outside 8 AM to 9 PM Central is refused with the fence's words.
--   4. The run's cron fires every fifteen minutes instead of 14:00 and 15:00 UTC: the 9 AM Central preparation runs
--      once (the function guards it with its last-run mark), and an office text whose send_at is due goes within the
--      quarter hour.
--
-- No table is made, so no fence call.

ALTER TABLE public.nudge_offers ADD COLUMN IF NOT EXISTS send_at timestamptz;

COMMENT ON COLUMN public.nudge_offers.send_at IS
  'An office-made text handed to a time (v2.6774, Send later): the instant the run sends it, inside 8 AM to 9 PM Central; outside, the run moves it to the next 8 AM and says so in held_why. Null: the morning run sends it on send_on, or it waits for a press.';

CREATE INDEX IF NOT EXISTS nudge_offers_due ON public.nudge_offers (send_at) WHERE sent_at IS NULL AND dismissed_at IS NULL AND send_at IS NOT NULL;

-- ---------- 2. The office hands a text to a time ----------

DROP FUNCTION IF EXISTS public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date, date);

CREATE OR REPLACE FUNCTION public.nudge_offer_make(
  p_contact uuid,
  p_step text,
  p_job_kind text,
  p_job_id uuid,
  p_body text,
  p_channel uuid,
  p_send_on date DEFAULT NULL,
  p_about_on date DEFAULT NULL,
  p_send_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('prepare a text');
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_send_on date := coalesce(p_send_on, (p_send_at AT TIME ZONE 'America/Chicago')::date);
  v_id uuid;
BEGIN
  IF v_body IS NULL THEN
    RAISE EXCEPTION 'Write the text first.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  IF NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact) THEN
    RAISE EXCEPTION 'That person is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF p_channel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contact_channels ch WHERE ch.id = p_channel AND ch.contact_id = p_contact AND ch.kind = 'phone') THEN
    RAISE EXCEPTION 'That number is not theirs.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.nudge_offers (contact_id, step_key, bid_id, project_id, jobs_ledger_id, body, channel_id, prepared_by, by_user_id, send_on, about_on, send_at)
  VALUES (p_contact, p_step,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END,
    v_body, p_channel, 'office', v_me, v_send_on, p_about_on, p_send_at)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date, date, timestamptz) IS
  'Today''s sends (v2.5595, v2.5597, v2.6387, v2.6774): the office prepares a text; with p_send_at the run sends it at that instant (Send later), with p_send_on alone the morning run sends it that day, with neither it waits for a press on Today''s sends (a moved first visit); p_about_on is the day the words are about, past which the text is stale. The quick replies'' own refusals: signed out, a training account, a twin, off the office team; an empty text, a number not theirs.';

REVOKE ALL ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date, date, timestamptz) TO authenticated;

-- ---------- 3. The office changes the time ----------

CREATE OR REPLACE FUNCTION public.nudge_offer_retime(p_offer uuid, p_send_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('change when a text goes');
  v public.nudge_offers%ROWTYPE;
  v_local timestamp := p_send_at AT TIME ZONE 'America/Chicago';
BEGIN
  IF p_send_at IS NULL THEN
    RAISE EXCEPTION 'Say when it goes.' USING ERRCODE = 'P0001';
  END IF;
  IF v_local::time < time '08:00' OR v_local::time > time '21:00' THEN
    RAISE EXCEPTION 'Texts go between 8 AM and 9 PM. Pick a time inside them.' USING ERRCODE = 'P0001';
  END IF;
  SELECT o.* INTO v FROM public.nudge_offers o WHERE o.id = p_offer FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That text is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.sent_at IS NOT NULL OR v.dismissed_at IS NOT NULL THEN
    RAISE EXCEPTION 'That text already went, or was put away.' USING ERRCODE = 'P0001';
  END IF;
  IF v.prepared_by <> 'office' THEN
    RAISE EXCEPTION 'Only a text the office prepared takes a time. Press Send on this one when it is time.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.nudge_offers
     SET send_at = p_send_at,
         send_on = v_local::date,
         held_why = NULL
   WHERE id = p_offer;
  PERFORM v_me;
END;
$$;

COMMENT ON FUNCTION public.nudge_offer_retime(uuid, timestamptz) IS
  'Today''s sends (v2.6774, Send later): the office changes the time an office-made text goes; the fence is 8 AM to 9 PM Central; a text already sent or put away, or one the app prepared, is refused. The quick replies'' own refusals apply.';

REVOKE ALL ON FUNCTION public.nudge_offer_retime(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_offer_retime(uuid, timestamptz) TO authenticated;

-- ---------- 4. The run every fifteen minutes ----------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'messages-nudge-dispatch';

SELECT cron.schedule(
  'messages-nudge-dispatch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/messages-nudge-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
