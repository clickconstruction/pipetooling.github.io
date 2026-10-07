SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 2 (v2.4798): the schedule and its bars, from the
-- prototype's model (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md on branch spike/gc-mode, "The tables":
-- The schedule and its bars, and Baselines). A GC project's schedule is one header row, keyed by
-- the project, with the version every plan write checks and bumps (decision 5). Hanging off it:
-- the bars, a line's parts, what each bar waits on, the dates to meet, an inspection's failures,
-- the baselines with their dates, and one line of words for each plan write. Who sees them: dev
-- only while it is built (decision 4); the schedule's PR 10 opens them to the job's team. Nothing
-- reads or writes these yet: the RPCs are the schedule's PR 5, the mapper PR 6.

-- One row per GC project with a schedule drawn (decision 1). No row: nothing drawn yet.
CREATE TABLE IF NOT EXISTS public.gc_schedules (
  project_id uuid PRIMARY KEY REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- Counts the plan: which bars there are, their planned dates, their waits and gaps, their limits,
  -- their parts' days and the baselines. Every plan write sends the version it read and bumps it.
  version integer NOT NULL DEFAULT 0
    CONSTRAINT gc_schedules_version_counted CHECK (version >= 0),
  -- The company day it was drawn, as the writer gives it (never the server's date).
  drafted_on date NOT NULL,
  drafted_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The template the first draft came from (ProjectSchedule.template, G-44), with its name as it
  -- read that day. template_id gains its foreign key when gc_schedule_templates exists (the
  -- schedule's PR 4); a template removed later leaves the name and the day.
  template_id uuid,
  template_name text,
  template_used_on date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT gc_schedules_template_named CHECK (
    (template_name IS NULL) = (template_used_on IS NULL) AND (template_id IS NULL OR template_name IS NOT NULL)
  )
);

COMMENT ON TABLE public.gc_schedules IS
  'GC mode (v2.4798): one row per GC project with a schedule drawn: the version every plan write checks and bumps (decision 5), when and by whom it was drawn, and the template it came from with its name as it read that day. Its bars, links, milestones, baselines and changes hang off it. Read by nothing yet: the schedule''s PR 5 writes it (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md).';

-- One row per bar (ScheduleActivity): a trade's line or our crew's stage (line), an inspection, or
-- the job's own work (added, G-38). Its waits are rows of gc_schedule_links and its parts rows of
-- gc_schedule_activity_parts. A line's percent is not kept here: it is the trade's report
-- (decision 2).
CREATE TABLE IF NOT EXISTS public.gc_schedule_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT gc_schedule_activities_kind_known CHECK (kind IN ('line', 'inspection', 'added')),
  position integer NOT NULL DEFAULT 0,
  -- A line's scope line and its trade (the prototype's lineId and packageId). A statement of work's
  -- lines keep their scope lines' ids, so a bar never waits for one (decision 2).
  scope_item_id uuid REFERENCES public.gc_scope_items(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  -- Both days counted (decision 8).
  start date NOT NULL,
  finish date NOT NULL,
  -- The day it cannot start before and the day it must finish by (G-36).
  not_before date,
  must_finish_by date,
  -- The real days it ran (G-55).
  actual_start date,
  actual_finish date,
  -- Where the work is (G-83), as the office kept it. A guess is never stored.
  place text,
  -- An inspection's name and the day it passed. The job's own work's name, whose it is, and the day
  -- it was done.
  label text,
  passed_on date,
  who text,
  done_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_schedule_activities_line_or_label CHECK (
    CASE kind
      WHEN 'line' THEN scope_item_id IS NOT NULL AND package_id IS NOT NULL
      ELSE scope_item_id IS NULL AND package_id IS NULL AND btrim(coalesce(label, '')) <> ''
    END
  ),
  CONSTRAINT gc_schedule_activities_whose CHECK (
    CASE kind
      WHEN 'added' THEN btrim(coalesce(who, '')) <> ''
      ELSE who IS NULL AND done_on IS NULL
    END
  ),
  CONSTRAINT gc_schedule_activities_passed_inspection CHECK (passed_on IS NULL OR kind = 'inspection'),
  CONSTRAINT gc_schedule_activities_dates_in_order CHECK (finish >= start),
  CONSTRAINT gc_schedule_activities_actual_in_order CHECK (actual_start IS NULL OR actual_finish IS NULL OR actual_finish >= actual_start),
  CONSTRAINT gc_schedule_activities_place_kept CHECK (place IS NULL OR (btrim(place) <> '' AND char_length(place) <= 40)),
  CONSTRAINT gc_schedule_activities_one_per_line UNIQUE (project_id, scope_item_id),
  -- So a link's two ends are bars of one job (gc_schedule_links).
  CONSTRAINT gc_schedule_activities_in_project UNIQUE (project_id, id)
);

COMMENT ON TABLE public.gc_schedule_activities IS
  'GC mode (v2.4798): one row per bar on a GC project''s schedule (ScheduleActivity): kind line (a trade''s line or our crew''s stage, keyed to its scope line), inspection or added (the job''s own work, G-38); its planned days, its limits (G-36), its real days (G-55), its place (G-83), and the kind''s own columns. One bar per scope line. Its waits are gc_schedule_links, its parts gc_schedule_activity_parts.';

CREATE INDEX IF NOT EXISTS gc_schedule_activities_project_idx ON public.gc_schedule_activities (project_id, position);
CREATE INDEX IF NOT EXISTS gc_schedule_activities_scope_item_idx ON public.gc_schedule_activities (scope_item_id) WHERE scope_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_schedule_activities_package_idx ON public.gc_schedule_activities (package_id) WHERE package_id IS NOT NULL;

-- A line split into parts (ActivityPart, G-39). Its days are counted from the line's start, so a
-- move of the line carries them. Its share was set from the days at the split and is kept; the
-- shares add up to 100.
CREATE TABLE IF NOT EXISTS public.gc_schedule_activity_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.gc_schedule_activities(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL
    CONSTRAINT gc_schedule_activity_parts_named CHECK (btrim(name) <> ''),
  from_day integer NOT NULL
    CONSTRAINT gc_schedule_activity_parts_from_counted CHECK (from_day >= 0),
  days integer NOT NULL
    CONSTRAINT gc_schedule_activity_parts_days_counted CHECK (days >= 1),
  share numeric NOT NULL
    CONSTRAINT gc_schedule_activity_parts_share_percent CHECK (share >= 0 AND share <= 100),
  pct numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_schedule_activity_parts_pct_percent CHECK (pct >= 0 AND pct <= 100),
  actual_start date,
  actual_finish date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_schedule_activity_parts_actual_in_order CHECK (actual_start IS NULL OR actual_finish IS NULL OR actual_finish >= actual_start)
);

COMMENT ON TABLE public.gc_schedule_activity_parts IS
  'GC mode (v2.4798): a line split into parts (ActivityPart, G-39): the part''s name, its days counted from the line''s start, its share of the line (set at the split, the shares add to 100), its own percent and its real days. One name per line.';

CREATE UNIQUE INDEX IF NOT EXISTS gc_schedule_activity_parts_name_once ON public.gc_schedule_activity_parts (activity_id, lower(name));
CREATE INDEX IF NOT EXISTS gc_schedule_activity_parts_activity_idx ON public.gc_schedule_activity_parts (activity_id, position);

-- What each bar waits on (ScheduleActivity.after and .lag): one row per wait, with its gap in days.
-- to_activity_id starts after from_activity_id finishes, gap days later; below zero is side by side
-- (G-82). Only finish, then start for now (decision 3): a later kind is a new value.
CREATE TABLE IF NOT EXISTS public.gc_schedule_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  from_activity_id uuid NOT NULL,
  to_activity_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'finish_start'
    CONSTRAINT gc_schedule_links_kind_known CHECK (kind IN ('finish_start')),
  gap integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Both ends are bars of this job.
  CONSTRAINT gc_schedule_links_from_fkey FOREIGN KEY (project_id, from_activity_id)
    REFERENCES public.gc_schedule_activities(project_id, id) ON DELETE CASCADE,
  CONSTRAINT gc_schedule_links_to_fkey FOREIGN KEY (project_id, to_activity_id)
    REFERENCES public.gc_schedule_activities(project_id, id) ON DELETE CASCADE,
  CONSTRAINT gc_schedule_links_once UNIQUE (from_activity_id, to_activity_id),
  CONSTRAINT gc_schedule_links_two_bars CHECK (from_activity_id <> to_activity_id)
);

