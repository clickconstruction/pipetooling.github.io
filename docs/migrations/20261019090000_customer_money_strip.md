# 20261019090000_customer_money_strip.sql (2026-10-19, v2.5649)

The word from the thread (punch list #129 PR 3b, `to-dos/estimator-money-word/README.md`): under a customer's line in Messages, **Write down their word** lands the customer's word on paying on one of their jobs. On `20261019060000_job_people.sql` (`is_job_people`, `list_job_payment_promises_for`) and `20261019080000_paid_claim.sql` (the per-job read's kinds); push after them, after the PR merges. Before the push the press says *None of their jobs is yours to write on*, so client first is fine.

## What it does

**`list_customer_money_strip(p_customer_id uuid) → jsonb`** (STABLE, SECURITY DEFINER): the customer's jobs (`jobs_ledger.customer_id`) the caller is a person of (`is_job_people`), newest first, each as one entry in the shape of `list_bid_money_strip`'s: `bidId` (the job's bid, or null), `job` (id, status, revenue, payments_made, collections_at, uncollectible_at, job_name, hcp_number, click_number, billing_only, customer_id, customer_name, customer_phone, customer_email, created_at), `invoices`, `payments` and `promises` (both kinds, `list_job_payment_promises_for`). `[]` for a customer with no job of the caller's, and for no customer.

Nothing on `jobs_ledger`'s policies changes.

## Why the shape

- The same entry as the bid strip, so one client parse and one money-line kernel serve both reads; the thread needs the job's open money to choose where the word lands (the line's job first, else the one job with money open, else a pick), and the bill truth is the client's.
- By the customer, not the contact: a thread is the customer's, and the line's own job (`messages.jobs_ledger_id`) is matched on the client against the entries.

## Verify

Read-only on prod after the push, as the dev: `select jsonb_array_length(public.list_customer_money_strip((select id from customers limit 1)))`. The SQL bed `npm run test:pg:customer-money-strip` (`supabase/tests/customer_money_strip/20_scenario.sql`) walks the estimator's own bid's job and another's, the office, a helper, a stranger customer and nobody; CI runs it from `scripts/sql-beds.txt`. `src/types/database.ts` needs a regen after the push (a types PR).
