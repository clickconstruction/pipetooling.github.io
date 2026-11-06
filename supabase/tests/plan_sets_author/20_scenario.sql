-- Plan sets by part (punch list #239, migration *_plan_sets_author_stays_on_job): an as-built's author stays on the job.
-- A subcontractor on a job's crew keeps an as-built on it and changes its memo; moving the row to a job they are not
-- on, to that job's part, or to no job is refused as a row-level violation and the row stays where it was; a new
-- as-built on a job they are not on, on their job under another part, or a drawing is refused; the office moves any row;
-- put on the other job's crew, the author moves the row onto that job with its part, and removes their own. The
-- predicate answers for a helper on the crew, whose own crew row the team table's SELECT policy hides from them, true
-- on their job and false off it. Fixtures are written as postgres; the tries run as each account under RLS; everything
-- rolls back. Raises on the first failed assertion; ends with "plan_sets_author PASSED". See
-- scripts/pgtest-plan-sets-author.sh. Never against prod.
--
-- Both jobs stand outside any development on purpose: a part owned by a development is read through the developments
-- row under the caller's own RLS (plan_part_can_see), which the office alone reads, so a crew member on a development's
-- job sees no part there at all — a fault of its own, named on the card, not this migration's.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee runs the office; Mo is the master every job hangs on; Sam is a subcontractor and Hal a helper, both on job A's crew.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000239a001', 'dee@author.test'),
  ('00000000-0000-0000-0000-00000239a002', 'sam@author.test'),
  ('00000000-0000-0000-0000-00000239a003', 'hal@author.test'),
  ('00000000-0000-0000-0000-00000239a004', 'mo@author.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000239a001', 'dee@author.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-00000239a002', 'sam@author.test', 'Sam Sub', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-00000239a003', 'hal@author.test', 'Hal Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000239a004', 'mo@author.test', 'Mo Master', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000239f009', 'Author Bed Work');
-- Jobs A and B stand alone, each with a part of its own.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239a004', '00000000-0000-0000-0000-00000239f009', 'Author bed job A', NULL),
  ('00000000-0000-0000-0000-00000239b002', '00000000-0000-0000-0000-00000239a004', '00000000-0000-0000-0000-00000239f009', 'Author bed job B', NULL);
INSERT INTO public.plan_parts (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-00000239c001', '00000000-0000-0000-0000-00000239b001', 'Author bed job A'),
  ('00000000-0000-0000-0000-00000239c002', '00000000-0000-0000-0000-00000239b002', 'Author bed job B');
UPDATE public.jobs_ledger SET plan_part_id = '00000000-0000-0000-0000-00000239c001' WHERE id = '00000000-0000-0000-0000-00000239b001';
UPDATE public.jobs_ledger SET plan_part_id = '00000000-0000-0000-0000-00000239c002' WHERE id = '00000000-0000-0000-0000-00000239b002';
INSERT INTO public.plan_sets (id, part_id, name, kind, source) VALUES ('00000000-0000-0000-0000-00000239e001', '00000000-0000-0000-0000-00000239c001', 'Issued set', 'issued', 'gc');
UPDATE public.plan_parts SET current_set_id = '00000000-0000-0000-0000-00000239e001' WHERE id = '00000000-0000-0000-0000-00000239c001';
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239a002'),
  ('00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239a003');

CREATE SCHEMA psa;
GRANT USAGE ON SCHEMA psa TO authenticated;
CREATE FUNCTION psa.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION psa.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION psa.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (42501 is a row-level violation).
CREATE FUNCTION psa.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- Where a set sits, read past RLS: the job that made it and its part.
CREATE FUNCTION psa.where_is(p_set uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(j.job_name, 'no job') || ' · ' || p.name FROM public.plan_sets s JOIN public.plan_parts p ON p.id = s.part_id LEFT JOIN public.jobs_ledger j ON j.id = s.job_id WHERE s.id = p_set
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA psa TO authenticated;

-- The structure: both rules ask the one predicate, and it runs as its definer with row security off.
SELECT psa.same('the insert rule asks plan_set_crew_on_job', (SELECT (with_check LIKE '%plan_set_crew_on_job%')::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_sets' AND policyname = 'plan_sets_insert'), 'true');
SELECT psa.same('the update rule asks plan_set_crew_on_job on the row it leaves behind', (SELECT (with_check LIKE '%plan_set_crew_on_job%')::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_sets' AND policyname = 'plan_sets_update'), 'true');
SELECT psa.same('the predicate is a definer with row security off', (
  SELECT p.prosecdef::text || ' ' || coalesce((SELECT string_agg(c, ' ') FROM unnest(p.proconfig) c WHERE c LIKE 'row_security=%'), 'row_security unset')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'plan_set_crew_on_job'
), 'true row_security=off');

-- Sam, a subcontractor on job A's crew: keeps an as-built, changes it, and cannot aim it anywhere he is not.
SET ROLE authenticated;
SELECT psa.sign_in('00000000-0000-0000-0000-00000239a002');
SELECT psa.same('Sam sees his job''s part', (SELECT count(*) FROM public.plan_parts WHERE id = '00000000-0000-0000-0000-00000239c001')::text, '1');
SELECT psa.same('and not job B''s', (SELECT count(*) FROM public.plan_parts WHERE id = '00000000-0000-0000-0000-00000239c002')::text, '0');
SELECT psa.same('Sam keeps an as-built on his job', psa.try($q$
  INSERT INTO public.plan_sets (id, part_id, name, kind, source, job_id, marks_up_set_id, created_by)
  VALUES ('00000000-0000-0000-0000-00000239e002', '00000000-0000-0000-0000-00000239c001', 'As-built Nov 6', 'as_built', 'ours', '00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239e001', '00000000-0000-0000-0000-00000239a002')
$q$), 'rows 1');
SELECT psa.same('Sam changes its memo', psa.try($q$UPDATE public.plan_sets SET memo = 'Riser moved to the east wall' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), 'rows 1');
SELECT psa.same('Sam cannot move it to a job he is not on', psa.try($q$UPDATE public.plan_sets SET job_id = '00000000-0000-0000-0000-00000239b002' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), '42501');
SELECT psa.same('nor to that job and its part together', psa.try($q$UPDATE public.plan_sets SET part_id = '00000000-0000-0000-0000-00000239c002', job_id = '00000000-0000-0000-0000-00000239b002' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), '42501');
SELECT psa.same('nor take the job off it', psa.try($q$UPDATE public.plan_sets SET job_id = NULL WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), '42501');
SELECT psa.same('the row is where it was', psa.where_is('00000000-0000-0000-0000-00000239e002'), 'Author bed job A · Author bed job A');
SELECT psa.same('Sam cannot keep an as-built on a job he is not on', psa.try($q$
  INSERT INTO public.plan_sets (part_id, name, kind, source, job_id, created_by)
  VALUES ('00000000-0000-0000-0000-00000239c002', 'As-built on B', 'as_built', 'ours', '00000000-0000-0000-0000-00000239b002', '00000000-0000-0000-0000-00000239a002')
$q$), '42501');
SELECT psa.same('Sam cannot keep an as-built on his job under another part', psa.try($q$
  INSERT INTO public.plan_sets (part_id, name, kind, source, job_id, created_by)
  VALUES ('00000000-0000-0000-0000-00000239c002', 'As-built under B''s part', 'as_built', 'ours', '00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239a002')
$q$), '42501');
SELECT psa.same('Sam cannot keep a drawing', psa.try($q$
  INSERT INTO public.plan_sets (part_id, name, kind, source, job_id, created_by)
  VALUES ('00000000-0000-0000-0000-00000239c001', 'Addendum 1', 'addendum', 'gc', '00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239a002')
$q$), '42501');

-- Dee, the office: moves any row, as before.
SELECT psa.sign_in('00000000-0000-0000-0000-00000239a001');
SELECT psa.same('the office moves the row to another job', psa.try($q$UPDATE public.plan_sets SET job_id = '00000000-0000-0000-0000-00000239b002' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), 'rows 1');
SELECT psa.same('and back', psa.try($q$UPDATE public.plan_sets SET job_id = '00000000-0000-0000-0000-00000239b001' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), 'rows 1');

-- Hal, a helper on job A's crew: the predicate answers for him though the team table hides his own crew row.
SELECT psa.sign_in('00000000-0000-0000-0000-00000239a003');
SELECT psa.same('Hal reads no crew row of his own', (SELECT count(*) FROM public.jobs_ledger_team_members WHERE user_id = '00000000-0000-0000-0000-00000239a003')::text, '0');
SELECT psa.same('yet the predicate answers true for Hal on his job', public.plan_set_crew_on_job('00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239c001')::text, 'true');
SELECT psa.same('and false for a job he is not on', public.plan_set_crew_on_job('00000000-0000-0000-0000-00000239b002', '00000000-0000-0000-0000-00000239c002')::text, 'false');
SELECT psa.same('and false for his job under another part', public.plan_set_crew_on_job('00000000-0000-0000-0000-00000239b001', '00000000-0000-0000-0000-00000239c002')::text, 'false');
SELECT psa.same('Hal cannot touch Sam''s as-built', psa.try($q$UPDATE public.plan_sets SET memo = 'Mine now' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), 'rows 0');
SELECT psa.sign_out();
RESET ROLE;

-- Sam joins job B's crew: now he may move his as-built onto B with B's part, as he could have kept it there, and no further.
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-00000239b002', '00000000-0000-0000-0000-00000239a002');
SET ROLE authenticated;
SELECT psa.sign_in('00000000-0000-0000-0000-00000239a002');
SELECT psa.same('on both crews, Sam still cannot put it on job B under job A''s part', psa.try($q$UPDATE public.plan_sets SET job_id = '00000000-0000-0000-0000-00000239b002' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), '42501');
SELECT psa.same('but moves it onto job B with its part', psa.try($q$UPDATE public.plan_sets SET part_id = '00000000-0000-0000-0000-00000239c002', job_id = '00000000-0000-0000-0000-00000239b002' WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), 'rows 1');
SELECT psa.same('the row followed', psa.where_is('00000000-0000-0000-0000-00000239e002'), 'Author bed job B · Author bed job B');
SELECT psa.same('Sam removes his own as-built', psa.try($q$DELETE FROM public.plan_sets WHERE id = '00000000-0000-0000-0000-00000239e002'$q$), 'rows 1');
SELECT psa.sign_out();
RESET ROLE;

SELECT 'plan_sets_author PASSED';
ROLLBACK;