COMMENT ON TABLE public.gc_schedule_links IS
  'GC mode (v2.4798): what a bar waits on (ScheduleActivity.after and .lag): to_activity_id starts after from_activity_id finishes, gap days later (below zero: side by side, G-82). Only finish_start (decision 3). Both ends are bars of one job. A wait that would make a loop is warned about before it saves, in the kernel (planMove).';

CREATE INDEX IF NOT EXISTS gc_schedule_links_to_idx ON public.gc_schedule_links (project_id, to_activity_id);

-- The dates the job must meet (ScheduleMilestone). Substantial completion's day under the contract
-- is worked out, never stored: the milestone's planned day plus the signed change orders' days.
CREATE TABLE IF NOT EXISTS public.gc_schedule_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  label text NOT NULL
    CONSTRAINT gc_schedule_milestones_labeled CHECK (btrim(label) <> ''),
  planned date NOT NULL,
  -- The trade whose work meets it. Null: the job's own.
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE SET NULL,
  met_on date,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_schedule_milestones IS
  'GC mode (v2.4798): a date a GC project''s schedule must meet (ScheduleMilestone): its name, the day planned, the trade whose work meets it (null: the job''s own) and the day it was met. Substantial completion under the contract is worked out from it and the signed change orders, never stored.';

CREATE INDEX IF NOT EXISTS gc_schedule_milestones_project_idx ON public.gc_schedule_milestones (project_id, position);
CREATE INDEX IF NOT EXISTS gc_schedule_milestones_package_idx ON public.gc_schedule_milestones (package_id) WHERE package_id IS NOT NULL;

