# 20260928213000_statement_email_paid_by.sql (2026-09-28, v2.4100)

**What**: `CREATE OR REPLACE` of `get_gc_statement_email_payload` from its newest definition (`20260911223500`). Every row gains `invoice_id`, `invoice_amount`, `retainage_held` (the job's `lien_retainage_held`), `job_bills` (the job's `billed` | `paid` invoices: id, amount, status, sequence_order, billed_at) and `job_payments` (the job's `jobs_ledger_payments`: invoice_id, amount, paid_on, payment_type, reference_number, sequence_order — never the note). A shell row (a `billed` job with no billed invoice) carries null invoice fields and the job's payments.

**Why**: the scheduled statement email is rendered server-side from this payload (`gc-statement-email-dispatch/render.ts`), and it was the one surface without the line under each bill that v2.4044 put on the printed statement, GC Review and the portal. With the facts on the row, `render.ts` words the line with the same shared rule the client uses (`_shared/billPaidBy.ts`), and the parity test keeps the two renders one email.

**Risk**: additive keys; every reader ignores what it does not know. Two correlated subselects per open-bill row. Body otherwise verbatim. `SET lock_timeout = '3s'`.

**Deploy with**: `supabase functions deploy gc-statement-email-dispatch` (the client is tolerant of the old payload — no bills, no payments, no line — so order does not matter).
