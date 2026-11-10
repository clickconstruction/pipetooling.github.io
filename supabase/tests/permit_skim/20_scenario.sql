-- Permits, the skim's ground (v2.6835, punch list #302, migration *_permit_skim): the builder's key on a permit, what
-- the office says about a builder and its marks, the hand-off and the put-back on a verdict, and the three reads the
-- skim, the Builders page and the count stand on. Fixtures are written as postgres; the tries run as an estimator and
-- as a helper under RLS; everything rolls back. Raises on the first failed assertion; ends with "permit_skim PASSED".
-- See scripts/pgtest-permit-skim.sh. Never against prod. Every name and street is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003020a1', 'eve@skim.test'),
  ('00000000-0000-0000-0000-0000003020a2', 'sam@skim.test'),
  ('00000000-0000-0000-0000-0000003020a3', 'hal@skim.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000003020a1', 'eve@skim.test', 'Eve Estimator', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000003020a2', 'sam@skim.test', 'Sam Second', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000003020a3', 'hal@skim.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- Three commercial building permits and a house. Ridgeway pulled two; a plumber is on one of them.
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, residential, work_type, address, address_key, submitted_on, contact) VALUES
  ('00000000-0000-0000-0000-0000003020b1', 'Skim City', 'bed', 'COM-1', 'Comm New Building Permit', 'building', 'applied', false, 'New commercial', '100 SAMPLE ST', '100 sample st', CURRENT_DATE - 5, 'Dana Whitlock, Ridgeway Builders'),
  ('00000000-0000-0000-0000-0000003020b2', 'Skim City', 'bed', 'COM-2', 'Comm Remodel Permit', 'building', 'applied', false, 'Commercial remodel', '77 KILN ST', '77 kiln st', CURRENT_DATE - 9, 'RIDGEWAY BUILDERS LLC'),
  ('00000000-0000-0000-0000-0000003020b3', 'Skim City', 'bed', 'COM-3', 'Commercial Project Application', 'building', 'applied', false, 'Commercial project', '5 ASTER RDG', '5 aster rdg', CURRENT_DATE - 2, 'Tall Pine Development'),
  ('00000000-0000-0000-0000-0000003020b4', 'Skim City', 'bed', 'RES-1', 'Res New Building Permit', 'building', 'applied', true, 'New house', '9 LARKSPUR CT', '9 larkspur ct', CURRENT_DATE - 3, 'Ridgeway Builders'),
  ('00000000-0000-0000-0000-0000003020c2', 'Skim City', 'bed', 'COM-2', 'Plumbing Permit', 'plumbing', 'issued', false, 'Plumbing', '77 KILN ST', '77 kiln st', CURRENT_DATE - 4, 'Blue Heron Plumbing');

CREATE SCHEMA ps;
GRANT USAGE ON SCHEMA ps TO authenticated, service_role;
CREATE FUNCTION ps.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ps.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ps TO authenticated, service_role;

-- The service role hands the keys back, the way permit-pull does; nobody signed in can.
SET LOCAL ROLE service_role;
SELECT ps.same('the pull sets four keys', public.permit_set_builder_keys('[
  {"id":"00000000-0000-0000-0000-0000003020b1","key":"ridgewaybuilders"},
  {"id":"00000000-0000-0000-0000-0000003020b2","key":"ridgewaybuilders"},
  {"id":"00000000-0000-0000-0000-0000003020b3","key":"tallpinedevelopment"},
  {"id":"00000000-0000-0000-0000-0000003020b4","key":"ridgewaybuilders"}]'::jsonb)::text, '4');
SELECT ps.same('a second run changes nothing', public.permit_set_builder_keys('[{"id":"00000000-0000-0000-0000-0000003020b1","key":"ridgewaybuilders"}]'::jsonb)::text, '0');
RESET ROLE;

SELECT ps.sign_in('00000000-0000-0000-0000-0000003020a1');
SET LOCAL ROLE authenticated;

DO $$ BEGIN
  PERFORM public.permit_set_builder_keys('[]'::jsonb);
  RAISE EXCEPTION 'an estimator set builder keys';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: only the service role sets builder keys';
END $$;

-- The nudge's read: two wait (the third has a plumber), the oldest filed five days ago.
SELECT ps.same('two permits wait on a skim, the oldest five days', (SELECT waiting || ' since ' || (CURRENT_DATE - oldest_on) FROM public.permit_skim_wait('Skim City')), '2 since 5');

-- The read: three commercial rows, the builder beside each, the taken one paired.
SELECT ps.same('v2 lists the commercial permits, newest first',
  (SELECT string_agg(permit_number || ':' || COALESCE(builder_key, '-') || ':' || builder_permits || '/' || builder_open || ':' || COALESCE(plumber, 'none'), ' ' ORDER BY filed_on DESC)
   FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false)),
  'COM-3:tallpinedevelopment:1/1:none COM-1:ridgewaybuilders:2/1:none COM-2:ridgewaybuilders:2/1:Blue Heron Plumbing');

