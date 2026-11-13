# 20261112120000_estimate_first_look.sql (2026-11-12, v2.7004)

An estimate remembers the First look it came from (punch list #319 PR 5). No new table, so no fence call.

## What it does

- **`estimates.first_look_id uuid`**, nullable with no default, so adding it is a catalog change.
- **`estimates_first_look_id_fkey`** to `first_looks(id)`, `ON DELETE SET NULL`. Added `NOT VALID` inside a guard, so the statement takes its lock for an instant and checks no row, then validated in a second statement that does not block writes. A look that is removed leaves the estimate as it is.
- **`estimates_first_look_idx`**, a partial index over the rows that have a look.

## Who may do what

Unchanged. Whoever may write an estimate's row may write the column. The office's editor reads it under the estimate's own policy. The customer never reads it: `get-estimate-for-customer` answers only whether it is set.

## Release order

Merge, `bash scripts/db-push.sh`, then `supabase functions deploy get-estimate-for-customer`. Any order is safe. The client's insert falls back to a draft without the look when the column is not there, and the function's read of it is its own query that answers false on any miss.

## Verify

Read-only on prod after the push: `select column_name from information_schema.columns where table_name = 'estimates' and column_name = 'first_look_id'` reads one row; `select convalidated from pg_constraint where conname = 'estimates_first_look_id_fkey'` reads true.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659); types regenerated in #7800.
