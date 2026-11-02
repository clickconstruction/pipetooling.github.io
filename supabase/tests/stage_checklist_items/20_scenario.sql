-- Stage checklist items on the job, their gates (punch list #237 PR 1, migration *_stage_checklist_job_items): who adds
-- an item for a job's stage (the office anywhere, a superintendent on their own job in their own name, nobody else), a
-- stage that is not on the job, who reads a job's items, who takes one off (the office, or the adder and only to retire
-- it), the answer kept, the company's rows as they were, and the training and twin fences. Fixtures are written as
-- postgres; presses run as each user; everything rolls back. Raises on the first failed assertion; ends with
-- "stage_checklist_items PASSED". See scripts/pgtest-stage-checklist-items.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa, Cole and Dee are the office (assistant, controller, dev). Sal is a superintendent on job A's team; Sue is a
-- superintendent on no team. Hal is a helper on job A's team; Nan is a helper on no job. Tess is an assistant in
-- training; Tim is an assistant-role twin. Job A and job B each have a Trim Set stage.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002370a1', 'rosa@items.test'),
  ('00000000-0000-0000-0000-0000002370a2', 'cole@items.test'),
  ('00000000-0000-0000-0000-0000002370a3', 'dee@items.test'),
  ('00000000-0000-0000-0000-0000002370a4', 'sal@items.test'),
  ('00000000-0000-0000-0000-0000002370a5', 'sue@items.test'),
  ('00000000-0000-0000-0000-0000002370a6', 'hal@items.test'),
  ('00000000-0000-0000-0000-0000002370a7', 'nan@items.test'),
  ('00000000-0000-0000-0000-0000002370a8', 'tess@items.test'),
  ('00000000-0000-0000-0000-0000002370a9', 'tim@items.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000002370a1', 'rosa@items.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000002370a2', 'cole@items.test', 'Cole Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-0000002370a3', 'dee@items.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000002370a4', 'sal@items.test', 'Sal Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000002370a5', 'sue@items.test', 'Sue Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000002370a6', 'hal@items.test', 'Hal Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000002370a7', 'nan@items.test', 'Nan Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000002370a8', 'tess@items.test', 'Tess Training', 'assistant', true, false),
  ('00000000-0000-0000-0000-0000002370a9', 'tim@items.test', 'Tim Twin', 'assistant', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000002370f9', 'Items Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370a3', '00000000-0000-0000-0000-0000002370f9', 'Items job A', NULL),
  ('00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370a3', '00000000-0000-0000-0000-0000002370f9', 'Items job B', NULL);
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370b1', 'Trim Set'),
  ('00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370b2', 'Trim Set');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370a4'),
  ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370a6');

CREATE SCHEMA sci;
CREATE FUNCTION sci.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement that must run, and one that must be refused with these words in the error.
CREATE FUNCTION sci.runs(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sci.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION sci.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the signed-in person's own read of one question returns: '1' or '0'.
CREATE FUNCTION sci.sees(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.stage_checklist_templates WHERE id = p_id
$$;
-- Behind the gates: a row's standing, its words, and the answers it keeps.
CREATE FUNCTION sci.standing(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT CASE WHEN retired_at IS NULL THEN 'live' ELSE 'retired by ' || coalesce(right(retired_by::text, 2), 'nobody') END
  FROM public.stage_checklist_templates WHERE id = p_id
$$;
CREATE FUNCTION sci.words(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT words FROM public.stage_checklist_templates WHERE id = p_id
$$;
CREATE FUNCTION sci.answers(p_question uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::text FROM public.stage_checklist_answers WHERE question_id = p_question
$$;
GRANT USAGE ON SCHEMA sci TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sci TO authenticated;

-- 1 · The office writes the company's questions; nobody else does.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a1');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Rosa writes a company question', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, words, created_by) VALUES ('00000000-0000-0000-0000-0000002370c1', 'trim_set', 'Did the final water test hold?', '00000000-0000-0000-0000-0000002370a1')$q$);
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Sal writes no company question', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, created_by) VALUES ('trim_set', 'A company question', '00000000-0000-0000-0000-0000002370a4')$q$, 'row-level security');

-- 2 · A superintendent adds on their own job, in their own name, and nowhere else.
SELECT sci.runs('Sal adds on job A', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-0000002370d1', 'trim_set', 'Are the carriers in units 7 and 8 set?', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a4', 'Sal Super')$q$);
SELECT sci.runs('Sal adds a second on job A', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-0000002370d4', 'trim_set', 'Is the pan drain run to the hub?', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a4', 'Sal Super')$q$);
SELECT sci.refused('Sal adds nothing on job B', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('trim_set', 'Not my job', '00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370a4', 'Sal Super')$q$, 'row-level security');
SELECT sci.refused('Sal adds nothing in Rosa''s name', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('trim_set', 'Not my name', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a1', 'Rosa Office')$q$, 'row-level security');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a5');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Sue, on no team, adds nothing on job A', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('trim_set', 'Not on it', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a5', 'Sue Super')$q$, 'row-level security');
RESET ROLE;

-- 3 · The crew answers and does not add, even on the job's team.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a6');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Hal, on the team, adds nothing', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('trim_set', 'A helper''s check', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a6', 'Hal Helper')$q$, 'row-level security');
RESET ROLE;

