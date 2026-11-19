-- A primary reads the reports of their own jobs and no others (migration *_primary_scope_reports, the owner's word of
-- 2026-11-19). Luis is a primary: the account manager of J1, listed as superintendent on J2's project and named as
-- the superintendent of J4's GC project. He reads those three jobs' reports, the report he wrote himself on J3, the
-- report on the project that lists him and the report on his own bid, and nothing else: through the table, the three
-- list functions, the percent reads, the photos and the bucket. Pat, a primary on nothing, reads none. The master,
-- the assistant, the superintendent and the helper read as before. Everything rolls back. Raises on the first failed
-- assertion; ends with "primary_scope_reports PASSED". See scripts/pgtest-primary-scope-reports.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000005ca04', 'luis@reports.test'),
  ('00000000-0000-0000-0000-00000005ca05', 'pat@reports.test'),
  ('00000000-0000-0000-0000-00000005ca03', 'rosa@reports.test'),
  ('00000000-0000-0000-0000-00000005ca07', 'mo@reports.test'),
  ('00000000-0000-0000-0000-00000005ca08', 'sam@reports.test'),
  ('00000000-0000-0000-0000-00000005ca09', 'sue@reports.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000005ca04', 'luis@reports.test', 'Reports Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-00000005ca05', 'pat@reports.test', 'Reports Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-00000005ca03', 'rosa@reports.test', 'Reports Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000005ca07', 'mo@reports.test', 'Reports Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000005ca08', 'sam@reports.test', 'Reports Sam', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000005ca09', 'sue@reports.test', 'Reports Sue', 'superintendent', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000005cb01', 'Reports Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-00000005cc01', '00000000-0000-0000-0000-00000005ca07', 'Dana Whitfield');

