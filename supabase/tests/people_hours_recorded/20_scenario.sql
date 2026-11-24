-- Recorded time finds a person's pay row by its key (punch list #430, migration *_people_hours_recorded_pay_join_by_key).
-- people_hours_recorded joined people_pay_config as an equality onto a COALESCE of the name from either side of its
-- full join, which Postgres cannot use as an index condition on a table with row policies; the join is a CASE now.
-- The view as it stood is rebuilt from the live definition with the CASE put back as the COALESCE it replaced. The
-- scenario seeds every side of the full join, each with a pay row and without one, and asserts:
--   * the rows: approved hours alone, pending hours alone, both on one day, and the person's id from the hours row or,
--     when that row names none or there is no hours row, from the pay row;
--   * a dev, the assistant, a pay-approved master and a crew member reading their own time each read the same rows from
--     the view and from the view before;
--   * the plan, with sequential scans, hash joins and merge joins priced out, finds the pay row by its key, and the view
--     before did not.
-- Every name and number is made up. Fixtures are written as postgres; the reads run as each user through RLS; everything
-- rolls back. Raises on the first failed assertion; ends with "people_hours_recorded PASSED". See
-- scripts/pgtest-people-hours-recorded.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev, Ann the assistant, Mia a master approved for pay. Ada, Cal and Dot clock in; Ben and Eli only have
-- hours typed in.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000430a001', 'dee@hoursrecorded.test'),
  ('00000000-0000-0000-0000-00000430a002', 'ann@hoursrecorded.test'),
  ('00000000-0000-0000-0000-00000430a003', 'mia@hoursrecorded.test'),
  ('00000000-0000-0000-0000-00000430a004', 'ada@hoursrecorded.test'),
  ('00000000-0000-0000-0000-00000430a005', 'cal@hoursrecorded.test'),
  ('00000000-0000-0000-0000-00000430a006', 'dot@hoursrecorded.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000430a001', 'dee@hoursrecorded.test', 'ZZ Hours Dee', 'dev', false, false),
  ('00000000-0000-0000-0000-00000430a002', 'ann@hoursrecorded.test', 'ZZ Hours Ann', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000430a003', 'mia@hoursrecorded.test', 'ZZ Hours Mia', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000430a004', 'ada@hoursrecorded.test', 'ZZ Hours Ada', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000430a005', 'cal@hoursrecorded.test', 'ZZ Hours Cal', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000430a006', 'dot@hoursrecorded.test', 'ZZ Hours Dot', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.pay_approved_masters (master_id) VALUES ('00000000-0000-0000-0000-00000430a003') ON CONFLICT DO NOTHING;
-- The roster: Ada, Ben and Cal are on it and have a pay row. Dot clocks in with no pay row; Eli has hours and is on no
-- list at all.
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-00000430e001', '00000000-0000-0000-0000-00000430a003', 'helper', 'ZZ Hours Ada', '00000000-0000-0000-0000-00000430a004'),
  ('00000000-0000-0000-0000-00000430e002', '00000000-0000-0000-0000-00000430a003', 'helper', 'ZZ Hours Ben', NULL),
  ('00000000-0000-0000-0000-00000430e003', '00000000-0000-0000-0000-00000430a003', 'helper', 'ZZ Hours Cal', '00000000-0000-0000-0000-00000430a005');
INSERT INTO public.people_pay_config (person_name, person_id) VALUES
  ('ZZ Hours Ada', '00000000-0000-0000-0000-00000430e001'),
  ('ZZ Hours Ben', '00000000-0000-0000-0000-00000430e002'),
  ('ZZ Hours Cal', '00000000-0000-0000-0000-00000430e003');
-- Approved hours: Ada and Ben on the 2nd, Eli on the 3rd. Ben's row names no person, so his id comes from the pay row.
INSERT INTO public.people_hours (person_name, work_date, hours, person_id) VALUES
  ('ZZ Hours Ada', '2026-11-02', 8, '00000000-0000-0000-0000-00000430e001'),
  ('ZZ Hours Ben', '2026-11-02', 8, '00000000-0000-0000-0000-00000430e002'),
  ('ZZ Hours Eli', '2026-11-03', 6, NULL);
UPDATE public.people_hours SET person_id = NULL WHERE person_name = 'ZZ Hours Ben';
-- Closed sessions waiting on approval: Ada two hours on the day she has approved hours, Cal three and Dot one on days
-- with none. A rejected session counts for nobody.
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, rejected_at) VALUES
  ('00000000-0000-0000-0000-00000430a004', '2026-11-02 22:00Z', '2026-11-03 00:00Z', '2026-11-02', 'ada late', NULL),
  ('00000000-0000-0000-0000-00000430a005', '2026-11-03 14:00Z', '2026-11-03 17:00Z', '2026-11-03', 'cal', NULL),
  ('00000000-0000-0000-0000-00000430a006', '2026-11-04 14:00Z', '2026-11-04 15:00Z', '2026-11-04', 'dot', NULL),
  ('00000000-0000-0000-0000-00000430a006', '2026-11-04 16:00Z', '2026-11-04 20:00Z', '2026-11-04', 'dot rejected', '2026-11-05 00:00Z');

