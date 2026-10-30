-- Messages, cut 6, email in (migration *_messages_email_in): an email the reader takes twice is one line, with its files
-- and links in order; a forwarded copy's note is a team note on the same thread; the files and links keep their rules;
-- an address finds its person by its key, and a new address makes one unknown contact; the office reads the files, the
-- reader's state and the bucket, answers a paper offer, stamped with who and when, and writes nothing else; training mode
-- and a digital twin answer nothing; nobody signed in reaches the reader's functions; the bucket, the switch and the cron
-- are as shipped. The reader's writes are made as postgres, standing in for the service role; everything rolls back.
-- Raises on the first failed assertion; ends with "messages_email PASSED". See scripts/pgtest-messages-email.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an assistant), a superintendent outside it, an estimator in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@email.test'),
  ('00000000-0000-0000-0000-0000000007d2', 'assistant@email.test'),
  ('00000000-0000-0000-0000-0000000007d3', 'super@email.test'),
  ('00000000-0000-0000-0000-0000000007d4', 'training@email.test'),
  ('00000000-0000-0000-0000-0000000007d5', 'twin@email.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@email.test', 'Email Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000007d2', 'assistant@email.test', 'Email Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000007d3', 'super@email.test', 'Email Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000007d4', 'training@email.test', 'Email Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-0000000007d5', 'twin@email.test', 'Email Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A trade partner whose main contact is Greg, and his contact as the spine's seed makes it (no name of its own), with
-- his address. A trade partner needs a trade (gc_companies_has_a_trade).
INSERT INTO public.gc_companies (id, name, contact_name, email, trades) VALUES
  ('00000000-0000-0000-0000-0000000007a1', 'Email Hillside', 'Greg Paulk', 'greg@hillside.example', ARRAY['Sitework']);
INSERT INTO public.contacts (id, kind, gc_company_id) VALUES
  ('00000000-0000-0000-0000-0000000007c1', 'trade', '00000000-0000-0000-0000-0000000007a1');
INSERT INTO public.contact_channels (id, contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007c1', 'email', 'greg@hillside.example');

CREATE SCHEMA mem;
CREATE FUNCTION mem.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mem.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mem.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The rows the cron's own statement selects to post, run as cron runs it. The bed's image may have no vault: a stand-in
-- table lets the statement read its secrets' names; its WHERE decides before any secret is read.
DO $$
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS vault;
    CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
  END IF;
END $$;
CREATE FUNCTION mem.cron_posts() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_rows integer;
BEGIN
  EXECUTE btrim((SELECT command FROM cron.job WHERE jobname = 'gmail-sync'), E' \n\t;');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows::text;
END $$;
-- email_place_address's answer in one line: the contact, made, kind, name.
CREATE FUNCTION mem.placed(p_value text, p_name text) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', p.placed_contact::text, p.made::text, p.placed_kind, p.placed_name) FROM public.email_place_address(p_value, p_name) p
$$;
-- email_write_line's answer in one line: written, and the line it wrote or has.
CREATE FUNCTION mem.wrote(p_gmail_id text, p_row jsonb, p_files jsonb, p_note jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', w.written::text, w.id::text) FROM public.email_write_line(p_gmail_id, p_row, p_files, p_note) w
$$;
-- A line's files and links in order, one word a field, as the office reads them.
CREATE FUNCTION mem.files(p_gmail_id text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(concat_ws(':', a.sort_order::text, a.kind, a.name, coalesce(a.bucket_path, a.left_in_gmail, a.url), coalesce(a.paper, '-')), ', ' ORDER BY a.sort_order), '')
  FROM public.message_attachments a JOIN public.messages m ON m.id = a.message_id WHERE m.gmail_id = p_gmail_id
$$;
GRANT USAGE ON SCHEMA mem TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mem TO anon, authenticated;

-- 1 · An email's line keeps its rules.
SELECT mem.refused('a Gmail id is only on an email',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, gmail_id) VALUES ('00000000-0000-0000-0000-0000000007c1', 'text', 'in', 'x', 'g-x')$q$,
  'messages_gmail_on_email');
SELECT mem.refused('a Gmail thread needs its Gmail id',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, gmail_thread_id) VALUES ('00000000-0000-0000-0000-0000000007c1', 'email', 'in', 'x', 't-x')$q$,
  'messages_gmail_on_email');

-- 2 · Whose address it is.
SELECT mem.same('Greg''s address, in capitals, is his, named as his company names him',
  mem.placed('GREG@Hillside.example', 'Greg P'), '00000000-0000-0000-0000-0000000007c1|false|trade|Greg Paulk');
SELECT mem.same('a new address makes an unknown contact, named by the email''s display name',
  (SELECT concat_ws('|', p.made::text, p.placed_kind, p.placed_name) FROM public.email_place_address('estimating@alamoconcrete.example', 'Alamo Estimating') p),
  'true|unknown|Alamo Estimating');
CREATE TEMP TABLE ids AS SELECT
  (SELECT contact_id FROM public.contact_channels WHERE kind = 'email' AND key = 'estimating@alamoconcrete.example') AS alamo,
  (SELECT id FROM public.contact_channels WHERE kind = 'email' AND key = 'estimating@alamoconcrete.example') AS alamo_channel;
GRANT SELECT ON ids TO authenticated;
SELECT mem.same('the same new address again is the same contact',
  (SELECT concat_ws('|', (p.placed_contact = i.alamo)::text, p.made::text) FROM public.email_place_address(' Estimating@AlamoConcrete.example ', NULL) p, ids i),
  'true|false');
SELECT mem.same('one contact and one address for it',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.contacts c WHERE c.id = i.alamo), (SELECT count(*) FROM public.contact_channels ch WHERE ch.contact_id = i.alamo)) FROM ids i),
  '1|1');