-- P2 lists Luis (and Sue) as superintendent; P3 lists nobody; P4 is a GC project that names Luis.
INSERT INTO public.projects (id, customer_id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-00000005cd02', '00000000-0000-0000-0000-00000005cc01', 'Laurel Field', '00000000-0000-0000-0000-00000005ca07'),
  ('00000000-0000-0000-0000-00000005cd03', '00000000-0000-0000-0000-00000005cc01', 'Tison plans', '00000000-0000-0000-0000-00000005ca07'),
  ('00000000-0000-0000-0000-00000005cd04', '00000000-0000-0000-0000-00000005cc01', 'Salzstein build', '00000000-0000-0000-0000-00000005ca07');
INSERT INTO public.project_superintendents (project_id, superintendent_id) VALUES
  ('00000000-0000-0000-0000-00000005cd02', '00000000-0000-0000-0000-00000005ca04'),
  ('00000000-0000-0000-0000-00000005cd02', '00000000-0000-0000-0000-00000005ca09');
INSERT INTO public.gc_projects (project_id, superintendent_user_id) VALUES
  ('00000000-0000-0000-0000-00000005cd04', '00000000-0000-0000-0000-00000005ca04');

-- J1: Luis is the account manager. J2: on P2. J3: nobody's but the office's. J4: on the GC project P4.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, account_manager_user_id, account_manager_relationship, project_id) VALUES
  ('00000000-0000-0000-0000-00000005cf01', '00000000-0000-0000-0000-00000005ca07', '00000000-0000-0000-0000-00000005cb01', '2101', 'Linda Lou vanity', 'Dana Whitfield', '00000000-0000-0000-0000-00000005cc01', 'customer', 0, 0, 'working', '00000000-0000-0000-0000-00000005ca04', 'primary', NULL),
  ('00000000-0000-0000-0000-00000005cf02', '00000000-0000-0000-0000-00000005ca07', '00000000-0000-0000-0000-00000005cb01', '2102', 'Laurel Field rough', 'Dana Whitfield', '00000000-0000-0000-0000-00000005cc01', 'customer', 0, 0, 'working', NULL, NULL, '00000000-0000-0000-0000-00000005cd02'),
  ('00000000-0000-0000-0000-00000005cf03', '00000000-0000-0000-0000-00000005ca07', '00000000-0000-0000-0000-00000005cb01', '2103', 'Water heater removal', 'Dana Whitfield', '00000000-0000-0000-0000-00000005cc01', 'customer', 0, 0, 'working', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000005cf04', '00000000-0000-0000-0000-00000005ca07', '00000000-0000-0000-0000-00000005cb01', '2104', 'Thornbury filter', 'Dana Whitfield', '00000000-0000-0000-0000-00000005cc01', 'customer', 0, 0, 'working', NULL, NULL, '00000000-0000-0000-0000-00000005cd04');

-- B1: Luis is the bid's account manager. B2: not his.
INSERT INTO public.bids (id, created_by, service_type_id, project_name, account_manager_id) VALUES
  ('00000000-0000-0000-0000-00000005ce01', '00000000-0000-0000-0000-00000005ca07', '00000000-0000-0000-0000-00000005cb01', 'Diane Falls', '00000000-0000-0000-0000-00000005ca04'),
  ('00000000-0000-0000-0000-00000005ce02', '00000000-0000-0000-0000-00000005ca07', '00000000-0000-0000-0000-00000005cb01', 'Water sample', NULL);

INSERT INTO public.report_templates (id, name) VALUES ('00000000-0000-0000-0000-00000005c101', 'Reports bed note');
-- Sam, the helper, wrote every report but R5, which Luis wrote on the job that is not his.
INSERT INTO public.reports (id, template_id, created_by_user_id, job_ledger_id, project_id, bid_id, field_values, created_at) VALUES
  ('00000000-0000-0000-0000-00000005c201', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', '00000000-0000-0000-0000-00000005cf01', NULL, NULL, '{"tag":"R1","How complete is the job?":"40"}', now() - interval '9 hours'),
  ('00000000-0000-0000-0000-00000005c202', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', '00000000-0000-0000-0000-00000005cf02', NULL, NULL, '{"tag":"R2"}', now() - interval '8 hours'),
  ('00000000-0000-0000-0000-00000005c203', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', '00000000-0000-0000-0000-00000005cf03', NULL, NULL, '{"tag":"R3","How complete is the job?":"80"}', now() - interval '7 hours'),
  ('00000000-0000-0000-0000-00000005c204', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', '00000000-0000-0000-0000-00000005cf04', NULL, NULL, '{"tag":"R4"}', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-00000005c205', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca04', '00000000-0000-0000-0000-00000005cf03', NULL, NULL, '{"tag":"R5"}', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000005c206', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', NULL, '00000000-0000-0000-0000-00000005cd02', NULL, '{"tag":"R6"}', now() - interval '4 hours'),
  ('00000000-0000-0000-0000-00000005c207', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', NULL, '00000000-0000-0000-0000-00000005cd03', NULL, '{"tag":"R7"}', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000005c208', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', NULL, NULL, '00000000-0000-0000-0000-00000005ce01', '{"tag":"R8"}', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000005c209', '00000000-0000-0000-0000-00000005c101', '00000000-0000-0000-0000-00000005ca08', NULL, NULL, '00000000-0000-0000-0000-00000005ce02', '{"tag":"R9"}', now() - interval '1 hour');

-- A photo on R1 (his job), on R3 (not his) and on R5 (his own report on the job that is not his), each in the bucket.
INSERT INTO public.report_photos (id, job_id, report_id, by_user_id, by_name, caption, storage_path) VALUES
  ('00000000-0000-0000-0000-00000005c301', '00000000-0000-0000-0000-00000005cf01', '00000000-0000-0000-0000-00000005c201', '00000000-0000-0000-0000-00000005ca08', 'Reports Sam', 'PH1', '00000000-0000-0000-0000-00000005cf01/00000000-0000-0000-0000-00000005c301.jpg'),
  ('00000000-0000-0000-0000-00000005c303', '00000000-0000-0000-0000-00000005cf03', '00000000-0000-0000-0000-00000005c203', '00000000-0000-0000-0000-00000005ca08', 'Reports Sam', 'PH3', '00000000-0000-0000-0000-00000005cf03/00000000-0000-0000-0000-00000005c303.jpg'),
  ('00000000-0000-0000-0000-00000005c305', '00000000-0000-0000-0000-00000005cf03', '00000000-0000-0000-0000-00000005c205', '00000000-0000-0000-0000-00000005ca04', 'Reports Luis', 'PH5', '00000000-0000-0000-0000-00000005cf03/00000000-0000-0000-0000-00000005c305.jpg');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('report-photos', '00000000-0000-0000-0000-00000005cf01/00000000-0000-0000-0000-00000005c301.jpg', '00000000-0000-0000-0000-00000005ca08'),
  ('report-photos', '00000000-0000-0000-0000-00000005cf03/00000000-0000-0000-0000-00000005c303.jpg', '00000000-0000-0000-0000-00000005ca08'),
  ('report-photos', '00000000-0000-0000-0000-00000005cf03/00000000-0000-0000-0000-00000005c305.jpg', '00000000-0000-0000-0000-00000005ca04');

CREATE SCHEMA psr;
CREATE FUNCTION psr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION psr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The bed's own reports only, by their tags, so a seed report from a migration never moves an answer. Invoker: RLS decides.
CREATE FUNCTION psr.tags_table() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(field_values->>'tag', ' ' ORDER BY field_values->>'tag'), 'none')
  FROM public.reports WHERE template_id = '00000000-0000-0000-0000-00000005c101'
$$;
CREATE FUNCTION psr.tags_list() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(field_values->>'tag', ' ' ORDER BY field_values->>'tag'), 'none')
  FROM public.list_reports_with_job_info() WHERE template_id = '00000000-0000-0000-0000-00000005c101'
$$;
CREATE FUNCTION psr.tags_job(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(field_values->>'tag', ' ' ORDER BY field_values->>'tag'), 'none') FROM public.list_reports_for_job_ledger(p_job)
$$;
CREATE FUNCTION psr.tags_bid(p_bid uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(field_values->>'tag', ' ' ORDER BY field_values->>'tag'), 'none') FROM public.list_reports_for_bid(p_bid)
$$;
CREATE FUNCTION psr.tags_mine() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(field_values->>'tag', ' ' ORDER BY field_values->>'tag'), 'none')
  FROM public.list_my_reports() WHERE template_id = '00000000-0000-0000-0000-00000005c101'
$$;
CREATE FUNCTION psr.photos() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(caption, ' ' ORDER BY caption), 'none') FROM public.report_photos WHERE caption LIKE 'PH%'
$$;
CREATE FUNCTION psr.files() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(name, 7), ' ' ORDER BY name), 'none') FROM storage.objects
  WHERE bucket_id = 'report-photos' AND name LIKE '00000000-0000-0000-0000-00000005cf0%'
