-- The daily log's press (v2.4957, the Building lane's U3a-i; its tighter rules v2.5131, U3b-i): gc_save_daily_log
-- writes a day's log with its crews and delays, replaces that day's when saved again, keeps a hired trade's start
-- promise when its crew is on site, and refuses in words a training account, a digital twin, a job not being built, a
-- day after the writer's or before work started, a writer's day off the server's, a missing high or low, a trade not
-- on the job, and a trade with no signed statement of work; the tables' own checks refuse a sky or a reason they do
-- not know, and RLS a role outside Building's dev door. Presses run through RLS, the
-- fixture made as postgres; everything runs inside one transaction that rolls back. Raises on the
-- first failed assertion; ends with "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, and an estimator (no policy on
-- Building's tables while they are built).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@building.test'),
  ('00000000-0000-0000-0000-0000000006d2', 'trainee@building.test'),
  ('00000000-0000-0000-0000-0000000006d3', 'twin@building.test'),
  ('00000000-0000-0000-0000-0000000006d4', 'estimator@building.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@building.test', 'Building Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000006d2', 'trainee@building.test', 'Building Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000006d3', 'twin@building.test', 'Building Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000006d4', 'estimator@building.test', 'Building Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000006d2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000006d3';

-- Two GC jobs: A being built since three days ago, with Concrete awarded to Ridgeway with a signed statement
-- of work, our own Plumbing, and Framing not signed yet; B still bidding, with Electrical.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000006c1', 'Building Test Owner', '00000000-0000-0000-0000-0000000006d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'Building test A', '00000000-0000-0000-0000-0000000006c1'),
  ('00000000-0000-0000-0000-0000000006a2', 'Building test B', '00000000-0000-0000-0000-0000000006c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'building', current_date - 3),
  ('00000000-0000-0000-0000-0000000006a2', 'bidding', NULL);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006a1', 'Plumbing', 1, true),
  ('00000000-0000-0000-0000-0000000006b3', '00000000-0000-0000-0000-0000000006a2', 'Electrical', 0, false),
  ('00000000-0000-0000-0000-0000000006b4', '00000000-0000-0000-0000-0000000006a1', 'Framing', 2, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES ('00000000-0000-0000-0000-0000000006e1', 'Ridgeway Concrete', ARRAY['Concrete']);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006e1');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000006f1', awarded_on = current_date - 10 WHERE id = '00000000-0000-0000-0000-0000000006b1';
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006e1', 'signed', 30000, 10, current_date - 8, current_date - 6);
-- Ridgeway's promises on Concrete: its start, which its crew on site keeps, and its submittals, which a log never does.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-0000000006e1', 'start', '00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006b1', 'the start', current_date + 2, 'office'),
  ('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-0000000006e1', 'submittals', '00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006b1', 'the submittals', current_date + 2, 'office');

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A log as the window sends it, for job A on a day `d` days from today, written today.
CREATE FUNCTION gbt.log(d integer, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'projectId', '00000000-0000-0000-0000-0000000006a1',
    'date', to_char(current_date + d, 'YYYY-MM-DD'),
    'today', to_char(current_date, 'YYYY-MM-DD'),
    'sky', 'clear', 'high', 88, 'low', 66, 'weatherStop', false,
    'crews', '[]'::jsonb, 'done', '', 'delays', '[]'::jsonb, 'visitors', ''
  ) || extra $$;
-- What a job's logs read: each day, its sky, who wrote it when, its crews and its delays, one line each.
CREATE FUNCTION gbt.logs(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(
    (l.log_date - current_date) || ' ' || l.sky || ' written ' || (l.written_on - current_date) || ' crews '
      || coalesce((SELECT string_agg(k.trade || ':' || c.workers, ',' ORDER BY k.position) FROM public.gc_daily_log_crews c JOIN public.gc_trade_packages k ON k.id = c.package_id WHERE c.log_id = l.id), '-')
      || ' delays ' || coalesce((SELECT string_agg(coalesce(k.trade, 'job') || ':' || d.reason, ',' ORDER BY d.position) FROM public.gc_daily_log_delays d LEFT JOIN public.gc_trade_packages k ON k.id = d.package_id WHERE d.log_id = l.id), '-'),
    E'\n' ORDER BY l.log_date)
  FROM public.gc_daily_logs l WHERE l.project_id = p_project $$;
-- Ridgeway's promises: each kind with its day kept, from today.
CREATE FUNCTION gbt.promises() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(kind || ' ' || coalesce((kept_on - current_date)::text, 'open'), ', ' ORDER BY kind)
  FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-0000000006e1' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated;

-- The function itself: invoker's rights, signed-out callers cannot run it.
SELECT gbt.same('the press runs with the caller''s rights', (SELECT prosecdef::text FROM pg_proc WHERE proname = 'gc_save_daily_log'), 'false');
SELECT gbt.same('a signed-out caller cannot run it', has_function_privilege('anon', 'public.gc_save_daily_log(jsonb)', 'EXECUTE')::text, 'false');
SELECT gbt.same('a signed-in caller can', has_function_privilege('authenticated', 'public.gc_save_daily_log(jsonb)', 'EXECUTE')::text, 'true');

SELECT gbt.as_user('00000000-0000-0000-0000-0000000006d1');
SET LOCAL ROLE authenticated;

-- Today's log: two trades on site (a line with nobody on it is left off), the job's weather delay first, then Concrete's.
SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object(
  'sky', 'rain', 'weatherStop', true, 'done', 'Footings poured on the east side.',
  'crews', jsonb_build_array(
    jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b1', 'workers', 4),
    jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b2', 'workers', 3),
    jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b1', 'workers', 0)),
  'delays', jsonb_build_array(
    jsonb_build_object('packageId', NULL, 'reason', 'weather', 'note', 'Lightning at noon.'),
    jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b1', 'reason', 'materials', 'note', 'Rebar late.')))));
SELECT gbt.same('today''s log reads back with its crews and delays', gbt.logs('00000000-0000-0000-0000-0000000006a1'),
  '0 rain written 0 crews Concrete:4,Plumbing:3 delays job:weather,Concrete:materials');

-- The same day again: one log, its crews and delays replaced.
SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object(
  'crews', jsonb_build_array(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b1', 'workers', 5)))));
SELECT gbt.same('saving a day again replaces its log', gbt.logs('00000000-0000-0000-0000-0000000006a1'),
  '0 clear written 0 crews Concrete:5 delays -');

-- Concrete's crew on site kept Ridgeway's start, on the log's day; its submittals stay open.
SELECT gbt.same('a hired trade''s crew on site keeps its start promise', gbt.promises(), 'start 0, submittals open');

-- A day missed, caught up today: written after its day.
SELECT public.gc_save_daily_log(gbt.log(-1, jsonb_build_object('sky', 'cloudy')));
SELECT gbt.same('a caught-up day says it was written later', gbt.logs('00000000-0000-0000-0000-0000000006a1'),
  E'-1 cloudy written 0 crews - delays -\n0 clear written 0 crews Concrete:5 delays -');

-- The refusals, in words.
SELECT gbt.refused('a day after the writer''s', $s$SELECT public.gc_save_daily_log(gbt.log(1))$s$, 'never before');
SELECT gbt.refused('a day before work started, said as "Oct 5"', $s$SELECT public.gc_save_daily_log(gbt.log(-4))$s$, 'Work started ' || to_char(current_date - 3, 'Mon FMDD') || '. A log before');
SELECT gbt.refused('no high', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('high', NULL)))$s$, 'Say the day’s high and low');
SELECT gbt.refused('no low at all', $s$SELECT public.gc_save_daily_log(gbt.log(0) - 'low')$s$, 'Say the day’s high and low');
SELECT gbt.refused('a high in words', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('high', 'hot')))$s$, 'Say the day’s high and low');
SELECT gbt.refused('a trade with no signed statement of work on the crews', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('crews', jsonb_build_array(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b4', 'workers', 3)))))$s$, 'no signed statement of work');
SELECT gbt.refused('a trade with no signed statement of work on the delays', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('delays', jsonb_build_array(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b4', 'reason', 'crew', 'note', '')))))$s$, 'no signed statement of work');
SELECT gbt.refused('a page whose day is off the server''s', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('today', to_char(current_date + 3, 'YYYY-MM-DD'))))$s$, 'out of date');
SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000006a2')))$s$, 'starts once work starts');
SELECT gbt.refused('a job that does not exist', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000006ff')))$s$, 'No GC project with that id');
SELECT gbt.refused('another job''s trade on the crews', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('crews', jsonb_build_array(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b3', 'workers', 2)))))$s$, 'not on this job');
SELECT gbt.refused('another job''s trade on the delays', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('delays', jsonb_build_array(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b3', 'reason', 'crew', 'note', '')))))$s$, 'not on this job');
SELECT gbt.refused('a sky the table does not know', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('sky', 'hail')))$s$, 'gc_daily_logs_sky_known');
SELECT gbt.refused('a reason the table does not know', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('delays', jsonb_build_array(jsonb_build_object('packageId', NULL, 'reason', 'lunch', 'note', '')))))$s$, 'gc_daily_log_delays_reason_known');
SELECT gbt.same('a refused press wrote nothing', gbt.logs('00000000-0000-0000-0000-0000000006a1'),
  E'-1 cloudy written 0 crews - delays -\n0 clear written 0 crews Concrete:5 delays -');

-- Who may not.
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account', $s$SELECT public.gc_save_daily_log(gbt.log(0))$s$, 'A training account cannot write a daily log');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin', $s$SELECT public.gc_save_daily_log(gbt.log(0))$s$, 'A digital twin cannot write a daily log');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000006d4');
SET LOCAL ROLE authenticated;
-- An estimator reads the job (door 1) but writes no log: Building's tables let only a dev in.
SELECT gbt.refused('an estimator, outside Building''s dev door', $s$SELECT public.gc_save_daily_log(gbt.log(-2))$s$, 'row-level security');
RESET ROLE;
SELECT gbt.same('nobody but the dev wrote a log', gbt.logs('00000000-0000-0000-0000-0000000006a1'),
  E'-1 cloudy written 0 crews - delays -\n0 clear written 0 crews Concrete:5 delays -');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
