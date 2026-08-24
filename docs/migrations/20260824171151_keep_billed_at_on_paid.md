# 20260824171151_keep_billed_at_on_paid.sql — paid invoices keep billed_at (v2.2236)

`jobs_ledger_invoices_billed_at_fn` v2 (CREATE OR REPLACE; v1 was in the
baseline). v1 nulled `billed_at` for any non-`billed` status — including
billed→paid, which erased the billed date of every paid invoice in prod (172
rows) and starved the pay-speed model.

v2 matrix:

| Op | status | billed_at |
|---|---|---|
| INSERT | billed | COALESCE(given, now()) — unchanged |
| INSERT | paid | kept as given (backfills/imports) — **new** |
| INSERT | ready_to_bill | NULL — unchanged |
| UPDATE | → billed | COALESCE(given, now()) — unchanged |
| UPDATE | → ready_to_bill | NULL (send-back reset) — unchanged |
| UPDATE | → paid | untouched — **the fix** |

Feeds `get_billed_customer_pay_speeds` (expected-pay chips, Payment forecast,
pay-speed receipts). The one-time repair of already-erased dates ran separately
over psql (activity-event restore + HCP invoices-export backfill) — see
`docs/recent-features/v2.2236.md`.
