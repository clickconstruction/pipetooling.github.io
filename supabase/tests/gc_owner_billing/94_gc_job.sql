-- General conditions at actual cost (GC mode, Owner Billing's O11b): gc_project_money.general_conditions_job_id, the
-- Pipeline job a GC project's general conditions are spent on. The money team names it and clears it through the
-- table's own policy; an estimator does not; a training account and a digital twin are stopped by the fences; deleting
-- the job lets go of it and keeps our number. The fixture is made as postgres; the presses run through RLS; everything
-- runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_owner_billing_gc_job PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000b9a01', 'controller@gcjob.test'),
  ('00000000-0000-0000-0000-0000000b9a02', 'owner@gcjob.test'),
  ('00000000-0000-0000-0000-0000000b9a03', 'dev@gcjob.test'),
  ('00000000-0000-0000-0000-0000000b9a04', 'estimator@gcjob.test'),
  ('00000000-0000-0000-0000-0000000b9a05', 'trainee@gcjob.test'),
  ('00000000-0000-0000-0000-0000000b9a06', 'twin@gcjob.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000b9a01', 'controller@gcjob.test', 'Job Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000b9a02', 'owner@gcjob.test', 'Job Owner', 'master_technician'),
  ('00000000-0000-0000-0000-0000000b9a03', 'dev@gcjob.test', 'Job Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000b9a04', 'estimator@gcjob.test', 'Job Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000b9a05', 'trainee@gcjob.test', 'Job Trainee', 'master_technician'),
  ('00000000-0000-0000-0000-0000000b9a06', 'twin@gcjob.test', 'Job Twin', 'controller')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000b9a05';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000b9a06';

-- A GC job being built, its number ($138,000 of general conditions, 5% contingency, 6% fee), and two Pipeline jobs.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000b9c01', 'GC Job Test Owner', '00000000-0000-0000-0000-0000000b9a02');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000b9b01', 'GC job test', '00000000-0000-0000-0000-0000000b9c01');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-0000000b9b01', 'building', '2026-09-01');
INSERT INTO public.gc_project_money (project_id, general_conditions, contingency_pct, fee_pct) VALUES ('00000000-0000-0000-0000-0000000b9b01', 138000, 5, 6)
  ON CONFLICT (project_id) DO UPDATE SET general_conditions = EXCLUDED.general_conditions, contingency_pct = EXCLUDED.contingency_pct, fee_pct = EXCLUDED.fee_pct;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000b9e01', 'GC Job Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000b9d01', '00000000-0000-0000-0000-0000000b9a02', '00000000-0000-0000-0000-0000000b9e01', 'GC job test general conditions'),
  ('00000000-0000-0000-0000-0000000b9d02', '00000000-0000-0000-0000-0000000b9a02', '00000000-0000-0000-0000-0000000b9e01', 'GC job test second job');

CREATE SCHEMA ggj;
CREATE FUNCTION ggj.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ggj.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- Name a job (or none) as the caller: the rows it reached, or refused.
CREATE FUNCTION ggj.name_job(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    UPDATE public.gc_project_money SET general_conditions_job_id = p_job WHERE project_id = '00000000-0000-0000-0000-0000000b9b01';
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
END $$;
-- What our number holds, whoever is asking.
CREATE FUNCTION ggj.held() RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT coalesce(right(general_conditions_job_id::text, 4), 'none') || ' ' || trim_scale(general_conditions) || ' ' || trim_scale(contingency_pct) || ' ' || trim_scale(fee_pct)
                   FROM public.gc_project_money WHERE project_id = '00000000-0000-0000-0000-0000000b9b01'), 'no row') $$;
GRANT USAGE ON SCHEMA ggj TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ggj TO authenticated;

-- 0 · The column: on our number, nullable, a Pipeline job that lets go when it is deleted.
SELECT ggj.same('the column: uuid, nullable, on gc_project_money',
  (SELECT data_type || ' ' || is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_project_money' AND column_name = 'general_conditions_job_id'),
  'uuid YES');
SELECT ggj.same('its key: to jobs_ledger, set to null on delete',
  (SELECT c.confrelid::regclass::text || ' ' || c.confdeltype::text FROM pg_constraint c
   WHERE c.conrelid = 'public.gc_project_money'::regclass AND c.contype = 'f'
     AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.gc_project_money'::regclass AND attname = 'general_conditions_job_id')]),
  'jobs_ledger n');
SELECT ggj.same('a new project''s number names no job', ggj.held(), 'none 138000 5 6');

-- 1 · The money team names it and clears it: the controller, the owner, a dev.
SELECT ggj.as_user('00000000-0000-0000-0000-0000000b9a01');
SET LOCAL ROLE authenticated;
SELECT ggj.same('the controller names the job, and our number keeps its three inputs', ggj.name_job('00000000-0000-0000-0000-0000000b9d01') || ' ' || ggj.held(), '1 9d01 138000 5 6');
SELECT ggj.same('and reads it back', (SELECT right(general_conditions_job_id::text, 4) FROM public.gc_project_money WHERE project_id = '00000000-0000-0000-0000-0000000b9b01'), '9d01');
SELECT ggj.same('and clears it', ggj.name_job(NULL) || ' ' || ggj.held(), '1 none 138000 5 6');
RESET ROLE;
SELECT ggj.as_user('00000000-0000-0000-0000-0000000b9a02');
SET LOCAL ROLE authenticated;
SELECT ggj.same('the owner names another', ggj.name_job('00000000-0000-0000-0000-0000000b9d02') || ' ' || ggj.held(), '1 9d02 138000 5 6');
RESET ROLE;
SELECT ggj.as_user('00000000-0000-0000-0000-0000000b9a03');
SET LOCAL ROLE authenticated;
SELECT ggj.same('a dev too', ggj.name_job('00000000-0000-0000-0000-0000000b9d01') || ' ' || ggj.held(), '1 9d01 138000 5 6');
RESET ROLE;

-- 2 · Nobody else does: an estimator reaches no row; a training account and a twin are stopped.
SELECT ggj.as_user('00000000-0000-0000-0000-0000000b9a04');
SET LOCAL ROLE authenticated;
SELECT ggj.same('an estimator does not, and reads no number', ggj.name_job('00000000-0000-0000-0000-0000000b9d02') || ' ' || (SELECT count(*) FROM public.gc_project_money)::text || ' ' || ggj.held(), '0 0 9d01 138000 5 6');
RESET ROLE;
SELECT ggj.as_user('00000000-0000-0000-0000-0000000b9a05');
SET LOCAL ROLE authenticated;
SELECT ggj.same('nor the owner in training mode', CASE WHEN ggj.name_job('00000000-0000-0000-0000-0000000b9d02') IN ('0', 'refused') THEN 'stopped' ELSE 'named' END || ' ' || ggj.held(), 'stopped 9d01 138000 5 6');
RESET ROLE;
SELECT ggj.as_user('00000000-0000-0000-0000-0000000b9a06');
SET LOCAL ROLE authenticated;
SELECT ggj.same('nor a controller who is a digital twin', CASE WHEN ggj.name_job('00000000-0000-0000-0000-0000000b9d02') IN ('0', 'refused') THEN 'stopped' ELSE 'named' END || ' ' || ggj.held(), 'stopped 9d01 138000 5 6');
RESET ROLE;

-- 3 · Deleting the job lets go of it, and our number stays.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000000b9d01';
SELECT ggj.same('the job deleted: no job named, our number whole', ggj.held(), 'none 138000 5 6');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_gc_job PASSED'; END $$;
ROLLBACK;
