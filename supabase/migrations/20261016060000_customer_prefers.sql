SET lock_timeout = '3s';

-- v2.5597 — The customer's say and the assistant's way (punch list #115 PR 6; docs/migrations/20261016060000_customer_prefers.md).
--
-- The customer: contacts.prefers holds how they want to hear from us — text, email or either — set by an EMAIL or TEXT
-- reply to a text (the way STOP is read, quo-webhook as the service role), by the office on the thread's menu
-- (contact_set_prefers), or by their page later. The sheet says it beside the channel, and the morning run holds a text
-- for an email-only customer with that reason.
-- The assistant: tell_customer_prefs holds My way per moment (Settings → Your account): ask first, or send and show the
-- receipt. Own row only.
-- A moved first visit: nudge_offer_make takes no morning (p_send_on null) and the text waits on Today's sends.
-- A table is created, so the three fence appliers run at the end.

-- ---------- 1. The customer's channel ----------

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS prefers text
  CONSTRAINT contacts_prefers_known CHECK (prefers IN ('text', 'email', 'either'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS prefers_how text
  CONSTRAINT contacts_prefers_how_known CHECK (prefers_how IN ('reply', 'office', 'page'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS prefers_at timestamptz;

COMMENT ON COLUMN public.contacts.prefers IS 'How they want to hear from us (v2.5597): text, email or either; null when nobody said. Set by a reply (EMAIL / TEXT), the office, or their page.';

-- The office sets it from the thread's menu; a gray line says so. Either clears a preference. A definer, as the
-- thread's other presses on contacts are: authenticated holds no UPDATE on the table, and follow_up_press is the gate.
CREATE OR REPLACE FUNCTION public.contact_set_prefers(p_contact uuid, p_prefers text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('set how they want to hear from us');
  v_was text;
BEGIN
  IF p_prefers IS NULL OR p_prefers NOT IN ('text', 'email', 'either') THEN
    RAISE EXCEPTION 'Say text, email or either.' USING ERRCODE = 'P0001';
  END IF;
  SELECT prefers INTO v_was FROM public.contacts WHERE id = p_contact FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_was IS NOT DISTINCT FROM p_prefers THEN
    RETURN;
  END IF;
  UPDATE public.contacts SET prefers = p_prefers, prefers_how = 'office', prefers_at = clock_timestamp() WHERE id = p_contact;
  PERFORM public.follow_up_event(p_contact,
    format('%s set how %s hears from us: %s.', public.follow_up_user_name(v_me), public.contact_display_name(p_contact),
      CASE p_prefers WHEN 'text' THEN 'texts' WHEN 'email' THEN 'email' ELSE 'either' END));
END;
$$;

COMMENT ON FUNCTION public.contact_set_prefers(uuid, text) IS
  'The customer''s channel (v2.5597): the office sets text, email or either from the thread''s menu, through follow_up_press (a definer: the table takes no direct write), with a gray line. The same word again writes nothing.';

REVOKE ALL ON FUNCTION public.contact_set_prefers(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_set_prefers(uuid, text) TO authenticated;

-- ---------- 2. My way ----------

CREATE TABLE IF NOT EXISTS public.tell_customer_prefs (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  -- A booking's first visit: ask first (the sheet), or send and show the receipt.
  booked text NOT NULL DEFAULT 'ask' CONSTRAINT tell_customer_prefs_booked_known CHECK (booked IN ('ask', 'send')),
  estimate text NOT NULL DEFAULT 'ask' CONSTRAINT tell_customer_prefs_estimate_known CHECK (estimate IN ('ask', 'send')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.tell_customer_prefs IS
  'My way (v2.5597, punch list #115): per person and per moment, whether the Tell the customer sheet asks first or sends and shows the receipt. Own row only.';

ALTER TABLE public.tell_customer_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tell_customer_prefs_own ON public.tell_customer_prefs;
CREATE POLICY tell_customer_prefs_own ON public.tell_customer_prefs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.tell_customer_prefs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tell_customer_prefs TO authenticated;
GRANT ALL ON TABLE public.tell_customer_prefs TO service_role;

-- ---------- 3. A text that waits on Today's sends with no morning ----------

-- As 20261016040000 wrote it, with p_send_on optional: null waits for a press on Today's sends (a moved first visit).
CREATE OR REPLACE FUNCTION public.nudge_offer_make(
  p_contact uuid,
  p_step text,
  p_job_kind text,
  p_job_id uuid,
  p_body text,
  p_channel uuid,
  p_send_on date DEFAULT NULL
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
  'Today''s sends (v2.5595, v2.5597): the office prepares a text; with p_send_on the morning run sends it that day, without it waits for a press on Today''s sends (a moved first visit). The quick replies'' own refusals: signed out, a training account, a twin, off the office team; an empty text, a number not theirs.';

-- ---------- The fences, for the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
