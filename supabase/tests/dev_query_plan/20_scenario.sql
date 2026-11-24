-- A dev reads the plan of a fixed statement as themself (punch list #430, migration *_dev_query_plan).
-- dev_query_plan(p_key, p_analyze) holds a short list of statements written out in its body and runs EXPLAIN on the
-- one the caller names. The scenario asserts:
--   * the shape: it runs as its caller, it is closed to anon, its body has no dynamic SQL, and the statements under
--     EXPLAIN in the body are the four expected and no other;
--   * nobody but a dev: no session, the assistant and a crew member are each refused with 42501;
--   * no statement but a named one: a key that is unknown, empty, null, or a real key with SQL after it is refused
--     with 22023, and a row those keys tried to delete is still there;
--   * a dev gets the plan's lines for each key, analyzed (the times are in it) and not (no times, nothing run), and the
--     plan alone is line for line what the same EXPLAIN gives the dev directly, and not what the tables' owner gets;
--   * the reply holds every line when it fits, and under a smaller cap the head, the count left out and the last
--     lines, the cap a number clamped between 2,000 and 400,000 characters;
--   * after a call the transaction is read only: a write is refused with 25006.
-- Every name is made up. Fixtures are written as postgres; the calls run as each user through RLS; everything rolls
-- back. Raises on the first failed assertion; ends with "dev_query_plan PASSED". See scripts/pgtest-dev-query-plan.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev, Ann the assistant, Ada a crew member.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000430b001', 'dee@queryplan.test'),
  ('00000000-0000-0000-0000-00000430b002', 'ann@queryplan.test'),
  ('00000000-0000-0000-0000-00000430b003', 'ada@queryplan.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000430b001', 'dee@queryplan.test', 'ZZ Plan Dee', 'dev', false, false),
  ('00000000-0000-0000-0000-00000430b002', 'ann@queryplan.test', 'ZZ Plan Ann', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000430b003', 'ada@queryplan.test', 'ZZ Plan Ada', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA qp;
GRANT USAGE ON SCHEMA qp TO authenticated, anon;
-- The row a hostile key tries to delete. Anyone may write it, so only the function's own refusal keeps it.
CREATE TABLE qp.canary (id int PRIMARY KEY);
INSERT INTO qp.canary VALUES (1);
GRANT ALL ON qp.canary TO authenticated, anon;

CREATE FUNCTION qp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION qp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', CASE WHEN p_user IS NULL THEN '' ELSE 'authenticated' END, true);
END $$;
-- The SQLSTATE a call ends with, or 'no error'. The call runs as whoever calls this.
CREATE FUNCTION qp.state_of(p_key text, p_analyze boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.dev_query_plan(p_key, p_analyze);
  RETURN 'no error';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The same EXPLAIN, run directly by whoever calls this. The bed's own helper: the statement is the bed's, not a caller's.
CREATE FUNCTION qp.direct_plan(p_statement text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_line text; v_lines text[] := '{}';
BEGIN
  FOR v_line IN EXECUTE 'EXPLAIN ' || p_statement LOOP v_lines := v_lines || v_line; END LOOP;
  RETURN to_jsonb(v_lines);
END $$;
-- A reply's parts add up: every line when it fits, else the head, the count left out and the last lines.
CREATE FUNCTION qp.adds_up(r jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT CASE
    WHEN (r->>'line_count')::int < 1 THEN 'no lines'
    WHEN NOT (r->>'cut')::boolean AND jsonb_array_length(r->'lines') = (r->>'line_count')::int
         AND NOT r ? 'left_out' AND NOT r ? 'last_lines' THEN 'adds up'
    WHEN (r->>'cut')::boolean AND (r->>'left_out')::int > 0
         AND jsonb_array_length(r->'lines') + (r->>'left_out')::int + jsonb_array_length(r->'last_lines') = (r->>'line_count')::int
         THEN 'adds up'
    ELSE 'does not add up: ' || left(r::text, 300)
  END
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA qp TO authenticated, anon;

-- ---------------------------------------------------------------- the shape
SELECT qp.same('it runs as its caller, not its owner', (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.dev_query_plan(text, boolean, integer)'::regprocedure), 'false');
SELECT qp.same('it is volatile, since EXPLAIN is refused in a stable function', (SELECT provolatile::text FROM pg_proc WHERE oid = 'public.dev_query_plan(text, boolean, integer)'::regprocedure), 'v');
SELECT qp.same('anon may not call it', has_function_privilege('anon', 'public.dev_query_plan(text, boolean, integer)', 'EXECUTE')::text, 'false');
SELECT qp.same('a signed-in account may call it, and the body decides', has_function_privilege('authenticated', 'public.dev_query_plan(text, boolean, integer)', 'EXECUTE')::text, 'true');
SELECT qp.same('the body has no dynamic SQL',
  (SELECT (prosrc ~* '\mexecute\M' OR prosrc ~* '\mformat\s*\(' OR prosrc ~* '\mquery_to_xml\M')::text FROM pg_proc WHERE oid = 'public.dev_query_plan(text, boolean, integer)'::regprocedure), 'false');
SELECT qp.same('the statements under EXPLAIN are the four expected and no other',
  (SELECT string_agg(m[1], E'\n' ORDER BY m[1])
     FROM pg_proc p, regexp_matches(p.prosrc, 'FOR v_line IN (EXPLAIN[^\n]*) LOOP', 'g') m
    WHERE p.oid = 'public.dev_query_plan(text, boolean, integer)'::regprocedure),
  E'EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.agreements_on_file\n'
  || E'EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.people_hours_recorded WHERE work_date >= current_date - 14\n'
  || E'EXPLAIN SELECT * FROM public.agreements_on_file\n'
  || 'EXPLAIN SELECT * FROM public.people_hours_recorded WHERE work_date >= current_date - 14');
SELECT qp.same('and EXPLAIN is written nowhere else in the body',
  (SELECT (SELECT count(*) FROM regexp_matches(prosrc, '\mEXPLAIN\M', 'gi'))::text FROM pg_proc WHERE oid = 'public.dev_query_plan(text, boolean, integer)'::regprocedure), '4');

-- ---------------------------------------------------------------- nobody but a dev
SET LOCAL ROLE authenticated;
SELECT qp.as_user(NULL);
SELECT qp.same('no session is refused', qp.state_of('agreements_on_file', false), '42501');
SELECT qp.as_user('00000000-0000-0000-0000-00000430b002');
SELECT qp.same('the assistant is refused', qp.state_of('agreements_on_file', false), '42501');
SELECT qp.same('the assistant is refused the other statement, analyzed', qp.state_of('people_hours_recorded', true), '42501');
SELECT qp.as_user('00000000-0000-0000-0000-00000430b003');
SELECT qp.same('a crew member is refused', qp.state_of('people_hours_recorded', false), '42501');
SELECT qp.same('a crew member is refused before the key is read', qp.state_of('nothing by this name', false), '42501');

-- ---------------------------------------------------------------- no statement but a named one
SELECT qp.as_user('00000000-0000-0000-0000-00000430b001');
SELECT qp.same('a dev with an unknown key is refused', qp.state_of('customers', false), '22023');
SELECT qp.same('an empty key is refused', qp.state_of('', false), '22023');
SELECT qp.same('a null key is refused', qp.state_of(NULL, false), '22023');
SELECT qp.same('a key in other letters is refused', qp.state_of('Agreements_On_File', false), '22023');
SELECT qp.same('a real key with a statement after it is refused', qp.state_of('agreements_on_file; DELETE FROM qp.canary', true), '22023');
SELECT qp.same('a real key with a clause after it is refused', qp.state_of('people_hours_recorded WHERE 1 = 1', true), '22023');
SELECT qp.same('a statement for a key is refused', qp.state_of('DELETE FROM qp.canary', true), '22023');
SELECT qp.same('a quoted key is refused', qp.state_of($k$agreements_on_file' ; DELETE FROM qp.canary ; --$k$, true), '22023');
SELECT qp.same('the row those keys named is still there', (SELECT count(*)::text FROM qp.canary), '1');

-- ---------------------------------------------------------------- a dev gets the plan, as themself
-- The plan alone first: nothing is run. Under the default cap each plan is whole, and each is what the same EXPLAIN
-- gives the dev directly, line for line.
SELECT qp.same(k.key || ' is whole under the default cap', public.dev_query_plan(k.key, false)->>'cut', 'false')
  FROM (VALUES ('agreements_on_file'), ('people_hours_recorded')) k(key);
SELECT qp.same('agreements_on_file, the plan alone, is the dev''s own plan',
  (public.dev_query_plan('agreements_on_file', false)->'lines')::text,
  qp.direct_plan('SELECT * FROM public.agreements_on_file')::text);
SELECT qp.same('people_hours_recorded, the plan alone, is the dev''s own plan',
  (public.dev_query_plan('people_hours_recorded', false)->'lines')::text,
  qp.direct_plan('SELECT * FROM public.people_hours_recorded WHERE work_date >= current_date - 14')::text);

-- From the first call that got past the gate, the transaction is read only.
SELECT qp.same('after a call the transaction is read only', current_setting('transaction_read_only'), 'on');
DO $$
BEGIN
  INSERT INTO qp.canary VALUES (2);
  RAISE EXCEPTION 'a write landed after dev_query_plan ran';
EXCEPTION WHEN read_only_sql_transaction THEN
  RAISE NOTICE 'ok: a write after a call is refused by the database (25006)';
END $$;

-- Every reply, analyzed and not: it names its key, says whether it was analyzed, and its parts add up.
SELECT qp.same(k.key || CASE WHEN a.an THEN ', analyzed' ELSE ', the plan alone' END || ': the reply names itself and adds up',
         (r.r->>'key') || ' ' || (r.r->>'analyzed') || ' ' || qp.adds_up(r.r),
         k.key || ' ' || a.an::text || ' adds up')
  FROM (VALUES ('agreements_on_file'), ('people_hours_recorded')) k(key)
 CROSS JOIN (VALUES (true), (false)) a(an)
 CROSS JOIN LATERAL (SELECT public.dev_query_plan(k.key, a.an) AS r) r;
SELECT qp.same(k.key || ', a reply holds nothing but its plan',
         (SELECT string_agg(f, ',' ORDER BY f) FROM jsonb_object_keys(r.r - 'left_out' - 'last_lines') f),
         'analyzed,cut,key,line_count,lines')
  FROM (VALUES ('agreements_on_file'), ('people_hours_recorded')) k(key)
 CROSS JOIN LATERAL (SELECT public.dev_query_plan(k.key, true) AS r) r;
-- Analyzed, the statement ran: the times are in the plan, and its last line is the execution time.
SELECT qp.same(k.key || ', analyzed, ends on its execution time',
         (SELECT (l.line LIKE 'Execution Time: %')::text
            FROM jsonb_array_elements_text(COALESCE(r.r->'last_lines', r.r->'lines')) WITH ORDINALITY l(line, n) ORDER BY l.n DESC LIMIT 1)
         || ' ' || ((r.r->'lines')::text LIKE '%actual time=%')::text,
         'true true')
  FROM (VALUES ('agreements_on_file'), ('people_hours_recorded')) k(key)
 CROSS JOIN LATERAL (SELECT public.dev_query_plan(k.key, true) AS r) r;
-- Not analyzed, nothing ran: no times anywhere.
SELECT qp.same(k.key || ', the plan alone, ran nothing',
         (r.r::text ~ 'actual time=|Execution Time|Planning Time')::text, 'false')
  FROM (VALUES ('agreements_on_file'), ('people_hours_recorded')) k(key)
 CROSS JOIN LATERAL (SELECT public.dev_query_plan(k.key, false) AS r) r;
-- Under a smaller cap the reply is cut: the head that fits, the count left out, and the last twelve lines, where the
-- times are. The head stays under the cap. A cap below 2,000 reads as 2,000, and one past 400,000 as 400,000.
SELECT qp.same('a cut reply keeps the head under the cap, says what it left out, and ends on the execution time',
         (r.r->>'cut') || ' ' || qp.adds_up(r.r) || ' ' || (length((SELECT string_agg(l, E'\n') FROM jsonb_array_elements_text(r.r->'lines') l)) <= 20000)::text
         || ' ' || jsonb_array_length(r.r->'last_lines')::text || ' ' || ((r.r->'last_lines'->>11) LIKE 'Execution Time: %')::text,
         'true adds up true 12 true')
  FROM (SELECT public.dev_query_plan('agreements_on_file', true, 20000) AS r) r;
SELECT qp.same('a cap below 2,000 reads as 2,000',
         ((r.r->>'cut')::boolean AND length((SELECT string_agg(l, E'\n') FROM jsonb_array_elements_text(r.r->'lines') l)) BETWEEN 1 AND 2000)::text, 'true')
  FROM (SELECT public.dev_query_plan('people_hours_recorded', false, -5) AS r) r;
SELECT qp.same('a cap past 400,000 reads as 400,000, and a null cap as the default',
         (public.dev_query_plan('people_hours_recorded', false, 2000000000)->>'line_count') || ' ' || (public.dev_query_plan('people_hours_recorded', false, NULL)->>'cut'),
         (public.dev_query_plan('people_hours_recorded', false)->>'line_count') || ' false');

-- A null for the second argument reads as analyzed, the default.
SELECT qp.same('a null analyze is the default, analyzed', public.dev_query_plan('people_hours_recorded', NULL)->>'analyzed', 'true');

-- The plan is the caller's: the tables' owner, whom no policy binds, gets another one for the same statement.
SELECT md5(qp.direct_plan('SELECT * FROM public.agreements_on_file')::text) AS dev_plan \gset
RESET ROLE;
SELECT qp.same('the owner of the tables gets a different plan for the same statement',
  (md5(qp.direct_plan('SELECT * FROM public.agreements_on_file')::text) = :'dev_plan')::text, 'false');
SELECT qp.same('and the owner, who is no dev, is refused by the function', qp.state_of('agreements_on_file', false), '42501')
 WHERE qp.as_user(NULL) IS NOT NULL;

SELECT 'dev_query_plan PASSED';
ROLLBACK;