SELECT mem.same('an address with no display name names its contact',
  (SELECT concat_ws('|', p.made::text, p.placed_name) FROM public.email_place_address('dee@alamoconcrete.example', '  ') p),
  'true|dee@alamoconcrete.example');
SELECT mem.refused('words that are not an address', $q$SELECT public.email_place_address('call me', NULL)$q$, 'That is not an email address');

-- 3 · The reader's one write.
SELECT mem.same('Greg''s email is written, with its four files and links',
  split_part(mem.wrote('g-1',
    jsonb_build_object('contact_id', '00000000-0000-0000-0000-0000000007c1', 'channel_id', '00000000-0000-0000-0000-0000000007e1',
      'direction', 'in', 'who_text', 'Greg Paulk <greg@hillside.example> to bids@', 'at', '2026-10-02T16:30:00Z',
      'subject', 'Hillside sitework, Boerne, rev 1', 'body', 'Numbers attached.', 'gmail_thread_id', 't-1'),
    jsonb_build_array(
      jsonb_build_object('kind', 'file', 'name', 'Hillside-Boerne-sitework-rev1.pdf', 'mime', 'application/pdf', 'size_bytes', 1250000, 'bucket_path', 'g-1/1-Hillside-Boerne-sitework-rev1.pdf'),
      jsonb_build_object('kind', 'file', 'name', 'full-set.zip', 'mime', 'application/zip', 'size_bytes', 31000000, 'left_in_gmail', 'too_big', 'gmail_attachment_id', 'att-3'),
      jsonb_build_object('kind', 'link', 'name', 'WeTransfer link', 'url', 'https://we.tl/t-AbC123', 'host', 'wetransfer'),
      jsonb_build_object('kind', 'file', 'name', 'Hillside COI 2027.pdf', 'mime', 'application/pdf', 'size_bytes', 380000, 'bucket_path', 'g-1/4-Hillside COI 2027.pdf', 'paper', 'coi')),
    NULL), '|', 1),
  'true');
CREATE TEMP TABLE line AS SELECT id FROM public.messages WHERE gmail_id = 'g-1';
GRANT SELECT ON line TO authenticated;
SELECT mem.same('the line is an email with its Gmail ids',
  (SELECT concat_ws('|', m.channel, m.direction, m.subject, m.gmail_thread_id, m.body) FROM public.messages m WHERE m.gmail_id = 'g-1'),
  'email|in|Hillside sitework, Boerne, rev 1|t-1|Numbers attached.');
