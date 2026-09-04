# 20260904201238_statement_round_email_stream.sql (v2.2771)

The `statement_round` REPORT_SUBSCRIPTIONS stream plus the round RPC behind the Dashboard Needs You row. Five parts, all additive:

1. **`get_gc_statement_email_payload`** re-created from the LIVE body (pg_get_functiondef, diffed clean against `20260807020310`) with one new field per row: `row_key` (invoice id for invoice rows, job id for shells) — the client's `GcReviewRow.key`, so server-side callers can diff a group against a certification snapshot.
2. **`get_statement_round_for_user(p_user_id)`** — service-role only. `buildStatementRound` server-side for one sender: GC groups ≥ $10,000 (active billing only), certification by snapshot diff (`gcGroupCertStatus` semantics: no cert → uncertified; unreadable snapshot → totals; else key + remaining cents must match), this week's `gc_statement_round_marks`, sender = `customers.statement_sender_user_id` else the modal `jobs_ledger.account_manager_user_id` over the group's rows. Returns `{ week_start, ready[], held{count,total}, assigned_to_me, sent_by_me }`.
3. **`get_my_statement_round()`** — self-scoped wrapper for office roles (dev / master_technician / assistant / controller); NULL otherwise. EXECUTE for authenticated.
4. **`statement_round_email_requests`** (crew_day shape: `requested_by`, `recipient_user_id`, `send_at`, `repeat_weekly`, `sent_at`, `error`, `attempts`). RLS: office roles insert for office recipients; requester OR recipient OR dev read; requester OR recipient cancel unsent rows; no client UPDATE. Partial index on due rows. **pg_cron `statement-round-email-dispatch`** at `2-57/5 * * * *` (co-rides the :02 lane with gc-statement).
5. **`get_my_email_schedule()` / `get_global_email_schedule()`** re-created from their LIVE bodies with a `statement_round` branch (recipient-scoped one-offs / `statement_round_requests`).

Ends with both read-only sweeps (new table). Idempotent: `CREATE OR REPLACE`, `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `cron.unschedule` before `cron.schedule`.
