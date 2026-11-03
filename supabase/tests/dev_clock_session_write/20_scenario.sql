-- The dev seat's clock session door (v2.6437): dev_clock_session_write adjusts a session's start and end, its
-- description, its job and its approval, op by op, each op applied, held or refused with its reason; a dry run
-- performs and unwinds every write; a dev may approve and recompute the hours (the two live RPCs pasted with
-- one line each); a role outside the door is refused in words; the dev's own session is never approved by the
-- dev. Fixtures made as postgres; the door runs as the dev through RLS; everything runs inside one transaction
-- that rolls back. Raises on the first failed assertion; ends with "dev_clock_session_write PASSED". See
-- scripts/pgtest-dev-clock-session-write.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA dcs;
CREATE FUNCTION dcs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION dcs.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION dcs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The door with a reason and these ops, as a dry run or for real.
CREATE FUNCTION dcs.door(ops jsonb, dry boolean DEFAULT true) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.dev_clock_session_write(jsonb_build_object('reason', 'the bed', 'ops', ops), dry) $$;
-- A session's row as the bed reads it (as postgres, past RLS).
CREATE FUNCTION dcs.row(p uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_char(cs.clocked_in_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD HH24:MI') || '→'
      || to_char(cs.clocked_out_at AT TIME ZONE 'America/Chicago', 'HH24:MI') || ' ' || cs.work_date || ' job ' || COALESCE(j.job_name, '-')
      || ' notes "' || COALESCE(cs.notes, '') || '" ' || CASE WHEN cs.approved_at IS NULL THEN 'waiting' ELSE 'approved' END
  FROM public.clock_sessions cs LEFT JOIN public.jobs_ledger j ON j.id = cs.job_ledger_id WHERE cs.id = p $$;
CREATE FUNCTION dcs.hours(p_name text, p_day date) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT round(h.hours::numeric, 2)::text FROM public.people_hours h WHERE h.person_name = p_name AND h.work_date = p_day), 'none') $$;
GRANT USAGE ON SCHEMA dcs TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dcs TO authenticated;

-- Who: a dev, a worker, an estimator (outside the door).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@clock.test'),
  ('00000000-0000-0000-0000-0000000007d2', 'worker@clock.test'),
  ('00000000-0000-0000-0000-0000000007d3', 'estimator@clock.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@clock.test', 'Clock Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000007d2', 'worker@clock.test', 'Clock Worker', 'helpers'),
  ('00000000-0000-0000-0000-0000000007d3', 'estimator@clock.test', 'Clock Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- The second look is on, so the approval guard holds the dev's own day and the hours the dev typed (off by default).
INSERT INTO public.app_settings (key, value_text) VALUES ('typed_hours_second_look_v1', 'on')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;

-- Two jobs under the dev, on one service type.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000007f1', 'Clock bed work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007f1', 'Clock bed job A'),
  ('00000000-0000-0000-0000-0000000007a2', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007f1', 'Clock bed job B');

-- Sessions: the worker's approved day (s1), the worker's day waiting for approval (s2) and a second one (s4),
-- the dev's own waiting day (s3), and a revoked one (s5).
INSERT INTO public.clock_sessions (id, user_id, job_ledger_id, clocked_in_at, clocked_out_at, work_date, origin, notes, approved_at, approved_by) VALUES
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007a1',
   '2026-03-09 08:00-06', '2026-03-09 16:00-06', '2026-03-09', 'user_punch', 'pinpoint', '2026-03-10 07:00-06', '00000000-0000-0000-0000-0000000007d1'),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007a1',
   '2026-03-10 08:00-06', '2026-03-10 12:00-06', '2026-03-10', 'user_punch', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000000007e4', '00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007a1',
   '2026-03-11 08:00-06', '2026-03-11 12:00-06', '2026-03-11', 'user_punch', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000000007e3', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007a1',
   '2026-03-10 09:00-06', '2026-03-10 10:00-06', '2026-03-10', 'user_punch', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000000007e5', '00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007a1',
   '2026-03-12 08:00-06', '2026-03-12 12:00-06', '2026-03-12', 'user_punch', NULL, NULL, NULL);
