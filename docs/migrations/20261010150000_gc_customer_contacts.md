# 20261010150000_gc_customer_contacts.sql (2026-10-10, v2.5195)

GC mode, the Board's B2b-v-i (call E2, `to-dos/gc-mode/mockups/board-b2b.md` on branch `spike/gc-mode`): a customer's call log, after the trade partners' (`gc_company_contacts`, 20261008020000). The customer window's Activity logs a call with a customer from B2b-v-ii, after the types.

## What it does

1. **`gc_customer_contacts`**, a new table, one line per call, text, email or note with a customer:
   - `customer_id` (customers, on delete cascade), and `project_id` for the job it was about (projects, on delete set null);
   - `contacted_on` (default `app_today()`), `by_user_id` (default `auth.uid()`) and `by_name`, the name the line shows;
   - `how`: call, text, email or note;
   - `note`: 1 to 2,000 characters once trimmed;
   - `created_at` (`clock_timestamp()`);
   - an index on `(customer_id, contacted_on desc)`.
2. **One policy, the office team's** (`gc_customer_contacts_team`, `gc_office_team()` for every verb), as door 2 gave the trades' log.
3. **Append only and signed:**
   - `anon` holds nothing;
   - `authenticated` holds `SELECT`, plus `INSERT` on the line's own six columns (customer, job, day, by_name, how, note);
   - there is no `UPDATE`, `DELETE` or `TRUNCATE`;
   - who logged it (`by_user_id`) and when (`created_at`) are the table's to set, so a line cannot name another user.
4. **The three house calls:**
   - `apply_read_only_write_blocks()` and `apply_read_only_stmt_blocks()`, so training mode reads and writes nothing;
   - `apply_digital_twin_write_blocks()`, so a twin writes nothing.

No function and no other table changed.

## Checked before the push

**The SQL bed** (`npm run test:pg:gc-customer-contacts`, the new `gc-customer-contacts` bed): every migration on Supabase Postgres 17, the call log's migration once more (changing nothing), then the scenario.

- No sign-in reads or logs nothing.
- An estimator logs a call about a job: the line is theirs, dated today, with the clock's time.
- A line naming another user as its writer is refused. So is an update, and so is a delete.
- A kind it does not know is refused, and so is a line that says nothing.
- An assistant and a dev read and log.
- A superintendent and a subcontractor read none and log nothing.
- Training mode reads the log and writes nothing (*Read-only (training) mode*). A digital twin writes nothing (`digital_twin_write_fence_insert`).
- The policies, the statement trigger and the grants are exactly as listed above.
- A line goes with its customer.

Three mutants each fail the bed:
- `INSERT` granted on every column;
- `UPDATE` granted;
- the twin fence dropped.

## Verify after the push

```sql
-- 1. The policies and the grants.
SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'gc_customer_contacts' ORDER BY 1;
-- expect: the three digital_twin_write_fence_* and three read_only_users_cannot_* (RESTRICTIVE), gc_customer_contacts_team (PERMISSIVE, ALL)
SELECT privilege_type FROM information_schema.role_table_grants
WHERE table_name = 'gc_customer_contacts' AND grantee = 'authenticated' AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
-- expect: SELECT only
SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
WHERE table_name = 'gc_customer_contacts' AND grantee = 'authenticated' AND privilege_type = 'INSERT';
-- expect: by_name,contacted_on,customer_id,how,note,project_id
SELECT count(*) FROM information_schema.role_table_grants WHERE table_name = 'gc_customer_contacts' AND grantee = 'anon';
-- expect: 0

-- 2. A sample estimator reads the log (rolled back).
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = 'estimator' AND NOT read_only LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.gc_customer_contacts;
ROLLBACK;
-- expect: 0 (nothing logged yet), with no error
```

## Rollback

```sql
DROP TABLE IF EXISTS public.gc_customer_contacts;
```

Nothing reads or writes it until B2b-v-ii. Roll that back first if it has merged.

## Status

Written 2026-10-10 with the migration. Not pushed.
