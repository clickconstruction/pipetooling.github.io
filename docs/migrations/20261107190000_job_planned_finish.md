# 20261107190000_job_planned_finish.sql (2026-11-07, v2.6665)

**What it does**: a project leaves award with a planned start and finish beside its hours baseline, frozen like it (punch list #234 PR 2), so the superintendent's line reads days against a plan.

- `job_budgets.planned_start date`, `planned_finish date`, `planned_source text` (`rough` | `assumed` | `typed`, `job_budgets_planned_source_check`), `planned_detail jsonb` (the rough's weeks and when they were kept, or the assumed math, or the typed note), `planned_set_at`, `planned_set_by uuid → users`; `job_budgets_planned_order_check` holds the finish on or after the start.
- `set_job_planned_finish(p_job_id, p_source, p_start, p_finish, p_detail, p_replace)` — writes the plan on the job's row once; a later call writes only with `p_replace`, keeping the plan it replaces under `planned_detail.previous`. The row must exist (*Set the hours baseline first; the plan rides it*). `SECURITY INVOKER` over `can_write_job_budget`.
- `award_job_baseline(…, p_planned jsonb DEFAULT NULL)` — the award press gains the plan, `{source, start, finish, detail}`, written after the award is stamped and only when none is set. **The seven-argument form is dropped first**: a defaulted eighth argument beside it would leave two functions a seven-argument call could not choose between.

**Tables**: none created, so no fence is owed. **RLS**: unchanged — the columns ride the row's policies. Idempotent: `ADD COLUMN IF NOT EXISTS`, the constraints `DROP IF EXISTS` then `ADD`, `DROP FUNCTION IF EXISTS` then `CREATE OR REPLACE`.

**Why on `job_budgets`**: the plan is the award's other half; it freezes with the hours, is read with them by the Costs strip and the board, and one row per job already carries the award. A separate table would need a second read on every board load.

**Apply**: `supabase db push` from a clean checkout of `main` right after this merges, before the Pages deploy finishes — the New Job form calls the eight-argument `award_job_baseline` the moment a project is created, and the seven-argument one is gone the same instant, so an old client and a new one both land on the new function (the eighth argument defaults). Push `20261107190500_project_board_planned_finish.sql` in the same push.

**Check**: `select column_name from information_schema.columns where table_name = 'job_budgets' and column_name like 'planned_%'` reads six rows; `select pronargs from pg_proc where proname = 'award_job_baseline'` reads one row, 8.

**Applied** to prod by 2026-11-08, read the same day through the dev seat's `check_migration_ledger`: 1166 versions applied against the 1166 files on `main`, this one among them (`npm run check:migration-drift` could not reach the database from this worktree — the IPv6-only path — so the ledger was the read).
