# 20261010081000_gc_change_orders_office.sql (2026-10-10, v2.5156)

GC mode, the schedule's PR 16b-i (`to-dos/gc-mode/mockups/schedule-pr16.md` on branch `spike/gc-mode`, with amendment 1): a change order's non-money half for the office, the view the Owner Billing door planned (`mockups/door-owner-billing.md`, call C), added by its first reader, the schedule. `gc_change_orders` is the money team's alone (`gc_change_orders_money`, `20261009050000`). The schedule reads a change order's days, status and days on the chart (G-76, G-98, G-141), and never its cost, price or percent done. No table is created. The Owner Billing lane co-signed it.

- **`gc_change_orders_office`**, a view with its owner's rights behind `security_barrier = true`, reading `gc_change_orders` past its money policy and holding the office team at its own `WHERE (SELECT public.gc_office_team())`:
  - twelve columns: `id`, `project_id`, `number`, `description`, `reason`, `schedule_words`, `package_id`, `status`, `sent_on`, `answered_on`, `days` and `days_on_chart`;
  - never `cost`, `price` or `pct_done`. The explicit column list is the guard, and the bed pins it to exactly these twelve, so a later `CREATE OR REPLACE` that adds a money column fails the bed;
  - `description` and `schedule_words` are the money team's own words, shown to the office as they typed them.
- **Read only.** Supabase's default privileges give a new view every verb to `anon` and `authenticated`, and a simple view over one table takes `INSERT`, `UPDATE` and `DELETE` with its owner's rights, past the table's policies. So the migration revokes every grant from `PUBLIC`, `anon` and `authenticated` first, and grants `SELECT` alone back to `authenticated`. Without the revoke, an estimator could change a change order through the view.

Apply order: after main's latest. It is `CREATE OR REPLACE VIEW`, grants and a comment, with `lock_timeout 3s`. It locks nothing the office uses, and it is idempotent.

**Before the push**, the SQL bed (`scripts/pgtest-gc-owner-billing.sh`, which applies this file a second time) plays `supabase/tests/gc_owner_billing/95_office_view.sql`. Its 16 assertions are:
- the view's twelve columns, compared with `information_schema.columns`, and none of the three money ones;
- `security_barrier=true` in its options;
- `SELECT` the only grant to `authenticated`, and none to `anon` or `PUBLIC`;
- an estimator and an assistant reading both change orders through the view and none from the table, and a dev reading both;
- a superintendent and a subcontractor reading none;
- an estimator's `UPDATE`, `DELETE` and `INSERT` through the view refused, and the change orders unchanged;
- anon refused.

On main at 474486c9f, each of 6 bugs planted one at a time in the view failed them: the price rides along, no security barrier, no office gate, writes left to `authenticated`, anon reads it, and the money team only.

## Verify after the push

1. **The view's shape and its grants.**

   ```sql
   SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office';
   SELECT reloptions FROM pg_class WHERE oid = 'public.gc_change_orders_office'::regclass;
   SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' GROUP BY grantee ORDER BY grantee;
   ```

   Expect:
   - the twelve columns in that order;
   - `{security_barrier=true}`;
   - `authenticated` with `SELECT` alone, no row for `anon` or `PUBLIC` (the owner's and `service_role`'s rows as Supabase makes them).

2. **The reads, as a dev, reading only.** `SELECT count(*) FROM gc_change_orders_office` equals `SELECT count(*) FROM gc_change_orders`.

3. `npm run check:migration-drift` is clean.

## Rollback

```sql
DROP VIEW IF EXISTS public.gc_change_orders_office;
```

Nothing reads it until the schedule's PR 16b-ii.