-- An inspection that did not pass (InspectionFailure): the day, the inspector's words, the trades
-- whose work failed, and the day it is looked at again. Kept on an inspection's bar: the writer
-- (the schedule's PR 5) sees to that.
CREATE TABLE IF NOT EXISTS public.gc_schedule_inspection_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.gc_schedule_activities(id) ON DELETE CASCADE,
  failed_on date NOT NULL,
  note text NOT NULL
    CONSTRAINT gc_schedule_inspection_failures_said CHECK (btrim(note) <> ''),
  package_ids uuid[] NOT NULL DEFAULT '{}',
  reinspect_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_schedule_inspection_failures_again_later CHECK (reinspect_on > failed_on)
);

COMMENT ON TABLE public.gc_schedule_inspection_failures IS
  'GC mode (v2.4798): an inspection on a GC project''s schedule that did not pass (InspectionFailure): the day, the inspector''s words, the trades whose work failed (package_ids) and the day it is looked at again.';

CREATE INDEX IF NOT EXISTS gc_schedule_inspection_failures_activity_idx ON public.gc_schedule_inspection_failures (activity_id, failed_on);

-- A baseline: the plan kept as it stood (ScheduleBaseline, G-41). The newest is the plan the chart
-- measures against; the ones it retired stay, named, oldest first. Its dates are rows of
-- gc_schedule_baseline_dates.
CREATE TABLE IF NOT EXISTS public.gc_schedule_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  -- Null reads "At Start": the one kept at the first plan write after Start (decision 7).
  name text
    CONSTRAINT gc_schedule_baselines_named CHECK (name IS NULL OR btrim(name) <> ''),
  locked_on date NOT NULL,
  locked_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  why text,
  -- Orders two kept on one day.
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_schedule_baselines IS
  'GC mode (v2.4798): a baseline of a GC project''s schedule (ScheduleBaseline, G-41): the plan kept as it stood, its name (null reads At Start), the day, who and why. The newest by created_at is the one the chart measures against; the ones before it stay, named. Its dates are gc_schedule_baseline_dates.';