UPDATE public.clock_sessions SET revoked_at = now(), revoked_by = '00000000-0000-0000-0000-0000000007d1' WHERE id = '00000000-0000-0000-0000-0000000007e5';

-- The door's rights: the definer, closed to anon, open to a signed-in caller (gated is_dev() inside).
SELECT dcs.same('the door runs with the definer''s rights', (SELECT prosecdef::text FROM pg_proc WHERE proname = 'dev_clock_session_write'), 'true');
SELECT dcs.same('a signed-out caller cannot run it', has_function_privilege('anon', 'public.dev_clock_session_write(jsonb, boolean)', 'EXECUTE')::text, 'false');
SELECT dcs.same('a signed-in caller can reach it', has_function_privilege('authenticated', 'public.dev_clock_session_write(jsonb, boolean)', 'EXECUTE')::text, 'true');

-- Outside the door: an estimator is refused in words, whatever the ops.
SELECT dcs.as_user('00000000-0000-0000-0000-0000000007d3');
SET LOCAL ROLE authenticated;
SELECT dcs.refused('an estimator is refused', $q$SELECT dcs.door('[{"op":"note","session_id":"00000000-0000-0000-0000-0000000007e2","note":"x"}]'::jsonb)$q$, 'devs only');
RESET ROLE;

-- As the dev.
SELECT dcs.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;

-- The call's own shape: a reason is required; ops must be a non-empty array.
SELECT dcs.refused('no reason is refused', $q$SELECT public.dev_clock_session_write('{"ops":[{"op":"note","session_id":"00000000-0000-0000-0000-0000000007e2","note":"x"}]}'::jsonb, true)$q$, 'reason is required');
SELECT dcs.refused('no ops is refused', $q$SELECT public.dev_clock_session_write('{"reason":"why","ops":[]}'::jsonb, true)$q$, 'ops is required');

-- A dry run performs and unwinds: the reply shows before and after, the row is as it was.
DO $$
DECLARE r jsonb;
BEGIN
  r := dcs.door('[{"op":"times","session_id":"00000000-0000-0000-0000-0000000007e2","start":"2026-03-10T09:00:00-06:00","end":"2026-03-10T13:30:00-06:00"}]'::jsonb, true);
  PERFORM dcs.same('the dry run says so', (r->>'dry_run'), 'true');
  PERFORM dcs.same('the dry run applied one op', (r->>'applied') || '/' || (r->>'held') || '/' || (r->>'refused'), '1/0/0');
  PERFORM dcs.same('the dry run names the person', r->'ops'->0->>'person', 'Clock Worker');
  PERFORM dcs.same('the dry run shows the hours before', r->'ops'->0->'before'->>'hours', '4.00');
  PERFORM dcs.same('the dry run shows the hours after', r->'ops'->0->'after'->>'hours', '4.50');
  PERFORM dcs.same('the dry run shows the job', r->'ops'->0->'after'->'job'->>'name', 'Clock bed job A');
END $$;
SELECT dcs.same('the dry run wrote nothing', dcs.row('00000000-0000-0000-0000-0000000007e2'), '2026-03-10 08:00→12:00 2026-03-10 job Clock bed job A notes "" waiting');

-- For real: the start and the end, then the note, then the move — each op its own line.
DO $$
DECLARE r jsonb;
BEGIN
  r := dcs.door('[{"op":"times","session_id":"00000000-0000-0000-0000-0000000007e2","start":"2026-03-10T09:00:00-06:00","end":"2026-03-10T13:30:00-06:00"},
                 {"op":"note","session_id":"00000000-0000-0000-0000-0000000007e2","note":"  trench, north wall "},
                 {"op":"move","session_id":"00000000-0000-0000-0000-0000000007e2","job_id":"00000000-0000-0000-0000-0000000007a2"}]'::jsonb, false);
  PERFORM dcs.same('three ops applied', (r->>'applied') || '/' || (r->>'held') || '/' || (r->>'refused'), '3/0/0');
  PERFORM dcs.same('the move names the job', r->'ops'->2->>'words', 'moved to Clock bed job B');
  PERFORM dcs.same('the reply names the dev', r->>'by', 'Clock Dev');
