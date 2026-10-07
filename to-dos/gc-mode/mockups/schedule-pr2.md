---
name: "The schedule's PR 2: the schedule and its bars, as tables"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 2; The tables (The schedule and its bars, and Baselines)
branch: the plan on spike/schedule-pr2-plan (from origin/spike/gc-mode at 1b3c30db4); the migration from origin/main when the PR is cut
status: plan 2026-10-07 by Helper 1 at the lead's ask; the lead's go the same day on the three calls as picked. Cut from main at 43e9d4bff as #4814 (v2.4798), with the stamp 20261007210000, past the uncollectible lane's two unmerged claims on purpose. The tables in SCHEDULE_REAL_BUILD.md are amended to match. Not applied: the lead pushes it from a clean checkout after the merge and opens the types PR.
---

# The schedule's PR 2: the schedule and its bars, as tables

## What it is

- **One migration**, `<stamp>_gc_schedule_tables.sql`, with nine tables. It follows main's house rules:
  - `SET lock_timeout = '3s';` first.
  - `IF NOT EXISTS` throughout, and `DROP POLICY IF EXISTS` before each policy.
  - RLS on every table, dev only.
  - The three sweep calls at the end.
- **With it**, as every PR on main:
  - the migration doc, `docs/migrations/<stamp>_gc_schedule_tables.md`;
  - a release note, `src/content/releaseNotes/v2.NNNN.ts`;
  - its fragment, `docs/recent-features/v2.NNNN.md`.
- **Not in it.** There is no client change and no types. The lead regenerates `src/types/database.ts`
  in the types PR after the push.
- **Nothing reads or writes these tables until later PRs.** The RPCs are the schedule's PR 5, the
  mapper PR 6, and the first screen PR 7.

## Three calls for the lead

1. **Nine tables, not eight.** PR 2's line in `SCHEDULE_REAL_BUILD.md` reads "`gc_schedule_baselines`
   with their dates". *The tables* gives the dates a table of their own, `gc_schedule_baseline_dates`:
   one row per baseline and bar. My pick is to keep it, as *The tables* says. The alternative is a
   `jsonb` of dates on the baseline row. That is one table fewer, but nothing checks a bar's id
   inside it.
2. **The policy's form.**
   - The GC lane's two table migrations write `USING (public.is_dev())` and leave `anon` alone
     (`20261006233000`, `20261006234000`).
   - The newest on main wrap it, `USING ((SELECT public.is_dev()))`, and revoke `anon`
     (`20261007040000_bid_changes`, `20261007110000_court_areas`).
   - With the wrap, Postgres asks once a statement, not once a row. A schedule has hundreds of
     bars, and each `is_dev()` reads `users`.
   - **My pick is the newest form.** PR 10's team policies should be written the same way.
3. **The children hang off the schedule's row, not the project.** Every table with a `project_id`
   references `gc_schedules(project_id)`, not `gc_projects`. So no bar, link, milestone, baseline or
   change exists without the header that carries the version (decision 5). Deleting the header
   takes them all. *The tables* says they hang off the project. This is one step narrower, and the
   mapper reads the same rows either way.

## The tables

