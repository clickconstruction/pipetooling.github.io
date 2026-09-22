# 20260922150000_schedule_block_events.sql (2026-09-22, v2.3726)

**Purpose**: the schedule keeps a ledger, so the Day book can read *Updated the schedule · N people · N blocks* (Day book PR 5).

**Changes**
- Table `public.schedule_block_events` (identity PK; `block_id`, `job_id`, `bid_id`, `assignee_user_id`, `work_date`, `change` CHECK IN (added, moved, reassigned, removed), `old` / `new` jsonb, `actor_user_id` FK users ON DELETE SET NULL, `occurred_at`). Indexes on `(actor_user_id, occurred_at) WHERE actor_user_id IS NOT NULL` and `block_id`. RLS: SELECT for `is_dev() OR has_payroll_access() OR actor_user_id = auth.uid()`; no write policy (triggers are SECURITY DEFINER); `anon` revoked, `service_role` all.
- Function `public.job_schedule_blocks_to_ledger()` and three triggers on `job_schedule_blocks`: `_ins` (added), `_upd` AFTER UPDATE OF work_date, time_start, time_end, assignee_user_id (reassigned when the assignee changed, else moved; no row when nothing listed changed), `_del` (removed). Actor = `auth.uid()` (NULL for service-role / backfill writes).
- `public.get_day_book_payload(date, date, uuid)` re-created: the body of `20260922110000_day_book_queue_history.sql` plus `ev_schedule` in the union (attributed rows, `kind = 'schedule'`, `ref_type = 'job'`) and unattributed schedule rows in `system_counts`.
- Ends with `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();` (new table).

**Idempotent**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY / TRIGGER IF EXISTS` before create, `CREATE OR REPLACE FUNCTION`. Additive. **Order**: after `20260922110000` (PR 7); a push that applies both in one go ends with this body.
