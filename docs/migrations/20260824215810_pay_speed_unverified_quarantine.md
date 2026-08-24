# 20260824215810_pay_speed_unverified_quarantine.sql — unverified same-day quarantine (v2.2248)

`get_billed_customer_pay_speeds` v5 (CREATE OR REPLACE; v4 was
`20260824185156`). Adds one exclusion to the samples CTE (which also feeds
the receipts): a payment is quarantined when **all** of

- `paid_on` ≤ its bill day (`COALESCE(billed_at AT TZ Chicago, estimated_bill_date)`),
- `payment_type ILIKE 'hcp%'` (the jobs-export import family),
- note lacks `hcp-paydate-corrected` / `hcp-payments-split` (the payments-report
  true-date tags).

Rationale: those pairs date both sides from the same HCP bookkeeping moment —
"+0 days" is an artifact there, not a speed. Mercury/Stripe/corrected/app-native
same-day payments still count. Gate, payload shape, grants unchanged.
