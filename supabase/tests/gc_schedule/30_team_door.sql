-- The schedule's team door (v2.5114, the schedule's PR 10): the 23 tables open to the GC office and the
-- job's project manager through gc_on_schedule_team(project). The office reads and writes; training mode
-- and a digital twin read and never write; the project manager reads its own job only; the job's
-- superintendent and a subcontractor read nothing; a what-if copy stays its own person's; the
-- append-only rows stay append-only; anon has no grant. Its own fixture, every press through RLS,
-- everything inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_schedule team door PASSED". See scripts/pgtest-gc-schedule.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev who draws, an estimator, an assistant in training mode, an estimator who is a digital
-- twin, the job's project manager (a superintendent by role, outside the office), the job's
-- superintendent, and a subcontractor.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@door.test'),
  ('00000000-0000-0000-0000-0000000006d2', 'estimator@door.test'),
  ('00000000-0000-0000-0000-0000000006d3', 'trainee@door.test'),
  ('00000000-0000-0000-0000-0000000006d4', 'twin@door.test'),
  ('00000000-0000-0000-0000-0000000006d5', 'pm@door.test'),
  ('00000000-0000-0000-0000-0000000006d6', 'super@door.test'),
  ('00000000-0000-0000-0000-0000000006d7', 'sub@door.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@door.test', 'Door Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000006d2', 'estimator@door.test', 'Door Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000006d3', 'trainee@door.test', 'Door Trainee', 'assistant'),
  ('00000000-0000-0000-0000-0000000006d4', 'twin@door.test', 'Door Twin', 'estimator'),
  ('00000000-0000-0000-0000-0000000006d5', 'pm@door.test', 'Door Project Manager', 'superintendent'),
  ('00000000-0000-0000-0000-0000000006d6', 'super@door.test', 'Door Superintendent', 'superintendent'),
  ('00000000-0000-0000-0000-0000000006d7', 'sub@door.test', 'Door Sub', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000006d3';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000006d4';

-- Two GC jobs in buyout. P has a project manager and a superintendent on its crew; Q has neither.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000006c1', 'Door Test Owner', '00000000-0000-0000-0000-0000000006d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'Door test P', '00000000-0000-0000-0000-0000000006c1'),
  ('00000000-0000-0000-0000-0000000006a2', 'Door test Q', '00000000-0000-0000-0000-0000000006c1');
INSERT INTO public.gc_projects (project_id, stage, project_manager_user_id) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'buyout', '00000000-0000-0000-0000-0000000006d5'),
  ('00000000-0000-0000-0000-0000000006a2', 'buyout', NULL);
INSERT INTO public.project_superintendents (project_id, superintendent_id) VALUES
  ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006d6');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006a1', 'Plumbing', 1),
  ('00000000-0000-0000-0000-0000000006b3', '00000000-0000-0000-0000-0000000006a2', 'Electrical', 0);
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000006e1', '00000000-0000-0000-0000-0000000006b1', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000006e3', '00000000-0000-0000-0000-0000000006b2', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000006e4', '00000000-0000-0000-0000-0000000006b3', 0, 'Service');
INSERT INTO public.gc_schedule_templates (id, name, from_name, from_done_pct, saved_on, saved_by, lines, stages, weeks) VALUES (
  '00000000-0000-0000-0000-000000000691', 'Door test shape', 'Door test P', 0, DATE '2026-10-09', '00000000-0000-0000-0000-0000000006d1',
  '[{"trade": "Electrical", "label": "Service", "stage": "roughIn", "days": 5, "after": [], "offset": 0}]', '[]', 2);

CREATE SCHEMA gtd;
CREATE FUNCTION gtd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gtd.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gtd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the signed-in person sees across the schedule's 23 tables, through their policies: each table
-- with rows and how many, or "none".
CREATE FUNCTION gtd.seen() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  t text;
  n bigint;
  v_out text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_schedules', 'gc_schedule_activities', 'gc_schedule_activity_parts', 'gc_schedule_links',
    'gc_schedule_milestones', 'gc_schedule_inspection_failures', 'gc_schedule_baselines',
    'gc_schedule_baseline_dates', 'gc_schedule_changes', 'gc_schedule_late_notices', 'gc_schedule_walks',
    'gc_schedule_moves', 'gc_schedule_move_pushes', 'gc_schedule_move_tells', 'gc_schedule_move_answers',
    'gc_schedule_lookahead_marks', 'gc_schedule_waits', 'gc_schedule_wait_holds', 'gc_schedule_crew_counts',
    'gc_schedule_sends', 'gc_schedule_templates', 'gc_rough_schedules', 'gc_schedule_what_ifs'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n > 0 THEN v_out := v_out || t || ' ' || n || ' '; END IF;
  END LOOP;
  RETURN coalesce(nullif(btrim(v_out), ''), 'none');
END $$;
GRANT USAGE ON SCHEMA gtd TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gtd TO authenticated, anon;

