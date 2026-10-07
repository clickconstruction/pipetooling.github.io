---
name: "The schedule's PR 4: what if and before the job, as tables"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 4; The tables (What if, and before the job)
branch: the plan on spike/schedule-pr4-plan (from origin/spike/gc-mode at 897021a58); the migration from origin/main when the PR is cut, after PR 3 (#4827) is on main
status: plan 2026-10-07 by Helper 1 at the lead's ask; the lead's go the same day on the three answers and the three calls as picked. Cut from main at d21075a00 as #4835 (v2.4816), with the stamp 20261007235500, past three claims not yet merged (20261007230000, 20261007234000, 20261007235000) on purpose. The tables in SCHEDULE_REAL_BUILD.md are amended to match. Not applied: the lead pushes it after PR 3's, from a clean checkout, and opens the types PR. Paused 2026-10-07 for the handoff: see Status at the end.
---

# The schedule's PR 4: what if and before the job, as tables

## What it is

- **One migration**, `<stamp>_gc_schedule_what_if_and_before.sql`, with three tables:
  - `gc_schedule_templates`;
  - `gc_rough_schedules`;
  - `gc_schedule_what_ifs`.

  It also has the `DO` block that gives `gc_schedules.template_id` the key PR 2 left for it.
- **The house rules, as PRs 2 and 3:**
  - `SET lock_timeout = '3s';` first, and `IF NOT EXISTS` / `DROP POLICY IF EXISTS` throughout.
  - The `(SELECT public.is_dev())` policy form, with `anon` revoked.
  - The three sweep calls at the end.
  - The append-only privilege pattern, where it fits: a template keeps two doors.
- **With it:** the migration doc, a release note and its fragment. No client change and no types.
- **It needs PR 2's `gc_schedules`** and New project's `gc_projects`, so it is cut after PR 3 is on
  main and pushed after PR 3's migration. Nothing reads or writes these tables yet; the RPCs are
  PR 5, and the screens are PRs 11 and 12.

## The lead's three questions

### What a what-if copy holds

**The copy whole, as the kernel keeps it, with its base and the version it read.** That is neither
the plan as rows nor the moves alone.

- **The kernel's copy** is `ScheduleWhatIf`:
  - `schedule` is a whole `ProjectSchedule`: its bars with their waits, gaps, limits, parts and
    places, and the moves tried on it, `noWhy` and all.
  - `base` is each bar's planned dates, waits, gaps, limits and parts on the real schedule when the
    copy was made (`WhatIfBase`). Keep is safe only while the real schedule still has them
    (`whatIfBaseChanges`).
- **The moves alone cannot rebuild it.** A copy takes six actions (`WHAT_IF_ACTIONS`): a move, a
  pull, Undo, Redo, days got back and a part's own move. A move there can change a bar's waits, its
  gaps and its limits, and its record (`ScheduleMove`) keeps only the dates and `linksChanged`.
  Replaying the records on the real schedule would also go wrong once the real one changes, which
  is the case Keep has to name. So the actions would have to be kept and replayed through the
  kernel on a snapshot of the whole real schedule. That is more than this.
- **Rows would be six shadow tables** (bars, links, parts, moves, pushes, and so on), and no reader
  needs them. A copy is one person's, read whole by the Schedule tab, and never queried by line.
- **So the row holds:**
  - `base` (jsonb, `WhatIfBase` by bar id);
  - `copy` (jsonb, the copy's `ProjectSchedule`);
  - `base_version`, the schedule's version when it was made, so Keep's refusal can name what changed
    since (decision 5).

  Keep (PR 11) turns the moves tried into real rows through the plan writes, with the same checks
  as any move.
- **It is keyed by (`project_id`, `user_id`).** There is one copy a person a job, as decision 6
  says, and its policy holds each copy to its own person now (call 2).

### What a template line is

**A line of the job it was saved from, by trade and name, never by id** (`TemplateLine`):
- its `trade`, empty for one of the two inspections the first draft draws;
- its `label`;
- its `stage`;
- its `days`;
- what it waits on (`after`), by trade and name, each with the office's gap when one was set;
- its `offset` after the last of those, or after the job's first day;
- its kept `place`;
- its `parts`: name, first day, days and share, with no percent.

A template is drawn onto another job, so its lines cannot point at this job's scope lines. Another
job's line of the same trade and name takes it, whatever the case (`templateCovers`,
`scheduleDraft`'s `like`). The template's `lines` are a `jsonb` array, read whole by the first draft.
They never change once saved: only the name and the day it is set aside do. The privileges hold
that, with two column grants (call 1).

### What a rough schedule keys to

**`gc_projects(project_id)`.** New project makes the project's rows while we bid: `gc_create_project`
writes `projects` and `gc_projects` with the stage `bidding`. So a job we bid has its project row
from New project's first press.

It has no `gc_schedules` row until its first draft, after the award, and a rough is never the
schedule itself. So the rough keys to the GC project, one per project, not to `gc_schedules`. At the
award the first draft starts from the rough's start and its stage days (G-45). The rough stays as
it was kept.

## Three calls for the lead

1. **A template is append only, but for its name and its day set aside.** `authenticated` has no
   UPDATE, DELETE or TRUNCATE on it. `UPDATE (name, aside_on)` is the door, as *The tables* says
   ("its lines never change once saved, only its name and its day set aside"). The prototype sets a
   template aside and never removes one (`setAsideScheduleTemplate`).
   - The rough stays editable: it is redrawn until our bid goes in, and the writer refuses a redraw
     once it is kept.
   - So does the copy: each try rewrites it, and Keep or throwing it away deletes it.
2. **The copy's policy holds it to its person now:**
   `USING ((SELECT public.is_dev()) AND user_id = (SELECT auth.uid()))`, the same in `WITH CHECK`.
   Decision 6 makes a copy one person's, which is more than who sees the schedule. PR 10 swaps
   `is_dev()` for the job's team and keeps the person.
3. **`like` is `template_lines`.** *The tables* names the rough's copy of a template's lines `like`,
   the prototype's field. `LIKE` is a reserved word in SQL, so the column would need quotes in every
   query. The mapper (PR 6) maps it back to `like`.

## The tables

| Table | One row per | The prototype's | Append only |
|---|---|---|---|
| `gc_schedule_templates` | saved template, company-wide | `ScheduleTemplate` | yes, but its name and its day set aside |
| `gc_rough_schedules` | GC project, while we bid | `RoughSchedule` | no |
| `gc_schedule_what_ifs` | person and job | `ScheduleWhatIf` | no |

The templates come first, since the rough and the schedules' new key point at them.

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the schedule's PR 4 (v2.NNNN): what if and before the job, from the
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
  'GC mode (v2.NNNN): a schedule template (ScheduleTemplate, G-44), company-wide: a GC job''s shape saved to draw other jobs from, with its name, the job it came from and how much of it was done, who saved it and when, its lines (TemplateLine[], by trade and name), its stages and weeks, and the day it was set aside. Append only, but its name and aside_on.';

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
  'GC mode (v2.NNNN): a rough schedule while we bid a GC project (RoughSchedule, G-45): the start the office assumes and the job''s own stage days, the weeks and finish kept when our bid went in or at award, and the template it was drawn from with a copy of its lines (template_lines, the prototype''s like). Never the schedule itself: it keys to gc_projects, which exists while we bid, not to gc_schedules.';

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
  'GC mode (v2.NNNN): one person''s what-if copy of a GC project''s schedule (ScheduleWhatIf, G-81, decision 6): its base (each bar''s planned dates, waits, limits and parts on the real schedule when it was made), the schedule''s version then, and the copy itself with the moves tried on it, as the kernel keeps it. Nobody else sees it: its policy holds it to user_id.';

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
```

## The migration doc as it will be

````markdown
# <stamp>_gc_schedule_what_if_and_before.sql (2026-10-07, v2.NNNN)

GC mode, the real build, the schedule's PR 4: what if and before the job, as tables, from the prototype's model (`to-dos/gc-mode/SCHEDULE_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`), after PR 3's `<PR 3's stamp>_gc_schedule_moves_records.sql`. Three tables and one key. Nothing reads or writes them yet: the RPCs are the schedule's PR 5.

- **`gc_schedule_templates`**, company-wide: a GC job's shape saved to draw other jobs from.
  - `name`: at most 60 letters, and once whatever the case.
  - Where it came from: `from_project_id` (set null), `from_name` and `from_done_pct`.
  - `saved_on` and `saved_by`.
  - `lines`: a `TemplateLine[]` by trade and name, never empty.
  - `stages`, `weeks` and `aside_on`.
- **`gc_rough_schedules`**, one per GC project while we bid, keyed to `gc_projects`.
  - `start`, `stage_days`, `drawn_on` and `drawn_by`.
  - The weeks kept with our bid or at award: `kept_on`, `kept_weeks`, `kept_finish` and `kept_at`, all four or none.
  - The template it was drawn from, `template_id`, `template_name` and `template_used_on`, with its lines copied into `template_lines` (the prototype's `like`, a reserved word in SQL).
- **`gc_schedule_what_ifs`**: one person's copy of a schedule, keyed by (`project_id`, `user_id`). It holds `made_on`, `base_version`, `base` (each bar's dates, waits, limits and parts on the real schedule then) and `copy` (the copy's `ProjectSchedule` with the moves tried on it).
- **`gc_schedules_template_fkey`**: `gc_schedules.template_id` now references `gc_schedule_templates` (set null), added in a `DO` block that runs once.

**Append only:** a template's lines never change. `authenticated` has no UPDATE, DELETE or TRUNCATE on it, except `UPDATE (name, aside_on)`. The rough is redrawn until it is kept, and the copy is rewritten with each try, so both stay editable.

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 4). The copy's policy also holds it to `user_id = (SELECT auth.uid())` (decision 6). The schedule's PR 10 swaps `is_dev()` for the job's team, and keeps the copy's person. `anon` has no privilege on them.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: after PR 3's migration, and so after PR 2's, whose `gc_schedules` this references and gains a key on. No screen reads these until the schedule's PRs 11 and 12. It is additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, the `DO` block's check). Each foreign key takes a short lock on the table it names: `projects`, `gc_projects`, `gc_schedules` and `users`. The new key on `gc_schedules` also checks its rows; nothing writes `template_id` before PR 5, so every row has none. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** This is PR 2's query, with these three names in its `IN (...)` list. Expect three rows. Each should read: `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1. Then the new key:

   ```sql
   SELECT conname, confdeltype FROM pg_constraint WHERE conname = 'gc_schedules_template_fkey';
   ```

   Expect one row, with `confdeltype` `n` (set null).

2. **Each is empty.** Use PR 2's count query, with these three tables. Expect zeros.

3. **A read-only user's insert is refused.** Run it as PR 2's step 3:

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_schedule_templates (name, from_name, from_done_pct, saved_on, lines, stages, weeks)
     VALUES ('A check', 'A check', 0, DATE '2026-10-07', '[{}]', '[]', 1);
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.`

4. **A template keeps its lines, and a copy its person, even for a dev.** Run each line in its own transaction as a dev who is not read-only: PR 2's step 4 opening, then the statement, then `ROLLBACK`.
   - `UPDATE public.gc_schedule_templates SET lines = lines;` gives `ERROR: permission denied for table gc_schedule_templates`.
   - `DELETE FROM public.gc_schedule_templates;` is refused the same way.
   - `UPDATE public.gc_schedule_templates SET name = name, aside_on = aside_on;` gives `UPDATE 0`: the door is open.
   - `INSERT INTO public.gc_schedule_what_ifs (project_id, user_id, made_on, base_version, base, copy) VALUES (gen_random_uuid(), gen_random_uuid(), DATE '2026-10-07', 0, '{}', '{}');` gives `ERROR: new row violates row-level security policy for table "gc_schedule_what_ifs"`. A copy for another person is refused before its schedule is looked at.

5. **Nobody signed out reaches them.** Run `BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.gc_schedule_templates; ROLLBACK;` and expect `ERROR: permission denied for table gc_schedule_templates`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing reads these tables yet. Going back is a new migration with two steps. First it drops the key: `ALTER TABLE public.gc_schedules DROP CONSTRAINT IF EXISTS gc_schedules_template_fkey`. Then it drops the tables with `DROP TABLE IF EXISTS`, in this order: `gc_schedule_what_ifs`, `gc_rough_schedules`, `gc_schedule_templates`.

## Status

Written 2026-10-07 for the schedule's PR 4; not applied. The lead pushes it after PR 3's, and records here what steps 1 to 5 said.
````

## Drift from `SCHEDULE_REAL_BUILD.md`'s table section

These are what the SQL above does that *The tables* does not say, or says another way. PR 4's own commit on the spike amends *The tables* to match, line by line, once the lead agrees.

- **A template is append only, but its name and its day set aside**, by privileges (call 1). *The
  tables* says it in words; the column grant now holds it.
- **The copy's policy holds it to its person** (call 2).
- **`like` is `template_lines`** (call 3).
- **The rough keys to `gc_projects`**, as *The tables* says ("keyed by `project_id`"), and the
  reason is now written down: the job has its GC project row while we bid, and no schedule row
  until its first draft.
- **`gc_schedules.template_id` gets its key** (`gc_schedules_template_fkey`, set null), as PR 2's
  amendment promised.
- **Checks *The tables* leaves unsaid:**
  - a template's name is at most 60 letters (`TEMPLATE_NAME_MAX`) and unique whatever the case
    (`templateNameProblem`);
  - its lines are a non-empty array and its stages an array;
  - its weeks are from 1, and its done percent within 0 to 100;
  - the rough's kept columns go all four or none, its template's name, day and lines together, and
    its stage days are an object;
  - the copy's base and copy are objects, and its version is from 0.
- **`drawn_by`, `saved_by` and the copy's `user_id`** are user ids. The prototype keeps a name. The
  copy goes with its person (cascade), and a template or a rough keeps its row (set null).
- **`updated_at`** on the rough and the copy, which are rewritten.

## The check

- **Before the merge (CI):** `scripts/check-migrations.sh` and `src/lib/releaseNotes.test.ts`.
- **By hand before opening the PR,** as for PRs 2 and 3:
  - Grep that every name it references exists on main: `projects(id)`, `gc_projects(project_id)`,
    PR 2's `gc_schedules(project_id)` and `template_id`, `users(id)`, `is_dev()` and the sweeps.
  - Check that no `gc_schedules_template_fkey` exists yet.
  - Every constraint and index name begins with its own table's name.
- **After the push (the lead):** the doc's *Verify after the push*, steps 1 to 5. Steps 1, 2 and 5
  run from the read seat, and steps 3 and 4 from the app's dev login. Step 4 holds a template's door
  open and its lines shut, and a copy held to its person.
- **Then** `npm run check:migration-drift` and the types PR.

## When it is cut

1. After #4827 (PR 3) is on main, branch from `origin/main`.
2. Take the next stamp after main's newest and after any claim not yet merged
   (`.claude/sessions/claims/` in the main checkout). Claim it from the PR's own branch:
   `npm run claim -- --migration supabase/migrations/<stamp>_gc_schedule_what_if_and_before.sql`.
3. Claim the version with `npm run claim -- --branch <branch>`. Fill it into the four `v2.NNNN`
   (the header's and each table's comment) and the doc's first line. Fill in PR 3's stamp where the
   doc names it.
4. Add the migration, its doc, the release note (infra, dev, two bullets) and the fragment.
5. Open the PR with auto-merge, and put the amendment to *The tables* on a spike branch beside it.
   The lead pushes it after PR 3's from a clean checkout and opens the types PR. I never apply it.

## Status

Stopped 2026-10-07 at the owner's pause, for the handoff.
- **The PR.** PR 4 is #4835 on branch `claude/gc-schedule-pr4-what-if-before`: one commit, 3b6416177, cut from main at d21075a00.
  - It is open and its CI passed.
  - Auto-merge is turned off and it is in no merge queue, so it cannot merge while nobody is here to push its migration.
- **Claimed:** the stamp `20261007235500` (`supabase/migrations/20261007235500_gc_schedule_what_if_and_before.sql`) and the version v2.4816.
- **Built:**
  - the migration, this plan's SQL with v2.4816 filled in;
  - its doc, `docs/migrations/20261007235500_gc_schedule_what_if_and_before.md`, with the five verify steps and a status line;
  - the release note `src/content/releaseNotes/v2.4816.ts` and the fragment `docs/recent-features/v2.4816.md`.

  `scripts/check-migrations.sh`, the release notes test, and eslint and tsc on the note all passed. The amendment to *The tables* in `SCHEDULE_REAL_BUILD.md` is c17b0e1d9, under this commit.
- **Left, in order:**
  1. Check the stamp is still after main's newest migration and after every claim not yet merged. If a later stamp has landed, renumber PR 4 from a clean commit: the file, its doc's first line and the fragment's two paths, claimed again with `npm run claim -- --migration`.
  2. Re-arm with `gh pr merge 4835 --auto`.
  3. After it merges, push it with `supabase db push` from a clean checkout. It goes after PR 3's `20261007220000`, which the lead was pushing when PR 4 was cut.
  4. Run the doc's five verify steps, record them in its status, and open the types PR.
- **Not started:** the schedule's PR 5 plan, the RPCs. It owes the two refusals the lead named on 2026-10-07. The template save refuses a schedule with nothing that can be drawn on another job, before the table's non-empty check would. It also words a weeks under one, from a substantial completion planned before the first start.
