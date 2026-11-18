-- Papers before a job opens, the lists (migration *_job_papers_lists): the functions that name jobs without asking row
-- security answer a locked job with its number alone, a locked job is found by its number and never by its name, its
-- address or its development, the schedule email's read blanks a block for a recipient locked out of its job, and
-- the lock's question about a named user answers as the lock's own question does. Before any paper, and for the
-- office, every list answers as it did. Fixtures are written as postgres; reads run as each user; everything rolls
-- back. Raises on the first failed assertion; ends with "job_papers_lists PASSED". See
-- scripts/pgtest-job-papers-lists.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jq;
CREATE FUNCTION jq.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000009c9e' || p)::uuid $$;
CREATE FUNCTION jq.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jq.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jq.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION jq.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
CREATE FUNCTION jq.scans(p_rel text) RETURNS bigint LANGUAGE sql AS $$
  SELECT coalesce((SELECT coalesce(seq_scan, 0) + coalesce(idx_scan, 0) FROM pg_stat_xact_user_tables WHERE schemaname = 'public' AND relname = p_rel), 0)
$$;
GRANT USAGE ON SCHEMA jq TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jq TO authenticated, anon, service_role;

-- Dana is the office and Marcus the job's master. Pat is a primary and both jobs' account manager. Luis leads,
-- Hector helps and Sam is a sub: all three are on J100's team. Priya estimates. Otis helps on J200 alone.
INSERT INTO auth.users (id, email) VALUES
  (jq.id('01'), 'dana@jobpaperslists.test'), (jq.id('02'), 'marcus@jobpaperslists.test'), (jq.id('03'), 'luis@jobpaperslists.test'),
  (jq.id('04'), 'hector@jobpaperslists.test'), (jq.id('06'), 'sam@jobpaperslists.test'), (jq.id('07'), 'priya@jobpaperslists.test'),
  (jq.id('08'), 'pat@jobpaperslists.test'), (jq.id('09'), 'otis@jobpaperslists.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  (jq.id('01'), 'dana@jobpaperslists.test', 'Dana Office Jqb', 'assistant', false, false, false, NULL, now()),
  (jq.id('02'), 'marcus@jobpaperslists.test', 'Marcus Master Jqb', 'master_technician', false, false, false, NULL, now()),
  (jq.id('03'), 'luis@jobpaperslists.test', 'Luis Lead Jqb', 'superintendent', false, false, false, NULL, now()),
  (jq.id('04'), 'hector@jobpaperslists.test', 'Hector Helper Jqb', 'helpers', false, false, false, NULL, now()),
  (jq.id('06'), 'sam@jobpaperslists.test', 'Sam Sub Jqb', 'subcontractor', false, false, false, NULL, now()),
  (jq.id('07'), 'priya@jobpaperslists.test', 'Priya Estimator Jqb', 'estimator', false, false, false, NULL, now()),
  (jq.id('08'), 'pat@jobpaperslists.test', 'Pat Primary Jqb', 'primary', false, false, false, NULL, now()),
  (jq.id('09'), 'otis@jobpaperslists.test', 'Otis Other Jqb', 'helpers', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (jq.id('21'), jq.id('02'), 'assistant', 'Dana Office Jqb', jq.id('01')),
  (jq.id('22'), jq.id('02'), 'master_technician', 'Marcus Master Jqb', jq.id('02')),
  (jq.id('23'), jq.id('02'), 'superintendent', 'Luis Lead Jqb', jq.id('03')),
  (jq.id('24'), jq.id('02'), 'helper', 'Hector Helper Jqb', jq.id('04')),
  (jq.id('26'), jq.id('02'), 'sub', 'Sam Sub Jqb', jq.id('06')),
  (jq.id('27'), jq.id('02'), 'estimator', 'Priya Estimator Jqb', jq.id('07')),
  (jq.id('28'), jq.id('02'), 'primary', 'Pat Primary Jqb', jq.id('08')),
  (jq.id('29'), jq.id('02'), 'helper', 'Otis Other Jqb', jq.id('09'));

INSERT INTO public.service_types (id, name) VALUES (jq.id('f9'), 'Job Papers Lists Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, job_address, customer_name, google_drive_link, status, account_manager_user_id, account_manager_relationship) VALUES
  (jq.id('41'), jq.id('02'), jq.id('f9'), 'Cedar Bluff Lofts', 'J100', '1200 Quarry Rd', 'Ridgeway Builders', 'https://drive.example.test/cedar', 'working', jq.id('08'), 'primary'),
  (jq.id('42'), jq.id('02'), jq.id('f9'), 'Marsh water heater', 'J200', '88 Linden Ct', 'Marsh', NULL, 'working', jq.id('08'), 'primary');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  (jq.id('41'), jq.id('03')), (jq.id('41'), jq.id('04')), (jq.id('41'), jq.id('06')), (jq.id('42'), jq.id('09'))
  ON CONFLICT DO NOTHING;
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES
  (jq.id('41'), jq.id('01'), 'Office: the gate code changes Friday.'),
  (jq.id('42'), jq.id('01'), 'Office: call ahead.');

INSERT INTO public.contract_templates (id, name) VALUES (jq.id('60'), 'Job papers lists bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (jq.id('62'), jq.id('60'), 'Site rules', '<p>No photos past the gate.</p>', 'html');

-- Hector is dispatched to J100 today, with a note on the block.
INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end, note) VALUES
  (jq.id('41'), jq.id('04'), public.app_today(), '08:00', '12:00', 'Gate code 4471');

-- The caller's lists as one line each.
CREATE FUNCTION jq.found(p_text text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(s.hcp_number || ':' || s.job_name || ':' || s.job_address, ', ' ORDER BY s.hcp_number), '')
  FROM public.search_jobs_ledger(p_text, false) s WHERE s.id IN (jq.id('41'), jq.id('42'))
$$;
CREATE FUNCTION jq.assigned() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(a.hcp_number || ':' || a.job_name || ':' || a.job_address || ':' || coalesce(a.google_drive_link, '-') || ':' || coalesce(a.customer_name, '-'), ', ' ORDER BY a.hcp_number), '')
  FROM public.list_assigned_jobs_for_dashboard() a WHERE a.id IN (jq.id('41'), jq.id('42'))
$$;
CREATE FUNCTION jq.tally() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(t.hcp_number || ':' || t.job_name || ':' || t.job_address, ', ' ORDER BY t.hcp_number), '')
  FROM public.list_jobs_for_tally() t WHERE t.id IN (jq.id('41'), jq.id('42'))
$$;
-- The schedule email's read for one recipient today, as the database itself asks it.
CREATE FUNCTION jq.mail(p_recipient uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(e.job_hcp_number || ':' || coalesce(e.job_name, '-') || ':' || coalesce(e.job_address, '-') || ':' || coalesce(e.note, '-'), ', ' ORDER BY e.job_hcp_number), '')
  FROM public.list_job_schedule_blocks_for_schedule_email(p_recipient, public.app_today()) e WHERE e.job_id = jq.id('41')
$$;
CREATE FUNCTION jq.share(p_viewer uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(e.job_hcp_number || ':' || coalesce(e.job_name, '-') || ':' || coalesce(e.job_address, '-') || ':' || coalesce(e.note, '-'), ', ' ORDER BY e.job_hcp_number), '')
  FROM public.list_schedule_blocks_for_share(p_viewer, public.app_today(), public.app_today()) e WHERE e.job_id = jq.id('41')
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jq TO authenticated, anon, service_role;

-- 0 · The question about a named user is the service key's alone, and the two lists with no fixture here carry it.
SELECT jq.same('a signed-in user cannot ask the lock about someone else', has_function_privilege('authenticated', 'public.job_shut_to_user(uuid, uuid)', 'EXECUTE')::text || has_function_privilege('authenticated', 'public.jobs_shut_to_user(uuid)', 'EXECUTE')::text, 'falsefalse');
SELECT jq.same('the reports list and the superintendent''s list ask the lock',
  (position('jobs_shut_to_me' IN pg_get_functiondef('public.list_reports_with_job_info()'::regprocedure)) > 0)::text
  || (position('jobs_shut_to_me' IN pg_get_functiondef('public.list_superintendent_jobs_for_dashboard()'::regprocedure)) > 0)::text, 'truetrue');

-- 1 · Before any paper every list answers as it did.
SELECT jq.as_user(jq.id('04'));
SET LOCAL ROLE authenticated;
SELECT jq.same('Hector finds J100 by its number', jq.found('J100'), 'J100:Cedar Bluff Lofts:1200 Quarry Rd');
SELECT jq.same('and by its name', jq.found('Cedar'), 'J100:Cedar Bluff Lofts:1200 Quarry Rd');
SELECT jq.same('his assigned jobs name J100 whole', jq.assigned(), 'J100:Cedar Bluff Lofts:1200 Quarry Rd:https://drive.example.test/cedar:Ridgeway Builders');
SELECT jq.same('his tally jobs name J100 whole', jq.tally(), 'J100:Cedar Bluff Lofts:1200 Quarry Rd');
RESET ROLE;
SELECT jq.signed_out();
SELECT jq.same('Hector''s schedule email names the job and its note', jq.mail(jq.id('04')), 'J100:Cedar Bluff Lofts:1200 Quarry Rd:Gate code 4471');
SELECT jq.same('nobody is locked out of anything', public.job_shut_to_user(jq.id('41'), jq.id('04'))::text || '|' || cardinality(public.jobs_shut_to_user(jq.id('04')))::text, 'false|0');

-- 2 · Dana requires a paper on J100. Hector's lists answer J100 with its number alone, and it no longer answers to
--     its name, its address or its customer's words.
SELECT jq.as_user(jq.id('01'));
SET LOCAL ROLE authenticated;
SELECT jq.same('Dana requires the site rules on J100', public.job_papers_require(jq.id('41'), ARRAY[jq.id('62')])::text, '1');
SELECT jq.same('Dana, who owes the paper too, still finds J100 by its name', jq.found('Cedar'), 'J100:Cedar Bluff Lofts:1200 Quarry Rd');
RESET ROLE;
SELECT jq.as_user(jq.id('04'));
SET LOCAL ROLE authenticated;
SELECT jq.same('Hector finds J100 by its number, and that is all it says', jq.found('J100'), 'J100::');
SELECT jq.same('J100 does not answer to its name', jq.found('Cedar'), '');
SELECT jq.same('nor to its address', jq.found('Quarry'), '');
SELECT jq.same('the other job still answers to its name', jq.found('Marsh'), 'J200:Marsh water heater:88 Linden Ct');
SELECT jq.same('his assigned jobs show J100 by its number alone', jq.assigned(), 'J100:::-:-');
SELECT jq.same('his tally jobs show J100 by its number alone', jq.tally(), 'J100::');
RESET ROLE;
SELECT jq.as_user(jq.id('08'));
SET LOCAL ROLE authenticated;
SELECT jq.same('Pat the primary still finds J100 by its name', jq.found('Cedar'), 'J100:Cedar Bluff Lofts:1200 Quarry Rd');
RESET ROLE;
SELECT jq.signed_out();
SELECT jq.same('the lock about a named user: the helper, the sub, the superintendent and the estimator are locked out, the office and the primary are not',
  (SELECT string_agg(split_part(u.name, ' ', 1) || '=' || public.job_shut_to_user(jq.id('41'), u.id)::text, ', ' ORDER BY u.name) FROM public.users u WHERE u.name LIKE '% Jqb'),
  'Dana=false, Hector=true, Luis=true, Marcus=false, Otis=true, Pat=false, Priya=true, Sam=true');
CREATE FUNCTION jq.parity(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r record;
  v_named boolean;
  v_out text := '';
BEGIN
  FOR r IN SELECT u.id, split_part(u.name, ' ', 1) AS first FROM public.users u WHERE u.name LIKE '% Jqb' ORDER BY u.name LOOP
    PERFORM jq.signed_out();
    v_named := public.job_shut_to_user(p_job, r.id);
    PERFORM jq.as_user(r.id);
    IF v_named IS DISTINCT FROM public.job_shut_to_me(p_job) THEN v_out := v_out || r.first || ' '; END IF;
  END LOOP;
  PERFORM jq.signed_out();
  RETURN btrim(v_out);
END $$;
SELECT jq.same('and it answers as the lock''s own question does for each of them: nobody differs', jq.parity(jq.id('41')), '');
SELECT jq.signed_out();
SELECT jq.same('a locked person''s jobs, by name', array_to_string(public.jobs_shut_to_user(jq.id('04')), ',') || '|' || cardinality(public.jobs_shut_to_user(jq.id('01')))::text, jq.id('41')::text || '|0');
SELECT jq.same('nobody is locked out of the job with no paper', public.job_shut_to_user(jq.id('42'), jq.id('04'))::text, 'false');
SELECT jq.same('Hector''s schedule email keeps the block''s number and blanks the rest', jq.mail(jq.id('04')), 'J100:Papers to sign first:-:-');
SELECT jq.same('the shared schedule does the same for him', jq.share(jq.id('04')), 'J100:Papers to sign first:-:-');
SELECT jq.same('Marcus the master''s email still names the job', jq.mail(jq.id('02')), 'J100:Cedar Bluff Lofts:1200 Quarry Rd:Gate code 4471');

-- 3 · Signed, the lists name the job again.
SELECT jq.as_user(jq.id('04'));
SET LOCAL ROLE authenticated;
SELECT jq.same('Hector starts the site rules', (public.job_paper_start((SELECT (m->'papers'->0->>'id')::uuid FROM (SELECT public.job_papers_mine(jq.id('41')) AS m) x)) IS NOT NULL)::text, 'true');
RESET ROLE;
UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE person_id = jq.id('24') AND job_id = jq.id('41');
SELECT jq.as_user(jq.id('04'));
SET LOCAL ROLE authenticated;
SELECT jq.same('signed, Hector finds J100 by its name again', jq.found('Cedar'), 'J100:Cedar Bluff Lofts:1200 Quarry Rd');
SELECT jq.same('and his assigned jobs name it whole', jq.assigned(), 'J100:Cedar Bluff Lofts:1200 Quarry Rd:https://drive.example.test/cedar:Ridgeway Builders');
RESET ROLE;
SELECT jq.signed_out();
SELECT jq.same('and his schedule email names it', jq.mail(jq.id('04')), 'J100:Cedar Bluff Lofts:1200 Quarry Rd:Gate code 4471');

DO $$ BEGIN RAISE NOTICE 'job_papers_lists PASSED'; END $$;
ROLLBACK;
