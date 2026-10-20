# 20261019120000_primary_paid_verbs.sql (2026-10-19, v2.5655)

Primary's paid verbs narrowed to the job's people (punch list #129 PR 6, `to-dos/estimator-money-word/README.md`). On `20261019060000_job_people.sql` (`is_job_people`); push after it, after the PR merges. No client change: the verbs answer the same shapes, a primary off the job now reads *Not authorized* where they read ok.

## What it does

Each of six functions is its repo definition — `mark_job_paid` (both overloads), `mark_invoice_paid`, `apply_mercury_bank_payment_allocations` and `remove_jobs_ledger_payment_and_reconcile` from `20260927230000_controller_money_functions.sql`, `record_job_tip_from_deposit` from `20261010023000_revenue_keeps_check_fee.sql` — with **one change** in the job's own check: the clause that let any primary through, `OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')`, takes `AND public.is_job_people(j.id)`, so a primary acts on the jobs they account-manage or sold (the bid's estimator or account manager) and on no other. The allocation's three per-line checks (a payment's job, an invoice's job, a job line) are each narrowed, so a deposit allocated by a primary lands only on their jobs. The role gate at the top of each function stays as it was; dev, master, assistant and controller are untouched.

## Why the shape

- A primary is scoped to their own jobs everywhere a policy reads (`primary_scope_*`, v2.2174–2181), but SECURITY DEFINER verbs bypass policies and carried their own role list; this is the one predicate the policies and the verbs now share.
- The bodies are pasted whole (the house pattern since v2.5029, 20261009235900) rather than patched in place, because `CREATE OR REPLACE` takes a whole function; the migration names each body's source file and lines so a diff against it shows the one clause.

## Verify

Read-only on prod after the push, as the dev: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('mark_job_paid', 'mark_invoice_paid', 'apply_mercury_bank_payment_allocations', 'remove_jobs_ledger_payment_and_reconcile', 'record_job_tip_from_deposit') and pg_get_functiondef(p.oid) like '%is_job_people(j.id)%'` reads 6. The SQL bed `npm run test:pg:primary-paid-verbs` (`supabase/tests/primary_paid_verbs/20_scenario.sql`) walks a primary on their job and off it through mark by the job, mark by the day, mark the bill, remove the payment, and the office untouched; CI runs it from `scripts/sql-beds.txt`.
