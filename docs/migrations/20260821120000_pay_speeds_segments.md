# 20260821120000_pay_speeds_segments.sql (2026-08-20, v2.1930)

`get_billed_customer_pay_speeds()` v2 (replaces 20260821100000's body — that
migration is the live definition, so replacing from the repo copy is safe):

- adds `segments.residential` / `segments.commercial` — the same 12-month
  median billed_at→paid_on rule restricted to customers of that
  `customers.customer_type` (untyped customers count toward the company
  median only; a segment with no samples is `null`);
- adds `customerTypes` — every typed customer's id → `'residential' |
  'commercial'`, so the Payment forecast can tag rows even for customers with
  no measurable payments.

Company median, per-customer medians, and the dev/master/assistant-like/
primary gate are unchanged. Function-only, idempotent. The client parses v1
payloads fine (empty segments/types), so apply order doesn't matter — but if
20260821100000 has not been applied yet, this supersedes it (same function).
