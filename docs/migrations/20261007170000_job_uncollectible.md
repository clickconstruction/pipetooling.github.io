# 20261007170000_job_uncollectible.sql (2026-10-07, v2.4782)

Punch list #94, PR 1 ([v2.4782](../recent-features/v2.4782.md)): a job the office has given up on.

1. **`jobs_ledger`** gains `uncollectible_at`, `uncollectible_by` (→ `users`, set null), `uncollectible_reason`. Uncollectible = `status = 'billed' AND collections_at IS NOT NULL AND uncollectible_at IS NOT NULL` — a sub-state of Collections; readers filter status first, as they do for the Collections flag.
2. **`set_job_uncollectible(p_job_id, p_flagged, p_reason)`** (new, SECURITY DEFINER, jsonb): the Collections managers' pool (dev · master_technician · assistant · controller — the owner's "any office staff"); the job must be `billed` and in Collections; a reason of at least 12 characters when marking; idempotent; one `job_activity_events` row (`uncollectible_change`, financial; the open balance in `detail`) each way.
3. **`set_job_collections_flag`** re-created: sending a job back to Billed also clears the three columns, with its own `uncollectible_change` event (`detail.auto = true`). The duplicated `is_office_or_estimator()` clause is gone; nothing else moves.
4. **`clear_job_collections_on_paid`** (the v2.1642 BEFORE trigger) clears the mark before the flag, each with its event; the trigger's WHEN fires on either.

Locks: three `ADD COLUMN IF NOT EXISTS` without defaults take ACCESS EXCLUSIVE on `jobs_ledger` for an instant; `SET lock_timeout = '3s'` first. `CREATE OR REPLACE` on the two functions and the trigger re-create are instant. Idempotent.

## Order

Merge, `supabase db push`, regenerate types (the client reads the three columns from `database.ts` and the RPC through an untyped client until then). PR 2 (bill truth) and PR 3 (the board) read the columns; nothing before them does.
