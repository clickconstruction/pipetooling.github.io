-- Our own crew from its Pipeline job (v2.5147, the Building lane's U8): gc_link_crew_job names the job a
-- trade our own crew does runs on, and refuses in words a training account, a digital twin, anyone but a
-- dev, a trade we hire, a job that does not exist and a billing-only job, and its guard refuses any other
-- signed-in write to the column while letting the job's delete and server code through. gc_crew_on_site counts the
-- people who clocked in on that job, a trade and a day at a time: a person once a day, a punch waiting
-- for approval in, and a revoked or rejected session, a salary day, a quick add, a sample account, a
-- twin, another job and a hired trade out. Counts only, a dev's, never a twin's, 92 days at most. Presses
-- run through RLS, the fixture made as postgres; everything runs inside one transaction that rolls
-- back. Raises on the first failed assertion; ends with "gc_building PASSED". See
-- scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, an estimator, and five people who
-- clock in: three on the crew, a sample account and a twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@crew.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@crew.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@crew.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@crew.test'),
  ('00000000-0000-0000-0000-0000000009e1', 'ana@crew.test'),
  ('00000000-0000-0000-0000-0000000009e2', 'ben@crew.test'),
  ('00000000-0000-0000-0000-0000000009e3', 'cal@crew.test'),
  ('00000000-0000-0000-0000-0000000009e4', 'sample@crew.test'),
  ('00000000-0000-0000-0000-0000000009e5', 'crewtwin@crew.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@crew.test', 'Crew Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@crew.test', 'Crew Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@crew.test', 'Crew Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@crew.test', 'Crew Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000009e1', 'ana@crew.test', 'Ana Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e2', 'ben@crew.test', 'Ben Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e3', 'cal@crew.test', 'Cal Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e4', 'sample@crew.test', 'Sample Crew', 'assistant'),
  ('00000000-0000-0000-0000-0000000009e5', 'crewtwin@crew.test', 'Twin Crew', 'assistant')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000009d2';
UPDATE public.users SET is_digital_twin = true WHERE id IN ('00000000-0000-0000-0000-0000000009d3', '00000000-0000-0000-0000-0000000009e5');
UPDATE public.users SET is_sample = true WHERE id = '00000000-0000-0000-0000-0000000009e4';

-- Two GC jobs: A with Concrete (hired) and our own Plumbing; B with our own Plumbing too.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000009c1', 'Crew Test Owner', '00000000-0000-0000-0000-0000000009d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'Crew test A', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a2', 'Crew test B', '00000000-0000-0000-0000-0000000009c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'building', current_date - 30),
  ('00000000-0000-0000-0000-0000000009a2', 'building', current_date - 30);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a1', 'Plumbing', 1, true),
  ('00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009a2', 'Plumbing', 0, true);

