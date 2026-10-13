-- Messages, residential R6 (migration *_messages_rfc_message_id): one email sent to both boxes lands once. The line
-- carries the mail's Message-ID, trimmed; the box that reads the same mail second writes nothing, not its files and
-- not its note, and is answered with the line the first box wrote; a Gmail id read again is answered as before; mail
-- with no Message-ID still lands, one line a Gmail id; only an email carries one, and nobody signed in writes it. The
-- reader's writes are made as postgres, standing in for the service role; everything rolls back. Raises on the first
-- failed assertion; ends with "messages_message_id PASSED". See scripts/pgtest-messages-email.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (an assistant) and the sender's thread.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000f1d2', 'assistant@mid.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000f1d2', 'assistant@mid.test', 'Mid Assistant', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.contacts (id, kind, name) VALUES ('00000000-0000-0000-0000-00000000f1c0', 'unknown', 'Mid Sender');

CREATE SCHEMA mmi;
CREATE FUNCTION mmi.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mmi.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION mmi.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Each write's answer, kept by its Gmail id, so a later statement can compare the lines two writes answered with.
CREATE TEMP TABLE mmi_wrote (gmail_id text PRIMARY KEY, written boolean, id uuid);
CREATE FUNCTION mmi.write(p_gmail_id text, p_row jsonb, p_files jsonb DEFAULT '[]'::jsonb, p_note jsonb DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  w record;
BEGIN
  SELECT * INTO w FROM public.email_write_line(p_gmail_id, p_row, p_files, p_note);
  INSERT INTO mmi_wrote (gmail_id, written, id) VALUES (p_gmail_id, w.written, w.id);
  RETURN w.written::text;
END $$;
GRANT USAGE ON SCHEMA mmi TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mmi TO anon, authenticated;

-- 1 · The column, one line a Message-ID, and its rule.
SELECT mmi.same('one line a Message-ID, and only the lines that carry one',
  (SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'messages_rfc_message_id_once'),
  'CREATE UNIQUE INDEX messages_rfc_message_id_once ON public.messages USING btree (rfc_message_id) WHERE (rfc_message_id IS NOT NULL)');
SELECT mmi.same('its rule is checked on every line',
  (SELECT convalidated::text FROM pg_constraint WHERE conname = 'messages_rfc_message_id_said' AND conrelid = 'public.messages'::regclass), 'true');

-- 2 · The first box to read the mail writes it, with its Message-ID trimmed.
SELECT mmi.same('bids@ reads it first and writes the line',
  mmi.write('g-mid-bids',
    '{"contact_id":"00000000-0000-0000-0000-00000000f1c0","direction":"in","body":"Numbers attached.","mailbox":"bids","rfc_message_id":"  <CAF-mid-1@mail.gmail.com> "}',
    '[{"kind":"link","name":"Plans","url":"https://dropbox.example/plans","host":"dropbox"}]'), 'true');
SELECT mmi.same('the line carries the Message-ID as the mail does, trimmed, and its box',
  (SELECT concat_ws('|', rfc_message_id, mailbox) FROM public.messages WHERE gmail_id = 'g-mid-bids'), '<CAF-mid-1@mail.gmail.com>|bids');

-- 3 · The other box reads the same mail second, under its own Gmail id: nothing is written.
SELECT mmi.same('the team box reads it second and writes nothing',
  mmi.write('g-mid-team',
    '{"contact_id":"00000000-0000-0000-0000-00000000f1c0","direction":"in","body":"Numbers attached.","mailbox":"team","rfc_message_id":"<CAF-mid-1@mail.gmail.com>"}',
    '[{"kind":"file","name":"bid.pdf","mime":"application/pdf","size_bytes":1200,"bucket_path":"g-mid-team/1-bid.pdf"}]',
    '{"who_text":"Robert","body":"Seen in the team box."}'), 'false');
SELECT mmi.same('it is answered with the line bids@ wrote',
  (SELECT (t.id = b.id)::text FROM mmi_wrote t, mmi_wrote b WHERE t.gmail_id = 'g-mid-team' AND b.gmail_id = 'g-mid-bids'), 'true');
SELECT mmi.same('one line, still bids@''s, with its one link; no file and no note from the second read',
  (SELECT concat_ws('|',
    (SELECT count(*) FROM public.messages WHERE rfc_message_id = '<CAF-mid-1@mail.gmail.com>'),
    (SELECT count(*) FROM public.messages WHERE gmail_id = 'g-mid-team'),
    (SELECT string_agg(a.kind, ',') FROM public.message_attachments a JOIN public.messages m ON m.id = a.message_id WHERE m.gmail_id = 'g-mid-bids'),
    (SELECT count(*) FROM public.messages WHERE body = 'Seen in the team box.'))),
  '1|0|link|0');
SELECT mmi.same('a Message-ID with space around it is the same mail',
  mmi.write('g-mid-team-2', '{"contact_id":"00000000-0000-0000-0000-00000000f1c0","direction":"in","body":"x","mailbox":"team","rfc_message_id":" <CAF-mid-1@mail.gmail.com>"}'), 'false');

-- 4 · A Gmail id read again is answered as before.
SELECT mmi.same('bids@''s own Gmail id again writes nothing, and is answered with its own line',
  (SELECT w.written::text || '|' || (w.id = b.id)::text
   FROM public.email_write_line('g-mid-bids', '{"contact_id":"00000000-0000-0000-0000-00000000f1c0","direction":"in","body":"x"}'::jsonb) w, mmi_wrote b
   WHERE b.gmail_id = 'g-mid-bids'), 'false|true');

-- 5 · Mail with no Message-ID still lands, one line a Gmail id.
SELECT mmi.same('two emails with no Message-ID, or an empty one, are two lines with none',
  mmi.write('g-mid-none-1', '{"contact_id":"00000000-0000-0000-0000-00000000f1c0","direction":"in","body":"x"}') || '|' ||
  mmi.write('g-mid-none-2', '{"contact_id":"00000000-0000-0000-0000-00000000f1c0","direction":"in","body":"x","rfc_message_id":"   "}') || '|' ||
  (SELECT count(*) FROM public.messages WHERE gmail_id IN ('g-mid-none-1', 'g-mid-none-2') AND rfc_message_id IS NULL),
  'true|true|2');

-- 6 · Only an email carries one, and nobody signed in writes it.
SELECT mmi.refused('a text carries no Message-ID',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, rfc_message_id) VALUES ('00000000-0000-0000-0000-00000000f1c0', 'text', 'in', 'x', '<a@b>')$q$,
  'messages_rfc_message_id_said');
SELECT mmi.refused('a Message-ID longer than a header line',
  format($q$UPDATE public.messages SET rfc_message_id = %L WHERE gmail_id = 'g-mid-none-1'$q$, repeat('x', 999)),
  'messages_rfc_message_id_said');
SELECT mmi.as_user('00000000-0000-0000-0000-00000000f1d2');
SET LOCAL ROLE authenticated;
SELECT mmi.same('the office reads it', (SELECT rfc_message_id FROM public.messages WHERE gmail_id = 'g-mid-bids'), '<CAF-mid-1@mail.gmail.com>');
SELECT mmi.refused('the office writes none', $q$UPDATE public.messages SET rfc_message_id = NULL WHERE gmail_id = 'g-mid-bids'$q$, 'permission denied for table messages');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'messages_message_id PASSED'; END $$;
ROLLBACK;
