-- Papers before a job opens, the lock in the database (migration *_job_papers_lock): the fence sits on the job's row
-- and on seven tables, for signed-in users alone; while no job requires a paper nothing changes for anyone and the
-- lock never reads a person's papers; a paper on a job closes that job's row, its notes and the crew's helpers to a
-- helper, a sub, a superintendent and an estimator who owe it, and to nobody about another job; the office and the
-- primary keep every read, though they owe the paper too; a locked person cannot write a note on the job; signing
-- opens it to that person alone; taking the paper off opens it to everyone. Fixtures are written as postgres; reads
-- run as each user; everything rolls back. Raises on the first failed assertion; ends with "job_papers_lock PASSED".
-- See scripts/pgtest-job-papers-lock.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jl;
CREATE FUNCTION jl.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000009b9e' || p)::uuid $$;
CREATE FUNCTION jl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION jl.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
CREATE FUNCTION jl.scans(p_rel text) RETURNS bigint LANGUAGE sql AS $$
  SELECT coalesce((SELECT coalesce(seq_scan, 0) + coalesce(idx_scan, 0) FROM pg_stat_xact_user_tables WHERE schemaname = 'public' AND relname = p_rel), 0)
$$;
-- What the caller reaches of one job, as one line: its row | its notes | then the crew's helpers as t or f:
-- helper_on_job, subcontractor_can_read_jobs_ledger_row, can_report_stage_progress, on_site_can_touch_job.
CREATE FUNCTION jl.reach(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.jobs_ledger j WHERE j.id = p_job)::text
    || '|' || (SELECT count(*) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = p_job)::text
    || '|' || CASE WHEN public.helper_on_job(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN public.subcontractor_can_read_jobs_ledger_row(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN public.can_report_stage_progress(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN public.on_site_can_touch_job(p_job) THEN 't' ELSE 'f' END
$$;
-- The superintendent's two helpers, as t or f.
CREATE FUNCTION jl.lead(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN public.superintendent_report_job_anchor_allowed(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN public.superintendent_can_touch_job_thread(p_job) THEN 't' ELSE 'f' END
$$;
GRANT USAGE ON SCHEMA jl TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jl TO authenticated, anon, service_role;

-- Dana is the office and Marcus the job's master. Pat is a primary and both jobs' account manager. Luis leads,
-- Hector helps and Sam is a sub: all three are on J100's team. Priya estimates. Otis helps on J200 alone.
INSERT INTO auth.users (id, email) VALUES
  (jl.id('01'), 'dana@jobpaperslock.test'), (jl.id('02'), 'marcus@jobpaperslock.test'), (jl.id('03'), 'luis@jobpaperslock.test'),
  (jl.id('04'), 'hector@jobpaperslock.test'), (jl.id('06'), 'sam@jobpaperslock.test'), (jl.id('07'), 'priya@jobpaperslock.test'),
  (jl.id('08'), 'pat@jobpaperslock.test'), (jl.id('09'), 'otis@jobpaperslock.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  (jl.id('01'), 'dana@jobpaperslock.test', 'Dana Office Jlb', 'assistant', false, false, false, NULL, now()),
  (jl.id('02'), 'marcus@jobpaperslock.test', 'Marcus Master Jlb', 'master_technician', false, false, false, NULL, now()),
  (jl.id('03'), 'luis@jobpaperslock.test', 'Luis Lead Jlb', 'superintendent', false, false, false, NULL, now()),
  (jl.id('04'), 'hector@jobpaperslock.test', 'Hector Helper Jlb', 'helpers', false, false, false, NULL, now()),
  (jl.id('06'), 'sam@jobpaperslock.test', 'Sam Sub Jlb', 'subcontractor', false, false, false, NULL, now()),
  (jl.id('07'), 'priya@jobpaperslock.test', 'Priya Estimator Jlb', 'estimator', false, false, false, NULL, now()),
  (jl.id('08'), 'pat@jobpaperslock.test', 'Pat Primary Jlb', 'primary', false, false, false, NULL, now()),
  (jl.id('09'), 'otis@jobpaperslock.test', 'Otis Other Jlb', 'helpers', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (jl.id('21'), jl.id('02'), 'assistant', 'Dana Office Jlb', jl.id('01')),
  (jl.id('22'), jl.id('02'), 'master_technician', 'Marcus Master Jlb', jl.id('02')),
  (jl.id('23'), jl.id('02'), 'superintendent', 'Luis Lead Jlb', jl.id('03')),
  (jl.id('24'), jl.id('02'), 'helper', 'Hector Helper Jlb', jl.id('04')),
  (jl.id('26'), jl.id('02'), 'sub', 'Sam Sub Jlb', jl.id('06')),
  (jl.id('27'), jl.id('02'), 'estimator', 'Priya Estimator Jlb', jl.id('07')),
  (jl.id('28'), jl.id('02'), 'primary', 'Pat Primary Jlb', jl.id('08')),
  (jl.id('29'), jl.id('02'), 'helper', 'Otis Other Jlb', jl.id('09'));

INSERT INTO public.service_types (id, name) VALUES (jl.id('f9'), 'Job Papers Lock Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, account_manager_user_id, account_manager_relationship) VALUES
  (jl.id('41'), jl.id('02'), jl.id('f9'), 'Cedar Bluff Lofts', 'J100', jl.id('08'), 'primary'),
  (jl.id('42'), jl.id('02'), jl.id('f9'), 'Marsh water heater', 'J200', jl.id('08'), 'primary');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  (jl.id('41'), jl.id('03')), (jl.id('41'), jl.id('04')), (jl.id('41'), jl.id('06')), (jl.id('42'), jl.id('09'))
  ON CONFLICT DO NOTHING;
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES
  (jl.id('41'), jl.id('01'), 'Office: the gate code changes Friday.'),
  (jl.id('42'), jl.id('01'), 'Office: call ahead.');

INSERT INTO public.contract_templates (id, name) VALUES (jl.id('60'), 'Job papers lock bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (jl.id('62'), jl.id('60'), 'Site rules', '<p>No photos past the gate.</p>', 'html');

-- 0 · The fence: one restrictive policy on the job's row and on seven tables, for signed-in users alone, so the
--     database agents and the service role never meet it.
SELECT jl.same('the fence sits on eight tables, restrictive, for every command, for signed-in users alone',
  (SELECT string_agg(tablename::text, ', ' ORDER BY tablename) FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'job_papers_fence' AND permissive = 'RESTRICTIVE' AND cmd = 'ALL' AND roles = '{authenticated}'),
  'file_index, job_stage_windows, jobs_ledger, jobs_ledger_thread_notes, jobs_tally_parts, messages, painted_maps, step_commitments');
SELECT jl.same('and on no other table', (SELECT count(*) FROM pg_policies WHERE policyname = 'job_papers_fence')::text, '8');
SELECT jl.same('nobody signed out can run the lock''s question', has_function_privilege('anon', 'public.job_shut_to_me(uuid)', 'EXECUTE')::text || has_function_privilege('anon', 'public.jobs_shut_to_me()', 'EXECUTE')::text, 'falsefalse');
SELECT jl.same('the helper that kept its argument''s name', (SELECT proargnames[1] FROM pg_proc WHERE oid = 'public.superintendent_report_job_anchor_allowed(uuid)'::regprocedure), 'p_job_ledger_id');
SELECT jl.same('the materials helper still runs as its caller', (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.on_site_can_touch_job(uuid)'::regprocedure), 'false');

-- 1 · While no job requires a paper nothing changes for anyone, and the lock never reads a person's papers.
SELECT jl.same('no job requires a paper yet', (SELECT count(*) FROM public.job_required_papers)::text, '0');
CREATE TEMP TABLE jl_before AS SELECT jl.scans('person_contract_documents') AS docs;
SELECT jl.as_user(jl.id('04'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Hector reaches J100: its row, its note and every helper', jl.reach(jl.id('41')), '1|1|tttt');
SELECT jl.same('twenty more asks answer the same', (SELECT count(*) FILTER (WHERE jl.reach(CASE WHEN g > 0 THEN jl.id('41') END) = '1|1|tttt') FROM generate_series(1, 20) AS g)::text, '20');
SELECT jl.same('Hector is shut out of no job', cardinality(public.jobs_shut_to_me())::text || '|' || public.job_shut_to_me(jl.id('41'))::text, '0|false');
RESET ROLE;
SELECT jl.same('none of that read a person''s papers', (SELECT (jl.scans('person_contract_documents') - docs)::text FROM jl_before), '0');
SELECT jl.as_user(jl.id('04'));
SET LOCAL ROLE authenticated;
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES (jl.id('41'), jl.id('04'), 'Hector: on site.');
SELECT jl.same('Hector leaves a note on J100', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = jl.id('41'))::text, '2');
RESET ROLE;
SELECT jl.as_user(jl.id('03'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Luis the superintendent reaches J100 through his two helpers', jl.lead(jl.id('41')) || '|' || public.can_report_stage_progress(jl.id('41'))::text, 'tt|true');
RESET ROLE;
SELECT jl.as_user(jl.id('06'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Sam the sub reaches J100', jl.reach(jl.id('41')), '1|2|tttt');
RESET ROLE;
SELECT jl.as_user(jl.id('07'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Priya the estimator may report on J100', public.can_report_stage_progress(jl.id('41'))::text, 'true');
RESET ROLE;
SELECT jl.as_user(jl.id('08'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Pat the primary reads J100, his own job', (SELECT count(*) FROM public.jobs_ledger WHERE id = jl.id('41'))::text || '|' || public.can_report_stage_progress(jl.id('41'))::text, '1|true');
RESET ROLE;
SELECT jl.as_user(jl.id('01'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Dana in the office reads J100 and its notes', (SELECT count(*) FROM public.jobs_ledger WHERE id = jl.id('41'))::text || '|' || (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = jl.id('41'))::text, '1|2');

-- 2 · Dana requires a paper on J100. The job closes to the helper, the sub, the superintendent and the estimator,
--     who owe it. It stays open to the office and the primary, who owe it too.
SELECT jl.same('Dana requires the site rules on J100', public.job_papers_require(jl.id('41'), ARRAY[jl.id('62')])::text, '1');
SELECT jl.same('Dana owes the paper and is not shut out', public.job_closed_to_me(jl.id('41'))::text || '|' || public.job_shut_to_me(jl.id('41'))::text || '|' || cardinality(public.jobs_shut_to_me())::text, 'true|false|0');
SELECT jl.same('Dana still reads J100, its notes, and may report on it', (SELECT count(*) FROM public.jobs_ledger WHERE id = jl.id('41'))::text || '|' || (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = jl.id('41'))::text || '|' || public.can_report_stage_progress(jl.id('41'))::text, '1|2|true');
RESET ROLE;
SELECT jl.as_user(jl.id('02'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Marcus the master still reads J100', (SELECT count(*) FROM public.jobs_ledger WHERE id = jl.id('41'))::text || '|' || public.job_shut_to_me(jl.id('41'))::text, '1|false');
RESET ROLE;
SELECT jl.as_user(jl.id('08'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Pat the primary owes the paper and still reads his job', public.job_closed_to_me(jl.id('41'))::text || '|' || (SELECT count(*) FROM public.jobs_ledger WHERE id = jl.id('41'))::text || '|' || public.can_report_stage_progress(jl.id('41'))::text, 'true|1|true');
RESET ROLE;
SELECT jl.as_user(jl.id('04'));
SET LOCAL ROLE authenticated;
SELECT jl.same('J100 is shut to Hector', public.job_shut_to_me(jl.id('41'))::text || '|' || array_to_string(public.jobs_shut_to_me(), ','), 'true|' || jl.id('41')::text);
SELECT jl.same('Hector reaches nothing of J100: no row, no note, no helper', jl.reach(jl.id('41')), '0|0|ffff');
SELECT jl.same('his prompt still names the job''s number and the paper', (SELECT (m->>'job_number') || '|' || (m->'papers'->0->>'paper_name') FROM (SELECT public.job_papers_mine(jl.id('41')) AS m) x), 'J100|Site rules');
SELECT jl.refused('Hector writing a note on the job he is shut out of',
  format($q$INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES (%L, %L, 'Hector: let me in.')$q$, jl.id('41'), jl.id('04')), 'row-level security');
RESET ROLE;
SELECT jl.as_user(jl.id('06'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Sam reaches nothing of J100', jl.reach(jl.id('41')), '0|0|ffff');
RESET ROLE;
SELECT jl.as_user(jl.id('03'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Luis reaches nothing of J100 through his helpers', jl.lead(jl.id('41')) || '|' || public.can_report_stage_progress(jl.id('41'))::text, 'ff|false');
RESET ROLE;
SELECT jl.as_user(jl.id('07'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Priya may not report on J100, and still may on J200', public.can_report_stage_progress(jl.id('41'))::text || '|' || public.can_report_stage_progress(jl.id('42'))::text, 'false|true');
RESET ROLE;
-- A paper on one job closes nothing of another.
SELECT jl.as_user(jl.id('09'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Otis reaches J200 as before', jl.reach(jl.id('42')), '1|1|tttt');
RESET ROLE;
-- The service key and the database itself read everything.
SELECT jl.signed_out();
SELECT jl.same('with no login the lock answers open', public.job_shut_to_me(jl.id('41'))::text || '|' || cardinality(public.jobs_shut_to_me())::text, 'false|0');
SELECT jl.same('and the row is there', (SELECT count(*) FROM public.jobs_ledger WHERE id = jl.id('41'))::text, '1');

-- 3 · Signing opens the job to the person who signed, and to nobody else.
SELECT jl.as_user(jl.id('04'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Hector starts the site rules', (public.job_paper_start((SELECT (m->'papers'->0->>'id')::uuid FROM (SELECT public.job_papers_mine(jl.id('41')) AS m) x)) IS NOT NULL)::text, 'true');
SELECT jl.same('a started paper opens nothing', jl.reach(jl.id('41')), '0|0|ffff');
RESET ROLE;
UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE person_id = jl.id('24') AND job_id = jl.id('41');
SELECT jl.as_user(jl.id('04'));
SET LOCAL ROLE authenticated;
SELECT jl.same('signed, Hector reaches J100 again: its row, both notes and every helper', jl.reach(jl.id('41')), '1|2|tttt');
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES (jl.id('41'), jl.id('04'), 'Hector: back on site.');
SELECT jl.same('and writes a note on it', (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = jl.id('41'))::text, '3');
RESET ROLE;
SELECT jl.as_user(jl.id('06'));
SET LOCAL ROLE authenticated;
SELECT jl.same('Sam is still shut out', jl.reach(jl.id('41')), '0|0|ffff');
RESET ROLE;

-- 4 · Taking the paper off opens the job to everyone.
SELECT jl.as_user(jl.id('01'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove((SELECT id FROM public.job_required_papers WHERE job_id = jl.id('41') AND removed_at IS NULL));
RESET ROLE;
SELECT jl.as_user(jl.id('06'));
SET LOCAL ROLE authenticated;
SELECT jl.same('with the paper off, Sam reaches J100 again', jl.reach(jl.id('41')), '1|3|tttt');
RESET ROLE;
SELECT jl.as_user(jl.id('03'));
SET LOCAL ROLE authenticated;
SELECT jl.same('and so does Luis', jl.lead(jl.id('41')) || '|' || public.can_report_stage_progress(jl.id('41'))::text, 'tt|true');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'job_papers_lock PASSED'; END $$;
ROLLBACK;
