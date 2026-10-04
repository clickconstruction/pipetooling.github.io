-- Pay applications the job remembers (v2.4490): job_pay_applications through RLS, inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with
-- "pay_applications PASSED". See scripts/pgtest-pay-applications.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@bed.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'sub@bed.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'trainee@bed.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'master@bed.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'controller@bed.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@bed.test', 'Bed Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a2', 'sub@bed.test', 'Bed Sub', 'subcontractor'),
  ('00000000-0000-0000-0000-0000000000a3', 'trainee@bed.test', 'Bed Trainee', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a4', 'master@bed.test', 'Bed Master', 'master_technician'),
  ('00000000-0000-0000-0000-0000000000a5', 'controller@bed.test', 'Bed Controller', 'controller')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000000a3';
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000a001', 'Bed Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000a001', 'Bed Clubhouse'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000a001', 'Bed Dental');

CREATE SCHEMA bedt;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.as_user(p_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true);
  PERFORM set_config('request.jwt.claim.sub', p_id, true);
END $$;
GRANT USAGE ON SCHEMA bedt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bedt TO authenticated, anon;

-- 1 · the office saves application 1; who and when are the server's, whatever the client sent.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_pay_applications (job_id, application_number, period_to, fields, total_completed_and_stored, retainage_pct, retainage_held, total_earned_less_retainage, current_payment_due, created_by, updated_by, created_at)
VALUES ('00000000-0000-0000-0000-00000000c001', 1, '2026-09-30', '{"g702_n5_project":"1","g703_f13_this_period":19400}', 19400, 10, 1940, 17460, 17460, '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', '2001-01-01');
SELECT bedt.ok('the assistant reads the application', (SELECT count(*) = 1 FROM public.job_pay_applications));
SELECT bedt.ok('created_by is the caller, not what was sent', (SELECT created_by = '00000000-0000-0000-0000-0000000000a1' FROM public.job_pay_applications));
SELECT bedt.ok('created_at is now, not what was sent', (SELECT created_at > now() - interval '1 hour' FROM public.job_pay_applications));
SELECT bedt.ok('it starts as made in the window, with no files', (SELECT source = 'window' AND files = '[]'::jsonb FROM public.job_pay_applications));
SELECT bedt.ok('it starts with no reason for keeping old amounts', (SELECT carry_reason = '' FROM public.job_pay_applications));

-- 2 · a job holds one application per number; another job may use the same number.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.job_pay_applications (job_id, application_number) VALUES ('00000000-0000-0000-0000-00000000c001', 1);
    RAISE EXCEPTION 'FAILED: a second application 1 was kept on the job';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: a number is used once per job';
  END;
END $$;
INSERT INTO public.job_pay_applications (job_id, application_number) VALUES ('00000000-0000-0000-0000-00000000c002', 1);
INSERT INTO public.job_pay_applications (job_id, application_number, total_earned_less_retainage) VALUES ('00000000-0000-0000-0000-00000000c001', 2, 26190);
SELECT bedt.ok('two jobs, three applications', (SELECT count(*) = 3 FROM public.job_pay_applications));

-- 3 · a number below 1, a form that is not an object and a percent over 100 are refused.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.job_pay_applications (job_id, application_number) VALUES ('00000000-0000-0000-0000-00000000c001', 0);
    RAISE EXCEPTION 'FAILED: application 0 was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: application 0 is refused';
  END;
  BEGIN
    INSERT INTO public.job_pay_applications (job_id, application_number, fields) VALUES ('00000000-0000-0000-0000-00000000c001', 7, '[1,2]');
    RAISE EXCEPTION 'FAILED: a form that is a list was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the form must be an object';
  END;
  BEGIN
    INSERT INTO public.job_pay_applications (job_id, application_number, retainage_pct) VALUES ('00000000-0000-0000-0000-00000000c001', 8, 150);
    RAISE EXCEPTION 'FAILED: 150 percent retainage was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: retainage over 100 percent is refused';
  END;
END $$;
RESET ROLE;

-- 4 · nothing locks: the master changes application 1, and the first author stays on it.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a4');
SET LOCAL ROLE authenticated;
UPDATE public.job_pay_applications SET current_payment_due = 16000, created_by = '00000000-0000-0000-0000-0000000000a4'
  WHERE job_id = '00000000-0000-0000-0000-00000000c001' AND application_number = 1;
UPDATE public.job_pay_applications SET carry_reason = 'It went out this way.' WHERE job_id = '00000000-0000-0000-0000-00000000c001' AND application_number = 2;
SELECT bedt.ok('the master wrote why application 2 stays as it is', (SELECT carry_reason = 'It went out this way.' FROM public.job_pay_applications WHERE job_id = '00000000-0000-0000-0000-00000000c001' AND application_number = 2));
SELECT bedt.ok('the master changed it', (SELECT current_payment_due = 16000 FROM public.job_pay_applications WHERE job_id = '00000000-0000-0000-0000-00000000c001' AND application_number = 1));
SELECT bedt.ok('updated_by is the master', (SELECT updated_by = '00000000-0000-0000-0000-0000000000a4' FROM public.job_pay_applications WHERE job_id = '00000000-0000-0000-0000-00000000c001' AND application_number = 1));
SELECT bedt.ok('created_by is still the assistant', (SELECT created_by = '00000000-0000-0000-0000-0000000000a1' FROM public.job_pay_applications WHERE job_id = '00000000-0000-0000-0000-00000000c001' AND application_number = 1));
RESET ROLE;

-- 5 · the controller is office too.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a5');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('the controller reads all three', (SELECT count(*) = 3 FROM public.job_pay_applications));
RESET ROLE;

-- 6 · a subcontractor neither reads nor writes.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a2');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('a subcontractor reads nothing', (SELECT count(*) = 0 FROM public.job_pay_applications));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.job_pay_applications (job_id, application_number) VALUES ('00000000-0000-0000-0000-00000000c001', 9);
    RAISE EXCEPTION 'FAILED: a subcontractor saved an application';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a subcontractor cannot write';
  END;
END $$;
RESET ROLE;

-- 7 · a training account (read_only) cannot change it.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a3');
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int;
BEGIN
  BEGIN
    UPDATE public.job_pay_applications SET current_payment_due = 1;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE EXCEPTION 'FAILED: a read-only account changed an application'; END IF;
    RAISE NOTICE 'ok: a read-only account changes nothing';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a read-only account is refused';
  END;
END $$;
RESET ROLE;

-- 8 · nobody calls the stamp function by hand, and anon sees nothing.
SELECT bedt.ok('anon cannot execute the stamp function', NOT has_function_privilege('anon', 'public.job_pay_applications_stamp()', 'EXECUTE'));
SELECT bedt.ok('authenticated cannot execute the stamp function', NOT has_function_privilege('authenticated', 'public.job_pay_applications_stamp()', 'EXECUTE'));
SET LOCAL ROLE anon;
SELECT bedt.ok('anon reads nothing', (SELECT count(*) = 0 FROM public.job_pay_applications));
RESET ROLE;

-- 9 · the office deletes one, and a deleted job takes its applications with it.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
DELETE FROM public.job_pay_applications WHERE job_id = '00000000-0000-0000-0000-00000000c001' AND application_number = 2;
SELECT bedt.ok('application 2 is gone', (SELECT count(*) = 2 FROM public.job_pay_applications));
RESET ROLE;
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-00000000c002';
SELECT bedt.ok('the deleted job took its application', (SELECT count(*) = 1 FROM public.job_pay_applications));

SELECT 'pay_applications PASSED' AS result;
ROLLBACK;
