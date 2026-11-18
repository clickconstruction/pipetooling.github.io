-- Papers before a job opens, the ground (migration *_job_required_papers): nothing changes while no job requires a
-- paper and the lock question reads one table to say so; who may require a paper and who may not; a job with papers is
-- closed to everyone, the office too, and to nobody with no login; a person's own copy, once; signing each paper opens
-- the job to that person alone; the Contract Book's name-keyed paths leave a job's copy alone; the roster; the Needs
-- you read; taking a paper off and putting it back; and new words mean new signatures. Fixtures are written as
-- postgres; presses run as each user; everything rolls back. Raises on the first failed assertion; ends with
-- "job_required_papers PASSED". See scripts/pgtest-job-required-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jp;
-- Every id in this bed: one prefix and two characters.
CREATE FUNCTION jp.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000009a9e' || p)::uuid $$;
CREATE FUNCTION jp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The service key: a role and no person.
CREATE FUNCTION jp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
-- Nobody: no claims at all.
CREATE FUNCTION jp.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- How many scans this transaction has started on a table.
CREATE FUNCTION jp.scans(p_rel text) RETURNS bigint LANGUAGE sql AS $$
  SELECT coalesce((SELECT coalesce(seq_scan, 0) + coalesce(idx_scan, 0) FROM pg_stat_xact_user_tables WHERE schemaname = 'public' AND relname = p_rel), 0)
$$;
-- The caller's papers on a job as one line: number | linked | each paper with its state.
CREATE FUNCTION jp.mine(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT (x.m->>'job_number') || '|' || CASE WHEN (x.m->>'linked')::boolean THEN 'linked' ELSE 'unlinked' END || '|' ||
    coalesce((
      SELECT string_agg((t.p->>'paper_name') || ':' || (t.p->>'status') || CASE WHEN (t.p->>'is_form')::boolean THEN ':form' ELSE '' END, ', ' ORDER BY t.ord)
      FROM jsonb_array_elements(x.m->'papers') WITH ORDINALITY AS t(p, ord)
    ), '')
  FROM (SELECT public.job_papers_mine(p_job) AS m) x
$$;
-- The jobs that wait on the caller as one line: number owed/total.
CREATE FUNCTION jp.needing() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg((t.n->>'job_number') || ' ' || (t.n->>'owed') || '/' || (t.n->>'total'), ', ' ORDER BY t.ord)
    FROM jsonb_array_elements(public.job_papers_needing_me()) WITH ORDINALITY AS t(n, ord)
  ), '')
$$;
-- The roster as one line, this bed's people only (their names end in Jpb): name:ways[:unlinked][:nologin]:states, a
-- state being the first two letters of none, unsent, sent or signed, one per paper.
CREATE FUNCTION jp.roster(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(
    replace(t.p->>'name', ' Jpb', '')
    || ':' || coalesce((SELECT string_agg(w.way, '+' ORDER BY w.way) FROM jsonb_array_elements_text(t.p->'ways') AS w(way)), 'paper')
    || CASE WHEN (t.p->>'linked')::boolean THEN '' ELSE ':unlinked' END
    || CASE WHEN (t.p->>'has_login')::boolean THEN '' ELSE ':nologin' END
    || ':' || coalesce((SELECT string_agg(left(s.q->>'status', 2), '' ORDER BY s.o) FROM jsonb_array_elements(t.p->'papers') WITH ORDINALITY AS s(q, o)), '-'),
    ', ' ORDER BY t.ord), '')
  FROM jsonb_array_elements(public.job_papers_roster(p_job)->'people') WITH ORDINALITY AS t(p, ord)
  WHERE t.p->>'name' LIKE '% Jpb'