-- 4 · The office adds on any job.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a2');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Cole adds on job B', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-0000002370d2', 'trim_set', 'Are the hangers at code spacing?', '00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370a2', 'Cole Controller')$q$);
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a3');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Dee adds on job A', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-0000002370d3', 'trim_set', 'Is the water test on?', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a3', 'Dee Dev')$q$);
RESET ROLE;

-- 5 · The stage must be on the job, for the office too, and a job item names both.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a1');
SET LOCAL ROLE authenticated;
SELECT sci.refused('job A with job B''s stage', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by) VALUES ('trim_set', 'The wrong stage', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370a1')$q$, 'That stage is not on this job.');
SELECT sci.refused('a job with no stage', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, created_by) VALUES ('trim_set', 'No stage', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370a1')$q$, 'That stage is not on this job.');
SELECT sci.refused('a stage with no job', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, fixture_id, created_by) VALUES ('trim_set', 'No job', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a1')$q$, 'stage_checklist_templates_job_scope');
SELECT sci.refused('an item moved to another job''s stage', $q$UPDATE public.stage_checklist_templates SET fixture_id = '00000000-0000-0000-0000-0000002370e1' WHERE id = '00000000-0000-0000-0000-0000002370d2'$q$, 'That stage is not on this job.');
RESET ROLE;

-- 6 · Who reads: the company's rows for everyone; a job's items by whoever may stamp the job's stages.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a6');
SET LOCAL ROLE authenticated;
SELECT sci.same('Hal reads the company question', sci.sees('00000000-0000-0000-0000-0000002370c1'), '1');
SELECT sci.same('Hal reads job A''s item', sci.sees('00000000-0000-0000-0000-0000002370d1'), '1');
SELECT sci.same('Hal does not read job B''s item', sci.sees('00000000-0000-0000-0000-0000002370d2'), '0');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a7');
SET LOCAL ROLE authenticated;
SELECT sci.same('Nan reads the company question', sci.sees('00000000-0000-0000-0000-0000002370c1'), '1');
SELECT sci.same('Nan does not read job A''s item', sci.sees('00000000-0000-0000-0000-0000002370d1'), '0');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a5');
SET LOCAL ROLE authenticated;
SELECT sci.same('Sue reads a job''s item, as she may stamp its stages', sci.sees('00000000-0000-0000-0000-0000002370d1'), '1');
RESET ROLE;

-- 7 · Who takes off. Anyone else's press reaches no row.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a5');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Sue presses on Sal''s item', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a5' WHERE id = '00000000-0000-0000-0000-0000002370d1'$q$);
SELECT sci.same('and it stays live', sci.standing('00000000-0000-0000-0000-0000002370d1'), 'live');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a6');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Hal presses on Sal''s item', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a6' WHERE id = '00000000-0000-0000-0000-0000002370d1'$q$);
SELECT sci.same('and it stays live again', sci.standing('00000000-0000-0000-0000-0000002370d1'), 'live');
SELECT sci.runs('Hal answers Sal''s item, on the job''s team', $q$INSERT INTO public.stage_checklist_answers (job_id, fixture_id, question_id, pick, answered_by, answered_by_name, answered_at) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370d1', 'yes', '00000000-0000-0000-0000-0000002370a6', 'Hal Helper', now())$q$);
RESET ROLE;

-- 8 · The adder's one write is the retire: no new words, no move onto a job that is not theirs, no other name.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Sal rewrites no live item', $q$UPDATE public.stage_checklist_templates SET words = 'New words' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$, 'row-level security');
SELECT sci.refused('Sal moves no live item to job B', $q$UPDATE public.stage_checklist_templates SET job_id = '00000000-0000-0000-0000-0000002370b2', fixture_id = '00000000-0000-0000-0000-0000002370e2' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$, 'row-level security');
SELECT sci.refused('Sal retires in nobody else''s name', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a1' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$, 'row-level security');
SELECT sci.runs('Sal takes his own item off', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a4', updated_at = now() WHERE id = '00000000-0000-0000-0000-0000002370d1'$q$);
SELECT sci.same('it reads retired by Sal', sci.standing('00000000-0000-0000-0000-0000002370d1'), 'retired by a4');
SELECT sci.same('its answer is kept', sci.answers('00000000-0000-0000-0000-0000002370d1'), '1');
SELECT sci.refused('Sal brings nothing back', $q$UPDATE public.stage_checklist_templates SET retired_at = NULL, retired_by = NULL WHERE id = '00000000-0000-0000-0000-0000002370d1'$q$, 'row-level security');
RESET ROLE;

-- 9 · The office takes off anyone's item, and keeps the company's rows to itself.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a1');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Rosa takes off Sal''s other item', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a1' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$);
SELECT sci.same('it reads retired by Rosa', sci.standing('00000000-0000-0000-0000-0000002370d4'), 'retired by a1');
SELECT sci.runs('Rosa rewords the company question', $q$UPDATE public.stage_checklist_templates SET words = 'Did the water test hold?' WHERE id = '00000000-0000-0000-0000-0000002370c1'$q$);
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Sal presses on the company question', $q$UPDATE public.stage_checklist_templates SET words = 'Sal''s words' WHERE id = '00000000-0000-0000-0000-0000002370c1'$q$);
SELECT sci.same('and the words stand', sci.words('00000000-0000-0000-0000-0000002370c1'), 'Did the water test hold?');
RESET ROLE;

-- 10 · The fences hold: training mode and a twin write nothing, whatever their role says.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a8');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tess in training adds nothing', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by) VALUES ('trim_set', 'In training', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a8')$q$, 'Read-only (training) mode');
SELECT sci.refused('Tess in training takes nothing off', $q$UPDATE public.stage_checklist_templates SET retired_at = now() WHERE id = '00000000-0000-0000-0000-0000002370d3'$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a9');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tim the twin adds nothing', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by) VALUES ('trim_set', 'A twin''s check', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a9')$q$, 'row-level security');
SELECT sci.runs('Tim the twin presses on Dee''s item', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a9' WHERE id = '00000000-0000-0000-0000-0000002370d3'$q$);
SELECT sci.same('and it stays live', sci.standing('00000000-0000-0000-0000-0000002370d3'), 'live');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'stage_checklist_items PASSED'; END $$;
ROLLBACK;