Each column names the prototype field it carries (`src/lib/gc/schedule/types.ts` on main, word for
word the spike's).

| Table | One row per | The prototype's | Notes |
|---|---|---|---|
| `gc_schedules` | GC project with a schedule drawn | `ProjectSchedule` (its header) and `.template` | `version`; the template's FK comes in PR 4 |
| `gc_schedule_activities` | bar | `ScheduleActivity` | `line`, `inspection` or `added`; one bar per scope line |
| `gc_schedule_activity_parts` | part of a split line | `ActivityPart` | days from the line's start; one name per line |
| `gc_schedule_links` | wait | `.after` with `.lag` | `finish_start` only; both ends on one job |
| `gc_schedule_milestones` | date to meet | `ScheduleMilestone` | null `package_id`: the job's own |
| `gc_schedule_inspection_failures` | failed inspection | `InspectionFailure` | the trades whose work failed, as `uuid[]` |
| `gc_schedule_baselines` | baseline | `ScheduleBaseline` | null name reads *At Start* |
| `gc_schedule_baseline_dates` | baseline and bar | `ScheduleBaseline.activities` | primary key (baseline, bar) |
| `gc_schedule_changes` | plan write | the log line a plan write makes | primary key (project, version); append only |

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 2 (v2.NNNN): the schedule and its bars, from the
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
  'GC mode (v2.NNNN): one row per GC project with a schedule drawn: the version every plan write checks and bumps (decision 5), when and by whom it was drawn, and the template it came from with its name as it read that day. Its bars, links, milestones, baselines and changes hang off it. Read by nothing yet: the schedule''s PR 5 writes it (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md).';

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
  'GC mode (v2.NNNN): one row per bar on a GC project''s schedule (ScheduleActivity): kind line (a trade''s line or our crew''s stage, keyed to its scope line), inspection or added (the job''s own work, G-38); its planned days, its limits (G-36), its real days (G-55), its place (G-83), and the kind''s own columns. One bar per scope line. Its waits are gc_schedule_links, its parts gc_schedule_activity_parts.';

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
  'GC mode (v2.NNNN): a line split into parts (ActivityPart, G-39): the part''s name, its days counted from the line''s start, its share of the line (set at the split, the shares add to 100), its own percent and its real days. One name per line.';

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
  'GC mode (v2.NNNN): what a bar waits on (ScheduleActivity.after and .lag): to_activity_id starts after from_activity_id finishes, gap days later (below zero: side by side, G-82). Only finish_start (decision 3). Both ends are bars of one job. A wait that would make a loop is warned about before it saves, in the kernel (planMove).';

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
  'GC mode (v2.NNNN): a date a GC project''s schedule must meet (ScheduleMilestone): its name, the day planned, the trade whose work meets it (null: the job''s own) and the day it was met. Substantial completion under the contract is worked out from it and the signed change orders, never stored.';

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
  'GC mode (v2.NNNN): an inspection on a GC project''s schedule that did not pass (InspectionFailure): the day, the inspector''s words, the trades whose work failed (package_ids) and the day it is looked at again.';

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
  'GC mode (v2.NNNN): a baseline of a GC project''s schedule (ScheduleBaseline, G-41): the plan kept as it stood, its name (null reads At Start), the day, who and why. The newest by created_at is the one the chart measures against; the ones before it stay, named. Its dates are gc_schedule_baseline_dates.';

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
  'GC mode (v2.NNNN): one bar''s planned days in a baseline (ScheduleBaseline.activities), as they stood when it was kept.';

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
  'GC mode (v2.NNNN): one line per plan write on a GC project''s schedule (decision 5): the version it made, who, when and its words. A press sent with an older version is refused with the lines since. Append only: authenticated may not update, delete or truncate it.';

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
```

## The migration doc as it will be

````markdown
# <stamp>_gc_schedule_tables.sql (2026-10-07, v2.NNNN)

GC mode, the real build, the schedule's PR 2: the schedule and its bars as tables, from the prototype's model (`to-dos/gc-mode/SCHEDULE_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`). Nine tables. Nothing reads or writes them yet: the RPCs are the schedule's PR 5, the mapper PR 6.

- **`gc_schedules`**, one row per GC project with a schedule drawn, keyed by `project_id` (FK `gc_projects`). It holds `version`, which every plan write checks and bumps, with `drafted_on` and `drafted_by`. The template the draft came from is `template_id`, `template_name` and `template_used_on`; `template_id` gains its foreign key with `gc_schedule_templates` in PR 4. Then `updated_at` and `updated_by`.
- **`gc_schedule_activities`**, one row per bar.
  - `kind` is line, inspection or added, with a `position`.
  - A line has its `scope_item_id` and `package_id`. There is one bar per scope line.
  - Every bar has `start` and `finish`, and may have `not_before` and `must_finish_by`, `actual_start` and `actual_finish`, and a `place`.
  - The kind's own columns: `label` and `passed_on` for an inspection, and `label`, `who` and `done_on` for the job's own work.
- **`gc_schedule_activity_parts`**: a line's parts. Each has `from_day` and `days` from the line's start, a `share`, a `pct` and its real days. Each name appears once a line.
- **`gc_schedule_links`**: what each bar waits on. `gap` is in days, and below zero means side by side. The only `kind` is finish_start. Both ends are bars of one job.
- **`gc_schedule_milestones`**: the dates to meet, with `planned`, `package_id` and `met_on`. A null `package_id` means the job's own.
- **`gc_schedule_inspection_failures`**: an inspection that did not pass, with `failed_on`, a `note`, `package_ids` and `reinspect_on`.
- **`gc_schedule_baselines`** and **`gc_schedule_baseline_dates`**: the plan kept as it stood. A baseline has a `name`, `locked_on`, `locked_by` and `why`; a null name reads *At Start*. The dates table holds each bar's dates then.
- **`gc_schedule_changes`**: one line of words for each plan write, keyed by project and version. It is append only: `authenticated` has no UPDATE, DELETE or TRUNCATE on it.

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 4). The schedule's PR 10 opens them to the job's team. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: any. No screen reads these tables until the schedule's PR 7 (PR 6's reads and writes are called by none before it). It is additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). Each foreign key takes a short lock on the table it names: `gc_projects`, `gc_scope_items`, `gc_trade_packages` and `users`. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** Run it read only.

   ```sql
   BEGIN READ ONLY;
   SELECT c.relname AS table_name,
          c.relrowsecurity AS rls_on,
          count(*) FILTER (WHERE p.policyname = c.relname || '_dev') AS dev_policy,
          count(*) FILTER (WHERE p.policyname LIKE 'read_only_users_cannot_%' AND p.permissive = 'RESTRICTIVE') AS read_only_blocks,
          count(*) FILTER (WHERE p.policyname LIKE 'digital_twin_write_fence_%') AS twin_fences,
          (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'read_only_block_stmt') AS stmt_trigger
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
   WHERE c.relname IN ('gc_schedules', 'gc_schedule_activities', 'gc_schedule_activity_parts', 'gc_schedule_links',
     'gc_schedule_milestones', 'gc_schedule_inspection_failures', 'gc_schedule_baselines',
     'gc_schedule_baseline_dates', 'gc_schedule_changes')
   GROUP BY c.oid, c.relname, c.relrowsecurity
   ORDER BY c.relname;
   ROLLBACK;
   ```

   Expect nine rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1.

2. **Each is empty.**

   ```sql
   SELECT (SELECT count(*) FROM public.gc_schedules) AS schedules,
          (SELECT count(*) FROM public.gc_schedule_activities) AS activities,
          (SELECT count(*) FROM public.gc_schedule_activity_parts) AS parts,
          (SELECT count(*) FROM public.gc_schedule_links) AS links,
          (SELECT count(*) FROM public.gc_schedule_milestones) AS milestones,
          (SELECT count(*) FROM public.gc_schedule_inspection_failures) AS failures,
          (SELECT count(*) FROM public.gc_schedule_baselines) AS baselines,
          (SELECT count(*) FROM public.gc_schedule_baseline_dates) AS baseline_dates,
          (SELECT count(*) FROM public.gc_schedule_changes) AS changes;
   ```

   Expect zeros.

3. **A read-only user's insert is refused.** This runs in a transaction that rolls back. The statement trigger refuses before any row is looked at, so the new schedule's id need not exist.

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_schedules (project_id, drafted_on) VALUES (gen_random_uuid(), DATE '2026-10-07');
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.` If the first `SELECT` returns no row, no user is in training mode yet and this check waits for one. Without one, the insert would fail on RLS instead, which proves nothing about the block.

4. **A plan write's words stay as they were said, even for a dev.**

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   UPDATE public.gc_schedule_changes SET words = words;
   ROLLBACK;
   ```

   Expect `ERROR: permission denied for table gc_schedule_changes`. A `DELETE` gives the same.

5. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_schedules; ROLLBACK;` and expect `ERROR: permission denied for table gc_schedules`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these tables yet. Going back is a new migration that drops them with `DROP TABLE IF EXISTS`, in this order: `gc_schedule_changes`, `gc_schedule_baseline_dates`, `gc_schedule_baselines`, `gc_schedule_inspection_failures`, `gc_schedule_milestones`, `gc_schedule_links`, `gc_schedule_activity_parts`, `gc_schedule_activities`, `gc_schedules`.
````

## Drift from `SCHEDULE_REAL_BUILD.md`'s table section

These are what the SQL above does that *The tables* does not say, or says another way. Each is small, and none changes a kernel. Once the lead agrees, PR 2's own commit on the spike amends *The tables* to match, line by line.

- **`gc_schedule_baseline_dates`** is in PR 2, as *The tables* has it. PR 2's line says "with their dates" (call 1 above).
- **`gc_schedules.template_id` has no foreign key yet.** *The tables* gives it one to
  `gc_schedule_templates`, which is PR 4's. PR 4 adds the key in a `DO` block, as
  `20261006234000` did for `gc_scope_items.added_in_set_id`. A template removed later sets it null
  and leaves the name and the day. A check holds the three together: no id without a name, and no
  name without its day.
- **The children reference `gc_schedules(project_id)`** (call 3).
- **Two keys keep a link inside one job.** The links' two ends reference
  `gc_schedule_activities(project_id, id)`, which a unique constraint on the bars allows. *The
  tables* names plain keys to the bar.
- **Checks *The tables* leaves unsaid:**
  - finish on or after start, for a bar, its real days, a part's real days and a baseline's dates;
  - a part's days from 1, its first day from 0, and its share and percent within 0 to 100;
  - a line has its scope line and trade, and the other two kinds have a name and no trade;
  - the job's own work says whose it is;
  - only an inspection has a pass day;
  - a place is never blank;
  - a failed inspection's note is never blank, and its next look is after the day it failed.

  Each follows what the prototype's reducer already refuses, so no record the prototype keeps
  breaks one.
- **`gc_schedule_baselines.created_at`** orders two baselines kept on one day. *The tables* says
  "the newest" without a column to tell.
- **`drafted_on`, `locked_on` and `failed_on` have no default.** The writer gives the company day.
  The server's `current_date` is UTC, and it is tomorrow in the evening here.
- **The append-only rule for `gc_schedule_changes`** is privileges (`REVOKE UPDATE, DELETE,
  TRUNCATE`), not a missing policy. The plan writes are `SECURITY INVOKER`, as `gc_create_project`
  and `gc_issue_plan_set` are, so a dev still inserts its lines. PR 10's policy swap cannot open it
  by accident.
- **The policy's form** is the newest on main (call 2). *The tables* quotes the plain form of
  `20261006233000`.
- **The version starts at 0**, as *The tables* says, and a change line's version at 1. Whether the
  draw itself writes version 1 is PR 5's to settle; the tables allow either.
- **Nothing ties a failure to an inspection's bar, or a link to a loop, in the table.** The writer
  (PR 5) and the kernel (`planMove`'s warnings) do, as *The tables* says.

## The check

- **Before the merge (CI):** `scripts/check-migrations.sh` checks the lock timeout and that no two
  stamps are the same. Nothing checks that the stamp comes after main's newest, so step 2 of *When
  it is cut* does. `src/lib/releaseNotes.test.ts` checks the note and the fragment.
- **By hand before opening the PR:** the SQL cannot be rehearsed, since there is no local Postgres.
  Instead:
  - Read it against the precedents, `20261006233000` and `20261006234000` for the GC tables and
    `20261007110000` for the policy form.
  - Grep that every name it references exists on main: `gc_projects(project_id)`,
    `gc_scope_items(id)`, `gc_trade_packages(id)`, `users(id)`, `is_dev()` and the three sweep
    functions.
  - Every constraint and index name begins with its own table's name, so none can collide.
- **After the push (the lead):** the doc's *Verify after the push*, steps 1 to 5. These are the
  build doc's own check (*each table empty with its policy, and a read-only user's insert is
  refused*) and two more: the append-only words, and nothing for `anon`.
- **Then** `npm run check:migration-drift` and the types PR.

## When it is cut

1. Branch from `origin/main`.
2. Take the next stamp after main's newest at that moment, and after any stamp another session has
   claimed but not merged (`.claude/sessions/claims/` in the main checkout). Otherwise one of theirs
   pushed first lands later than this and `db push` refuses it. Claim it from the PR's branch,
   since the claim records the branch checked out:
   `npm run claim -- --migration supabase/migrations/<stamp>_gc_schedule_tables.sql`.
3. Claim the version with `npm run claim -- --branch <branch>`. Put it in the ten `v2.NNNN`
   (the header's, and each table's comment) and in the doc.
4. Add the migration, its doc, the release note and the fragment. The note's kind is infra, its
   role dev, and it has two bullets: the schedule gets its tables, and nothing reads them yet.
5. Open the PR with auto-merge. The lead pushes it after the merge from a clean checkout and opens
   the types PR. I never apply it.
