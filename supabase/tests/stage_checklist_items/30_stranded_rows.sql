-- Rows an earlier split stranded (punch list #237, migration *_stage_checklist_rows_follow_their_line): a line that moved
-- while its answer, its job item and its skip kept the old job, as every split did before the trigger. Committed, unlike
-- a scenario, since the migration's second run comes next and must repair them; 40_follow_the_line.sql reads the repair.
-- See scripts/pgtest-stage-checklist-items.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000002372a1', 'stranded@follow.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000002372a1', 'stranded@follow.test', 'Stranded Master', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000002372f9', 'Stranded Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000002372b1', '00000000-0000-0000-0000-0000002372a1', '00000000-0000-0000-0000-0000002372f9', 'Stranded old job', NULL),
  ('00000000-0000-0000-0000-0000002372b2', '00000000-0000-0000-0000-0000002372a1', '00000000-0000-0000-0000-0000002372f9', 'Stranded new job', NULL);
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-0000002372e1', '00000000-0000-0000-0000-0000002372b1', 'Top Out');
INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id) VALUES
  ('00000000-0000-0000-0000-0000002372c1', 'top_out', 'Stranded: the question it answered', NULL, NULL),
  ('00000000-0000-0000-0000-0000002372c2', 'top_out', 'Stranded: the question it skipped', NULL, NULL),
  ('00000000-0000-0000-0000-0000002372d1', 'top_out', 'Stranded: the check added', '00000000-0000-0000-0000-0000002372b1', '00000000-0000-0000-0000-0000002372e1');
INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, pick, note) VALUES
  ('00000000-0000-0000-0000-000000237211', '00000000-0000-0000-0000-0000002372b1', '00000000-0000-0000-0000-0000002372e1', '00000000-0000-0000-0000-0000002372c1', 'yes', 'Stranded note');
INSERT INTO public.stage_checklist_skips (id, job_id, fixture_id, question_id, why, skipped_by_name) VALUES
  ('00000000-0000-0000-0000-000000237221', '00000000-0000-0000-0000-0000002372b1', '00000000-0000-0000-0000-0000002372e1', '00000000-0000-0000-0000-0000002372c2', 'Stranded why', 'Stranded Master');

-- The split as it ran before the trigger: the line moves and the rows do not.
ALTER TABLE public.jobs_ledger_fixtures DISABLE TRIGGER jobs_ledger_fixtures_carry_checklist;
UPDATE public.jobs_ledger_fixtures SET job_id = '00000000-0000-0000-0000-0000002372b2' WHERE id = '00000000-0000-0000-0000-0000002372e1';
ALTER TABLE public.jobs_ledger_fixtures ENABLE TRIGGER jobs_ledger_fixtures_carry_checklist;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.stage_checklist_answers WHERE id = '00000000-0000-0000-0000-000000237211' AND job_id = '00000000-0000-0000-0000-0000002372b1') <> 1
     OR (SELECT count(*) FROM public.stage_checklist_templates WHERE id = '00000000-0000-0000-0000-0000002372d1' AND job_id = '00000000-0000-0000-0000-0000002372b1') <> 1
     OR (SELECT count(*) FROM public.stage_checklist_skips WHERE id = '00000000-0000-0000-0000-000000237221' AND job_id = '00000000-0000-0000-0000-0000002372b1') <> 1 THEN
    RAISE EXCEPTION 'The seed did not strand its rows, so the repair would prove nothing.';
  END IF;
END $$;

COMMIT;
