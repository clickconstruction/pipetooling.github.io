SET lock_timeout = '3s';

-- v2.7026 (punch list #324): old mail lands for the record.
--
-- On 2026-11-09 a batch of old email conversations was tagged from a teammate's own mailbox onto jobs. Every mail
-- landed at its own date, months back, and Messages read each one as a message nobody had answered: the trigger
-- opened the thread, New asked Who is this?, the move line counted the days since the mail was written. Every line
-- keeps when it was written (at) and when it landed (created_at), and nothing that asks whether someone is waiting
-- read the second.
--
--   * messages.history: true on a mail that was filed for the record. It shows in the thread and on the job at its own
--     date and asks nobody for a reply. The tag decides it (gmail-mine, the next PR): a mail from a person's own box
--     that is more than 14 days old when it lands. The company boxes' readers never set it, since mail in the team box
--     was seen by nobody until the app read it.
--   * email_write_line keeps the mark the caller sends. Missing reads false, so every writer deployed today writes as
--     it did.
--   * messages_move_state: a filed mail from them opens nothing. A filed mail of ours still counts as our answer, as
--     any line of ours that lands late does today, and a filed mail of theirs never holds a thread open against it.
--   * set_state: Reopen takes the mark off the thread's mail, since the person has said it is live, so the move line
--     and the lanes read it again. A close also ends the tech's hold (has_until), which 20261107083000 fixed for the
--     trigger and mark_notice and missed here: No reply needed on a held thread was refused by contacts_has_until_held.
--   * The mail already there: the lines tagged from a person's own box that landed more than 14 days after they were
--     written are marked, and a thread that only such mail opened, which nobody holds, goes back to Done.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, and two updates that match nothing on a second run.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS history boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.messages.history IS
  'True on a mail filed for the record (v2.7026, punch list #324): tagged from a person''s own box more than 14 days after it was written. It shows in the thread and on the job and asks nobody for a reply: messages_move_state opens nothing for it, and the kernels that read whose move it is skip it. set_state takes it off on Reopen.';

-- email_write_line as 20261101083844 wrote it, keeping the caller's mark.
CREATE OR REPLACE FUNCTION public.email_write_line(p_gmail_id text, p_row jsonb, p_files jsonb DEFAULT '[]'::jsonb, p_note jsonb DEFAULT NULL)
RETURNS TABLE (written boolean, id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.messages;
  n public.messages;
  v_id uuid;
  v_rfc text;
BEGIN
  IF coalesce(btrim(p_gmail_id), '') = '' THEN
    RAISE EXCEPTION 'An email needs its Gmail id.';
  END IF;
  r := jsonb_populate_record(NULL::public.messages, p_row);
  v_rfc := nullif(btrim(coalesce(r.rfc_message_id, '')), '');
  -- With no target, the insert stands back on either key: the Gmail id or the Message-ID.
  INSERT INTO public.messages AS m (
    contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at,
    subject, body, gmail_id, gmail_thread_id, mailbox, rfc_message_id, invitation, mail_user_id, history)
  VALUES (
    r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, 'email', r.direction, r.who_user_id,
    coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), r.subject, coalesce(r.body, ''), p_gmail_id,
    r.gmail_thread_id, coalesce(r.mailbox, 'bids'), v_rfc, r.invitation, r.mail_user_id, coalesce(r.history, false))
  ON CONFLICT DO NOTHING
  RETURNING m.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN QUERY
      SELECT false, m.id FROM public.messages m
      WHERE m.gmail_id = p_gmail_id OR (v_rfc IS NOT NULL AND m.rfc_message_id = v_rfc)
      ORDER BY (m.gmail_id = p_gmail_id) DESC
      LIMIT 1;
    RETURN;
  END IF;
  INSERT INTO public.message_attachments (
    message_id, sort_order, kind, name, mime, size_bytes, bucket_path, left_in_gmail, gmail_attachment_id, url, host, paper)
  SELECT v_id, (f.ord - 1)::integer, a.kind, a.name, a.mime, a.size_bytes, a.bucket_path, a.left_in_gmail,
    a.gmail_attachment_id, a.url, a.host, a.paper
  FROM jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) WITH ORDINALITY AS f(value, ord)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::public.message_attachments, f.value) AS a;
  IF p_note IS NOT NULL THEN
    n := jsonb_populate_record(NULL::public.messages, p_note);
    INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, at, body)
    VALUES (r.contact_id, 'note', 'team', n.who_user_id, coalesce(n.who_text, ''), coalesce(n.at, r.at, clock_timestamp()), coalesce(n.body, ''));
  END IF;
  RETURN QUERY SELECT true, v_id;
