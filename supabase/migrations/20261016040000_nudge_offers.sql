SET lock_timeout = '3s';

-- v2.5595 — Today's sends: the app's own texts become offers (punch list #115 PR 4; docs/migrations/20261016040000_nudge_offers.md).
--
-- The principle: nothing reaches a customer without a person pressing it, or seeing it the moment after. The owner's
-- per-step switch on the reminders the app sends (app_settings messages_nudge_app_sends_v1) turns three-way — off,
-- offers, sends — and offers is the default the first time a step is turned on. For an offers step the morning run
-- prepares the text and writes it here instead of sending it; the office presses it on the Dashboard's Today's sends,
-- one by one or all that are ready. The office can also prepare a text itself from the Tell the customer sheet
-- (Send in the morning), which the run sends on its morning. Three pieces, each idempotent:
--
--   1. nudge_offers: one row per prepared text — the person, the step, the job, the words as composed, the number it
--      goes to, who prepared it (the app, or the office with a morning to send it), why it is held, and how it ended
--      (sent with its message, or dismissed with why). Read by the office team; written by the service role (the run)
--      and the three functions below.
--   2. nudge_offer_make: the office prepares a text for a morning (Send in the morning).
--   3. nudge_offer_sent: the office pressed Send on an offer: the text's line is stamped on it and nudge_sent gets its
--      row through nudge_record_sent, so the reminder never doubles.
--   4. nudge_offer_dismiss: Not this one, Hold until a day (after nudge_hold_until), Stop reminding (after flow_skip_step).
--
-- A table is created, so the three fence appliers run at the end.

CREATE TABLE IF NOT EXISTS public.nudge_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  bid_id uuid,
  project_id uuid,
  jobs_ledger_id uuid,
  how text NOT NULL DEFAULT 'text' CONSTRAINT nudge_offers_how_known CHECK (how IN ('text')),
  body text NOT NULL,
  channel_id uuid REFERENCES public.contact_channels(id) ON DELETE SET NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  prepared_by text NOT NULL DEFAULT 'app' CONSTRAINT nudge_offers_prepared_by_known CHECK (prepared_by IN ('app', 'office')),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  send_on date,
  held_why text,
  sent_at timestamptz,
  sent_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  message_id uuid,
  dismissed_at timestamptz,
  dismissed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  dismissed_why text
);

COMMENT ON TABLE public.nudge_offers IS
  'Today''s sends (v2.5595, punch list #115): a text the app prepared for the office to press (prepared_by app), or the office prepared for the morning run to send (prepared_by office, send_on). Open while sent_at and dismissed_at are null.';
COMMENT ON COLUMN public.nudge_offers.body IS 'The words as the run or the sheet composed them; the office may change them before pressing Send.';
COMMENT ON COLUMN public.nudge_offers.send_on IS 'An office-made offer: the morning the run sends it. Null: it waits for a press on Today''s sends.';
COMMENT ON COLUMN public.nudge_offers.held_why IS 'Why it cannot go yet, in the run''s words (no number, opted out…); null when it is ready.';

CREATE INDEX IF NOT EXISTS nudge_offers_open ON public.nudge_offers (contact_id, step_key) WHERE sent_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE public.nudge_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nudge_offers_select ON public.nudge_offers;
CREATE POLICY nudge_offers_select ON public.nudge_offers
  FOR SELECT TO authenticated USING (public.gc_office_team());

-- The schema's default privileges hand a new table to anon and authenticated whole; the office reads, the functions
-- and the service role write.
REVOKE ALL ON TABLE public.nudge_offers FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.nudge_offers FROM authenticated;
GRANT SELECT ON TABLE public.nudge_offers TO authenticated;
GRANT ALL ON TABLE public.nudge_offers TO service_role;

-- ---------- 2. The office prepares a text for a morning ----------

