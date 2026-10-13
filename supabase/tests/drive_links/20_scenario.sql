-- Our own links to a job's Drive files (Messages, cut 7a, migration *_drive_links): the drive-link function makes a link
-- by its hash for one job's file, and nothing else can; a link names one job, ends after it is made and keeps who cut it;
-- the office reads the links and cuts one off, once, stamped with who and when, and nobody else can, nor a twin or
-- training mode; a line we sent says how each file went, and its kind agrees; the opens are page views under drive_link,
-- and the office reads them back with each open's time and never a name. The function's writes are made as postgres,
-- standing in for the service role; presses run as each user; everything rolls back. Raises on the first failed
-- assertion; ends with "drive_links PASSED". See scripts/pgtest-drive-links.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an assistant), a superintendent outside it, an estimator in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@links.test'),
  ('00000000-0000-0000-0000-0000000008d2', 'assistant@links.test'),
  ('00000000-0000-0000-0000-0000000008d3', 'super@links.test'),
  ('00000000-0000-0000-0000-0000000008d4', 'training@links.test'),
  ('00000000-0000-0000-0000-0000000008d5', 'twin@links.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@links.test', 'Links Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000008d2', 'assistant@links.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000008d3', 'super@links.test', 'Links Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000008d4', 'training@links.test', 'Links Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-0000000008d5', 'twin@links.test', 'Links Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Boerne Retail Shell, a GC project, and Greg of Hillside on it, with an email we sent him.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000008c9', 'Links Owner', '00000000-0000-0000-0000-0000000008d1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000008a1', 'Links Boerne Retail Shell', '00000000-0000-0000-0000-0000000008c9');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000008a1', 'bidding');
INSERT INTO public.gc_companies (id, name, contact_name, email, trades) VALUES
  ('00000000-0000-0000-0000-0000000008b1', 'Links Hillside', 'Greg Paulk', 'greg@hillside.example', ARRAY['Sitework']);
INSERT INTO public.contacts (id, kind, gc_company_id) VALUES
  ('00000000-0000-0000-0000-0000000008c1', 'trade', '00000000-0000-0000-0000-0000000008b1');
