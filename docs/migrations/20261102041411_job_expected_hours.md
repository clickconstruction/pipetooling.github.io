# 20261102041411_job_expected_hours.sql (2026-11-02, v2.6321)

The expected hours (punch list #242, PR 2). The owner, 2026-11-01: a page where the leader, the superintendents and the office *very quickly see where all of the big jobs are and adjust their expected hours so that teams that are getting lazy can be artificially incentivized*. The expected hours are a **target set in the open**: who set it, when, from what to what and why. The superintendent's line reads it as its pace budget; the Costs tab's baseline and #234's bonus ground stay frozen apart from it, and *back to the budget* clears it.

## What it does

**`job_expected_hours`**: one row per change, append-only. `job_id`, `hours` (the target, ≥ 0), `from_hours` (what the line read before: the last target, or the budget's hours on the first target; null when the client did not know), `set_by` and `set_by_name` (the name as it read that day, kept on the ledger), `set_at`, `why` (3 to 240 characters, required), `cleared_at`, `cleared_by`, `cleared_by_name`. The row with `cleared_at IS NULL` is the target the Projects board and the phone read; `job_expected_hours_one_open` holds it to one per job. `cleared_at` equal to another row's `set_at` means that row replaced it; `cleared_at` with no successor means the office went back to the budget.

**`set_job_expected_hours(job, hours, from_hours, why)`** closes the open row and writes the new one in the same instant (`now()` read once), so the history reads as one change. **`clear_job_expected_hours(job)`** closes the open row and writes nothing. Both `SECURITY INVOKER`: RLS binds them. **`can_set_job_expected_hours()`** is `is_master_or_dev() OR is_assistant()`: the leader and the office (the controller through `is_assistant()`).

**Who can see and write**: select by whoever sees the job in the ledger under their own RLS (as `job_budgets` reads), so a superintendent reads his own project's number and its reason; insert and update by `can_set_job_expected_hours()` on a job the caller can see; delete by the dev only, for a mistake. `authenticated` reads and writes, `anon` nothing, `service_role` all. Three house calls at the end, one new table.

## What stays

`job_budgets` and the Costs tab's baseline are untouched: the target never changes the budget. The bonus and what counts as certified stay on #234.

## Checked before the push

Idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`). The functions are a role check, one `UPDATE` and one `INSERT`; the first live write is PR 3's, on a ZZ Test job, and its fragment will say what it found.

## After the push

Nothing calls the table until PR 3 (the board); PR 2's hook ships ahead of it, so `check:calls-ahead` labels the PR *push right after the merge* and the deploy holds until the push. Run `npm run gen-types:linked` in a `chore(types)` PR when convenient; the hook reads through a cast until then.
