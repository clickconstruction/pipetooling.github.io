# 20261119101000_primary_money_reads.sql (2026-11-19, v2.7929)

A primary's money reads on one job, held to the job's people (punch list #400 PR 2, `to-dos/primary-job-doors.md`). It stands on `20261019060000_job_people.sql` (`is_job_people`), live. Push after the PR merges. No client change: each read answers the same shape, with fewer rows for a primary off the job.

## What it does

Six functions, each its live definition with **one change**.

- **`can_read_job_activity(job, financial)`**: in both legs the primary clause takes `and public.is_job_people(j.id)`. The plain half keeps its crew leg. It is the gate of `list_job_activity_events`, `job_account_job_identity`, `list_job_account_strip`, the read and the request policies of `job_supply_house_accounts`, and `trip_put_on_job_line`. None of those is rewritten, and each follows.
- **`get_invoice_amounts_for_jobs`, `get_invoice_allocation_lines_for_jobs`, `list_tally_parts_with_po`**: the primary leg asked for a `master_primaries` row, which has paired every master with every primary since v2.921. It asks `is_job_people(jl.id)` now.
- **`get_payment_line_items` and `get_payment_line_items_bulk`**: the gate is a role list with no job in it. The payment's own row takes `AND (NOT is_primary() OR is_job_people(p.job_id))`.

## Why the shape

- Every table behind these reads has carried the restrictive `primary_scope_*` fence since v2.2177. The functions run as the owner, so the fence never reached them. The audit of 2026-11-19 proved the leak on a copy of the whole schema: a primary on no job read another job's activity with its money lines.
- `is_job_people` is the scope of a primary's own money strips and of the paid verbs. So a primary reads through these doors exactly the jobs whose money their screens already show.
- A primary on a job's crew keeps the plain half: the plain activity lines, the job's name and number, and its supply house accounts. That is what a helper on the same crew reads. They lose the money lines there unless they are one of the job's people.
- `list_ar_allocations_for_mercury_transaction` and `list_ar_deposit_trails`, which the card listed here, are bank desk reads. PR 5 of the train closes them with the desk, so one migration replaces each.
- The bodies are pasted whole, from `pg_get_functiondef`, never from the baseline. Each was compared with prod's live definition before the PR opened and matched it byte for byte but for the one clause.

## Verify

Read-only on prod after the push, as the dev: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('can_read_job_activity', 'get_invoice_amounts_for_jobs', 'get_invoice_allocation_lines_for_jobs', 'list_tally_parts_with_po', 'get_payment_line_items', 'get_payment_line_items_bulk') and pg_get_functiondef(p.oid) like '%is_job_people(%'` reads 6. The SQL bed `npm run test:pg:primary-money-reads` (`supabase/tests/primary_money_reads/20_scenario.sql`) reads every door as a primary on their own job, a primary on nothing, a primary on the crew, the assistant and a helper. CI runs it from `scripts/sql-beds.txt`.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); no new name in `database.ts`, since its functions are replaced under their own names.