CREATE SCHEMA hr;
GRANT USAGE ON SCHEMA hr TO authenticated;
CREATE FUNCTION hr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION hr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;

SELECT hr.same('the view still reads as its caller', (SELECT reloptions::text FROM pg_class WHERE oid = 'public.people_hours_recorded'::regclass), '{security_invoker=true}');
SELECT hr.same('its columns are the six it had, in order',
  (SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'people_hours_recorded'),
  'person_name,person_id,work_date,hours,approved_hours,pending_hours');
SELECT hr.same('a signed-in account may read it', has_table_privilege('authenticated', 'public.people_hours_recorded', 'SELECT')::text, 'true');

-- The view as it stood, rebuilt from the live definition with the CASE put back as the COALESCE it replaced.
DO $$
DECLARE
  v_def text := pg_get_viewdef('public.people_hours_recorded'::regclass);
  -- pg_get_viewdef lays a CASE out over lines, so any run of white space stands between its words.
  v_case text := 'CASE\s+WHEN \(([a-z_]+\.[a-z_]+) IS NOT NULL\) THEN \1\s+ELSE ([a-z_]+\.[a-z_]+)\s+END';
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM regexp_matches(v_def, v_case, 'g');
  IF v_n <> 1 THEN RAISE EXCEPTION 'the view should find the pay row by one CASE, and has %', v_n; END IF;
  EXECUTE 'CREATE VIEW hr.recorded_before WITH (security_invoker = true) AS ' || regexp_replace(v_def, v_case, 'COALESCE(\1, \2)', 'g');
  RAISE NOTICE 'ok: the view finds the pay row by a CASE, and the view before is rebuilt with the COALESCE';
END $$;
GRANT SELECT ON hr.recorded_before TO authenticated;

