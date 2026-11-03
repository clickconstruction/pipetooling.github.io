-- A stage's checklist follows its stage line through a split or a combine (punch list #237, migration
-- *_stage_checklist_rows_follow_their_line). A stage is answered, given job items and skipped; then the job is split and
-- combined, and every row must still stand, unchanged but for its job, on the job its line is on, where that job's sheet
-- reads it. This scenario does not stop at its first miss: it writes down each thing lost and raises at the end with the
-- whole list, so a run without the migration says everything it would lose. Ends with "follow_the_line PASSED". Fixtures are
-- written as postgres; the moves and the late presses run as each user; everything rolls back. See
-- scripts/pgtest-stage-checklist-items.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa is the office, Dee a dev. Sal (superintendent) and Hal (helper) are on job A's team, Cid (helper) on job C's, Nan
-- (helper) on job Z's. Tess is an assistant in training.
--   Job A: Rough In e1, stays on A until the combine. Top Out e2, the split moves it to a new job, B. Trim Set e3, moved
--          by hand to C.
--   Job C: Rough In e9, with its own answer to the question A's Rough In answered.
-- Questions c1 to cd are the company's; d1 to d4 are checks added for job A. Answers are 11 to 1c, skips 21 to 24.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002371a1', 'rosa@follow.test'),
  ('00000000-0000-0000-0000-0000002371a3', 'dee@follow.test'),
  ('00000000-0000-0000-0000-0000002371a4', 'sal@follow.test'),
  ('00000000-0000-0000-0000-0000002371a6', 'hal@follow.test'),
  ('00000000-0000-0000-0000-0000002371a7', 'nan@follow.test'),
  ('00000000-0000-0000-0000-0000002371a8', 'tess@follow.test'),
  ('00000000-0000-0000-0000-0000002371a9', 'cid@follow.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000002371a1', 'rosa@follow.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000002371a3', 'dee@follow.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000002371a4', 'sal@follow.test', 'Sal Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000002371a6', 'hal@follow.test', 'Hal Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000002371a7', 'nan@follow.test', 'Nan Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000002371a8', 'tess@follow.test', 'Tess Training', 'assistant', true, false),
  ('00000000-0000-0000-0000-0000002371a9', 'cid@follow.test', 'Cid Helper', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000002371f9', 'Follow Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id, status) VALUES
  ('00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371a3', '00000000-0000-0000-0000-0000002371f9', 'Follow job A', NULL, 'working'),
  ('00000000-0000-0000-0000-0000002371b3', '00000000-0000-0000-0000-0000002371a3', '00000000-0000-0000-0000-0000002371f9', 'Follow job C', NULL, 'working'),
  ('00000000-0000-0000-0000-0000002371b9', '00000000-0000-0000-0000-0000002371a3', '00000000-0000-0000-0000-0000002371f9', 'Follow job Z', NULL, 'working');
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-0000002371e1', '00000000-0000-0000-0000-0000002371b1', 'Rough In'),
  ('00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371b1', 'Top Out'),
  ('00000000-0000-0000-0000-0000002371e3', '00000000-0000-0000-0000-0000002371b1', 'Trim Set'),
  ('00000000-0000-0000-0000-0000002371e9', '00000000-0000-0000-0000-0000002371b3', 'Rough In');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371a4'),
  ('00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371a6'),
  ('00000000-0000-0000-0000-0000002371b3', '00000000-0000-0000-0000-0000002371a9'),
  ('00000000-0000-0000-0000-0000002371b9', '00000000-0000-0000-0000-0000002371a7');

