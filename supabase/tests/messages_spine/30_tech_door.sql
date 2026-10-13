-- Residential build, R5's SQL (migration *_messages_tech_door): the tech's door. A tech (primary or helpers) reads a
-- customer's thread while dispatched to or clocked on one of its jobs this week or last, and never an office-only note,
-- a trade partner's thread or a job they are off; a superintendent reads none; the office reads all of it. The owner or
-- a dev sets the office's wait and hours; a hold has an end only while someone has it; an office-only flag rides a team
-- note alone; a push can name its line. The fixture is made as postgres; each read runs as its user through RLS;
-- everything rolls back. Raises on the first failed assertion; ends with "messages_tech_door PASSED".
-- See scripts/pgtest-messages-spine.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Luis (primary) is dispatched to Dana's job today; Hector (helpers) clocked on it last week; Paul (primary) was
-- dispatched to it three weeks ago; Kim (primary) is on Kevin's job, with a revoked clock-in on Dana's; Sal is a
-- superintendent dispatched to Dana's job today. Rosa is the office; the master, a dev and the controller are the
-- settings' people.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'luis@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d2', 'hector@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d3', 'paul@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d4', 'kim@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d5', 'sal@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d6', 'rosa@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d7', 'master@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d8', 'dev@techdoor.test'),
  ('00000000-0000-0000-0000-0000000007d9', 'controller@techdoor.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'luis@techdoor.test', 'Luis Tech', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000007d2', 'hector@techdoor.test', 'Hector Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000007d3', 'paul@techdoor.test', 'Paul Tech', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000007d4', 'kim@techdoor.test', 'Kim Tech', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000007d5', 'sal@techdoor.test', 'Sal Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000007d6', 'rosa@techdoor.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000007d7', 'master@techdoor.test', 'Tech Door Master', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000007d8', 'dev@techdoor.test', 'Tech Door Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000007d9', 'controller@techdoor.test', 'Tech Door Controller', 'controller', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Dana Whitfield, with Mark at her household; Whitfield Rentals, tied to Dana's job by hand; Kevin Alvarez; a trade
-- partner tied to Dana's job. Two Pipeline jobs.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000007c1', 'Tech Door Dana Whitfield', '00000000-0000-0000-0000-0000000007d8'),
  ('00000000-0000-0000-0000-0000000007c2', 'Tech Door Kevin Alvarez', '00000000-0000-0000-0000-0000000007d8'),
  ('00000000-0000-0000-0000-0000000007c3', 'Tech Door Whitfield Rentals', '00000000-0000-0000-0000-0000000007d8');
INSERT INTO public.customer_contact_persons (id, customer_id, name) VALUES
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007c1', 'Mark Whitfield');
INSERT INTO public.gc_companies (id, name, trades, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000007a1', 'Tech Door Hillside', ARRAY['Sitework'], 'Greg Paulk');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000007f9', 'Tech Door Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007d8', '00000000-0000-0000-0000-0000000007f9', 'Oakridge sewer line', '00000000-0000-0000-0000-0000000007c1'),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007d8', '00000000-0000-0000-0000-0000000007f9', 'Alvarez water heater', '00000000-0000-0000-0000-0000000007c2');

INSERT INTO public.contacts (id, kind, customer_id, customer_contact_person_id, gc_company_id) VALUES
  ('00000000-0000-0000-0000-000000007101', 'customer', '00000000-0000-0000-0000-0000000007c1', NULL, NULL),
  ('00000000-0000-0000-0000-000000007102', 'customer', NULL, '00000000-0000-0000-0000-0000000007e1', NULL),
  ('00000000-0000-0000-0000-000000007103', 'customer', '00000000-0000-0000-0000-0000000007c3', NULL, NULL),
  ('00000000-0000-0000-0000-000000007104', 'customer', '00000000-0000-0000-0000-0000000007c2', NULL, NULL),
  ('00000000-0000-0000-0000-000000007105', 'trade', NULL, NULL, '00000000-0000-0000-0000-0000000007a1');
INSERT INTO public.contact_jobs (contact_id, jobs_ledger_id) VALUES
  ('00000000-0000-0000-0000-000000007103', '00000000-0000-0000-0000-0000000007b1'),
  ('00000000-0000-0000-0000-000000007105', '00000000-0000-0000-0000-0000000007b1');

-- The lines: Dana's text, our answer, a team note, and an office-only note; Mark's, the rentals', Kevin's and the trade
-- partner's one line each.
INSERT INTO public.messages (contact_id, channel, direction, at, body, office_only) VALUES
  ('00000000-0000-0000-0000-000000007101', 'text', 'in', now() - interval '8 hours', 'dana: the side gate is unlocked', false),
  ('00000000-0000-0000-0000-000000007101', 'text', 'out', now() - interval '7 hours', 'luis: on our way', false),
  ('00000000-0000-0000-0000-000000007101', 'note', 'team', now() - interval '6 hours', 'note: dog in the yard', false),
  ('00000000-0000-0000-0000-000000007101', 'note', 'team', now() - interval '5 hours', 'office: she is 60 days late', true),
  ('00000000-0000-0000-0000-000000007102', 'text', 'in', now() - interval '4 hours', 'mark: running late', false),
  ('00000000-0000-0000-0000-000000007103', 'email', 'in', now() - interval '3 hours', 'rentals: tenant moves in Friday', false),
  ('00000000-0000-0000-0000-000000007104', 'text', 'in', now() - interval '2 hours', 'kevin: heater is cold', false),
  ('00000000-0000-0000-0000-000000007105', 'email', 'in', now() - interval '1 hour', 'hillside: trench is open', false);

