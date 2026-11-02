# 20261102003938_fixture_line_budgets.sql (2026-11-02, v2.6300)

**What it does**: five nullable columns on `jobs_ledger_fixtures`, so a line item's budget lives on the line's own row and the autosave that writes the price writes it too (punch list #234 PR 1).

- `jobs_ledger_fixtures.budget_labor_pct numeric` — the share of the line's price expected on labor, 0–100; null = the company's split for the line's kind, assumed.
- `jobs_ledger_fixtures.budget_materials_pct numeric` — the share on materials, 0–100; with labor never past 100 (`jobs_ledger_fixtures_budget_split_check`).
- `jobs_ledger_fixtures.budget_source text` — `workbench` | `assumed` | `tuned` (`jobs_ledger_fixtures_budget_source_check`); null while nothing is stored.
- `jobs_ledger_fixtures.budget_tuned_at timestamptz` — when the owner last moved the split.
- `jobs_ledger_fixtures.budget_rate_usd numeric` — the burdened cost rate the hours were read at when the split was stored.

All five come in one `ALTER TABLE`, so the table's lock is taken once; no default writes a row. The two check constraints are dropped and re-added so a re-run lands the same shape. No index: the columns are read by the line's own row.

**Tables**: none created, so no fence is owed. **RLS**: unchanged — the columns ride the row's existing policies. Idempotent: each column only when missing; the constraints `DROP IF EXISTS` then `ADD`.

**Why columns and not a side store**: the design spike kept budgets in a store keyed on the Edit Job grid's row id, and a reload lost a tuning while the line stayed, because the form mints that id client-side and a save hands back other ids. On the row, a rename, reorder, delete or reload carries the budget with the line.

**Apply**: `supabase db push` from a clean checkout of `main` right after this merges, before the Pages deploy finishes — the client reads the columns through `select *` (an older client ignores them) but writes them on a tune, which the old table would refuse. Nothing to redeploy: no function reads them.

**Check**: `select column_name, data_type, is_nullable from information_schema.columns where table_name = 'jobs_ledger_fixtures' and column_name like 'budget_%'` reads five rows; `select conname from pg_constraint where conrelid = 'public.jobs_ledger_fixtures'::regclass and conname like '%budget%'` reads the two checks.
