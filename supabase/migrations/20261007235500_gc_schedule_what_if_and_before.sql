SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 4 (v2.4816): what if and before the job, from the
-- prototype's model (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md on branch spike/gc-mode, "The tables":
-- What if, and before the job). Schedule templates from earlier jobs, company-wide; a rough
-- schedule while we bid, on the GC project before it has a schedule; one person's what-if copy of
-- a schedule; and the key gc_schedules.template_id waited for (the schedule's PR 2). Who sees them:
-- dev only while it is built (decision 4), and a what-if copy only its own person (decision 6).
-- Nothing reads or writes these yet: the RPCs are the schedule's PR 5.

-- A schedule template (ScheduleTemplate, G-44): a job's shape, saved to draw other jobs from.
-- Company-wide, with no project key, like the scope book. Its lines never change once saved, only
-- its name and the day it was set aside (the privileges below).
CREATE TABLE IF NOT EXISTS public.gc_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
    CONSTRAINT gc_schedule_templates_named CHECK (btrim(name) <> '' AND char_length(name) <= 60),
  -- The job it was saved from, its name then, and how much of its work was done.
  from_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  from_name text NOT NULL,
  from_done_pct numeric NOT NULL
    CONSTRAINT gc_schedule_templates_done_percent CHECK (from_done_pct >= 0 AND from_done_pct <= 100),
  saved_on date NOT NULL,
  saved_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- TemplateLine[]: each line by trade and name, with its stage, days, waits (by trade and name,
  -- with their gaps), offset, place and parts. Read whole by the first draft (scheduleDraft).
  lines jsonb NOT NULL
    CONSTRAINT gc_schedule_templates_lines_listed CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) > 0),
  -- Each stage's span on that job in days, in build order, and its weeks to build.
  stages jsonb NOT NULL
    CONSTRAINT gc_schedule_templates_stages_listed CHECK (jsonb_typeof(stages) = 'array'),
  weeks integer NOT NULL
    CONSTRAINT gc_schedule_templates_weeks_counted CHECK (weeks >= 1),
  -- Set aside: not offered for new jobs. The jobs drawn from it keep what they drew.
  aside_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_schedule_templates IS
  'GC mode (v2.4816): a schedule template (ScheduleTemplate, G-44), company-wide: a GC job''s shape saved to draw other jobs from, with its name, the job it came from and how much of it was done, who saved it and when, its lines (TemplateLine[], by trade and name), its stages and weeks, and the day it was set aside. Append only, but its name and aside_on.';

-- Another template's name is refused, whatever the case (templateNameProblem).
CREATE UNIQUE INDEX IF NOT EXISTS gc_schedule_templates_name_once ON public.gc_schedule_templates (lower(name));
CREATE INDEX IF NOT EXISTS gc_schedule_templates_from_project_idx ON public.gc_schedule_templates (from_project_id) WHERE from_project_id IS NOT NULL;

-- A rough schedule while we bid (RoughSchedule, G-45): the start the office assumes and the job's
-- own stage days, drawn by the first draft's rules, never the schedule itself. Keyed by the GC
-- project, which New project makes while we bid (gc_create_project); the job has no gc_schedules
-- row until its first draft.
CREATE TABLE IF NOT EXISTS public.gc_rough_schedules (
  project_id uuid PRIMARY KEY REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  start date NOT NULL,
  -- This job's stage lengths in days, by stage key. A stage not named takes its usual days.
  stage_days jsonb NOT NULL DEFAULT '{}'
    CONSTRAINT gc_rough_schedules_stage_days_keyed CHECK (jsonb_typeof(stage_days) = 'object'),
  drawn_on date NOT NULL,
  drawn_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The weeks and the finish as they went with our bid: kept when the bid went in, or at award.
  kept_on date,
  kept_weeks integer,
  kept_finish date,
  kept_at text
    CONSTRAINT gc_rough_schedules_kept_at_known CHECK (kept_at IS NULL OR kept_at IN ('bid', 'award')),
  -- The template it was drawn from (G-44), its name as it read that day, and a copy of its lines,
  -- so no edit to the template reaches the rough. The prototype calls the copy like.
  template_id uuid REFERENCES public.gc_schedule_templates(id) ON DELETE SET NULL,
  template_name text,
  template_used_on date,
  template_lines jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_rough_schedules_kept_whole CHECK (
    num_nulls(kept_on, kept_weeks, kept_finish, kept_at) IN (0, 4) AND (kept_weeks IS NULL OR kept_weeks >= 1)
  ),
  CONSTRAINT gc_rough_schedules_template_whole CHECK (
    (template_name IS NULL) = (template_used_on IS NULL) AND (template_name IS NULL) = (template_lines IS NULL)
    AND (template_id IS NULL OR template_name IS NOT NULL)
    AND (template_lines IS NULL OR jsonb_typeof(template_lines) = 'array')
  )
);

