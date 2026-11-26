# 20261119104000_primary_money_desks.sql (2026-11-19, v2.7931)

The money desks close to a primary (punch list #400 PR 5, `to-dos/primary-job-doors.md`, the owner's call 1). It needs nothing but what is live. Push after the PR merges. No client change: no screen of a primary's calls what it closes. Its `reopen_ar_return_case` is replaced by [`20261126020832_reopen_ar_return_case_two_reasons`](./20261126020832_reopen_ar_return_case_two_reasons.md) (v2.8615), which holds a replaced case closed.

## What it does

Twenty-two functions and two policies, each its live definition with **one change**: the role `primary` comes out of the office list.

- **The bank payments desk**: `list_mercury_transactions_for_bank_payments`, `count_mercury_transactions_for_bank_payments`, `list_unlinked_payments_for_bank_payments`, `list_ar_allocations_for_mercury_transaction`, `list_ar_deposit_trails`, `ar_book_applied_deposit_income`, `ar_deposit_booking`, `set_mercury_transaction_ar_closed`, `set_mercury_transaction_ar_returned`, `take_returned_check_off_jobs`. The two `list_ar_*` reads also carried the role in their job check, and that clause comes out with it. `close_out_ar_deposit` names no role and asks `set_mercury_transaction_ar_closed`.
- **Returned checks and disputes**: `list_ar_return_cases`, `list_ar_return_case_fees`, `add_ar_return_case_fee`, `put_back_lost_dispute_bill`, the close and reopen verbs of the three case kinds, and the read policies of `ar_stripe_cases` and `ar_unbanked_check_cases`.
- **The pay speed lines**: `get_pay_speed_transactions`, the payment by payment list behind the pay speeds.
- **The GC review week**: `gc_review_week_status`.

## What it leaves open, and why

The card proposed closing the whole of "who pays when" and said the build must first search the client. The search found a screen. The Bill tab of a primary's own job draws its expected-pay dates from `get_billed_customer_pay_speeds` and `list_job_promised_pay_dates` (`useJobBilledExpectedPay`, `canSeeBilledExpectedPay` names the role), its pay calendar from `payer_pay_calendars` through `can_read_payment_promises()`, and its returned-checks warning from `list_ar_returned_check_payers`. The Lien window and the job form's terms bar read `list_job_payment_promises` and `list_payment_promise_records` behind the same gate. Closing them would blank a working screen, so these four functions are untouched. They answer for every payer in the company, not only the payers of the primary's jobs. Whether that is right is a call for the owner, and narrowing it needs a predicate over payers that does not exist yet.

## Why the shape

- None of the closed doors takes a job, so no job predicate can narrow them. The question was whether the role belongs in the lists, and the owner said no.
- No screen of a primary's opens them. Their Jobs page is the Reports tab alone, the bank payments window opens from the Stages tab, `/accounts-receivable` turns the role away, and the Needs-you items that open these windows are the office's. The Dashboard's GC review nudge is the office's too, and it reads a refusal as nothing to show.
- The bodies are pasted whole, from `pg_get_functiondef` on prod, never from the baseline. Each matches a bed holding every migration on `main`, byte for byte, but for the role.

## Verify

Read-only on prod after the push, as the dev: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('list_mercury_transactions_for_bank_payments', 'list_ar_return_cases', 'get_pay_speed_transactions', 'gc_review_week_status', 'set_mercury_transaction_ar_closed') and pg_get_functiondef(p.oid) like '%primary%'` reads 0. The SQL bed `npm run test:pg:primary-money-desks` (`supabase/tests/primary_money_desks/20_scenario.sql`) asks every door as two primaries, the assistant, the controller and the master, and pins the Bill tab's reads as still open. CI runs it from `scripts/sql-beds.txt`.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); no new name in `database.ts`, since its functions are replaced under their own names.
