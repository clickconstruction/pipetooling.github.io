# 20260824185156_pay_speed_est_date_clock.sql — one bill clock (v2.2241)

`get_billed_customer_pay_speeds` v4 (CREATE OR REPLACE; v3 was
`20260824160639_pay_speed_receipts.sql`). The samples CTE (and therefore the
medians, segments, and receipts) dates each bill by
`COALESCE((billed_at AT TIME ZONE 'America/Chicago')::date, estimated_bill_date)`
instead of `billed_at` alone — matching the client's `billedReferenceYmd`
aging clock, so the stats can never disagree with the chips about when a bill
went out. Gate, payload shape, and grants unchanged.
