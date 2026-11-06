-- The seal probe (v2.6572, punch list #256 PR 7, migration *_archived_seal): signs in as an archived account and as an
-- active one and tries the locks. Every RLS-enabled public table carries archived_fence and storage.objects does; the
-- archived caller reads no row of users or jobs_ledger where the active one reads them, and updates nothing of their
-- own row where the active one does; the pre-request gate refuses the archived caller on a table path and on every
-- RPC path authenticated may call, except /rpc/my_away_note, and refuses nobody else; the gate is set on the
-- authenticator role; and the predicate's cost is printed. Fixtures are written as postgres; the tries run as each
-- account under RLS; everything rolls back. Raises on the first failed assertion; ends with "archived_seal PASSED".
-- See scripts/pgtest-archived-seal.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Ava left and is archived; Ben is a dev still here. Both devs, so every row rule but the fence reads alike for them.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000256a0a1', 'ava@seal.test'),
  ('00000000-0000-0000-0000-00000256a0a2', 'ben@seal.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00000256a0a1', 'ava@seal.test', 'Ava Away', 'dev', false, false, now()),
  ('00000000-0000-0000-0000-00000256a0a2', 'ben@seal.test', 'Ben Here', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000256a0f9', 'Seal Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000256a0b1', '00000000-0000-0000-0000-00000256a0a2', '00000000-0000-0000-0000-00000256a0f9', 'Seal job', NULL);

CREATE SCHEMA seal;
GRANT USAGE ON SCHEMA seal TO authenticated;
CREATE FUNCTION seal.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION seal.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION seal.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- What the gate says for a path: 'passes', or the sqlstate it raised.
CREATE FUNCTION seal.gate(p_path text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.path', p_path, true);
  PERFORM set_config('request.method', 'GET', true);
  PERFORM public.archived_pre_request();
  RETURN 'passes';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- Rows the caller can read from a table, or 'refused' when the table itself is closed to the role.
CREATE FUNCTION seal.rows_in(p_table text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I', p_table) INTO n;
  RETURN n::text;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN 'refused';
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA seal TO authenticated;

-- The structure: every RLS-enabled public table carries the fence, and so does storage.objects.
SELECT seal.same('every RLS table carries archived_fence', (
  SELECT coalesce(string_agg(c.relname, ', ' ORDER BY c.relname), '')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polname = 'archived_fence')
), '');
SELECT seal.same('the fence is restrictive, for every command, on authenticated', (
  SELECT permissive || ' ' || cmd || ' ' || roles::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'archived_fence'
), 'RESTRICTIVE ALL {authenticated}');
SELECT seal.same('storage.objects carries archived_fence', (
  SELECT permissive || ' ' || cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'archived_fence'
), 'RESTRICTIVE ALL');
SELECT seal.same('the gate is set on authenticator', (
  SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator' AND 'pgrst.db_pre_request=public.archived_pre_request' = ANY (rolconfig)) THEN 'set' ELSE 'not set' END
), 'set');
SELECT seal.same('the sweep helpers are closed to the API', (
  SELECT CASE WHEN has_function_privilege('authenticated', 'public.apply_archived_read_blocks()', 'EXECUTE') THEN 'open' ELSE 'closed' END
), 'closed');

-- Ben, here: reads both accounts and the job, updates his own name.
SET ROLE authenticated;
SELECT seal.sign_in('00000000-0000-0000-0000-00000256a0a2');
SELECT seal.same('Ben is not archived', public.caller_is_archived()::text, 'false');
SELECT seal.same('Ben reads the accounts', (SELECT count(*) FROM public.users WHERE email LIKE '%@seal.test')::text, '2');
SELECT seal.same('Ben reads the job', seal.rows_in('jobs_ledger'), '1');
UPDATE public.users SET name = 'Ben Here Still' WHERE id = '00000000-0000-0000-0000-00000256a0a2';
SELECT seal.same('Ben updates his own row', (SELECT name FROM public.users WHERE id = '00000000-0000-0000-0000-00000256a0a2'), 'Ben Here Still');
SELECT seal.same('the gate passes Ben on a table', seal.gate('/users'), 'passes');
SELECT seal.same('the gate passes Ben on an RPC', seal.gate('/rpc/is_read_only'), 'passes');

-- Ava, away: reads nothing, updates nothing, and the gate refuses her everywhere but the note.
SELECT seal.sign_in('00000000-0000-0000-0000-00000256a0a1');
SELECT seal.same('Ava is archived', public.caller_is_archived()::text, 'true');
SELECT seal.same('Ava reads no account, not even her own', seal.rows_in('users'), '0');
SELECT seal.same('Ava reads no job', seal.rows_in('jobs_ledger'), '0');
UPDATE public.users SET name = 'Ava Changed' WHERE id = '00000000-0000-0000-0000-00000256a0a1';
SELECT seal.same('Ava updates nothing, her own row included', (SELECT count(*) FROM public.users WHERE name = 'Ava Changed')::text, '0');
SELECT seal.same('the gate refuses Ava on a table', seal.gate('/users'), 'PT403');
SELECT seal.same('the gate refuses Ava on a view', seal.gate('/some_view'), 'PT403');
SELECT seal.same('the gate refuses Ava on GraphQL', seal.gate('/graphql/v1'), 'PT403');
SELECT seal.same('the gate passes Ava to the Away note alone', seal.gate('/rpc/my_away_note'), 'passes');
-- Every RPC authenticated may call: the gate refuses her on each one.
SELECT seal.same('the gate refuses Ava on every RPC', (
  SELECT coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), '')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND p.proname <> 'my_away_note'
    AND seal.gate('/rpc/' || p.proname) <> 'PT403'
), '');
-- Every table: not a row for her, wherever the table's own rules would let a dev read.
SELECT seal.same('Ava reads no row of any table', (
  SELECT coalesce(string_agg(c.relname || '=' || seal.rows_in(c.relname), ', ' ORDER BY c.relname), '')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND seal.rows_in(c.relname) NOT IN ('0', 'refused')
), '');

-- Nobody signed in (anon, the service role, a cron): the gate passes.
SELECT seal.sign_out();
SELECT seal.same('the gate passes a request with no caller', seal.gate('/users'), 'passes');
RESET ROLE;

-- The cost of the predicate, which runs once per request for everyone: printed, read in the bed's log.
DO $$
DECLARE t0 timestamptz; x boolean; i integer;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000256a0a2', 'role', 'authenticated')::text, true);
  t0 := clock_timestamp();
  FOR i IN 1..2000 LOOP x := public.caller_is_archived(); END LOOP;
  RAISE NOTICE 'ok: caller_is_archived() averages % microseconds over 2000 calls', round(extract(epoch FROM clock_timestamp() - t0) * 1e6 / 2000);
END $$;

SELECT 'archived_seal PASSED';
ROLLBACK;
