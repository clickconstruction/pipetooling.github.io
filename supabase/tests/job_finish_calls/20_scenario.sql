-- My finish date's table (punch list #396 PR 3a, migration *_job_finish_calls): a person writes his own row on a
-- job he can read and no other, reads his own rows and what was said on a job he can read, and nobody signed in
-- changes or deletes a row. A training account, a twin and an archived account are held by the fences. Who reads a
-- job is jobs_ledger's own rule, so for the crew this bed asks the job first and holds the table to the same answer.
-- Everything rolls back. Raises on the first failed assertion; ends with "job_finish_calls PASSED". See
-- scripts/pgtest-job-finish-calls.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Marcus is the job's master. Luis is a superintendent, Hector a helper, Priya an estimator. Tara is a master in
-- training, Tess a master's twin, Gwen a master who left: each is the master of a job of her own, so only the fence
-- stands between her and a row.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003960a1', 'marcus@finish.test'),
  ('00000000-0000-0000-0000-0000003960a2', 'luis@finish.test'),
  ('00000000-0000-0000-0000-0000003960a3', 'hector@finish.test'),
  ('00000000-0000-0000-0000-0000003960a4', 'priya@finish.test'),
  ('00000000-0000-0000-0000-0000003960a5', 'tara@finish.test'),
  ('00000000-0000-0000-0000-0000003960a6', 'tess@finish.test'),
  ('00000000-0000-0000-0000-0000003960a7', 'gwen@finish.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003960a1', 'marcus@finish.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003960a2', 'luis@finish.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003960a3', 'hector@finish.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003960a4', 'priya@finish.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003960a5', 'tara@finish.test', 'Tara Training', 'master_technician', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003960a6', 'tess@finish.test', 'Tess Twin', 'master_technician', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003960a7', 'gwen@finish.test', 'Gwen Gone', 'master_technician', false, false, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA fcb;
CREATE FUNCTION fcb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Refused with these words; an empty want takes any refusal (a fence's own words are the fence's to choose).
CREATE FUNCTION fcb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF want <> '' AND position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION fcb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Whether the caller reads the job, under jobs_ledger's own rule: "reads" or "does not read".
CREATE FUNCTION fcb.job(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job) THEN 'reads' ELSE 'does not read' END
$$;
-- The caller says a day on the job: "said" or "refused".
CREATE FUNCTION fcb.says(p_job uuid, p_day date, p_why text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    INSERT INTO public.job_finish_calls (job_id, finish_on, why) VALUES (p_job, p_day, p_why);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
  RETURN 'said';
END $$;
-- What the table should answer the caller for this job: he says a day only when he reads the job.
CREATE FUNCTION fcb.may(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN fcb.job(p_job) = 'reads' THEN 'said' ELSE 'refused' END
$$;
-- How many sayings the caller reads on the job.
CREATE FUNCTION fcb.reads(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.job_finish_calls c WHERE c.job_id = p_job
$$;
-- Past row-level security: every saying on the job, and one person's.
CREATE FUNCTION fcb.every(p_job uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::text FROM public.job_finish_calls c WHERE c.job_id = p_job
$$;
CREATE FUNCTION fcb.own(p_job uuid, p_user uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::text FROM public.job_finish_calls c WHERE c.job_id = p_job AND c.user_id = p_user
$$;
GRANT USAGE ON SCHEMA fcb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA fcb TO authenticated, anon;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003960f9', 'Finish Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000003960b1', '00000000-0000-0000-0000-0000003960a1', '00000000-0000-0000-0000-0000003960f9', 'Clinic rough-in', NULL),
  ('00000000-0000-0000-0000-0000003960b5', '00000000-0000-0000-0000-0000003960a5', '00000000-0000-0000-0000-0000003960f9', 'A training master''s job', NULL),
  ('00000000-0000-0000-0000-0000003960b6', '00000000-0000-0000-0000-0000003960a6', '00000000-0000-0000-0000-0000003960f9', 'A twin''s job', NULL),
  ('00000000-0000-0000-0000-0000003960b7', '00000000-0000-0000-0000-0000003960a7', '00000000-0000-0000-0000-0000003960f9', 'A job of someone who left', NULL);

-- 0 · The table carries its fences, and a second run of the migration left one of each policy.
SELECT fcb.same('the table has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_finish_calls' AND policyname = 'archived_fence')::text, '1');
SELECT fcb.same('the table has a training-mode trigger', (SELECT count(DISTINCT tgrelid) FROM pg_trigger WHERE tgrelid = 'public.job_finish_calls'::regclass AND NOT tgisinternal)::text, '1');
SELECT fcb.same('one of each policy of its own', (SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_finish_calls' AND policyname IN ('job_finish_calls_insert', 'job_finish_calls_select')), 'job_finish_calls_insert, job_finish_calls_select');
SELECT fcb.same('anon holds nothing on the table', (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'job_finish_calls' AND grantee = 'anon')::text, '0');
SELECT fcb.same('a signed-in person may read and add, and no more', (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'job_finish_calls' AND grantee = 'authenticated'), 'INSERT, SELECT');

-- 1 · Marcus, the job's master: he reads his job, so he says a day, and says another.
SELECT fcb.as_user('00000000-0000-0000-0000-0000003960a1'); SET LOCAL ROLE authenticated;
SELECT fcb.same('the job''s master reads the job', fcb.job('00000000-0000-0000-0000-0000003960b1'), 'reads');
SELECT fcb.same('he says a day', fcb.says('00000000-0000-0000-0000-0000003960b1', '2026-11-20', NULL), 'said');
SELECT fcb.same('he says a later day with what is in the way', fcb.says('00000000-0000-0000-0000-0000003960b1', '2026-11-23', 'Waiting on the inspector'), 'said');
SELECT fcb.same('both sayings are kept, in his name', fcb.own('00000000-0000-0000-0000-0000003960b1', '00000000-0000-0000-0000-0000003960a1'), '2');
SELECT fcb.same('he reads both', fcb.reads('00000000-0000-0000-0000-0000003960b1'), '2');
-- The row is his own or it is refused, and the words have to be words.
SELECT fcb.refused('a saying in another person''s name', $q$INSERT INTO public.job_finish_calls (job_id, user_id, finish_on) VALUES ('00000000-0000-0000-0000-0000003960b1', '00000000-0000-0000-0000-0000003960a2', '2026-11-20')$q$, 'row-level security');
SELECT fcb.refused('a why of only spaces', $q$INSERT INTO public.job_finish_calls (job_id, finish_on, why) VALUES ('00000000-0000-0000-0000-0000003960b1', '2026-11-20', '   ')$q$, 'job_finish_calls_why_has_words');
SELECT fcb.refused('a why past 300 letters', $q$INSERT INTO public.job_finish_calls (job_id, finish_on, why) VALUES ('00000000-0000-0000-0000-0000003960b1', '2026-11-20', repeat('x', 301))$q$, 'job_finish_calls_why_has_words');
SELECT fcb.refused('a saying with no day', $q$INSERT INTO public.job_finish_calls (job_id, finish_on) VALUES ('00000000-0000-0000-0000-0000003960b1', NULL)$q$, 'finish_on');
-- Nothing is changed and nothing is taken back.
SELECT fcb.refused('changing a saying', $q$UPDATE public.job_finish_calls SET finish_on = '2026-12-01' WHERE job_id = '00000000-0000-0000-0000-0000003960b1'$q$, 'permission denied');
SELECT fcb.refused('deleting a saying', $q$DELETE FROM public.job_finish_calls WHERE job_id = '00000000-0000-0000-0000-0000003960b1'$q$, 'permission denied');
RESET ROLE;

-- 2 · The crew and an estimator: each says a day exactly when jobs_ledger lets him read the job, and reads what was
-- said on it on the same rule. A person who does not read the job reads no saying of anyone else's.
SELECT fcb.as_user('00000000-0000-0000-0000-0000003960a2'); SET LOCAL ROLE authenticated;
DO $$ BEGIN RAISE NOTICE 'ok: a superintendent % the master''s job', fcb.job('00000000-0000-0000-0000-0000003960b1'); END $$;
SELECT fcb.same('a superintendent says a day when he reads the job, and only then', fcb.says('00000000-0000-0000-0000-0000003960b1', '2026-11-24', 'Two more days of top-out'), fcb.may('00000000-0000-0000-0000-0000003960b1'));
SELECT fcb.same('he reads every saying on a job he reads, and no other person''s on a job he does not', fcb.reads('00000000-0000-0000-0000-0000003960b1'), CASE WHEN fcb.job('00000000-0000-0000-0000-0000003960b1') = 'reads' THEN fcb.every('00000000-0000-0000-0000-0000003960b1') ELSE fcb.own('00000000-0000-0000-0000-0000003960b1', '00000000-0000-0000-0000-0000003960a2') END);
RESET ROLE;
SELECT fcb.as_user('00000000-0000-0000-0000-0000003960a3'); SET LOCAL ROLE authenticated;
DO $$ BEGIN RAISE NOTICE 'ok: a helper % the master''s job', fcb.job('00000000-0000-0000-0000-0000003960b1'); END $$;
SELECT fcb.same('a helper says a day when he reads the job, and only then', fcb.says('00000000-0000-0000-0000-0000003960b1', '2026-11-25', NULL), fcb.may('00000000-0000-0000-0000-0000003960b1'));
SELECT fcb.same('a helper reads on the same rule', fcb.reads('00000000-0000-0000-0000-0000003960b1'), CASE WHEN fcb.job('00000000-0000-0000-0000-0000003960b1') = 'reads' THEN fcb.every('00000000-0000-0000-0000-0000003960b1') ELSE fcb.own('00000000-0000-0000-0000-0000003960b1', '00000000-0000-0000-0000-0000003960a3') END);
RESET ROLE;
SELECT fcb.as_user('00000000-0000-0000-0000-0000003960a4'); SET LOCAL ROLE authenticated;
DO $$ BEGIN RAISE NOTICE 'ok: an estimator % the master''s job', fcb.job('00000000-0000-0000-0000-0000003960b1'); END $$;
SELECT fcb.same('an estimator says a day when he reads the job, and only then', fcb.says('00000000-0000-0000-0000-0000003960b1', '2026-11-26', NULL), fcb.may('00000000-0000-0000-0000-0000003960b1'));
SELECT fcb.same('an estimator reads on the same rule', fcb.reads('00000000-0000-0000-0000-0000003960b1'), CASE WHEN fcb.job('00000000-0000-0000-0000-0000003960b1') = 'reads' THEN fcb.every('00000000-0000-0000-0000-0000003960b1') ELSE fcb.own('00000000-0000-0000-0000-0000003960b1', '00000000-0000-0000-0000-0000003960a4') END);
RESET ROLE;

-- 3 · The fences. Each of the three is the master of a job of her own, so nothing but the fence refuses her.
SELECT fcb.as_user('00000000-0000-0000-0000-0000003960a5'); SET LOCAL ROLE authenticated;
SELECT fcb.same('a training account is refused on her own job', fcb.says('00000000-0000-0000-0000-0000003960b5', '2026-11-20', NULL), 'refused');
RESET ROLE;
SELECT fcb.as_user('00000000-0000-0000-0000-0000003960a6'); SET LOCAL ROLE authenticated;
SELECT fcb.same('a twin is refused on her own job', fcb.says('00000000-0000-0000-0000-0000003960b6', '2026-11-20', NULL), 'refused');
RESET ROLE;
SELECT fcb.as_user('00000000-0000-0000-0000-0000003960a7'); SET LOCAL ROLE authenticated;
SELECT fcb.same('a person who left is refused on her own job', fcb.says('00000000-0000-0000-0000-0000003960b7', '2026-11-20', NULL), 'refused');
SELECT fcb.same('and reads no saying on any job', (SELECT count(*)::text FROM public.job_finish_calls), '0');
RESET ROLE;
SELECT fcb.same('the three fenced jobs hold no saying', (SELECT count(*)::text FROM public.job_finish_calls WHERE job_id IN ('00000000-0000-0000-0000-0000003960b5', '00000000-0000-0000-0000-0000003960b6', '00000000-0000-0000-0000-0000003960b7')), '0');

DO $$ BEGIN RAISE NOTICE 'job_finish_calls PASSED'; END $$;
ROLLBACK;
