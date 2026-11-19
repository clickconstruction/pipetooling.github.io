-- A primary reads the test papers of their own jobs (punch list #400 PR 4, migration *_primary_test_papers). Luis is
-- a primary and the account manager of J1. Pat is a primary on nothing. J3 is the office's. Each job has one test
-- paper and its PDF in the bucket. Luis reads J1's paper and file and not J3's. Pat reads neither. Neither primary
-- writes a paper, as before. Rosa, the assistant, and Mo, the master, read and write both. Sam, a helper on J3's
-- crew, reads none, as before. Everything rolls back. Raises on the first failed assertion; ends with
-- "primary_test_papers PASSED". See scripts/pgtest-primary-test-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000fba04', 'luis@testpapers.test'),
  ('00000000-0000-0000-0000-0000000fba05', 'pat@testpapers.test'),
  ('00000000-0000-0000-0000-0000000fba03', 'rosa@testpapers.test'),
  ('00000000-0000-0000-0000-0000000fba07', 'mo@testpapers.test'),
  ('00000000-0000-0000-0000-0000000fba08', 'sam@testpapers.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000fba04', 'luis@testpapers.test', 'Papers Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fba05', 'pat@testpapers.test', 'Papers Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fba03', 'rosa@testpapers.test', 'Papers Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000fba07', 'mo@testpapers.test', 'Papers Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000fba08', 'sam@testpapers.test', 'Papers Sam', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000fbb01', 'Test Papers Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fbc01', '00000000-0000-0000-0000-0000000fba07', 'Dana Whitfield');
-- J1 is Luis's. J3 is nobody's but the office's, with Sam on its crew.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, account_manager_user_id, account_manager_relationship) VALUES
  ('00000000-0000-0000-0000-0000000fbf01', '00000000-0000-0000-0000-0000000fba07', '00000000-0000-0000-0000-0000000fbb01', '5101', 'Linda Lou vanity', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fbc01', 'customer', 0, 0, 'working', '00000000-0000-0000-0000-0000000fba04', 'primary'),
  ('00000000-0000-0000-0000-0000000fbf03', '00000000-0000-0000-0000-0000000fba07', '00000000-0000-0000-0000-0000000fbb01', '5103', 'Water heater removal', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fbc01', 'customer', 0, 0, 'working', NULL, NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000000fbf03', '00000000-0000-0000-0000-0000000fba08') ON CONFLICT DO NOTHING;
INSERT INTO public.job_test_reports (id, job_id, test_type, test_date, notes) VALUES
  ('00000000-0000-0000-0000-0000000fb101', '00000000-0000-0000-0000-0000000fbf01', 'pre_test', DATE '2026-11-10', 'T1'),
  ('00000000-0000-0000-0000-0000000fb103', '00000000-0000-0000-0000-0000000fbf03', 'gas', DATE '2026-11-11', 'T3');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('job-test-reports', '00000000-0000-0000-0000-0000000fbf01/t1.pdf', '00000000-0000-0000-0000-0000000fba07'),
  ('job-test-reports', '00000000-0000-0000-0000-0000000fbf03/t3.pdf', '00000000-0000-0000-0000-0000000fba07');

CREATE SCHEMA ptp;
CREATE FUNCTION ptp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ptp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the signed-in person gets: the gate for J1 and J3, the papers they read, and the files they read. Invoker.
CREATE FUNCTION ptp.reads() RETURNS text LANGUAGE sql AS $$
  SELECT 'gate ' || public.can_reach_job_for_test_report('00000000-0000-0000-0000-0000000fbf01')::text || ' ' || public.can_reach_job_for_test_report('00000000-0000-0000-0000-0000000fbf03')::text
      || ' · papers ' || coalesce((SELECT string_agg(notes, ' ' ORDER BY notes) FROM public.job_test_reports WHERE notes IN ('T1', 'T3', 'T9')), 'none')
      || ' · files ' || coalesce((SELECT string_agg(right(name, 6), ' ' ORDER BY name) FROM storage.objects WHERE bucket_id = 'job-test-reports' AND name LIKE '00000000-0000-0000-0000-0000000fbf0%'), 'none')
$$;
-- A write in a few words: "ok", "no row" when the policy hid the row, or "refused" when the policy refused it.
CREATE FUNCTION ptp.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN RETURN 'refused';
  END;
  RETURN CASE WHEN n = 0 THEN 'no row' ELSE 'ok' END;
END $$;
GRANT USAGE ON SCHEMA ptp TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ptp TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Pat, a primary on nothing, reads no paper and no file.
SELECT ptp.as_user('00000000-0000-0000-0000-0000000fba05');
SELECT ptp.same('Pat reads nothing', ptp.reads(), 'gate false false · papers none · files none');

-- 2 · Luis reads his own job's paper and file, and not the office's. He writes none, as before.
SELECT ptp.as_user('00000000-0000-0000-0000-0000000fba04');
SELECT ptp.same('Luis reads J1 only', ptp.reads(), 'gate true false · papers T1 · files t1.pdf');
SELECT ptp.same('Luis cannot add a paper to his own job', ptp.try($$INSERT INTO public.job_test_reports (job_id, test_type, test_date, notes) VALUES ('00000000-0000-0000-0000-0000000fbf01', 'gas', DATE '2026-11-12', 'T9')$$), 'refused');
SELECT ptp.same('Luis cannot change his own job''s paper', ptp.try($$UPDATE public.job_test_reports SET result = 'pass' WHERE id = '00000000-0000-0000-0000-0000000fb101'$$), 'no row');

-- 3 · The office reads and writes both, as before.
SELECT ptp.as_user('00000000-0000-0000-0000-0000000fba03');
SELECT ptp.same('Rosa reads both', ptp.reads(), 'gate true true · papers T1 T3 · files t1.pdf t3.pdf');
SELECT ptp.same('Rosa changes J3''s paper', ptp.try($$UPDATE public.job_test_reports SET result = 'pass' WHERE id = '00000000-0000-0000-0000-0000000fb103'$$), 'ok');
SELECT ptp.same('Rosa adds a paper to J3', ptp.try($$INSERT INTO public.job_test_reports (job_id, test_type, test_date, notes) VALUES ('00000000-0000-0000-0000-0000000fbf03', 'post_test', DATE '2026-11-12', 'T9')$$), 'ok');
SELECT ptp.as_user('00000000-0000-0000-0000-0000000fba07');
SELECT ptp.same('Mo reads all three', ptp.reads(), 'gate true true · papers T1 T3 T9 · files t1.pdf t3.pdf');

-- 4 · Sam, a helper on J3's crew, reads none, as before.
SELECT ptp.as_user('00000000-0000-0000-0000-0000000fba08');
SELECT ptp.same('Sam reads nothing', ptp.reads(), 'gate false false · papers none · files none');

DO $$ BEGIN RAISE NOTICE 'primary_test_papers PASSED'; END $$;
ROLLBACK;