SELECT mem.same('its files and links, in order',
  mem.files('g-1'),
  '0:file:Hillside-Boerne-sitework-rev1.pdf:g-1/1-Hillside-Boerne-sitework-rev1.pdf:-, 1:file:full-set.zip:too_big:-, 2:link:WeTransfer link:https://we.tl/t-AbC123:-, 3:file:Hillside COI 2027.pdf:g-1/4-Hillside COI 2027.pdf:coi');
SELECT mem.same('taken again, it writes nothing and answers the line it has',
  (SELECT mem.wrote('g-1', jsonb_build_object('contact_id', '00000000-0000-0000-0000-0000000007c1', 'direction', 'in', 'body', 'again'),
    jsonb_build_array(jsonb_build_object('kind', 'link', 'name', 'x', 'url', 'https://we.tl/t-x', 'host', 'wetransfer')), NULL) = 'false|' || l.id FROM line l)::text,
  'true');
SELECT mem.same('still one line and four files',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.messages WHERE gmail_id = 'g-1'), (SELECT count(*) FROM public.message_attachments a JOIN line l ON l.id = a.message_id))),
  '1|4');
SELECT mem.same('a forwarded copy is written with the forwarder''s note as a team note on the same thread',
  split_part((SELECT mem.wrote('g-2',
    jsonb_build_object('contact_id', i.alamo, 'channel_id', i.alamo_channel, 'direction', 'in',
      'who_text', 'Alamo Estimating <estimating@alamoconcrete.example> · forwarded to bids@ by Email Assistant', 'at', '2026-10-01T21:02:00Z',
      'subject', 'Flatwork', 'body', 'Our quote is attached.', 'gmail_thread_id', 't-2'),
    '[]'::jsonb,
    jsonb_build_object('who_user_id', '00000000-0000-0000-0000-0000000007d2', 'at', '2026-10-02T15:00:00Z', 'body', 'Please put this on Boerne.')) FROM ids i), '|', 1),
  'true');
SELECT mem.same('the thread reads the email, then the note',
  (SELECT string_agg(concat_ws(':', m.channel, m.direction, m.body), ' / ' ORDER BY m.at) FROM public.messages m, ids i WHERE m.contact_id = i.alamo),
  'email:in:Our quote is attached. / note:team:Please put this on Boerne.');
SELECT mem.refused('an email needs its Gmail id', $q$SELECT public.email_write_line('  ', '{}'::jsonb, '[]'::jsonb, NULL)$q$, 'An email needs its Gmail id.');

-- 4 · What a file or a link may say.
SELECT mem.refused('a link needs its url',
  $q$INSERT INTO public.message_attachments (message_id, kind, name) SELECT id, 'link', 'x' FROM line$q$, 'message_attachments_link_or_file');
SELECT mem.refused('a file is our copy or left in Gmail, never both',
  $q$INSERT INTO public.message_attachments (message_id, kind, name, bucket_path, left_in_gmail) SELECT id, 'file', 'x', 'g-1/x', 'too_big' FROM line$q$, 'message_attachments_link_or_file');
SELECT mem.refused('a file is our copy or left in Gmail, never neither',
  $q$INSERT INTO public.message_attachments (message_id, kind, name) SELECT id, 'file', 'x' FROM line$q$, 'message_attachments_link_or_file');
SELECT mem.refused('a link is never a paper',
  $q$INSERT INTO public.message_attachments (message_id, kind, name, url, paper) SELECT id, 'link', 'x', 'https://we.tl/t-x', 'coi' FROM line$q$, 'message_attachments_link_or_file');
