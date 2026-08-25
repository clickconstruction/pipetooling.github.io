# 20260825001052_pay_speed_quality_block.sql — data-health quality block (v2.2259)

`get_billed_customer_pay_speeds` v6 (CREATE OR REPLACE; v5 was
`20260824215810`). Adds one `quality` jsonb key:

| field | meaning |
|---|---|
| `payments12mo` | payments with `paid_on` in the last 12 months |
| `measurable` | the samples the medians run on (post-quarantine) |
| `unlinked` | 12-month payments with no `invoice_id` |
| `undatedInvoices` | billed/paid invoices with neither `billed_at` nor est. date (all-time backlog) |
| `quarantined` | 12-month pairs excluded by the v5 unverified-same-day rule |

Feeds the Pay speeds breakdown's health line. Medians, receipts, gate, and
grants unchanged from v5.