-- The bed's own rows as a reader sees them: name, whose id, hours, approved, pending.
CREATE FUNCTION hr.rows(p_view text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  EXECUTE format($q$SELECT coalesce(string_agg(concat_ws('|', replace(person_name, 'ZZ Hours ', ''), work_date::text,
      coalesce(right(person_id::text, 4), 'no id'), round(hours, 2)::text, round(approved_hours, 2)::text, round(pending_hours, 2)::text),
      E'\n' ORDER BY person_name, work_date), 'none')
    FROM %s WHERE person_name LIKE 'ZZ Hours %%'$q$, p_view) INTO v;
  RETURN v;
END $$;
-- Rows one view hands the caller that the other does not, both ways, and how many rows the caller reads.
CREATE FUNCTION hr.differ() RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws(' ',
    (SELECT count(*) FROM (SELECT to_jsonb(a)::text FROM public.people_hours_recorded a EXCEPT ALL SELECT to_jsonb(b)::text FROM hr.recorded_before b) x) || ' only now',
    (SELECT count(*) FROM (SELECT to_jsonb(b)::text FROM hr.recorded_before b EXCEPT ALL SELECT to_jsonb(a)::text FROM public.people_hours_recorded a) x) || ' only before',
    'of', regexp_replace((SELECT count(*) FROM public.people_hours_recorded)::text, '^[1-9][0-9]*$', 'some'))
$$;
-- How a view reaches the pay row, read off its plan with the walks priced out: by its key or not. The settings are put
-- back before the function returns.
CREATE FUNCTION hr.by_key(p_view text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  line text;
  by_key boolean := false;
BEGIN
  PERFORM set_config('enable_seqscan', 'off', true);
  PERFORM set_config('enable_hashjoin', 'off', true);
  PERFORM set_config('enable_mergejoin', 'off', true);
  FOR line IN EXECUTE format('EXPLAIN (COSTS OFF) SELECT person_id FROM %s', p_view) LOOP
    IF line ~ 'Index Cond: \(+person_name = (CASE WHEN \(|COALESCE\()ph[_0-9]*\.person_name' THEN by_key := true; END IF;
  END LOOP;
  PERFORM set_config('enable_seqscan', 'on', true);
  PERFORM set_config('enable_hashjoin', 'on', true);
  PERFORM set_config('enable_mergejoin', 'on', true);
  RETURN CASE WHEN by_key THEN 'by its key' ELSE 'by a walk of the pay rows' END;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hr TO authenticated;

SET ROLE authenticated;

-- Dee, a dev, reads every row: each side of the full join, with a pay row and without one.
SELECT hr.as_user('00000000-0000-0000-0000-00000430a001');
SELECT hr.same('a dev reads approved, pending and both, with the id from the hours row or the pay row', hr.rows('public.people_hours_recorded'), concat_ws(E'\n',
  'Ada|2026-11-02|e001|10.00|8.00|2.00',
  'Ben|2026-11-02|e002|8.00|8.00|0.00',
  'Cal|2026-11-03|e003|3.00|0.00|3.00',
  'Dot|2026-11-04|no id|1.00|0.00|1.00',
  'Eli|2026-11-03|no id|6.00|6.00|0.00'));
SELECT hr.same('and the same rows from the view before', hr.rows('hr.recorded_before'), hr.rows('public.people_hours_recorded'));
SELECT hr.same('every row a dev reads is the same in both', hr.differ(), '0 only now 0 only before of some');
SELECT hr.same('the view finds the pay row by its key', hr.by_key('public.people_hours_recorded'), 'by its key');
SELECT hr.same('the view before walked the pay rows instead', hr.by_key('hr.recorded_before'), 'by a walk of the pay rows');
RESET ROLE;

-- Ann, the assistant, reads the hours and only her own pay row, so the pay rows name nobody here.
SELECT hr.as_user('00000000-0000-0000-0000-00000430a002');
SET LOCAL ROLE authenticated;
SELECT hr.same('the assistant reads the same rows from both', hr.differ(), '0 only now 0 only before of some');
SELECT hr.same('and the bed''s rows the same way', hr.rows('hr.recorded_before'), hr.rows('public.people_hours_recorded'));
RESET ROLE;

-- Mia, a master approved for pay.
SELECT hr.as_user('00000000-0000-0000-0000-00000430a003');
SET LOCAL ROLE authenticated;
SELECT hr.same('a pay-approved master reads the same rows from both', hr.differ(), '0 only now 0 only before of some');
SELECT hr.same('and the bed''s rows the same way', hr.rows('hr.recorded_before'), hr.rows('public.people_hours_recorded'));
RESET ROLE;

-- Cal, crew, reads his own time: his pending session alone, his id from his own pay row through the CASE's second arm.
SELECT hr.as_user('00000000-0000-0000-0000-00000430a005');
SET LOCAL ROLE authenticated;
SELECT hr.same('a crew member reads the same rows from both', hr.differ(), '0 only now 0 only before of some');
SELECT hr.same('and the bed''s rows the same way', hr.rows('hr.recorded_before'), hr.rows('public.people_hours_recorded'));
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'people_hours_recorded PASSED'; END $$;
ROLLBACK;