COMMENT ON TABLE public.gc_rough_schedules IS
  'GC mode (v2.4816): a rough schedule while we bid a GC project (RoughSchedule, G-45): the start the office assumes and the job''s own stage days, the weeks and finish kept when our bid went in or at award, and the template it was drawn from with a copy of its lines (template_lines, the prototype''s like). Never the schedule itself: it keys to gc_projects, which exists while we bid, not to gc_schedules.';

CREATE INDEX IF NOT EXISTS gc_rough_schedules_template_idx ON public.gc_rough_schedules (template_id) WHERE template_id IS NOT NULL;

-- One person's what-if copy of a schedule (ScheduleWhatIf, G-81, decision 6): the copy as the
-- kernel keeps it, with the moves tried on it and their noWhy, and its base, each bar's planned
-- dates, waits, limits and parts on the real schedule when it was made. Nobody else sees it. Keep
-- turns its moves into real ones through the plan writes (the schedule's PR 11), refused once the
-- real schedule has lost the base (whatIfBaseChanges).
CREATE TABLE IF NOT EXISTS public.gc_schedule_what_ifs (
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  made_on date NOT NULL,
  -- The schedule's version when it was made, to name what changed since (decision 5).
  base_version integer NOT NULL
    CONSTRAINT gc_schedule_what_ifs_version_counted CHECK (base_version >= 0),
  -- WhatIfBase by bar id.
  base jsonb NOT NULL
    CONSTRAINT gc_schedule_what_ifs_base_keyed CHECK (jsonb_typeof(base) = 'object'),
  -- The copy's ProjectSchedule: its bars, waits, parts and the moves tried on it.
  copy jsonb NOT NULL
    CONSTRAINT gc_schedule_what_ifs_copy_whole CHECK (jsonb_typeof(copy) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

COMMENT ON TABLE public.gc_schedule_what_ifs IS
  'GC mode (v2.4816): one person''s what-if copy of a GC project''s schedule (ScheduleWhatIf, G-81, decision 6): its base (each bar''s planned dates, waits, limits and parts on the real schedule when it was made), the schedule''s version then, and the copy itself with the moves tried on it, as the kernel keeps it. Nobody else sees it: its policy holds it to user_id.';

CREATE INDEX IF NOT EXISTS gc_schedule_what_ifs_user_idx ON public.gc_schedule_what_ifs (user_id);

-- The key gc_schedules.template_id waited for (the schedule's PR 2), the way 20261006234000 gave
-- gc_scope_items.added_in_set_id its own. A template removed later leaves the schedule's name and
-- day (gc_schedules_template_named).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedules_template_fkey'
  ) THEN
    ALTER TABLE public.gc_schedules
      ADD CONSTRAINT gc_schedules_template_fkey
      FOREIGN KEY (template_id) REFERENCES public.gc_schedule_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Who sees them (decision 4): dev only while it is built, the check made once a statement; a
-- what-if copy only its own person (decision 6). The schedule's PR 10 swaps is_dev() for the
-- job's team, and keeps the copy's person.
ALTER TABLE public.gc_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_rough_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_what_ifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_schedule_templates_dev ON public.gc_schedule_templates;
CREATE POLICY gc_schedule_templates_dev ON public.gc_schedule_templates FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_rough_schedules_dev ON public.gc_rough_schedules;
CREATE POLICY gc_rough_schedules_dev ON public.gc_rough_schedules FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_what_ifs_dev ON public.gc_schedule_what_ifs;
CREATE POLICY gc_schedule_what_ifs_dev ON public.gc_schedule_what_ifs FOR ALL TO authenticated
  USING ((SELECT public.is_dev()) AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_dev()) AND user_id = (SELECT auth.uid()));

-- Nobody signed out reaches them.
REVOKE ALL ON TABLE public.gc_schedule_templates, public.gc_rough_schedules, public.gc_schedule_what_ifs FROM anon;

-- A template's lines never change once saved: no update, delete or truncate, but its name and the
-- day it is set aside.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_schedule_templates FROM authenticated;
GRANT UPDATE (name, aside_on) ON TABLE public.gc_schedule_templates TO authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
