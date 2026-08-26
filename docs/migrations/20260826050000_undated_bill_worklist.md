# 20260826050000_undated_bill_worklist.sql — undated-bills worklist (v2.2326)

New RPC `get_undated_bill_worklist()` for the Quickfill "Missing bill dates"
station: billed/paid bills with no `billed_at` and no `estimated_bill_date`,
kept only while they still affect the pay-speed math — a linked payment with
`paid_on` on/after the `pay_speed_no_count_date_v1` floor, or no payments and
`created_at` (Chicago date) on/after it; no floor → the whole backlog. Each
bill carries invoiceId, amount, status, createdYmd, job identity, `hcp_number`,
and its payment dates (newest first) as clues. Ordered by latest activity.
Gate dev / assistant-like / master (no primary), anon revoked. The client
writes the deduced date to `jobs_ledger_invoices.billed_at` under that table's
existing update RLS — no new write path. CREATE OR REPLACE only.
