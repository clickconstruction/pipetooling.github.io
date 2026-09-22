# 20260922190000_day_book_queue_snapshots.sql (2026-09-22, v2.3736)

**Purpose**: history for deposits, contracts (and bills) on the Day book — the queue snapshot, written by a dev or controller's Dashboard (decision 6).

**Changes**
- Table `public.day_book_queue_snapshots` (`day date`, `kind text` CHECK IN (deposits, contracts, billing), `n integer` ≥ 0, `taken_at`, `taken_by uuid` FK users ON DELETE SET NULL; PK `(day, kind)`). RLS: SELECT for users with role dev or controller; no write policy; `anon` revoked; `service_role` all.
- `public.record_day_book_queue(p_day date, p_counts jsonb) RETURNS integer` — SECURITY DEFINER; caller must be dev or controller (else raises); upserts one row per present key among deposits · contracts · billing with a non-negative number; returns the rows written. Granted to authenticated and service_role.
- `public.day_book_payload_for(uuid, date, date, uuid)` re-created: the body of `20260922180000_day_book_for_user.sql` with the `queue` CTE gaining `UNION ALL SELECT day, kind, n FROM day_book_queue_snapshots WHERE day BETWEEN v_from AND v_to AND kind IN (…)`. The two doors are unchanged.
- Ends with `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();` (new table).

**Idempotent**: `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`. Additive. **Order**: after `20260922180000` (PR 6b).