$$;
-- What accept-contract does to a copy when its person signs.
CREATE FUNCTION jp.sign(p_paper uuid, p_person uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today()
  WHERE job_required_paper_id = p_paper AND person_id = p_person
$$;
GRANT USAGE ON SCHEMA jp TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jp TO authenticated, anon, service_role;

-- The people. Dana and Cora are the office and Marcus is the job's master. Luis leads, Hector helps, and both are on
-- the job's team. Nora is on the team with no roster person tied to her login. Sam is a sub with a login and a sheet
-- on the job; Tall Pine is a sub with a sheet and no login. Otis helps on other jobs. Tara is in training and on the
-- team. Finn is on the job's schedule tomorrow and not on its team. Tess is a twin, Sal a sample login, Gwen left.
INSERT INTO auth.users (id, email) VALUES
  (jp.id('01'), 'dana@jobpapers.test'), (jp.id('02'), 'marcus@jobpapers.test'), (jp.id('03'), 'luis@jobpapers.test'),
  (jp.id('04'), 'hector@jobpapers.test'), (jp.id('05'), 'nora@jobpapers.test'), (jp.id('06'), 'sam@jobpapers.test'),
  (jp.id('07'), 'otis@jobpapers.test'), (jp.id('08'), 'tara@jobpapers.test'), (jp.id('09'), 'tess@jobpapers.test'),
  (jp.id('0a'), 'sal@jobpapers.test'), (jp.id('0b'), 'gwen@jobpapers.test'), (jp.id('0c'), 'cora@jobpapers.test'),
  (jp.id('0e'), 'finn@jobpapers.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  (jp.id('01'), 'dana@jobpapers.test', 'Dana Office Jpb', 'assistant', false, false, false, NULL, now()),
  (jp.id('02'), 'marcus@jobpapers.test', 'Marcus Master Jpb', 'master_technician', false, false, false, NULL, now()),
  (jp.id('03'), 'luis@jobpapers.test', 'Luis Lead Jpb', 'superintendent', false, false, false, NULL, now()),
  (jp.id('04'), 'hector@jobpapers.test', 'Hector Helper Jpb', 'helpers', false, false, false, NULL, now()),
  (jp.id('05'), 'nora@jobpapers.test', 'Nora Nolink Jpb', 'helpers', false, false, false, NULL, now()),
  (jp.id('06'), 'sam@jobpapers.test', 'Sam Sub Jpb', 'subcontractor', false, false, false, NULL, now()),
  (jp.id('07'), 'otis@jobpapers.test', 'Otis Other Jpb', 'helpers', false, false, false, NULL, now()),
  (jp.id('08'), 'tara@jobpapers.test', 'Tara Training Jpb', 'helpers', true, false, false, NULL, now()),
  (jp.id('09'), 'tess@jobpapers.test', 'Tess Twin Jpb', 'assistant', false, true, false, NULL, now()),
  (jp.id('0a'), 'sal@jobpapers.test', 'Sal Sample Jpb', 'assistant', false, false, true, NULL, now()),
  (jp.id('0b'), 'gwen@jobpapers.test', 'Gwen Gone Jpb', 'helpers', false, false, false, now(), now()),
  (jp.id('0c'), 'cora@jobpapers.test', 'Cora Controller Jpb', 'controller', false, false, false, NULL, now()),
  (jp.id('0e'), 'finn@jobpapers.test', 'Finn Future Jpb', 'helpers', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;
-- Tall Pine's users row has no login behind it, as every roster person without one has.
INSERT INTO public.users (id, email, name, role, login_attached_at) VALUES
  (jp.id('0d'), 'tallpine@jobpapers.test', 'Tall Pine Jpb', 'subcontractor', NULL);

INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (jp.id('21'), jp.id('02'), 'assistant', 'Dana Office Jpb', jp.id('01')),
  (jp.id('22'), jp.id('02'), 'master_technician', 'Marcus Master Jpb', jp.id('02')),
  (jp.id('23'), jp.id('02'), 'superintendent', 'Luis Lead Jpb', jp.id('03')),
  (jp.id('24'), jp.id('02'), 'helper', 'Hector Helper Jpb', jp.id('04')),
  (jp.id('26'), jp.id('02'), 'sub', 'Sam Sub Jpb', jp.id('06')),
  (jp.id('27'), jp.id('02'), 'helper', 'Otis Other Jpb', jp.id('07')),
  (jp.id('28'), jp.id('02'), 'helper', 'Tara Training Jpb', jp.id('08')),
  (jp.id('2c'), jp.id('02'), 'assistant', 'Cora Controller Jpb', jp.id('0c')),
  (jp.id('2d'), jp.id('02'), 'sub', 'Tall Pine Jpb', jp.id('0d')),
  (jp.id('2e'), jp.id('02'), 'helper', 'Finn Future Jpb', jp.id('0e'));

-- Two jobs: J100 will require papers, J200 never does.
INSERT INTO public.service_types (id, name) VALUES (jp.id('f9'), 'Job Papers Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  (jp.id('41'), jp.id('02'), jp.id('f9'), 'Cedar Bluff Lofts', 'J100'),
  (jp.id('42'), jp.id('02'), jp.id('f9'), 'Marsh water heater', 'J200');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  (jp.id('41'), jp.id('03')), (jp.id('41'), jp.id('04')), (jp.id('41'), jp.id('05')),
  (jp.id('41'), jp.id('08')), (jp.id('41'), jp.id('0b')), (jp.id('42'), jp.id('07'))
  ON CONFLICT DO NOTHING;
-- Finn is dispatched to J100 tomorrow. Dispatch puts an assignee on the team; the office took him off it since, so
-- the schedule alone ties him to the job.
INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end) VALUES
  (jp.id('41'), jp.id('0e'), public.app_today() + 1, '08:00', '12:00');
DELETE FROM public.jobs_ledger_team_members WHERE job_id = jp.id('41') AND user_id = jp.id('0e');
-- The subs' sheets on J100.
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_ledger_id) VALUES
  (jp.id('51'), jp.id('02'), 'Sam Sub Jpb', jp.id('41')),
  (jp.id('52'), jp.id('02'), 'Tall Pine Jpb', jp.id('41'));
INSERT INTO public.people_labor_job_assignees (labor_job_id, person_id)
  SELECT v.labor_job_id, v.person_id FROM (VALUES (jp.id('51'), jp.id('26')), (jp.id('52'), jp.id('2d'))) AS v(labor_job_id, person_id)
  WHERE NOT EXISTS (SELECT 1 FROM public.people_labor_job_assignees a WHERE a.labor_job_id = v.labor_job_id AND a.person_id = v.person_id);

-- The Contract Book: a GC's NDA that is a form, site rules in prose, and an entry with no words yet.
INSERT INTO public.contract_templates (id, name) VALUES (jp.id('60'), 'Job papers bed packet');
INSERT INTO public.contract_form_templates (id, name, pdf_storage_path, status, doc_type, published_at) VALUES
  (jp.id('6f'), 'Job papers bed NDA form', 'bed/template.pdf', 'published', 'agreement', now());
INSERT INTO public.contract_template_documents (id, template_id, document_name, form_template_id) VALUES
  (jp.id('61'), jp.id('60'), 'Ridgeway NDA', jp.id('6f'));
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (jp.id('62'), jp.id('60'), 'Site rules', '<p>No photos past the gate.</p>', 'html'),
  (jp.id('63'), jp.id('60'), 'Blank paper', NULL, 'html');

-- 0 · The new table carries its fences and takes no write from a client.
SELECT jp.same('the table has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_required_papers' AND policyname = 'archived_fence')::text, '1');
SELECT jp.same('the table has one read policy of its own', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_required_papers' AND policyname = 'job_required_papers_select')::text, '1');
SELECT jp.same('the table has no write policy of its own', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_required_papers' AND permissive = 'PERMISSIVE' AND cmd <> 'SELECT')::text, '0');
SELECT jp.same('the table has its training-mode trigger', (SELECT (count(*) > 0)::text FROM pg_trigger WHERE tgrelid = 'public.job_required_papers'::regclass AND NOT tgisinternal), 'true');
SELECT jp.same('a job that goes takes its required papers and leaves a signed copy on file',
  (SELECT string_agg(c.conrelid::regclass::text || '.' || a.attname || '=' || c.confdeltype::text, ', ' ORDER BY c.conrelid::regclass::text, a.attname)
   FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.contype = 'f' AND (
     (c.conrelid = 'public.job_required_papers'::regclass AND a.attname = 'job_id')
     OR (c.conrelid = 'public.person_contract_documents'::regclass AND a.attname IN ('job_id', 'job_required_paper_id')))),
  'job_required_papers.job_id=c, person_contract_documents.job_id=n, person_contract_documents.job_required_paper_id=n');
SELECT jp.same('nobody signed out can run the lock question', has_function_privilege('anon', 'public.job_closed_to_me(uuid)', 'EXECUTE')::text, 'false');
SELECT jp.same('a signed-in user cannot read another person''s papers', has_function_privilege('authenticated', 'public.job_papers_for_person(uuid, uuid)', 'EXECUTE')::text, 'false');
SELECT jp.same('a signed-in user cannot ask any job its number', has_function_privilege('authenticated', 'public.job_paper_job_number(uuid)', 'EXECUTE')::text, 'false');

-- 1 · While no job requires a paper nothing changes for anyone, and the lock question reads one table to say so.
SELECT jp.same('no job requires a paper yet', (SELECT count(*) FROM public.job_required_papers)::text, '0');
CREATE TEMP TABLE jp_before AS
  SELECT jp.scans('job_required_papers') AS papers, jp.scans('person_contract_documents') AS docs, jp.scans('people') AS people;
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('fifty asks about a job find it open to Hector',
  (SELECT count(*) FILTER (WHERE public.job_closed_to_me(CASE WHEN g > 0 THEN jp.id('41') END)) FROM generate_series(1, 50) AS g)::text, '0');
SELECT jp.same('fifty asks for his closed jobs find none',
  (SELECT sum(cardinality(public.jobs_closed_to_me()) + g * 0) FROM generate_series(1, 50) AS g)::text, '0');
RESET ROLE;
SELECT jp.same('those hundred asks looked at the required papers a hundred times',
  (SELECT (jp.scans('job_required_papers') - papers)::text FROM jp_before), '100');
SELECT jp.same('and never at a paper or a person',
  (SELECT concat_ws('|', jp.scans('person_contract_documents') - docs, jp.scans('people') - people) FROM jp_before), '0|0');
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Hector''s prompt has nothing on it and names no job', jp.mine(jp.id('41')), '|linked|');
SELECT jp.same('nothing waits on Hector', jp.needing(), '');
SELECT jp.same('Hector reads no required paper', (SELECT count(*) FROM public.job_required_papers)::text, '0');
RESET ROLE;
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.same('the job is open to Dana in the office', public.job_closed_to_me(jp.id('41'))::text, 'false');
SELECT jp.same('nothing waits on Dana', jp.needing(), '');
RESET ROLE;

-- 2 · Who may require a paper. Only the office, only through the function, only a paper with words.
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.refused('Hector requiring a paper', format($q$SELECT public.job_papers_require(%L, ARRAY[%L]::uuid[])$q$, jp.id('41'), jp.id('62')), 'Only the office sets the papers a job requires');
SELECT jp.refused('Hector reading the roster', format($q$SELECT public.job_papers_roster(%L)$q$, jp.id('41')), 'Only the office reads who has signed');
RESET ROLE;
SELECT jp.as_user(jp.id('03'));
SET LOCAL ROLE authenticated;
SELECT jp.refused('Luis the superintendent requiring a paper', format($q$SELECT public.job_papers_require(%L, ARRAY[%L]::uuid[])$q$, jp.id('41'), jp.id('62')), 'Only the office sets the papers a job requires');
RESET ROLE;
SELECT jp.as_service();
SET LOCAL ROLE service_role;
SELECT jp.refused('the service key requiring a paper', format($q$SELECT public.job_papers_require(%L, ARRAY[%L]::uuid[])$q$, jp.id('41'), jp.id('62')), 'Only the office sets the papers a job requires');
RESET ROLE;
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.refused('Dana requiring nothing', format($q$SELECT public.job_papers_require(%L, '{}'::uuid[])$q$, jp.id('41')), 'Pick a paper from the Contract Book');
SELECT jp.refused('Dana requiring a paper the Book does not hold', format($q$SELECT public.job_papers_require(%L, ARRAY[%L]::uuid[])$q$, jp.id('41'), jp.id('6e')), 'That paper is not in the Contract Book');
SELECT jp.refused('Dana requiring a paper with no words', format($q$SELECT public.job_papers_require(%L, ARRAY[%L, %L]::uuid[])$q$, jp.id('41'), jp.id('62'), jp.id('63')), 'Blank paper has no words yet');
SELECT jp.refused('Dana requiring a paper on no job', format($q$SELECT public.job_papers_require(%L, ARRAY[%L]::uuid[])$q$, jp.id('4e'), jp.id('62')), 'No job with that id');
SELECT jp.same('a refused save kept nothing', (SELECT count(*) FROM public.job_required_papers)::text, '0');
SELECT jp.refused('Dana typing a required paper by hand', format($q$INSERT INTO public.job_required_papers (job_id, paper_name) VALUES (%L, 'By hand')$q$, jp.id('41')), 'permission denied');
SELECT jp.same('Dana requires the NDA and the site rules', public.job_papers_require(jp.id('41'), ARRAY[jp.id('61'), jp.id('62'), jp.id('61')])::text, '2');
SELECT jp.same('requiring them again adds nothing', public.job_papers_require(jp.id('41'), ARRAY[jp.id('61'), jp.id('62')])::text, '0');
SELECT jp.same('Dana reads the two, each with the Book''s words', (SELECT string_agg(paper_name || CASE WHEN form_template_id IS NOT NULL THEN ':form' ELSE ':' || coalesce(body_html, '') END, ', ' ORDER BY paper_name) FROM public.job_required_papers), 'Ridgeway NDA:form, Site rules:<p>No photos past the gate.</p>');
SELECT jp.refused('Dana changing a required paper by hand', $q$UPDATE public.job_required_papers SET paper_name = 'Changed'$q$, 'permission denied');
RESET ROLE;
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Hector still reads no required paper', (SELECT count(*) FROM public.job_required_papers)::text, '0');
RESET ROLE;

-- 3 · The job is closed to everyone with a login, the office too. The other job is open, and asking about it still
--     reads no paper and no person.
CREATE FUNCTION jp.closed_for(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r record;
  v_out text := '';
BEGIN
  FOR r IN SELECT u.id, split_part(u.name, ' ', 1) AS first FROM public.users u WHERE u.name LIKE '% Jpb' AND u.archived_at IS NULL ORDER BY u.name LOOP
    PERFORM jp.as_user(r.id);
    IF public.job_closed_to_me(p_job) THEN v_out := v_out || r.first || ' '; END IF;
  END LOOP;
  RETURN btrim(v_out);
END $$;
SELECT jp.same('J100 is closed to every login', jp.closed_for(jp.id('41')), 'Cora Dana Finn Hector Luis Marcus Nora Otis Sal Sam Tall Tara Tess');
SELECT jp.same('J200 is closed to nobody', jp.closed_for(jp.id('42')), '');
SELECT jp.as_service();
SELECT jp.same('J100 is open to the service key', public.job_closed_to_me(jp.id('41'))::text, 'false');
SELECT jp.same('and the service key has no closed jobs', cardinality(public.jobs_closed_to_me())::text, '0');
SELECT jp.signed_out();
SELECT jp.same('J100 is not closed to nobody at all', public.job_closed_to_me(jp.id('41'))::text, 'false');
DROP TABLE jp_before;
CREATE TEMP TABLE jp_before AS
  SELECT jp.scans('job_required_papers') AS papers, jp.scans('person_contract_documents') AS docs, jp.scans('people') AS people;
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('fifty asks about the job with no papers find it open',
  (SELECT count(*) FILTER (WHERE public.job_closed_to_me(CASE WHEN g > 0 THEN jp.id('42') END)) FROM generate_series(1, 50) AS g)::text, '0');
RESET ROLE;
SELECT jp.same('and with papers on another job they still read no paper and no person',
  (SELECT concat_ws('|', jp.scans('job_required_papers') - papers, jp.scans('person_contract_documents') - docs, jp.scans('people') - people) FROM jp_before), '50|0|0');
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Hector''s closed jobs are J100 alone', array_to_string(public.jobs_closed_to_me(), ','), jp.id('41')::text);
SELECT jp.same('the prompt names the job''s number and the papers', jp.mine(jp.id('41')), 'J100|linked|Ridgeway NDA:none:form, Site rules:none');
SELECT jp.same('the prompt for the job with no papers names nothing', jp.mine(jp.id('42')), '|linked|');
SELECT jp.same('J100 waits on Hector', jp.needing(), 'J100 2/2');
RESET ROLE;
SELECT jp.as_user(jp.id('05'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Nora''s prompt says her login is tied to no file', jp.mine(jp.id('41')), 'J100|unlinked|Ridgeway NDA:none:form, Site rules:none');
RESET ROLE;
SELECT jp.as_user(jp.id('07'));
SET LOCAL ROLE authenticated;
SELECT jp.same('J100 is closed to Otis and is not his to open, so nothing waits on him', public.job_closed_to_me(jp.id('41'))::text || '|' || jp.needing(), 'true|');
RESET ROLE;
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.same('J100 waits on Dana in the office', jp.needing(), 'J100 2/2');
RESET ROLE;
SELECT jp.as_user(jp.id('06'));
SET LOCAL ROLE authenticated;
SELECT jp.same('J100 waits on Sam, whose sheet is on it', jp.needing(), 'J100 2/2');
RESET ROLE;
SELECT jp.as_user(jp.id('0e'));
SET LOCAL ROLE authenticated;
SELECT jp.same('J100 waits on Finn, who is on its schedule', jp.needing(), 'J100 2/2');
RESET ROLE;

-- 4 · A person's own copy: made once from the job's words, named with the job's number, never for someone else.
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Hector starts the NDA and the site rules', (public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_mine(jp.id('41'))->'papers') p WHERE p->>'paper_name' = 'Ridgeway NDA')) IS NOT NULL)::text
  || '|' || (public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_mine(jp.id('41'))->'papers') p WHERE p->>'paper_name' = 'Site rules')) IS NOT NULL)::text, 'true|true');
SELECT jp.same('his prompt shows both started', jp.mine(jp.id('41')), 'J100|linked|Ridgeway NDA:unsent:form, Site rules:unsent');
SELECT jp.same('starting one again hands back the same copy',
  (public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_mine(jp.id('41'))->'papers') p WHERE p->>'paper_name' = 'Site rules'))
   = (SELECT (p->>'document_id')::uuid FROM jsonb_array_elements(public.job_papers_mine(jp.id('41'))->'papers') p WHERE p->>'paper_name' = 'Site rules'))::text, 'true');
