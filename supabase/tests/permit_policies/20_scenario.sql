-- Permits, the access rule read once (v2.6894, punch list #292, migration *_permit_policies_once): every policy on
-- the Permits tables names user_can_research_permits() inside a scalar subquery, so a statement runs it once. The
-- probe: the policies read that way and none is left bare; an estimator still reads and writes what they could; a
-- helper still reads and writes nothing; anon is refused; and the planner runs the rule as an InitPlan. Fixtures are
-- written as postgres; the tries run under RLS; everything rolls back. Raises on the first failed assertion; ends
-- with "permit_policies PASSED". See scripts/pgtest-permit-policies.sh. Never against prod. Every name is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000009410a1', 'eve@policies.test'),
  ('00000000-0000-0000-0000-0000009410a2', 'hal@policies.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000009410a1', 'eve@policies.test', 'Eve Estimator', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000009410a2', 'hal@policies.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, residential, work_type, address, address_key, submitted_on, contact, builder_key) VALUES
  ('00000000-0000-0000-0000-0000009410b1', 'Policy City', 'bed', 'COM-1', 'Comm New Building Permit', 'building', 'applied', false, 'New commercial', '100 SAMPLE ST', '100 sample st', CURRENT_DATE - 3, 'Ridgeway Builders', 'ridgewaybuilders'),
  ('00000000-0000-0000-0000-0000009410b2', 'Policy City', 'bed', 'COM-2', 'Comm Remodel Permit', 'building', 'applied', false, 'Commercial remodel', '77 KILN ST', '77 kiln st', CURRENT_DATE - 2, 'Tall Pine Development', 'tallpinedevelopment');
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, decided_by) VALUES
  ('00000000-0000-0000-0000-0000009410b1', 'look', 'Fixture.', '00000000-0000-0000-0000-0000009410a1');
INSERT INTO public.permit_pulls (source, city, rows_seen, rows_kept) VALUES ('bed', 'Policy City', 2, 2);
INSERT INTO public.builders (key, name, updated_by) VALUES ('ridgewaybuilders', 'Ridgeway Builders', '00000000-0000-0000-0000-0000009410a1');
INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by) VALUES ('ridgewaybuilders', 'good', 'Pays on time.', '00000000-0000-0000-0000-0000009410a1');

CREATE SCHEMA pp;
GRANT USAGE ON SCHEMA pp TO authenticated, anon, service_role;
CREATE FUNCTION pp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pp.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The plan of a statement as one string, for the InitPlan probe.
CREATE FUNCTION pp.plan_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE line text; out text := '';
BEGIN
  FOR line IN EXECUTE 'EXPLAIN ' || p_sql LOOP out := out || line || E'\n'; END LOOP;
  RETURN out;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pp TO authenticated, anon, service_role;

-- 1. Every policy that names the rule names it inside a subquery; none is left bare.
SELECT pp.same('no policy on the Permits tables runs the rule once per row',
  (SELECT count(*)::text FROM pg_policy p
   WHERE p.polrelid IN ('public.permits'::regclass, 'public.permit_verdicts'::regclass, 'public.permit_pulls'::regclass, 'public.permit_lookups'::regclass,
                        'public.builders'::regclass, 'public.builder_marks'::regclass, 'public.builder_customer_answers'::regclass)
     AND (COALESCE(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '')) ~ 'user_can_research_permits\(\)'
     AND (COALESCE(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '')) !~ 'SELECT user_can_research_permits\(\)'),
  '0');
SELECT pp.same('thirteen policies carry the rule in its once-per-statement form',
  (SELECT count(*)::text FROM pg_policy p
   WHERE p.polrelid IN ('public.permits'::regclass, 'public.permit_verdicts'::regclass, 'public.permit_pulls'::regclass, 'public.permit_lookups'::regclass,
                        'public.builders'::regclass, 'public.builder_marks'::regclass, 'public.builder_customer_answers'::regclass)
     AND (COALESCE(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '')) ~ 'SELECT user_can_research_permits\(\)'),
  '13');
-- The row's own test still stands beside the rule on each write.
SELECT pp.same('a verdict is still written in the writer''s own name',
  (SELECT (pg_get_expr(polwithcheck, polrelid) ~ 'decided_by = auth.uid\(\)')::text FROM pg_policy WHERE polrelid = 'public.permit_verdicts'::regclass AND polname = 'permit_verdicts_insert'), 'true');
SELECT pp.same('a dropped file is still the only row the office inserts',
  (SELECT (pg_get_expr(polwithcheck, polrelid) ~ 'source = ''file''')::text FROM pg_policy WHERE polrelid = 'public.permits'::regclass AND polname = 'permits_insert_file'), 'true');

