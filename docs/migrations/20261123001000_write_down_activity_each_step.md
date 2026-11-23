# 20261123001000_write_down_activity_each_step.sql (2026-11-22, v2.8319)

Every agreed write-down is a line on the job's activity (punch list #85, the follow-up to `20261122234400_write_down_keeps_first_amount.sql`). Push after the PR merges. No client change.

## What it does

One function, `jobs_ledger_invoices_to_activity()`, its live definition from `20260922100000_invoice_sent_by.sql` with the write-down branch re-made. The created, billed and sent branches and the two triggers are untouched.

- **When.** A line is written when `agreed_write_down_at` is set and is new or has moved. Before, only when it went from empty to set.
- **The guard.** One `invoice_write_down` line a bill a stamp (`source_id` and `occurred_at`). Before, one a bill.
- **The words.** The step's *before* is `old.amount` when the statement changed the amount, else the kept first amount, so a first write-down reads as before and a later one reads its own step.
- **`detail`.** `previous_amount` is the step's before. New keys: `amount`, the step's after, and `first_amount`, the bill's `agreed_write_down_previous_amount`.
- **The person.** `auth.uid()`, else `agreed_write_down_by` looked up in `public.users`, since the Stripe writer runs as the service role. The lookup keeps a person with no users row from failing the insert on `actor_user_id`'s key.

## Why the shape

- No table of write-downs: the owner's direction was that the job's activity holds each step.
- The stamp is the step. Both writers set it to `now()`, one call a transaction, so a moved stamp is a new write-down and a statement that writes it again as it is adds nothing.
- `source_id` stays the bill's id on every line, as `sub_stage_change` lines share their sheet's, so one filter reads a bill's whole history.
- Nothing is backfilled. On 2026-11-22 prod held four written-down bills, none written down more than once, each with its line.

## Verify

Read-only on prod after the push: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'jobs_ledger_invoices_to_activity' and p.prosrc like '%is distinct from old.agreed_write_down_at%'` reads 1. The SQL bed `npm run test:pg:write-down-first-amount` runs `supabase/tests/write_down_first_amount/30_each_step.sql` after its first scenario. CI runs it from `scripts/sql-beds.txt`.
