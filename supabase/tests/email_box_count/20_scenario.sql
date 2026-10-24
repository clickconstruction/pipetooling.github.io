-- Quickfill's Email station, the counted boxes (migration *_email_box_count, punch list #159): who sees whose inbox
-- facts, and who may change the list. A shared box's rows show to the office team; a person's to that person and to
-- the one lead the owner names, and to nobody else, the owner included unless he names himself; the owner and a dev
-- read and change the list itself; a person changes their own labels and their own switch and nothing else; only the
-- count (the service role, no auth.uid()) writes how a box is doing; a switch turned off deletes the box's threads, and
-- a label dropped deletes that label's threads; training mode changes nothing; nobody signed in reaches anything; the
-- switch, the lead and the limit ship as written, and the cron posts nothing while the switch is off. The count's own
-- writes are made as postgres with no auth.uid(), standing in for the service role; everything rolls back. Raises on
-- the first failed assertion; ends with "email_box_count PASSED". See scripts/pgtest-email-box-count.sh. Never against
-- prod.
\set ON_ERROR_STOP 1
BEGIN;

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
-- How many rows a write touched, as the caller: 0 when the policies keep the row out of reach.
CREATE FUNCTION mem.touched(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_rows integer;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows::text;
END $$;
CREATE FUNCTION mem.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  -- auth.role() reads this claim on the bed's image; app_settings' read policy asks it.
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The count as the service role: no auth.uid().
CREATE FUNCTION mem.as_count() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- What the caller sees: the list's rows, the threads and the trend, as "rows|threads|days".
CREATE FUNCTION mem.seen() RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', (SELECT count(*) FROM public.email_box_watch), (SELECT count(*) FROM public.email_box_threads), (SELECT count(*) FROM public.email_box_days))
$$;
-- The thread ids the caller sees, in order.
CREATE FUNCTION mem.threads_seen() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(gmail_thread_id, ',' ORDER BY gmail_thread_id), '') FROM public.email_box_threads
$$;
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
  EXECUTE btrim((SELECT command FROM cron.job WHERE jobname = 'gmail-count'), E' \n\t;');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows::text;
END $$;
-- A new row's labels, made and taken back as postgres.
CREATE FUNCTION mem.default_labels() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v text;
BEGIN
  INSERT INTO public.email_box_watch (address) VALUES ('default@count.example') RETURNING array_to_string(labels, '|') INTO v;
  DELETE FROM public.email_box_watch WHERE address = 'default@count.example';
  RETURN v;
END $$;
GRANT USAGE ON SCHEMA mem TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mem TO anon, authenticated;