CREATE OR REPLACE FUNCTION public.nudge_offer_make(
  p_contact uuid,
  p_step text,
  p_job_kind text,
  p_job_id uuid,
  p_body text,
  p_channel uuid,
  p_send_on date
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
  IF p_send_on IS NULL THEN
    RAISE EXCEPTION 'Say which morning it goes.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  IF NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact) THEN
    RAISE EXCEPTION 'That person is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF p_channel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contact_channels ch WHERE ch.id = p_channel AND ch.contact_id = p_contact AND ch.kind = 'phone') THEN
    RAISE EXCEPTION 'That number is not theirs.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.nudge_offers (contact_id, step_key, bid_id, project_id, jobs_ledger_id, body, channel_id, prepared_by, by_user_id, send_on)
  VALUES (p_contact, p_step,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END,
    v_body, p_channel, 'office', v_me, p_send_on)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date) IS
  'Today''s sends (v2.5595): the office prepares a text the morning run sends on p_send_on (Send in the morning on the Tell the customer sheet). The quick replies'' own refusals: signed out, a training account, a twin, off the office team; an empty text, no morning, a number not theirs.';

REVOKE ALL ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_offer_make(uuid, text, text, uuid, text, uuid, date) TO authenticated;

-- ---------- 3. The office pressed Send ----------

CREATE OR REPLACE FUNCTION public.nudge_offer_sent(p_offer uuid, p_message uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('send a prepared text');
  v public.nudge_offers%ROWTYPE;
  v_kind text;
  v_job uuid;
BEGIN
  SELECT o.* INTO v FROM public.nudge_offers o WHERE o.id = p_offer FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That text is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.sent_at IS NOT NULL OR v.dismissed_at IS NOT NULL THEN
    RAISE EXCEPTION 'That text already went, or was put away.' USING ERRCODE = 'P0001';
  END IF;
  v_kind := CASE WHEN v.bid_id IS NOT NULL THEN 'bid' WHEN v.project_id IS NOT NULL THEN 'project' WHEN v.jobs_ledger_id IS NOT NULL THEN 'pipeline' END;
  v_job := coalesce(v.bid_id, v.project_id, v.jobs_ledger_id);
  UPDATE public.nudge_offers SET sent_at = clock_timestamp(), sent_by_user_id = v_me, message_id = p_message WHERE id = p_offer;
  -- The reminder's own record, so the run never doubles it and the panel reads it as sent by a person.
  PERFORM public.nudge_record_sent(v.contact_id, v.step_key, v_kind, v_job, NULL, v.how, p_message);
END;
$$;

COMMENT ON FUNCTION public.nudge_offer_sent(uuid, uuid) IS
  'Today''s sends (v2.5595): the office pressed Send on a prepared text and quo-send wrote its line; the offer is stamped sent and nudge_sent gets its row through nudge_record_sent. Refused for a text that already went or was put away.';

REVOKE ALL ON FUNCTION public.nudge_offer_sent(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_offer_sent(uuid, uuid) TO authenticated;

-- ---------- 4. Not this one, held, or stopped ----------

CREATE OR REPLACE FUNCTION public.nudge_offer_dismiss(p_offer uuid, p_why text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('put a prepared text away');
  v_why text := nullif(btrim(coalesce(p_why, '')), '');
BEGIN
  IF v_why IS NULL OR v_why NOT IN ('not this one', 'held', 'stopped', 'sent elsewhere') THEN
    RAISE EXCEPTION 'Say why: not this one, held, stopped or sent elsewhere.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.nudge_offers SET dismissed_at = clock_timestamp(), dismissed_by_user_id = v_me, dismissed_why = v_why
  WHERE id = p_offer AND sent_at IS NULL AND dismissed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That text is not there, or already went.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.nudge_offer_dismiss(uuid, text) IS
  'Today''s sends (v2.5595): the office puts a prepared text away — not this one, held (after nudge_hold_until), stopped (after flow_skip_step) or sent elsewhere. Refused for a text that already went.';

REVOKE ALL ON FUNCTION public.nudge_offer_dismiss(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_offer_dismiss(uuid, text) TO authenticated;

-- ---------- The fences, for the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
