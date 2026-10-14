-- quo-send's tech path, its doors (Messages, residential R5, migration *_messages_tech_send): messages_tech_on_job says
-- whether a tech is dispatched to or clocked on a job this week or last; messages_tech_can_read, recreated on it, gives
-- the same answers; contact_for_job finds or makes the job's customer's own contact for a tech on the job, said in
-- words for anyone else, a job with no customer, a training account and a twin; contact_for_customer keeps the office's
-- door; the find-or-make body opens to nobody signed in. Fixtures are written as postgres; presses run as each user;
-- everything rolls back. Raises on the first failed assertion; ends with "messages_tech_send PASSED".
-- See scripts/pgtest-messages-tech-send.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Luis (primary) is dispatched to Dana's job today; Hector (helpers) clocked on it last week; Paul (primary) was
-- dispatched to it three weeks ago; Kim (primary) is on Kevin's job only; Sal is a superintendent dispatched to Dana's
-- job today; Tess (primary) is dispatched to it today in training mode; Rosa is the office.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000085d1', 'luis@techsend.test'),
  ('00000000-0000-0000-0000-0000000085d2', 'hector@techsend.test'),
  ('00000000-0000-0000-0000-0000000085d3', 'paul@techsend.test'),
  ('00000000-0000-0000-0000-0000000085d4', 'kim@techsend.test'),
  ('00000000-0000-0000-0000-0000000085d5', 'sal@techsend.test'),
  ('00000000-0000-0000-0000-0000000085d6', 'tess@techsend.test'),
  ('00000000-0000-0000-0000-0000000085d7', 'rosa@techsend.test'),
  ('00000000-0000-0000-0000-0000000085d8', 'dev@techsend.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000085d1', 'luis@techsend.test', 'Luis Tech', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000085d2', 'hector@techsend.test', 'Hector Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000085d3', 'paul@techsend.test', 'Paul Tech', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000085d4', 'kim@techsend.test', 'Kim Tech', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000085d5', 'sal@techsend.test', 'Sal Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000085d6', 'tess@techsend.test', 'Tess Training', 'primary', true, false),
  ('00000000-0000-0000-0000-0000000085d7', 'rosa@techsend.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000085d8', 'dev@techsend.test', 'Tech Send Dev', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Dana Whitfield with a number on her row and no contact yet; Kevin Alvarez with a contact already. Three Pipeline jobs:
-- Dana's, Kevin's, and one with no customer.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000085c1', 'Tech Send Dana Whitfield', '00000000-0000-0000-0000-0000000085d8', '{"phone": "(512) 555-0182"}'),
  ('00000000-0000-0000-0000-0000000085c2', 'Tech Send Kevin Alvarez', '00000000-0000-0000-0000-0000000085d8', '{}');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000085f9', 'Tech Send Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000085b1', '00000000-0000-0000-0000-0000000085d8', '00000000-0000-0000-0000-0000000085f9', 'Oakridge sewer line', '00000000-0000-0000-0000-0000000085c1'),
  ('00000000-0000-0000-0000-0000000085b2', '00000000-0000-0000-0000-0000000085d8', '00000000-0000-0000-0000-0000000085f9', 'Alvarez water heater', '00000000-0000-0000-0000-0000000085c2'),
  ('00000000-0000-0000-0000-0000000085b3', '00000000-0000-0000-0000-0000000085d8', '00000000-0000-0000-0000-0000000085f9', 'A job with no customer', NULL);
INSERT INTO public.contacts (id, kind, customer_id) VALUES
  ('00000000-0000-0000-0000-000000008501', 'customer', '00000000-0000-0000-0000-0000000085c2');

-- Dispatch and the clock, counted from today in Chicago: this week, last week, three weeks ago.
INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end) VALUES
  ('00000000-0000-0000-0000-0000000085b1', '00000000-0000-0000-0000-0000000085d1', (now() AT TIME ZONE 'America/Chicago')::date, '08:00', '12:00'),
  ('00000000-0000-0000-0000-0000000085b3', '00000000-0000-0000-0000-0000000085d1', (now() AT TIME ZONE 'America/Chicago')::date, '13:00', '15:00'),
  ('00000000-0000-0000-0000-0000000085b1', '00000000-0000-0000-0000-0000000085d3', (now() AT TIME ZONE 'America/Chicago')::date - 21, '08:00', '12:00'),
  ('00000000-0000-0000-0000-0000000085b2', '00000000-0000-0000-0000-0000000085d4', (now() AT TIME ZONE 'America/Chicago')::date, '08:00', '12:00'),
  ('00000000-0000-0000-0000-0000000085b1', '00000000-0000-0000-0000-0000000085d5', (now() AT TIME ZONE 'America/Chicago')::date, '08:00', '12:00'),
  ('00000000-0000-0000-0000-0000000085b1', '00000000-0000-0000-0000-0000000085d6', (now() AT TIME ZONE 'America/Chicago')::date, '08:00', '12:00');
INSERT INTO public.clock_sessions (user_id, job_ledger_id, clocked_in_at, work_date, notes, revoked_at) VALUES
  ('00000000-0000-0000-0000-0000000085d2', '00000000-0000-0000-0000-0000000085b1', now() - interval '7 days', (now() AT TIME ZONE 'America/Chicago')::date - 7, '', NULL);

CREATE SCHEMA mts;
CREATE FUNCTION mts.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION mts.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mts.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION mts.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- Who of the bed's people is on a job, as each one asks: the last digit of each who says yes.
CREATE FUNCTION mts.on_job(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE u uuid; out text := '';
BEGIN
  FOR u IN SELECT id FROM public.users WHERE id::text LIKE '00000000-0000-0000-0000-0000000085d_' ORDER BY id LOOP
    PERFORM mts.as_user(u);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF public.messages_tech_on_job(p_job) THEN out := out || right(u::text, 1); END IF;
    EXECUTE 'RESET ROLE';
  END LOOP;
  RETURN coalesce(nullif(out, ''), '-');
END $$;
-- A contact as one line: its kind, its customer, its name, and its channels' keys.
CREATE FUNCTION mts.contact(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT x.kind || ' ' || coalesce(right(x.customer_id::text, 4), '-') || ' ' || coalesce(x.name, '-') || ' ['
    || coalesce((SELECT string_agg(ch.kind || ':' || ch.key, ', ' ORDER BY ch.kind) FROM public.contact_channels ch WHERE ch.contact_id = x.id), '') || ']'
  FROM public.contacts x WHERE x.id = p_id
$$;
CREATE TABLE mts.got (label text PRIMARY KEY, id uuid);
GRANT USAGE ON SCHEMA mts TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mts TO anon, authenticated;
GRANT ALL ON mts.got TO authenticated;

-- 1 · Who is on a job: dispatched this week (Luis, Tess), clocked last week (Hector); never three weeks ago (Paul), another
-- job's tech (Kim), a superintendent (Sal) or the office (Rosa).
SELECT mts.same('on Dana''s job', mts.on_job('00000000-0000-0000-0000-0000000085b1'), '126');
SELECT mts.same('on Kevin''s job', mts.on_job('00000000-0000-0000-0000-0000000085b2'), '4');

-- 2 · messages_tech_can_read, recreated on it, still reads Kevin's thread for Kim alone.
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d4');
SET LOCAL ROLE authenticated;
SELECT mts.same('Kim reads Kevin''s thread', public.messages_tech_can_read('00000000-0000-0000-0000-000000008501')::text, 'true');
RESET ROLE;
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d1');
SET LOCAL ROLE authenticated;
SELECT mts.same('Luis does not', public.messages_tech_can_read('00000000-0000-0000-0000-000000008501')::text, 'false');
RESET ROLE;

-- 3 · The tech's door says no in words to anyone off the job, and to a job with no customer.
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d3');
SET LOCAL ROLE authenticated;
SELECT mts.refused('Paul, three weeks ago', $q$SELECT public.contact_for_job('00000000-0000-0000-0000-0000000085b1')$q$, 'Only a tech on this job sends from Job Mode.');
RESET ROLE;
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d5');
SET LOCAL ROLE authenticated;
SELECT mts.refused('a superintendent on the job', $q$SELECT public.contact_for_job('00000000-0000-0000-0000-0000000085b1')$q$, 'Only a tech on this job sends from Job Mode.');
RESET ROLE;
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d7');
SET LOCAL ROLE authenticated;
SELECT mts.refused('the office takes its own door', $q$SELECT public.contact_for_job('00000000-0000-0000-0000-0000000085b1')$q$, 'Only a tech on this job sends from Job Mode.');
RESET ROLE;
SELECT mts.as_anon();
SET LOCAL ROLE anon;
SELECT mts.refused('nobody signed out', $q$SELECT public.contact_for_job('00000000-0000-0000-0000-0000000085b1')$q$, 'permission denied');
RESET ROLE;
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d1');
SET LOCAL ROLE authenticated;
SELECT mts.refused('a job with no customer', $q$SELECT public.contact_for_job('00000000-0000-0000-0000-0000000085b3')$q$, 'This job has no customer yet.');
RESET ROLE;

-- 4 · Training mode makes nothing, in words.
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d6');
SET LOCAL ROLE authenticated;
SELECT mts.refused('Tess in training starts no thread', $q$SELECT public.contact_for_job('00000000-0000-0000-0000-0000000085b1')$q$,
  'A training account cannot start a customer''s thread.');
RESET ROLE;
SELECT mts.same('nothing was made for Dana', (SELECT count(*)::text FROM public.contacts WHERE customer_id = '00000000-0000-0000-0000-0000000085c1'), '0');

-- 5 · Luis makes Dana's own contact with her number; Hector's press finds it; Tess finds it once it is there.
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d1');
SET LOCAL ROLE authenticated;
INSERT INTO mts.got VALUES ('dana', public.contact_for_job('00000000-0000-0000-0000-0000000085b1'));
RESET ROLE;
SELECT mts.same('Dana''s own contact, with her number', mts.contact((SELECT id FROM mts.got WHERE label = 'dana')), 'customer 85c1 - [phone:5125550182]');
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d2');
SET LOCAL ROLE authenticated;
SELECT mts.same('Hector finds the same', public.contact_for_job('00000000-0000-0000-0000-0000000085b1')::text, (SELECT id::text FROM mts.got WHERE label = 'dana'));
RESET ROLE;
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d6');
SET LOCAL ROLE authenticated;
SELECT mts.same('Tess finds it: a find is a read', public.contact_for_job('00000000-0000-0000-0000-0000000085b1')::text, (SELECT id::text FROM mts.got WHERE label = 'dana'));
RESET ROLE;
SELECT mts.same('still one contact on Dana''s row', (SELECT count(*)::text FROM public.contacts WHERE customer_id = '00000000-0000-0000-0000-0000000085c1'), '1');

-- 6 · The office's door is as it was, and the body behind both opens to nobody signed in.
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d7');
SET LOCAL ROLE authenticated;
SELECT mts.same('Rosa''s door finds Dana''s', public.contact_for_customer('00000000-0000-0000-0000-0000000085c1')::text, (SELECT id::text FROM mts.got WHERE label = 'dana'));
RESET ROLE;
SELECT mts.as_user('00000000-0000-0000-0000-0000000085d1');
SET LOCAL ROLE authenticated;
SELECT mts.refused('a tech at the office''s door', $q$SELECT public.contact_for_customer('00000000-0000-0000-0000-0000000085c1')$q$, 'Only the office opens a customer''s messages.');
SELECT mts.refused('the find-or-make body, called straight', $q$SELECT public.contact_find_or_make('00000000-0000-0000-0000-0000000085c1')$q$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'messages_tech_send PASSED'; END $$;
ROLLBACK;