CREATE INDEX IF NOT EXISTS gc_schedule_baselines_project_idx ON public.gc_schedule_baselines (project_id, created_at);

-- A baseline's dates: each bar's planned days when it was kept.
CREATE TABLE IF NOT EXISTS public.gc_schedule_baseline_dates (
  baseline_id uuid NOT NULL REFERENCES public.gc_schedule_baselines(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.gc_schedule_activities(id) ON DELETE CASCADE,
  start date NOT NULL,
  finish date NOT NULL,
  PRIMARY KEY (baseline_id, activity_id),
  CONSTRAINT gc_schedule_baseline_dates_in_order CHECK (finish >= start)
);

COMMENT ON TABLE public.gc_schedule_baseline_dates IS
  'GC mode (v2.4798): one bar''s planned days in a baseline (ScheduleBaseline.activities), as they stood when it was kept.';

CREATE INDEX IF NOT EXISTS gc_schedule_baseline_dates_activity_idx ON public.gc_schedule_baseline_dates (activity_id);

-- One row per plan write (decision 5): the version it made, who and when, and its words, the line
-- the prototype logs for it. A press refused for a stale version names what changed since from
-- these. Append only: nobody updates or deletes a line (the privileges below).
CREATE TABLE IF NOT EXISTS public.gc_schedule_changes (
  project_id uuid NOT NULL REFERENCES public.gc_schedules(project_id) ON DELETE CASCADE,
  version integer NOT NULL
    CONSTRAINT gc_schedule_changes_version_counted CHECK (version >= 1),
  made_at timestamptz NOT NULL DEFAULT now(),
  made_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  words text NOT NULL
    CONSTRAINT gc_schedule_changes_said CHECK (btrim(words) <> ''),
  PRIMARY KEY (project_id, version)
);

COMMENT ON TABLE public.gc_schedule_changes IS
  'GC mode (v2.4798): one line per plan write on a GC project''s schedule (decision 5): the version it made, who, when and its words. A press sent with an older version is refused with the lines since. Append only: authenticated may not update, delete or truncate it.';

-- Who sees them (decision 4): dev only while it is built. One policy a table, for every verb, the
-- check made once a statement. The schedule's PR 10 swaps each for the job's team.
ALTER TABLE public.gc_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_activity_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_inspection_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_baseline_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_schedule_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_schedules_dev ON public.gc_schedules;
CREATE POLICY gc_schedules_dev ON public.gc_schedules FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_activities_dev ON public.gc_schedule_activities;
CREATE POLICY gc_schedule_activities_dev ON public.gc_schedule_activities FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_activity_parts_dev ON public.gc_schedule_activity_parts;
CREATE POLICY gc_schedule_activity_parts_dev ON public.gc_schedule_activity_parts FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_links_dev ON public.gc_schedule_links;
CREATE POLICY gc_schedule_links_dev ON public.gc_schedule_links FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_milestones_dev ON public.gc_schedule_milestones;
CREATE POLICY gc_schedule_milestones_dev ON public.gc_schedule_milestones FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_inspection_failures_dev ON public.gc_schedule_inspection_failures;
CREATE POLICY gc_schedule_inspection_failures_dev ON public.gc_schedule_inspection_failures FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_baselines_dev ON public.gc_schedule_baselines;
CREATE POLICY gc_schedule_baselines_dev ON public.gc_schedule_baselines FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_baseline_dates_dev ON public.gc_schedule_baseline_dates;
CREATE POLICY gc_schedule_baseline_dates_dev ON public.gc_schedule_baseline_dates FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_schedule_changes_dev ON public.gc_schedule_changes;
CREATE POLICY gc_schedule_changes_dev ON public.gc_schedule_changes FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- Nobody signed out reaches them, and a plan write's words stay as they were said.
REVOKE ALL ON TABLE public.gc_schedules, public.gc_schedule_activities, public.gc_schedule_activity_parts,
  public.gc_schedule_links, public.gc_schedule_milestones, public.gc_schedule_inspection_failures,
  public.gc_schedule_baselines, public.gc_schedule_baseline_dates, public.gc_schedule_changes FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_schedule_changes FROM authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
