-- The schedule's writes (v2.4848, the schedule's PR 5): every plan write checks and bumps the
-- version, refuses a stale one with every change since, refuses a move with no reason and a finish
-- before its start, keeps the plan at Start first, and writes all of a press or none of it; the
-- records that touch several rows; and the guard that keeps the plan's rows for the plan writes.
-- Presses run as a dev through RLS, one job's fixture made as postgres; everything runs inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_schedule PASSED". See scripts/pgtest-gc-schedule.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, and an estimator (no policy on the schedule's tables yet).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000005d1', 'dev@schedule.test'),
  ('00000000-0000-0000-0000-0000000005d2', 'trainee@schedule.test'),
  ('00000000-0000-0000-0000-0000000005d3', 'estimator@schedule.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000005d1', 'dev@schedule.test', 'Schedule Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000005d2', 'trainee@schedule.test', 'Schedule Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000005d3', 'estimator@schedule.test', 'Schedule Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000005d2';

-- Two GC jobs in buyout: P with Electrical (rough-in, trim) and Plumbing (rough-in), Q with Electrical.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000005c1', 'Schedule Test Owner', '00000000-0000-0000-0000-0000000005d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'Schedule test P', '00000000-0000-0000-0000-0000000005c1'),
  ('00000000-0000-0000-0000-0000000005a2', 'Schedule test Q', '00000000-0000-0000-0000-0000000005c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'buyout'),
  ('00000000-0000-0000-0000-0000000005a2', 'buyout');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-0000000005a1', 'Plumbing', 1),
  ('00000000-0000-0000-0000-0000000005b3', '00000000-0000-0000-0000-0000000005a2', 'Electrical', 0);
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005b1', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-0000000005b1', 1, 'Trim'),
  ('00000000-0000-0000-0000-0000000005e3', '00000000-0000-0000-0000-0000000005b2', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000005e4', '00000000-0000-0000-0000-0000000005b3', 0, 'Service');

CREATE SCHEMA gst;
CREATE FUNCTION gst.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`; with `detail_has`, a DETAIL that holds it too.
-- The statement's own writes go with the refusal (a subtransaction), as a refused press's do.
CREATE FUNCTION gst.refused(label text, stmt text, want text, detail_has text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    IF detail_has IS NOT NULL AND position(detail_has IN coalesce(v_detail, '')) = 0 THEN
      RAISE EXCEPTION '% was refused without % in its detail: %', label, detail_has, v_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gst.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the job's bars read: each bar's name or line id, its days, one line each.
CREATE FUNCTION gst.bars(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(coalesce(a.label, right(a.id::text, 3)) || ' ' || a.start || '..' || a.finish, E'\n' ORDER BY a.position)
  FROM public.gc_schedule_activities a WHERE a.project_id = p_project $$;
CREATE FUNCTION gst.version(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT version::text FROM public.gc_schedules WHERE project_id = p_project $$;
GRANT USAGE ON SCHEMA gst TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gst TO authenticated;
-- What a press returned, for the steps after it: a statement never sees what a function it calls
-- wrote, so each check reads in a statement of its own.
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated;

-- Our template, as Save as a template keeps it (a plain insert, decision 9), for the draw on Q.
INSERT INTO public.gc_schedule_templates (id, name, from_name, from_done_pct, saved_on, saved_by, lines, stages, weeks) VALUES (
  '00000000-0000-0000-0000-000000000591', 'Schedule test shape', 'Schedule test P', 40, DATE '2026-10-07', '00000000-0000-0000-0000-0000000005d1',
  '[{"trade": "Electrical", "label": "Service", "stage": "roughIn", "days": 5, "after": [], "offset": 0}]', '[]', 2);

SELECT gst.as_user('00000000-0000-0000-0000-0000000005d1');
SET LOCAL ROLE authenticated;

-- 1 · The first draft of P: five bars, their waits, two dates to meet, at version 1, with its words.
SELECT gst.same('the first draft makes version 1', public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a1', NULL,
  'Drew a first draft of the schedule on Schedule test P: 5 activities from Mon Nov 2.',
  $j${"bars": [
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e1", "packageId": "00000000-0000-0000-0000-0000000005b1", "start": "2026-11-02", "finish": "2026-11-13", "after": []},
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e3", "packageId": "00000000-0000-0000-0000-0000000005b2", "start": "2026-11-02", "finish": "2026-11-13", "after": []},
    {"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f1", "label": "Rough-in inspection", "start": "2026-11-16", "finish": "2026-11-17",
     "after": [{"id": "00000000-0000-0000-0000-0000000005e1", "gap": 0}, {"id": "00000000-0000-0000-0000-0000000005e3", "gap": 0}]},
    {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e2", "packageId": "00000000-0000-0000-0000-0000000005b1", "start": "2026-11-18", "finish": "2026-11-24",
     "after": [{"id": "00000000-0000-0000-0000-0000000005f1", "gap": 0}]},
    {"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f2", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26",
     "after": [{"id": "00000000-0000-0000-0000-0000000005e2", "gap": 0}]}],
   "milestones": [
    {"id": "00000000-0000-0000-0000-000000000572", "label": "Rough-in inspection", "planned": "2026-11-17"},
    {"id": "00000000-0000-0000-0000-000000000571", "label": "Substantial completion", "planned": "2026-11-29"}]}$j$::jsonb)::text, '1');
SELECT gst.same('the draft: its bars, a line by its scope line''s id',
  gst.bars('00000000-0000-0000-0000-0000000005a1'),
  E'5e1 2026-11-02..2026-11-13\n5e3 2026-11-02..2026-11-13\nRough-in inspection 2026-11-16..2026-11-17\n5e2 2026-11-18..2026-11-24\nFinal inspection 2026-11-25..2026-11-26');
SELECT gst.same('the draft: four waits, two dates to meet, one line of words',
  (SELECT count(*) FROM public.gc_schedule_links WHERE project_id = '00000000-0000-0000-0000-0000000005a1')::text || ' ' ||
  (SELECT count(*) FROM public.gc_schedule_milestones WHERE project_id = '00000000-0000-0000-0000-0000000005a1')::text || ' ' ||
  (SELECT string_agg(version || ': ' || words, ' | ') FROM public.gc_schedule_changes WHERE project_id = '00000000-0000-0000-0000-0000000005a1'),
  '4 2 1: Drew a first draft of the schedule on Schedule test P: 5 activities from Mon Nov 2.');

-- 2 · A second first draft, as if a second person drew at once: refused, naming the first.
SELECT gst.refused('a second first draft',
  $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a1', NULL, 'Drew it again.',
    '{"bars": [{"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f9", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26"}]}')$q$,
  'The schedule changed while you were working.', 'Drew a first draft of the schedule on Schedule test P');

-- 3 · Why it moved comes first: no reason, a word for a reason, a finish before its start.
SELECT gst.refused('a move with no reason', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$, 'Pick why it moved.');
SELECT gst.refused('a move with a word for a reason', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "short", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$, 'Say what happened, in a sentence.');
SELECT gst.refused('a finish before its start', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-13", "finish": "2026-11-03"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-13", "finish": "2026-11-03"}]')$q$, 'It has to finish on or after it starts.');
SELECT gst.refused('a move whose bars and record disagree', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-26", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}, {"id": "00000000-0000-0000-0000-0000000005f1", "start": "2026-11-17", "finish": "2026-11-18"}]')$q$,
  'The move and its bars do not agree.');
SELECT gst.same('nothing refused touched the version', gst.version('00000000-0000-0000-0000-0000000005a1'), '1');

-- 4 · Two people on one schedule (G-134): A saves first on version 1; B's press on version 1 is refused
-- with A's words, and nothing of B's is written; B presses again on version 2 and it saves.
SELECT gst.same('move A saves as version 2', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1,
  'Electrical · Rough-in now runs Wed Nov 4 to Tue Nov 17. 3 activities after it move out. Schedule Dev: The switchgear ships two days late.',
  $j${"activityId": "00000000-0000-0000-0000-0000000005e1", "activityName": "Electrical · Rough-in", "reason": "materials", "note": "The switchgear ships two days late.",
      "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-04", "finish": "2026-11-17"}, "finishFrom": "2026-11-26", "finishTo": "2026-11-28",
      "pushed": [
        {"activityId": "00000000-0000-0000-0000-0000000005f1", "from": {"start": "2026-11-16", "finish": "2026-11-17"}, "to": {"start": "2026-11-18", "finish": "2026-11-19"}},
        {"activityId": "00000000-0000-0000-0000-0000000005e2", "from": {"start": "2026-11-18", "finish": "2026-11-24"}, "to": {"start": "2026-11-20", "finish": "2026-11-26"}},
        {"activityId": "00000000-0000-0000-0000-0000000005f2", "from": {"start": "2026-11-25", "finish": "2026-11-26"}, "to": {"start": "2026-11-27", "finish": "2026-11-28"}}]}$j$::jsonb,
  $j$[{"id": "00000000-0000-0000-0000-0000000005e1", "start": "2026-11-04", "finish": "2026-11-17"},
      {"id": "00000000-0000-0000-0000-0000000005f1", "start": "2026-11-18", "finish": "2026-11-19"},
      {"id": "00000000-0000-0000-0000-0000000005e2", "start": "2026-11-20", "finish": "2026-11-26"},
      {"id": "00000000-0000-0000-0000-0000000005f2", "start": "2026-11-27", "finish": "2026-11-28"}]$j$::jsonb)::text, '2');
SELECT gst.refused('move B on version 1 is refused with move A''s words', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 1,
    'Plumbing · Rough-in now runs Tue Nov 3 to Fri Nov 13. Schedule Dev: The crew starts a day late.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-28", "finishTo": "2026-11-28", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')$q$,
  'The schedule changed while you were working.', 'The switchgear ships two days late.');
SELECT gst.same('nothing of move B was written', gst.bars('00000000-0000-0000-0000-0000000005a1'),
  E'5e1 2026-11-04..2026-11-17\n5e3 2026-11-02..2026-11-13\nRough-in inspection 2026-11-18..2026-11-19\n5e2 2026-11-20..2026-11-26\nFinal inspection 2026-11-27..2026-11-28');
SELECT gst.same('move B saves on version 2, as version 3', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 2,
  'Plumbing · Rough-in now runs Tue Nov 3 to Fri Nov 13. Schedule Dev: The crew starts a day late.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e3", "activityName": "Plumbing · Rough-in", "reason": "crew", "note": "The crew starts a day late.", "from": {"start": "2026-11-02", "finish": "2026-11-13"}, "to": {"start": "2026-11-03", "finish": "2026-11-13"}, "finishFrom": "2026-11-28", "finishTo": "2026-11-28", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-03", "finish": "2026-11-13"}]')::text, '3');
SELECT gst.same('each move keeps its version, its day, its mover and what it pushed',
  (SELECT string_agg(m.schedule_version || ' ' || m.activity_name || ' ' || (m.made_on = public.app_today()) || ' ' || m.made_by_name || ' ' ||
     (SELECT count(*) FROM public.gc_schedule_move_pushes x WHERE x.move_id = m.id), ' | ' ORDER BY m.schedule_version)
   FROM public.gc_schedule_moves m WHERE m.project_id = '00000000-0000-0000-0000-0000000005a1'),
  '2 Electrical · Rough-in true Schedule Dev 3 | 3 Plumbing · Rough-in true Schedule Dev 0');

-- 5 · Undo and Redo (G-40): only the newest standing move; each bar back where the move found it.
SELECT gst.refused('undo a move a newer one stands on', $q$SELECT public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 3,
    (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 2 AND project_id = '00000000-0000-0000-0000-0000000005a1'), 'Undid a move.')$q$,
  'Only the newest move can be undone.');
SELECT gst.same('undo move B, as version 4', public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 3,
  (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 3 AND project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Schedule Dev undid a move: Plumbing · Rough-in is back to Nov 2 to Nov 13.')::text, '4');
SELECT gst.same('undo: the bar is back and the move is undone today, by its undoer',
  (SELECT a.start || ' ' || (m.undone_on = public.app_today()) || ' ' || (m.undone_by = '00000000-0000-0000-0000-0000000005d1')
   FROM public.gc_schedule_moves m JOIN public.gc_schedule_activities a ON a.id = m.activity_id WHERE m.schedule_version = 3 AND m.project_id = '00000000-0000-0000-0000-0000000005a1'),
  '2026-11-02 true true');
SELECT gst.same('redo move B, as version 5', public.gc_schedule_redo('00000000-0000-0000-0000-0000000005a1', 4,
  (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 3 AND project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Schedule Dev put a move back: Plumbing · Rough-in is Nov 3 to Nov 13 again.')::text, '5');
SELECT gst.refused('redo a move that stands', $q$SELECT public.gc_schedule_redo('00000000-0000-0000-0000-0000000005a1', 5,
    (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 3 AND project_id = '00000000-0000-0000-0000-0000000005a1'), 'Put it back.')$q$,
  'That move stands already.');

-- 6 · Start (decision 7): the first plan write after it keeps the plan as it stood, At Start.
RESET ROLE;
UPDATE public.gc_projects SET stage = 'building' WHERE project_id = '00000000-0000-0000-0000-0000000005a1';
SET LOCAL ROLE authenticated;
SELECT gst.same('move C after Start, as version 6', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 5,
  'Electrical · Trim now runs Mon Nov 23 to Fri Nov 27. Final inspection moves out 1 day. Schedule Dev: The fixtures came in a week late.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e2", "activityName": "Electrical · Trim", "reason": "materials", "note": "The fixtures came in a week late.", "from": {"start": "2026-11-20", "finish": "2026-11-26"}, "to": {"start": "2026-11-23", "finish": "2026-11-27"}, "finishFrom": "2026-11-28", "finishTo": "2026-11-29",
    "pushed": [{"activityId": "00000000-0000-0000-0000-0000000005f2", "from": {"start": "2026-11-27", "finish": "2026-11-28"}, "to": {"start": "2026-11-28", "finish": "2026-11-29"}}]}',
  '[{"id": "00000000-0000-0000-0000-0000000005e2", "start": "2026-11-23", "finish": "2026-11-27"}, {"id": "00000000-0000-0000-0000-0000000005f2", "start": "2026-11-28", "finish": "2026-11-29"}]')::text, '6');
SELECT gst.same('the plan at Start was kept before move C, unnamed',
  (SELECT count(*) || ' ' || coalesce(max(b.name), 'At Start') || ' ' || max(d.start) || '..' || max(d.finish)
   FROM public.gc_schedule_baselines b JOIN public.gc_schedule_baseline_dates d ON d.baseline_id = b.id AND d.activity_id = '00000000-0000-0000-0000-0000000005e2'
   WHERE b.project_id = '00000000-0000-0000-0000-0000000005a1'),
  '1 At Start 2026-11-20..2026-11-26');

-- 7 · A new baseline after a signed change order (G-41): named, the one at Start kept.
SELECT gst.refused('a new baseline with no name', $q$SELECT public.gc_schedule_baseline('00000000-0000-0000-0000-0000000005a1', 6, '  ', '', 'Set a baseline.')$q$,
  'Give the new baseline a name.');
SELECT gst.same('a new baseline, as version 7', public.gc_schedule_baseline('00000000-0000-0000-0000-0000000005a1', 6, 'After change order 1', 'The curb was signed.',
  'Schedule Dev set a new baseline on Schedule test P, After change order 1: The curb was signed. The plan at Start is kept.')::text, '7');
SELECT gst.same('two baselines, the newest with the plan as it stands',
  (SELECT string_agg(coalesce(b.name, 'At Start') || ' ' || d.start, ' | ' ORDER BY b.created_at, b.name NULLS FIRST)
   FROM public.gc_schedule_baselines b JOIN public.gc_schedule_baseline_dates d ON d.baseline_id = b.id AND d.activity_id = '00000000-0000-0000-0000-0000000005e2'
   WHERE b.project_id = '00000000-0000-0000-0000-0000000005a1'),
  'At Start 2026-11-20 | After change order 1 2026-11-23');

-- 8 · Split a line into parts (G-39), move a part, undo it, and make it one bar again.
SELECT gst.refused('a split into one part', $q$SELECT public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005e1',
    '[{"name": "Whole", "fromDay": 0, "days": 14, "share": 100, "pct": 0}]', 'Split it.')$q$, 'Split it into two parts or more.');
SELECT gst.refused('a split that does not start with the line', $q$SELECT public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005e1',
    '[{"name": "First floor", "fromDay": 1, "days": 6, "share": 50, "pct": 0}, {"name": "Second floor", "fromDay": 7, "days": 7, "share": 50, "pct": 0}]', 'Split it.')$q$,
  'The first part starts Wed Nov 4 and the last ends Tue Nov 17, as the line does.');
SELECT gst.refused('a split of an inspection', $q$SELECT public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005f1',
    '[{"name": "Half", "fromDay": 0, "days": 1, "share": 50, "pct": 0}, {"name": "Other half", "fromDay": 1, "days": 1, "share": 50, "pct": 0}]', 'Split it.')$q$,
  'Only a trade''s line splits into parts.');
SELECT gst.same('split Electrical · Rough-in in two, as version 8', public.gc_schedule_split('00000000-0000-0000-0000-0000000005a1', 7, '00000000-0000-0000-0000-0000000005e1',
  '[{"id": "00000000-0000-0000-0000-000000000581", "name": "First floor", "fromDay": 0, "days": 7, "share": 50, "pct": 0},
    {"id": "00000000-0000-0000-0000-000000000582", "name": "Second floor", "fromDay": 7, "days": 7, "share": 50, "pct": 0}]',
  'Schedule Dev split Electrical · Rough-in on Schedule test P into 2 parts: First floor, Second floor.')::text, '8');
SELECT gst.same('a part''s own move, as version 9', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 8,
  'Electrical · Rough-in, Second floor now runs Fri Nov 13 to Thu Nov 19. Schedule Dev: The second floor deck is not poured yet.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e1", "activityName": "Electrical · Rough-in", "reason": "trade before", "note": "The second floor deck is not poured yet.",
    "from": {"start": "2026-11-04", "finish": "2026-11-17"}, "to": {"start": "2026-11-04", "finish": "2026-11-19"}, "finishFrom": "2026-11-29", "finishTo": "2026-11-29",
    "pushed": [{"activityId": "00000000-0000-0000-0000-0000000005f1", "from": {"start": "2026-11-18", "finish": "2026-11-19"}, "to": {"start": "2026-11-20", "finish": "2026-11-21"}}],
    "parts": {"id": "00000000-0000-0000-0000-000000000582",
              "was": [{"id": "00000000-0000-0000-0000-000000000581", "from": 0, "days": 7}, {"id": "00000000-0000-0000-0000-000000000582", "from": 7, "days": 7}],
              "now": [{"id": "00000000-0000-0000-0000-000000000581", "from": 0, "days": 7}, {"id": "00000000-0000-0000-0000-000000000582", "from": 9, "days": 7}]}}',
  '[{"id": "00000000-0000-0000-0000-0000000005e1", "start": "2026-11-04", "finish": "2026-11-19",
     "parts": [{"id": "00000000-0000-0000-0000-000000000581", "fromDay": 0, "days": 7}, {"id": "00000000-0000-0000-0000-000000000582", "fromDay": 9, "days": 7}]},
    {"id": "00000000-0000-0000-0000-0000000005f1", "start": "2026-11-20", "finish": "2026-11-21"}]')::text, '9');
SELECT gst.same('undo the part''s move, as version 10', public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 9,
  (SELECT id FROM public.gc_schedule_moves WHERE schedule_version = 9 AND project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Schedule Dev undid a move: Electrical · Rough-in is back to Nov 4 to Nov 17.')::text, '10');
SELECT gst.same('undo put the part''s days, the line and its push back',
  (SELECT string_agg(p.name || ' ' || p.from_day || '+' || p.days, ' | ' ORDER BY p.position) FROM public.gc_schedule_activity_parts p WHERE p.activity_id = '00000000-0000-0000-0000-0000000005e1')
  || ' / ' || (SELECT start || '..' || finish FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005e1')
  || ' / ' || (SELECT start || '..' || finish FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005f1'),
  'First floor 0+7 | Second floor 7+7 / 2026-11-04..2026-11-17 / 2026-11-18..2026-11-19');
SELECT gst.same('one bar again, as version 11', public.gc_schedule_join('00000000-0000-0000-0000-0000000005a1', 10, '00000000-0000-0000-0000-0000000005e1',
  'Schedule Dev made Electrical · Rough-in on Schedule test P one bar again.')::text, '11');
SELECT gst.refused('one bar made one bar', $q$SELECT public.gc_schedule_join('00000000-0000-0000-0000-0000000005a1', 11, '00000000-0000-0000-0000-0000000005e1', 'Joined it.')$q$,
  'It is one bar already.');

-- 9 · The job's own work (G-38): on with a wait and a bar that waits on it, off again; a line stays.
SELECT gst.refused('the job''s own work with no owner', $q$SELECT public.gc_schedule_add_activity('00000000-0000-0000-0000-0000000005a1', 11,
    '{"id": "00000000-0000-0000-0000-0000000005f3", "label": "Mobilize", "who": " ", "start": "2026-11-02", "finish": "2026-11-03", "after": []}', '{}', '[]', 'Added it.')$q$,
  'Say whose it is.');
SELECT gst.same('Mobilize on, as version 12', public.gc_schedule_add_activity('00000000-0000-0000-0000-0000000005a1', 11,
  '{"id": "00000000-0000-0000-0000-0000000005f3", "label": "Mobilize", "who": "Our own crew", "start": "2026-11-02", "finish": "2026-11-03", "after": []}',
  '{00000000-0000-0000-0000-0000000005e1}', '[]',
  'Schedule Dev put Mobilize on Schedule test P''s schedule, Mon Nov 2 to Tue Nov 3, Our own crew. 1 activity waits on it.')::text, '12');
SELECT gst.same('Electrical · Rough-in waits on Mobilize',
  (SELECT count(*)::text FROM public.gc_schedule_links WHERE from_activity_id = '00000000-0000-0000-0000-0000000005f3' AND to_activity_id = '00000000-0000-0000-0000-0000000005e1'), '1');
SELECT gst.refused('a trade''s line taken off', $q$SELECT public.gc_schedule_remove_activity('00000000-0000-0000-0000-0000000005a1', 12, '00000000-0000-0000-0000-0000000005e3', 'Took it off.')$q$,
  'Only the job''s own work comes off.');
SELECT gst.same('Mobilize off, as version 13', public.gc_schedule_remove_activity('00000000-0000-0000-0000-0000000005a1', 12, '00000000-0000-0000-0000-0000000005f3',
  'Mobilize came off Schedule test P''s schedule.')::text, '13');
SELECT gst.same('nothing waits on Mobilize now',
  (SELECT count(*)::text FROM public.gc_schedule_links WHERE from_activity_id = '00000000-0000-0000-0000-0000000005f3'), '0');

-- 10 · An inspection fails and moves to its re-inspection day; another passes and meets its date.
SELECT gst.refused('a failure with no words', $q$SELECT public.gc_schedule_fail_inspection('00000000-0000-0000-0000-0000000005a1', 13, '00000000-0000-0000-0000-0000000005f2',
    '{"note": "  ", "packageIds": [], "reinspectOn": "2031-01-06"}', '[]', 'It failed.')$q$, 'Say what failed.');
SELECT gst.refused('a re-inspection today', format($q$SELECT public.gc_schedule_fail_inspection('00000000-0000-0000-0000-0000000005a1', 13, '00000000-0000-0000-0000-0000000005f2',
    '{"note": "Missing labels.", "packageIds": [], "reinspectOn": "%s"}', '[]', 'It failed.')$q$, public.app_today()), 'Pick a day after today for the re-inspection.');
SELECT gst.same('the final inspection fails, as version 14', public.gc_schedule_fail_inspection('00000000-0000-0000-0000-0000000005a1', 13, '00000000-0000-0000-0000-0000000005f2',
  '{"note": "Panel labels missing.", "packageIds": ["00000000-0000-0000-0000-0000000005b1", "00000000-0000-0000-0000-0000000005b3"], "reinspectOn": "2031-01-06"}',
  '[{"id": "00000000-0000-0000-0000-0000000005f2", "start": "2031-01-06", "finish": "2031-01-07"}]',
  'The final inspection failed on Schedule test P: Panel labels missing. It was Electrical''s work. Re-inspection Mon Jan 6.')::text, '14');
SELECT gst.same('the failure keeps only this job''s trades, and the bar moved',
  (SELECT f.note || ' ' || cardinality(f.package_ids) || ' ' || f.reinspect_on FROM public.gc_schedule_inspection_failures f WHERE f.activity_id = '00000000-0000-0000-0000-0000000005f2')
  || ' / ' || (SELECT start || '..' || finish FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005f2'),
  'Panel labels missing. 1 2031-01-06 / 2031-01-06..2031-01-07');
INSERT INTO ids SELECT 'met', public.gc_schedule_pass_inspection('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1');
SELECT gst.same('the rough-in inspection passes today and meets its date, with no version',
  (SELECT (id = '00000000-0000-0000-0000-000000000572')::text FROM ids WHERE k = 'met')
  || ' ' || (SELECT (passed_on = public.app_today())::text FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005f1')
  || ' ' || (SELECT (met_on = public.app_today())::text FROM public.gc_schedule_milestones WHERE id = '00000000-0000-0000-0000-000000000572')
  || ' ' || gst.version('00000000-0000-0000-0000-0000000005a1'), 'true true true 14');
SELECT gst.refused('a pass twice', $q$SELECT public.gc_schedule_pass_inspection('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1')$q$,
  'This inspection passed already.');

-- 11 · Places (G-83), refused whole; their dates to meet (G-145); a wait with what it holds (G-73).
SELECT gst.refused('a place on an inspection, beside a good one', $q$SELECT public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1',
    '{"00000000-0000-0000-0000-0000000005e1": "Roof", "00000000-0000-0000-0000-0000000005f1": "Inside"}')$q$,
  'An inspection and the job''s own work take no place.');
SELECT gst.refused('a place of 41 letters', format($q$SELECT public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1', '{"00000000-0000-0000-0000-0000000005e1": "%s"}')$q$, repeat('x', 41)),
  'A place is 40 characters at most.');
SELECT gst.same('two places kept', public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1',
  '{"00000000-0000-0000-0000-0000000005e1": "  Level   2 ", "00000000-0000-0000-0000-0000000005e3": "Roof"}')::text, '2');
SELECT gst.same('a place already there is no change', public.gc_schedule_set_places('00000000-0000-0000-0000-0000000005a1',
  '{"00000000-0000-0000-0000-0000000005e3": "Roof"}')::text, '0');
SELECT gst.same('places are tidied as kept, with no version',
  (SELECT string_agg(place, ' | ' ORDER BY position) FROM public.gc_schedule_activities WHERE project_id = '00000000-0000-0000-0000-0000000005a1' AND place IS NOT NULL)
  || ' / ' || gst.version('00000000-0000-0000-0000-0000000005a1'), 'Level 2 | Roof / 14');
SELECT gst.refused('their date on one of ours that is met', $q$SELECT public.gc_schedule_their_dates('00000000-0000-0000-0000-0000000005a1',
    '[{"id": "00000000-0000-0000-0000-000000000572", "label": "Rough-in inspection", "planned": "2026-11-20"}]')$q$,
  'One of our dates is met already, or not on this job.');
SELECT gst.same('their dates: two taken', public.gc_schedule_their_dates('00000000-0000-0000-0000-0000000005a1',
  '[{"id": "00000000-0000-0000-0000-000000000571", "label": "Substantial completion", "planned": "2026-12-04"}, {"label": "Owner move-in", "planned": "2026-12-18"}]')::text, '2');
SELECT gst.same('their dates: one of ours moved, one of theirs added as the job''s own, with no version',
  (SELECT string_agg(label || ' ' || planned, ' | ' ORDER BY position) FROM public.gc_schedule_milestones WHERE project_id = '00000000-0000-0000-0000-0000000005a1')
  || ' / ' || gst.version('00000000-0000-0000-0000-0000000005a1'),
  'Rough-in inspection 2026-11-17 | Substantial completion 2026-12-04 | Owner move-in 2026-12-18 / 14');
SELECT gst.refused('a wait that holds another job''s bar', $q$SELECT public.gc_schedule_add_wait('00000000-0000-0000-0000-0000000005a1',
    '{"kind": "delivery", "title": "Switchgear", "who": "", "expectedOn": "2026-11-10", "activityIds": ["00000000-0000-0000-0000-0000000005e4"]}')$q$,
  'A wait names a bar that is not on this schedule.');
INSERT INTO ids SELECT 'wait', public.gc_schedule_add_wait('00000000-0000-0000-0000-0000000005a1',
  '{"kind": "delivery", "title": "Switchgear", "packageId": "00000000-0000-0000-0000-0000000005b1", "who": "", "expectedOn": "2026-11-10", "activityIds": ["00000000-0000-0000-0000-0000000005e1"]}');
SELECT gst.same('a wait, its empty who kept for the kind''s own, and the bar it holds, with no version',
  (SELECT w.title || ' [' || w.who || '] ' || (SELECT count(*) FROM public.gc_schedule_wait_holds h WHERE h.wait_id = w.id)
   FROM public.gc_schedule_waits w WHERE w.id = (SELECT id FROM ids WHERE k = 'wait'))
  || ' / ' || gst.version('00000000-0000-0000-0000-0000000005a1'), 'Switchgear [] 1 / 14');

-- 12 · Keep a what-if (G-81): the person's copy's two moves, oldest first, one version; the copy goes;
-- Undo takes the newest kept first.
INSERT INTO public.gc_schedule_what_ifs (project_id, user_id, made_on, base_version, base, copy)
VALUES ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005d1', DATE '2026-10-07', 14, '{}', '{}');
SELECT gst.refused('a keep with a move with no reason', $q$SELECT public.gc_schedule_keep_what_if('00000000-0000-0000-0000-0000000005a1', 14, 'Kept a what-if.',
    '[{"activityId": "00000000-0000-0000-0000-0000000005e1", "reason": "other", "note": "No"}]', '[]')$q$,
  'Give each move a reason and a sentence.');
SELECT gst.same('a what-if kept, as version 15', public.gc_schedule_keep_what_if('00000000-0000-0000-0000-0000000005a1', 14,
  'Schedule Dev kept a what-if on Schedule test P: 2 moves on the schedule, each with its reason.',
  $j$[{"activityId": "00000000-0000-0000-0000-0000000005e1", "activityName": "Electrical · Rough-in", "reason": "us", "note": "Tried a day later first, it frees the lift.",
       "from": {"start": "2026-11-04", "finish": "2026-11-17"}, "to": {"start": "2026-11-05", "finish": "2026-11-18"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []},
      {"activityId": "00000000-0000-0000-0000-0000000005e3", "activityName": "Plumbing · Rough-in", "reason": "us", "note": "Plumbing follows the lift by a day.",
       "from": {"start": "2026-11-03", "finish": "2026-11-13"}, "to": {"start": "2026-11-04", "finish": "2026-11-14"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}]$j$,
  '[{"id": "00000000-0000-0000-0000-0000000005e1", "start": "2026-11-05", "finish": "2026-11-18"}, {"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-04", "finish": "2026-11-14"}]')::text, '15');
SELECT gst.same('the kept moves: one version, tried in a copy that day, in their order; the copy is gone',
  (SELECT string_agg(m.activity_name || ' ' || m.schedule_version || ' ' || m.from_what_if_on, ' | ' ORDER BY m.made_at)
   FROM public.gc_schedule_moves m WHERE m.project_id = '00000000-0000-0000-0000-0000000005a1' AND m.from_what_if_on IS NOT NULL)
  || ' / ' || (SELECT count(*) FROM public.gc_schedule_what_ifs WHERE project_id = '00000000-0000-0000-0000-0000000005a1'),
  'Electrical · Rough-in 15 2026-10-07 | Plumbing · Rough-in 15 2026-10-07 / 0');
SELECT gst.refused('the first kept move, while the second stands', format($q$SELECT public.gc_schedule_undo('00000000-0000-0000-0000-0000000005a1', 15, '%s', 'Undid it.')$q$,
    (SELECT id FROM public.gc_schedule_moves WHERE project_id = '00000000-0000-0000-0000-0000000005a1' AND activity_name = 'Electrical · Rough-in' AND from_what_if_on IS NOT NULL)),
  'Only the newest move can be undone.');
SELECT gst.refused('a keep with no copy open', $q$SELECT public.gc_schedule_keep_what_if('00000000-0000-0000-0000-0000000005a1', 15, 'Kept a what-if.',
    '[{"activityId": "00000000-0000-0000-0000-0000000005e1", "reason": "us", "note": "Tried a day later first."}]', '[]')$q$,
  'There is no what-if open.');

-- 13 · The guard: the plan changes only through its presses, even for a dev; a record does not need one.
SELECT gst.refused('a bar''s days written straight to the table', $q$UPDATE public.gc_schedule_activities SET start = start + 1 WHERE id = '00000000-0000-0000-0000-0000000005e3'$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('a wait taken off straight from the table', $q$DELETE FROM public.gc_schedule_links WHERE project_id = '00000000-0000-0000-0000-0000000005a1'$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('a line of words written straight to the table', $q$INSERT INTO public.gc_schedule_changes (project_id, version, words) VALUES ('00000000-0000-0000-0000-0000000005a1', 99, 'Nobody pressed this.')$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('a move marked undone straight in the table', $q$UPDATE public.gc_schedule_moves SET undone_on = DATE '2026-10-07' WHERE project_id = '00000000-0000-0000-0000-0000000005a1'$q$,
  'Change the schedule through its own presses');
SELECT gst.refused('the version written straight to the table', $q$UPDATE public.gc_schedules SET version = 0 WHERE project_id = '00000000-0000-0000-0000-0000000005a1'$q$,
  'Change the schedule through its own presses');
UPDATE public.gc_schedule_activities SET actual_start = DATE '2026-11-05' WHERE id = '00000000-0000-0000-0000-0000000005e1';
SELECT gst.same('a real day is a record: written straight, no version',
  (SELECT actual_start::text FROM public.gc_schedule_activities WHERE id = '00000000-0000-0000-0000-0000000005e1') || ' ' || gst.version('00000000-0000-0000-0000-0000000005a1'),
  '2026-11-05 15');

-- 14 · Another job's bar, a reader in training mode, and someone the policies do not let in.
SELECT gst.same('Q drawn from the template, by its name that day', public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', NULL,
  'Drew a first draft of the schedule on Schedule test Q: 2 activities from Mon Nov 2. It is drawn from the template Schedule test shape.',
  '{"template": {"id": "00000000-0000-0000-0000-000000000591"},
    "bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-02", "finish": "2026-11-06", "after": []},
             {"kind": "inspection", "id": "00000000-0000-0000-0000-0000000005f8", "label": "Final inspection", "start": "2026-11-09", "finish": "2026-11-10",
              "after": [{"id": "00000000-0000-0000-0000-0000000005e4", "gap": 0}]}]}')::text, '1');
SELECT gst.same('Q keeps the template''s name as it read today',
  (SELECT template_name || ' ' || (template_used_on = public.app_today()) FROM public.gc_schedules WHERE project_id = '00000000-0000-0000-0000-0000000005a2'),
  'Schedule test shape true');
SELECT gst.refused('a move on P naming Q''s bar', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 15, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e4", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-02", "finish": "2026-11-06"}, "to": {"start": "2026-11-03", "finish": "2026-11-07"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e4", "start": "2026-11-03", "finish": "2026-11-07"}]')$q$,
  'A bar in this change is not on this schedule.');
SELECT gst.same('Q drawn again before Start, as version 2', public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', 1, 'Drew the schedule on Schedule test Q again.',
  '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')::text, '2');
SELECT gst.same('the new draw took the old one''s place, with no template',
  gst.bars('00000000-0000-0000-0000-0000000005a2') || ' / ' ||
  (SELECT coalesce(template_name, 'no template') FROM public.gc_schedules WHERE project_id = '00000000-0000-0000-0000-0000000005a2'),
  '5e4 2026-11-09..2026-11-13 / no template');
SELECT gst.same('a move on Q, as version 3', public.gc_schedule_move('00000000-0000-0000-0000-0000000005a2', 2, 'Electrical · Service now runs Tue Nov 10 to Mon Nov 16. Schedule Dev: The utility moved the cutover.',
  '{"activityId": "00000000-0000-0000-0000-0000000005e4", "activityName": "Electrical · Service", "reason": "customer", "note": "The utility moved the cutover.", "from": {"start": "2026-11-09", "finish": "2026-11-13"}, "to": {"start": "2026-11-10", "finish": "2026-11-16"}, "finishFrom": "2026-11-13", "finishTo": "2026-11-16", "pushed": []}',
  '[{"id": "00000000-0000-0000-0000-0000000005e4", "start": "2026-11-10", "finish": "2026-11-16"}]')::text, '3');
SELECT gst.refused('Q drawn again once it has a move', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', 3, 'Drew it again.',
    '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')$q$,
  'The schedule has moves with their reasons. They stay as they are.');
SELECT gst.refused('P drawn again after Start', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a1', 15, 'Drew it again.',
    '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e1", "packageId": "00000000-0000-0000-0000-0000000005b1", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')$q$,
  'A new set of plans is the way to change its schedule now.');
RESET ROLE;
UPDATE public.gc_projects SET stage = 'bidding' WHERE project_id = '00000000-0000-0000-0000-0000000005a2';
SET LOCAL ROLE authenticated;
SELECT gst.refused('a draw while we bid', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000005a2', 3, 'Drew it again.',
    '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000005e4", "packageId": "00000000-0000-0000-0000-0000000005b3", "start": "2026-11-09", "finish": "2026-11-13", "after": []}]}')$q$,
  'While we bid, the rough schedule is the one to draw.');

SELECT gst.as_user('00000000-0000-0000-0000-0000000005d2');
SELECT gst.refused('a move in training mode', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 15, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-04", "finish": "2026-11-14"}, "to": {"start": "2026-11-05", "finish": "2026-11-15"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-05", "finish": "2026-11-15"}]')$q$,
  'Read-only (training) mode: changes are blocked.');
SELECT gst.as_user('00000000-0000-0000-0000-0000000005d3');
SELECT gst.refused('a move by someone the policies keep out', $q$SELECT public.gc_schedule_move('00000000-0000-0000-0000-0000000005a1', 15, 'Moved.',
    '{"activityId": "00000000-0000-0000-0000-0000000005e3", "reason": "crew", "note": "The crew is short this week.", "from": {"start": "2026-11-04", "finish": "2026-11-14"}, "to": {"start": "2026-11-05", "finish": "2026-11-15"}, "finishFrom": "2031-01-07", "finishTo": "2031-01-07", "pushed": []}',
    '[{"id": "00000000-0000-0000-0000-0000000005e3", "start": "2026-11-05", "finish": "2026-11-15"}]')$q$,
  'This job has no schedule yet.');
SELECT gst.as_user('00000000-0000-0000-0000-0000000005d1');

-- 15 · The two template refusals the kernel words first (templateSaveProblem): the table holds the
-- same two shapes without the words, as the last line.
SELECT gst.refused('a template with no lines, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, from_name, from_done_pct, saved_on, lines, stages, weeks)
    VALUES ('No lines', 'Schedule test P', 0, DATE '2026-10-07', '[]', '[]', 1)$q$, 'gc_schedule_templates_lines_listed');
SELECT gst.refused('a template under a week, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, from_name, from_done_pct, saved_on, lines, stages, weeks)
    VALUES ('No weeks', 'Schedule test P', 0, DATE '2026-10-07', '[{"trade": "Electrical", "label": "Service"}]', '[]', 0)$q$, 'gc_schedule_templates_weeks_counted');

-- 16 · The words: one line for each plan write, in order, and nothing else on the record.
SELECT gst.same('P has a line of words for each of its 15 versions',
  (SELECT count(*) || ' ' || min(version) || '..' || max(version) FROM public.gc_schedule_changes WHERE project_id = '00000000-0000-0000-0000-0000000005a1'), '15 1..15');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'gc_schedule PASSED'; END $$;
ROLLBACK;