-- The dev, the owner, three office people (Marisol and Bea with boxes of their own, Dale the lead with none), a
-- superintendent outside the office, an estimator in training mode with a box of her own, and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000e01', 'dev@count.test'),
  ('00000000-0000-0000-0000-000000000e02', 'owner@count.test'),
  ('00000000-0000-0000-0000-000000000e03', 'marisol@count.test'),
  ('00000000-0000-0000-0000-000000000e04', 'dale@count.test'),
  ('00000000-0000-0000-0000-000000000e05', 'bea@count.test'),
  ('00000000-0000-0000-0000-000000000e06', 'super@count.test'),
  ('00000000-0000-0000-0000-000000000e07', 'training@count.test'),
  ('00000000-0000-0000-0000-000000000e08', 'twin@count.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000000e01', 'dev@count.test', 'Count Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-000000000e02', 'owner@count.test', 'Count Owner', 'master_technician', false, false),
  ('00000000-0000-0000-0000-000000000e03', 'marisol@count.test', 'Count Marisol', 'assistant', false, false),
  ('00000000-0000-0000-0000-000000000e04', 'dale@count.test', 'Count Dale', 'assistant', false, false),
  ('00000000-0000-0000-0000-000000000e05', 'bea@count.test', 'Count Bea', 'controller', false, false),
  ('00000000-0000-0000-0000-000000000e06', 'super@count.test', 'Count Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-000000000e07', 'training@count.test', 'Count Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-000000000e08', 'twin@count.test', 'Count Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- The list: bids@ shared, and three people's own boxes. Each box has threads; Marisol's two labels have one each.
INSERT INTO public.email_box_watch (id, user_id, address, labels) VALUES
  ('00000000-0000-0000-0000-000000000b01', NULL, 'bids@count.example', ARRAY['Inbox', 'Follow Up']),
  ('00000000-0000-0000-0000-000000000b03', '00000000-0000-0000-0000-000000000e03', 'marisol@count.example', ARRAY['Inbox', 'Follow Up', 'Next Actions']),
  ('00000000-0000-0000-0000-000000000b05', '00000000-0000-0000-0000-000000000e05', 'bea@count.example', ARRAY['Inbox']),
  ('00000000-0000-0000-0000-000000000b07', '00000000-0000-0000-0000-000000000e07', 'training@count.example', ARRAY['Inbox']);
INSERT INTO public.email_box_threads (watch_id, label_name, gmail_thread_id, arrived_at, from_name, subject) VALUES
  ('00000000-0000-0000-0000-000000000b01', 'Inbox', 'tb1', now() - interval '6 days', 'Ridgeway Builders', 'Lot 7 final waivers'),
  ('00000000-0000-0000-0000-000000000b03', 'Inbox', 'tm1', now() - interval '2 days', 'Cedar Bend', 'Building C plans'),
  ('00000000-0000-0000-0000-000000000b03', 'Follow Up', 'tm2', now() - interval '9 days', 'Harlan Freight', 'W-9'),
  ('00000000-0000-0000-0000-000000000b05', 'Inbox', 'tbe1', now() - interval '1 day', 'Toll Co', 'Toll bill'),
  ('00000000-0000-0000-0000-000000000b07', 'Inbox', 'tt1', now() - interval '4 days', 'Applicants', 'Plumber helper');
INSERT INTO public.email_box_days (watch_id, label_name, day, count, oldest_days) VALUES
  ('00000000-0000-0000-0000-000000000b01', 'Inbox', current_date, 1, 6),
  ('00000000-0000-0000-0000-000000000b03', 'Inbox', current_date, 1, 2),
  ('00000000-0000-0000-0000-000000000b05', 'Inbox', current_date, 1, 1),
  ('00000000-0000-0000-0000-000000000b07', 'Inbox', current_date, 1, 4);

-- 1 · As shipped.
SELECT mem.same('the switch ships off, with no lead and a limit of three days',
  (SELECT string_agg(key || '=' || coalesce(value_text, 'null'), '|' ORDER BY key) FROM public.app_settings WHERE key IN ('email_count_on_v1', 'email_count_lead_v1', 'email_count_limit_days_v1')),
  'email_count_lead_v1=|email_count_limit_days_v1=3|email_count_on_v1=false');
UPDATE public.app_settings SET value_text = '00000000-0000-0000-0000-000000000e04' WHERE key = 'email_count_lead_v1';

SELECT mem.same('the cron runs every 15 minutes, and only while the switch is on',
  (SELECT concat_ws('|', schedule, (position('email_count_on_v1' IN command) > 0)::text, (position('/functions/v1/gmail-count' IN command) > 0)::text) FROM cron.job WHERE jobname = 'gmail-count'),
  '*/15 * * * *|true|true');
SELECT mem.same('with the switch off, the cron''s own statement selects nothing to post', mem.cron_posts(), '0');
SELECT mem.refused('an address is one spelling, lower-cased', $q$INSERT INTO public.email_box_watch (address) VALUES ('Work@Count.example')$q$, 'email_box_watch_address_is_one');
SELECT mem.refused('and an address', $q$INSERT INTO public.email_box_watch (address) VALUES ('work')$q$, 'email_box_watch_address_is_one');
SELECT mem.refused('and on the list once', $q$INSERT INTO public.email_box_watch (address) VALUES ('bids@count.example')$q$, 'email_box_watch_one_row_per_address');
SELECT mem.same('a new row counts the three labels', mem.default_labels(), 'Inbox|Follow Up|Next Actions');

-- 2 · Nobody signed in reaches anything.
SET LOCAL ROLE anon;
SELECT mem.refused('no sign-in reads no list', $q$SELECT count(*) FROM public.email_box_watch$q$, 'permission denied for table email_box_watch');
SELECT mem.refused('no threads', $q$SELECT count(*) FROM public.email_box_threads$q$, 'permission denied for table email_box_threads');
SELECT mem.refused('no trend', $q$SELECT count(*) FROM public.email_box_days$q$, 'permission denied for table email_box_days');
SELECT mem.refused('and cannot ask who sees a box', $q$SELECT public.email_box_can_see('00000000-0000-0000-0000-000000000b01')$q$, 'permission denied for function email_box_can_see');
RESET ROLE;

-- 3 · Who sees what.
SELECT mem.as_user('00000000-0000-0000-0000-000000000e06');
SET LOCAL ROLE authenticated;
SELECT mem.same('a superintendent outside the office sees nothing', mem.seen(), '0|0|0');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-000000000e05');
SET LOCAL ROLE authenticated;
SELECT mem.same('Bea, in the office with a box of her own, sees bids@ and her own', mem.seen(), '2|2|2');
SELECT mem.same('and her threads are bids@''s and her own, never Marisol''s', mem.threads_seen(), 'tb1,tbe1');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-000000000e03');
SET LOCAL ROLE authenticated;
SELECT mem.same('Marisol sees bids@ and her own two labels, never Bea''s', mem.threads_seen(), 'tb1,tm1,tm2');
SELECT mem.same('and the rows of those two boxes', mem.seen(), '2|3|2');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-000000000e04');
SET LOCAL ROLE authenticated;
SELECT mem.same('Dale, the lead, with no box of his own, sees everyone''s', mem.seen(), '4|5|4');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-000000000e02');
SET LOCAL ROLE authenticated;
SELECT mem.same('the owner reads the whole list and bids@''s threads, and no person''s while he is not the lead', concat_ws('/', mem.seen(), mem.threads_seen()), '4|1|1/tb1');
SELECT mem.same('the owner may name himself the lead', mem.touched($q$UPDATE public.app_settings SET value_text = '00000000-0000-0000-0000-000000000e02' WHERE key = 'email_count_lead_v1'$q$), '1');
SELECT mem.same('and then sees everyone''s', mem.seen(), '4|5|4');
SELECT mem.same('and names Dale again', mem.touched($q$UPDATE public.app_settings SET value_text = '00000000-0000-0000-0000-000000000e04' WHERE key = 'email_count_lead_v1'$q$), '1');
SELECT mem.same('he may turn the switch on and set the limit', mem.touched($q$UPDATE public.app_settings SET value_text = CASE key WHEN 'email_count_on_v1' THEN 'true' ELSE '5' END WHERE key IN ('email_count_on_v1', 'email_count_limit_days_v1')$q$), '2');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-000000000e01');
SET LOCAL ROLE authenticated;
SELECT mem.same('a dev reads the list and the shared box, as the owner does', concat_ws('/', mem.seen(), mem.threads_seen()), '4|1|1/tb1');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-000000000e08');
SET LOCAL ROLE authenticated;
SELECT mem.same('a digital twin sees no person''s mail', mem.threads_seen(), 'tb1');
RESET ROLE;

-- 4 · What a person may change: their own labels and their own switch, and nothing else.
SELECT mem.as_user('00000000-0000-0000-0000-000000000e05');
SET LOCAL ROLE authenticated;
SELECT mem.same('an office member who is not the owner cannot name the lead', mem.touched($q$UPDATE public.app_settings SET value_text = '00000000-0000-0000-0000-000000000e05' WHERE key = 'email_count_lead_v1'$q$), '0');
SELECT mem.same('nor touch another person''s row', mem.touched($q$UPDATE public.email_box_watch SET labels = ARRAY['Inbox'] WHERE id = '00000000-0000-0000-0000-000000000b03'$q$), '0');
SELECT mem.refused('nor add a box', $q$INSERT INTO public.email_box_watch (address) VALUES ('work@count.example')$q$, 'row-level security');
SELECT mem.same('nor take her own box off the list', mem.touched($q$DELETE FROM public.email_box_watch WHERE id = '00000000-0000-0000-0000-000000000b05'$q$), '0');
SELECT mem.refused('nor write a thread', $q$INSERT INTO public.email_box_threads (watch_id, label_name, gmail_thread_id) VALUES ('00000000-0000-0000-0000-000000000b05', 'Inbox', 'fake')$q$, 'permission denied for table email_box_threads');
SELECT mem.same('she may change her own labels', mem.touched($q$UPDATE public.email_box_watch SET labels = ARRAY['Inbox', 'Waiting'] WHERE id = '00000000-0000-0000-0000-000000000b05'$q$), '1');
SELECT mem.refused('but not her own address', $q$UPDATE public.email_box_watch SET address = 'bea2@count.example' WHERE id = '00000000-0000-0000-0000-000000000b05'$q$, 'Only the owner or a dev changes whose box this is.');
SELECT mem.refused('nor whose box it is', $q$UPDATE public.email_box_watch SET user_id = '00000000-0000-0000-0000-000000000e03' WHERE id = '00000000-0000-0000-0000-000000000b05'$q$, 'Only the owner or a dev changes whose box this is.');
SELECT mem.refused('nor how her box is doing', $q$UPDATE public.email_box_watch SET last_error = NULL, last_ok_at = now() WHERE id = '00000000-0000-0000-0000-000000000b05'$q$, 'Only the count writes how a box is doing.');
SELECT mem.refused('nor what the count found', $q$UPDATE public.email_box_watch SET labels_state = '{"Inbox": {"total": 0}}' WHERE id = '00000000-0000-0000-0000-000000000b05'$q$, 'Only the count writes how a box is doing.');
RESET ROLE;
SELECT mem.as_user('00000000-0000-0000-0000-000000000e07');
SET LOCAL ROLE authenticated;
SELECT mem.refused('training mode changes nothing, not even its own labels', $q$UPDATE public.email_box_watch SET labels = ARRAY['Inbox', 'Waiting'] WHERE id = '00000000-0000-0000-0000-000000000b07'$q$, 'Read-only (training) mode');
RESET ROLE;

-- 5 · Nothing named is kept for a label dropped or a box switched off.
SELECT mem.as_user('00000000-0000-0000-0000-000000000e03');
SET LOCAL ROLE authenticated;
SELECT mem.same('Marisol drops Follow Up and Next Actions, spelling the Inbox her own way', mem.touched($q$UPDATE public.email_box_watch SET labels = ARRAY[' inbox '] WHERE id = '00000000-0000-0000-0000-000000000b03'$q$), '1');
SELECT mem.same('the dropped label''s thread is gone, the Inbox''s stays', mem.threads_seen(), 'tb1,tm1');
SELECT mem.same('she switches her own box off', mem.touched($q$UPDATE public.email_box_watch SET is_on = false WHERE id = '00000000-0000-0000-0000-000000000b03'$q$), '1');
RESET ROLE;
SELECT mem.same('and nothing named is kept of her mail, while the trend''s counts stay',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.email_box_threads WHERE watch_id = '00000000-0000-0000-0000-000000000b03'), (SELECT count(*) FROM public.email_box_days WHERE watch_id = '00000000-0000-0000-0000-000000000b03'))),
  '0|1');

