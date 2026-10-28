SET lock_timeout = '3s';

-- GC mode, the schedule builder, PR 2 of punch list #204 (v2.6020; to-dos/schedule-builder/README.md): the rows
-- the kernel of PR 1 (v2.5995, src/lib/gc/schedule/builder.ts) reads and writes.
--   1) gc_schedule_templates, version 2: phases and rows beside the lines (TemplatePhase[], TemplateRow[]), a kind,
--      working_days (the owner's call 4) and versions (call 2). A save makes a new row whose version_of names the
--      one it replaces; that one is marked superseded_on and leaves the pick and the list, and the jobs drawn from
--      it keep what they drew. The append-only grant stands: UPDATE on name, aside_on and now superseded_on alone.
--      A template made from nothing has no job it came from, so from_name and from_done_pct may be null, and its
--      lines may be empty when it has rows. A name is unique among the current versions.
--   2) gc_schedule_activities.phase and gc_schedule_milestones.phase, the template phase each was drawn in by name,
--      and gc_schedules.phases, the phases' order, all written by gc_schedule_draft from the draft it is handed.
--   3) gc_schedule_template_save(p_template, p_version_of): one press that writes the new version and marks the
--      old one, so no save leaves a template half replaced. SECURITY INVOKER: the table's policy is its gate.
-- Nothing here changes a row that exists: every column is added null or with a default, and the old shape still
-- saves and reads. The client reads the new columns from PR 3 on, after the types are regenerated.

-- 1) The template, version 2.
ALTER TABLE public.gc_schedule_templates
  ADD COLUMN IF NOT EXISTS phases jsonb,
  ADD COLUMN IF NOT EXISTS rows jsonb,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS working_days boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version_of uuid REFERENCES public.gc_schedule_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_on date;

-- A template made from nothing came from no job.
ALTER TABLE public.gc_schedule_templates
  ALTER COLUMN from_name DROP NOT NULL,
  ALTER COLUMN from_done_pct DROP NOT NULL;

