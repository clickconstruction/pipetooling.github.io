# 20260826040000_pay_speed_txn_invoice_id.sql — invoiceId in the drill-down (v2.2319)

`get_pay_speed_transactions` **v4** (v3 was 20260826010000): each payment
jsonb also carries `invoiceId` (`jobs_ledger_payments.invoice_id`, null when
the payment isn't applied to a bill). The client uses it to (a) split the old
"unlinked" bucket into `no bill` vs `no bill date` and (b) target the inline
bill-date editor, which writes `jobs_ledger_invoices.billed_at` under the
table's existing update RLS (dev/master/assistant/primary) — no new write
path in SQL. Same gate, anon revoked. CREATE OR REPLACE only; pre-v4 clients
ignore the extra key, post-v4 clients fail soft to `no bill` when the key is
absent.