-- Dispatch and the clock, counted from today in Chicago: this week, last week, three weeks ago.
INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007d1', (now() AT TIME ZONE 'America/Chicago')::date, '08:00', '12:00'),
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007d3', (now() AT TIME ZONE 'America/Chicago')::date - 21, '08:00', '12:00'),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007d4', (now() AT TIME ZONE 'America/Chicago')::date, '08:00', '12:00'),
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007d5', (now() AT TIME ZONE 'America/Chicago')::date, '08:00', '12:00');
INSERT INTO public.clock_sessions (user_id, job_ledger_id, clocked_in_at, work_date, notes, revoked_at) VALUES
  ('00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007b1', now() - interval '7 days', (now() AT TIME ZONE 'America/Chicago')::date - 7, '', NULL),
  ('00000000-0000-0000-0000-0000000007d4', '00000000-0000-0000-0000-0000000007b1', now() - interval '1 hour', (now() AT TIME ZONE 'America/Chicago')::date, '', now());

CREATE SCHEMA mtd;
CREATE FUNCTION mtd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION mtd.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Signed in as a user, with the role claim auth.role() reads (app_settings' read policy asks it).
CREATE FUNCTION mtd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the caller reads, through RLS: the threads they see by the first word of each line, oldest first.
CREATE FUNCTION mtd.lines() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(split_part(body, ':', 1), ' ' ORDER BY at), '-')
  FROM public.messages WHERE contact_id::text LIKE '00000000-0000-0000-0000-00000000710_'
$$;
CREATE FUNCTION mtd.people() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(id::text, 1), ' ' ORDER BY id), '-')
  FROM public.contacts WHERE id::text LIKE '00000000-0000-0000-0000-00000000710_'
$$;
-- A rename as the caller, and how many rows it reached (0: refused by RLS, quietly).
CREATE FUNCTION mtd.rename(p_contact uuid, p_name text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE public.contacts SET name = p_name WHERE id = p_contact;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
-- An update as the caller, and how many rows it reached (0: refused by RLS, quietly).
CREATE FUNCTION mtd.flip(p_key text, p_text text, p_num numeric) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE public.app_settings SET value_text = coalesce(p_text, value_text), value_num = coalesce(p_num, value_num) WHERE key = p_key;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
CREATE FUNCTION mtd.setting(p_key text) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT coalesce(value_text, value_num::text) FROM public.app_settings WHERE key = p_key), 'no row') $$;
GRANT USAGE ON SCHEMA mtd TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mtd TO anon, authenticated;

-- 1 · Who is a tech.
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT mtd.same('a primary is on the tech team', public.messages_tech_team()::text, 'true');
RESET ROLE;
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT mtd.same('so is a helper', public.messages_tech_team()::text, 'true');
RESET ROLE;
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d5');
SET LOCAL ROLE authenticated;
SELECT mtd.same('a superintendent is not', public.messages_tech_team()::text, 'false');
RESET ROLE;

-- 2 · Luis, dispatched to Dana's job today: Dana, Mark at her household and the rentals tied to the job, with every
-- line but the office-only note. Not Kevin, not the trade partner on the same job.
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT mtd.same('Luis reads the job''s customers', mtd.people(), '1 2 3');
SELECT mtd.same('and their lines, never the office-only note', mtd.lines(), 'dana luis note mark rentals');
SELECT mtd.same('he can ask the door himself', public.messages_tech_can_read('00000000-0000-0000-0000-000000007101')::text || ' ' || public.messages_tech_can_read('00000000-0000-0000-0000-000000007105')::text, 'true false');
-- He writes nothing: the office's policies hold the rows.
SELECT mtd.same('he changes no contact', mtd.rename('00000000-0000-0000-0000-000000007101', 'Dana W'), '0');
SELECT mtd.refused('and writes no line', $q$INSERT INTO public.messages (contact_id, channel, direction, body) VALUES ('00000000-0000-0000-0000-000000007101', 'note', 'team', 'luis note')$q$, 'row-level security');
RESET ROLE;

-- 3 · Hector, clocked on Dana's job last week, reads the same.
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT mtd.same('Hector, clocked on last week, reads the job''s customers', mtd.people() || ' / ' || mtd.lines(), '1 2 3 / dana luis note mark rentals');
RESET ROLE;