-- Its lines may be empty once it has rows; the other shapes are checked where they are new.
ALTER TABLE public.gc_schedule_templates DROP CONSTRAINT IF EXISTS gc_schedule_templates_lines_listed;
ALTER TABLE public.gc_schedule_templates ADD CONSTRAINT gc_schedule_templates_lines_listed
  CHECK (jsonb_typeof(lines) = 'array' AND (jsonb_array_length(lines) > 0 OR rows IS NOT NULL));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_templates_rows_listed' AND conrelid = 'public.gc_schedule_templates'::regclass) THEN
    ALTER TABLE public.gc_schedule_templates ADD CONSTRAINT gc_schedule_templates_rows_listed
      CHECK (rows IS NULL OR (jsonb_typeof(rows) = 'array' AND jsonb_array_length(rows) > 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_templates_phases_listed' AND conrelid = 'public.gc_schedule_templates'::regclass) THEN
    ALTER TABLE public.gc_schedule_templates ADD CONSTRAINT gc_schedule_templates_phases_listed
      CHECK (phases IS NULL OR jsonb_typeof(phases) = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_templates_kind_short' AND conrelid = 'public.gc_schedule_templates'::regclass) THEN
    ALTER TABLE public.gc_schedule_templates ADD CONSTRAINT gc_schedule_templates_kind_short
      CHECK (kind IS NULL OR (btrim(kind) <> '' AND char_length(kind) <= 40));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_templates_from_named' AND conrelid = 'public.gc_schedule_templates'::regclass) THEN
    ALTER TABLE public.gc_schedule_templates ADD CONSTRAINT gc_schedule_templates_from_named
      CHECK ((from_name IS NULL) = (from_done_pct IS NULL) AND (from_project_id IS NULL OR from_name IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_templates_version_of_another' AND conrelid = 'public.gc_schedule_templates'::regclass) THEN
    ALTER TABLE public.gc_schedule_templates ADD CONSTRAINT gc_schedule_templates_version_of_another
      CHECK (version_of IS NULL OR version_of <> id);
  END IF;
END $$;

-- A name is unique among the current versions: a new version keeps its name, and the one it replaced keeps it too.
DROP INDEX IF EXISTS public.gc_schedule_templates_name_once;
CREATE UNIQUE INDEX IF NOT EXISTS gc_schedule_templates_name_once_current
  ON public.gc_schedule_templates (lower(name)) WHERE superseded_on IS NULL;
CREATE INDEX IF NOT EXISTS gc_schedule_templates_version_of_idx
  ON public.gc_schedule_templates (version_of) WHERE version_of IS NOT NULL;

-- The append-only grant stands (GC_SCHEDULE_APPEND_ONLY in src/lib/gc/doors.ts): a saved row changes only in its
-- name, the day it was set aside, and now the day a new version replaced it.
GRANT UPDATE (superseded_on) ON TABLE public.gc_schedule_templates TO authenticated;

COMMENT ON TABLE public.gc_schedule_templates IS
  'GC mode (v2.4816; version 2 since v2.6020, punch list #204): a schedule template (ScheduleTemplate, G-44), company-wide: a GC job''s shape saved to draw other jobs from, with its name and kind, the job it came from when it came from one, who saved it and when, its lines (TemplateLine[], by trade and name) and, since version 2, its phases and rows (TemplatePhase[], TemplateRow[]: every row lands on the next job), whether its days count Monday to Friday, the version it replaced, the day it was replaced and the day it was set aside. Append only, but name, aside_on and superseded_on: a save makes a new row (gc_schedule_template_save).';
COMMENT ON COLUMN public.gc_schedule_templates.phases IS
  'Version 2 (#204): TemplatePhase[] in order, each {key, name}. Null: a template saved before, which the kernel reads as rows with the stage as the phase.';
COMMENT ON COLUMN public.gc_schedule_templates.rows IS
  'Version 2 (#204): TemplateRow[], each {phase, label, who, days, after, offset, milestone, place?, parts?} with who a trade, Us or Office (call 3). Every row lands when the template is put on a job. Null: lines alone.';
COMMENT ON COLUMN public.gc_schedule_templates.kind IS
  'The kind of job it fits, in the office''s word (Quick lube, Tenant finish), for the filter on the pick. Null: none.';
COMMENT ON COLUMN public.gc_schedule_templates.working_days IS
  'True: a row''s days count Monday to Friday and no row starts on a weekend (call 4). False: every day, as every template saved before.';
COMMENT ON COLUMN public.gc_schedule_templates.version_of IS
  'The version this row replaced (call 2). Null: the first.';
COMMENT ON COLUMN public.gc_schedule_templates.superseded_on IS
  'The day a new version replaced this row. It is then neither offered nor listed as a template of its own; the jobs drawn from it keep what they drew. Null: the current version.';
COMMENT ON COLUMN public.gc_schedule_templates.from_name IS
  'The name of the job it was saved from, that day. Null: made from nothing on the Templates page.';

-- 2) The job's side: the phase each bar and date to meet was drawn in, and the phases' order.
ALTER TABLE public.gc_schedule_activities ADD COLUMN IF NOT EXISTS phase text;
ALTER TABLE public.gc_schedule_milestones ADD COLUMN IF NOT EXISTS phase text;
ALTER TABLE public.gc_schedules ADD COLUMN IF NOT EXISTS phases jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_activities_phase_named' AND conrelid = 'public.gc_schedule_activities'::regclass) THEN
    ALTER TABLE public.gc_schedule_activities ADD CONSTRAINT gc_schedule_activities_phase_named
      CHECK (phase IS NULL OR (btrim(phase) <> '' AND char_length(phase) <= 80));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_milestones_phase_named' AND conrelid = 'public.gc_schedule_milestones'::regclass) THEN
    ALTER TABLE public.gc_schedule_milestones ADD CONSTRAINT gc_schedule_milestones_phase_named
      CHECK (phase IS NULL OR (btrim(phase) <> '' AND char_length(phase) <= 80));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedules_phases_listed' AND conrelid = 'public.gc_schedules'::regclass) THEN
    ALTER TABLE public.gc_schedules ADD CONSTRAINT gc_schedules_phases_listed
      CHECK (phases IS NULL OR jsonb_typeof(phases) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.gc_schedule_activities.phase IS
  'The template phase the bar was drawn in, by name (#204, v2.6020). Null: drawn with no phases, or a line the template had no row for. A record, not the plan: the guard lets it change outside a plan write.';
COMMENT ON COLUMN public.gc_schedule_milestones.phase IS
  'The template phase the date to meet was drawn in, by name (#204, v2.6020). Null: drawn with no phases.';
COMMENT ON COLUMN public.gc_schedules.phases IS
  'The phases of the template the schedule was drawn from, by name in order (#204, v2.6020), so By phase lists them as the office kept them. Null: drawn with no phases.';

-- 3) The first draft carries the phases. The body is 20261008040000's with the phases read, checked and written.
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
  v_phases jsonb := CASE WHEN jsonb_typeof(p_draft -> 'phases') = 'array' AND jsonb_array_length(p_draft -> 'phases') > 0 THEN p_draft -> 'phases' END;
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
  -- The phases (#204): each a name, none twice, and every bar's and date's among them.
  IF v_phases IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_phases) AS p(v) WHERE jsonb_typeof(p.v) <> 'string' OR btrim(p.v #>> '{}') = '' OR char_length(btrim(p.v #>> '{}')) > 80) THEN
      RAISE EXCEPTION 'Each phase needs its name, 80 characters at most.' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements_text(v_phases)) <> (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(v_phases) AS x) THEN
      RAISE EXCEPTION 'A phase is listed twice.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_draft -> 'bars') AS d(v)
    WHERE nullif(btrim(coalesce(d.v ->> 'phase', '')), '') IS NOT NULL AND NOT coalesce(v_phases ? btrim(d.v ->> 'phase'), false)
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_draft -> 'milestones', '[]'::jsonb)) AS m(v)
    WHERE nullif(btrim(coalesce(m.v ->> 'phase', '')), '') IS NOT NULL AND NOT coalesce(v_phases ? btrim(m.v ->> 'phase'), false)
  ) THEN
    RAISE EXCEPTION 'A bar names a phase the draft does not list.' USING ERRCODE = 'P0001';
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

  -- The template it came from (G-44), by its name that day, and its phases in order (#204).
  UPDATE public.gc_schedules
     SET template_id = v_template,
         template_name = (SELECT t.name FROM public.gc_schedule_templates t WHERE t.id = v_template),
         template_used_on = CASE WHEN v_template IS NULL THEN NULL ELSE public.app_today() END,
         phases = v_phases
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
      id, project_id, kind, position, scope_item_id, package_id, start, finish, not_before, must_finish_by, place, label, who, phase
    ) VALUES (
      v_id, p_project_id, v_kind, v_i,
      CASE WHEN v_kind = 'line' THEN v_id END,
      CASE WHEN v_kind = 'line' THEN (v_bar_in ->> 'packageId')::uuid END,
      (v_bar_in ->> 'start')::date, (v_bar_in ->> 'finish')::date,
      nullif(v_bar_in ->> 'notBefore', '')::date, nullif(v_bar_in ->> 'mustFinishBy', '')::date,
      nullif(regexp_replace(btrim(coalesce(v_bar_in ->> 'place', '')), '\s+', ' ', 'g'), ''),
      CASE WHEN v_kind <> 'line' THEN btrim(v_bar_in ->> 'label') END,
      CASE WHEN v_kind = 'added' THEN btrim(v_bar_in ->> 'who') END,
      nullif(btrim(coalesce(v_bar_in ->> 'phase', '')), '')
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

  -- The dates to meet: dry-in, the rough-in inspection, substantial completion, theirs from a file, and a template's milestone rows.
  v_j := 0;
  FOR v_ms_in IN SELECT value FROM jsonb_array_elements(coalesce(p_draft -> 'milestones', '[]'::jsonb)) LOOP
    IF nullif(v_ms_in ->> 'packageId', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.gc_trade_packages WHERE id = (v_ms_in ->> 'packageId')::uuid AND project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.gc_schedule_milestones (id, project_id, label, planned, package_id, met_on, position, phase)
    VALUES (
      coalesce(nullif(v_ms_in ->> 'id', '')::uuid, gen_random_uuid()), p_project_id, btrim(v_ms_in ->> 'label'),
      (v_ms_in ->> 'planned')::date, nullif(v_ms_in ->> 'packageId', '')::uuid, nullif(v_ms_in ->> 'metOn', '')::date, v_j,
      nullif(btrim(coalesce(v_ms_in ->> 'phase', '')), '')
    );
    v_j := v_j + 1;
  END LOOP;

  PERFORM set_config('gc.schedule_plan_write', '', true);
  RETURN v_version;
END;
$$;
COMMENT ON FUNCTION public.gc_schedule_draft(uuid, integer, text, jsonb) IS
  'GC mode (v2.4848; the phases since v2.6020, #204): the first draft, from the kernel or a template''s lines or rows or a file (G-44, G-137), or one in place of a schedule drawn before Start that nobody walked or moved: its bars, waits, parts and dates to meet, each in its template phase by name, and the phases in order on the schedule. A line''s bar takes its scope line''s id. Returns the new version. SECURITY INVOKER.';

-- 4) A template saved: a new one, or a new version of one, in one press.
CREATE OR REPLACE FUNCTION public.gc_schedule_template_save(p_template jsonb, p_version_of uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_name text := regexp_replace(btrim(coalesce(p_template ->> 'name', '')), '\s+', ' ', 'g');
  v_kind text := nullif(regexp_replace(btrim(coalesce(p_template ->> 'kind', '')), '\s+', ' ', 'g'), '');
  v_on date := nullif(p_template ->> 'on', '')::date;
  v_rows jsonb := p_template -> 'rows';
  v_phases jsonb := p_template -> 'phases';
  v_lines jsonb := coalesce(p_template -> 'lines', '[]'::jsonb);
  v_stages jsonb := coalesce(p_template -> 'stages', '[]'::jsonb);
  v_weeks integer := nullif(p_template ->> 'weeks', '')::integer;
  v_working boolean := coalesce(nullif(p_template ->> 'workingDays', '')::boolean, false);
  v_from_project uuid := nullif(p_template #>> '{from,projectId}', '')::uuid;
  v_from_name text := nullif(btrim(coalesce(p_template #>> '{from,name}', '')), '');
  v_from_pct numeric := nullif(p_template #>> '{from,donePct}', '')::numeric;
  v_aside date;
  v_was_superseded date;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'Give it a name.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'Keep the name to 60 letters.' USING ERRCODE = 'P0001';
  END IF;
  IF v_on IS NULL THEN
    RAISE EXCEPTION 'A save needs its day.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(v_phases) IS DISTINCT FROM 'array' OR jsonb_array_length(v_phases) = 0 THEN
    RAISE EXCEPTION 'A template needs at least one phase.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_phases) AS p(v) WHERE btrim(coalesce(p.v ->> 'key', '')) = '' OR btrim(coalesce(p.v ->> 'name', '')) = '') THEN
    RAISE EXCEPTION 'Each phase needs its key and its name.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(v_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(v_rows) = 0 THEN
    RAISE EXCEPTION 'A template needs at least one row.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) AS r(v) WHERE btrim(coalesce(r.v ->> 'label', '')) = '') THEN
    RAISE EXCEPTION 'Each row needs its name.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_rows) AS r(v)
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_phases) AS p(v) WHERE p.v ->> 'key' = r.v ->> 'phase')
  ) THEN
    RAISE EXCEPTION 'A row is in a phase the template does not have.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) AS r(v) WHERE coalesce(nullif(r.v ->> 'days', '')::numeric, 0) < 1) THEN
    RAISE EXCEPTION 'Each row needs its days, one or more.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_rows) AS r(v)
    WHERE coalesce(r.v #>> '{who,kind}', '') NOT IN ('trade', 'us', 'office')
       OR (r.v #>> '{who,kind}' = 'trade' AND btrim(coalesce(r.v #>> '{who,trade}', '')) = '')
  ) THEN
    RAISE EXCEPTION 'Each row names a trade, Us or Office.' USING ERRCODE = 'P0001';
  END IF;
  IF v_weeks IS NULL OR v_weeks < 1 THEN
    RAISE EXCEPTION 'It makes under a week to build. Give a row more days.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind IS NOT NULL AND char_length(v_kind) > 40 THEN
    RAISE EXCEPTION 'Keep the kind to 40 letters.' USING ERRCODE = 'P0001';
  END IF;
  IF (v_from_name IS NULL) <> (v_from_pct IS NULL) THEN
    RAISE EXCEPTION 'The job it came from needs its name and how much of its work was done.' USING ERRCODE = 'P0001';
  END IF;
  IF p_version_of IS NOT NULL THEN
    -- The one it replaces: still there, and still the current version. A save that says nothing of the job it
    -- came from keeps the old version's, and its being set aside stays with its versions.
    SELECT t.aside_on, t.superseded_on,
           coalesce(v_from_project, t.from_project_id), coalesce(v_from_name, t.from_name), coalesce(v_from_pct, t.from_done_pct)
      INTO v_aside, v_was_superseded, v_from_project, v_from_name, v_from_pct
      FROM public.gc_schedule_templates t WHERE t.id = p_version_of;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That template is gone. Reload to see the templates kept.' USING ERRCODE = 'P0001';
    END IF;
    IF v_was_superseded IS NOT NULL THEN
      RAISE EXCEPTION 'That template was saved again since you opened it. Reload and make your change on the newest version.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- The name, among the current versions (the index holds the race).
  IF EXISTS (
    SELECT 1 FROM public.gc_schedule_templates t
    WHERE lower(t.name) = lower(v_name) AND t.superseded_on IS NULL AND t.id IS DISTINCT FROM p_version_of
  ) THEN
    RAISE EXCEPTION 'Another template has that name.' USING ERRCODE = 'P0001';
  END IF;
  IF p_version_of IS NOT NULL THEN
    -- Marked now, in the same press as the new row; a second save of the same version waits on the row and finds it marked.
    UPDATE public.gc_schedule_templates SET superseded_on = v_on WHERE id = p_version_of AND superseded_on IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That template was saved again since you opened it. Reload and make your change on the newest version.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  INSERT INTO public.gc_schedule_templates (
    id, name, from_project_id, from_name, from_done_pct, saved_on, lines, stages, weeks, aside_on,
    phases, rows, kind, working_days, version_of
  ) VALUES (
    v_id, v_name, v_from_project, v_from_name, v_from_pct, v_on, v_lines, v_stages, v_weeks, v_aside,
    v_phases, v_rows, v_kind, v_working, p_version_of
  );
  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.gc_schedule_template_save(jsonb, uuid) IS
  'GC mode (v2.6020, #204, call 2): a schedule template saved as a new row: from nothing, from a job''s schedule (from, lines and stages with its rows), or as a new version of p_version_of, which is marked superseded_on the same day and keeps its rows for the jobs drawn from it. p_template: {name, kind?, on, workingDays?, weeks, phases, rows, lines?, stages?, from?}. Refuses in the kernel''s words. Returns the new id. SECURITY INVOKER: the table''s policy and the append-only grant are its gate.';

REVOKE ALL ON FUNCTION public.gc_schedule_template_save(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_schedule_template_save(jsonb, uuid) TO authenticated;