-- Since 20261030080000 (punch list #179, v2.6141) an answer stands on a guessed paper or on our copy: a file left in
-- Gmail, with neither, takes none.
SELECT mem.refused('an answer needs a guess or our copy',
  $q$UPDATE public.message_attachments SET paper_answer = 'filed' WHERE name = 'full-set.zip'$q$, 'message_attachments_answer_to_an_offer');
SELECT mem.refused('a kind we do not have',
  $q$INSERT INTO public.message_attachments (message_id, kind, name, url) SELECT id, 'fax', 'x', 'https://we.tl/t-x' FROM line$q$, 'message_attachments_kind_known');
SELECT mem.refused('a paper we do not guess',
  $q$INSERT INTO public.message_attachments (message_id, kind, name, bucket_path, paper) SELECT id, 'file', 'x', 'g-1/x', 'w2' FROM line$q$, 'message_attachments_paper_known');

-- 5 · The bucket, the reader's state, the switch and the cron, as shipped.
SELECT mem.same('the bucket is private and keeps a file up to 25 MB',
  (SELECT concat_ws('|', public::text, file_size_limit::text) FROM storage.buckets WHERE id = 'message-attachments'), 'false|26214400');
SELECT mem.same('the reader has one row, with no place yet',
  (SELECT concat_ws('|', count(*), count(history_id), count(last_run_at)) FROM public.gmail_sync_state), '1|0|0');
-- One row a box since R6 (*_messages_two_boxes): today's is bids@'s.
SELECT mem.refused('and only one for bids@', $q$INSERT INTO public.gmail_sync_state (mailbox) VALUES ('bids')$q$, 'gmail_sync_state_pkey');
SELECT mem.same('the switch ships off', (SELECT value_text FROM public.app_settings WHERE key = 'gmail_sync_on_v1'), 'false');
SELECT mem.same('the cron runs every minute (v2.5719; every 3 before), and only while the switch is on',
  (SELECT concat_ws('|', schedule, (position('gmail_sync_on_v1' IN command) > 0)::text, (position('/functions/v1/gmail-sync' IN command) > 0)::text) FROM cron.job WHERE jobname = 'gmail-sync'),
  '* * * * *|true|true');
SELECT mem.same('with the switch off, the cron''s own statement selects nothing to post', mem.cron_posts(), '0');
INSERT INTO storage.objects (bucket_id, name) VALUES ('message-attachments', 'g-1/1-Hillside-Boerne-sitework-rev1.pdf');

-- 6 · Who reads, and what the office writes.
SET LOCAL ROLE anon;
SELECT mem.refused('no sign-in reads no files', $q$SELECT count(*) FROM public.message_attachments$q$, 'permission denied for table message_attachments');
SELECT mem.refused('no sign-in reads no state', $q$SELECT count(*) FROM public.gmail_sync_state$q$, 'permission denied for table gmail_sync_state');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-0000000007d3');
SET LOCAL ROLE authenticated;
SELECT mem.same('a superintendent outside the office reads no files, no state and no copies',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.message_attachments), (SELECT count(*) FROM public.gmail_sync_state),
    (SELECT count(*) FROM storage.objects WHERE bucket_id = 'message-attachments'))),
  '0|0|0');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT mem.same('the office reads the line''s files, the reader''s state and our copy',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.message_attachments a JOIN line l ON l.id = a.message_id), (SELECT count(*) FROM public.gmail_sync_state),
    (SELECT count(*) FROM storage.objects WHERE bucket_id = 'message-attachments'))),
  '4|1|1');
UPDATE public.message_attachments SET paper_answer = 'not_it' WHERE paper = 'coi';
SELECT mem.same('the office answers the offer, stamped with who',
  (SELECT concat_ws('|', paper_answer, paper_answered_by::text, (paper_answered_at IS NOT NULL)::text) FROM public.message_attachments WHERE paper = 'coi'),
  'not_it|00000000-0000-0000-0000-0000000007d2|true');
