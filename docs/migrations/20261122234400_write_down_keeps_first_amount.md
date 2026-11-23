# 20261122234400_write_down_keeps_first_amount.sql (2026-11-22, v2.8305)

A bill written down more than once keeps the amount before its first write-down (punch list #85, a residual of the legal portal's review). Push after the PR merges. No client change: each function answers the same shape, and no reader changes.

## What it does

Two functions, each its live definition with **one changed line**, and the column's comment.

- `apply_agreed_write_down_to_billed_invoice(uuid, numeric, text)`, the in-app bill's writer, from `20261119100000_primary_money_verbs.sql`.
- `service_apply_agreed_write_down_from_stripe(uuid, numeric, text, text, uuid)`, the Stripe bill's writer, from the baseline. The edge functions `stripe-invoice-agreed-write-down` and `stripe-webhook` (the pay offer) call it and set no column themselves.

In each, `agreed_write_down_previous_amount = v_old` becomes `GREATEST(COALESCE(agreed_write_down_previous_amount, v_old), v_old)`. A first write-down stores the bill's amount. A later one leaves the column alone, unless fees have taken the bill above the kept amount, and then it takes the amount the bill stands at. The note, the time, the person and the credit note id still take the newest write-down's.

## Why the shape

- Every reader takes the column as what the bill was and subtracts the bill's amount. Keeping the first amount makes *was* and *written off* right with no reader touched.
- The `GREATEST` covers a bill that a fee took above its kept amount. Left alone, the column would sit below the bill's amount and the readers would count no write-down at all.
- The bodies were held against prod before the change: md5 of `pg_proc.prosrc` matched the repo's newest copy of each on 2026-11-22. Only these two functions assign the column on prod, and no function clears it.
- No table of write-downs. The activity trigger `jobs_ledger_invoices_to_activity` is untouched: it logs a bill's first write-down only, which the fragment reports as found.

## Verify

Read-only on prod after the push: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('apply_agreed_write_down_to_billed_invoice', 'service_apply_agreed_write_down_from_stripe') and p.prosrc like '%GREATEST(COALESCE(agreed_write_down_previous_amount, v_old), v_old)%'` reads 2. The SQL bed `npm run test:pg:write-down-first-amount` (`supabase/tests/write_down_first_amount/20_scenario.sql`) writes a bill down three times on each writer and runs the fee case on each. CI runs it from `scripts/sql-beds.txt`.

No data fix: on 2026-11-22 prod held four written-down bills and none written down more than once.
