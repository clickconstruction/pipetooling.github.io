# 20261119100000_primary_money_verbs.sql (2026-11-19, v2.7921)

A primary's money verbs held to the job's people (punch list #400 PR 1, `to-dos/primary-job-doors.md`). It stands on `20261019060000_job_people.sql` (`is_job_people`) and `20260823171822_primary_scope_estimates.sql` (`primary_can_access_estimate`), both live. Push after the PR merges. No client change: each verb answers the same shape, and a primary off the job now reads its refusal where they read ok.

## What it does

Ten functions, each its live definition with **one change**.

- **Seven job verbs** take `AND public.is_job_people(<the job>)` on the primary clause of the job's own check, the clause v2.5655 wrote into the paid verbs: `apply_agreed_write_down_to_billed_invoice`, `delete_billed_invoice_on_send_back`, `delete_marked_paid_invoice_without_payment`, `delete_ready_to_bill_invoice`, `revert_stripe_oob_invoice_payment`, `move_jobs_ledger_payment` (its check runs on both jobs, so a payment moves only between two jobs that are both theirs) and `update_job_status` in its paid to billed leg.
- **Three estimate verbs**, `apply_estimate_to_job` and both shapes of `create_job_from_estimate`, ask `user_can_access_estimate(e)`, which says yes to any primary. At the table the restrictive `primary_scope_estimates` policy narrows that. These verbs run as the owner, so the narrowing is written in: `user_can_access_estimate(e) AND (NOT is_primary() OR primary_can_access_estimate(e.id))`. A primary applies the estimates they wrote.

The role gate at the top of each function stays as it was. Dev, master, assistant, controller, estimator and superintendent are untouched.

## Why the shape

- The audit of 2026-11-19 stood a copy of the whole schema up and asked each door as a primary on no job. Three of these answered ok: the write-down, the payment move and the delete of a billed bill. The others have the same clause and were read.
- `is_job_people` and not `primary_can_access_job`: it is the predicate the paid verbs and a primary's own money strips already share, so a primary acts on exactly the jobs whose money they read.
- The bodies are pasted whole, the house pattern since v2.5029, taken from `pg_get_functiondef` on a bed holding every migration on `main`, never from the baseline.
- The six-argument `create_job_from_estimate` cannot be reached while the seven-argument one exists (a call that fits it fits both). It is narrowed all the same, so it is not a door if the newer shape is ever dropped.

## What it leaves alone

`apply_job_discount` and `log_job_discount_event` never named the role. `trip_put_on_job_line` and the insert on `job_supply_house_accounts` reach a job through `can_read_job_activity`, which PR 2 of the train narrows.

## Verify

Read-only on prod after the push, as the dev: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('apply_agreed_write_down_to_billed_invoice', 'delete_billed_invoice_on_send_back', 'delete_marked_paid_invoice_without_payment', 'delete_ready_to_bill_invoice', 'revert_stripe_oob_invoice_payment', 'move_jobs_ledger_payment', 'update_job_status') and pg_get_functiondef(p.oid) like '%is_job_people(%'` reads 7, and the same count over `apply_estimate_to_job` and `create_job_from_estimate` with `'%primary_can_access_estimate(e.id)%'` reads 3. The SQL bed `npm run test:pg:primary-money-verbs` (`supabase/tests/primary_money_verbs/20_scenario.sql`) walks a primary on nothing, a primary on their own jobs and the assistant through each verb. CI runs it from `scripts/sql-beds.txt`.
