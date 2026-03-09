# Remote Schema Inspection Guide

## Summary

The remote Supabase database has **19 migration records** that don't exist in your local `supabase/migrations` directory. These were likely created by:

- **Supabase branching** (preview branches create new DBs with auto-timestamped migrations)
- **Dashboard schema changes** (SQL Editor or Table Editor)
- **Another developer/process** pushing migrations you don't have locally

### Remote-only migration versions (to be marked "reverted" for repair)

| Version       | Likely timestamp |
|---------------|------------------|
| 20260306212631 | 2026-03-06 21:26:31 |
| 20260306213026 | 2026-03-06 21:30:26 |
| 20260306213433 | 2026-03-06 21:34:33 |
| 20260306213519 | 2026-03-06 21:35:19 |
| 20260306213601 | 2026-03-06 21:36:01 |
| 20260306223348 | 2026-03-06 22:33:48 |
| 20260306225100 | 2026-03-06 22:51:00 |
| 20260306231429 | 2026-03-06 23:14:29 |
| 20260306233602 | 2026-03-06 23:36:02 |
| 20260306235340 | 2026-03-06 23:53:40 |
| 20260307212507 | 2026-03-07 21:25:07 |
| 20260307212522 | 2026-03-07 21:25:22 |
| ... (7 more)   | March 7–8, 2026  |

### Local migrations not yet on remote

- `20260408120000` — `add_unit_price_override_to_bid_pricing_assignments`
- `20260408130000` — `create_bid_count_row_custom_prices`

---

## Inspect the remote schema (Supabase Dashboard)

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Run these queries to inspect the current schema.

### 1. Migration history

```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

### 2. Check if your target tables/columns exist

```sql
-- Does unit_price_override exist on bid_pricing_assignments?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bid_pricing_assignments'
ORDER BY ordinal_position;

-- Does bid_count_row_custom_prices table exist?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'bid_count_row_custom_prices'
) AS custom_prices_table_exists;
```

### 3. List all public tables (overview)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 4. Recent schema changes (if `supabase_migrations` has details)

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version::text LIKE '202603%' OR version::text LIKE '202604%'
ORDER BY version;
```

---

## Next steps

1. Run the queries above in the SQL Editor and review the results.
2. If `unit_price_override` and `bid_count_row_custom_prices` are missing, run the repair and push:
   ```bash
   supabase migration repair --status reverted 20260306212631 20260306213026 20260306213433 20260306213519 20260306213601 20260306223348 20260306225100 20260306231429 20260306233602 20260306235340 20260307212507 20260307212522 20260307212523 20260307212524 20260307212533 20260307212535 20260307215053 20260307222455 20260308041534 20260308044432 20260308044435 20260308052852 20260308053437 20260308170015 20260308172729 20260308205556 20260308212136 20260308221728
   supabase db push
   ```
3. If those objects already exist, the remote schema may already include your changes; you may only need to repair the migration history so it matches your local migrations.
