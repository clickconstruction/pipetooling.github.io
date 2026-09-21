# 20260921201500_job_lien_claim_corrections.sql (2026-09-21, v2.3682)

New table `public.job_lien_claim_corrections` — the Lien desk's claim, corrected by hand
(the mock-up *Claim, By Hand*). One row per job: `amount_off` the app's unpaid balance
(negative = the notice claims more than the app says is owed — the leader alone may send
that), an optional `per_month` split (`{"YYYY-MM": dollars}`) the paper prints, the
required `reason`, `carry` (rides to later notices and the affidavit until cleared),
`set_by` / `set_by_name` / `set_at`, and `looked_at` / `looked_by_name` for the last
"still true". The office may insert, update and **delete** (clearing is the office's).
The ledger is never touched: the notice and the affidavit read the balance and subtract.

Read-only training accounts are blocked by the two `apply_read_only_*` calls. Plain
`CREATE TABLE` — no lock on a busy table; `lock_timeout` is set anyway.

Apply with `supabase db push` after the PR merges. The client tolerates the table's
absence (the desk loads with no corrections), so order does not matter.
