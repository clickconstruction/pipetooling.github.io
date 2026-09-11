# 20260911055837_customer_payment_terms.sql (2026-09-11, v2.3285)

"Their Word" PR 4 — payment terms on the customer (fragment `docs/recent-features/v2.3285.md`):

- `customers.payment_terms text NOT NULL DEFAULT 'standard'` with CHECK `customers_payment_terms_check` (`standard` · `deposit_required` · `no_new_work_past_promise` · `winding_down`), `payment_terms_note text`, `payment_terms_set_by uuid → users` (SET NULL), `payment_terms_set_at timestamptz`. Additive, idempotent (`ADD COLUMN IF NOT EXISTS`, constraint guarded by a `pg_constraint` lookup); no RLS change — the customers table's existing policies govern writes. No CREATE TABLE, so no read-only-block calls.

Applied to prod 2026-09-11 05:59 UTC (ahead of the merge — see the fragment's push note). Validated twice on the scratch Postgres 16 replay; the CHECK refuses unknown values.
