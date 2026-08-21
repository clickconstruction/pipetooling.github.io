# 20260821110000_job_promised_pay_dates.sql (2026-08-20, v2.1926)

Promised pay dates (expected-payment train part 3):

- `job_promised_pay_dates` — one row per job: `promised_date`, `marked_by`
  (→ users, SET NULL), `marked_at`. RLS enabled with a dev-only policy; all
  app access goes through the two RPCs. Ends with both
  `apply_read_only_write_blocks()` and `apply_read_only_stmt_blocks()`.
- `set_job_promised_pay_date(p_job_id uuid, p_date date)` — upsert; NULL date
  deletes the promise; stamps `marked_by = auth.uid()`. Gate: dev /
  master_technician / `is_assistant()`. Read-only training accounts are
  stopped by the `read_only_block_stmt` statement trigger.
- `list_job_promised_pay_dates()` — jsonb map job id → `{promisedYmd,
  markedByName, markedAt}` with the marker's display name joined. Read gate
  matches `get_billed_customer_pay_speeds` (dev / master / assistant-like /
  primary); NULL otherwise.

Idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`), additive. No apply-order
coordination: the client fails soft until the functions exist (the promise
links still render; saving shows the RPC error toast).
