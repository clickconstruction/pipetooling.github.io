# 20260824160639_pay_speed_receipts.sql — pay-speed receipts (v2.2233)

`get_billed_customer_pay_speeds` v3 (CREATE OR REPLACE; v2 was
`20260821120000_pay_speeds_segments.sql`). Adds one key to the jsonb payload:

- `receipts` — customer id → array of that customer's measurable payments
  (`{billedYmd, paidYmd, gapDays}`), newest `paid_on` first, capped at 12 per
  customer via `row_number()` over the same 12-month samples CTE the medians
  use.

Everything else — company/segment/per-customer medians, `customerTypes`, the
dev/master/assistant-like/primary gate, grants — is unchanged from v2. The
client (`parsePaySpeedsRpc`) tolerates both directions of skew: v2 payloads
parse with an empty receipts map, and old clients ignore the new key.

Powers the expandable receipt chips in the Pay speeds breakdown modal
(`PaySpeedsBreakdownModal.tsx`).