-- 6 · The count writes how a box is doing; the owner changes the list.
SELECT mem.as_count();
SELECT mem.same('the count, with no one signed in, writes the health and what it found',
  mem.touched($q$UPDATE public.email_box_watch SET last_run_at = now(), last_ok_at = now(), last_error = NULL, labels_state = '{"Inbox": {"total": 1, "listed": 1, "cut": false}}' WHERE id = '00000000-0000-0000-0000-000000000b01'$q$), '1');
SELECT mem.as_user('00000000-0000-0000-0000-000000000e02');
SET LOCAL ROLE authenticated;
SELECT mem.same('the owner adds work@ as a shared box', mem.touched($q$INSERT INTO public.email_box_watch (address, added_by) VALUES ('work@count.example', '00000000-0000-0000-0000-000000000e02')$q$), '1');
SELECT mem.same('and takes Bea''s box off the list', mem.touched($q$DELETE FROM public.email_box_watch WHERE id = '00000000-0000-0000-0000-000000000b05'$q$), '1');
RESET ROLE;
SELECT mem.same('which takes her threads and her trend with it',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.email_box_threads WHERE watch_id = '00000000-0000-0000-0000-000000000b05'), (SELECT count(*) FROM public.email_box_days WHERE watch_id = '00000000-0000-0000-0000-000000000b05'))),
  '0|0');
SELECT mem.as_user('00000000-0000-0000-0000-000000000e04');
SET LOCAL ROLE authenticated;
SELECT mem.same('the office team sees the new shared box', (SELECT count(*)::text FROM public.email_box_watch WHERE address = 'work@count.example'), '1');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'email_box_count PASSED'; END $$;
ROLLBACK;