$$;
-- The newest report's percent for J1 and J3, through each of the two reads.
CREATE FUNCTION psr.pct_latest() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(job_ledger_id::text, 2) || '=' || pct, ' ' ORDER BY job_ledger_id), 'none')
  FROM public.list_latest_report_completion_pct(ARRAY['00000000-0000-0000-0000-00000005cf01', '00000000-0000-0000-0000-00000005cf03']::uuid[])
$$;
CREATE FUNCTION psr.pct_position() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(job_ledger_id::text, 2) || '=' || coalesce(report_pct::text, 'none'), ' ' ORDER BY job_ledger_id), 'none')
  FROM public.list_job_crew_position(ARRAY['00000000-0000-0000-0000-00000005cf01', '00000000-0000-0000-0000-00000005cf03']::uuid[], current_date)
$$;
-- How many rows a write reached.
CREATE FUNCTION psr.touch(p_report uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE public.reports SET updated_at = now() WHERE id = p_report;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
CREATE FUNCTION psr.remove(p_report uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.reports WHERE id = p_report;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
-- A report written and read back in one statement, as the report window saves it.
CREATE FUNCTION psr.write(p_job uuid, p_tag text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_tag text;
BEGIN
  INSERT INTO public.reports (template_id, created_by_user_id, job_ledger_id, field_values)
  VALUES ('00000000-0000-0000-0000-00000005c101', auth.uid(), p_job, jsonb_build_object('tag', p_tag))
  RETURNING field_values->>'tag' INTO v_tag;
  RETURN v_tag;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN 'refused';
END $$;
GRANT USAGE ON SCHEMA psr TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA psr TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Luis: his three jobs, his own report, the project that lists him and his bid. Never R3, R7 or R9.
SELECT psr.as_user('00000000-0000-0000-0000-00000005ca04');
SELECT psr.same('Luis reads his reports from the table', psr.tags_table(), 'R1 R2 R4 R5 R6 R8');
SELECT psr.same('Luis reads the same from the Dashboard''s list', psr.tags_list(), 'R1 R2 R4 R5 R6 R8');
SELECT psr.same('J1, where he is the account manager', psr.tags_job('00000000-0000-0000-0000-00000005cf01'), 'R1');
SELECT psr.same('J2, where the project lists him as superintendent', psr.tags_job('00000000-0000-0000-0000-00000005cf02'), 'R2');
SELECT psr.same('J4, where the GC project names him', psr.tags_job('00000000-0000-0000-0000-00000005cf04'), 'R4');
SELECT psr.same('J3 is not his: only the report he wrote', psr.tags_job('00000000-0000-0000-0000-00000005cf03'), 'R5');
SELECT psr.same('his bid''s report', psr.tags_bid('00000000-0000-0000-0000-00000005ce01'), 'R8');
SELECT psr.same('a bid that is not his', psr.tags_bid('00000000-0000-0000-0000-00000005ce02'), 'none');
SELECT psr.same('My reports is his own', psr.tags_mine(), 'R5');
SELECT psr.same('the photos: his job''s and his own', psr.photos(), 'PH1 PH5');
SELECT psr.same('the bucket: his job''s and his own', psr.files(), '301.jpg 305.jpg');
SELECT psr.same('the newest percent, J1 only', psr.pct_latest(), '01=40');
SELECT psr.same('the crew position''s percent, J1 only', psr.pct_position(), '01=40 03=none');
SELECT psr.same('he cannot change a report he cannot read', psr.touch('00000000-0000-0000-0000-00000005c203'), '0');
SELECT psr.same('he cannot delete it either', psr.remove('00000000-0000-0000-0000-00000005c203'), '0');
SELECT psr.same('he changes his own', psr.touch('00000000-0000-0000-0000-00000005c205'), '1');
SELECT psr.same('he writes a report on a job that is not his and reads it back', psr.write('00000000-0000-0000-0000-00000005cf03', 'R10'), 'R10');
SELECT psr.same('and it is on his list', psr.tags_list(), 'R1 R10 R2 R4 R5 R6 R8');

-- 2 · Pat, a primary on nothing, reads none.
SELECT psr.as_user('00000000-0000-0000-0000-00000005ca05');
SELECT psr.same('Pat reads no report from the table', psr.tags_table(), 'none');
SELECT psr.same('Pat reads none from the list', psr.tags_list(), 'none');
SELECT psr.same('Pat reads none on J1', psr.tags_job('00000000-0000-0000-0000-00000005cf01'), 'none');
SELECT psr.same('Pat reads none on Luis''s bid', psr.tags_bid('00000000-0000-0000-0000-00000005ce01'), 'none');
SELECT psr.same('Pat reads no photo', psr.photos(), 'none');
SELECT psr.same('Pat reads nothing in the bucket', psr.files(), 'none');
SELECT psr.same('Pat reads no percent', psr.pct_latest(), 'none');
SELECT psr.same('Pat''s crew position carries no percent', psr.pct_position(), '01=none 03=none');

-- 3 · The office reads as before: every report, every photo.
SELECT psr.as_user('00000000-0000-0000-0000-00000005ca07');
SELECT psr.same('Mo, the master, reads every report from the table', psr.tags_table(), 'R1 R10 R2 R3 R4 R5 R6 R7 R8 R9');
SELECT psr.same('Mo reads every report from the list', psr.tags_list(), 'R1 R10 R2 R3 R4 R5 R6 R7 R8 R9');
SELECT psr.same('Mo reads J3''s reports', psr.tags_job('00000000-0000-0000-0000-00000005cf03'), 'R10 R3 R5');
SELECT psr.same('Mo reads every photo', psr.photos(), 'PH1 PH3 PH5');
SELECT psr.same('Mo reads the whole bucket', psr.files(), '301.jpg 303.jpg 305.jpg');
SELECT psr.same('Mo reads both percents', psr.pct_position(), '01=40 03=80');
SELECT psr.as_user('00000000-0000-0000-0000-00000005ca03');
SELECT psr.same('Rosa, the assistant, reads every report from the table', psr.tags_table(), 'R1 R10 R2 R3 R4 R5 R6 R7 R8 R9');
SELECT psr.same('Rosa reads every report from the list', psr.tags_list(), 'R1 R10 R2 R3 R4 R5 R6 R7 R8 R9');
SELECT psr.same('Rosa reads the bid''s report', psr.tags_bid('00000000-0000-0000-0000-00000005ce02'), 'R9');
SELECT psr.same('Rosa reads every photo', psr.photos(), 'PH1 PH3 PH5');

-- 4 · The field reads as before: the superintendent on P2 reads P2's and the bids' (superintendent_can_access_bid),
--     the helper reads what he wrote.
SELECT psr.as_user('00000000-0000-0000-0000-00000005ca09');
SELECT psr.same('Sue, the superintendent on P2, reads P2''s reports and the bids''', psr.tags_list(), 'R2 R6 R8 R9');
SELECT psr.as_user('00000000-0000-0000-0000-00000005ca08');
SELECT psr.same('Sam, the helper, reads the reports he wrote', psr.tags_list(), 'R1 R2 R3 R4 R6 R7 R8 R9');

DO $$ BEGIN RAISE NOTICE 'primary_scope_reports PASSED'; END $$;
ROLLBACK;
