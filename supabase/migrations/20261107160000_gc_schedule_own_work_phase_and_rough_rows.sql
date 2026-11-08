SET lock_timeout = '3s';

-- GC mode, punch list #210 (v2.6651): the schedule builder's two follow-ups that reach the database, left by
-- design in v2.6024 and v2.6025.
--
--   1) gc_rough_schedules.template_rows: the rough while we bid (G-45) keeps a copy of a rows template's phases
--      and rows beside its copy of the lines (template_lines), so a template made on the Templates page, whose
--      lines are empty, draws the rough as the first draft does (rowsDraft) and no later edit to the template
--      reaches the rough. The kernel writes {phases, rows, workingDays} (TemplateRowsShape).
--   2) gc_schedule_add_activity reads p_bar.phase: the job's own work added to a schedule drawn with phases
--      lands in the phase the office picked instead of under Not in a phase. The phase is one of
--      gc_schedules.phases, checked before the version bump; a bar with no phase lands as before.
--
-- No table is created.

-- ---------------------------------------------------------------------------------------------
-- 1) The rough's copy of a rows template
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.gc_rough_schedules ADD COLUMN IF NOT EXISTS template_rows jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_rough_schedules_template_rows_shaped' AND conrelid = 'public.gc_rough_schedules'::regclass) THEN
    ALTER TABLE public.gc_rough_schedules ADD CONSTRAINT gc_rough_schedules_template_rows_shaped
      CHECK (template_rows IS NULL OR (jsonb_typeof(template_rows) = 'object' AND template_name IS NOT NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.gc_rough_schedules.template_rows IS
  'Punch list #210 (v2.6651): a copy of the rows template the rough was drawn from, {phases, rows, workingDays} as the kernel reads a template (TemplateRowsShape), beside template_lines. The rough draws from the copy as the first draft does, so no edit to the template reaches it. Null: drawn from the stage days alone, or from a template with lines alone.';

-- ---------------------------------------------------------------------------------------------
-- 2) The job's own work in a phase. The body is 20261008040000's with the phase read, checked and written.
-- ---------------------------------------------------------------------------------------------

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
  v_phase text := nullif(btrim(coalesce(p_bar ->> 'phase', '')), '');
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
  -- The phase (#210): one the schedule was drawn with, else the bar lands under Not in a phase.
  IF v_phase IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gc_schedules s
    WHERE s.project_id = p_project_id AND jsonb_typeof(s.phases) = 'array' AND s.phases ? v_phase
  ) THEN
    RAISE EXCEPTION 'That phase is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  v_version := public.gc_schedule_bump(p_project_id, p_version, p_words);
  IF EXISTS (
    SELECT 1 FROM unnest(v_after || v_holds) AS f(id)
    WHERE f.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id AND a.id = f.id)
  ) THEN
    RAISE EXCEPTION 'A wait names a bar that is not on this schedule.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.gc_schedule_keep_start(p_project_id);
  INSERT INTO public.gc_schedule_activities (id, project_id, kind, position, start, finish, label, who, phase)
  VALUES (v_id, p_project_id, 'added',
          (SELECT coalesce(max(a.position), -1) + 1 FROM public.gc_schedule_activities a WHERE a.project_id = p_project_id),
          v_start, v_finish, v_label, v_who, v_phase);
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

COMMENT ON FUNCTION public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text) IS
  'GC mode (v2.4848; the phase since v2.6651, punch list #210): the job''s own work on the chart (G-38), with its waits, the bars that wait on it and what that pushes, in the phase p_bar.phase names when the schedule was drawn with phases. Returns the new version. SECURITY INVOKER.';

-- The grant stands through CREATE OR REPLACE: authenticated may execute; PUBLIC and anon may not.
REVOKE ALL ON FUNCTION public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text) TO authenticated;
