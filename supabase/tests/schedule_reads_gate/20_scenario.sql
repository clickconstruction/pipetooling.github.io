-- The schedule emails' two reads ask who is calling (migration *_schedule_reads_ask_who_calls):
-- list_schedule_blocks_for_share and list_job_schedule_blocks_for_schedule_email answer the schedule as one named
-- person sees it. A signed-in caller reads for himself, the office also reads the day's email for anyone, the
-- service role with no login reads both for anyone, and every other caller is refused with 42501. What each person
-- reads for himself is what he read before. Fixtures are written as postgres; reads run as each user; everything
-- rolls back. Raises on the first failed assertion; ends with "schedule_reads_gate PASSED". See
-- scripts/pgtest-schedule-reads-gate.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA sg;
CREATE FUNCTION sg.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000005c9a' || p)::uuid $$;
CREATE FUNCTION sg.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sg.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_state text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    IF v_state <> '42501' OR position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n% %\n--- want it to hold ---\n42501 %', label, v_state, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION sg.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A caller with no login: the service key ('service_role'), the public key ('anon') or no token at all ('').
CREATE FUNCTION sg.no_login(p_role text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_role = '' THEN '' ELSE json_build_object('role', p_role)::text END, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
END $$;
-- Each read's answer for one named person today, as text.
CREATE FUNCTION sg.share(p_viewer uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(e.job_hcp_number || ':' || coalesce(e.job_name, '-') || ':' || coalesce(e.job_address, '-') || ':' || e.assignee_name, ', ' ORDER BY e.job_hcp_number), '')
  FROM public.list_schedule_blocks_for_share(p_viewer, public.app_today(), public.app_today()) e WHERE e.job_id = sg.id('41')
$$;
CREATE FUNCTION sg.mail(p_recipient uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(e.job_hcp_number || ':' || coalesce(e.job_name, '-') || ':' || coalesce(e.job_address, '-') || ':' || e.assignee_name, ', ' ORDER BY e.job_hcp_number), '')
  FROM public.list_job_schedule_blocks_for_schedule_email(p_recipient, public.app_today()) e WHERE e.job_id = sg.id('41')
$$;
CREATE FUNCTION sg.table_rows() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.job_schedule_blocks b WHERE b.job_id = sg.id('41')
$$;
GRANT USAGE ON SCHEMA sg TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sg TO authenticated, anon, service_role;

-- Mo owns the job, Ana is an assistant, Cora keeps the books, Sue runs his sites, Pat is a primary, Sam is scheduled
-- on the job today and Hal is on no job.
INSERT INTO auth.users (id, email) VALUES
  (sg.id('01'), 'mo@sg.test'), (sg.id('02'), 'ana@sg.test'), (sg.id('03'), 'cora@sg.test'), (sg.id('04'), 'sue@sg.test'),
  (sg.id('05'), 'pat@sg.test'), (sg.id('06'), 'sam@sg.test'), (sg.id('07'), 'hal@sg.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (sg.id('01'), 'mo@sg.test', 'Mo Sgb', 'master_technician', false, false),
  (sg.id('02'), 'ana@sg.test', 'Ana Sgb', 'assistant', false, false),
  (sg.id('03'), 'cora@sg.test', 'Cora Sgb', 'controller', false, false),
  (sg.id('04'), 'sue@sg.test', 'Sue Sgb', 'superintendent', false, false),
  (sg.id('05'), 'pat@sg.test', 'Pat Sgb', 'primary', false, false),
  (sg.id('06'), 'sam@sg.test', 'Sam Sgb', 'helpers', false, false),
  (sg.id('07'), 'hal@sg.test', 'Hal Sgb', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.master_superintendents (master_id, superintendent_id) VALUES (sg.id('01'), sg.id('04')) ON CONFLICT DO NOTHING;
INSERT INTO public.service_types (id, name) VALUES (sg.id('31'), 'Sgb Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, job_address, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  (sg.id('41'), sg.id('01'), sg.id('31'), 'J310', 'Linden water heater', '88 Linden Ct', 'Dana Whitfield', 'customer', 900, 0, 'working');
INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end) VALUES
  (sg.id('41'), sg.id('06'), public.app_today(), '08:00', '12:00');

-- 0 · The grants: the gate is called from inside the two reads alone, and the public key reaches neither read.
SELECT sg.same('a signed-in user cannot call the gate itself', has_function_privilege('authenticated', 'public.schedule_read_gate(uuid, boolean)', 'EXECUTE')::text, 'false');
SELECT sg.same('the public key holds neither read',
  has_function_privilege('anon', 'public.list_schedule_blocks_for_share(uuid, date, date)', 'EXECUTE')::text
  || has_function_privilege('anon', 'public.list_job_schedule_blocks_for_schedule_email(uuid, date)', 'EXECUTE')::text, 'falsefalse');
SELECT sg.same('a signed-in user and the service role hold both',
  has_function_privilege('authenticated', 'public.list_schedule_blocks_for_share(uuid, date, date)', 'EXECUTE')::text
  || has_function_privilege('authenticated', 'public.list_job_schedule_blocks_for_schedule_email(uuid, date)', 'EXECUTE')::text
  || has_function_privilege('service_role', 'public.list_schedule_blocks_for_share(uuid, date, date)', 'EXECUTE')::text
  || has_function_privilege('service_role', 'public.list_job_schedule_blocks_for_schedule_email(uuid, date)', 'EXECUTE')::text, 'truetruetruetrue');

-- 1 · Hal, a helper on no job. He reads his own empty day, and is refused when he names anyone else.
SELECT sg.as_user(sg.id('07'));
SET LOCAL ROLE authenticated;
SELECT sg.same('Hal reads no block of the job in the table', sg.table_rows(), '0');
SELECT sg.same('Hal''s own shared schedule answers, with nothing of the job', sg.share(sg.id('07')), '');
SELECT sg.same('Hal''s own day email answers, with nothing of the job', sg.mail(sg.id('07')), '');
SELECT sg.refused('Hal names the primary on the shared schedule', format('SELECT sg.share(%L)', sg.id('05')), 'your own schedule');
SELECT sg.refused('Hal names the master on the shared schedule', format('SELECT sg.share(%L)', sg.id('01')), 'your own schedule');
SELECT sg.refused('Hal names the primary on the day email', format('SELECT sg.mail(%L)', sg.id('05')), 'your own schedule');
SELECT sg.refused('Hal names the helper beside him on the day email', format('SELECT sg.mail(%L)', sg.id('06')), 'your own schedule');
SELECT sg.refused('Hal names nobody', 'SELECT sg.share(NULL)', 'your own schedule');
SELECT sg.refused('a day with no block at all refuses him the same',
  format('SELECT count(*) FROM public.list_schedule_blocks_for_share(%L, DATE ''1999-01-01'', DATE ''1999-01-01'')', sg.id('01')), 'your own schedule');
RESET ROLE;

-- 2 · Sam, the helper scheduled on the job, reads his own blocks as before and nobody else's.
SELECT sg.as_user(sg.id('06'));
SET LOCAL ROLE authenticated;
SELECT sg.same('Sam''s own shared schedule names his job', sg.share(sg.id('06')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.same('Sam''s own day email names his job', sg.mail(sg.id('06')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.refused('Sam names the master on the day email', format('SELECT sg.mail(%L)', sg.id('01')), 'your own schedule');
RESET ROLE;

-- 3 · Sue the superintendent shares the schedule and is not the office: her own board, nobody else's day email.
SELECT sg.as_user(sg.id('04'));
SET LOCAL ROLE authenticated;
SELECT sg.same('Sue''s own shared schedule names her master''s job', sg.share(sg.id('04')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.same('Sue''s own day email names it', sg.mail(sg.id('04')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.refused('Sue names Sam on the day email', format('SELECT sg.mail(%L)', sg.id('06')), 'your own schedule');
SELECT sg.refused('Sue names the master on the shared schedule', format('SELECT sg.share(%L)', sg.id('01')), 'your own schedule');
RESET ROLE;

-- 4 · Pat the primary reads for himself what he read before, and is not the office.
SELECT sg.as_user(sg.id('05'));
SET LOCAL ROLE authenticated;
SELECT sg.same('Pat''s own shared schedule answers as it did', sg.share(sg.id('05')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.same('Pat''s own day email answers as it did', sg.mail(sg.id('05')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.refused('Pat names Sam on the day email', format('SELECT sg.mail(%L)', sg.id('06')), 'your own schedule');
RESET ROLE;

-- 5 · The office previews the day email of the person it picks: the master, his assistant and the controller.
SELECT sg.as_user(sg.id('01'));
SET LOCAL ROLE authenticated;
SELECT sg.same('Mo previews Sam''s day email', sg.mail(sg.id('06')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.same('Mo''s own shared schedule names his job', sg.share(sg.id('01')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.refused('the shared schedule has no office leg: Mo names Sam', format('SELECT sg.share(%L)', sg.id('06')), 'your own schedule');
RESET ROLE;
SELECT sg.as_user(sg.id('02'));
SET LOCAL ROLE authenticated;
SELECT sg.same('Ana the assistant previews Sam''s day email', sg.mail(sg.id('06')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.same('Ana''s own shared schedule names her master''s job', sg.share(sg.id('02')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.refused('Ana names the master on the shared schedule', format('SELECT sg.share(%L)', sg.id('01')), 'your own schedule');
RESET ROLE;
SELECT sg.as_user(sg.id('03'));
SET LOCAL ROLE authenticated;
SELECT sg.same('Cora the controller previews Sam''s day email', sg.mail(sg.id('06')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
RESET ROLE;

-- 6 · The dispatch functions read with the service key and no login: anyone's schedule, as before.
SELECT sg.no_login('service_role');
SET LOCAL ROLE service_role;
SELECT sg.same('the service role reads Sam''s day email', sg.mail(sg.id('06')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.same('the service role reads the master''s shared schedule', sg.share(sg.id('01')), 'J310:Linden water heater:88 Linden Ct:Sam Sgb');
SELECT sg.same('and Hal''s, which is empty', sg.share(sg.id('07')) || '|' || sg.mail(sg.id('07')), '|');
RESET ROLE;

-- 7 · No login and no service key: refused, whatever role the token names.
SELECT sg.no_login('');
SELECT sg.refused('no token at all', format('SELECT sg.share(%L)', sg.id('01')), 'Sign in');
SELECT sg.no_login('anon');
SELECT sg.refused('the public key''s token', format('SELECT sg.mail(%L)', sg.id('06')), 'Sign in');
SELECT sg.no_login('authenticated');
SELECT sg.refused('a signed-in role with no person', format('SELECT sg.mail(%L)', sg.id('06')), 'Sign in');

DO $$ BEGIN RAISE NOTICE 'schedule_reads_gate PASSED'; END $$;
ROLLBACK;
