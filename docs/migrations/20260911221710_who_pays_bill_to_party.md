# 20260911221710_who_pays_bill_to_party.sql (2026-09-11, v2.3345)

Who pays the bill, PR 1 (fragment `docs/recent-features/v2.3345.md`):

- `jobs_ledger.bill_to_party text NOT NULL DEFAULT 'customer'` with CHECK `jobs_ledger_bill_to_party_check` (`customer` · `gc` · `split`) — the job's rule for who its bills address.
- `jobs_ledger_invoices.bill_to_party text` with CHECK `jobs_ledger_invoices_bill_to_party_check` (NULL · `customer` · `gc`) — one invoice's own pick; NULL inherits the job. The older typed `bill_to_email` still wins over both.
- `customers.billing_email text` — where the customer is billed when it differs from the contact email (a GC's AP inbox); blank = `contact_info.email`.

Additive, idempotent (`ADD COLUMN IF NOT EXISTS`, constraints guarded by `pg_constraint` lookups); no RLS change — the three tables' existing policies govern writes; no CREATE TABLE, so no read-only-block calls. Deploy order: client first (it reads a missing column as `customer`), then this push, then redeploy `create-stripe-invoice`, `preview-stripe-invoice`, `send-physical-invoice-email` (they resolve the payer from these columns).
