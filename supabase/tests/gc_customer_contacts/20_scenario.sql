-- A customer's call log (the Board's B2b-v-i, migration *_gc_customer_contacts): the office team reads and logs; a
-- line is never changed once written; who logged it is the signed-in user, never a name the client picks; nobody
-- signed out, outside the office, in training mode or a digital twin writes one; a line names a known kind and says
-- something; and a line goes with its customer. Presses run as each user through RLS; the fixture is made as postgres;
-- everything rolls back. Raises on the first failed assertion; ends with "gc_customer_contacts PASSED". See
-- scripts/pgtest-gc-customer-contacts.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an estimator, an assistant), two outside it (a superintendent, a subcontractor), an estimator in
-- training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000cd1', 'dev@calllog.test'),
  ('00000000-0000-0000-0000-000000000cd2', 'estimator@calllog.test'),
  ('00000000-0000-0000-0000-000000000cd3', 'assistant@calllog.test'),
  ('00000000-0000-0000-0000-000000000cd4', 'super@calllog.test'),
  ('00000000-0000-0000-0000-000000000cd5', 'sub@calllog.test'),
  ('00000000-0000-0000-0000-000000000cd6', 'training@calllog.test'),
  ('00000000-0000-0000-0000-000000000cd7', 'twin@calllog.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000000cd1', 'dev@calllog.test', 'Log Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-000000000cd2', 'estimator@calllog.test', 'Log Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-000000000cd3', 'assistant@calllog.test', 'Log Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-000000000cd4', 'super@calllog.test', 'Log Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-000000000cd5', 'sub@calllog.test', 'Log Sub', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-000000000cd6', 'training@calllog.test', 'Log Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-000000000cd7', 'twin@calllog.test', 'Log Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A customer we build for, with a job, and another customer.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000cc1', 'Log Owner', '00000000-0000-0000-0000-000000000cd1'),
  ('00000000-0000-0000-0000-000000000cc2', 'Log Other', '00000000-0000-0000-0000-000000000cd1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ca1', 'Log Clinic', '00000000-0000-0000-0000-000000000cc1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-000000000ca1', 'buyout');

CREATE SCHEMA gcc;
CREATE FUNCTION gcc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION gcc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION gcc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA gcc TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gcc TO anon, authenticated;

-- 0 · Nobody signed out reads or logs.
SET LOCAL ROLE anon;
SELECT gcc.refused('no sign-in reads nothing', $q$SELECT count(*) FROM public.gc_customer_contacts$q$, 'permission denied for table gc_customer_contacts');
SELECT gcc.refused('no sign-in logs nothing', $q$INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', 'call', 'Hello.')$q$,
  'permission denied for table gc_customer_contacts');
RESET ROLE;

-- 1 · An estimator logs a call about the job. Who logged it, the day and the time are the table's.
SELECT gcc.as_user('00000000-0000-0000-0000-000000000cd2');
SET LOCAL ROLE authenticated;
INSERT INTO public.gc_customer_contacts (customer_id, project_id, by_name, how, note)
  VALUES ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000ca1', 'Log Estimator', 'call', 'They will sign Monday.');
SELECT gcc.same('the line is the estimator''s, today, about the job',
  (SELECT string_agg(concat_ws('|', by_user_id, contacted_on = public.app_today(), project_id, how, note, created_at IS NOT NULL), ',') FROM public.gc_customer_contacts),
  '00000000-0000-0000-0000-000000000cd2|t|00000000-0000-0000-0000-000000000ca1|call|They will sign Monday.|t');
-- 2 · It cannot say another user logged it, nor be changed or taken back.
SELECT gcc.refused('who logged it is not the client''s to say', $q$INSERT INTO public.gc_customer_contacts (customer_id, by_user_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000cd1', 'note', 'Forged.')$q$,
  'permission denied for table gc_customer_contacts');
SELECT gcc.refused('a line is never changed', $q$UPDATE public.gc_customer_contacts SET note = 'Changed.'$q$, 'permission denied for table gc_customer_contacts');
SELECT gcc.refused('a line is never taken back', $q$DELETE FROM public.gc_customer_contacts$q$, 'permission denied for table gc_customer_contacts');
-- 3 · A line names a known kind and says something.
SELECT gcc.refused('a kind it does not know', $q$INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', 'fax', 'Sent.')$q$,
  'gc_customer_contacts_how_known');
SELECT gcc.refused('a line that says nothing', $q$INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', 'note', '   ')$q$,
  'gc_customer_contacts_note_said');
RESET ROLE;

-- 4 · The rest of the office reads it and logs; a dev's line is the dev's.
SELECT gcc.as_user('00000000-0000-0000-0000-000000000cd3');
SET LOCAL ROLE authenticated;
SELECT gcc.same('an assistant reads the line', (SELECT count(*)::text FROM public.gc_customer_contacts), '1');
INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc2', 'email', 'Sent the price.');
RESET ROLE;
SELECT gcc.as_user('00000000-0000-0000-0000-000000000cd1');
SET LOCAL ROLE authenticated;
SELECT gcc.same('a dev reads both', (SELECT count(*)::text FROM public.gc_customer_contacts), '2');
SELECT gcc.same('the assistant''s line is the assistant''s, about no job',
  (SELECT concat_ws('|', by_user_id, project_id IS NULL) FROM public.gc_customer_contacts WHERE customer_id = '00000000-0000-0000-0000-000000000cc2'),
  '00000000-0000-0000-0000-000000000cd3|t');
RESET ROLE;

-- 5 · Outside the office: reads none, logs nothing.
SELECT gcc.as_user('00000000-0000-0000-0000-000000000cd4');
SET LOCAL ROLE authenticated;
SELECT gcc.same('a superintendent reads none', (SELECT count(*)::text FROM public.gc_customer_contacts), '0');
SELECT gcc.refused('a superintendent logs nothing', $q$INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', 'call', 'Hi.')$q$,
  'row-level security');
RESET ROLE;
SELECT gcc.as_user('00000000-0000-0000-0000-000000000cd5');
SET LOCAL ROLE authenticated;
SELECT gcc.same('a subcontractor reads none', (SELECT count(*)::text FROM public.gc_customer_contacts), '0');
SELECT gcc.refused('a subcontractor logs nothing', $q$INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', 'call', 'Hi.')$q$,
  'row-level security');
RESET ROLE;

-- 6 · Training mode and a digital twin read, and log nothing.
SELECT gcc.as_user('00000000-0000-0000-0000-000000000cd6');
SET LOCAL ROLE authenticated;
SELECT gcc.same('a training account reads the log', (SELECT count(*)::text FROM public.gc_customer_contacts), '2');
SELECT gcc.refused('a training account logs nothing', $q$INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', 'call', 'Practice.')$q$,
  'Read-only (training) mode');
RESET ROLE;
SELECT gcc.as_user('00000000-0000-0000-0000-000000000cd7');
SET LOCAL ROLE authenticated;
SELECT gcc.refused('a digital twin logs nothing', $q$INSERT INTO public.gc_customer_contacts (customer_id, how, note) VALUES ('00000000-0000-0000-0000-000000000cc1', 'call', 'Twin.')$q$,
  'digital_twin_write_fence_insert');
RESET ROLE;
SELECT gcc.same('neither left a line', (SELECT count(*)::text FROM public.gc_customer_contacts), '2');

-- 7 · The house fences and the grants, as the migration leaves them: the office's one policy, the read-only write
-- blocks and statement trigger, the twin fence; signed in may read and insert the line's own six columns, and nothing
-- else; signed out, nothing.
SELECT gcc.same('the policies',
  (SELECT string_agg(policyname || ':' || permissive || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gc_customer_contacts'),
  'digital_twin_write_fence_delete:RESTRICTIVE:DELETE,digital_twin_write_fence_insert:RESTRICTIVE:INSERT,digital_twin_write_fence_update:RESTRICTIVE:UPDATE,gc_customer_contacts_team:PERMISSIVE:ALL,read_only_users_cannot_delete:RESTRICTIVE:DELETE,read_only_users_cannot_insert:RESTRICTIVE:INSERT,read_only_users_cannot_update:RESTRICTIVE:UPDATE');
SELECT gcc.same('the read-only statement trigger',
  (SELECT string_agg(tgname, ',') FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relname = 'gc_customer_contacts' AND NOT t.tgisinternal),
  'read_only_block_stmt');
SELECT gcc.same('signed in reads, and changes nothing',
  (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'gc_customer_contacts' AND grantee = 'authenticated' AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  'SELECT');
SELECT gcc.same('signed in inserts the line''s own six columns',
  (SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges WHERE table_schema = 'public' AND table_name = 'gc_customer_contacts' AND grantee = 'authenticated' AND privilege_type = 'INSERT'),
  'by_name,contacted_on,customer_id,how,note,project_id');
SELECT gcc.same('signed out has nothing',
  (SELECT count(*)::text FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'gc_customer_contacts' AND grantee = 'anon'),
  '0');

-- 8 · A line goes with its customer.
DELETE FROM public.customers WHERE id = '00000000-0000-0000-0000-000000000cc2';
SELECT gcc.same('the other customer''s line went with them', (SELECT count(*)::text FROM public.gc_customer_contacts), '1');

DO $$ BEGIN RAISE NOTICE 'gc_customer_contacts PASSED'; END $$;
ROLLBACK;