SELECT jp.refused('Hector starting a paper for Sam',
  format($q$SELECT public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_mine(%L)->'papers') p LIMIT 1), %L)$q$, jp.id('41'), jp.id('26')),
  'Only the office starts a paper for someone else');
SELECT jp.refused('Hector reading another person''s papers', format($q$SELECT public.job_papers_for_person(%L, %L)$q$, jp.id('41'), jp.id('26')), 'permission denied');
SELECT jp.refused('Hector starting a paper no job requires', format($q$SELECT public.job_paper_start(%L)$q$, jp.id('6e')), 'This job no longer requires that paper');
RESET ROLE;
SELECT jp.same('Hector''s copies carry the job, its number and the job''s words',
  (SELECT string_agg(d.document_name || '|' || d.status || '|' || (d.job_id = jp.id('41'))::text || '|' || (d.person_id = jp.id('24'))::text || '|' || d.person_name
     || '|' || CASE WHEN d.form_template_id IS NOT NULL THEN 'form' ELSE coalesce(d.signing_body_html, '') END || '|' || d.dashboard_prompt_after_clock_in::text, ' ; ' ORDER BY d.document_name)
   FROM public.person_contract_documents d WHERE d.person_id = jp.id('24')),
  'Ridgeway NDA (job J100)|unsent|true|true|Hector Helper Jpb|form|false ; Site rules (job J100)|unsent|true|true|Hector Helper Jpb|<p>No photos past the gate.</p>|false');
