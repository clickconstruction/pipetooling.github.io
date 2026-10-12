# 20261012200000_portal_customer_lines.sql (2026-10-12, v2.5286)

Messages, cut 8a (the portals; `to-dos/gc-mode/messages/BUILD_PLAN.md` on branch `spike/gc-mode`): the lines the office types for a customer's page that the database did not keep, each with its Spanish, and who the customer calls on site. No new table. It sits before the page's screens (cut 8b), which read it, and beside `20261012130000_portal_customer_page.sql` (the words, the paper views, the switches). It touches none of that migration's objects.

## What it does

1. **`gc_daily_logs.customer_line` and `customer_line_es`**: This week, the day's line for the customer's page in their words.
   - It sits beside the superintendent's own `done`, which never reaches the customer.
   - **`gc_save_daily_log(log jsonb)`** takes it in the payload it already takes (`customerLine`, `customerLineEs`). The function is `20261010049000`'s word for word, plus those two keys:
     - a page that sends neither keeps the day's line;
     - a new English line sent without its Spanish clears the old Spanish;
     - a line of spaces clears the line;
     - Spanish with no English is refused in words.
2. **`gc_owner_pay_apps.customer_line` and `customer_line_es`**: what a pay application covers, for its card on Money.
   - It is the page's sentence, not the bill's: a sent bill still never changes.
   - The two columns get their own `UPDATE` grant, after the architect's certificate and the invoice it was billed on, so the money team can write or fix the line after the bill went.
3. **`gc_change_orders.description_es`**: a change order's description in Spanish, beside the one it went with.
4. **`gc_projects.superintendent_user_id`**: who is on site, for Your people. It references `users(id)` with `ON DELETE SET NULL`.

Each line is 1 to 300 characters once trimmed (500 for a change order's Spanish). It is never only spaces, and a Spanish line needs its English one. The checks go on `NOT VALID` and are then validated under the lighter lock. Every new column starts empty, so nothing fails.

Who writes each one is the table's existing policy:
- the daily log's (dev only until Building's door);
- the money team for pay applications and change orders;
- the office team for the job.

No policy changed.

## Checked before the push

**The SQL bed** (`npm run test:pg:portal-customer-lines`, the new `portal-customer-lines` bed, run by the SQL beds workflow on the PR): every migration on Supabase Postgres 17, this migration once more (changing nothing), then the scenario.

- **The daily log:**
  - It saves the line with its Spanish beside the superintendent's own words.
  - A save with no line keeps it.
  - A new English line clears the old Spanish.
  - Spanish alone is refused in words.
  - A line of spaces clears it.
- **The pay application and the change order:**
  - The controller writes a pay application's line and its Spanish.
  - The controller cannot change its amount.
  - Spanish without English, and a line of spaces, are refused.
  - A change order takes its Spanish, and a Spanish description of spaces is refused.
- **Who may write:**
  - An estimator changes no pay application.
  - A training account writes no line (*Read-only (training) mode*).
- **The superintendent:**
  - An assistant names the job's superintendent.
  - The column's key lets a removed user go (`ON DELETE SET NULL` to `users`).
- **The grant:** signed in may update a pay application's line, never its money.

## Verify after the push

```sql
-- 1. The columns, empty.
SELECT count(*) FILTER (WHERE customer_line IS NOT NULL), count(*) FILTER (WHERE customer_line_es IS NOT NULL) FROM public.gc_daily_logs;
SELECT count(*) FILTER (WHERE customer_line IS NOT NULL) FROM public.gc_owner_pay_apps;
SELECT count(*) FILTER (WHERE description_es IS NOT NULL) FROM public.gc_change_orders;
SELECT count(*) FILTER (WHERE superintendent_user_id IS NOT NULL) FROM public.gc_projects;
-- expect: 0 everywhere

-- 2. The pay application's doors.
SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
WHERE table_name = 'gc_owner_pay_apps' AND grantee = 'authenticated' AND privilege_type = 'UPDATE';
-- expect: certified, certified_by, certified_note, certified_on, conditional_waiver_id, customer_line, customer_line_es, invoice_id

-- 3. The daily log's save names the customer's line.
SELECT position('customerLine' IN prosrc) > 0 FROM pg_proc WHERE proname = 'gc_save_daily_log';
-- expect: true
```

## Rollback

```sql
ALTER TABLE public.gc_projects DROP COLUMN IF EXISTS superintendent_user_id;
ALTER TABLE public.gc_change_orders DROP CONSTRAINT IF EXISTS gc_change_orders_description_es_said, DROP COLUMN IF EXISTS description_es;
REVOKE UPDATE (customer_line, customer_line_es) ON TABLE public.gc_owner_pay_apps FROM authenticated;
ALTER TABLE public.gc_owner_pay_apps DROP CONSTRAINT IF EXISTS gc_owner_pay_apps_customer_line_said, DROP COLUMN IF EXISTS customer_line, DROP COLUMN IF EXISTS customer_line_es;
-- Restore gc_save_daily_log from 20261010049000_gc_punch_writes.sql first, since it names the two columns.
ALTER TABLE public.gc_daily_logs DROP CONSTRAINT IF EXISTS gc_daily_logs_customer_line_said, DROP COLUMN IF EXISTS customer_line, DROP COLUMN IF EXISTS customer_line_es;
```

## Status

Written 2026-10-12 as a draft PR. Not pushed: `supabase db push` waits for the lead's go, after the file is on `main`.
