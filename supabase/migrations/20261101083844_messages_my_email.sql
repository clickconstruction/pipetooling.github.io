SET lock_timeout = '3s';

-- Messages → My email (punch list #230 PR 1, to-dos/messages-my-email/README.md; the kernels are src/lib/myMail/). A
-- tab in Messages that reads a person's own @clickplumbing.com Inbox and Sent live, under the delegation the bids@
-- reader already holds, as the signed-in person's own users.email and no other address, and keeps nothing until the
-- person tags a conversation onto a job or a bid. A tag copies that Gmail conversation onto the job as lines in
-- Messages; later mail in it lands by itself (PR 4). The edge function gmail-mine (PR 2) is the only writer of
-- everything here but the person's own switch; nothing reads or writes these until it deploys.
--
--   * email_tag_threads: one row per Gmail conversation a person tagged, with the job it is on (exactly one of the
--     three job columns, as a line carries them), who tagged it and when, and the follow's place and health
--     (last_read_at, last_error) for PR 4. Read by the office team; written by gmail-mine as the service role alone.
--   * my_mail_set(p_on, p_hidden_labels): the person's own switch and the labels they leave out, on their own users
--     row. The two columns carry no UPDATE grant (prod grants users' UPDATE column by column), so this is their door.
--   * messages.mailbox takes 'mine' (an email tagged from a person's own box), and messages.mail_user_id names whose
--     box. email_write_line, recreated from its newest definition (20261031050000_messages_invitation.sql), carries
--     mail_user_id from p_row, so gmail-mine writes a tagged line with the same one write and the same Message-ID
--     fence the boxes use. The bids@ reader sends none, and its lines stay as they are.
--   * users.my_mail_on ships true (the owner's word, 2026-11-01: on by default for every office member; a person may
--     turn it off on Settings → Your account), and users.my_mail_hidden_labels ships empty.
--
-- Idempotent and additive. The hot tables are altered last, messages and then users, so their locks are held for the
-- shortest stretch before the commit; the three fence calls close the file, as every CREATE TABLE migration's do.

-- ---------- the conversations a person tagged ----------

CREATE TABLE IF NOT EXISTS public.email_tag_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Whose box the conversation is in. Deleting the person deletes their tags; the lines stay, mail_user_id going null.
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gmail_thread_id text NOT NULL
    CONSTRAINT email_tag_threads_thread_named CHECK (btrim(gmail_thread_id) <> ''),
  -- The job, as a line and a contact's job carry it (20261012010000_messages_spine.sql): a GC project by its
  -- gc_projects.project_id. A tag goes with its job.
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  tagged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  tagged_at timestamptz NOT NULL DEFAULT now(),
  -- The follow's place (PR 4): when gmail-mine last read the conversation for mail not yet a line, and why it failed.
  last_read_at timestamptz,
  last_error text,
  CONSTRAINT email_tag_threads_once UNIQUE (user_id, gmail_thread_id),
  CONSTRAINT email_tag_threads_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) = 1)
);

COMMENT ON TABLE public.email_tag_threads IS
  'Messages → My email (punch list #230): a Gmail conversation a person tagged from their own box onto one job (bid_id, project_id or jobs_ledger_id, exactly one), who tagged it and when. Its mail lands as lines (messages.mailbox mine, mail_user_id the person); later mail follows by itself (last_read_at, last_error). Read by the office team; written by the gmail-mine edge function as the service role.';
COMMENT ON COLUMN public.email_tag_threads.user_id IS
  'Messages → My email: whose own box the conversation is in (users.email is the only address gmail-mine reads).';
COMMENT ON COLUMN public.email_tag_threads.gmail_thread_id IS
  'Messages → My email: Gmail''s id for the conversation in that person''s box. One row per person and conversation.';
COMMENT ON COLUMN public.email_tag_threads.tagged_by IS
  'Messages → My email: who pressed the tag (the person themself today).';
COMMENT ON COLUMN public.email_tag_threads.last_read_at IS
  'Messages → My email (PR 4): when gmail-mine last read the conversation for mail not yet a line. Null until the follow first reads it.';
COMMENT ON COLUMN public.email_tag_threads.last_error IS
  'Messages → My email (PR 4): why the last read of the conversation failed, or null.';

CREATE INDEX IF NOT EXISTS email_tag_threads_follow ON public.email_tag_threads (user_id, last_read_at);

ALTER TABLE public.email_tag_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_tag_threads_team_reads ON public.email_tag_threads;
CREATE POLICY email_tag_threads_team_reads ON public.email_tag_threads FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()));

-- The project's default privileges hand every new table to anon and authenticated whole; take them back. The office
-- team reads; nobody signed in writes (no INSERT, UPDATE or DELETE policy either); gmail-mine writes as the service role.
REVOKE ALL ON TABLE public.email_tag_threads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.email_tag_threads TO authenticated;
GRANT ALL ON TABLE public.email_tag_threads TO service_role;

-- ---------- the person's own switch ----------

