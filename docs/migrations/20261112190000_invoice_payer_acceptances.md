# 20261112190000_invoice_payer_acceptances.sql (2026-11-12, v2.7036)

Pay calendar (punch list #323, PR 4): the day a payer accepted a bill, when that is not the day it went in. A calendar-paying contract counts its cutoff from the day an acceptable application is received; a bill sent back and accepted the next month is due a whole month later.

- **`invoice_payer_acceptances`** (new table): `invoice_id` (primary key, a `jobs_ledger_invoices` row, cascades on delete), `accepted_on` (date), `marked_by`, `marked_at`. One row a bill. No row means the bill counts from the day it went in.
- **RLS**: one SELECT policy, `can_read_payment_promises()`. No write policy and no write grant to `authenticated`.
- **`set_invoice_payer_accepted_on(p_invoice_id uuid, p_accepted_on date)`**: SECURITY DEFINER, gated on `can_write_payment_promises()`. Upserts the day and stamps the caller; a NULL day deletes the row. Refuses an unknown bill in words.
- Ends with the four fence calls.

Starts with `SET lock_timeout = '3s'`. Idempotent: `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before the policy, `CREATE OR REPLACE` for the function. The foreign key takes a brief lock on `jobs_ledger_invoices` while the table is created; with the timeout a busy moment fails the push and it is retried.

Proven on a throwaway copy of the whole schema by section 8 of `npm run test:pg:pay-calendar` (`supabase/tests/pay_calendar/20_scenario.sql`), which also applies it a second time; never on prod.

Apply order: after `20261112150000_payer_pay_calendars.sql`, though neither needs the other. The client in the same PR reads the table and calls the function. Before the push the read finds no table and answers none, and a Save is refused as a missing function, so nothing breaks; **push right after the merge**, then `npm run gen-types:linked` as its own `chore(types)` PR.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659); types regenerated in #7859.