INSERT INTO public.contact_channels (id, contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008c1', 'email', 'greg@hillside.example');
INSERT INTO public.messages (id, contact_id, channel_id, project_id, channel, direction, who_user_id, who_text, subject, body) VALUES
  ('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-0000000008e1',
   '00000000-0000-0000-0000-0000000008a1', 'email', 'out', '00000000-0000-0000-0000-0000000008d2', 'Rosa · bids@',
   'Boerne Retail Shell: addendum 2 and the plans', 'Greg, here is addendum 2 and the plan set with it.');

CREATE SCHEMA dlk;
CREATE FUNCTION dlk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION dlk.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION dlk.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION dlk.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- The link the function would make: a hash of 64 hex characters.
CREATE FUNCTION dlk.hash(p_seed text) RETURNS text LANGUAGE sql AS $$ SELECT encode(sha256(convert_to(p_seed, 'UTF8')), 'hex') $$;
GRANT USAGE ON SCHEMA dlk TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dlk TO anon, authenticated, service_role;

-- 1 · The function makes a link, as the service role (postgres here): one job, one file, its half, 30 days.
INSERT INTO public.drive_links (id, token_hash, project_id, drive_file_id, half, name, mime, size_bytes, message_id, made_by) VALUES
  ('00000000-0000-0000-0000-000000000811', dlk.hash('k3Pw9xQ'), '00000000-0000-0000-0000-0000000008a1', '1RockClauseMarkedUp0001', 'team_only',
   'Rock clause, marked up.pdf', 'application/pdf', 655360, '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008d2'),
  ('00000000-0000-0000-0000-000000000812', dlk.hash('Bt4bTab'), '00000000-0000-0000-0000-0000000008a1', '1BidTabSitework000002', 'team_only',
   'Bid tab, Sitework.pdf', 'application/pdf', 98304, NULL, '00000000-0000-0000-0000-0000000008d2');
SELECT dlk.same('a link ends 30 days after it is made', (
  SELECT (ends_at - made_at)::text FROM public.drive_links WHERE id = '00000000-0000-0000-0000-000000000811'), '30 days');
SELECT dlk.refused('a link names one job', $q$INSERT INTO public.drive_links (token_hash, drive_file_id, half, name) VALUES (dlk.hash('none'), '1NoJobFile00000001', 'plans', 'x.pdf')$q$,
  'drive_links_one_job');
SELECT dlk.refused('a link keeps a hash, never the link', $q$INSERT INTO public.drive_links (token_hash, project_id, drive_file_id, half, name) VALUES ('k3Pw9xQ', '00000000-0000-0000-0000-0000000008a1', '1NoJobFile00000001', 'plans', 'x.pdf')$q$,
  'drive_links_hash_shape');
SELECT dlk.refused('one hash is one link', $q$INSERT INTO public.drive_links (token_hash, project_id, drive_file_id, half, name) VALUES (dlk.hash('k3Pw9xQ'), '00000000-0000-0000-0000-0000000008a1', '1OtherFile0000000001', 'plans', 'y.pdf')$q$,
  'drive_links_hash');
SELECT dlk.refused('a half is Plans or Team only', $q$INSERT INTO public.drive_links (token_hash, project_id, drive_file_id, half, name) VALUES (dlk.hash('half'), '00000000-0000-0000-0000-0000000008a1', '1OtherFile0000000002', 'everyone', 'z.pdf')$q$,
  'drive_links_half_known');
SELECT dlk.refused('a link ends after it is made', $q$INSERT INTO public.drive_links (token_hash, project_id, drive_file_id, half, name, ends_at) VALUES (dlk.hash('ended'), '00000000-0000-0000-0000-0000000008a1', '1OtherFile0000000003', 'plans', 'w.pdf', now() - interval '1 day')$q$,
  'drive_links_ends_after_made');

-- 2 · Who reads the links, and who writes them: the office reads, and nobody signed in writes one.
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT dlk.same('the office reads the links', (SELECT count(*)::text FROM public.drive_links), '2');
SELECT dlk.refused('the office makes no link of its own', $q$INSERT INTO public.drive_links (token_hash, project_id, drive_file_id, half, name) VALUES (dlk.hash('mine'), '00000000-0000-0000-0000-0000000008a1', '1OtherFile0000000004', 'plans', 'v.pdf')$q$,
  'permission denied');
SELECT dlk.refused('nor cuts one off by hand', $q$UPDATE public.drive_links SET cut_at = now() WHERE id = '00000000-0000-0000-0000-000000000811'$q$,
  'permission denied');
RESET ROLE;
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d3');
SET LOCAL ROLE authenticated;
SELECT dlk.same('a superintendent reads no link', (SELECT count(*)::text FROM public.drive_links), '0');
RESET ROLE;
SELECT dlk.as_anon();
SET LOCAL ROLE anon;
SELECT dlk.refused('nobody signed out reads a link', $q$SELECT count(*) FROM public.drive_links$q$, 'permission denied');
RESET ROLE;

-- 3 · The office cuts a link off, once, stamped with who and when.
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d3');
SET LOCAL ROLE authenticated;
SELECT dlk.refused('a superintendent cuts nothing off', $q$SELECT public.cut_drive_link('00000000-0000-0000-0000-000000000811')$q$,
  'Only the office cuts a link off.');
RESET ROLE;
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d5');
SET LOCAL ROLE authenticated;
SELECT dlk.refused('a twin cuts nothing off', $q$SELECT public.cut_drive_link('00000000-0000-0000-0000-000000000811')$q$,
  'A digital twin cannot cut a link off.');
RESET ROLE;
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d4');
SET LOCAL ROLE authenticated;
SELECT dlk.refused('training mode cuts nothing off', $q$SELECT public.cut_drive_link('00000000-0000-0000-0000-000000000811')$q$,
  'A training account cannot cut a link off.');
RESET ROLE;
SELECT dlk.as_anon();
SET LOCAL ROLE anon;
SELECT dlk.refused('nobody signed out cuts one off', $q$SELECT public.cut_drive_link('00000000-0000-0000-0000-000000000811')$q$, 'permission denied');
RESET ROLE;
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT dlk.refused('a link not there', $q$SELECT public.cut_drive_link('00000000-0000-0000-0000-0000000008ff')$q$,
  'That link is not there.');
SELECT public.cut_drive_link('00000000-0000-0000-0000-000000000811');
RESET ROLE;
SELECT dlk.same('Rosa cut it off, stamped', (
  SELECT (cut_at IS NOT NULL)::text || ' ' || coalesce(u.name, '') FROM public.drive_links l LEFT JOIN public.users u ON u.id = l.cut_by
  WHERE l.id = '00000000-0000-0000-0000-000000000811'), 'true Rosa');
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d1');
SET LOCAL ROLE authenticated;
SELECT dlk.same('a second cut answers the first, and keeps its name', (
  SELECT (public.cut_drive_link('00000000-0000-0000-0000-000000000811') = l.cut_at)::text FROM public.drive_links l
  WHERE l.id = '00000000-0000-0000-0000-000000000811'), 'true');
RESET ROLE;
SELECT dlk.same('the cut stays Rosa''s', (
  SELECT u.name FROM public.drive_links l JOIN public.users u ON u.id = l.cut_by WHERE l.id = '00000000-0000-0000-0000-000000000811'), 'Rosa');
SELECT dlk.same('the other link stands', (
  SELECT (cut_at IS NULL)::text FROM public.drive_links WHERE id = '00000000-0000-0000-0000-000000000812'), 'true');

-- 4 · A line we sent says how each file went, and its kind agrees; a line that came in says nothing.
INSERT INTO public.message_attachments (message_id, sort_order, kind, name, mime, size_bytes, bucket_path, sent_as, drive_file_id) VALUES
  ('00000000-0000-0000-0000-0000000008f1', 0, 'file', 'Addendum 2.pdf', 'application/pdf', 421888, 'out/00000000-0000-0000-0000-0000000008f1/0-Addendum 2.pdf', 'file', '1Addendum2Plans000001');
INSERT INTO public.message_attachments (message_id, sort_order, kind, name, url, sent_as, drive_link_id) VALUES
  ('00000000-0000-0000-0000-0000000008f1', 1, 'link', 'Rock clause, marked up.pdf', 'https://clicktooling.com/f/k3Pw9xQ', 'link', '00000000-0000-0000-0000-000000000811'),
  ('00000000-0000-0000-0000-0000000008f1', 2, 'link', 'Boerne Retail Shell plans, rev 2', 'https://clicktooling.com/t/7Hq2#plans', 'link', NULL);
SELECT dlk.same('the line keeps its three files, each as it went', (
  SELECT string_agg(name || ':' || sent_as, ' | ' ORDER BY sort_order) FROM public.message_attachments WHERE message_id = '00000000-0000-0000-0000-0000000008f1'),
  'Addendum 2.pdf:file | Rock clause, marked up.pdf:link | Boerne Retail Shell plans, rev 2:link');
SELECT dlk.refused('a file cannot have gone as a link', $q$INSERT INTO public.message_attachments (message_id, sort_order, kind, name, bucket_path, sent_as) VALUES ('00000000-0000-0000-0000-0000000008f1', 3, 'file', 'a.pdf', 'out/x/3-a.pdf', 'link')$q$,
  'message_attachments_sent_as_fits');
SELECT dlk.refused('a link cannot have gone as the file', $q$INSERT INTO public.message_attachments (message_id, sort_order, kind, name, url, sent_as) VALUES ('00000000-0000-0000-0000-0000000008f1', 3, 'link', 'b', 'https://clicktooling.com/f/zz', 'file')$q$,
  'message_attachments_sent_as_fits');
SELECT dlk.refused('a way out it does not know', $q$INSERT INTO public.message_attachments (message_id, sort_order, kind, name, bucket_path, sent_as) VALUES ('00000000-0000-0000-0000-0000000008f1', 3, 'file', 'c.pdf', 'out/x/3-c.pdf', 'fax')$q$,
  'message_attachments_sent_as_known');
SELECT dlk.refused('our link rides only on a link we sent', $q$INSERT INTO public.message_attachments (message_id, sort_order, kind, name, bucket_path, drive_link_id) VALUES ('00000000-0000-0000-0000-0000000008f1', 3, 'file', 'd.pdf', 'out/x/3-d.pdf', '00000000-0000-0000-0000-000000000812')$q$,
  'message_attachments_our_link_is_sent');
SELECT dlk.refused('a Drive file is a Drive id', $q$INSERT INTO public.message_attachments (message_id, sort_order, kind, name, bucket_path, sent_as, drive_file_id) VALUES ('00000000-0000-0000-0000-0000000008f1', 3, 'file', 'e.pdf', 'out/x/3-e.pdf', 'file', 'not a drive id!')$q$,
  'message_attachments_drive_file_shape');
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT dlk.refused('the office writes no way out of its own', $q$UPDATE public.message_attachments SET sent_as = 'file' WHERE message_id = '00000000-0000-0000-0000-0000000008f1' AND sort_order = 0$q$,
  'permission denied');
RESET ROLE;

-- 5 · The opens are page views under drive_link, and the office reads them back: how many, the last, each time, no name.
INSERT INTO public.public_page_views (surface, entity_id, via, viewer, occurred_at) VALUES
  ('drive_link', '00000000-0000-0000-0000-000000000812', 'token', 'outside', TIMESTAMPTZ '2026-10-09 21:42:00+00'),
  ('drive_link', '00000000-0000-0000-0000-000000000812', 'token', 'outside', TIMESTAMPTZ '2026-10-12 19:10:00+00'),
  ('drive_link', '00000000-0000-0000-0000-000000000812', 'token', 'staff', TIMESTAMPTZ '2026-10-12 19:20:00+00');
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT dlk.same('the office reads the outside opens, newest first', (
  SELECT opens::text || ' ' || to_char(last_opened_at AT TIME ZONE 'UTC', 'MM-DD HH24:MI') || ' ' || array_length(opened_at, 1)::text || ' '
    || to_char(opened_at[1] AT TIME ZONE 'UTC', 'MM-DD HH24:MI')
  FROM public.drive_link_views(ARRAY['00000000-0000-0000-0000-000000000812'::uuid])), '2 10-12 19:10 2 10-12 19:10');
RESET ROLE;
SELECT dlk.as_user('00000000-0000-0000-0000-0000000008d3');
SET LOCAL ROLE authenticated;
SELECT dlk.same('a superintendent reads no opens', (
  SELECT count(*)::text FROM public.drive_link_views(ARRAY['00000000-0000-0000-0000-000000000812'::uuid])), '0');
RESET ROLE;
SELECT dlk.refused('a page view names a surface the table knows', $q$INSERT INTO public.public_page_views (surface, entity_id) VALUES ('drive_links', '00000000-0000-0000-0000-000000000812')$q$,
  'public_page_views_surface_check');

-- 6 · As shipped: anon runs neither function, the office runs both.
SELECT dlk.same('who runs the two functions', (
  SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE')::text || '/' || has_function_privilege('authenticated', f, 'EXECUTE')::text, ' ' ORDER BY f)
  FROM unnest(ARRAY['public.cut_drive_link(uuid)', 'public.drive_link_views(uuid[])']) AS f),
  'public.cut_drive_link(uuid):false/true public.drive_link_views(uuid[]):false/true');

DO $$ BEGIN RAISE NOTICE 'drive_links PASSED'; END $$;
ROLLBACK;
