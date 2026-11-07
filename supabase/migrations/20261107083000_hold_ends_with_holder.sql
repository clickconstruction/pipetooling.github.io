SET lock_timeout = '3s';

-- v2.6640 (punch list #114, the owner's walk of the tech's bio): the hold ends with the holder.
--
-- The tech door (20261013190000_messages_tech_door.sql) holds a customer's answer for the tech who texted until their
-- hour: contacts.has_user_id, has_since, has_how = 'rule' and has_until, under the check contacts_has_until_held
-- (has_until IS NULL OR has_user_id IS NOT NULL). messages_move_state (20261012160000, re-stated 20261028150000) and
-- mark_notice (20261031030000) clear the holder on an outgoing line or a notice, but left has_until standing, so the
-- check refused the UPDATE and the trigger raised: the second text a tech sends inside their hold — the bio right
-- after On my way, an I'm here after it, a reply from the office before the hour — went out through Quo and then
-- could not be written to the thread. Both now clear has_until with the holder. Idempotent: the same two bodies with
-- one more column cleared.

CREATE OR REPLACE FUNCTION public.messages_move_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auto THEN
    RETURN NULL;
  END IF;
  IF NEW.direction = 'in' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.contact_id = NEW.contact_id AND m.id <> NEW.id AND ((m.direction = 'out' AND NOT m.auto) OR m.channel = 'note') AND m.at > NEW.at)
    THEN
      UPDATE public.contacts SET state = 'waiting', snoozed_until = NULL
      WHERE id = NEW.contact_id AND (state <> 'waiting' OR snoozed_until IS NOT NULL);
    END IF;
  ELSIF NEW.direction = 'out' OR NEW.channel = 'note' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.contact_id = NEW.contact_id AND m.id <> NEW.id AND m.direction = 'in' AND m.at > NEW.at)
    THEN
      UPDATE public.contacts SET state = 'done', snoozed_until = NULL, has_user_id = NULL, has_since = NULL, has_how = NULL, has_until = NULL
      WHERE id = NEW.contact_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.messages_move_state() IS
  'Messages: a line in puts the thread on Follow up (waiting) unless we answered after it; a line out or a note takes it off (done) and clears who has it, the hold''s end with it (v2.6640), unless they wrote after it. An auto line moves nothing.';

CREATE OR REPLACE FUNCTION public.mark_notice(p_contact_id uuid, p_scope text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_kind text;
  v_address text;
  v_domain text;
BEGIN
  v_me := public.follow_up_press('mark a notice');
  IF p_scope IS NULL OR p_scope NOT IN ('address', 'domain') THEN
    RAISE EXCEPTION 'A notice is marked by its address or by its whole domain.' USING ERRCODE = 'P0001';
  END IF;
  SELECT kind INTO v_kind FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind <> 'unknown' THEN
    RAISE EXCEPTION 'Only a sender nobody has named can be marked a notice.' USING ERRCODE = 'P0001';
  END IF;
  SELECT lower(btrim(value)) INTO v_address
  FROM public.contact_channels
  WHERE contact_id = p_contact_id AND kind = 'email' AND position('@' IN value) > 1
  ORDER BY created_at
  LIMIT 1;
  IF v_address IS NULL THEN
    RAISE EXCEPTION 'Only an email sender can be marked a notice.' USING ERRCODE = 'P0001';
  END IF;
  v_domain := split_part(v_address, '@', 2);

  -- The address always; the domain beside it when asked, and only a company's own.
  INSERT INTO public.email_left_out_senders (value, kind, mailbox, contact_id, marked_by)
  SELECT v_address, 'address', NULL, p_contact_id, v_me
  WHERE NOT EXISTS (SELECT 1 FROM public.email_left_out_senders WHERE kind = 'address' AND value = v_address AND mailbox IS NULL);
  IF p_scope = 'domain' THEN
    IF v_domain = '' OR public.email_open_mail_domain(v_domain) THEN
      RAISE EXCEPTION 'That is an open mail service. Mark the address alone.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.email_left_out_senders (value, kind, mailbox, contact_id, marked_by)
    SELECT v_domain, 'domain', NULL, p_contact_id, v_me
    WHERE NOT EXISTS (SELECT 1 FROM public.email_left_out_senders WHERE kind = 'domain' AND value = v_domain AND mailbox IS NULL);
  END IF;

  -- The thread goes done and off Follow up, and nobody holds it. The event line moves nothing (messages_move_state
  -- reads only in, out and note).
  UPDATE public.contacts SET state = 'done', snoozed_until = NULL, has_user_id = NULL, has_since = NULL, has_how = NULL, has_until = NULL
  WHERE id = p_contact_id;
  PERFORM public.follow_up_event(
    p_contact_id,
    CASE WHEN p_scope = 'domain' THEN 'Marked a notice: everything from ' || v_domain || '.' ELSE 'Marked a notice: ' || v_address || '.' END);
END;
$$;