-- Pipeline jobs: our crew's, a billing-only one, another job, and one to delete.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000009f1', 'Crew Bed Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test plumbing'),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test billing'),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test other job'),
  ('00000000-0000-0000-0000-000000000904', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Crew test gone');
UPDATE public.jobs_ledger SET billing_only = true WHERE id = '00000000-0000-0000-0000-000000000902';

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
GRANT USAGE ON SCHEMA gbt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, anon;
-- A trade by its id's last two digits, and each trade's job as the table holds it.
CREATE FUNCTION gbt.k(n text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000000009' || n)::uuid $$;
CREATE FUNCTION gbt.jobs() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(k.trade || ':' || coalesce(right(k.job_ledger_id::text, 3), '-'), ' ' ORDER BY k.project_id, k.position)
  FROM public.gc_trade_packages k WHERE k.project_id IN ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009a2') $$;
-- What gc_crew_on_site says for job A from `f` to `t` days from today: each row's day, trade and count.
CREATE FUNCTION gbt.counts(f integer, t integer, p_project uuid DEFAULT '00000000-0000-0000-0000-0000000009a1') RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg((c.work_date - current_date) || ' ' || k.trade || ':' || c.people, ', ' ORDER BY c.work_date, k.position), 'none')
  FROM public.gc_crew_on_site(p_project, current_date + f, current_date + t) c
  JOIN public.gc_trade_packages k ON k.id = c.package_id $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, anon;

-- A punch on job `job` by person `who` on the day `d` days from today, its other columns in `extra`.
CREATE FUNCTION gbt.punch(who text, job text, d integer, note text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id)
  VALUES (('00000000-0000-0000-0000-0000000009' || who)::uuid, (current_date + d) + time '08:00', (current_date + d) + time '12:00', current_date + d, note,
    ('00000000-0000-0000-0000-000000000' || job)::uuid) $$;

-- 1) The link: refused in words before the trade is touched.
SET LOCAL ROLE authenticated;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SELECT gbt.refused('a training account', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901')$s$, 'A training account cannot link a Pipeline job.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT gbt.refused('a digital twin', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901')$s$, 'A digital twin cannot link a Pipeline job.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SELECT gbt.refused('an estimator, while Building is built', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901')$s$, 'Only a dev links our crew''s Pipeline job while Building is built.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SELECT gbt.refused('a trade that is not there', $s$SELECT public.gc_link_crew_job('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000901')$s$, 'No trade with that id.');
SELECT gbt.refused('a trade we hire', $s$SELECT public.gc_link_crew_job(gbt.k('b1'), '00000000-0000-0000-0000-000000000901')$s$, 'Only a trade our own crew does has a Pipeline job.');
SELECT gbt.refused('a job that is not there', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-0000000009ff')$s$, 'No Pipeline job with that id.');
SELECT gbt.refused('a billing-only job', $s$SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000902')$s$, 'That job is for billing only. Nobody clocks in on it. Pick the job our crew works on.');
SELECT gbt.same('nothing linked after the refusals', gbt.jobs(), 'Concrete:- Plumbing:- Plumbing:-');

-- 2) A dev links it, lets go and links it again; B's crew names the same job.
SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901');
SELECT gbt.same('A''s plumbing names its job', gbt.jobs(), 'Concrete:- Plumbing:901 Plumbing:-');
SELECT public.gc_link_crew_job(gbt.k('b2'), NULL);
SELECT gbt.same('null lets go', gbt.jobs(), 'Concrete:- Plumbing:- Plumbing:-');
SELECT public.gc_link_crew_job(gbt.k('b2'), '00000000-0000-0000-0000-000000000901');
SELECT public.gc_link_crew_job(gbt.k('b3'), '00000000-0000-0000-0000-000000000901');
SELECT gbt.same('linked again, and B''s too', gbt.jobs(), 'Concrete:- Plumbing:901 Plumbing:901');

-- The guard: only the link changes the column, and its flag is off again once it returns.
SELECT gbt.same('the link turns its flag off before it returns', coalesce(current_setting('gc.crew_job_write', true), ''), '');
SELECT gbt.refused('a dev''s plain write to the column', $s$UPDATE public.gc_trade_packages SET job_ledger_id = '00000000-0000-0000-0000-000000000903' WHERE id = gbt.k('b2')$s$, 'Our crew''s Pipeline job changes only through Pick its Pipeline job on Draws.');
SELECT gbt.refused('a new trade that names a job', $s$INSERT INTO public.gc_trade_packages (project_id, trade, position, ours, job_ledger_id) VALUES ('00000000-0000-0000-0000-0000000009a1', 'Gas', 2, true, '00000000-0000-0000-0000-000000000903')$s$, 'Our crew''s Pipeline job changes only through');
UPDATE public.gc_trade_packages SET budget = 26000 WHERE id = gbt.k('b2');
SELECT gbt.same('a plain write to another column passes, the job kept', gbt.jobs(), 'Concrete:- Plumbing:901 Plumbing:901');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SELECT gbt.refused('the office team''s plain write, which its policy allows', $s$UPDATE public.gc_trade_packages SET job_ledger_id = NULL WHERE id = gbt.k('b2')$s$, 'Our crew''s Pipeline job changes only through');
RESET ROLE;

-- The fixture's punches are made by no one signed in, as server code would.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);

-- 3) The punches. Two days ago: Ana twice and Ben once. Yesterday: Ana approved and Cal waiting. Today:
-- none that counts (Ana revoked, Ben rejected, Cal's salary day, the sample and the twin, Ana's quick
-- add, Ben on another job). Three days ago, Ana: outside the range asked.
SELECT gbt.punch('e1', '901', -2, 'a'), gbt.punch('e1', '901', -2, 'a again'), gbt.punch('e2', '901', -2, 'b');
SELECT gbt.punch('e1', '901', -1, 'a approved'), gbt.punch('e3', '901', -1, 'c waiting');
UPDATE public.clock_sessions SET approved_at = now() WHERE notes = 'a approved';
SELECT gbt.punch('e1', '901', 0, 'revoked'), gbt.punch('e2', '901', 0, 'rejected'), gbt.punch('e3', '901', 0, 'salary'),
  gbt.punch('e4', '901', 0, 'sample'), gbt.punch('e5', '901', 0, 'twin'), gbt.punch('e2', '903', 0, 'other job');
UPDATE public.clock_sessions SET revoked_at = now(), revoked_by = '00000000-0000-0000-0000-0000000009d1' WHERE notes = 'revoked';
UPDATE public.clock_sessions SET rejected_at = now(), rejected_by = '00000000-0000-0000-0000-0000000009d1' WHERE notes = 'rejected';
UPDATE public.clock_sessions SET origin = 'salary_schedule' WHERE notes = 'salary';
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, quick_add_minutes)
  VALUES ('00000000-0000-0000-0000-0000000009e1', current_date + time '19:00', current_date + time '19:15', current_date, 'quick', '00000000-0000-0000-0000-000000000901', 15);
SELECT gbt.punch('e1', '901', -3, 'before the range');
-- A trade we hire with a job set past the function (server code, no one signed in, which the guard lets
-- through): it never counts.
UPDATE public.gc_trade_packages SET job_ledger_id = '00000000-0000-0000-0000-000000000901' WHERE id = gbt.k('b1');

-- 4) The counts.
SET LOCAL ROLE authenticated;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SELECT gbt.same('a person once a day, a waiting punch in, and only what counts', gbt.counts(-2, 0), '-2 Plumbing:2, -1 Plumbing:2');
SELECT gbt.same('the days asked only', gbt.counts(-3, -3), '-3 Plumbing:1');
SELECT gbt.same('B''s crew reads the same job, as its own trade', gbt.counts(-2, -2, '00000000-0000-0000-0000-0000000009a2'), '-2 Plumbing:2');
SELECT gbt.same('92 days is allowed', gbt.counts(-91, 0), '-3 Plumbing:1, -2 Plumbing:2, -1 Plumbing:2');
SELECT gbt.refused('93 days', $s$SELECT gbt.counts(-92, 0)$s$, 'Count at most 92 days at a time.');
SELECT gbt.refused('the days the wrong way round', $s$SELECT gbt.counts(0, -1)$s$, 'Say the first and the last day to count.');
SELECT gbt.refused('no first day', $s$SELECT * FROM public.gc_crew_on_site('00000000-0000-0000-0000-0000000009a1', NULL, current_date)$s$, 'Say the first and the last day to count.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SELECT gbt.same('a dev in training reads it', gbt.counts(-1, -1), '-1 Plumbing:2');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT gbt.refused('a twin, even a dev', $s$SELECT gbt.counts(-2, 0)$s$, 'Only a dev reads our crew''s clock-ins on a GC job while Building is built.');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SELECT gbt.refused('an estimator', $s$SELECT gbt.counts(-2, 0)$s$, 'Only a dev reads our crew''s clock-ins on a GC job while Building is built.');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT gbt.refused('anon', $s$SELECT * FROM public.gc_crew_on_site('00000000-0000-0000-0000-0000000009a1', current_date, current_date)$s$, 'permission denied');
RESET ROLE;

-- 5) A job deleted lets go of the trade, with someone signed in: the guard lets its own key go.
SET LOCAL ROLE authenticated;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SELECT public.gc_link_crew_job(gbt.k('b3'), '00000000-0000-0000-0000-000000000904');
RESET ROLE;
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-000000000904';
SELECT gbt.same('the deleted job let go of B''s crew', gbt.jobs(), 'Concrete:901 Plumbing:901 Plumbing:-');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