-- The caller's own switch, and the labels they leave out when p_hidden_labels is given (null leaves them as they
-- are): trimmed, the empty ones dropped, each once whatever its case, in the order given. Twenty at most, each as
-- long as Gmail lets a label be. A definer, since the columns carry no UPDATE grant; training mode is still refused by
-- the read_only_block_stmt trigger on users, which fires inside a definer too.
CREATE OR REPLACE FUNCTION public.my_mail_set(p_on boolean, p_hidden_labels text[] DEFAULT NULL)
RETURNS TABLE (is_on boolean, hidden_labels text[])
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_labels text[];
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to change your own mail switch.' USING ERRCODE = 'P0001';
  END IF;
  IF p_on IS NULL THEN
    RAISE EXCEPTION 'Say whether to show your mail: on or off.' USING ERRCODE = 'P0001';
  END IF;
  IF p_hidden_labels IS NOT NULL THEN
    SELECT coalesce(array_agg(s.label ORDER BY s.ord), '{}'::text[]) INTO v_labels
    FROM (
      SELECT DISTINCT ON (lower(btrim(u.label))) btrim(u.label) AS label, u.ord
      FROM unnest(p_hidden_labels) WITH ORDINALITY AS u(label, ord)
      WHERE btrim(coalesce(u.label, '')) <> ''
      ORDER BY lower(btrim(u.label)), u.ord
    ) s;
    IF cardinality(v_labels) > 20 THEN
      RAISE EXCEPTION 'Leave out twenty labels at most.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_labels) AS l(label) WHERE length(l.label) > 225) THEN
      RAISE EXCEPTION 'A Gmail label is 225 characters at most.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN QUERY
    UPDATE public.users AS u
    SET my_mail_on = p_on,
        my_mail_hidden_labels = coalesce(v_labels, u.my_mail_hidden_labels)
    WHERE u.id = v_me
    RETURNING u.my_mail_on, u.my_mail_hidden_labels;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your account was not found.' USING ERRCODE = 'P0001';
  END IF;
END
$$;

COMMENT ON FUNCTION public.my_mail_set(boolean, text[]) IS
  'Messages → My email (punch list #230): the signed-in person''s own switch, Show my mail on the My email tab (users.my_mail_on), and the Gmail labels they leave out (users.my_mail_hidden_labels; null leaves them, trimmed and once each, twenty at most). Refuses anyone not signed in. Answers the row as saved.';

REVOKE EXECUTE ON FUNCTION public.my_mail_set(boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mail_set(boolean, text[]) TO authenticated, service_role;

-- ---------- a line tagged from a person's own box ----------

-- The box a line came through takes 'mine', on an email alone. A rerun finds the constraint already allowing it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_mailbox_known' AND conrelid = 'public.messages'::regclass
      AND pg_get_constraintdef(oid) LIKE '%''mine''%'
  ) THEN
    ALTER TABLE public.messages
      DROP CONSTRAINT IF EXISTS messages_mailbox_known,
      ADD CONSTRAINT messages_mailbox_known CHECK (
        mailbox IS NULL
        OR (mailbox IN ('team', 'bids') AND channel IN ('call', 'voicemail', 'missed', 'text', 'email'))
        OR (mailbox = 'mine' AND channel = 'email')
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.messages VALIDATE CONSTRAINT messages_mailbox_known;

COMMENT ON COLUMN public.messages.mailbox IS
  'Messages (R6, punch list #230): the box a call, voicemail, missed call, text or email came in on or went out from: team (the company''s own customers'' box and number), bids (bids@ and its number), or mine (an email a person tagged from their own box, whose mail_user_id names). Null on a note, an event or a portal line, and where not known.';

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS mail_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.mail_user_id IS
  'Messages → My email (punch list #230): whose own box an email line was tagged from (mailbox mine), written by gmail-mine. Null on every other line, and once that person is deleted.';

CREATE INDEX IF NOT EXISTS messages_mail_user ON public.messages (mail_user_id, gmail_thread_id) WHERE mail_user_id IS NOT NULL;

-- The one write of an email line, as 20261031050000 left it, with mail_user_id carried from p_row: gmail-mine passes
-- the person on a tagged line; the bids@ reader passes none, so its lines stay null.
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
    subject, body, gmail_id, gmail_thread_id, mailbox, rfc_message_id, invitation, mail_user_id)
  VALUES (
    r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, 'email', r.direction, r.who_user_id,
    coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), r.subject, coalesce(r.body, ''), p_gmail_id,
    r.gmail_thread_id, coalesce(r.mailbox, 'bids'), v_rfc, r.invitation, r.mail_user_id)
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

-- ---------- the person's switch, on their own row ----------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS my_mail_on boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS my_mail_hidden_labels text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.users.my_mail_on IS
  'Messages → My email (punch list #230): Show my mail on the My email tab. On by default for every office member (the owner, 2026-11-01); the person turns it off on Settings → Your account through my_mail_set. Off: gmail-mine reads nothing of their box and their tagged conversations stop following.';
COMMENT ON COLUMN public.users.my_mail_hidden_labels IS
  'Messages → My email (punch list #230): the Gmail labels the person leaves out of the tab (a Personal label), by name as Gmail spells them, written through my_mail_set. Empty: none.';

-- House rules: read-only training mode and the twin write fence cover the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
