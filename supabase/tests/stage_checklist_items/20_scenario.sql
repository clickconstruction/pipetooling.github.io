-- Stage checklist items on the job, their gates (punch list #237 PR 1, migration *_stage_checklist_job_items): who adds
-- an item for a job's stage (the office anywhere, a superintendent on their own job in their own name, nobody else), a
-- stage that is not on the job, who reads a job's items, who takes one off (the office, or the adder and only to retire
-- it), the answer kept, the company's rows as they were, and the training and twin fences. What the walks added (PR 1b,
-- migration *_stage_checklist_skips_and_authors): the estimator as author on the jobs he priced, the order of a stage's
-- own checks, a company question skipped on one job and put back, and a job item promoted to the company's list with its
-- answer. Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on the first failed
-- assertion; ends with "stage_checklist_items PASSED". See scripts/pgtest-stage-checklist-items.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa, Cole and Dee are the office (assistant, controller, dev). Sal is a superintendent on job A's team; Sue is a
-- superintendent on no team. Hal is a helper on job A's team; Nan is a helper on no job. Tess is an assistant in
-- training; Tim is an assistant-role twin. Ed is the estimator who priced job A's bid; Eve is an estimator who did not.
-- Job A and job B each have a Trim Set stage.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002370a1', 'rosa@items.test'),
  ('00000000-0000-0000-0000-0000002370a2', 'cole@items.test'),
  ('00000000-0000-0000-0000-0000002370a3', 'dee@items.test'),
  ('00000000-0000-0000-0000-0000002370a4', 'sal@items.test'),
  ('00000000-0000-0000-0000-0000002370a5', 'sue@items.test'),
  ('00000000-0000-0000-0000-0000002370a6', 'hal@items.test'),
  ('00000000-0000-0000-0000-0000002370a7', 'nan@items.test'),
  ('00000000-0000-0000-0000-0000002370a8', 'tess@items.test'),
  ('00000000-0000-0000-0000-0000002370a9', 'tim@items.test'),
  ('00000000-0000-0000-0000-0000002370aa', 'ed@items.test'),
  ('00000000-0000-0000-0000-0000002370ab', 'eve@items.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000002370a1', 'rosa@items.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000002370a2', 'cole@items.test', 'Cole Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-0000002370a3', 'dee@items.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000002370a4', 'sal@items.test', 'Sal Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000002370a5', 'sue@items.test', 'Sue Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000002370a6', 'hal@items.test', 'Hal Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000002370a7', 'nan@items.test', 'Nan Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000002370a8', 'tess@items.test', 'Tess Training', 'assistant', true, false),
  ('00000000-0000-0000-0000-0000002370a9', 'tim@items.test', 'Tim Twin', 'assistant', false, true),
  ('00000000-0000-0000-0000-0000002370aa', 'ed@items.test', 'Ed Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000002370ab', 'eve@items.test', 'Eve Estimator', 'estimator', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000002370f9', 'Items Bed Work');
-- Ed priced job A's bid. Job B's bid is Eve's, so an estimator on a bid is held to that bid's job.
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name) VALUES
  ('00000000-0000-0000-0000-0000002370f1', '00000000-0000-0000-0000-0000002370a1', '00000000-0000-0000-0000-0000002370aa', '00000000-0000-0000-0000-0000002370f9', 'Items bid A'),
  ('00000000-0000-0000-0000-0000002370f2', '00000000-0000-0000-0000-0000002370a1', '00000000-0000-0000-0000-0000002370ab', '00000000-0000-0000-0000-0000002370f9', 'Items bid B');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id, bid_id) VALUES
  ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370a3', '00000000-0000-0000-0000-0000002370f9', 'Items job A', NULL, '00000000-0000-0000-0000-0000002370f1'),
  ('00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370a3', '00000000-0000-0000-0000-0000002370f9', 'Items job B', NULL, '00000000-0000-0000-0000-0000002370f2');
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
-- Behind the gates, for PR 1b: a row's place and plan sheet, a stage's skips (the live ones and every row), and the company's
-- row a job item was promoted to: its id, what it carries, and the answers it holds.
CREATE FUNCTION sci.place(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT sort_order::text FROM public.stage_checklist_templates WHERE id = p_id
$$;
CREATE FUNCTION sci.sheet_and_why(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(plan_sheet, '-') || ' / ' || coalesce(why, '-') FROM public.stage_checklist_templates WHERE id = p_id
$$;
CREATE FUNCTION sci.live_skips(p_fixture uuid, p_question uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::text FROM public.stage_checklist_skips WHERE fixture_id = p_fixture AND question_id = p_question AND put_back_at IS NULL
$$;
CREATE FUNCTION sci.skip_rows(p_fixture uuid, p_question uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::text FROM public.stage_checklist_skips WHERE fixture_id = p_fixture AND question_id = p_question
$$;
CREATE FUNCTION sci.company_row(p_item uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.stage_checklist_templates WHERE promoted_from = p_item
$$;
CREATE FUNCTION sci.company_carries(p_item uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT words || ' / photo ' || asks_photo::text || ' / job ' || coalesce(job_id::text, 'none') || ' / stage ' || coalesce(fixture_id::text, 'none') || ' / ' || coalesce(plan_sheet, '-') || ' / ' || coalesce(why, '-') || ' / by ' || right(created_by::text, 2)
  FROM public.stage_checklist_templates WHERE promoted_from = p_item
$$;
-- What the signed-in person's own read of one skip returns: '1' or '0'.
CREATE FUNCTION sci.sees_skip(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.stage_checklist_skips WHERE id = p_id
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
SELECT sci.refused('Sal rewrites no live item', $q$UPDATE public.stage_checklist_templates SET words = 'New words' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$, 'only takes it off');
SELECT sci.refused('Sal moves no live item to job B', $q$UPDATE public.stage_checklist_templates SET job_id = '00000000-0000-0000-0000-0000002370b2', fixture_id = '00000000-0000-0000-0000-0000002370e2' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$, 'only takes it off');
SELECT sci.refused('Sal''s retire rewrites nothing in the same press', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a4', words = 'New words' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$, 'only takes it off');
SELECT sci.refused('Sal retires in nobody else''s name', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a1' WHERE id = '00000000-0000-0000-0000-0000002370d4'$q$, 'row-level security');
SELECT sci.runs('Sal takes his own item off', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370a4', updated_at = now() WHERE id = '00000000-0000-0000-0000-0000002370d1'$q$);
SELECT sci.same('it reads retired by Sal', sci.standing('00000000-0000-0000-0000-0000002370d1'), 'retired by a4');
SELECT sci.same('its answer is kept', sci.answers('00000000-0000-0000-0000-0000002370d1'), '1');
SELECT sci.runs('Sal presses to bring it back', $q$UPDATE public.stage_checklist_templates SET retired_at = NULL, retired_by = NULL WHERE id = '00000000-0000-0000-0000-0000002370d1'$q$);
SELECT sci.same('and it stays retired', sci.standing('00000000-0000-0000-0000-0000002370d1'), 'retired by a4');
SELECT sci.runs('Sal presses on the words of his retired item', $q$UPDATE public.stage_checklist_templates SET words = 'Other words' WHERE id = '00000000-0000-0000-0000-0000002370d1'$q$);
SELECT sci.same('and they stand, over the answer it keeps', sci.words('00000000-0000-0000-0000-0000002370d1'), 'Are the carriers in units 7 and 8 set?');
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

-- 11 · Who authors: the office anywhere, a superintendent on their own job, an estimator on a job they priced, never a twin.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a1');
SET LOCAL ROLE authenticated;
SELECT sci.same('Rosa authors on job A', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b1')::text, 'true');
SELECT sci.same('Rosa authors on job B', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b2')::text, 'true');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.same('Sal authors on his own job', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b1')::text, 'true');
SELECT sci.same('and not on job B', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b2')::text, 'false');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a5');
SET LOCAL ROLE authenticated;
SELECT sci.same('Sue, on no team, authors nowhere', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b1')::text, 'false');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a6');
SET LOCAL ROLE authenticated;
SELECT sci.same('Hal, on the team, does not author', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b1')::text, 'false');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a9');
SET LOCAL ROLE authenticated;
SELECT sci.same('Tim the twin does not author, whatever his role', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b1')::text, 'false');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370ab');
SET LOCAL ROLE authenticated;
SELECT sci.same('Eve authors on the job she priced', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b2')::text, 'true');
SELECT sci.same('and not on job A', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b1')::text, 'false');
SELECT sci.refused('Eve adds nothing on job A', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('trim_set', 'Not my bid', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370ab', 'Eve Estimator')$q$, 'row-level security');
RESET ROLE;

-- 12 · The estimator adds on the job he priced, in his own name, with the plan sheet and the why, and takes his own off.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370aa');
SET LOCAL ROLE authenticated;
SELECT sci.same('Ed authors on the job he priced', public.stage_checklist_may_author('00000000-0000-0000-0000-0000002370b1')::text, 'true');
SELECT sci.runs('Ed adds on job A with a plan sheet and a why', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, sort_order, words, job_id, fixture_id, created_by, created_by_name, plan_sheet, why) VALUES ('00000000-0000-0000-0000-0000002370d5', 'trim_set', 1, 'Is the riser where P-201 shows it?', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator', 'P-201 detail 4', 'The slab pours Thursday')$q$);
SELECT sci.same('the row keeps them', sci.sheet_and_why('00000000-0000-0000-0000-0000002370d5'), 'P-201 detail 4 / The slab pours Thursday');
SELECT sci.same('Ed reads what he added', sci.sees('00000000-0000-0000-0000-0000002370d5'), '1');
SELECT sci.runs('Ed adds a second', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, sort_order, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-0000002370d6', 'trim_set', 2, 'Is the vent through the roof?', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator')$q$);
SELECT sci.runs('Ed adds one to take off', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-0000002370d8', 'trim_set', 'A check he thinks better of', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator')$q$);
SELECT sci.runs('Ed takes his own off', $q$UPDATE public.stage_checklist_templates SET retired_at = now(), retired_by = '00000000-0000-0000-0000-0000002370aa' WHERE id = '00000000-0000-0000-0000-0000002370d8'$q$);
SELECT sci.same('it reads retired by Ed', sci.standing('00000000-0000-0000-0000-0000002370d8'), 'retired by aa');
SELECT sci.refused('Ed adds nothing on job B', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('trim_set', 'Not my bid', '00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator')$q$, 'row-level security');
SELECT sci.refused('Ed adds nothing in Rosa''s name', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('trim_set', 'Not my name', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a1', 'Rosa Office')$q$, 'row-level security');
SELECT sci.refused('Ed writes no company question', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, created_by) VALUES ('trim_set', 'A company question', '00000000-0000-0000-0000-0000002370aa')$q$, 'row-level security');
SELECT sci.refused('Ed rewrites no live item, even his own', $q$UPDATE public.stage_checklist_templates SET words = 'New words' WHERE id = '00000000-0000-0000-0000-0000002370d5'$q$, 'only takes it off');
SELECT sci.refused('a plan sheet over its length', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, plan_sheet) VALUES ('trim_set', 'Too long', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370aa', repeat('x', 41))$q$, 'stage_checklist_templates_plan_sheet_check');
SELECT sci.refused('a why over its length', $q$INSERT INTO public.stage_checklist_templates (stage_kind, words, job_id, fixture_id, created_by, why) VALUES ('trim_set', 'Too long', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370aa', repeat('x', 81))$q$, 'stage_checklist_templates_why_check');
RESET ROLE;

-- 13 · The order of a stage's own checks: whoever authors on the job, whoever added them, in one call.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.same('Sal puts three checks in order, two of them Ed''s and one Dee''s', public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d6', '00000000-0000-0000-0000-0000002370d5', '00000000-0000-0000-0000-0000002370d3']::uuid[])::text, '3');
SELECT sci.same('the first', sci.place('00000000-0000-0000-0000-0000002370d6'), '1');
SELECT sci.same('the second', sci.place('00000000-0000-0000-0000-0000002370d5'), '2');
SELECT sci.same('the third', sci.place('00000000-0000-0000-0000-0000002370d3'), '3');
SELECT sci.same('a retired check keeps its place, off the count', sci.place('00000000-0000-0000-0000-0000002370d4'), '0');
SELECT sci.same('the same order writes nothing', public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d6', '00000000-0000-0000-0000-0000002370d5', '00000000-0000-0000-0000-0000002370d3']::uuid[])::text, '0');
-- A list read a moment ago: it names one of the three and a check on another job. The named one leads, the rest keep their
-- order after it, and the other job's check does not move.
SELECT sci.same('a stale list moves what it names and loses nothing', public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d3', '00000000-0000-0000-0000-0000002370d2']::uuid[])::text, '3');
SELECT sci.same('it leads', sci.place('00000000-0000-0000-0000-0000002370d3'), '1');
SELECT sci.same('then the first', sci.place('00000000-0000-0000-0000-0000002370d6'), '2');
SELECT sci.same('then the second', sci.place('00000000-0000-0000-0000-0000002370d5'), '3');
SELECT sci.same('job B''s check stands', sci.place('00000000-0000-0000-0000-0000002370d2'), '0');
SELECT sci.refused('Sal moves nothing on job B', $q$SELECT public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e2', ARRAY['00000000-0000-0000-0000-0000002370d2']::uuid[])$q$, 'moves a check');
SELECT sci.refused('Sal moves nothing on a stage that is on no job', $q$SELECT public.reorder_stage_checklist_items('00000000-0000-0000-0000-00000023700e', ARRAY[]::uuid[])$q$, 'That stage is not on a job.');
SELECT sci.runs('Sal writes no order by hand', $q$UPDATE public.stage_checklist_templates SET sort_order = 9 WHERE id = '00000000-0000-0000-0000-0000002370d5'$q$);
SELECT sci.same('that press reaches no row', sci.place('00000000-0000-0000-0000-0000002370d5'), '3');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370aa');
SET LOCAL ROLE authenticated;
SELECT sci.same('Ed moves on the job he priced, writing only what changed', public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d5', '00000000-0000-0000-0000-0000002370d6', '00000000-0000-0000-0000-0000002370d3']::uuid[])::text, '2');
SELECT sci.refused('Ed writes no order by hand, even on his own', $q$UPDATE public.stage_checklist_templates SET sort_order = 9 WHERE id = '00000000-0000-0000-0000-0000002370d5'$q$, 'only takes it off');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370ab');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Eve moves nothing on job A', $q$SELECT public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d3']::uuid[])$q$, 'moves a check');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a6');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Hal moves nothing', $q$SELECT public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d3']::uuid[])$q$, 'moves a check');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a8');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tess in training moves nothing', $q$SELECT public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d3']::uuid[])$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a9');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tim the twin moves nothing', $q$SELECT public.reorder_stage_checklist_items('00000000-0000-0000-0000-0000002370e1', ARRAY['00000000-0000-0000-0000-0000002370d3']::uuid[])$q$, 'moves a check');
RESET ROLE;

-- 14 · A company question skipped on one job: an author's press, in their own name, with a reason, on a company question.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Sal skips the company question on his job', $q$INSERT INTO public.stage_checklist_skips (id, job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370c7', '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1', 'Slab on grade', '00000000-0000-0000-0000-0000002370a4', 'Sal Super')$q$);
SELECT sci.same('the skip is live', sci.live_skips('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1'), '1');
SELECT sci.same('job B''s stage is not touched', sci.live_skips('00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370c1'), '0');
SELECT sci.same('the company''s question stands', sci.standing('00000000-0000-0000-0000-0000002370c1'), 'live');
SELECT sci.refused('Sal skips nothing on job B', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370c1', 'Not my job', '00000000-0000-0000-0000-0000002370a4', 'Sal Super')$q$, 'row-level security');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370aa');
SET LOCAL ROLE authenticated;
SELECT sci.refused('a second live skip on one stage', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1', 'Again', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator')$q$, 'stage_checklist_skips_one_live_idx');
SELECT sci.refused('no skip in someone else''s name', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1', 'Not my name', '00000000-0000-0000-0000-0000002370a4', 'Sal Super')$q$, 'row-level security');
SELECT sci.refused('no skip without its reason', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1', '  ', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator')$q$, 'stage_checklist_skips_why_check');
SELECT sci.refused('no skip of a check added for the job', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370d5', 'A job item', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator')$q$, 'Only a question on the company''s list is skipped on a job.');
SELECT sci.refused('no skip on a stage that is not on the job', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370c1', 'Wrong stage', '00000000-0000-0000-0000-0000002370aa', 'Ed Estimator')$q$, 'That stage is not on this job.');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a6');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Hal, on the team, skips nothing', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1', 'A helper''s skip', '00000000-0000-0000-0000-0000002370a6', 'Hal Helper')$q$, 'row-level security');
SELECT sci.same('Hal reads the skip, on the job''s team', sci.sees_skip('00000000-0000-0000-0000-0000002370c7'), '1');
SELECT sci.runs('Hal presses Put it back', $q$UPDATE public.stage_checklist_skips SET put_back_at = now(), put_back_by = '00000000-0000-0000-0000-0000002370a6' WHERE id = '00000000-0000-0000-0000-0000002370c7'$q$);
SELECT sci.same('and it stays skipped', sci.live_skips('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1'), '1');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a7');
SET LOCAL ROLE authenticated;
SELECT sci.same('Nan, on no job, does not read it', sci.sees_skip('00000000-0000-0000-0000-0000002370c7'), '0');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a8');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tess in training skips nothing', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by) VALUES ('00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370c1', 'In training', '00000000-0000-0000-0000-0000002370a8')$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a9');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tim the twin skips nothing', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by) VALUES ('00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370c1', 'A twin''s skip', '00000000-0000-0000-0000-0000002370a9')$q$, 'row-level security');
RESET ROLE;

-- 15 · Put it back: an author's press in their own name. The row closes and stays; a closed row does not reopen.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Sal rewrites no live skip''s reason', $q$UPDATE public.stage_checklist_skips SET why = 'Other words' WHERE id = '00000000-0000-0000-0000-0000002370c7'$q$, 'permission denied');
SELECT sci.refused('a put back rewrites nothing in the same press', $q$UPDATE public.stage_checklist_skips SET put_back_at = now(), put_back_by = '00000000-0000-0000-0000-0000002370a4', why = 'Other words' WHERE id = '00000000-0000-0000-0000-0000002370c7'$q$, 'permission denied');
SELECT sci.refused('Sal puts back in nobody else''s name', $q$UPDATE public.stage_checklist_skips SET put_back_at = now(), put_back_by = '00000000-0000-0000-0000-0000002370a1' WHERE id = '00000000-0000-0000-0000-0000002370c7'$q$, 'row-level security');
SELECT sci.runs('Sal puts it back', $q$UPDATE public.stage_checklist_skips SET put_back_at = now(), put_back_by = '00000000-0000-0000-0000-0000002370a4' WHERE id = '00000000-0000-0000-0000-0000002370c7'$q$);
SELECT sci.same('no live skip is left', sci.live_skips('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1'), '0');
SELECT sci.same('and the row stands', sci.skip_rows('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1'), '1');
SELECT sci.runs('a press on the closed row', $q$UPDATE public.stage_checklist_skips SET put_back_at = NULL, put_back_by = NULL WHERE id = '00000000-0000-0000-0000-0000002370c7'$q$);
SELECT sci.same('reaches nothing', sci.live_skips('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1'), '0');
SELECT sci.runs('Sal skips it again, with a new row', $q$INSERT INTO public.stage_checklist_skips (job_id, fixture_id, question_id, why, skipped_by, skipped_by_name) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1', 'Slab on grade after all', '00000000-0000-0000-0000-0000002370a4', 'Sal Super')$q$);
SELECT sci.same('two rows, one live', sci.skip_rows('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1') || ' / ' || sci.live_skips('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1'), '2 / 1');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a5');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Sue, on no team, presses Put it back', $q$UPDATE public.stage_checklist_skips SET put_back_at = now(), put_back_by = '00000000-0000-0000-0000-0000002370a5' WHERE fixture_id = '00000000-0000-0000-0000-0000002370e1'$q$);
SELECT sci.same('and it stays skipped too', sci.live_skips('00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370c1'), '1');
RESET ROLE;

-- 16 · One check onto the company's list: the office alone, in one call. The job's row retires, its answer follows the
--      copy, and the plan sheet and the why stay on the job's row.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a4');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Sal adds a check with a plan sheet and a why', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, sort_order, words, asks_photo, job_id, fixture_id, created_by, created_by_name, plan_sheet, why) VALUES ('00000000-0000-0000-0000-0000002370d7', 'trim_set', 4, 'Is the pan drain run to the hub?', true, '00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370a4', 'Sal Super', 'P-204', 'The inspector asked')$q$);
SELECT sci.refused('Sal adds nothing to the company''s list', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d7')$q$, 'Only the office adds a check');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a6');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Hal answers it', $q$INSERT INTO public.stage_checklist_answers (job_id, fixture_id, question_id, pick, answered_by, answered_by_name, answered_at) VALUES ('00000000-0000-0000-0000-0000002370b1', '00000000-0000-0000-0000-0000002370e1', '00000000-0000-0000-0000-0000002370d7', 'yes', '00000000-0000-0000-0000-0000002370a6', 'Hal Helper', now())$q$);
SELECT sci.refused('Hal adds nothing to the company''s list', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d7')$q$, 'Only the office adds a check');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370aa');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Ed, who authors here, adds nothing to the company''s list', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d7')$q$, 'Only the office adds a check');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a8');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tess in training adds nothing to the company''s list', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d7')$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a9');
SET LOCAL ROLE authenticated;
SELECT sci.refused('Tim the twin adds nothing to the company''s list', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d7')$q$, 'Only the office adds a check');
RESET ROLE;
SELECT sci.same('after every refusal it stands on the job with its answer', sci.standing('00000000-0000-0000-0000-0000002370d7') || ' / ' || sci.answers('00000000-0000-0000-0000-0000002370d7'), 'live / 1');
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a1');
SET LOCAL ROLE authenticated;
SELECT sci.runs('Rosa adds it to the company''s list', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d7')$q$);
SELECT sci.same('the job''s row reads retired by Rosa', sci.standing('00000000-0000-0000-0000-0000002370d7'), 'retired by a1');
SELECT sci.same('and holds its plan sheet and its why', sci.sheet_and_why('00000000-0000-0000-0000-0000002370d7'), 'P-204 / The inspector asked');
SELECT sci.same('the company''s row carries the words and the photo ask alone', sci.company_carries('00000000-0000-0000-0000-0000002370d7'), 'Is the pan drain run to the hub? / photo true / job none / stage none / - / - / by a1');
SELECT sci.same('the answer left the job''s row', sci.answers('00000000-0000-0000-0000-0000002370d7'), '0');
SELECT sci.same('and sits on the company''s row, so the stage has not lost it', sci.answers(sci.company_row('00000000-0000-0000-0000-0000002370d7')), '1');
SELECT sci.same('it goes last on the company''s list', sci.place(sci.company_row('00000000-0000-0000-0000-0000002370d7')), '1');
SELECT sci.refused('a second press finds it gone', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d7')$q$, 'That check is no longer on the job.');
SELECT sci.refused('a company question is no job item', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370c1')$q$, 'That check is no longer on the job.');
SELECT sci.runs('Rosa adds the same words again on job B', $q$INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name) VALUES ('00000000-0000-0000-0000-0000002370d9', 'trim_set', '  is the PAN drain run to the hub? ', '00000000-0000-0000-0000-0000002370b2', '00000000-0000-0000-0000-0000002370e2', '00000000-0000-0000-0000-0000002370a1', 'Rosa Office')$q$);
SELECT sci.refused('the company''s list asks a thing once', $q$SELECT public.promote_stage_checklist_item('00000000-0000-0000-0000-0000002370d9')$q$, 'The company''s list already asks that.');
SELECT sci.same('and that check stays on its job, not half moved', sci.standing('00000000-0000-0000-0000-0000002370d9'), 'live');
RESET ROLE;
-- Everyone reads the company's row, as they read any company question.
SELECT sci.as_user('00000000-0000-0000-0000-0000002370a7');
SET LOCAL ROLE authenticated;
SELECT sci.same('Nan, on no job, reads the new company question', sci.sees(sci.company_row('00000000-0000-0000-0000-0000002370d7')), '1');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'stage_checklist_items PASSED'; END $$;
ROLLBACK;
