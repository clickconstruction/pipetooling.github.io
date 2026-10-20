SET lock_timeout = '3s';

-- Messages, residential R6 (the reader's follow-up): one email sent to both of our boxes lands once. Gmail gives the
-- same mail a different id in each mailbox, so `gmail_id` cannot say it is the same email; the mail's own Message-ID
-- header can. gmail-sync (v2.5504) stamps it on every line it writes, and whichever box reads the mail second writes
-- nothing: its line is the one the first box wrote. The reader keeps reading both boxes, and both get the label.
--
--   * messages.rfc_message_id: the mail's Message-ID header as it carries it ("<CAF...@mail.gmail.com>"), trimmed.
--     Null on a line that is not an email we read, and on an email read before this.
--   * messages_rfc_message_id_once: one line a Message-ID. A Message-ID is the sender's world-wide name for one mail,
--     so one index covers both companies' boxes; none is per letterhead.
--   * email_write_line takes rfc_message_id from the row and writes nothing when the Gmail id or the Message-ID is
--     already on a line, answering written false and the line it has. Otherwise as 20261014003000_messages_two_boxes.sql.
-- No table, so no fences. Idempotent.

-- ---------- the column ----------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS rfc_message_id text;

COMMENT ON COLUMN public.messages.rfc_message_id IS
  'Messages (R6): the Message-ID header of an email the reader took, as the mail carries it, trimmed. One line a Message-ID (messages_rfc_message_id_once), so one email sent to both boxes lands once. Null on every other line and on an email read before v2.5504.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_rfc_message_id_said' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_rfc_message_id_said
      CHECK (rfc_message_id IS NULL OR (channel = 'email' AND length(btrim(rfc_message_id)) BETWEEN 1 AND 998)) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_rfc_message_id_said;

CREATE UNIQUE INDEX IF NOT EXISTS messages_rfc_message_id_once ON public.messages (rfc_message_id) WHERE rfc_message_id IS NOT NULL;

-- ---------- the reader's one write ----------

-- The line by its Gmail id (p_row: messages columns by name, as jsonb; its channel is always email), each file and link
-- in order (p_files: a jsonb array of message_attachments columns by name), and, on a forwarded copy, the forwarder's
-- note as a team note on the same contact (p_note: who_user_id or who_text, at and body, or null). All or nothing,
-- once: a Gmail id already written, or a Message-ID already on a line (the same mail read in the other box), writes
-- nothing, and the answer is the line it has, with written false. The line's mailbox from the row, else bids.
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
    subject, body, gmail_id, gmail_thread_id, mailbox, rfc_message_id)
  VALUES (
    r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, 'email', r.direction, r.who_user_id,
    coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), r.subject, coalesce(r.body, ''), p_gmail_id,
    r.gmail_thread_id, coalesce(r.mailbox, 'bids'), v_rfc)
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