-- 2. An estimator reads what they read before, and the planner runs the rule once.
SELECT pp.sign_in('00000000-0000-0000-0000-0000009410a1');
SET LOCAL ROLE authenticated;
SELECT pp.same('an estimator reads the permits', (SELECT count(*)::text FROM public.permits WHERE city = 'Policy City'), '2');
SELECT pp.same('an estimator reads the verdicts', (SELECT count(*)::text FROM public.permit_verdicts WHERE permit_id = '00000000-0000-0000-0000-0000009410b1'), '1');
SELECT pp.same('an estimator reads the pulls', (SELECT count(*)::text FROM public.permit_pulls WHERE city = 'Policy City'), '1');
SELECT pp.same('an estimator reads the builders and their marks',
  (SELECT count(*)::text FROM public.builders WHERE key = 'ridgewaybuilders') || '/' || (SELECT count(*)::text FROM public.builder_marks WHERE builder_key = 'ridgewaybuilders'), '1/1');
SELECT pp.same('the rule is an InitPlan on a read of permits', (pp.plan_of('SELECT count(*) FROM public.permits WHERE city = ''Policy City''') ~ 'InitPlan')::text, 'true');
SELECT pp.same('the list still reads through the rule', (SELECT count(*)::text FROM public.research_permits_v2('Policy City', CURRENT_DATE - 30, false)), '2');

-- An estimator writes what they wrote before, in their own name and no one else's.
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, decided_by) VALUES ('00000000-0000-0000-0000-0000009410b2', 'not_for_us', 'Passed on the skim.', '00000000-0000-0000-0000-0000009410a1');
SELECT pp.same('an estimator answers a permit', (SELECT count(*)::text FROM public.permit_verdicts WHERE permit_id = '00000000-0000-0000-0000-0000009410b2'), '1');
DO $$ BEGIN
  INSERT INTO public.permit_verdicts (permit_id, verdict, reason, decided_by) VALUES ('00000000-0000-0000-0000-0000009410b2', 'look', 'In another name.', '00000000-0000-0000-0000-0000009410a2');
  RAISE EXCEPTION 'an estimator answered in another person''s name';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: an answer in another name is refused';
END $$;
INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by) VALUES ('ridgewaybuilders', 'avoid', 'Slow to pay.', '00000000-0000-0000-0000-0000009410a1');
UPDATE public.builders SET kind = 'gc', updated_by = '00000000-0000-0000-0000-0000009410a1' WHERE key = 'ridgewaybuilders';
SELECT pp.same('an estimator marks a builder and says its kind', (SELECT kind FROM public.builders WHERE key = 'ridgewaybuilders') || '/' || (SELECT count(*)::text FROM public.builder_marks WHERE builder_key = 'ridgewaybuilders'), 'gc/2');
DO $$ BEGIN
  INSERT INTO public.permits (city, source, permit_number, permit_type, kind, stage) VALUES ('Policy City', 'bed', 'X-1', 'Comm New Building Permit', 'building', 'applied');
  RAISE EXCEPTION 'an estimator inserted a permit that is not a dropped file';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: only a dropped file''s rows are inserted by a person';
END $$;
INSERT INTO public.permits (city, source, permit_number, permit_type, kind, stage) VALUES ('Policy City', 'file', 'F-1', 'Comm New Building Permit', 'building', 'applied');
SELECT pp.same('a dropped file''s row lands', (SELECT count(*)::text FROM public.permits WHERE city = 'Policy City' AND source = 'file'), '1');
RESET ROLE;

-- 3. A helper reads and writes nothing, as before.
SELECT pp.sign_in('00000000-0000-0000-0000-0000009410a2');
SET LOCAL ROLE authenticated;
SELECT pp.same('a helper reads no permit, verdict, pull, builder or mark',
  (SELECT count(*)::text FROM public.permits) || '/' || (SELECT count(*)::text FROM public.permit_verdicts) || '/' || (SELECT count(*)::text FROM public.permit_pulls) || '/' ||
  (SELECT count(*)::text FROM public.builders) || '/' || (SELECT count(*)::text FROM public.builder_marks), '0/0/0/0/0');
DO $$ BEGIN
  INSERT INTO public.permit_verdicts (permit_id, verdict, reason, decided_by) VALUES ('00000000-0000-0000-0000-0000009410b1', 'look', 'A helper.', '00000000-0000-0000-0000-0000009410a2');
  RAISE EXCEPTION 'a helper answered a permit';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper answers nothing';
END $$;
DO $$ BEGIN
  INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by) VALUES ('ridgewaybuilders', 'good', 'A helper.', '00000000-0000-0000-0000-0000009410a2');
  RAISE EXCEPTION 'a helper marked a builder';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper marks nothing';
END $$;
RESET ROLE;

-- 4. Anon is refused outright.
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM count(*) FROM public.permits;
  RAISE EXCEPTION 'anon read the permits';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon reads no permit';
END $$;
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'permit_policies PASSED'; END $$;
ROLLBACK;
