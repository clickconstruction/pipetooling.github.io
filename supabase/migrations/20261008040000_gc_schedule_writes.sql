SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 5 (v2.4848): the schedule's writes, so a press is all or
-- nothing (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md on branch spike/gc-mode, "Writing it" and "Two people
-- on one schedule"; the plan is to-dos/gc-mode/mockups/schedule-pr5.md). The kernels stay in
-- TypeScript: a press works its answer out in the screen and sends the answer here. Every plan write
-- sends the version of the schedule it read; gc_schedule_bump checks it and bumps it, and keeps the
-- press's words, or refuses with "The schedule changed while you were working." and every change
-- since, as JSON in the DETAIL (decision 5). The plan at Start is kept first on a job being built
-- (decision 7). A record that touches several rows is a function with no version; every other
-- record stays a plain write under RLS (decision 9). A trigger lets the plan's own rows change only
-- inside a plan write, so the version counts every change. Each function is SECURITY INVOKER, so the
-- tables' policies decide who may: dev only until the schedule's PR 10. A record's day is the
-- company's, public.app_today(), never the server's UTC date.

-- ---------------------------------------------------------------------------------------------
-- The guard: the plan changes only inside a plan write
-- ---------------------------------------------------------------------------------------------

-- gc_schedule_bump turns this transaction's flag on once the version is checked, and the plan write
-- turns it off before it returns (the house pattern of app.quick_add_rpc). A record never needs it: a
-- real day, a place, a pass, a day done, a part's percent. A row that goes with its job, its trade or
-- its scope line passes too, since it changes inside the cascade's own trigger.
CREATE OR REPLACE FUNCTION public.gc_schedule_plan_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_setting('gc.schedule_plan_write', true) IS DISTINCT FROM 'on' AND pg_trigger_depth() < 2 THEN
    IF TG_OP <> 'UPDATE' THEN
      RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
    ELSIF TG_TABLE_NAME = 'gc_schedule_activities' THEN
      -- A bar's plan: which bar it is and its days and limits. Its real days, place, pass and day done are records.
      IF (NEW.project_id, NEW.kind, NEW.scope_item_id, NEW.package_id, NEW.start, NEW.finish, NEW.not_before, NEW.must_finish_by)
         IS DISTINCT FROM (OLD.project_id, OLD.kind, OLD.scope_item_id, OLD.package_id, OLD.start, OLD.finish, OLD.not_before, OLD.must_finish_by) THEN
        RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
      END IF;
    ELSIF TG_TABLE_NAME = 'gc_schedule_activity_parts' THEN
      -- A part's plan: its days and share. Its percent and real days are its reports.
      IF (NEW.activity_id, NEW.from_day, NEW.days, NEW.share) IS DISTINCT FROM (OLD.activity_id, OLD.from_day, OLD.days, OLD.share) THEN
        RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      RAISE EXCEPTION 'Change the schedule through its own presses, so its version counts the change.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gc_schedule_plan_guard() IS
  'GC mode (v2.4848): the trigger that lets a schedule''s plan change only inside a plan write (gc_schedule_bump sets gc.schedule_plan_write for the transaction), so gc_schedules.version counts every change (decision 5). Records pass: a bar''s real days, place, pass and day done, a part''s percent and real days. A cascade passes (pg_trigger_depth() > 1).';

-- On the plan's ten tables, made only where missing, so a second run takes no lock.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['gc_schedules', 'gc_schedule_activities', 'gc_schedule_activity_parts', 'gc_schedule_links',
    'gc_schedule_inspection_failures', 'gc_schedule_baselines', 'gc_schedule_baseline_dates', 'gc_schedule_changes',
    'gc_schedule_moves', 'gc_schedule_move_pushes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'gc_schedule_plan_guard' AND tgrelid = format('public.%I', v_table)::regclass
    ) THEN
      EXECUTE format('CREATE TRIGGER gc_schedule_plan_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gc_schedule_plan_guard()', v_table);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- The steps every plan write shares
-- ---------------------------------------------------------------------------------------------

