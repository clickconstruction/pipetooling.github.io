# 20261002001000_ar_returned_check_payers.sql (2026-10-01, v2.4328)

The payer remembers a check that came back (punch list #76 PR 4).

- **`list_ar_returned_check_payers(p_since_days default 365)`** — one row per (case, job and bill the check touched) for every *bank* or *rejected* case opened in the window, open or closed: the payments it still carries, the ones taken off (`deleted_records_archive`), the payments of the deposit that replaced it (Poolcorp and Dudley never stayed on a job; their new checks did), and, when no job ever carried it, the hand-recorded payment it matches. Each row carries `job_customer_id`, `job_gc_customer_id`, `job_bill_to_party`, `invoice_bill_to_party`, `invoice_bill_to_email`, so the client names the payer with the one who-pays rule (`payerCustomerId(effectiveInvoiceParty(...))`) instead of a SQL copy. AR roles; revoked from `anon`. The window is clamped to 1–3650 days.

Rehearsed on prod in `BEGIN … ROLLBACK` (with 20261001230000 and 20261001234500): Loberg → Loberg Contracting (#650, GC), Southern Post → Southern Post Construction (#878, GC), Dudley → RMC- Dudley Mason (#258, GC), Poolcorp twice → Poolcorp (#440, customer).

Apply order: merge → `supabase db push`. Before the push the RPC is missing and the line says nothing.
