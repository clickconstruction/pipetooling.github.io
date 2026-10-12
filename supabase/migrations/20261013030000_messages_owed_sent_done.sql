SET lock_timeout = '3s';

-- Messages, cut 2's addendum (the lead, 2026-10-12): a message we sent got what we owe done. Cut 3's reply box asks,
-- before a text or an email goes, whether it gets what we owe done (`afterSendResult` in src/lib/messages/owed.ts); when
-- it does, the box calls this with the line the send wrote. The open contact_owed row closes as done by that message
-- (done_how 'message'), and the thread gets the gray line `owedSentDoneLine` says: "Rosa sent the start date. It is
-- done." The send functions never touch cut 2's table; this is the one door.
--
-- contact_owed_guard (20261012160000) already holds the line to a message we sent that person, so a line of theirs, a
-- line to someone else or no line at all is refused in its words. No table is made here, so the house fences stand as
-- 20261012160000 left them.

CREATE OR REPLACE FUNCTION public.owed_sent_done(p_contact_id uuid, p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('mark what we owe done');
  v_open public.contact_owed%ROWTYPE;
BEGIN
  SELECT * INTO v_open FROM public.contact_owed WHERE contact_id = p_contact_id AND done_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nothing is owed to them now.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.contact_owed SET done_at = clock_timestamp(), done_how = 'message', done_note_message_id = p_message_id WHERE id = v_open.id;
  PERFORM public.follow_up_event(p_contact_id, format('%s sent %s. It is done.', public.follow_up_user_name(v_me), v_open.what));
END;
$$;

COMMENT ON FUNCTION public.owed_sent_done(uuid, uuid) IS
  'Messages, cut 2 addendum (v2.5321): a message we sent marks what we owe the person done, with its gray line. SECURITY INVOKER; contact_owed_guard holds the line to one of ours to them.';

REVOKE EXECUTE ON FUNCTION public.owed_sent_done(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owed_sent_done(uuid, uuid) TO authenticated, service_role;