-- A bill on a supply house's thread carries no guess: its Not a bill, or its 'filed' after Save, stands on our copy
-- (punch list #179, v2.6141). Taken back after, so the steps below read the file as before.
UPDATE public.message_attachments SET paper_answer = 'not_it' WHERE name = 'Hillside-Boerne-sitework-rev1.pdf';
SELECT mem.same('the office answers a kept file with no guess, as a bill, stamped with who',
  (SELECT concat_ws('|', paper_answer, paper_answered_by::text, (paper_answered_at IS NOT NULL)::text) FROM public.message_attachments WHERE name = 'Hillside-Boerne-sitework-rev1.pdf'),
  'not_it|00000000-0000-0000-0000-0000000007d2|true');
UPDATE public.message_attachments SET paper_answer = NULL WHERE name = 'Hillside-Boerne-sitework-rev1.pdf';
SELECT mem.refused('the office writes no other column', $q$UPDATE public.message_attachments SET name = 'x' WHERE paper = 'coi'$q$, 'permission denied for table message_attachments');
SELECT mem.refused('the office adds no file', $q$INSERT INTO public.message_attachments (message_id, kind, name, url) SELECT id, 'link', 'x', 'https://we.tl/t-x' FROM line$q$, 'permission denied for table message_attachments');
SELECT mem.refused('the office takes no file off', $q$DELETE FROM public.message_attachments$q$, 'permission denied for table message_attachments');
SELECT mem.refused('the office writes no state', $q$UPDATE public.gmail_sync_state SET last_error = 'x'$q$, 'permission denied for table gmail_sync_state');
SELECT mem.refused('the office places no address', $q$SELECT public.email_place_address('x@y.example', NULL)$q$, 'permission denied for function email_place_address');
SELECT mem.refused('the office writes no email', $q$SELECT public.email_write_line('g-9', '{}'::jsonb, '[]'::jsonb, NULL)$q$, 'permission denied for function email_write_line');
SELECT mem.refused('the office adds no copy to the bucket', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('message-attachments', 'g-9/x.pdf')$q$, 'row-level security');
RESET ROLE;

-- The owner or a dev turns the reader on or off from the app; nobody else does.
SELECT mem.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = 'true' WHERE key = 'gmail_sync_on_v1';
RESET ROLE;
SELECT mem.same('a dev turns the reader on', (SELECT value_text FROM public.app_settings WHERE key = 'gmail_sync_on_v1'), 'true');
SELECT mem.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = 'false' WHERE key = 'gmail_sync_on_v1';
RESET ROLE;
SELECT mem.same('an assistant does not turn it off', (SELECT value_text FROM public.app_settings WHERE key = 'gmail_sync_on_v1'), 'true');
UPDATE public.app_settings SET value_text = 'false' WHERE key = 'gmail_sync_on_v1';

-- 7 · Training mode and a digital twin answer nothing.
SELECT mem.as_user('00000000-0000-0000-0000-0000000007d4');
SET LOCAL ROLE authenticated;
SELECT mem.refused('training mode answers no offer', $q$UPDATE public.message_attachments SET paper_answer = 'filed' WHERE paper = 'coi'$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-0000000007d5');
SET LOCAL ROLE authenticated;
UPDATE public.message_attachments SET paper_answer = 'filed' WHERE paper = 'coi';
RESET ROLE;
SELECT mem.same('a twin''s answer changes nothing',
  (SELECT concat_ws('|', paper_answer, paper_answered_by::text) FROM public.message_attachments WHERE paper = 'coi'),
  'not_it|00000000-0000-0000-0000-0000000007d2');

-- 8 · A line goes with its contact: a fold moves the email and its files to the person.
SELECT public.contacts_fold((SELECT alamo FROM ids), '00000000-0000-0000-0000-0000000007c1');
SELECT mem.same('the folded thread''s email and its note are Greg''s now, beside his own email',
  (SELECT concat_ws('|', m.contact_id::text, (SELECT count(*) FROM public.messages n WHERE n.contact_id = '00000000-0000-0000-0000-0000000007c1')) FROM public.messages m WHERE m.gmail_id = 'g-2'),
  '00000000-0000-0000-0000-0000000007c1|3');

DO $$ BEGIN RAISE NOTICE 'messages_email PASSED'; END $$;
ROLLBACK;