INSERT INTO public.stage_checklist_templates (id, stage_kind, words, asks_photo) VALUES
  ('00000000-0000-0000-0000-0000002371c1', 'rough_in', 'Is the vent through the roof?', false),
  ('00000000-0000-0000-0000-0000002371c2', 'rough_in', 'Is the sleeve set?', false),
  ('00000000-0000-0000-0000-0000002371c3', 'top_out', 'Did the pressure test hold?', false),
  ('00000000-0000-0000-0000-0000002371c4', 'top_out', 'Is the riser strapped?', true),
  ('00000000-0000-0000-0000-0000002371c5', 'top_out', 'Is the carrier set?', true),
  ('00000000-0000-0000-0000-0000002371c6', 'top_out', 'Is the slab sleeve capped?', false),
  ('00000000-0000-0000-0000-0000002371c7', 'top_out', 'Is the cleanout marked?', false),
  ('00000000-0000-0000-0000-0000002371c8', 'top_out', 'Is the stub out level?', false),
  ('00000000-0000-0000-0000-0000002371ca', 'top_out', 'Is the hanger spaced?', false),
  ('00000000-0000-0000-0000-0000002371cb', 'top_out', 'Is the test gauge off?', false),
  ('00000000-0000-0000-0000-0000002371cc', 'trim_set', 'Are the stops on?', false),
  ('00000000-0000-0000-0000-0000002371cd', 'trim_set', 'Is the cover plate on?', false);
INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name, plan_sheet, why, retired_at, retired_by) VALUES
  ('00000000-0000-0000-0000-0000002371d1', 'rough_in', 'Is the roof jack flashed?', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e1', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000002371d2', 'top_out', 'Are the carriers in units 7 and 8 set?', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', 'P-201 detail 4', 'The slab pours Thursday', NULL, NULL),
  ('00000000-0000-0000-0000-0000002371d3', 'top_out', 'Is the temporary cap off?', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', NULL, NULL, now(), '00000000-0000-0000-0000-0000002371a4'),
  ('00000000-0000-0000-0000-0000002371d4', 'top_out', 'Is the pan drain run to the hub?', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', NULL, NULL, NULL, NULL);

-- The report whose photo answers a question, as Save leaves it.
INSERT INTO public.report_templates (id, name) VALUES ('00000000-0000-0000-0000-0000002371f8', 'Follow bed report');
INSERT INTO public.reports (id, job_ledger_id, template_id, created_by_user_id) VALUES
  ('00000000-0000-0000-0000-0000002371f7', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371f8', '00000000-0000-0000-0000-0000002371a6');
INSERT INTO public.report_photos (id, job_id, report_id, fixture_id, by_user_id, by_name, storage_path) VALUES
  ('00000000-0000-0000-0000-0000002371f6', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371f7', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', '00000000-0000-0000-0000-0000002371b1/00000000-0000-0000-0000-0000002371f6.jpg');

INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, pick, note, answered_by, answered_by_name, answered_at, photo_file_name, photo_taken_at, photo_bytes, photo_storage_path, report_photo_id) VALUES
  ('00000000-0000-0000-0000-000000237111', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e1', '00000000-0000-0000-0000-0000002371c1', 'yes', 'Vent is through', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), NULL, NULL, 0, NULL, NULL),
  ('00000000-0000-0000-0000-000000237112', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371c3', 'yes', 'Held at 60 psi', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), NULL, NULL, 0, NULL, NULL),
  ('00000000-0000-0000-0000-000000237113', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371c4', 'yes', '', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), 'riser.jpg', now(), 1000, '00000000-0000-0000-0000-0000002371b1/00000000-0000-0000-0000-000000237113-1.jpg', NULL),
  ('00000000-0000-0000-0000-000000237114', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371c5', 'no', 'Waiting on the carrier', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), 'carrier.jpg', now(), 1000, NULL, '00000000-0000-0000-0000-0000002371f6'),
  ('00000000-0000-0000-0000-000000237115', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371d2', 'yes', '', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), NULL, NULL, 0, NULL, NULL),
  ('00000000-0000-0000-0000-000000237116', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371d3', 'not_here', '', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), NULL, NULL, 0, NULL, NULL),
  ('00000000-0000-0000-0000-000000237118', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e3', '00000000-0000-0000-0000-0000002371cc', 'yes', '', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), NULL, NULL, 0, NULL, NULL),
  ('00000000-0000-0000-0000-000000237119', '00000000-0000-0000-0000-0000002371b3', '00000000-0000-0000-0000-0000002371e9', '00000000-0000-0000-0000-0000002371c1', 'no', 'Vent is short', '00000000-0000-0000-0000-0000002371a9', 'Cid Helper', now(), NULL, NULL, 0, NULL, NULL),
  ('00000000-0000-0000-0000-00000023711a', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371d4', 'yes', '', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now(), NULL, NULL, 0, NULL, NULL);

INSERT INTO public.stage_checklist_skips (id, job_id, fixture_id, question_id, why, skipped_by, skipped_by_name, put_back_at, put_back_by) VALUES
  ('00000000-0000-0000-0000-000000237121', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e1', '00000000-0000-0000-0000-0000002371c2', 'No sleeve on this job', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', NULL, NULL),
  ('00000000-0000-0000-0000-000000237122', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371c6', 'No slab on this stage', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', NULL, NULL),
  ('00000000-0000-0000-0000-000000237123', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371c7', 'Skipped by mistake', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', now(), '00000000-0000-0000-0000-0000002371a4'),
  ('00000000-0000-0000-0000-000000237124', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e3', '00000000-0000-0000-0000-0000002371cd', 'Plates come with the owner', '00000000-0000-0000-0000-0000002371a4', 'Sal Super', NULL, NULL);

CREATE SCHEMA sfl;
CREATE TABLE sfl.lost (n serial PRIMARY KEY, what text NOT NULL);
CREATE TABLE sfl.kept (kind text NOT NULL, id uuid NOT NULL, label text NOT NULL, body jsonb NOT NULL);

-- An assertion writes down a miss and goes on; the last statement raises with the whole list.
CREATE FUNCTION sfl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    INSERT INTO sfl.lost (what) VALUES (format('%s: got %s, want %s', label, coalesce(got, 'nothing'), coalesce(want, 'nothing')));
    RAISE NOTICE 'LOST: %: got %, want %', label, got, want;
    RETURN;
  END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sfl.miss(label text, why text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO sfl.lost (what) VALUES (format('%s: %s', label, why));
  RAISE NOTICE 'LOST: %: %', label, why;
END $$;
-- A statement that must run, and one that must be refused with these words in the error. Both run as the caller.
CREATE FUNCTION sfl.runs(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    PERFORM sfl.miss(label, 'it was refused, ' || SQLERRM);
    RETURN;
  END;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sfl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN
      PERFORM sfl.miss(label, 'it was refused for another reason, ' || SQLERRM);
    ELSE
      RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    END IF;
    RETURN;
  END;
  PERFORM sfl.miss(label, 'it was allowed');
END $$;
CREATE FUNCTION sfl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;

-- What the signed-in person's sheet reads for a job, by the filters the client's reads use.
CREATE FUNCTION sfl.sheet(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT format('answers %s, items %s, skips %s',
    (SELECT count(*) FROM public.stage_checklist_answers WHERE job_id = p_job),
    (SELECT count(*) FROM public.stage_checklist_templates WHERE job_id = p_job AND retired_at IS NULL),
    (SELECT count(*) FROM public.stage_checklist_skips WHERE job_id = p_job AND put_back_at IS NULL))
$$;

-- Behind the gates. Each row as it stands, its job left out, and a record of them all to compare against.
CREATE FUNCTION sfl.row_now(p_kind text, p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT to_jsonb(a) - 'job_id' FROM public.stage_checklist_answers a WHERE p_kind = 'answer' AND a.id = p_id
  UNION ALL SELECT to_jsonb(t) - 'job_id' FROM public.stage_checklist_templates t WHERE p_kind = 'question' AND t.id = p_id
  UNION ALL SELECT to_jsonb(s) - 'job_id' FROM public.stage_checklist_skips s WHERE p_kind = 'skip' AND s.id = p_id
$$;
CREATE FUNCTION sfl.keep() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM sfl.kept WHERE true;
  INSERT INTO sfl.kept (kind, id, label, body)
    SELECT 'answer', a.id, 'the answer to "' || q.words || '" on ' || f.name, to_jsonb(a) - 'job_id'
      FROM public.stage_checklist_answers a
      JOIN public.stage_checklist_templates q ON q.id = a.question_id
      JOIN public.jobs_ledger_fixtures f ON f.id = a.fixture_id
    UNION ALL
    SELECT 'question', t.id, CASE WHEN t.job_id IS NULL THEN 'the company''s "' ELSE 'the job item "' END || t.words || '"', to_jsonb(t) - 'job_id'
      FROM public.stage_checklist_templates t
    UNION ALL
    SELECT 'skip', s.id, 'the skip of "' || q.words || '" on ' || f.name || CASE WHEN s.put_back_at IS NULL THEN '' ELSE ', put back' END, to_jsonb(s) - 'job_id'
      FROM public.stage_checklist_skips s
      JOIN public.stage_checklist_templates q ON q.id = s.question_id
      JOIN public.jobs_ledger_fixtures f ON f.id = s.fixture_id;
$$;
-- Every row in the record that is missing, or changed in anything but its job.
CREATE FUNCTION sfl.gone() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(k.label, '; ' ORDER BY k.label), 'nothing')
  FROM sfl.kept k
  WHERE sfl.row_now(k.kind, k.id) IS DISTINCT FROM k.body
$$;
-- Every row whose job is not its line's job: the new job's sheet never reads it, and its old job's delete takes it.
CREATE FUNCTION sfl.astray() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(x.label, '; ' ORDER BY x.label), 'nothing') FROM (
    SELECT 'the answer to "' || q.words || '" on ' || f.name AS label
      FROM public.stage_checklist_answers a
      JOIN public.jobs_ledger_fixtures f ON f.id = a.fixture_id
      JOIN public.stage_checklist_templates q ON q.id = a.question_id
      WHERE a.job_id IS DISTINCT FROM f.job_id
    UNION ALL
    SELECT 'the job item "' || t.words || '" on ' || f.name
      FROM public.stage_checklist_templates t
      JOIN public.jobs_ledger_fixtures f ON f.id = t.fixture_id
      WHERE t.job_id IS DISTINCT FROM f.job_id
    UNION ALL
    SELECT 'the skip of "' || q.words || '" on ' || f.name
      FROM public.stage_checklist_skips s
      JOIN public.jobs_ledger_fixtures f ON f.id = s.fixture_id
      JOIN public.stage_checklist_templates q ON q.id = s.question_id
      WHERE s.job_id IS DISTINCT FROM f.job_id
  ) x
$$;
CREATE FUNCTION sfl.job_of_line(p_line uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT job_id::text FROM public.jobs_ledger_fixtures WHERE id = p_line
$$;
CREATE FUNCTION sfl.job_of_answer(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT job_id::text FROM public.stage_checklist_answers WHERE id = p_id
$$;
CREATE FUNCTION sfl.job_exists(p_job uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT count(*)::text FROM public.jobs_ledger WHERE id = p_job
$$;
GRANT USAGE ON SCHEMA sfl TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sfl TO authenticated;

-- 0 · The second run: the trigger stands once, nobody calls its function, and the rows an earlier split stranded rejoined
--     their line (30_stranded_rows.sql), still holding what they held.
SELECT sfl.same('one trigger on the stage lines, after the second run', (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'jobs_ledger_fixtures_carry_checklist' AND NOT tgisinternal), '1');
SELECT sfl.same('one trigger on the answers, after the second run', (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'stage_checklist_answers_on_stage_job' AND NOT tgisinternal), '1');
SELECT sfl.same('nobody signed in calls the carrying function', has_function_privilege('authenticated', 'public.jobs_ledger_fixture_carries_checklist()', 'EXECUTE')::text, 'false');
SELECT sfl.same('nobody signed in calls the answer''s function', has_function_privilege('authenticated', 'public.stage_checklist_answer_on_stage_job()', 'EXECUTE')::text, 'false');
SELECT sfl.same('a stranded answer rejoined its line', sfl.job_of_answer('00000000-0000-0000-0000-000000237211'), '00000000-0000-0000-0000-0000002372b2');
SELECT sfl.same('and it holds its note', (SELECT note FROM public.stage_checklist_answers WHERE id = '00000000-0000-0000-0000-000000237211'), 'Stranded note');
SELECT sfl.same('a stranded job item rejoined its line', (SELECT job_id::text FROM public.stage_checklist_templates WHERE id = '00000000-0000-0000-0000-0000002372d1'), '00000000-0000-0000-0000-0000002372b2');
SELECT sfl.same('a stranded skip rejoined its line', (SELECT job_id::text FROM public.stage_checklist_skips WHERE id = '00000000-0000-0000-0000-000000237221'), '00000000-0000-0000-0000-0000002372b2');

-- 1 · One job item goes onto the company's list first, so the source line (promoted_from) has something to lose.
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a1');
SET LOCAL ROLE authenticated;
SELECT (public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002371d4')).id AS promoted_id \gset
RESET ROLE;
SELECT sfl.keep();
SELECT sfl.same('before the moves: job A reads its own', sfl.sheet('00000000-0000-0000-0000-0000002371b1'), 'answers 8, items 2, skips 3');
SELECT sfl.same('nothing is astray before the moves', sfl.astray(), 'nothing');

-- 2 · Training mode moves nothing.
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a8');
SET LOCAL ROLE authenticated;
SELECT public.split_job_ledger_fixtures_to_new_job('00000000-0000-0000-0000-0000002371b1', ARRAY['00000000-0000-0000-0000-0000002371e2']::uuid[], 'FOLLOW-T', 'Follow job T', '3 Follow St') ->> 'ok' AS tess_ok \gset
RESET ROLE;
SELECT sfl.same('Tess in training splits nothing', :'tess_ok', 'false');
SELECT sfl.same('and the Top Out stays on job A', sfl.job_of_line('00000000-0000-0000-0000-0000002371e2'), '00000000-0000-0000-0000-0000002371b1');

-- 3 · The split. The Top Out and everything on it go to the new job, and the rest stays.
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a3');
SET LOCAL ROLE authenticated;
SELECT public.split_job_ledger_fixtures_to_new_job('00000000-0000-0000-0000-0000002371b1', ARRAY['00000000-0000-0000-0000-0000002371e2']::uuid[], 'FOLLOW-B', 'Follow job B', '2 Follow St') AS split_reply \gset
RESET ROLE;
SELECT sfl.same('the split says ok', coalesce(:'split_reply'::jsonb ->> 'error', :'split_reply'::jsonb ->> 'ok'), 'true');
SELECT :'split_reply'::jsonb ->> 'new_job_id' AS job_b \gset
SELECT sfl.same('the Top Out is on the new job', sfl.job_of_line('00000000-0000-0000-0000-0000002371e2'), :'job_b');
SELECT sfl.same('after the split: nothing is gone or changed', sfl.gone(), 'nothing');
SELECT sfl.same('after the split: nothing is astray', sfl.astray(), 'nothing');
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a6');
SET LOCAL ROLE authenticated;
SELECT sfl.same('after the split: Hal''s sheet on the new job reads the Top Out''s rows', sfl.sheet(:'job_b'), 'answers 6, items 1, skips 1');
SELECT sfl.same('after the split: Hal''s sheet on job A reads what stayed', sfl.sheet('00000000-0000-0000-0000-0000002371b1'), 'answers 2, items 1, skips 2');
RESET ROLE;

-- 4 · A sheet opened before the split still names job A. Its press lands on the line's job; an outsider's stays out.
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a6');
SET LOCAL ROLE authenticated;
SELECT sfl.runs('Hal''s sheet, opened before the split, answers the moved stage', $q$INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, pick, answered_by, answered_by_name, answered_at) VALUES ('00000000-0000-0000-0000-000000237117', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371c8', 'yes', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now())$q$);
SELECT sfl.runs('Hal''s sheet writes job A over an answer', $q$UPDATE public.stage_checklist_answers SET job_id = '00000000-0000-0000-0000-0000002371b1' WHERE id = '00000000-0000-0000-0000-000000237112'$q$);
RESET ROLE;
SELECT sfl.same('the late press landed on the line''s job', sfl.job_of_answer('00000000-0000-0000-0000-000000237117'), :'job_b');
SELECT sfl.same('the answer stayed on the line''s job', sfl.job_of_answer('00000000-0000-0000-0000-000000237112'), :'job_b');
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a7');
SET LOCAL ROLE authenticated;
SELECT sfl.refused('Nan, naming job Z, answers no stage on another job', $q$INSERT INTO public.stage_checklist_answers (job_id, fixture_id, question_id, pick) VALUES ('00000000-0000-0000-0000-0000002371b9', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371ca', 'yes')$q$, 'row-level security');
RESET ROLE;
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a4');
SET LOCAL ROLE authenticated;
SELECT sfl.refused('Sal''s sheet adds no check naming the old job', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('top_out', 'A late check', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371a4', 'Sal Super')$q$, 'That stage is not on this job.');
SELECT sfl.refused('Sal''s sheet skips nothing naming the old job', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371ca', 'A late skip', '00000000-0000-0000-0000-0000002371a4', 'Sal Super')$q$, 'That stage is not on this job.');
RESET ROLE;
SELECT sfl.keep();

-- 5 · Any door: the office moves a line by hand. Its gates would refuse the skip's job_id, so the carrying runs as the owner.
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a1');
SET LOCAL ROLE authenticated;
SELECT sfl.runs('Rosa moves the Trim Set to job C by hand', $q$UPDATE public.jobs_ledger_fixtures SET job_id = '00000000-0000-0000-0000-0000002371b3' WHERE id = '00000000-0000-0000-0000-0000002371e3'$q$);
RESET ROLE;
SELECT sfl.same('the Trim Set is on job C', sfl.job_of_line('00000000-0000-0000-0000-0000002371e3'), '00000000-0000-0000-0000-0000002371b3');
SELECT sfl.same('after the hand move: nothing is gone or changed', sfl.gone(), 'nothing');
SELECT sfl.same('after the hand move: nothing is astray', sfl.astray(), 'nothing');

-- 6 · The first combine, A into C. A's delete takes nothing with it. The report and its photo go to C, and the answer on
--     the new job that the photo answers keeps it.
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a3');
SET LOCAL ROLE authenticated;
SELECT public.migrate_job_ledger_costs_and_delete('00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371b3') AS combine_a_reply \gset
RESET ROLE;
SELECT sfl.same('combining A into C says ok', coalesce(:'combine_a_reply'::jsonb ->> 'error', :'combine_a_reply'::jsonb ->> 'ok'), 'true');
SELECT sfl.same('job A is gone', sfl.job_exists('00000000-0000-0000-0000-0000002371b1'), '0');
SELECT sfl.same('its Rough In is on job C', sfl.job_of_line('00000000-0000-0000-0000-0000002371e1'), '00000000-0000-0000-0000-0000002371b3');
SELECT sfl.same('after the first combine: nothing is gone or changed', sfl.gone(), 'nothing');
SELECT sfl.same('after the first combine: nothing is astray', sfl.astray(), 'nothing');
SELECT sfl.same('the report photo went with its report', (SELECT job_id::text FROM public.report_photos WHERE id = '00000000-0000-0000-0000-0000002371f6'), '00000000-0000-0000-0000-0000002371b3');
SELECT sfl.same('the answer it answers still names it', (SELECT report_photo_id::text FROM public.stage_checklist_answers WHERE id = '00000000-0000-0000-0000-000000237114'), '00000000-0000-0000-0000-0000002371f6');
SELECT sfl.same('two Rough Ins, one question, two answers', (SELECT count(*)::text FROM public.stage_checklist_answers WHERE question_id = '00000000-0000-0000-0000-0000002371c1' AND job_id = '00000000-0000-0000-0000-0000002371b3'), '2');
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a9');
SET LOCAL ROLE authenticated;
SELECT sfl.same('after the first combine: Cid''s sheet on job C reads its rows', sfl.sheet('00000000-0000-0000-0000-0000002371b3'), 'answers 3, items 1, skips 2');
RESET ROLE;
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a6');
SET LOCAL ROLE authenticated;
SELECT sfl.same('after the first combine: Hal, off job A''s team, reads job C''s rows too', sfl.sheet('00000000-0000-0000-0000-0000002371b3'), 'answers 3, items 1, skips 2');
SELECT sfl.same('and the new job still reads the Top Out''s rows', sfl.sheet(:'job_b'), 'answers 7, items 1, skips 1');
RESET ROLE;

-- 7 · The second combine, the new job into C. Everything is on one job, nothing lost, and a sheet still naming job A,
--     deleted, lands its press on the line's job.
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a3');
SET LOCAL ROLE authenticated;
SELECT public.migrate_job_ledger_costs_and_delete(:'job_b', '00000000-0000-0000-0000-0000002371b3') AS combine_b_reply \gset
RESET ROLE;
SELECT sfl.same('combining the new job into C says ok', coalesce(:'combine_b_reply'::jsonb ->> 'error', :'combine_b_reply'::jsonb ->> 'ok'), 'true');
SELECT sfl.same('the new job is gone', sfl.job_exists(:'job_b'), '0');
SELECT sfl.same('the Top Out is on job C', sfl.job_of_line('00000000-0000-0000-0000-0000002371e2'), '00000000-0000-0000-0000-0000002371b3');
SELECT sfl.same('after the second combine: nothing is gone or changed', sfl.gone(), 'nothing');
SELECT sfl.same('after the second combine: nothing is astray', sfl.astray(), 'nothing');
SELECT sfl.same('the promoted question still says which job item it came from', (SELECT promoted_from::text FROM public.stage_checklist_templates WHERE id = :'promoted_id'), '00000000-0000-0000-0000-0000002371d4');
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a9');
SET LOCAL ROLE authenticated;
SELECT sfl.same('after the second combine: Cid''s sheet on job C reads it all', sfl.sheet('00000000-0000-0000-0000-0000002371b3'), 'answers 10, items 2, skips 3');
RESET ROLE;
SELECT sfl.as_user('00000000-0000-0000-0000-0000002371a6');
SET LOCAL ROLE authenticated;
SELECT sfl.runs('Hal''s sheet, naming the deleted job A, answers the stage', $q$INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, pick, answered_by, answered_by_name, answered_at) VALUES ('00000000-0000-0000-0000-00000023711c', '00000000-0000-0000-0000-0000002371b1', '00000000-0000-0000-0000-0000002371e2', '00000000-0000-0000-0000-0000002371cb', 'yes', '00000000-0000-0000-0000-0000002371a6', 'Hal Helper', now())$q$);
RESET ROLE;
SELECT sfl.same('that press landed on job C', sfl.job_of_answer('00000000-0000-0000-0000-00000023711c'), '00000000-0000-0000-0000-0000002371b3');

-- 8 · The sweeps still reach the moved rows: the waiting shot names a job that exists, and a report photo filed after the
--     combine reaches the answer it answers.
SELECT sfl.same('the waiting shot''s job exists, so the sweep can file it', (SELECT count(*)::text FROM public.stage_checklist_answers a JOIN public.jobs_ledger j ON j.id = a.job_id WHERE a.id = '00000000-0000-0000-0000-000000237113' AND a.photo_storage_path IS NOT NULL), '1');
UPDATE public.report_photos SET drive_file_id = 'drive-carrier', filed_at = now() WHERE id = '00000000-0000-0000-0000-0000002371f6';
SELECT sfl.same('the report photo, filed, reads filed on the answer', (SELECT photo_drive_file_id FROM public.stage_checklist_answers WHERE id = '00000000-0000-0000-0000-000000237114'), 'drive-carrier');

DO $$
DECLARE
  v_lost text;
BEGIN
  SELECT string_agg(what, E'\n' ORDER BY n) INTO v_lost FROM sfl.lost;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION E'What a split or a combine lost:\n%', v_lost;
  END IF;
  RAISE NOTICE 'follow_the_line PASSED';
END $$;
ROLLBACK;
