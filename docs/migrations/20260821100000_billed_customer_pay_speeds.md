# 20260821100000_billed_customer_pay_speeds.sql (2026-08-20, v2.1924)

New `get_billed_customer_pay_speeds()` RPC for the Billed Awaiting Payment
expected-payment chips: per-customer median billed_at→paid_on gap (one sample
per invoice-linked payment, last 12 months by paid_on, negative gaps clamped
to 0, billed_at read as its America/Chicago calendar date) plus a company-wide
median as the low-history fallback. Set-based mirror of
`customerProfileStats.customerDaysToPay` (the profile modal's "pays in ~N
days", v2.1322).

Returns jsonb `{ company: {medianDays, samples} | null, customers: {<id>: …} }`;
NULL for callers outside dev / master_technician / `is_assistant()` / primary
(money-timing metadata only — no wage-derived data, so the gate matches the
roles that already see billed money on the board).

Function-only (`CREATE OR REPLACE`), idempotent, no table changes. No apply-
order coordination needed: the client fails soft (chips simply don't render)
if it deploys before the migration is applied.