-- 0 · The catalog: each of the 23 tables has one _team policy and no _dev.
SELECT gtd.same('23 _team policies, no _dev',
  (SELECT count(*) FILTER (WHERE policyname LIKE '%\_team') || ' ' || count(*) FILTER (WHERE policyname LIKE '%\_dev')
   FROM pg_policies WHERE schemaname = 'public' AND (tablename LIKE 'gc\_schedule%' OR tablename = 'gc_rough_schedules')),
  '23 0');

-- The dev draws both jobs.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d1');
SET LOCAL ROLE authenticated;
SELECT gtd.same('the dev draws P', public.gc_schedule_draft('00000000-0000-0000-0000-0000000006a1', NULL,
  'Drew a first draft of the schedule on Door test P: 3 activities from Mon Nov 2.',
  $j${"bars": [
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000006e1", "packageId": "00000000-0000-0000-0000-0000000006b1", "start": "2026-11-02", "finish": "2026-11-13", "after": []},
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000006e3", "packageId": "00000000-0000-0000-0000-0000000006b2", "start": "2026-11-02", "finish": "2026-11-13", "after": []},
    {"kind": "inspection", "id": "00000000-0000-0000-0000-0000000006f1", "label": "Rough-in inspection", "start": "2026-11-16", "finish": "2026-11-17",
     "after": [{"id": "00000000-0000-0000-0000-0000000006e1", "gap": 0}, {"id": "00000000-0000-0000-0000-0000000006e3", "gap": 0}]}]}$j$::jsonb)::text, '1');
SELECT gtd.same('the dev draws Q', public.gc_schedule_draft('00000000-0000-0000-0000-0000000006a2', NULL,
  'Drew a first draft of the schedule on Door test Q: 1 activity from Mon Nov 9.',
  $j${"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000006e4", "packageId": "00000000-0000-0000-0000-0000000006b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}$j$::jsonb)::text, '1');

-- 1 · An estimator reads, moves a bar on the version it read, splits a line, and reads the rows that
-- hang from a move and from an activity.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d2');
SELECT gtd.same('an estimator reads P''s bars', (SELECT count(*) FROM public.gc_schedule_activities WHERE project_id = '00000000-0000-0000-0000-0000000006a1')::text, '3');
SELECT gtd.same('an estimator moves a bar, as version 2', public.gc_schedule_move('00000000-0000-0000-0000-0000000006a1', 1,
  'Electrical · Rough-in now runs Wed Nov 4 to Tue Nov 17. 1 activity after it moves out. Door Estimator: The switchgear ships two days late.',
  $j${"activityId": "00000000-0000-0000-0000-0000000006e1", "activityName": "Electrical · Rough-in", "reason": "materials", "note": "The switchgear ships two days late.",
      "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-04", "finish": "2026-11-17"}, "finishFrom": "2026-11-17", "finishTo": "2026-11-19",
      "pushed": [{"activityId": "00000000-0000-0000-0000-0000000006f1", "from": {"start": "2026-11-16", "finish": "2026-11-17"}, "to": {"start": "2026-11-18", "finish": "2026-11-19"}}]}$j$::jsonb,
  $j$[{"id": "00000000-0000-0000-0000-0000000006e1", "start": "2026-11-04", "finish": "2026-11-17"},
      {"id": "00000000-0000-0000-0000-0000000006f1", "start": "2026-11-18", "finish": "2026-11-19"}]$j$::jsonb)::text, '2');
SELECT gtd.same('an estimator reads the move''s push, through its move',
  (SELECT count(*) FROM public.gc_schedule_move_pushes x JOIN public.gc_schedule_moves m ON m.id = x.move_id WHERE m.project_id = '00000000-0000-0000-0000-0000000006a1')::text, '1');
SELECT gtd.same('an estimator splits Electrical · Rough-in, as version 3', public.gc_schedule_split('00000000-0000-0000-0000-0000000006a1', 2, '00000000-0000-0000-0000-0000000006e1',
  '[{"id": "00000000-0000-0000-0000-000000000681", "name": "First floor", "fromDay": 0, "days": 7, "share": 50, "pct": 0},
    {"id": "00000000-0000-0000-0000-000000000682", "name": "Second floor", "fromDay": 7, "days": 7, "share": 50, "pct": 0}]',
  'Door Estimator split Electrical · Rough-in on Door test P into 2 parts: First floor, Second floor.')::text, '3');
SELECT gtd.same('an estimator reads the parts, through their activity',
  (SELECT count(*) FROM public.gc_schedule_activity_parts WHERE activity_id = '00000000-0000-0000-0000-0000000006e1')::text, '2');

-- 2 · An assistant in training mode reads, and its move is refused.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d3');
SELECT gtd.same('training mode reads P''s bars', (SELECT count(*) FROM public.gc_schedule_activities WHERE project_id = '00000000-0000-0000-0000-0000000006a1')::text, '3');
SELECT gtd.refused('a move in training mode', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000006a1', 3, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000006e3", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-19", "finishTo": "2026-11-19", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000006e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$,
  'Read-only (training) mode: changes are blocked.');

-- 3 · An estimator who is a digital twin reads, and the fence refuses its move. The fence hides the
-- schedule's row from the version's UPDATE, so the bump finds no row at the version it read and says the
-- schedule changed: the wrong reason, the right outcome, and nothing written.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d4');
SELECT gtd.same('a twin reads P''s bars', (SELECT count(*) FROM public.gc_schedule_activities WHERE project_id = '00000000-0000-0000-0000-0000000006a1')::text, '3');
SELECT gtd.refused('a move by a digital twin', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000006a1', 3, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000006e3", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-19", "finishTo": "2026-11-19", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000006e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$,
  'The schedule changed while you were working.');
SELECT gtd.same('nothing the twin pressed was written', (SELECT version::text FROM public.gc_schedules WHERE project_id = '00000000-0000-0000-0000-0000000006a1'), '3');

-- 4 · The project manager, outside the office: P only, reading and moving, and the templates.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d5');
SELECT gtd.same('the project manager reads P''s bars and parts',
  (SELECT count(*) FROM public.gc_schedule_activities WHERE project_id = '00000000-0000-0000-0000-0000000006a1') || ' ' ||
  (SELECT count(*) FROM public.gc_schedule_activity_parts WHERE activity_id = '00000000-0000-0000-0000-0000000006e1'), '3 2');
-- The office is let in whatever the job, so only the project manager proves a child row finds its job: a move's
-- push through its move, a part through its activity.
SELECT gtd.same('the project manager reads the estimator''s move''s push, through its move',
  (SELECT count(*) FROM public.gc_schedule_move_pushes)::text, '1');
SELECT gtd.same('the project manager moves a bar on P, as version 4', public.gc_schedule_move('00000000-0000-0000-0000-0000000006a1', 3,
  'Plumbing · Rough-in now runs Tue Nov 3 to Fri Nov 13. Door Project Manager: The crew starts a day late.',
  '{"activityId": "00000000-0000-0000-0000-0000000006e3", "activityName": "Plumbing · Rough-in", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-19", "finishTo": "2026-11-19", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000006e3", "start": "2026-11-03", "finish": "2026-11-13"}]')::text, '4');
SELECT gtd.same('the project manager reads none of Q''s bars', (SELECT count(*) FROM public.gc_schedule_activities WHERE project_id = '00000000-0000-0000-0000-0000000006a2')::text, '0');
SELECT gtd.refused('the project manager''s move on Q', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000006a2', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000006e4", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-09", "finish": "2026-11-13"}, "to": {"start": "2026-11-10", "finish": "2026-11-13"}, "finishFrom": "2026-11-13", "finishTo": "2026-11-13", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000006e4", "start": "2026-11-10", "finish": "2026-11-13"}]')$q$,
  'This job has no schedule yet.');
