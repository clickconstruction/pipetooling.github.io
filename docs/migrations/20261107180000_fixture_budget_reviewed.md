# 20261107180000_fixture_budget_reviewed.sql (2026-11-07, v2.6662)

**What it does**: the owner's weekly *Looks right* on the assumed line budgets (punch list #234 PR 1c): two nullable columns on the line item row and the one function that stamps them.

- `jobs_ledger_fixtures.budget_reviewed_at timestamptz`, `budget_reviewed_by uuid → users` — when and by whom the owner stamped an assumed line reviewed. Null until he looks. The line stays assumed (no `budget_source`), so it still follows the company split; it just stops asking.
- `stamp_line_budgets_reviewed(p_fixture_ids uuid[]) → integer` — stamps the rows named that are still assumed and unreviewed, answers how many; the owner only (`is_master_or_dev()`), `SECURITY INVOKER`.

One `ALTER TABLE` adds both columns, so the table's lock is taken once; no default writes a row. **Tables**: none created, so no fence is owed. **RLS**: unchanged — the columns ride the row's policies; the function runs as the caller.

**Why columns on the row**: a stamp must survive every later save of the line, and the fixtures autosave upserts only the columns it owns (`diffFixtureRows` names them), so these are never touched by it; a store keyed on the grid's id would be lost on reload, the lesson of v2.6300.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges. The Needs you line reads the columns through `select` and the card's Looks right calls the function; until the push the card's read fails soft to no line.

**Check**: `select column_name from information_schema.columns where table_name = 'jobs_ledger_fixtures' and column_name like 'budget_reviewed%'` reads two rows; `select proname from pg_proc where proname = 'stamp_line_budgets_reviewed'` reads one.

**Applied** to prod by 2026-11-08, read the same day through the dev seat's `check_migration_ledger`: 1166 versions applied against the 1166 files on `main`, this one among them (`npm run check:migration-drift` could not reach the database from this worktree — the IPv6-only path — so the ledger was the read).
