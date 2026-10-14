-- A helper on a job's crew leaves and reads its thread notes (migration *_helper_on_job_thread_notes): helper_on_job
-- answers for the crew and for this week's or last week's dispatch whatever the caller sees of jobs_ledger_team_members,
-- and the thread notes' field branch asks it. Fixtures are written as postgres; presses run as each user; everything
-- rolls back. Raises on the first failed assertion; ends with "helper_on_job PASSED".
-- See scripts/pgtest-helper-on-job.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Hector (helpers) is on the Oakridge job's crew and nowhere on its schedule; Hana (helpers) is on no job; Sam
-- (subcontractor) was dispatched to Oakridge three weeks ago and taken off its crew since; Rosa is the office.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000086d1', 'hector@helperonjob.test'),
  ('00000000-0000-0000-0000-0000000086d2', 'hana@helperonjob.test'),
  ('00000000-0000-0000-0000-0000000086d3', 'sam@helperonjob.test'),
  ('00000000-0000-0000-0000-0000000086d4', 'rosa@helperonjob.test'),
  ('00000000-0000-0000-0000-0000000086d8', 'dev@helperonjob.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000086d1', 'hector@helperonjob.test', 'Hector Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000086d2', 'hana@helperonjob.test', 'Hana Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000086d3', 'sam@helperonjob.test', 'Sam Sub', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-0000000086d4', 'rosa@helperonjob.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000086d8', 'dev@helperonjob.test', 'Helper On Job Dev', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000086f9', 'Helper On Job Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-0000000086d8', '00000000-0000-0000-0000-0000000086f9', 'Oakridge sewer line');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-0000000086d1');
INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end) VALUES
  ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-0000000086d3', (now() AT TIME ZONE 'America/Chicago')::date - 21, '08:00', '12:00');
-- Dispatch puts the assignee on the crew (job_schedule_blocks_ensure_job_team_member_tr); the office took Sam off it since.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = '00000000-0000-0000-0000-0000000086b1' AND user_id = '00000000-0000-0000-0000-0000000086d3') THEN
    RAISE EXCEPTION 'dispatch did not put Sam on the crew';
  END IF;
  RAISE NOTICE 'ok: dispatch puts Sam on the crew';
END $$;
DELETE FROM public.jobs_ledger_team_members WHERE job_id = '00000000-0000-0000-0000-0000000086b1' AND user_id = '00000000-0000-0000-0000-0000000086d3';
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES
  ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-0000000086d4', 'Office: the customer asked for a morning visit.');

CREATE SCHEMA hoj;
CREATE FUNCTION hoj.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION hoj.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION hoj.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
GRANT USAGE ON SCHEMA hoj TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hoj TO authenticated, anon;

-- 1 · Hector sees no crew row of his own, which is the trap; helper_on_job answers for him anyway.
SELECT hoj.as_user('00000000-0000-0000-0000-0000000086d1');
SET LOCAL ROLE authenticated;
SELECT hoj.same('Hector cannot read his own crew row', (SELECT count(*) FROM public.jobs_ledger_team_members WHERE job_id = '00000000-0000-0000-0000-0000000086b1')::text, '0');
SELECT hoj.same('helper_on_job says Hector is on the job', public.helper_on_job('00000000-0000-0000-0000-0000000086b1')::text, 'true');

-- 2 · Hector, on the crew only, leaves the note and reads it with the office's.
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES
  ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-0000000086d1', 'Please tell the customer: the new valve is in.');
SELECT hoj.same('Hector reads his note and the office''s', (SELECT string_agg(body, ' | ' ORDER BY body) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000086b1'),
  'Office: the customer asked for a morning visit. | Please tell the customer: the new valve is in.');
SELECT hoj.refused('Hector writing as someone else', $q$INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-0000000086d4', 'Not mine.')$q$, 'row-level security');
RESET ROLE;

-- 3 · Hana, on no job, can neither leave a note nor read one.
SELECT hoj.as_user('00000000-0000-0000-0000-0000000086d2');
SET LOCAL ROLE authenticated;
SELECT hoj.same('helper_on_job says Hana is not on the job', public.helper_on_job('00000000-0000-0000-0000-0000000086b1')::text, 'false');
SELECT hoj.refused('Hana''s note', $q$INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-0000000086d2', 'Hello.')$q$, 'row-level security');
SELECT hoj.same('Hana reads none', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000086b1')::text, '0');
RESET ROLE;

-- 4 · Sam, dispatched three weeks ago and off the crew: outside helper_on_job, and the branch's own dispatch check keeps
-- what he had.
SELECT hoj.as_user('00000000-0000-0000-0000-0000000086d3');
SET LOCAL ROLE authenticated;
SELECT hoj.same('helper_on_job leaves out a block three weeks old', public.helper_on_job('00000000-0000-0000-0000-0000000086b1')::text, 'false');
SELECT hoj.same('Sam still reads the job''s notes', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000086b1')::text, '2');
RESET ROLE;

-- 5 · The office reads both; nobody signed out asks helper_on_job.
SELECT hoj.as_user('00000000-0000-0000-0000-0000000086d4');
SET LOCAL ROLE authenticated;
SELECT hoj.same('Rosa reads both notes', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000086b1')::text, '2');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT hoj.refused('helper_on_job, signed out', $q$SELECT public.helper_on_job('00000000-0000-0000-0000-0000000086b1')$q$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'helper_on_job PASSED'; END $$;
ROLLBACK;
