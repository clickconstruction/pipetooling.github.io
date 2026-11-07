# 20261107160000_gc_schedule_own_work_phase_and_rough_rows.sql (2026-11-07, v2.6651)

**Plan:** `to-dos/schedule-builder-follow-ups.md`, punch list #210, the two of its three pieces that reach the database. Fragment: `docs/recent-features/v2.6651.md`.

## What it does

- **`gc_rough_schedules.template_rows jsonb`**, with the check `gc_rough_schedules_template_rows_shaped`: null, or an object beside a `template_name`. The rough while we bid keeps a copy of a rows template's `{phases, rows, workingDays}` (`TemplateRowsShape`) beside its copy of the lines, so a template made on the Templates page draws the rough as the first draft does and no later edit to the template reaches a bid. Added null: no existing row changes.
- **`gc_schedule_add_activity` replaced** with `20261008040000`'s body plus the phase: `p_bar.phase`, trimmed, must be one of `gc_schedules.phases` when given, checked before `gc_schedule_bump` so a refusal moves no version (*That phase is not on this schedule.*), and written on the new bar. A bar with no phase lands as before. The grant is restated: `authenticated` may execute, `PUBLIC` and `anon` may not.

**Stays as it was:** every other schedule function, the plan guard (a bar's `phase` is a record column), the team policies, the training-mode, twin and archived fences on both tables, `template_lines` and its `template_whole` check. No table is created.

## Checked before the push: the bed

`scripts/pgtest-gc-schedule.sh` re-applies this migration after the builder's (a second run must change nothing) and `supabase/tests/gc_schedule/60_builder.sql` gains section 13: a redraw with phases, the refusal before the version moves, Mobilize in *MEP rough-in* with its spaces trimmed, Cure in none, the rough's copy kept as an object and refused as an array or with no template named. Ends `gc_schedule builder PASSED`.

## Verify after the push

1. `npm run check:migration-drift` reads the ledger in step.
2. `SELECT column_name FROM information_schema.columns WHERE table_name = 'gc_rough_schedules' AND column_name = 'template_rows'` lists one.
3. `SELECT obj_description('public.gc_schedule_add_activity(uuid, integer, jsonb, uuid[], jsonb, text)'::regprocedure)` names v2.6651.
4. The types regenerated (`npm run gen-types:linked`) carry the column; the dev-mcp catalog rebuilt (`node scripts/build-dev-mcp-catalog.mjs`).

## Rollback

```sql
SET lock_timeout = '3s';
ALTER TABLE public.gc_rough_schedules DROP CONSTRAINT IF EXISTS gc_rough_schedules_template_rows_shaped, DROP COLUMN IF EXISTS template_rows;
-- then re-run 20261008040000's CREATE OR REPLACE of gc_schedule_add_activity (the phase is ignored, and lands under Not in a phase).
```

A client deployed with v2.6651 writes `template_rows` on every rough draw, so the client rolls back first.

## Applied

Not yet. Pushed with `supabase db push` by the owner after the PR merges; the types PR follows.

## Status

- 2026-11-07: cut from main at v2.6643 by the #210 session, PR #7251. The bed ran on GitHub's *SQL beds* workflow of the PR (the local Postgres 15 lacks `vector` for a later migration, and Docker did not come up); the fragment records the walk.
