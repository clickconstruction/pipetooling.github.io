SET lock_timeout = '3s';

-- v2.6513: a thread for a number or an address nobody holds yet, made by a press in a message's words (the Email or
-- Text press on a contact point the viewer finds in an email's signature, `src/lib/messages/bodyContacts.ts`). A
-- signed-in client has no INSERT on contacts or contact_channels (20261012010000: a contact is made by the seed and the
-- service role), and the edge's placers, email_place_address and quo_place_number, are the service role's; this is the
-- office team's own, the same shape: whose it is first (contact_for_channel, so two presses never make two), else an
-- unknown contact named by the value with its one channel, which the client then names through name_contact as a new
-- person at the same customer or trade partner. Never called by a read: the press makes it. Gated by follow_up_press
-- (signed in, not a training account, not a twin, the office team).
CREATE OR REPLACE FUNCTION public.contact_make_for_channel(p_kind text, p_value text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_value text := btrim(coalesce(p_value, ''));
  v_contact uuid;
BEGIN
  PERFORM public.follow_up_press('make their thread');
  IF p_kind IS NULL OR p_kind NOT IN ('phone', 'email') THEN
    RAISE EXCEPTION 'kindNeeded' USING ERRCODE = 'P0001', DETAIL = 'A number or an email address.';
  END IF;
  v_key := public.contact_channel_key(p_kind, v_value);
  IF coalesce(v_key, '') = '' THEN
    RAISE EXCEPTION 'valueNeeded' USING ERRCODE = 'P0001', DETAIL = 'That is not a number or an email address.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('contact_make_for_channel:' || p_kind || ':' || v_key, 0));
  v_contact := public.contact_for_channel(p_kind, v_value);
  IF v_contact IS NOT NULL THEN
    RETURN v_contact;
  END IF;
  INSERT INTO public.contacts (kind, name) VALUES ('unknown', left(v_value, 200))
    RETURNING id INTO v_contact;
  INSERT INTO public.contact_channels (contact_id, kind, value) VALUES (v_contact, p_kind, v_value);
  RETURN v_contact;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contact_make_for_channel(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_make_for_channel(text, text) TO authenticated, service_role;
