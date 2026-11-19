-- The salaried week in the cost functions (v2.7840, migration *_salaried_week_in_cost_functions): each of the five
-- functions that carried the flat 8 is run once as a dev, so its changed statement is planned and answered, and the
-- two whose answer is plain to read are held to it. A person on 6 hours with a short Friday and a person on the
-- default week share one job on a Monday, a Friday and a Saturday. list_people_pay_flags hands back the week.
-- Written as postgres with a dev's sign-in claims; everything rolls back. Raises on the first failed assertion; ends
-- with "salaried_week costs PASSED". See scripts/pgtest-salaried-week.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA swc;
CREATE FUNCTION swc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION swc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000007840a1', 'dana@week.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000007840a1', 'dana@week.test', 'Dana Dev', 'dev', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000007840f9', 'Week Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000007840b1', '00000000-0000-0000-0000-0000007840a1', '00000000-0000-0000-0000-0000007840f9', 'Week bed job', NULL);

-- Two salaried people at $10: one on 6 hours with a 4-hour Friday, one on the default week.
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary, salaried_week_hours) VALUES
  ('ZZ Week Six', 10, true, '{0,6,6,6,6,4,0}');
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary) VALUES
  ('ZZ Week Default', 10, true);
-- 2026-11-16 is a Monday, 2026-11-20 a Friday, 2026-11-21 a Saturday. Each row is the whole day on the one job.
INSERT INTO public.people_crew_jobs (work_date, person_name, job_assignments) VALUES
  ('2026-11-16', 'ZZ Week Six', '[{"job_id":"00000000-0000-0000-0000-0000007840b1","pct":100}]'),
  ('2026-11-20', 'ZZ Week Six', '[{"job_id":"00000000-0000-0000-0000-0000007840b1","pct":100}]'),
  ('2026-11-21', 'ZZ Week Six', '[{"job_id":"00000000-0000-0000-0000-0000007840b1","pct":100}]'),
  ('2026-11-16', 'ZZ Week Default', '[{"job_id":"00000000-0000-0000-0000-0000007840b1","pct":100}]'),
  ('2026-11-21', 'ZZ Week Default', '[{"job_id":"00000000-0000-0000-0000-0000007840b1","pct":100}]');

SELECT swc.as_user('00000000-0000-0000-0000-0000007840a1');

-- 1 · Man-hours on the job: 6 + 4 + 0 for the short week, 8 + 0 for the default one.
SELECT swc.same('man-hours read each person''s own week',
  (SELECT string_agg(m.person_name || ' ' || round(m.man_hours, 2)::text, ' | ' ORDER BY m.person_name)
   FROM public.get_man_hours_by_job() m WHERE m.job_id = '00000000-0000-0000-0000-0000007840b1'),
  'ZZ Week Default 8.00 | ZZ Week Six 10.00');

-- 2 · The job's baseline keeps the same hours, priced at each wage: 18 hours, $180.
SELECT swc.same('the baseline was kept',
  public.keep_job_baseline('00000000-0000-0000-0000-0000007840b1', '00000000-0000-0000-0000-0000007840a1', 'kept')::text, 'true');
SELECT swc.same('the baseline keeps each person''s own week',
  (SELECT round(b.team_hours, 2)::text || ' h, $' || round(b.team_usd, 2)::text FROM public.job_baselines b WHERE b.job_id = '00000000-0000-0000-0000-0000007840b1'),
  '18.00 h, $180.00');

-- 3 · The other three run through their changed statements and answer.
SELECT swc.same('the project board answers',
  (public.list_project_board(ARRAY['00000000-0000-0000-0000-0000007840b1']::uuid[]) IS NOT NULL)::text, 'true');
SELECT swc.same('the superintendent scores answer',
  (public.superintendent_scores('2026-11-15', '2026-11-21', ARRAY['00000000-0000-0000-0000-0000007840b1']::uuid[]) IS NOT NULL)::text, 'true');
SELECT swc.same('the weekly money movement answers',
  (public.get_weekly_money_movement_payload('2026-11-16') IS NOT NULL)::text, 'true');

-- 4 · The pay flags hand back the week, and no wage.
SELECT swc.same('the pay flags carry each week',
  (SELECT string_agg(f.person_name || ' ' || f.salaried_week_hours::text, ' | ' ORDER BY f.person_name)
   FROM public.list_people_pay_flags() f WHERE f.person_name LIKE 'ZZ Week %'),
  'ZZ Week Default {0.00,8.00,8.00,8.00,8.00,8.00,0.00} | ZZ Week Six {0.00,6.00,6.00,6.00,6.00,4.00,0.00}');
SELECT swc.same('the pay flags return the week last, and still no wage',
  pg_get_function_result('public.list_people_pay_flags()'::regprocedure),
  'TABLE(person_name text, person_id uuid, is_salary boolean, record_hours_but_salary boolean, show_in_hours boolean, salaried_week_hours numeric[])');

-- 5 · None of the five still writes the flat 8 out for itself.
SELECT swc.same('each function asks the one rule',
  (SELECT string_agg(p.proname || ':' || (pg_get_functiondef(p.oid) LIKE '%salaried_hours_on(%')::text || ':' || (pg_get_functiondef(p.oid) ILIKE '%THEN 8 ELSE 0%')::text, ' ' ORDER BY p.proname)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('get_man_hours_by_job', 'keep_job_baseline', 'list_project_board', 'superintendent_scores', 'get_weekly_money_movement_payload')),
  'get_man_hours_by_job:true:false get_weekly_money_movement_payload:true:false keep_job_baseline:true:false list_project_board:true:false superintendent_scores:true:false');

ROLLBACK;
SELECT 'salaried_week costs PASSED';
