# 20261028180000_gc_schedule_builder.sql (2026-10-28, v2.6020)

**Plan:** `to-dos/schedule-builder/README.md`, punch list #204, PR 2 of six. The rows the kernel of PR 1 (v2.5995, `src/lib/gc/schedule/builder.ts`) reads and writes. Fragment: `docs/recent-features/v2.6020.md`.

## What it does

- **`gc_schedule_templates`, version 2.** Adds `phases jsonb`, `rows jsonb`, `kind text`, `working_days boolean NOT NULL DEFAULT false`, `version_of uuid` (self-reference, set null on delete) and `superseded_on date`; drops NOT NULL from `from_name` and `from_done_pct` (a template made from nothing came from no job); relaxes `gc_schedule_templates_lines_listed` so `lines` may be empty once `rows` is set; adds the checks `rows_listed` (a non-empty array when set), `phases_listed`, `kind_short` (40), `from_named` (name and percent together, a project only with a name) and `version_of_another`. Every column is added null or with a default: no existing row changes.
- **The name is unique among the current versions.** Drops `gc_schedule_templates_name_once` and makes `gc_schedule_templates_name_once_current` on `lower(name) WHERE superseded_on IS NULL`, plus `gc_schedule_templates_version_of_idx`. The client's `nameTaken` reads the index's name as a prefix, so its words stand.
- **The append-only grant stands.** `GRANT UPDATE (superseded_on)` beside the `name` and `aside_on` of `20261007235500`; UPDATE, DELETE and TRUNCATE stay revoked. `GC_SCHEDULE_APPEND_ONLY` in `src/lib/gc/doors.ts` names the third column.
- **The job's side.** `gc_schedule_activities.phase`, `gc_schedule_milestones.phase` (each blank-checked, 80 at most) and `gc_schedules.phases` (an array when set).
- **`gc_schedule_draft` replaced** with `20261008040000`'s body plus the phases: read from the draft, checked (each a name of 80 at most, none twice, every bar's and date's among them) before the version bump, and written on the schedule and on each bar and date to meet; a draft with no phases clears them.
- **`gc_schedule_template_save(p_template jsonb, p_version_of uuid DEFAULT NULL) RETURNS uuid`**, SECURITY INVOKER, executable by `authenticated` only: a new row from `{name, kind?, on, workingDays?, weeks, phases, rows, lines?, stages?, from?}`, or a new version of `p_version_of`, which it marks `superseded_on` the same day in the same transaction and whose job and `aside_on` the new row inherits when the save says nothing of them. Refusals in the kernel's words (the fragment lists them).

**Stays as it was:** the team policy (`gc_on_any_schedule_team()`) on the table, the training-mode and twin blocks, the plan guard (a bar's `phase` is a record, as `place` is), every other schedule function, `anon` with no grant. The old shape still saves straight to the table and still reads.

## Checked before the push: the bed

`scripts/pgtest-gc-schedule.sh` gains `PGTEST_PGBIN` (a local Postgres 15, as the walk-kit bed) and re-applies this migration after the team door's, then runs `supabase/tests/gc_schedule/60_builder.sql`: 51 checks ending `gc_schedule builder PASSED`. Green locally on Postgres 15 on 2026-10-28 and on GitHub's `SQL beds` run of the PR.

## Verify after the push

1. `npm run check:migration-drift` reads the ledger in step.
2. `SELECT column_name FROM information_schema.columns WHERE table_name = 'gc_schedule_templates' AND column_name IN ('phases', 'rows', 'kind', 'working_days', 'version_of', 'superseded_on')` lists six; the same for `phase` on `gc_schedule_activities` and `gc_schedule_milestones`, and `phases` on `gc_schedules`.
3. `pg_get_indexdef('gc_schedule_templates_name_once_current'::regclass)` ends `WHERE (superseded_on IS NULL)`, and `gc_schedule_templates_name_once` is gone.
4. `information_schema.column_privileges` for `authenticated` on `gc_schedule_templates` with `UPDATE` lists `aside_on`, `name`, `superseded_on` and nothing else.
5. The types regenerated (`npm run gen-types:linked`) carry the columns and `gc_schedule_template_save`; the dev-mcp catalog rebuilt.

## Rollback

Drop the function, put the old index back and drop the columns. A client deployed before PR 3 reads none of them, so no client deploy comes first.

```sql
SET lock_timeout = '3s';
DROP FUNCTION IF EXISTS public.gc_schedule_template_save(jsonb, uuid);
DROP INDEX IF EXISTS public.gc_schedule_templates_name_once_current;
DROP INDEX IF EXISTS public.gc_schedule_templates_version_of_idx;
CREATE UNIQUE INDEX IF NOT EXISTS gc_schedule_templates_name_once ON public.gc_schedule_templates (lower(name));
REVOKE UPDATE (superseded_on) ON TABLE public.gc_schedule_templates FROM authenticated;
ALTER TABLE public.gc_schedule_templates
  DROP CONSTRAINT IF EXISTS gc_schedule_templates_rows_listed,
  DROP CONSTRAINT IF EXISTS gc_schedule_templates_phases_listed,
  DROP CONSTRAINT IF EXISTS gc_schedule_templates_kind_short,
  DROP CONSTRAINT IF EXISTS gc_schedule_templates_from_named,
  DROP CONSTRAINT IF EXISTS gc_schedule_templates_version_of_another,
  DROP COLUMN IF EXISTS phases, DROP COLUMN IF EXISTS rows, DROP COLUMN IF EXISTS kind,
  DROP COLUMN IF EXISTS working_days, DROP COLUMN IF EXISTS version_of, DROP COLUMN IF EXISTS superseded_on;
ALTER TABLE public.gc_schedule_activities DROP CONSTRAINT IF EXISTS gc_schedule_activities_phase_named, DROP COLUMN IF EXISTS phase;
ALTER TABLE public.gc_schedule_milestones DROP CONSTRAINT IF EXISTS gc_schedule_milestones_phase_named, DROP COLUMN IF EXISTS phase;
ALTER TABLE public.gc_schedules DROP CONSTRAINT IF EXISTS gc_schedules_phases_listed, DROP COLUMN IF EXISTS phases;
-- then re-run 20261008040000's CREATE OR REPLACE of gc_schedule_draft, and put the old lines_listed and NOT NULLs back
-- only once every row made from nothing is gone.
```

## Applied

Not yet. Pushed with `supabase db push` after the PR merges; the types PR follows.

## Status

- 2026-10-28: cut from main at v2.6011 by the #204 session, PR 2 of the train. The bed green locally on Postgres 15.