END
$$;

-- messages_move_state as 20261107083000 wrote it, with the filed mail: theirs opens nothing and holds nothing open.
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
    IF NEW.history THEN
      RETURN NULL;
    END IF;
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
      WHERE m.contact_id = NEW.contact_id AND m.id <> NEW.id AND m.direction = 'in' AND NOT m.history AND m.at > NEW.at)
    THEN
      UPDATE public.contacts SET state = 'done', snoozed_until = NULL, has_user_id = NULL, has_since = NULL, has_how = NULL, has_until = NULL
      WHERE id = NEW.contact_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.messages_move_state() IS
  'Messages: a line in puts the thread on Follow up (waiting) unless we answered after it; a line out or a note takes it off (done) and clears who has it, the hold''s end with it (v2.6640), unless they wrote after it. An auto line moves nothing. A filed mail of theirs (messages.history, v2.7026) opens nothing and holds nothing open.';

-- set_state as 20261012160000 wrote it. Reopen takes the mark off the thread's filed mail; a close ends the hold.
CREATE OR REPLACE FUNCTION public.set_state(p_contact_id uuid, p_state text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_until date;
BEGIN
  PERFORM public.follow_up_press('reopen, snooze or close a conversation');
  IF p_state IS NULL OR p_state NOT IN ('waiting', 'snoozed', 'done') THEN
    RAISE EXCEPTION 'A conversation is Open, Snoozed or Done.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  v_until := CASE WHEN p_state = 'snoozed' THEN public.app_today() + (8 - extract(isodow FROM public.app_today())::int) END;
  UPDATE public.contacts SET
    state = p_state,
    snoozed_until = v_until,
    has_user_id = CASE WHEN p_state = 'done' THEN NULL ELSE has_user_id END,
    has_since = CASE WHEN p_state = 'done' THEN NULL ELSE has_since END,
    has_how = CASE WHEN p_state = 'done' THEN NULL ELSE has_how END,
    has_until = CASE WHEN p_state = 'done' THEN NULL ELSE has_until END
  WHERE id = p_contact_id;
  IF p_state = 'waiting' THEN
    UPDATE public.messages SET history = false WHERE contact_id = p_contact_id AND history;
  END IF;
  RETURN v_until;
END;
$$;

-- The mail already there. A line from a person's own box that landed more than 14 days after it was written is filed
-- for the record, as the tag will file one from the next PR on.
UPDATE public.messages SET history = true
WHERE NOT history AND channel = 'email' AND mailbox = 'mine' AND created_at - at > interval '14 days';

-- A thread that only filed mail opened goes back to Done: it is open, nobody holds it, it has filed mail of theirs,
-- and no other line of theirs still waits on an answer of ours.
UPDATE public.contacts c SET state = 'done', snoozed_until = NULL
WHERE c.state = 'waiting' AND c.has_user_id IS NULL
  AND EXISTS (SELECT 1 FROM public.messages h WHERE h.contact_id = c.id AND h.history AND h.direction = 'in')
  AND NOT EXISTS (
    SELECT 1 FROM public.messages i
    WHERE i.contact_id = c.id AND i.direction = 'in' AND NOT i.history AND NOT i.auto
      AND NOT EXISTS (
        SELECT 1 FROM public.messages o
        WHERE o.contact_id = c.id AND ((o.direction = 'out' AND NOT o.auto) OR o.channel = 'note') AND o.at > i.at));