SELECT jp.same('and there are two of them', (SELECT count(*) FROM public.person_contract_documents WHERE job_id = jp.id('41'))::text, '2');
SELECT jp.as_user(jp.id('05'));
SET LOCAL ROLE authenticated;
SELECT jp.refused('Nora starting a paper with no file tied to her login',
  format($q$SELECT public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_mine(%L)->'papers') p LIMIT 1))$q$, jp.id('41')),
  'Your login is not tied to your file yet');
RESET ROLE;
SELECT jp.as_user(jp.id('08'));
SET LOCAL ROLE authenticated;
SELECT jp.refused('Tara starting a paper in training mode',
  format($q$SELECT public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_mine(%L)->'papers') p LIMIT 1))$q$, jp.id('41')),
  'Read-only (training) mode');
RESET ROLE;
SELECT jp.signed_out();
SET LOCAL ROLE anon;
SELECT jp.refused('nobody at all starting a paper', format($q$SELECT public.job_paper_start(%L)$q$, jp.id('6e')), 'permission denied');
RESET ROLE;
-- Otis is not on the job and can still sign for it: the clock-in search can lead anyone to the prompt.
SELECT jp.as_user(jp.id('07'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Otis starts the NDA', (public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_mine(jp.id('41'))->'papers') p WHERE p->>'paper_name' = 'Ridgeway NDA')) IS NOT NULL)::text, 'true');
RESET ROLE;
-- The office starts one for a sub with no login (the roster's Copy the signing link), and the service key for the
-- sub's own page.
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Dana starts the NDA for Tall Pine', (public.job_paper_start((SELECT r.id FROM public.job_required_papers r WHERE r.paper_name = 'Ridgeway NDA'), jp.id('2d')) IS NOT NULL)::text, 'true');
SELECT jp.refused('Dana starting a paper for nobody on the roster', format($q$SELECT public.job_paper_start((SELECT r.id FROM public.job_required_papers r WHERE r.paper_name = 'Ridgeway NDA'), %L)$q$, jp.id('2f')), 'No person on the roster with that id');
RESET ROLE;
SELECT jp.as_service();
SET LOCAL ROLE service_role;
SELECT jp.same('the service key reads Tall Pine''s papers', (SELECT string_agg((p->>'paper_name') || ':' || (p->>'status'), ', ' ORDER BY p->>'paper_name') FROM jsonb_array_elements(public.job_papers_for_person(jp.id('41'), jp.id('2d'))->'papers') p), 'Ridgeway NDA:unsent, Site rules:none');
SELECT jp.same('and starts the site rules for Tall Pine', (public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_for_person(jp.id('41'), jp.id('2d'))->'papers') p WHERE p->>'paper_name' = 'Site rules'), jp.id('2d')) IS NOT NULL)::text, 'true');
SELECT jp.refused('the service key starting a paper for no one',
  format($q$SELECT public.job_paper_start((SELECT (p->>'id')::uuid FROM jsonb_array_elements(public.job_papers_for_person(%L, %L)->'papers') p LIMIT 1))$q$, jp.id('41'), jp.id('2d')),
  'Your login is not tied to your file yet');
