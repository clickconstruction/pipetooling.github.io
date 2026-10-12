SET lock_timeout = '3s';

-- Messages, cut 6, email in (to-dos/gc-mode/messages/BUILD_PLAN.md → Cut 6, and the mock-up email-in-mockups.html on
-- branch spike/gc-mode with the lead's answers to its nine questions; the kernels are src/lib/emailIn/, v2.5349): every
-- email that reaches bids@ lands in its sender's thread. The spine (20261012010000_messages_spine.sql) made the messages
-- table and the Quo link (20261012170000_quo_messages.sql) gave it its first source; this gives it the second.
--
--   * messages gains gmail_id, Gmail's id for the email: unique, so the reader writes a line once however many times it
--     reads the email. gmail_thread_id is Gmail's thread, for a reply in it later. Both only on an email.
--   * message_attachments: a file or a link on a line. A file up to 25 MB has our copy in the private
--     message-attachments bucket (bucket_path). A bigger one, or one the reader could not copy, stays in Gmail
--     (left_in_gmail, with Gmail's attachment id). A link keeps its url. paper is the reader's guess (coi, w9) for the
--     thread's offer; paper_answer is the office's (filed, not_it), stamped with who and when by a trigger.
--   * email_place_address finds the contact an address lands on, or makes the unknown contact (the Who is this? row)
--     with that one address. The address's key is locked, so two emails from one new address make one contact.
--   * email_write_line is the reader's one write: the line by its Gmail id with its files and, on a forwarded copy, the
--     forwarder's note as a team note. All or nothing, once.
--   * gmail_sync_state: one row, the reader's place in Gmail's history and its health (last_run_at, last_ok_at,
--     last_error, last_taken), which a dev reads through the dev-mcp catalog.
--   * The switch, app_settings gmail_sync_on_v1, ships 'false'; the owner or a dev turns it on or off from the app (its
--     own UPDATE policy, the shape of cut 5's seats). A cron calls gmail-sync every 3 minutes while it is on.
--   * The office team (gc_office_team(), as for the lines) reads the new table, the state and the bucket, and answers a
--     paper offer. Everything else is the service role's: the gmail-sync function.

-- ---------- what an email carries ----------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS gmail_id text,
  ADD COLUMN IF NOT EXISTS gmail_thread_id text;

COMMENT ON COLUMN public.messages.gmail_id IS
  'Messages (cut 6): Gmail''s id for this email in bids@. Unique: the reader writes the line once by it.';
COMMENT ON COLUMN public.messages.gmail_thread_id IS
  'Messages (cut 6): Gmail''s thread for this email, for a reply in the same thread later.';

-- A plain unique index, as quo_id's: email_write_line's ON CONFLICT (gmail_id) needs it whole, and the lines with no
-- Gmail id are nulls, which never collide.
CREATE UNIQUE INDEX IF NOT EXISTS messages_gmail_id_key ON public.messages (gmail_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_gmail_on_email' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_gmail_on_email
      CHECK (num_nonnulls(gmail_id, gmail_thread_id) = 0 OR (channel = 'email' AND btrim(coalesce(gmail_id, '')) <> '')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_gmail_on_email;

-- ---------- the files and links on a line ----------

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  -- Its place among the line's files and links, from 0.
  sort_order integer NOT NULL DEFAULT 0
    CONSTRAINT message_attachments_sort_order_counted CHECK (sort_order >= 0),
  kind text NOT NULL
    CONSTRAINT message_attachments_kind_known CHECK (kind IN ('file', 'link')),
  name text NOT NULL
    CONSTRAINT message_attachments_named CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  mime text,
  size_bytes bigint
    CONSTRAINT message_attachments_size_counted CHECK (size_bytes IS NULL OR size_bytes >= 0),
  -- Our copy of a file: <gmail id>/<part>-<name> in the message-attachments bucket.
  bucket_path text,
  -- A file left in Gmail: too big to keep (over 25 MB), or one the reader could not copy. Gmail's id opens it there.
  left_in_gmail text
    CONSTRAINT message_attachments_left_known CHECK (left_in_gmail IN ('too_big', 'not_copied')),
  gmail_attachment_id text,
  -- A link: where it goes, and the file host it is on (src/lib/emailIn/fileLinks.ts).
  url text,
  host text,
  -- The reader's guess at a trade partner's paper, for the thread's offer, and the office's answer to it.
  paper text
    CONSTRAINT message_attachments_paper_known CHECK (paper IN ('coi', 'w9')),
  paper_answer text
    CONSTRAINT message_attachments_paper_answer_known CHECK (paper_answer IN ('filed', 'not_it')),
  paper_answered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  paper_answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT message_attachments_link_or_file CHECK (
    CASE kind
      WHEN 'link' THEN url IS NOT NULL AND btrim(url) <> '' AND num_nonnulls(bucket_path, left_in_gmail, paper) = 0
      ELSE url IS NULL AND num_nonnulls(bucket_path, left_in_gmail) = 1
    END
  ),
  CONSTRAINT message_attachments_answer_to_a_guess CHECK (paper_answer IS NULL OR paper IS NOT NULL),
  CONSTRAINT message_attachments_answer_stamped CHECK ((paper_answer IS NULL) = (paper_answered_at IS NULL))
);

COMMENT ON TABLE public.message_attachments IS
  'Messages (cut 6): a file or a link on a line. bucket_path is our copy in message-attachments; left_in_gmail a file too big to keep or not copied; url a link. paper is the reader''s guess at a trade partner''s W-9 or certificate (coi, w9), paper_answer the office''s (filed, not_it), stamped by a trigger. The office team reads and answers; the gmail-sync function writes.';

CREATE INDEX IF NOT EXISTS message_attachments_line ON public.message_attachments (message_id, sort_order);

-- The office's answer to a paper offer, stamped with who and when. Its words are the only column the office writes.
CREATE OR REPLACE FUNCTION public.message_attachments_stamp_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.paper_answer IS DISTINCT FROM OLD.paper_answer THEN
    NEW.paper_answered_by := CASE WHEN NEW.paper_answer IS NULL THEN NULL ELSE auth.uid() END;
    NEW.paper_answered_at := CASE WHEN NEW.paper_answer IS NULL THEN NULL ELSE clock_timestamp() END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_attachments_stamp_answer ON public.message_attachments;
CREATE TRIGGER message_attachments_stamp_answer BEFORE UPDATE OF paper_answer ON public.message_attachments
  FOR EACH ROW EXECUTE FUNCTION public.message_attachments_stamp_answer();

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_attachments_team ON public.message_attachments;
CREATE POLICY message_attachments_team ON public.message_attachments FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));

REVOKE ALL ON TABLE public.message_attachments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.message_attachments FROM authenticated;
GRANT SELECT ON TABLE public.message_attachments TO authenticated;
GRANT UPDATE (paper_answer) ON TABLE public.message_attachments TO authenticated;
GRANT ALL ON TABLE public.message_attachments TO service_role;

-- ---------- the contact an address lands on ----------

-- The contact an email's address lands on, by contact_for_channel, with the channel it came on and what the line calls
-- them: the contact's kind, its goes-by, and its name as the thread reads it (its own, else its record's, a trade
-- partner's contact before its company, else the address), as quo_place_number does for a number. An address nobody
-- has makes an unknown contact named p_name (the email's display name) or else the address, with that one address,
-- and made is true. The address's key is locked for the transaction, so two emails from one new address at once make
-- one contact.
CREATE OR REPLACE FUNCTION public.email_place_address(p_value text, p_name text)
RETURNS TABLE (
  placed_contact uuid, placed_channel uuid, made boolean,
  placed_kind text, placed_name text, placed_goes_by text
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key text := public.contact_channel_key('email', p_value);
  v_name text := left(coalesce(nullif(btrim(p_name), ''), btrim(coalesce(p_value, ''))), 200);
  v_contact uuid;
  v_channel uuid;
BEGIN
  IF coalesce(v_key, '') = '' THEN
    RAISE EXCEPTION 'That is not an email address: %', p_value;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('email_place_address:' || v_key, 0));
  v_contact := public.contact_for_channel('email', p_value);
  IF v_contact IS NULL THEN
    INSERT INTO public.contacts (kind, name) VALUES ('unknown', v_name)
      RETURNING id INTO v_contact;
    INSERT INTO public.contact_channels (contact_id, kind, value) VALUES (v_contact, 'email', btrim(p_value))
      RETURNING id INTO v_channel;
    RETURN QUERY SELECT v_contact, v_channel, true, 'unknown'::text, v_name, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ch.contact_id, ch.id, false, c.kind,
      coalesce(
        nullif(btrim(c.name), ''),
        nullif(btrim(CASE
          WHEN c.customer_id IS NOT NULL THEN (SELECT x.name FROM public.customers x WHERE x.id = c.customer_id)
          WHEN c.customer_contact_person_id IS NOT NULL THEN (SELECT x.name FROM public.customer_contact_persons x WHERE x.id = c.customer_contact_person_id)
          WHEN c.gc_company_id IS NOT NULL THEN (SELECT coalesce(nullif(btrim(x.contact_name), ''), x.name) FROM public.gc_companies x WHERE x.id = c.gc_company_id)
          WHEN c.gc_company_person_id IS NOT NULL THEN (SELECT x.name FROM public.gc_company_people x WHERE x.id = c.gc_company_person_id)
          WHEN c.person_id IS NOT NULL THEN (SELECT x.name FROM public.people x WHERE x.id = c.person_id)
        END), ''),
        ch.value),
      c.goes_by
    FROM public.contact_channels ch
    JOIN public.contacts c ON c.id = ch.contact_id
    WHERE ch.contact_id = v_contact AND ch.kind = 'email' AND ch.key = v_key
    ORDER BY ch.created_at, ch.id
    LIMIT 1;
END
$$;

-- ---------- the reader's one write ----------

-- The line by its Gmail id (p_row: messages columns by name, as jsonb; its channel is always email), each file and link
-- in order (p_files: a jsonb array of message_attachments columns by name), and, on a forwarded copy, the forwarder's
-- note as a team note on the same contact (p_note: who_user_id or who_text, at and body, or null). All or nothing,
-- once: a Gmail id already written writes nothing, and the answer is the line it has, with written false.
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
BEGIN
  IF coalesce(btrim(p_gmail_id), '') = '' THEN
    RAISE EXCEPTION 'An email needs its Gmail id.';
  END IF;
  r := jsonb_populate_record(NULL::public.messages, p_row);
  INSERT INTO public.messages AS m (
    contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at,
    subject, body, gmail_id, gmail_thread_id)
  VALUES (
    r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, 'email', r.direction, r.who_user_id,
    coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), r.subject, coalesce(r.body, ''), p_gmail_id,
    r.gmail_thread_id)
  ON CONFLICT (gmail_id) DO NOTHING
  RETURNING m.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, m.id FROM public.messages m WHERE m.gmail_id = p_gmail_id;
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

-- ---------- the reader's place and health ----------

CREATE TABLE IF NOT EXISTS public.gmail_sync_state (
  id boolean PRIMARY KEY DEFAULT true
    CONSTRAINT gmail_sync_state_one_row CHECK (id),
  -- Gmail's history id the next run reads after. Null until the first run after the switch sets it: from then on, no
  -- backfill (the lead's answer to Q3).
  history_id text,
  -- The "In ClickTooling" label's id in bids@, found or made on the first run.
  label_id text,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  -- The lines the last good run wrote.
  last_taken integer NOT NULL DEFAULT 0
    CONSTRAINT gmail_sync_state_taken_counted CHECK (last_taken >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.gmail_sync_state IS
  'Messages (cut 6): the bids@ reader''s one row: where it reads from in Gmail''s history, its label, and its health (last_run_at, last_ok_at, last_error, last_taken). A run that fails sets last_error and leaves last_ok_at. The office team reads it; the gmail-sync function writes it.';

INSERT INTO public.gmail_sync_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.gmail_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gmail_sync_state_team_reads ON public.gmail_sync_state;
CREATE POLICY gmail_sync_state_team_reads ON public.gmail_sync_state FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()));
REVOKE ALL ON TABLE public.gmail_sync_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gmail_sync_state TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gmail_sync_state TO service_role;

-- ---------- the files' bucket ----------

-- <gmail id>/<part>-<name>, private, a file up to 25 MB. The office team reads; only the service role writes, and a copy
-- is never replaced or taken off by anyone signed in.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('message-attachments', 'message-attachments', false, 26214400)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS message_attachments_files_select ON storage.objects;
CREATE POLICY message_attachments_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments' AND (SELECT public.gc_office_team()));

DROP POLICY IF EXISTS message_attachments_files_service ON storage.objects;
CREATE POLICY message_attachments_files_service ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'message-attachments') WITH CHECK (bucket_id = 'message-attachments');

-- ---------- who may call what ----------

REVOKE EXECUTE ON FUNCTION public.email_place_address(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_place_address(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.email_write_line(text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_write_line(text, jsonb, jsonb, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.message_attachments_stamp_answer() FROM PUBLIC, anon, authenticated;

-- ---------- the switch and the cron ----------

-- 'false' until the lead turns it on after the live test (an email to bids@ from the owner's phone). The owner or a dev
-- turns it on or off from the app, through its own UPDATE policy, as 20261013040000_quo_seats.sql's seats are set.
INSERT INTO public.app_settings (key, value_text)
VALUES ('gmail_sync_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_gmail_sync_on ON public.app_settings;
CREATE POLICY master_or_dev_update_gmail_sync_on ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'gmail_sync_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'gmail_sync_on_v1' AND public.is_master_or_dev());

-- Every 3 minutes, gmail-sync with the cron secret, as gc-office-notices's cron calls its function; nothing is sent
-- while the switch is off. Vault PROJECT_URL and CRON_SECRET, uppercase.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gmail-sync';

SELECT cron.schedule(
  'gmail-sync',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'gmail_sync_on_v1' AND value_text = 'true');
  $$
);

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
