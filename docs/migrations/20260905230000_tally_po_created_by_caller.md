# 20260905230000_tally_po_created_by_caller.sql (2026-09-05, v2.2903)

`CREATE OR REPLACE` of `public.create_po_from_job_tally(p_job_id, p_entries)` — the Job Tally "parts → draft PO" RPC. One line changes: `purchase_orders.created_by` is now `COALESCE(auth.uid(), v_master_id)` (the tallier) instead of `v_master_id` (the job's master technician). Journey-map Tier-3 B14 / J29-N4: the Purchase Orders ledger credited the master with a PO an assistant or office user tallied.

- **Why the fallback:** `auth.uid()` is null only for service-role callers; the master keeps the `NOT NULL` column satisfied there. The master is still read (it proves the job exists) and stays where it lives — `jobs_ledger.master_user_id`.
- **Readers affected:** `purchase_orders` RLS (`sup_purchase_orders_update/delete` let the *creator* edit their own draft — a tallier can now edit the draft they made; previously only the master or an office role could), the Purchase Orders tab's "created by" name, the Supply Houses tab PO list.
- **Apply order:** independent of the client — no client change reads this. Idempotent (`CREATE OR REPLACE`, same signature, no type regen).
- No new table, so the read-only write-block helpers are not re-applied; the existing `read_only_block_stmt` trigger on `purchase_orders` still stops read-only users.