RESET ROLE;
SELECT jp.signed_out();

-- 5 · Signing. One paper signed leaves the job closed; both open it, to that person alone.
-- A live required paper by its name, whoever asks (the table itself is the office's to read).
CREATE FUNCTION jp.paper(p_name text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT r.id FROM public.job_required_papers r WHERE r.paper_name = p_name AND r.removed_at IS NULL
$$;
GRANT EXECUTE ON FUNCTION jp.paper(text) TO authenticated, anon, service_role;
SELECT jp.sign(jp.paper('Ridgeway NDA'), jp.id('24'));
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('with the NDA signed the job is still closed to Hector', public.job_closed_to_me(jp.id('41'))::text || '|' || jp.mine(jp.id('41')) || '|' || jp.needing(), 'true|J100|linked|Ridgeway NDA:signed:form, Site rules:unsent|J100 1/2');
RESET ROLE;
SELECT jp.sign(jp.paper('Site rules'), jp.id('24'));
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('with both signed the job is open to Hector', public.job_closed_to_me(jp.id('41'))::text || '|' || cardinality(public.jobs_closed_to_me())::text || '|' || jp.needing(), 'false|0|');
SELECT jp.same('his prompt shows both signed with the day', (SELECT string_agg((p->>'status') || ':' || ((p->>'signed_at') = public.app_today()::text)::text, ', ') FROM jsonb_array_elements(public.job_papers_mine(jp.id('41'))->'papers') p), 'signed:true, signed:true');
RESET ROLE;
SELECT jp.same('and to nobody else', jp.closed_for(jp.id('41')), 'Cora Dana Finn Luis Marcus Nora Otis Sal Sam Tall Tara Tess');
SELECT jp.signed_out();

-- 6 · The Contract Book's name-keyed paths leave a job's copy alone. Hector holds the packet the site rules sit in,
--     and a Book save mints a new version of every signed paper of that name: his job copy has another name.
INSERT INTO public.person_contract_assignments (person_name, template_id) VALUES ('Hector Helper Jpb', jp.id('60'));
SELECT public.create_pending_contract_versions_after_book_save(jp.id('62'));
SELECT jp.same('a Book save minted nothing for Hector''s signed job copy', (SELECT count(*) FROM public.person_contract_documents WHERE person_name = 'Hector Helper Jpb')::text, '2');

-- 7 · The roster: the office, the crew, the subs, then anyone else who holds a copy. Luis signs the NDA first.
SELECT jp.as_user(jp.id('03'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Luis starts the NDA', (public.job_paper_start(jp.paper('Ridgeway NDA')) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jp.sign(jp.paper('Ridgeway NDA'), jp.id('23'));
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.same('the roster', jp.roster(jp.id('41')),
  'Cora Controller:office:nono, Dana Office:office:nono, Marcus Master:office:nono, '
  || 'Finn Future:crew:nono, Hector Helper:crew:sisi, Luis Lead:crew:sino, Nora Nolink:crew:unlinked:nono, Tara Training:crew:nono, '
  || 'Sam Sub:sub:nono, Tall Pine:sub:nologin:unun, Otis Other:paper:unno');
SELECT jp.same('the roster names the job and its two papers', (SELECT (r->>'job_number') || '|' || (SELECT string_agg((p->>'paper_name') || CASE WHEN (p->>'is_form')::boolean THEN ':form' ELSE '' END, ', ' ORDER BY o) FROM jsonb_array_elements(r->'papers') WITH ORDINALITY AS t(p, o)) FROM (SELECT public.job_papers_roster(jp.id('41')) AS r) x), 'J100|Ridgeway NDA:form, Site rules');
SELECT jp.same('the roster of a job with no papers still counts who can open it', (SELECT jsonb_array_length(r->'papers')::text || '|' || (jsonb_array_length(r->'people') >= 4)::text FROM (SELECT public.job_papers_roster(jp.id('42')) AS r) x), '0|true');
RESET ROLE;

-- 8 · Taking a paper off opens the job to whoever owed only that one and keeps every signature. Putting the same
--     words back brings the signatures back with it. New words mean a new paper and new signatures.
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.refused('Hector taking a paper off', format($q$SELECT public.job_paper_remove(%L)$q$, jp.paper('Site rules')), 'Only the office sets the papers a job requires');
RESET ROLE;
CREATE TEMP TABLE jp_site AS SELECT jp.paper('Site rules') AS id;
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove(jp.paper('Site rules'));
RESET ROLE;
SELECT jp.same('with the site rules off, the job is open to Luis as well', jp.closed_for(jp.id('41')), 'Cora Dana Finn Marcus Nora Otis Sal Sam Tall Tara Tess');
SELECT jp.same('Hector''s signed site rules stay on his file', (SELECT count(*) FROM public.person_contract_documents WHERE person_id = jp.id('24') AND status = 'signed')::text, '2');
SELECT jp.same('the paper is kept with the day it came off', (SELECT (removed_at IS NOT NULL)::text || '|' || (removed_by = jp.id('01'))::text FROM public.job_required_papers WHERE id = (SELECT id FROM jp_site)), 'true|true');
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Dana puts the site rules back', public.job_papers_require(jp.id('41'), ARRAY[jp.id('62')])::text, '1');
RESET ROLE;
SELECT jp.same('it is the same paper, back', (SELECT (jp.paper('Site rules') = id)::text FROM jp_site), 'true');
SELECT jp.same('so the job is still open to Hector and closed to Luis again', jp.closed_for(jp.id('41')), 'Cora Dana Finn Luis Marcus Nora Otis Sal Sam Tall Tara Tess');
SELECT jp.signed_out();
UPDATE public.contract_template_documents SET book_body_html = '<p>No photos past the gate. No visitors.</p>' WHERE id = jp.id('62');
SELECT jp.same('a Book edit alone changes nothing the job asks for', (SELECT body_html FROM public.job_required_papers WHERE id = (SELECT id FROM jp_site)), '<p>No photos past the gate.</p>');
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove(jp.paper('Site rules'));
SELECT jp.same('Dana requires the site rules with their new words', public.job_papers_require(jp.id('41'), ARRAY[jp.id('62')])::text, '1');
RESET ROLE;
SELECT jp.same('it is a new paper with the new words', (SELECT (jp.paper('Site rules') <> id)::text || '|' || (SELECT body_html FROM public.job_required_papers WHERE id = jp.paper('Site rules')) FROM jp_site), 'true|<p>No photos past the gate. No visitors.</p>');
SELECT jp.same('so the job is closed to Hector again', jp.closed_for(jp.id('41')), 'Cora Dana Finn Hector Luis Marcus Nora Otis Sal Sam Tall Tara Tess');
SELECT jp.same('and his old signed copy is still on his file', (SELECT count(*) FROM public.person_contract_documents WHERE person_id = jp.id('24') AND status = 'signed')::text, '2');
SELECT jp.as_user(jp.id('04'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Hector''s prompt asks for the new site rules', jp.mine(jp.id('41')), 'J100|linked|Ridgeway NDA:signed:form, Site rules:none');
RESET ROLE;
SELECT jp.signed_out();

-- 9 · The office signs like everyone else.
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.same('Dana starts both of her own', (public.job_paper_start(jp.paper('Ridgeway NDA')) IS NOT NULL)::text || '|' || (public.job_paper_start(jp.paper('Site rules')) IS NOT NULL)::text, 'true|true');
RESET ROLE;
SELECT jp.sign(jp.paper('Ridgeway NDA'), jp.id('21'));
SELECT jp.sign(jp.paper('Site rules'), jp.id('21'));
SELECT jp.as_user(jp.id('01'));
SET LOCAL ROLE authenticated;
SELECT jp.same('and the job opens to her', public.job_closed_to_me(jp.id('41'))::text || '|' || jp.needing(), 'false|');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'job_required_papers PASSED'; END $$;
ROLLBACK;
