# Remote Schema Inspection Guide

> ## ⚠️ OBSOLETE — do NOT run the repair commands this doc used to contain
>
> This document was a **spring-2026 incident snapshot** (remote-only migration rows from
> Supabase branching / Dashboard edits vs. local files). That incident — and every other
> ledger inconsistency — was resolved by the **2026-07-04 full ledger rewrite** (backup
> preserved at `supabase_migrations._schema_migrations_backup_20260704`).
>
> The `supabase migration repair --status reverted <versions…>` command this doc previously
> recommended would now **corrupt the reconciled ledger**. Do not run it.
>
> **Current practice** (see the migration rule in [CLAUDE.md](../CLAUDE.md)):
> - Check local/remote alignment with **`npm run check:migration-drift`** (CI also runs it on
>   main pushes touching migrations, plus a strict daily cron:
>   `.github/workflows/migration-drift.yml`).
> - Apply migrations **only** with `supabase db push`, only after the file is on `main`
>   (or in the PR merging right now). Never via MCP `apply_migration`, `execute_sql`, or the
>   Dashboard SQL editor.

---

## Still-useful queries (generic, read-only schema inspection)

These queries remain handy for inspecting the remote schema. Run them via
`supabase db …` / `psql` against the linked project — **not** the Dashboard SQL editor
(keeping all SQL access on the CLI avoids the ad-hoc-edit habits that caused the original
drift; the queries themselves are read-only and safe).

### 1. Migration history

```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

### 2. Check if a target table/column exists

```sql
-- Do the columns of a table match expectations?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '<table_name>'
ORDER BY ordinal_position;

-- Does a table exist?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = '<table_name>'
) AS table_exists;
```

### 3. List all public tables (overview)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 4. Recent migration ledger entries for a date range

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version::text LIKE '202607%'  -- adjust the prefix to the window you care about
ORDER BY version;
```