-- 4 · Off the job: three weeks ago, another customer's job, a revoked clock-in, a superintendent.
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d3');
SET LOCAL ROLE authenticated;
SELECT mtd.same('Paul, dispatched three weeks ago, reads nothing', mtd.people() || ' / ' || mtd.lines(), '- / -');
RESET ROLE;
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d4');
SET LOCAL ROLE authenticated;
SELECT mtd.same('Kim reads Kevin alone: a revoked clock-in on Dana''s job opens nothing', mtd.people() || ' / ' || mtd.lines(), '4 / kevin');
RESET ROLE;
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d5');
SET LOCAL ROLE authenticated;
SELECT mtd.same('Sal, a superintendent on the job, reads nothing', mtd.people() || ' / ' || mtd.lines(), '- / -');
RESET ROLE;

-- 5 · The office reads every thread and every line.
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d6');
SET LOCAL ROLE authenticated;
SELECT mtd.same('Rosa reads every thread and the office-only note', mtd.people() || ' / ' || mtd.lines(), '1 2 3 4 5 / dana luis note office mark rentals kevin hillside');
RESET ROLE;

-- 6 · The wait and the hours: seeded, and set by the owner or a dev alone.
SELECT mtd.same('the wait starts at 15 minutes', mtd.setting('messages_office_wait_minutes'), '15');
SELECT mtd.same('the hours start Monday to Friday, 7:30 to 5, no emergency number',
  mtd.setting('messages_office_hours_v1'), '{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00","emergency":null}');
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d7');
SET LOCAL ROLE authenticated;
SELECT mtd.same('the master sets the hours', mtd.flip('messages_office_hours_v1', '{"days":[1,2,3,4,5,6],"opens":"07:00","closes":"17:00","techUntil":"17:00","emergency":null}', NULL), '1');
RESET ROLE;
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d8');
SET LOCAL ROLE authenticated;
SELECT mtd.same('a dev sets the wait', mtd.flip('messages_office_wait_minutes', NULL, 10), '1');
RESET ROLE;
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d9');
SET LOCAL ROLE authenticated;
SELECT mtd.same('the controller sets neither', mtd.flip('messages_office_wait_minutes', NULL, 30) || ' ' || mtd.flip('messages_office_hours_v1', '{}', NULL), '0 0');
RESET ROLE;
SELECT mtd.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT mtd.same('nor does a tech', mtd.flip('messages_office_wait_minutes', NULL, 60), '0');
RESET ROLE;
SELECT mtd.same('what they set stands', mtd.setting('messages_office_wait_minutes') || ' ' || (mtd.setting('messages_office_hours_v1')::jsonb ->> 'opens'), '10 07:00');

-- 7 · The columns' rules, as postgres with nobody signed in.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SELECT mtd.refused('a hold has an end only while someone has it',
  $q$UPDATE public.contacts SET has_until = now() + interval '1 hour' WHERE id = '00000000-0000-0000-0000-000000007104'$q$, 'contacts_has_until_held');
UPDATE public.contacts SET has_user_id = '00000000-0000-0000-0000-0000000007d1', has_since = now(), has_how = 'rule', has_until = now() + interval '1 hour'
  WHERE id = '00000000-0000-0000-0000-000000007104';
SELECT mtd.same('the tech holds it until the end', (SELECT (has_until > now())::text FROM public.contacts WHERE id = '00000000-0000-0000-0000-000000007104'), 'true');
SELECT mtd.refused('office only rides a team note alone',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, office_only) VALUES ('00000000-0000-0000-0000-000000007101', 'text', 'out', 'nope', true)$q$, 'messages_office_only_team');
SELECT mtd.same('a note is not office only unless it says so',
  (SELECT office_only::text FROM public.messages WHERE body = 'note: dog in the yard'), 'false');
INSERT INTO public.notification_history (recipient_user_id, template_type, title, body_preview, channel, message_id)
SELECT '00000000-0000-0000-0000-0000000007d1', 'message_reply', 'Tech Door Dana Whitfield', body, 'push', id FROM public.messages WHERE body = 'dana: the side gate is unlocked';
SELECT mtd.same('a push names its line', (SELECT count(*)::text FROM public.notification_history nh JOIN public.messages m ON m.id = nh.message_id WHERE m.body = 'dana: the side gate is unlocked'), '1');

-- 8 · As shipped: nobody signed out runs the door.
SELECT mtd.same('anon runs neither function',
  has_function_privilege('anon', 'public.messages_tech_team()', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.messages_tech_can_read(uuid)', 'EXECUTE')::text,
  'false false');
SELECT mtd.same('a signed-in user runs both',
  has_function_privilege('authenticated', 'public.messages_tech_team()', 'EXECUTE')::text || ' ' || has_function_privilege('authenticated', 'public.messages_tech_can_read(uuid)', 'EXECUTE')::text,
  'true true');

DO $$ BEGIN RAISE NOTICE 'messages_tech_door PASSED'; END $$;
ROLLBACK;