END $$;
SELECT dcs.same('the session reads the new start, end, note and job', dcs.row('00000000-0000-0000-0000-0000000007e2'), '2026-03-10 09:00→13:30 2026-03-10 job Clock bed job B notes "trench, north wall" waiting');

-- An approved session's hours follow into people_hours: the dev may recompute (the one line added).
DO $$
DECLARE r jsonb;
BEGIN
  r := dcs.door('[{"op":"times","session_id":"00000000-0000-0000-0000-0000000007e1","start":"2026-03-09T08:00:00-06:00","end":"2026-03-09T17:00:00-06:00"}]'::jsonb, false);
  PERFORM dcs.same('the approved day took the new end', (r->>'applied'), '1');
END $$;
SELECT dcs.same('people_hours reads the approved day''s new hours', dcs.hours('Clock Worker', '2026-03-09'), '9.00');

-- Approval: the worker's waiting day is approved by the dev; the dev's own day is never approved by the dev.
DO $$
DECLARE r jsonb;
BEGIN
  r := dcs.door('[{"op":"approve","session_id":"00000000-0000-0000-0000-0000000007e4"},
                 {"op":"approve","session_id":"00000000-0000-0000-0000-0000000007e3"}]'::jsonb, false);
  PERFORM dcs.same('the worker''s day is approved', r->'ops'->0->>'outcome', 'applied');
  PERFORM dcs.same('the dev''s own day is held for someone else', r->'ops'->1->>'outcome' || ' · ' || (r->'ops'->1->>'words'), 'held · held: your own session waits for someone else''s approval');
END $$;
SELECT dcs.same('the worker''s day reads approved', (SELECT CASE WHEN approved_at IS NULL THEN 'waiting' ELSE 'approved' END FROM public.clock_sessions WHERE id = '00000000-0000-0000-0000-0000000007e4'), 'approved');
SELECT dcs.same('the dev''s own day still waits', (SELECT CASE WHEN approved_at IS NULL THEN 'waiting' ELSE 'approved' END FROM public.clock_sessions WHERE id = '00000000-0000-0000-0000-0000000007e3'), 'waiting');
SELECT dcs.same('an approved day''s hours are in people_hours', dcs.hours('Clock Worker', '2026-03-11'), '4.00');

-- Do what is ready: a refused op is named with its reason and the op beside it still lands.
DO $$
DECLARE r jsonb;
BEGIN
  r := dcs.door('[{"op":"move","session_id":"00000000-0000-0000-0000-0000000007e2","job_id":"00000000-0000-0000-0000-00000000dead"},
                 {"op":"note","session_id":"00000000-0000-0000-0000-0000000007e2","note":"as built"},
                 {"op":"note","session_id":"00000000-0000-0000-0000-0000000007e5","note":"x"},
                 {"op":"split","session_id":"00000000-0000-0000-0000-0000000007e2"},
                 {"op":"times","session_id":"00000000-0000-0000-0000-0000000007e2","start":"2026-03-10T09:00:00-06:00","end":"2026-03-10T08:00:00-06:00"},
                 {"op":"approve","session_id":"00000000-0000-0000-0000-0000000007e4"}]'::jsonb, false);
  PERFORM dcs.same('one op applied, five refused', (r->>'applied') || '/' || (r->>'held') || '/' || (r->>'refused'), '1/0/5');
  PERFORM dcs.same('an unknown job is refused with its id', position('not found' IN (r->'ops'->0->>'words'))::text <> '0', 'true');
  PERFORM dcs.same('a revoked session is refused', r->'ops'->2->>'words', 'the session is revoked');
  PERFORM dcs.same('an unknown op is refused', position('unknown op' IN (r->'ops'->3->>'words'))::text <> '0', 'true');
  PERFORM dcs.same('an end before its start is refused', r->'ops'->4->>'words', 'end must be after start');
  PERFORM dcs.same('an approved session is not approved twice', r->'ops'->5->>'words', 'the session is already approved');
END $$;
SELECT dcs.same('the note beside the refusals landed', (SELECT notes FROM public.clock_sessions WHERE id = '00000000-0000-0000-0000-0000000007e2'), 'as built');

RESET ROLE;
ROLLBACK;
\echo dev_clock_session_write PASSED