SELECT gtd.same('the project manager reads the templates', (SELECT count(*) FROM public.gc_schedule_templates)::text, '1');

-- 5 · The job's superintendent sees nothing: Building's door adds it (the lead's call, 2026-10-09).
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d6');
SELECT gtd.same('the job''s superintendent sees nothing yet', gtd.seen(), 'none');

-- 6 · A subcontractor sees nothing, the templates included.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d7');
SELECT gtd.same('a subcontractor sees nothing', gtd.seen(), 'none');

-- 7 · A what-if copy is its own person's.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d2');
INSERT INTO public.gc_schedule_what_ifs (project_id, user_id, made_on, base_version, base, copy)
  VALUES ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006d2', public.app_today(), 4, '{}', '{}');
SELECT gtd.same('the estimator reads its own what-if', (SELECT count(*) FROM public.gc_schedule_what_ifs)::text, '1');
SELECT gtd.refused('a what-if made for someone else', $q$INSERT INTO public.gc_schedule_what_ifs (project_id, user_id, made_on, base_version, base, copy)
    VALUES ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006d1', public.app_today(), 4, '{}', '{}')$q$,
  'row-level security');
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d3');
SELECT gtd.same('someone else on the team reads none of it', (SELECT count(*) FROM public.gc_schedule_what_ifs)::text, '0');

-- 8 · The append-only rows: the policy lets the estimator in, the privilege does not.
SELECT gtd.as_user('00000000-0000-0000-0000-0000000006d2');
SELECT gtd.refused('the words of a change rewritten', $q$UPDATE public.gc_schedule_changes SET words = 'Rewritten.' WHERE project_id = '00000000-0000-0000-0000-0000000006a1'$q$,
  'permission denied');
SELECT gtd.refused('a move deleted', $q$DELETE FROM public.gc_schedule_moves WHERE project_id = '00000000-0000-0000-0000-0000000006a1'$q$,
  'permission denied');

-- 9 · anon has no grant.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT gtd.refused('anon reads the schedules', $q$SELECT count(*) FROM public.gc_schedules$q$, 'permission denied');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'gc_schedule team door PASSED'; END $$;
ROLLBACK;
