# 20260826000000_payment_sent_on_no_count.sql — sent dates + No Count Date (v2.2303)

1. **`jobs_ledger_payments.sent_on`** (nullable date) — the date the payment
   was SENT (check date / customer-initiated). `paid_on` remains "received"
   and remains the pay-speed clock.
2. **No Count Date**: `get_billed_customer_pay_speeds` (now v10; v9 was
   `20260825170000`) and `get_pay_speed_transactions` v2 add a floor to every
   12-month payment filter — payments received before the dev-set date in
   `app_settings` key `pay_speed_no_count_date_v1` (`value_text` =
   YYYY-MM-DD) are ignored everywhere (medians, receipts, quality counts,
   the transactions list). Absent/blank key = count everything. The
   transactions payload reports the active floor as `noCountDate`.

Both functions CREATE OR REPLACE; the column ADD is IF NOT EXISTS; ends with
both `apply_read_only_*` guards.