-- A plan write's first step (decision 5). It checks the version the press read and bumps it, keeps the
-- press's words as the change, and turns on the flag the guard reads; the plan write turns it off
-- before it returns. No version read: a first draft, which makes the schedule's row at version 1. A
-- version that is not the schedule's: refused, with every change since, oldest first, as JSON in the
-- DETAIL. The row stays locked to the end of the transaction, so two writes never interleave.
CREATE OR REPLACE FUNCTION public.gc_schedule_bump(p_project_id uuid, p_version integer, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_since jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF btrim(coalesce(p_words, '')) = '' THEN
    RAISE EXCEPTION 'A change to the schedule needs its words.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('gc.schedule_plan_write', 'on', true);
  IF p_version IS NULL THEN
    INSERT INTO public.gc_schedules (project_id, version, drafted_on, drafted_by)
    VALUES (p_project_id, 1, public.app_today(), auth.uid())
    ON CONFLICT (project_id) DO NOTHING
    RETURNING version INTO v_version;
  ELSE
    UPDATE public.gc_schedules
       SET version = version + 1, updated_at = now(), updated_by = auth.uid()
     WHERE project_id = p_project_id AND version = p_version
    RETURNING version INTO v_version;
  END IF;
  IF v_version IS NULL THEN
    IF p_version IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'This job has no schedule yet. Draw its first draft.' USING ERRCODE = 'P0001';
    END IF;
    SELECT jsonb_build_object(
             'read', p_version,
             'version', (SELECT s.version FROM public.gc_schedules s WHERE s.project_id = p_project_id),
             'changes', coalesce(jsonb_agg(jsonb_build_object('version', c.version, 'at', c.made_at, 'by', c.made_by, 'name', u.name, 'words', c.words) ORDER BY c.version), '[]'::jsonb))
      INTO v_since
      FROM public.gc_schedule_changes c
      LEFT JOIN public.users u ON u.id = c.made_by
     WHERE c.project_id = p_project_id AND c.version > coalesce(p_version, 0);
    RAISE EXCEPTION 'The schedule changed while you were working.' USING ERRCODE = 'P0001', DETAIL = v_since::text;
  END IF;
  INSERT INTO public.gc_schedule_changes (project_id, version, made_by, words)
  VALUES (p_project_id, v_version, auth.uid(), btrim(p_words));
  RETURN v_version;
END;
$$;

-- The plan as it stands kept as the baseline At Start (decision 7): on a job that started and has none
-- yet, before the plan write that calls it changes anything. Its day is the job's Start day once Start
-- records one (gc_projects.started_on, the Board lane's B1, read so this needs no change when it
-- lands), and until then the day of this first change.
CREATE OR REPLACE FUNCTION public.gc_schedule_keep_start(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project jsonb;
  v_baseline uuid;
BEGIN
  SELECT to_jsonb(g) INTO v_project FROM public.gc_projects g WHERE g.project_id = p_project_id;
  IF v_project IS NULL
     OR NOT (v_project ->> 'stage' IN ('building', 'closed') OR v_project ->> 'started_on' IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.gc_schedule_baselines WHERE project_id = p_project_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.gc_schedule_baselines (project_id, name, locked_on, locked_by)
  VALUES (p_project_id, NULL, coalesce((v_project ->> 'started_on')::date, public.app_today()), auth.uid())
  RETURNING id INTO v_baseline;
  INSERT INTO public.gc_schedule_baseline_dates (baseline_id, activity_id, start, finish)
  SELECT v_baseline, a.id, a.start, a.finish FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id;
END;
$$;

-- The bars as the kernel left them (the answer, not the question): each bar's new days, and when sent,
-- its limits, its whole list of waits with their gaps, and its parts' days. A key left out leaves that
-- part of the bar as it is. A limit sent as null comes off.
CREATE OR REPLACE FUNCTION public.gc_schedule_set_bars(p_project_id uuid, p_bars jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar_in jsonb;
  v_wait_in jsonb;
  v_part_in jsonb;
  v_id uuid;
  v_start date;
  v_finish date;
  v_after uuid[];
BEGIN
  FOR v_bar_in IN SELECT value FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) LOOP
    v_id := nullif(v_bar_in ->> 'id', '')::uuid;
    v_start := nullif(v_bar_in ->> 'start', '')::date;
    v_finish := nullif(v_bar_in ->> 'finish', '')::date;
    IF v_start IS NULL OR v_finish IS NULL THEN
      RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
    END IF;
    IF v_finish < v_start THEN
      RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.gc_schedule_activities
       SET start = v_start,
           finish = v_finish,
           not_before = CASE WHEN v_bar_in ? 'notBefore' THEN nullif(v_bar_in ->> 'notBefore', '')::date ELSE not_before END,
           must_finish_by = CASE WHEN v_bar_in ? 'mustFinishBy' THEN nullif(v_bar_in ->> 'mustFinishBy', '')::date ELSE must_finish_by END
     WHERE project_id = p_project_id AND id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    IF v_bar_in ? 'after' THEN
      v_after := ARRAY(SELECT nullif(w.v ->> 'id', '')::uuid FROM jsonb_array_elements(coalesce(v_bar_in -> 'after', '[]'::jsonb)) AS w(v));
      IF v_id = ANY (v_after) THEN
        RAISE EXCEPTION 'A bar cannot wait on itself.' USING ERRCODE = 'P0001';
      END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(v_after) AS f(id)
        WHERE f.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = f.id)
      ) THEN
        RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
      END IF;
      DELETE FROM public.gc_schedule_links WHERE to_activity_id = v_id AND NOT (from_activity_id = ANY (v_after));
      FOR v_wait_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'after', '[]'::jsonb)) LOOP
        INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
        VALUES (p_project_id, (v_wait_in ->> 'id')::uuid, v_id, coalesce((v_wait_in ->> 'gap')::integer, 0))
        ON CONFLICT (from_activity_id, to_activity_id) DO UPDATE SET gap = EXCLUDED.gap;
      END LOOP;
    END IF;
    IF v_bar_in ? 'parts' THEN
      FOR v_part_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'parts', '[]'::jsonb)) LOOP
        IF coalesce((v_part_in ->> 'fromDay')::integer, -1) < 0 OR coalesce((v_part_in ->> 'days')::integer, 0) < 1 THEN
          RAISE EXCEPTION 'Each part has to finish on or after it starts.' USING ERRCODE = 'P0001';
        END IF;
        UPDATE public.gc_schedule_activity_parts
           SET from_day = (v_part_in ->> 'fromDay')::integer, days = (v_part_in ->> 'days')::integer
         WHERE activity_id = v_id AND id = nullif(v_part_in ->> 'id', '')::uuid;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'A part in this change is not on its bar.' USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Why a bar moved, the person's own: a reason from the list and their words, a sentence at least
