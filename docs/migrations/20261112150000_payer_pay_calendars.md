# 20261112150000_payer_pay_calendars.sql (2026-11-12, v2.7024)

Pay calendar (punch list #323, PR 1): a place for the two days a calendar-paying contract names, the day a bill must be in by and the day the payer pays.

- **`payer_pay_calendars`** (new table): `payer_customer_id` (the payer, a `customers` row, required), `job_id` (NULL is the payer's own calendar; a job's row is that job's own), `off` (a job's row can switch the payer's calendar off there), `cutoff_day` (1 to 28, NULL is the last day of the month), `pay_day` (1 to 31), `months_after` (0 to 2, default 1), `pay_when_paid`, `clause` (40 characters), `words` (240), `set_by`, `set_at`. A row is a calendar or one job's off switch (`payer_pay_calendars_shape_check`); the payer's own row is never an off switch, since no row is how a payer has none. Two partial unique indexes hold one row a payer and one a payer and job. Both foreign keys cascade on delete.
- **RLS**: one SELECT policy, `can_read_payment_promises()` (dev, assistant-like, master technician, primary). No write policy and no write grant to `authenticated`.
- **`set_payer_pay_calendar(p_payer_customer_id uuid, p_job_id uuid, p_calendar jsonb)`**: SECURITY DEFINER, gated on `can_write_payment_promises()` (dev, assistant-like, master technician). Deletes the row for that payer and job, then inserts the new one; a NULL calendar only clears. The calendar is `{cutoffDay, payDay, monthsAfter, payWhenPaid, clause, words}`, or `{off: true}` on a job's row. Refuses in words: an unknown payer or job, a pay day outside 1 to 31, a cutoff outside 1 to 28, a month count outside 0 to 2, an off switch with no job. Stamps `set_by` with the caller.
- Ends with the four fence calls, so a read-only account, a digital twin and an archived caller are held as on every table.

Starts with `SET lock_timeout = '3s'`. Idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` before the policy, `CREATE OR REPLACE` for the function. The foreign keys take a brief lock on `customers` and `jobs_ledger` while the table is created; with the timeout a busy moment fails the push and it is retried.

Proven on a throwaway copy of the whole schema by `npm run test:pg:pay-calendar` (`supabase/tests/pay_calendar/20_scenario.sql`), never on prod.

Apply order: the client in the same PR reads the table and calls the function. Before the push the read finds no table and answers none, and a Save is refused as a missing function, so nothing breaks; **push right after the merge**, then `npm run gen-types:linked` as its own `chore(types)` PR.

**Not applied** as of 2026-11-12: the PR is open.
