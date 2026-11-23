# 20261120090000_primary_money_desk_verbs.sql (2026-11-20, v2.8109)

The money desks close to a primary, the second pass (punch list #400, `to-dos/primary-job-doors.md`, the owner's call 1 and his go of 2026-11-20). It needs nothing but what is live. Push after the PR merges. No client change: no screen of a primary's calls what it closes.

## What it does

Two functions and nine policies, each its live definition with **one change**: the role `primary` comes out.

- **The desk's paying verbs**: `apply_mercury_bank_payment_allocations` and `record_job_tip_from_deposit`. The role comes out of each office list. Each also carried the role in the job's own check, as `AND public.is_job_people(j.id)` since v2.5655. That clause comes out with it, in three places in the first and one in the second, since no caller who passes the list can meet it.
- **The desk's tables**: the select, insert, update and delete policies of `mercury_transaction_ar_returned` and `mercury_transaction_ar_closed`, and the select policy of `mercury_transaction_ar_close_labels`. Each read `public.is_office_staff() OR` the caller is a primary. Each now reads `public.is_office_staff()`.

## Why the first pass missed them

`20261119104000_primary_money_desks.sql` worked from the functions that named the role in an office list with no job check. These two verbs had a job check, so the earlier passes had filed them under the paid verbs a primary keeps on their own jobs. The tables' policies were not functions at all. A sweep of prod's catalog on 2026-11-20 for every function and policy that names the role and touches a bank or deposit table found them.

## What it leaves alone

- `mark_invoice_paid`, `mark_job_paid`, `remove_jobs_ledger_payment_and_reconcile` and the policies of `jobs_ledger_payments`. A primary records and removes payments on their own jobs from the job form.
- `list_ar_returned_check_payers` and the three "who pays when" reads the first pass left open, for the Bill tab of a primary's own job.
- The controller. `record_job_tip_from_deposit` did not name the controller and still does not, though the window shows the controller its tip strip. That is a call for the owner. The three tables' policies keep `is_office_staff()`, which the controller passes, so the four office roles read and write them as before.

## Why the shape

- No screen of a primary's calls either verb. `BankPaymentsModal.tsx` is the only caller in the client, and each of its three doors is gated to the four office roles.
- Nothing a primary uses reads the three tables at the table. Every function that reads them is SECURITY DEFINER, no view reads them, and no other table's policy names them.
- The function bodies are pasted whole from `pg_get_functiondef` on prod. Each matched `20261019120000_primary_paid_verbs.sql` byte for byte before the change.
- `DROP POLICY IF EXISTS` then `CREATE POLICY`, the first pass's form. Between the two statements the table answers nobody, which fails closed.

## Verify

Read-only on prod after the push, as the dev: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('apply_mercury_bank_payment_allocations', 'record_job_tip_from_deposit') and pg_get_functiondef(p.oid) like '%primary%'` reads 0. So does `select count(*) from pg_policies where schemaname = 'public' and tablename like 'mercury_transaction_ar_%' and coalesce(qual, '') || coalesce(with_check, '') like '%primary%'`. Through the dev seat, `view_as` the sample primary and read `mercury_transaction_ar_returned`: no rows. The SQL bed `npm run test:pg:primary-money-desks` (`supabase/tests/primary_money_desks/20_scenario.sql`) asks both verbs and the three tables as two primaries, the assistant, the controller and the master. CI runs it from `scripts/sql-beds.txt`.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274).