-- (moveWhyProblem; MOVE_NOTE_MIN is 8). Checked before the version, so the person fixes their words first.
CREATE OR REPLACE FUNCTION public.gc_schedule_check_why(p_reason text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF coalesce(btrim(p_reason), '') NOT IN ('weather', 'trade before', 'materials', 'crew', 'customer', 'plans', 'inspection', 'us', 'change order', 'other', 'early', 'recovery') THEN
    RAISE EXCEPTION 'Pick why it moved.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(btrim(coalesce(p_note, ''))) < 8 THEN
    RAISE EXCEPTION 'Say what happened, in a sentence.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- One move as the kernel recorded it (ScheduleMove), with what it pushed, under the version its plan
-- write made. Its day is the company's and its name the mover's as it reads today. A late notice it
-- takes is this bar's, and taken once. Returns the move's id.
CREATE OR REPLACE FUNCTION public.gc_schedule_save_move(p_project_id uuid, p_version integer, p_move jsonb, p_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_bar uuid := nullif(p_move ->> 'activityId', '')::uuid;
  v_notice uuid := nullif(p_move ->> 'lateNoticeId', '')::uuid;
  v_after uuid := nullif(p_move #>> '{recovery,afterActivityId}', '')::uuid;
  v_push_in jsonb;
BEGIN
  IF nullif(p_move #>> '{from,start}', '') IS NULL OR nullif(p_move #>> '{from,finish}', '') IS NULL
     OR nullif(p_move #>> '{to,start}', '') IS NULL OR nullif(p_move #>> '{to,finish}', '') IS NULL
     OR nullif(p_move ->> 'finishFrom', '') IS NULL OR nullif(p_move ->> 'finishTo', '') IS NULL THEN
    RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
  END IF;
  IF (p_move #>> '{to,finish}')::date < (p_move #>> '{to,start}')::date THEN
    RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = v_bar)
     OR (v_after IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = v_after))
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) AS x(v)
       WHERE NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = nullif(x.v ->> 'activityId', '')::uuid)
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pullFinished', '[]'::jsonb)) AS x(v)
       WHERE NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = nullif(x.v #>> '{}', '')::uuid)
     ) THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_move -> 'parts') = 'object' AND NOT EXISTS (
    SELECT 1 FROM public.gc_schedule_activity_parts WHERE activity_id = v_bar AND id = nullif(p_move #>> '{parts,id}', '')::uuid
  ) THEN
    RAISE EXCEPTION 'A part in this change is not on its bar.' USING ERRCODE = 'P0001';
  END IF;
  IF v_notice IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_late_notices WHERE id = v_notice AND project_id = p_project_id AND activity_id = v_bar) THEN
      RAISE EXCEPTION 'That late notice is not on this bar.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gc_schedule_moves WHERE late_notice_id = v_notice AND undone_on IS NULL) THEN
      RAISE EXCEPTION 'That late notice was taken already.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  INSERT INTO public.gc_schedule_moves (
    project_id, activity_id, activity_name, made_on, made_at, made_by, made_by_name,
    from_start, from_finish, to_start, to_finish, reason, note, links_changed, finish_from, finish_to,
    change_order_id, late_notice_id, pull_finished,
    recovery_how, recovery_after_activity_id, recovery_gap_was, recovery_gap,
    from_what_if_on, parts, schedule_version
  ) VALUES (
    p_project_id, v_bar, coalesce(nullif(btrim(p_move ->> 'activityName'), ''), 'An activity'),
    public.app_today(), p_at, auth.uid(),
    coalesce((SELECT nullif(btrim(u.name), '') FROM public.users u WHERE u.id = auth.uid()), nullif(btrim(p_move ->> 'madeByName'), ''), 'The office'),
    (p_move #>> '{from,start}')::date, (p_move #>> '{from,finish}')::date, (p_move #>> '{to,start}')::date, (p_move #>> '{to,finish}')::date,
    btrim(p_move ->> 'reason'), btrim(p_move ->> 'note'), coalesce((p_move ->> 'linksChanged')::boolean, false),
    (p_move ->> 'finishFrom')::date, (p_move ->> 'finishTo')::date,
    nullif(p_move ->> 'changeOrderId', '')::uuid, v_notice,
    CASE WHEN jsonb_typeof(p_move -> 'pullFinished') = 'array'
      THEN ARRAY(SELECT (x.v #>> '{}')::uuid FROM jsonb_array_elements(p_move -> 'pullFinished') AS x(v)) END,
    nullif(p_move #>> '{recovery,how}', ''), v_after,
    (p_move #>> '{recovery,gapWas}')::integer, (p_move #>> '{recovery,gap}')::integer,
    nullif(p_move ->> 'fromWhatIfOn', '')::date,
    CASE WHEN jsonb_typeof(p_move -> 'parts') = 'object' THEN p_move -> 'parts' END,
    p_version
  ) RETURNING id INTO v_id;
  FOR v_push_in IN SELECT value FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) LOOP
    INSERT INTO public.gc_schedule_move_pushes (move_id, activity_id, from_start, from_finish, to_start, to_finish)
    VALUES (v_id, (v_push_in ->> 'activityId')::uuid,
            (v_push_in #>> '{from,start}')::date, (v_push_in #>> '{from,finish}')::date,
            (v_push_in #>> '{to,start}')::date, (v_push_in #>> '{to,finish}')::date);
  END LOOP;
  RETURN v_id;
END;
$$;

-- True while every bar a move touched sits where the move left it (p_at_from false: Undo's test) or
-- where Undo put it back (p_at_from true: Redo's), as undoableMove and redoableMove ask. A bar since
-- removed does not sit anywhere.
CREATE OR REPLACE FUNCTION public.gc_schedule_move_sits(p_move_id uuid, p_at_from boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.gc_schedule_moves m JOIN public.gc_schedule_activities a ON a.id = m.activity_id
           WHERE m.id = p_move_id
             AND a.start = CASE WHEN p_at_from THEN m.from_start ELSE m.to_start END
             AND a.finish = CASE WHEN p_at_from THEN m.from_finish ELSE m.to_finish END)
     AND NOT EXISTS (
           SELECT 1 FROM public.gc_schedule_move_pushes x LEFT JOIN public.gc_schedule_activities a ON a.id = x.activity_id
           WHERE x.move_id = p_move_id
             AND (a.id IS NULL
               OR a.start <> CASE WHEN p_at_from THEN x.from_start ELSE x.to_start END
               OR a.finish <> CASE WHEN p_at_from THEN x.from_finish ELSE x.to_finish END))
$$;

-- A kept move put back (p_back) or forward again: its bar and every bar it pushed, the gap a
-- side-by-side move changed on its wait (G-82), and a part's days (G-39), all from the move's own
-- record, so Undo and Redo do exactly what the move did, the other way.
CREATE OR REPLACE FUNCTION public.gc_schedule_put_move(p_move_id uuid, p_back boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_move public.gc_schedule_moves;
  v_part_in jsonb;
BEGIN
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id;
  UPDATE public.gc_schedule_activities
     SET start = CASE WHEN p_back THEN v_move.from_start ELSE v_move.to_start END,
         finish = CASE WHEN p_back THEN v_move.from_finish ELSE v_move.to_finish END
   WHERE id = v_move.activity_id;
  UPDATE public.gc_schedule_activities a
     SET start = CASE WHEN p_back THEN x.from_start ELSE x.to_start END,
         finish = CASE WHEN p_back THEN x.from_finish ELSE x.to_finish END
    FROM public.gc_schedule_move_pushes x
   WHERE x.move_id = v_move.id AND a.id = x.activity_id;
  IF v_move.recovery_how = 'side' AND v_move.recovery_after_activity_id IS NOT NULL THEN
    UPDATE public.gc_schedule_links
       SET gap = CASE WHEN p_back THEN coalesce(v_move.recovery_gap_was, 0) ELSE coalesce(v_move.recovery_gap, 0) END
     WHERE from_activity_id = v_move.recovery_after_activity_id AND to_activity_id = v_move.activity_id;
  END IF;
  FOR v_part_in IN
    SELECT value FROM jsonb_array_elements(coalesce(v_move.parts -> (CASE WHEN p_back THEN 'was' ELSE 'now' END), '[]'::jsonb))
  LOOP
    UPDATE public.gc_schedule_activity_parts
       SET from_day = (v_part_in ->> 'from')::integer, days = (v_part_in ->> 'days')::integer
     WHERE activity_id = v_move.activity_id AND id = (v_part_in ->> 'id')::uuid;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- The plan writes: each checks and bumps the version and returns the new one
-- ---------------------------------------------------------------------------------------------

-- The first draft (draftSchedule, from a template's lines when one is named, G-44), or a file's
-- schedule (importSchedule, G-137): the bars, what each waits on, a split line's parts (a template's)
-- and the dates to meet, as the kernel drew them. A line's bar takes its scope line's id. With a
-- version read, it takes the place of a schedule drawn before Start that nobody walked or moved
-- (importRefusal). Never while we bid or on a lost job.
CREATE OR REPLACE FUNCTION public.gc_schedule_draft(p_project_id uuid, p_version integer, p_words text, p_draft jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_stage text;
  v_lost date;
  v_template uuid := nullif(p_draft #>> '{template,id}', '')::uuid;
  v_ids uuid[];
  v_bar_in jsonb;
  v_wait_in jsonb;
  v_part_in jsonb;
  v_ms_in jsonb;
  v_id uuid;
  v_kind text;
  v_i integer := 0;
  v_j integer;
BEGIN
  SELECT stage, lost_on INTO v_stage, v_lost FROM public.gc_projects WHERE project_id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'This job was lost.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'bidding' THEN
    RAISE EXCEPTION 'While we bid, the rough schedule is the one to draw.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_draft -> 'bars') IS DISTINCT FROM 'array' OR jsonb_array_length(p_draft -> 'bars') = 0 THEN
    RAISE EXCEPTION 'A draft needs its bars.' USING ERRCODE = 'P0001';
  END IF;
  -- Every bar's id: a line's is its scope line's, the others' the kernel's.
  v_ids := ARRAY(
    SELECT CASE WHEN d.v ->> 'kind' = 'line' THEN nullif(d.v ->> 'scopeItemId', '')::uuid ELSE nullif(d.v ->> 'id', '')::uuid END
    FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
  );
  IF EXISTS (SELECT 1 FROM unnest(v_ids) AS i(id) WHERE i.id IS NULL) THEN
    RAISE EXCEPTION 'Each bar in the draft needs its id.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
    WHERE coalesce(d.v ->> 'kind', '') NOT IN ('line', 'inspection', 'added')
       OR (d.v ->> 'kind' <> 'line' AND btrim(coalesce(d.v ->> 'label', '')) = '')
       OR (d.v ->> 'kind' = 'added' AND btrim(coalesce(d.v ->> 'who', '')) = '')
  ) THEN
    RAISE EXCEPTION 'Each inspection and each of the job''s own bars needs its name.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
    WHERE nullif(d.v ->> 'start', '') IS NULL OR nullif(d.v ->> 'finish', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v) WHERE (d.v ->> 'finish')::date < (d.v ->> 'start')::date) THEN
    RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
    WHERE char_length(regexp_replace(btrim(coalesce(d.v ->> 'place', '')), '\s+', ' ', 'g')) > 40
  ) THEN
    RAISE EXCEPTION 'A place is 40 characters at most.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v), jsonb_array_elements(coalesce(d.v -> 'after', '[]'::jsonb)) AS w(v)
    WHERE NOT coalesce(nullif(w.v ->> 'id', '')::uuid = ANY (v_ids), false)
  ) THEN
    RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_template IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_schedule_templates WHERE id = v_template) THEN
    RAISE EXCEPTION 'That template is gone. Draw without it, or pick another.' USING ERRCODE = 'P0001';
  END IF;

  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);

  IF p_version IS NOT NULL THEN
    -- In place of a schedule drawn before: never once the job started, was walked, or has moves or a baseline.
    IF v_stage IN ('building', 'closed') THEN
      RAISE EXCEPTION 'This job started. A new set of plans is the way to change its schedule now.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gc_schedule_walks WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'The schedule was walked. Its record stays as it is.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gc_schedule_moves WHERE project_id = p_project_id)
       OR EXISTS (SELECT 1 FROM public.gc_schedule_baselines WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'The schedule has moves with their reasons. They stay as they are.' USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM public.gc_schedule_activities WHERE project_id = p_project_id;
    DELETE FROM public.gc_schedule_milestones WHERE project_id = p_project_id;
    UPDATE public.gc_schedules SET drafted_on = public.app_today(), drafted_by = auth.uid() WHERE project_id = p_project_id;
  END IF;

  -- The template it came from (G-44), by its name that day.
  UPDATE public.gc_schedules
     SET template_id = v_template,
         template_name = (SELECT t.name FROM public.gc_schedule_templates t WHERE t.id = v_template),
         template_used_on = CASE WHEN v_template IS NULL THEN NULL ELSE public.app_today() END
   WHERE project_id = p_project_id;

  FOR v_bar_in IN SELECT value FROM jsonb_array_elements(p_draft -> 'bars') LOOP
    v_kind := v_bar_in ->> 'kind';
    IF v_kind = 'line' THEN
      v_id := (v_bar_in ->> 'scopeItemId')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.gc_scope_items s JOIN public.gc_trade_packages k ON k.id = s.package_id
        WHERE s.id = v_id AND k.id = nullif(v_bar_in ->> 'packageId', '')::uuid AND k.project_id = p_project_id
      ) THEN
        RAISE EXCEPTION 'A line in the draft is not on this job.' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      v_id := (v_bar_in ->> 'id')::uuid;
    END IF;
    INSERT INTO public.gc_schedule_activities (
      id, project_id, kind, position, scope_item_id, package_id, start, finish, not_before, must_finish_by, place, label, who
    ) VALUES (
      v_id, p_project_id, v_kind, v_i,
      CASE WHEN v_kind = 'line' THEN v_id END,
      CASE WHEN v_kind = 'line' THEN (v_bar_in ->> 'packageId')::uuid END,
      (v_bar_in ->> 'start')::date, (v_bar_in ->> 'finish')::date,
      nullif(v_bar_in ->> 'notBefore', '')::date, nullif(v_bar_in ->> 'mustFinishBy', '')::date,
      nullif(regexp_replace(btrim(coalesce(v_bar_in ->> 'place', '')), '\s+', ' ', 'g'), ''),
      CASE WHEN v_kind <> 'line' THEN btrim(v_bar_in ->> 'label') END,
      CASE WHEN v_kind = 'added' THEN btrim(v_bar_in ->> 'who') END
    );
    v_i := v_i + 1;
  END LOOP;

  -- What each waits on, then a split line's parts, once every bar is in.
  FOR v_bar_in IN SELECT value FROM jsonb_array_elements(p_draft -> 'bars') LOOP
    v_id := CASE WHEN v_bar_in ->> 'kind' = 'line' THEN (v_bar_in ->> 'scopeItemId')::uuid ELSE (v_bar_in ->> 'id')::uuid END;
    FOR v_wait_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'after', '[]'::jsonb)) LOOP
      IF (v_wait_in ->> 'id')::uuid = v_id THEN
        RAISE EXCEPTION 'A bar cannot wait on itself.' USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
      VALUES (p_project_id, (v_wait_in ->> 'id')::uuid, v_id, coalesce((v_wait_in ->> 'gap')::integer, 0))
      ON CONFLICT (from_activity_id, to_activity_id) DO NOTHING;
    END LOOP;
    v_j := 0;
    FOR v_part_in IN SELECT value FROM jsonb_array_elements(coalesce(v_bar_in -> 'parts', '[]'::jsonb)) LOOP
      INSERT INTO public.gc_schedule_activity_parts (id, activity_id, position, name, from_day, days, share, pct)
      VALUES (
        coalesce(nullif(v_part_in ->> 'id', '')::uuid, gen_random_uuid()), v_id, v_j, btrim(v_part_in ->> 'name'),
        (v_part_in ->> 'fromDay')::integer, (v_part_in ->> 'days')::integer, (v_part_in ->> 'share')::numeric,
        coalesce((v_part_in ->> 'pct')::numeric, 0)
      );
      v_j := v_j + 1;
    END LOOP;
  END LOOP;

  -- The dates to meet: dry-in, the rough-in inspection, substantial completion, and theirs from a file.
  v_j := 0;
  FOR v_ms_in IN SELECT value FROM jsonb_array_elements(coalesce(p_draft -> 'milestones', '[]'::jsonb)) LOOP
    IF nullif(v_ms_in ->> 'packageId', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.gc_trade_packages WHERE id = (v_ms_in ->> 'packageId')::uuid AND project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.gc_schedule_milestones (id, project_id, label, planned, package_id, met_on, position)
    VALUES (
      coalesce(nullif(v_ms_in ->> 'id', '')::uuid, gen_random_uuid()), p_project_id, btrim(v_ms_in ->> 'label'),
      (v_ms_in ->> 'planned')::date, nullif(v_ms_in ->> 'packageId', '')::uuid, nullif(v_ms_in ->> 'metOn', '')::date, v_j
    );
    v_j := v_j + 1;
  END LOOP;

  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A move with why (the owner, 2026-10-05): a drag, an end pulled, the editor, a part's own move (G-39),
-- a pull when work finished early (G-37), days got back (G-82), a late notice taken (G-117) or a
-- change order's days (G-76). The move's kind is in its own columns. Its bars and its record agree:
-- every bar the change dates is the moved bar at its new days, or one it pushed at its new days, and
-- every bar it pushed is dated, so Undo and Redo put back exactly this.
CREATE OR REPLACE FUNCTION public.gc_schedule_move(p_project_id uuid, p_version integer, p_words text, p_move jsonb, p_bars jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
BEGIN
  PERFORM public.gc_schedule_check_why(p_move ->> 'reason', p_move ->> 'note');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v) WHERE b.v ->> 'id' = p_move ->> 'activityId')
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v)
       WHERE NOT (
         (b.v ->> 'id' = p_move ->> 'activityId' AND b.v ->> 'start' = p_move #>> '{to,start}' AND b.v ->> 'finish' = p_move #>> '{to,finish}')
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) AS x(v)
           WHERE x.v ->> 'activityId' = b.v ->> 'id' AND x.v #>> '{to,start}' = b.v ->> 'start' AND x.v #>> '{to,finish}' = b.v ->> 'finish'
         )
       )
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(p_move -> 'pushed', '[]'::jsonb)) AS x(v)
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v) WHERE b.v ->> 'id' = x.v ->> 'activityId')
     ) THEN
    RAISE EXCEPTION 'The move and its bars do not agree. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  PERFORM public.gc_schedule_save_move(p_project_id, v_version, p_move, now());
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- Undo (G-40): the newest move still standing, put back where it found every bar it touched, while
-- each still sits where the move left it (undoableMove). A move that changed what its bar waits on is
-- put back by hand. The move stays on the record, undone today by this person.
CREATE OR REPLACE FUNCTION public.gc_schedule_undo(p_project_id uuid, p_version integer, p_move_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_move public.gc_schedule_moves;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id AND project_id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That move is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_move.undone_on IS NOT NULL THEN
    RAISE EXCEPTION 'That move was undone already.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_moves o WHERE o.project_id = p_project_id AND o.undone_on IS NULL
               AND (o.schedule_version, o.made_at) > (v_move.schedule_version, v_move.made_at)) THEN
    RAISE EXCEPTION 'Only the newest move can be undone.' USING ERRCODE = 'P0001';
  END IF;
  IF v_move.links_changed OR NOT public.gc_schedule_move_sits(v_move.id, false) THEN
    RAISE EXCEPTION 'A bar this move touched has changed since. Move it back by hand, with its own reason.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_put_move(v_move.id, true);
  UPDATE public.gc_schedule_moves SET undone_on = public.app_today(), undone_by = auth.uid() WHERE id = v_move.id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- Redo (G-40): the newest undone move put forward again, while no move made after it stands and every
