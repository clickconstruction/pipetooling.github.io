# 20261106180000_plan_sets_author_stays_on_job.sql (2026-11-06, v2.6583)

Plan sets by part (punch list #239), the last code item on the card. `plan_sets_update` (`20261101210000`) let the author of an as-built change any column of their own row, `part_id` and `job_id` among them, so a crew member could aim their as-built at a job or a part they are not on. The insert rule (`20261102010000`) already held the crew to a job they are on whose part is the set's; the edge function `plan-set-files` holds its own writes to the same (v2.6345). This migration gives that rule one home and asks it on the update too.

## What it does

- **`plan_set_crew_on_job(p_job_id, p_part_id)`** → boolean: the signed-in user is on the job's crew (`jobs_ledger_team_members`) and the job's `plan_part_id` is the part. `SECURITY DEFINER`, `row_security = off`, `search_path = public`, as `helper_on_job` (`20261014220000`) is: the inline `EXISTS` on the team table ran under the caller's RLS, and that table's SELECT policy (`20260907050000`) leaves helpers out, so a helper never saw their own crew row and never passed the crew branch. Execute: `authenticated`, `service_role`; revoked from `PUBLIC` and `anon`.
- **`plan_sets_insert`**: `plan_part_can_write(part_id)`, or an as-built or a paper kind (`NOT plan_set_is_drawing(kind)`) on a part the caller can see with `plan_set_crew_on_job(job_id, part_id)`.
- **`plan_sets_update`**: `USING` unchanged (the office, or an as-built of the caller's). `WITH CHECK`: the office, or an as-built of the caller's on a part they can see with `plan_set_crew_on_job(job_id, part_id)` — so the row they leave behind has to pass what a new one does, and `job_id` or `part_id` can move only between jobs they are on that build from the part.

## What stays

`plan_sets_select` and `plan_sets_delete` as they were — and with them the read gate `plan_part_can_see`, which showed a crew member no part on a development's job (punch list #272, found by this migration's bed; opened by `20261106234500`, v2.6604, whose bed also showed that a helper on the crew reads a standalone job's part through the ledger, so the card's second claim did not hold); the predicate is a definer, so the crew branch was ready for it. `plan_part_can_see`, `plan_part_can_write` and the mirror and History triggers untouched. The restrictive fences (training mode, the twin fence, the archived seal, primary scope) still apply on top. No client file changes: `planSetsIo.ts` writes the same rows.

## Checked before the push

Idempotent: `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` and `CREATE POLICY` by name. No `CREATE TABLE`, so no fence calls. The SQL bed `plan_sets_author` (`npm run test:pg:plan-sets-author`, in `scripts/sql-beds.txt`) applies every migration in order and this one a second time, then runs the scenario in `supabase/tests/plan_sets_author/20_scenario.sql` as a subcontractor, a helper and the office under RLS.

## After the push

Nothing to regenerate: no column the client reads. The live check: as the dev on a ZZ Test job's Plans section, add a set and an as-built, change the as-built's memo, remove both; `npm run check:migration-drift`.

**Applied** to prod by 2026-11-06, read on 2026-11-07: types regenerated from prod right after this file in #7136 (`chore(types)` after `20261106180000`, 2026-11-06) — the repo's evidence that it was pushed; the dev seat's `check_migration_ledger` was not read in this pass (the connector was not available in the docs worktree), and `check:edge-drift` on 2026-11-07 found every function deployed, 15 of them on `_shared` code older than `main` after #7159 / #7166 (a redeploy owed, not a migration matter).
