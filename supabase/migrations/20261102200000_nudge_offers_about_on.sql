SET lock_timeout = '3s';

-- v2.6387 — Today's sends: a moved visit's text expires with its visit
-- (docs/migrations/20261102200000_nudge_offers_about_on.md).
--
-- A moved first visit's Rescheduled text waits on Today's sends with no morning (v2.5597), and nothing judged its
-- freshness: on 2026-11-02 a text announcing a visit on October 22 still sat under "ready to send", eleven days after
-- the visit (Taunya's report, PR 3 of three). The row now carries the day its words are about, so the window holds it
-- once that day has passed and the morning run puts it away. Two pieces, each idempotent:
--
--   1. nudge_offers.about_on: the day the words are about (a moved visit's new day). Null for a text about no day.
--   2. nudge_offer_make gains p_about_on (default null). The old seven-argument function is dropped first: a second
--      overload would leave PostgREST two matches for a seven-argument call. A client behind the push calls it with
--      seven and takes the default; the new client's eighth argument needs the push, so push right after the merge.
--
-- No table is made, so no fence call.

ALTER TABLE public.nudge_offers ADD COLUMN IF NOT EXISTS about_on date;

COMMENT ON COLUMN public.nudge_offers.about_on IS
  'The day the words are about, a moved visit''s new day (v2.6387). Past it the text is stale: Today''s sends holds it with why, and the morning run puts it away (dismissed_why stale). Null for a text about no day.';

DROP FUNCTION IF EXISTS public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date);

CREATE OR REPLACE FUNCTION public.nudge_offer_make(
  p_contact uuid,
  p_step text,
  p_job_kind text,
  p_job_id uuid,
  p_body text,
  p_channel uuid,
  p_send_on date DEFAULT NULL,
  p_about_on date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('prepare a text');
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
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
  INSERT INTO public.nudge_offers (contact_id, step_key, bid_id, project_id, jobs_ledger_id, body, channel_id, prepared_by, by_user_id, send_on, about_on)
  VALUES (p_contact, p_step,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END,
    v_body, p_channel, 'office', v_me, p_send_on, p_about_on)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date, date) IS
  'Today''s sends (v2.5595, v2.5597, v2.6387): the office prepares a text; with p_send_on the morning run sends it that day, without it waits for a press on Today''s sends (a moved first visit); p_about_on is the day the words are about, past which the text is stale. The quick replies'' own refusals: signed out, a training account, a twin, off the office team; an empty text, a number not theirs.';

REVOKE ALL ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date, date) TO authenticated;