-- A keep handed to Sam, with its reason code.
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, reason_code, for_user_id, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b1', 'look', 'Kept on the skim.', NULL, '00000000-0000-0000-0000-0000003020a2', '00000000-0000-0000-0000-0000003020a1', now() - interval '3 hours');
SELECT ps.same('a keep shows who it is for',
  (SELECT verdict || ' for ' || verdict_for_name FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-1'),
  'look for Sam Second');

-- A pass with a code, then a put-back: the permit waits again on both reads.
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, reason_code, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b3', 'not_for_us', 'Passed on the skim: too far.', 'too_far', '00000000-0000-0000-0000-0000003020a1', now() - interval '2 hours');
SELECT ps.same('a pass carries its code',
  (SELECT verdict || ':' || verdict_reason_code FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-3'), 'not_for_us:too_far');
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b3', 'back', 'Put back on the skim.', '00000000-0000-0000-0000-0000003020a1', now() - interval '1 hour');
SELECT ps.same('a put-back reads as unanswered on the ledger read',
  (SELECT COALESCE(verdict, 'none') FROM public.research_permits('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-3'), 'none');
SELECT ps.same('and on v2, with nothing left of the old answer',
  (SELECT COALESCE(verdict, 'none') || ':' || COALESCE(verdict_reason_code, 'none') || ':' || COALESCE(verdict_reason, 'none') FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-3'), 'none:none:none');

-- A pursue says what it is for, and only one of the three.
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, pursue_for, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b1', 'approach', 'Our size.', 'next_jobs', '00000000-0000-0000-0000-0000003020a1', now() - interval '30 minutes');
DO $$ BEGIN
  INSERT INTO public.permit_verdicts (permit_id, verdict, reason, pursue_for, decided_by) VALUES ('00000000-0000-0000-0000-0000003020b1', 'approach', 'x', 'someday', '00000000-0000-0000-0000-0000003020a1');
  RAISE EXCEPTION 'a pursue took an unknown purpose';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a pursue is for this job, their next jobs or both';
END $$;

-- The mark: a good needs its reason, the newest wins, none clears it.
DO $$ BEGIN
  INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by) VALUES ('ridgewaybuilders', 'good', '  ', '00000000-0000-0000-0000-0000003020a1');
  RAISE EXCEPTION 'a mark landed with no reason';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a good mark needs its reason';
END $$;
INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by, marked_at) VALUES ('ridgewaybuilders', 'good', 'Pays on time.', '00000000-0000-0000-0000-0000003020a1', now() - interval '2 hours');
SELECT ps.same('the mark rides on every permit of the builder',
  (SELECT string_agg(permit_number || ':' || COALESCE(builder_mark, 'none') || ':' || COALESCE(builder_mark_by_name, '-'), ' ' ORDER BY permit_number) FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false)),
  'COM-1:good:Eve Estimator COM-2:good:Eve Estimator COM-3:none:-');
INSERT INTO public.builder_marks (builder_key, mark, marked_by) VALUES ('ridgewaybuilders', 'none', '00000000-0000-0000-0000-0000003020a1');
SELECT ps.same('none clears the mark',
  (SELECT COALESCE(builder_mark, 'none') || ':' || COALESCE(builder_mark_reason, 'none') FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-1'), 'none:none');
INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by, marked_at) VALUES ('tallpinedevelopment', 'avoid', 'Slow pay.', '00000000-0000-0000-0000-0000003020a1', now() + interval '1 second');

-- What the office says about a name: its kind, written by the one who says it.
INSERT INTO public.builders (key, name, kind, updated_by) VALUES ('ridgewaybuilders', 'Ridgeway Builders', 'gc', '00000000-0000-0000-0000-0000003020a1');
DO $$ BEGIN
  INSERT INTO public.builders (key, name, kind, updated_by) VALUES ('tallpinedevelopment', 'Tall Pine Development', 'gc', '00000000-0000-0000-0000-0000003020a2');
  RAISE EXCEPTION 'a builder row was written in another name';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a builder row is written in the writer''s own name';
END $$;

SELECT ps.same('Builders lists each name with its permits, its open ones, its plumber and its mark',
  (SELECT string_agg(key || ':' || COALESCE(name, '-') || ':' || COALESCE(kind, '-') || ':' || permits || '/' || open || ':' || COALESCE(plumber, 'nobody') || 'x' || plumber_jobs || ':' || COALESCE(mark, 'none') || ':' || bids, ' ' ORDER BY key)
   FROM public.research_builders('Skim City')),
  'ridgewaybuilders:Ridgeway Builders:gc:2/1:Blue Heron Plumbingx1:none:0 tallpinedevelopment:-:-:1/1:nobodyx0:avoid:0');

-- The count: three arrived; two were skimmed, both by Eve; one stands pursued for their next jobs; the put-back counts nowhere.
SELECT ps.same('the count',
  (SELECT (f->>'arrived') || ' arrived, ' || (f->>'skimmed') || ' skimmed, ' || (f->>'kept') || ' kept, ' || (f->>'passed') || ' passed, ' || (f->>'pursuing') || ' pursuing, ' || (f->>'bid') || ' bid, by ' || (f->'by_person'->0->>'name') || ' ' || (f->'by_person'->0->>'n') || ', for ' || (f->'pursue_for'->0->>'code')
   FROM (SELECT public.permit_funnel('Skim City', CURRENT_DATE - 30) AS f) x),
  '3 arrived, 2 skimmed, 0 kept, 0 passed, 1 pursuing, 0 bid, by Eve Estimator 2, for next_jobs');
RESET ROLE;

-- A helper reads none of it and marks nothing.
SELECT ps.sign_in('00000000-0000-0000-0000-0000003020a3');
SET LOCAL ROLE authenticated;
SELECT ps.same('a helper reads no builder, no mark and no permit',
  (SELECT count(*) FROM public.builders)::text || '/' || (SELECT count(*) FROM public.builder_marks)::text || '/' || (SELECT count(*) FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false))::text, '0/0/0');
DO $$ BEGIN
  INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by) VALUES ('ridgewaybuilders', 'avoid', 'x', '00000000-0000-0000-0000-0000003020a3');
  RAISE EXCEPTION 'a helper marked a builder';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper marks no builder';
END $$;
RESET ROLE;

-- The fences reached the two new tables, and the new reads are closed to the anon key.
SELECT ps.same('both tables carry the read-only fence',
  (SELECT count(DISTINCT tablename)::text FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('builders', 'builder_marks') AND permissive = 'RESTRICTIVE'), '2');
SELECT ps.same('anon runs none of the new functions',
  (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('research_permits_v2', 'research_builders', 'permit_funnel', 'permit_set_builder_keys', 'permit_skim_wait') AND has_function_privilege('anon', p.oid, 'EXECUTE')), '0');

DO $$ BEGIN RAISE NOTICE 'permit_skim PASSED'; END $$;
ROLLBACK;
