# 20261009150000_lien_claim_is_billed.sql (2026-10-08, v2.4969)

The Lien desk claims what is billed. The owner (2026-10-08, job 922): *"I can't lien work I have not done yet."* Every lien reader took the job's whole balance, `revenue − payments_made`, as the money at stake and as the notice's claim, so a job billed in stages claimed the stage not yet billed while its pay page enclosed only the sent bills.

## What it does

- `CREATE OR REPLACE FUNCTION public.lien_billed_open(p_job_id uuid, p_status text, p_revenue numeric, p_payments_made numeric) RETURNS numeric` — `LANGUAGE sql STABLE`, the bill-truth rule of `supabase/functions/_shared/billTruth.ts` in SQL:
  - the job has `jobs_ledger_invoices` rows with `status IN ('billed', 'paid')` (a bill has gone out) → `SUM(GREATEST(0, amount − the payments tied to that invoice))` over the `billed` ones, the paid ones nothing;
  - else `p_status = 'billed'` (a job billed as one shell, no bill ever sent) → `GREATEST(0, revenue − payments_made)`;
  - else `0`.
  One reading differs from bill truth on purpose: a billed job whose sent bills are all paid owes 0 here, never a shell row of its unbilled remainder (`openBillRowsForJob` draws that row for the Bill tab) — that remainder is work not yet billed, and a notice never claims it (job 922 on 2026-10-08: two bills paid, $1,000 unbilled, claim 0 and the *Nothing billed* gate).
  Granted to `authenticated, service_role`; commented.
- `CREATE OR REPLACE` of the three desk readers from `20261007190000_lien_desk_skips_uncollectible.sql`, bodies verbatim, one line each: the `jobs` CTE's `open_balance` is `public.lien_billed_open(j.id, j.status, j.revenue, j.payments_made)`:
  - `list_lien_notice_months(p_within_days)`
  - `list_lien_affidavit_windows(p_within_days)`
  - `list_lien_retainage_windows(p_within_days)`
- The `WHERE` filters are unchanged (`COALESCE(j.revenue, 0) − COALESCE(j.payments_made, 0) > 0`, the billed predicate, the Uncollectible clause), so the set of jobs the desk lists is the same; a billed job whose sent bills are paid off now reads `open_balance = 0` and the client draws its fifth gate (*Nothing billed*).
- Return types are unchanged, so no `DROP` and no type regeneration.

## Not changed on purpose

- `list_gc_unpaid_months` (Put a GC on notice) deliberately lists unbilled jobs with `is_billed = false`; it moves in the next PR with the client's Deadlines runway and the Dashboard reminder.
- A payment with `invoice_id IS NULL` on a job that has invoice rows lowers no bill, in SQL as in the Bill tab.

## Verified

- Generated from the current file by replacing the one line in each body and diffed: three money lines and three comment lines differ, nothing else.
- The client reads `open_balance` as it did, so the push and the client deploy can land in either order.
- Run `supabase db push` from the main checkout after merge (dry run first).
