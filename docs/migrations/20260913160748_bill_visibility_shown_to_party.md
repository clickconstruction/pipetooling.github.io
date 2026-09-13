# 20260913160748_bill_visibility_shown_to_party.sql (2026-09-13, v2.3375)

Share this bill, PR 1 — the two columns behind "Show it on <other party>'s statement".

- `jobs_ledger_invoices.shown_to_party text` (NULL · `customer` · `gc`, CHECK): the non-paying party that sees this bill on their portal statement. NULL = nobody but the payer — every existing row. Stamped by Bill Customer's tick at send (PR 2), changed afterwards from Edit Job → Bill. **The only value the portal reads.**
- `jobs_ledger.show_bills_to_other_party boolean NOT NULL DEFAULT false`: the job's memory — pre-ticks Bill Customer on this job's next bills and decides a billed job's invoice-less shell remainder. Written directly by the Edit-tab fact row and the Bill Customer tick, deliberately **not** part of the identity autosave slice (a stale open form must never revert a tick).

Additive and idempotent (`ADD COLUMN IF NOT EXISTS`, constraint guarded by `pg_constraint`); no CREATE TABLE, so no read-only-block calls; the two tables' existing RLS governs writes.

Apply order: push in either order with the client — the client's selects name the columns only on the portal path (the `customer-portal` edge function, service role) and the Bill tab (PR 2). **Redeploy `customer-portal` after the push**: it selects both columns and filters the payload with them. Before the deploy the old function still emits the v2.3346 symmetric strip; the new client shows nothing for it (the `billedTo` field is no longer read), so the leak closes the moment the function is live.

`src/types/database.ts` carries the two columns by hand (Row / Insert / Update, the v2.3345 pattern); the next `gen-types` run reorders them.
