SET lock_timeout = '3s';

-- The tech's door on the usual number (punch list #118, PR 2, v2.6732). PR 1 (20261108170919, v2.6699) gave the
-- office the To chip and contact_channel_make_usual behind follow_up_press, the office team's gate. Job Mode's
-- On my way draws the same chip for the tech (the card's call 5): a plain switch sends there this once, and the
-- tick Make this their usual number stars it. Two things the tech needs that the office's cut did not give:
--
--   1. contact_channels_tech_read — the tech reads the customer's numbers through R5's door (messages_tech_team()
--      and messages_tech_can_read(contact_id): a customer whose Pipeline job they are dispatched to or clocked on
--      this week or last), as contacts_tech_read and messages_tech_read already read the contact and its lines.
--      Nothing is written; a tech's send still goes through quo-send as the service role.
--   2. contact_channel_make_usual(p_channel) is recreated with a wider gate: the office team as before, or a tech
--      messages_tech_can_read admits to the channel's contact. The words a refusal says stay follow_up_press's
--      shape (sign in · a training account · a digital twin · who may), said here since follow_up_press asks for
--      the office alone. Everything else is PR 1's: one usual per kind per contact, a number that sent STOP
--      refused, the gray line through follow_up_event, no change and no line when it is the usual already.
--
-- Additive and idempotent; no CREATE TABLE, so no new fences.

DROP POLICY IF EXISTS contact_channels_tech_read ON public.contact_channels;
CREATE POLICY contact_channels_tech_read ON public.contact_channels FOR SELECT TO authenticated
  USING ((SELECT public.messages_tech_team()) AND public.messages_tech_can_read(contact_id));

CREATE OR REPLACE FUNCTION public.contact_channel_make_usual(p_channel uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_row public.contact_channels%ROWTYPE;
  v_kind_words text;
BEGIN
  -- The gate, in follow_up_press's words: who is pressing, and whether they may.
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to pick their usual number.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot pick their usual number.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot pick their usual number.' USING ERRCODE = '42501';
  END IF;
  -- The office team, or a tech on one of this contact's jobs this week or last (PR 2). A stranger and a channel
  -- that is not there read the same refusal, so nothing is learned by asking.
  IF NOT public.gc_office_team()
     AND NOT (
       public.messages_tech_team()
       AND EXISTS (SELECT 1 FROM public.contact_channels c WHERE c.id = p_channel AND public.messages_tech_can_read(c.contact_id))
     ) THEN
    RAISE EXCEPTION 'Only the office team, or a tech on one of their jobs this week or last, can pick their usual number.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.contact_channels WHERE id = p_channel FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That number is not on their record any more.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.kind = 'phone' AND v_row.opted_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'That number sent STOP. The app will not text it, so it cannot be their usual.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.usual_at IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.contact_channels o
       WHERE o.contact_id = v_row.contact_id AND o.kind = v_row.kind AND o.id <> v_row.id AND o.usual_at IS NOT NULL
     ) THEN
    RETURN;
  END IF;
  UPDATE public.contact_channels SET usual_at = NULL
    WHERE contact_id = v_row.contact_id AND kind = v_row.kind AND id <> v_row.id AND usual_at IS NOT NULL;
  UPDATE public.contact_channels SET usual_at = clock_timestamp() WHERE id = v_row.id;
  v_kind_words := CASE WHEN v_row.kind = 'phone' THEN 'number' ELSE 'address' END;
  PERFORM public.follow_up_event(
    v_row.contact_id,
    format('%s made %s %s''s usual %s.', public.follow_up_user_name(v_me), v_row.value, public.contact_display_name(v_row.contact_id), v_kind_words)
  );
END;
$$;

COMMENT ON FUNCTION public.contact_channel_make_usual(uuid) IS
  'Punch list #118 (v2.6699; the tech''s door v2.6732): the office, or a tech on one of the contact''s jobs this week or last (messages_tech_can_read), makes a number or an address the contact''s usual. Refuses a signed-out caller, a training account and a twin in words. Clears the contact''s other usual of the same kind, refuses a number that sent STOP, writes the gray line on the thread. Already the usual: nothing changes and no line is written.';

REVOKE EXECUTE ON FUNCTION public.contact_channel_make_usual(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_channel_make_usual(uuid) TO authenticated, service_role;