-- bar it touched still sits where the undo left it (redoableMove). It stands again.
CREATE OR REPLACE FUNCTION public.gc_schedule_redo(p_project_id uuid, p_version integer, p_move_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_move public.gc_schedule_moves;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id AND project_id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That move is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_move.undone_on IS NULL THEN
    RAISE EXCEPTION 'That move stands already.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_moves o WHERE o.project_id = p_project_id
               AND (o.schedule_version, o.made_at) > (v_move.schedule_version, v_move.made_at)) THEN
    RAISE EXCEPTION 'Only the newest move can be put back.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_schedule_move_sits(v_move.id, true) THEN
    RAISE EXCEPTION 'A bar this move touched has changed since. Move it again by hand, with its own reason.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_put_move(v_move.id, false);
  UPDATE public.gc_schedule_moves SET undone_on = NULL, undone_by = NULL WHERE id = v_move.id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- Keep (G-81, decision 6): the person's own what-if copy's standing moves, oldest first, as real moves
-- with their reasons, kept from a copy made that day; the real bars take the copy's plan; then the copy
-- goes. One version for the press, each move a microsecond after the one before, so Undo takes the
-- newest first. Whether the copy's base still holds is the kernel's (whatIfBaseChanges): the version
-- says the real schedule is still the one it read.
CREATE OR REPLACE FUNCTION public.gc_schedule_keep_what_if(p_project_id uuid, p_version integer, p_words text, p_moves jsonb, p_bars jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_made_on date;
  v_move_in jsonb;
  v_i integer := 0;
BEGIN
  IF jsonb_typeof(p_moves) IS DISTINCT FROM 'array' OR jsonb_array_length(p_moves) = 0 THEN
    RAISE EXCEPTION 'Nothing was tried in the what-if.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_moves) AS mv(v)
    WHERE coalesce(btrim(mv.v ->> 'reason'), '') NOT IN ('weather', 'trade before', 'materials', 'crew', 'customer', 'plans', 'inspection', 'us', 'change order', 'other', 'early', 'recovery')
       OR char_length(btrim(coalesce(mv.v ->> 'note', ''))) < 8
  ) THEN
    RAISE EXCEPTION 'Give each move a reason and a sentence.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT made_on INTO v_made_on FROM public.gc_schedule_what_ifs WHERE project_id = p_project_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no what-if open.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  FOR v_move_in IN SELECT value FROM jsonb_array_elements(p_moves) LOOP
    PERFORM public.gc_schedule_save_move(p_project_id, v_version, v_move_in || jsonb_build_object('fromWhatIfOn', v_made_on), now() + interval '1 microsecond' * v_i);
    v_i := v_i + 1;
  END LOOP;
  DELETE FROM public.gc_schedule_what_ifs WHERE project_id = p_project_id AND user_id = auth.uid();
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A new baseline after a signed change order (G-41): the plan as it stands, named, with why. The one
-- it retires stays, named. Only once the plan at Start is kept (withNewBaseline).
CREATE OR REPLACE FUNCTION public.gc_schedule_baseline(p_project_id uuid, p_version integer, p_name text, p_why text, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_baseline uuid;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Give the new baseline a name.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_baselines WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'The plan at Start is not kept yet. The first change after Start keeps it.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_schedule_baselines (project_id, name, locked_on, locked_by, why)
  VALUES (p_project_id, btrim(p_name), public.app_today(), auth.uid(), nullif(btrim(coalesce(p_why, '')), ''))
  RETURNING id INTO v_baseline;
  INSERT INTO public.gc_schedule_baseline_dates (baseline_id, activity_id, start, finish)
  SELECT v_baseline, a.id, a.start, a.finish FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A trade's line split into parts (G-39), each with its name, its first day and its days from the
-- line's start, its share from its days and the line's percent to start from (splitParts). The first
-- part starts and the last ends with the line, which keeps its dates.
CREATE OR REPLACE FUNCTION public.gc_schedule_split(p_project_id uuid, p_version integer, p_activity_id uuid, p_parts jsonb, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_bar public.gc_schedule_activities;
  v_part_in jsonb;
  v_i integer := 0;
BEGIN
  IF jsonb_typeof(p_parts) IS DISTINCT FROM 'array' OR jsonb_array_length(p_parts) < 2 THEN
    RAISE EXCEPTION 'Split it into two parts or more.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_parts) AS pt(v) WHERE btrim(coalesce(pt.v ->> 'name', '')) = '') THEN
    RAISE EXCEPTION 'Give each part a name.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(DISTINCT lower(btrim(pt.v ->> 'name'))) FROM jsonb_array_elements(p_parts) AS pt(v)) <> jsonb_array_length(p_parts) THEN
    RAISE EXCEPTION 'Give each part its own name.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_parts) AS pt(v)
    WHERE coalesce((pt.v ->> 'fromDay')::integer, -1) < 0 OR coalesce((pt.v ->> 'days')::integer, 0) < 1
  ) THEN
    RAISE EXCEPTION 'Each part has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT sum(coalesce((pt.v ->> 'share')::numeric, 0)) FROM jsonb_array_elements(p_parts) AS pt(v)) <> 100 THEN
    RAISE EXCEPTION 'The parts'' shares have to add up to 100.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bar.kind <> 'line' THEN
    RAISE EXCEPTION 'Only a trade''s line splits into parts.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_activity_parts WHERE activity_id = p_activity_id) THEN
    RAISE EXCEPTION 'It is split already. Make it one bar first.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT min((pt.v ->> 'fromDay')::integer) FROM jsonb_array_elements(p_parts) AS pt(v)) <> 0
     OR (SELECT max((pt.v ->> 'fromDay')::integer + (pt.v ->> 'days')::integer) FROM jsonb_array_elements(p_parts) AS pt(v)) <> v_bar.finish - v_bar.start + 1 THEN
    RAISE EXCEPTION 'The first part starts % and the last ends %, as the line does. Move a part after the split to change that.',
      to_char(v_bar.start, 'Dy Mon FMDD'), to_char(v_bar.finish, 'Dy Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  FOR v_part_in IN SELECT value FROM jsonb_array_elements(p_parts) LOOP
    INSERT INTO public.gc_schedule_activity_parts (id, activity_id, position, name, from_day, days, share, pct)
    VALUES (
      coalesce(nullif(v_part_in ->> 'id', '')::uuid, gen_random_uuid()), p_activity_id, v_i, btrim(v_part_in ->> 'name'),
      (v_part_in ->> 'fromDay')::integer, (v_part_in ->> 'days')::integer, (v_part_in ->> 'share')::numeric,
      coalesce((v_part_in ->> 'pct')::numeric, 0)
    );
    v_i := v_i + 1;
  END LOOP;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- A split line made one bar again (G-39): its parts go, its dates stay.
CREATE OR REPLACE FUNCTION public.gc_schedule_join(p_project_id uuid, p_version integer, p_activity_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id) THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_activity_parts WHERE activity_id = p_activity_id) THEN
    RAISE EXCEPTION 'It is one bar already.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  DELETE FROM public.gc_schedule_activity_parts WHERE activity_id = p_activity_id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- The job's own work on the chart (G-38): mobilize, cure time, the customer's own work. Its name and
-- whose it is, its days, what it waits on, the bars that wait on it from now on, and what that pushes
-- (addedActivityProblem's words, in its order).
CREATE OR REPLACE FUNCTION public.gc_schedule_add_activity(p_project_id uuid, p_version integer, p_bar jsonb, p_holds_up uuid[], p_bars jsonb, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_id uuid := coalesce(nullif(p_bar ->> 'id', '')::uuid, gen_random_uuid());
  v_label text := btrim(coalesce(p_bar ->> 'label', ''));
  v_who text := btrim(coalesce(p_bar ->> 'who', ''));
  v_start date := nullif(p_bar ->> 'start', '')::date;
  v_finish date := nullif(p_bar ->> 'finish', '')::date;
  v_after uuid[] := ARRAY(SELECT nullif(w.v ->> 'id', '')::uuid FROM jsonb_array_elements(coalesce(p_bar -> 'after', '[]'::jsonb)) AS w(v));
  v_holds uuid[] := coalesce(p_holds_up, '{}');
  v_wait_in jsonb;
BEGIN
  IF v_label = '' THEN
    RAISE EXCEPTION 'Give it a name.' USING ERRCODE = 'P0001';
  END IF;
  IF v_who = '' THEN
    RAISE EXCEPTION 'Say whose it is.' USING ERRCODE = 'P0001';
  END IF;
  IF v_start IS NULL OR v_finish IS NULL THEN
    RAISE EXCEPTION 'It needs a start and a finish.' USING ERRCODE = 'P0001';
  END IF;
  IF v_finish < v_start THEN
    RAISE EXCEPTION 'It has to finish on or after it starts.' USING ERRCODE = 'P0001';
  END IF;
  IF v_holds && v_after THEN
    RAISE EXCEPTION 'A bar cannot both come before it and wait on it.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF EXISTS (
    SELECT 1 FROM unnest(v_after || v_holds) AS f(id)
    WHERE f.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = f.id)
  ) THEN
    RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  INSERT INTO public.gc_schedule_activities (id, project_id, kind, position, start, finish, label, who)
  VALUES (v_id, p_project_id, 'added',
          (SELECT coalesce(max(a.position), -1) + 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id),
          v_start, v_finish, v_label, v_who);
  FOR v_wait_in IN SELECT value FROM jsonb_array_elements(coalesce(p_bar -> 'after', '[]'::jsonb)) LOOP
    INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
    VALUES (p_project_id, (v_wait_in ->> 'id')::uuid, v_id, coalesce((v_wait_in ->> 'gap')::integer, 0))
    ON CONFLICT (from_activity_id, to_activity_id) DO NOTHING;
  END LOOP;
  INSERT INTO public.gc_schedule_links (project_id, from_activity_id, to_activity_id, gap)
  SELECT p_project_id, v_id, h.id, 0 FROM unnest(v_holds) AS h(id)
  ON CONFLICT (from_activity_id, to_activity_id) DO NOTHING;
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- The job's own work taken off the chart (G-38). Only that comes off: a trade's line and an inspection
-- stay. Whatever waited on it stops waiting (its links go with it), and the moves keep its name.
CREATE OR REPLACE FUNCTION public.gc_schedule_remove_activity(p_project_id uuid, p_version integer, p_activity_id uuid, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_kind text;
BEGIN
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  SELECT kind INTO v_kind FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind <> 'added' THEN
    RAISE EXCEPTION 'Only the job''s own work comes off. A trade''s line and an inspection stay.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  DELETE FROM public.gc_schedule_activities WHERE id = p_activity_id;
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- An inspection that did not pass (failInspection), on a job being built: the day, what failed, whose
-- work it was, and the day it is looked at again. The inspection moves to that day with its days kept,
-- and what waits on it moves out, as the kernel worked it out (pushSchedule).
CREATE OR REPLACE FUNCTION public.gc_schedule_fail_inspection(p_project_id uuid, p_version integer, p_activity_id uuid, p_failure jsonb, p_bars jsonb, p_words text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_bar public.gc_schedule_activities;
  v_note text := regexp_replace(btrim(coalesce(p_failure ->> 'note', '')), '\s+', ' ', 'g');
  v_again date := nullif(p_failure ->> 'reinspectOn', '')::date;
BEGIN
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say what failed.' USING ERRCODE = 'P0001';
  END IF;
  IF v_again IS NULL OR v_again <= public.app_today() THEN
    RAISE EXCEPTION 'Pick a day after today for the re-inspection.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF NOT EXISTS (SELECT 1 FROM public.gc_projects WHERE project_id = p_project_id AND stage = 'building') THEN
    RAISE EXCEPTION 'Inspections are recorded on a job being built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND OR v_bar.kind <> 'inspection' THEN
    RAISE EXCEPTION 'Only an inspection passes or fails.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bar.passed_on IS NOT NULL THEN
    RAISE EXCEPTION 'This inspection passed already.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_bars, '[]'::jsonb)) AS b(v)
    WHERE nullif(b.v ->> 'id', '')::uuid = p_activity_id
      AND (b.v ->> 'start')::date = v_again
      AND (b.v ->> 'finish')::date = v_again + (v_bar.finish - v_bar.start)
  ) THEN
    RAISE EXCEPTION 'The inspection moves to its re-inspection day, its days kept.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  INSERT INTO public.gc_schedule_inspection_failures (activity_id, failed_on, note, package_ids, reinspect_on)
  VALUES (
    p_activity_id, public.app_today(), v_note,
    ARRAY(
      SELECT k.id FROM public.gc_trade_packages k
      WHERE k.project_id = p_project_id
        AND k.id IN (SELECT (x.v #>> '{}')::uuid FROM jsonb_array_elements(coalesce(p_failure -> 'packageIds', '[]'::jsonb)) AS x(v))
      ORDER BY k.position
    ),
    v_again
  );
  PERFORM public.gc_schedule_set_bars(p_project_id, p_bars);
  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- The records that touch several rows: no version (decision 9)
-- ---------------------------------------------------------------------------------------------

-- Where bars' work is (G-83, setActivityPlaces): each bar's place set or cleared, as the office keeps
-- it, refused whole when any of it is (placeChanges). A copy's bars read their places from these.
-- Returns how many changed.
CREATE OR REPLACE FUNCTION public.gc_schedule_set_places(p_project_id uuid, p_places jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_raw jsonb;
  v_place text;
  v_kind text;
  v_count integer := 0;
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_places) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Say which bars and where.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_key, v_raw IN SELECT key, value FROM jsonb_each(p_places) LOOP
    SELECT kind INTO v_kind FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = v_key::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A bar in this change is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    IF v_kind <> 'line' THEN
      RAISE EXCEPTION 'An inspection and the job''s own work take no place.' USING ERRCODE = 'P0001';
    END IF;
    IF char_length(regexp_replace(btrim(coalesce(v_raw #>> '{}', '')), '\s+', ' ', 'g')) > 40 THEN
      RAISE EXCEPTION 'A place is 40 characters at most.' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  FOR v_key, v_raw IN SELECT key, value FROM jsonb_each(p_places) LOOP
    v_place := nullif(regexp_replace(btrim(coalesce(v_raw #>> '{}', '')), '\s+', ' ', 'g'), '');
    UPDATE public.gc_schedule_activities SET place = v_place
     WHERE project_id = p_project_id AND id = v_key::uuid AND place IS DISTINCT FROM v_place;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;
  END LOOP;
  RETURN v_count;
END;
$$;

-- An inspection passed (passInspection), on a job being built: today, and a date to meet of the same
-- name not met yet is met the same day. Returns that date's id, or null.
CREATE OR REPLACE FUNCTION public.gc_schedule_pass_inspection(p_project_id uuid, p_activity_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar public.gc_schedule_activities;
  v_met uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_projects WHERE project_id = p_project_id AND stage = 'building') THEN
    RAISE EXCEPTION 'Inspections are recorded on a job being built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE project_id = p_project_id AND id = p_activity_id;
  IF NOT FOUND OR v_bar.kind <> 'inspection' THEN
    RAISE EXCEPTION 'Only an inspection passes or fails.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bar.passed_on IS NOT NULL THEN
    RAISE EXCEPTION 'This inspection passed already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_schedule_activities SET passed_on = public.app_today() WHERE id = p_activity_id;
  UPDATE public.gc_schedule_milestones SET met_on = public.app_today()
   WHERE id = (
     SELECT m.id FROM public.gc_schedule_milestones m
     WHERE m.project_id = p_project_id AND m.met_on IS NULL AND lower(btrim(m.label)) = lower(btrim(v_bar.label))
     ORDER BY m.position, m.created_at
     LIMIT 1
   )
  RETURNING id INTO v_met;
  RETURN v_met;
END;
$$;

-- Their dates to meet from a file (takeTheirDates, G-145), on a job being built with no what-if copy of
-- this person's open: one of ours takes their day (the kernel took the signed change orders' days off
-- substantial completion), and a new one comes in as the job's own, not met. Refused whole
-- (withTheirDates). Returns how many dates it took.
CREATE OR REPLACE FUNCTION public.gc_schedule_their_dates(p_project_id uuid, p_dates jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_projects WHERE project_id = p_project_id AND stage = 'building' AND lost_on IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'Their dates come in on a job being built.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_what_ifs WHERE project_id = p_project_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'A what-if copy is open. Keep it or throw it away first.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_dates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_dates) = 0 THEN
    RAISE EXCEPTION 'Tick a date to take.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_dates) AS d(v)
    WHERE btrim(coalesce(d.v ->> 'label', '')) = '' OR nullif(d.v ->> 'planned', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Each date needs a name and a day.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_dates) AS d(v)
    WHERE nullif(d.v ->> 'id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.gc_schedule_milestones m
        WHERE m.id = (d.v ->> 'id')::uuid AND m.project_id = p_project_id AND m.met_on IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'One of our dates is met already, or not on this job.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) <> count(DISTINCT d.v ->> 'id') FROM jsonb_array_elements(p_dates) AS d(v) WHERE nullif(d.v ->> 'id', '') IS NOT NULL) THEN
    RAISE EXCEPTION 'Two of their dates land on one of ours.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_schedule_milestones m
     SET planned = (d.v ->> 'planned')::date
    FROM jsonb_array_elements(p_dates) AS d(v)
   WHERE nullif(d.v ->> 'id', '') IS NOT NULL AND m.id = (d.v ->> 'id')::uuid AND m.project_id = p_project_id;
  INSERT INTO public.gc_schedule_milestones (project_id, label, planned, position)
  SELECT p_project_id, btrim(d.v ->> 'label'), (d.v ->> 'planned')::date,
         (SELECT coalesce(max(m.position), -1) FROM public.gc_schedule_milestones m WHERE m.project_id = p_project_id) + d.n::integer
    FROM jsonb_array_elements(p_dates) WITH ORDINALITY AS d(v, n)
   WHERE nullif(d.v ->> 'id', '') IS NULL;
  RETURN jsonb_array_length(p_dates);
END;
$$;

-- What the work waits on from outside the trades (addScheduleWait, G-73 to G-75), with the bars it
-- holds until it is in. An empty who reads as the kind's own. Returns the wait's id.
CREATE OR REPLACE FUNCTION public.gc_schedule_add_wait(p_project_id uuid, p_wait jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid := coalesce(nullif(p_wait ->> 'id', '')::uuid, gen_random_uuid());
  v_kind text := coalesce(p_wait ->> 'kind', '');
  v_title text := btrim(coalesce(p_wait ->> 'title', ''));
  v_pkg uuid := nullif(p_wait ->> 'packageId', '')::uuid;
  v_expected date := nullif(p_wait ->> 'expectedOn', '')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind NOT IN ('delivery', 'decision', 'permit', 'utility') THEN
    RAISE EXCEPTION 'Pick what the work waits on.' USING ERRCODE = 'P0001';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'Give it a name.' USING ERRCODE = 'P0001';
  END IF;
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Say when it is expected.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'This job has no schedule yet. Draw its first draft.' USING ERRCODE = 'P0001';
  END IF;
  IF v_pkg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_pkg AND project_id = p_project_id) THEN
    RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_wait -> 'activityIds', '[]'::jsonb)) AS h(v)
    WHERE NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = nullif(h.v #>> '{}', '')::uuid)
  ) THEN
    RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_schedule_waits (id, project_id, kind, title, package_id, who, asked_on, expected_on, note)
  VALUES (v_id, p_project_id, v_kind, v_title, v_pkg, btrim(coalesce(p_wait ->> 'who', '')),
          nullif(p_wait ->> 'askedOn', '')::date, v_expected, nullif(btrim(coalesce(p_wait ->> 'note', '')), ''));
  INSERT INTO public.gc_schedule_wait_holds (project_id, wait_id, activity_id)
  SELECT DISTINCT p_project_id, v_id, (h.v #>> '{}')::uuid FROM jsonb_array_elements(coalesce(p_wait -> 'activityIds', '[]'::jsonb)) AS h(v);
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- What each is, for the catalog, and who may call them
-- ---------------------------------------------------------------------------------------------

COMMENT ON FUNCTION public.gc_schedule_bump(uuid, integer, text) IS
  'GC mode (v2.4848): a plan write''s first step (decision 5): checks and bumps gc_schedules.version and keeps the press''s words in gc_schedule_changes, or refuses with "The schedule changed while you were working." and every change since as JSON in the DETAIL. A null version makes a first draft''s row at version 1. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_draft(uuid, integer, text, jsonb) IS
  'GC mode (v2.4848): the first draft, from the kernel or a template''s lines or a file (G-44, G-137), or one in place of a schedule drawn before Start that nobody walked or moved: its bars, waits, parts and dates to meet. A line''s bar takes its scope line''s id. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_move(uuid, integer, text, jsonb, jsonb) IS
  'GC mode (v2.4848): a move with why, of any kind (a drag, the editor, a part''s own move, a pull, days got back, a late notice taken, a change order''s days): the bars as the kernel left them and the move with what it pushed, which must agree. Keeps the plan at Start first. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_undo(uuid, integer, uuid, text) IS
  'GC mode (v2.4848): Undo (G-40): the newest standing move put back from its own record, while every bar it touched sits where it left them. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_redo(uuid, integer, uuid, text) IS
  'GC mode (v2.4848): Redo (G-40): the newest undone move put forward again from its own record, while no newer move stands. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_keep_what_if(uuid, integer, text, jsonb, jsonb) IS
  'GC mode (v2.4848): Keep (G-81): the person''s own what-if copy''s moves as real moves with their reasons, the bars as the copy left them, then the copy goes. One version for the press. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_baseline(uuid, integer, text, text, text) IS
  'GC mode (v2.4848): a new named baseline (G-41), the plan as it stands; the ones before stay. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_split(uuid, integer, uuid, jsonb, text) IS
  'GC mode (v2.4848): a trade''s line split into parts (G-39), the first starting and the last ending with it. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_join(uuid, integer, uuid, text) IS
  'GC mode (v2.4848): a split line made one bar again (G-39). Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text) IS
  'GC mode (v2.4848): the job''s own work on the chart (G-38), with its waits, the bars that wait on it and what that pushes. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_remove_activity(uuid, integer, uuid, text) IS
  'GC mode (v2.4848): the job''s own work off the chart (G-38); a trade''s line and an inspection stay. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_fail_inspection(uuid, integer, uuid, jsonb, jsonb, text) IS
  'GC mode (v2.4848): an inspection that did not pass, on a job being built: the failure, the inspection at its re-inspection day and what that pushes. Returns the new version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_set_places(uuid, jsonb) IS
  'GC mode (v2.4848): where bars'' work is (G-83), set or cleared, refused whole. A record: no version. Returns how many changed. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_pass_inspection(uuid, uuid) IS
  'GC mode (v2.4848): an inspection passed today, and a date to meet of the same name met. A record: no version. Returns that date''s id or null. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_their_dates(uuid, jsonb) IS
  'GC mode (v2.4848): their dates to meet from a file (G-145), on a job being built, refused whole. A record: no version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_schedule_add_wait(uuid, jsonb) IS
  'GC mode (v2.4848): what the work waits on from outside the trades (G-73 to G-75), with the bars it holds. A record: no version. Returns its id. SECURITY INVOKER.';

-- The signed-in only; the tables' policies decide the rest (dev only until the schedule's PR 10). The
-- shared steps are callable too: alone, the guard refuses what they would write, and the version step
-- alone only bumps a version it was handed.
DO $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.gc_schedule_bump(uuid, integer, text)',
    'public.gc_schedule_keep_start(uuid)',
    'public.gc_schedule_set_bars(uuid, jsonb)',
    'public.gc_schedule_check_why(text, text)',
    'public.gc_schedule_save_move(uuid, integer, jsonb, timestamptz)',
    'public.gc_schedule_move_sits(uuid, boolean)',
    'public.gc_schedule_put_move(uuid, boolean)',
    'public.gc_schedule_draft(uuid, integer, text, jsonb)',
    'public.gc_schedule_move(uuid, integer, text, jsonb, jsonb)',
    'public.gc_schedule_undo(uuid, integer, uuid, text)',
    'public.gc_schedule_redo(uuid, integer, uuid, text)',
    'public.gc_schedule_keep_what_if(uuid, integer, text, jsonb, jsonb)',
    'public.gc_schedule_baseline(uuid, integer, text, text, text)',
    'public.gc_schedule_split(uuid, integer, uuid, jsonb, text)',
    'public.gc_schedule_join(uuid, integer, uuid, text)',
    'public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text)',
    'public.gc_schedule_remove_activity(uuid, integer, uuid, text)',
    'public.gc_schedule_fail_inspection(uuid, integer, uuid, jsonb, jsonb, text)',
    'public.gc_schedule_set_places(uuid, jsonb)',
    'public.gc_schedule_pass_inspection(uuid, uuid)',
    'public.gc_schedule_their_dates(uuid, jsonb)',
    'public.gc_schedule_add_wait(uuid, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
  REVOKE ALL ON FUNCTION public.gc_schedule_plan_guard() FROM PUBLIC, anon, authenticated;
END $$;
