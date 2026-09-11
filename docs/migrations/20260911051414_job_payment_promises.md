# 20260911051414_job_payment_promises.sql (2026-09-11, v2.3280)

"Their Word" PR 1 — customer payment promises as an append-only event log (fragment `docs/recent-features/v2.3280.md`):

- **`job_payment_promises`** — `job_id` (cascade), `customer_id` (the payer: `COALESCE(gc_customer_id, customer_id)` snapshotted at promise time), `promised_date`, `said_by` text, `heard_by` → users (NULL = customer self-promise), `channel` check (phone · text · email · in_person · portal · backfill), `source` check (office · customer), `note`, `created_at`, `voided_at/by`. Indexes on (job_id, created_at desc) and (customer_id, created_at desc). Dev-only RLS; all traffic via RPCs; both read-only blocks applied.
- **Gates** `can_write_payment_promises()` (dev / assistant-like / master_technician) and `can_read_payment_promises()` (+ primary) — the same role sets `set_job_promised_pay_date` / `list_job_promised_pay_dates` inline.
- **Trigger** `job_promised_pay_dates_log_promise_trg` AFTER INSERT OR UPDATE on `job_promised_pay_dates`: logs an event for the legacy upsert path (skips same-date re-stamps; skips when `current_setting('app.promise_event_written', true) = 'on'`, which `add_job_payment_promise` sets transaction-locally after writing its own event). DELETE is not trapped — clearing a promise keeps its event.
- **Backfill** of the existing `job_promised_pay_dates` rows (one event each; idempotent).
- **RPCs** `add_job_payment_promise(uuid, date, text, text, text)` → jsonb, `void_job_payment_promise(uuid)`, `list_job_payment_promises()`, `list_payment_promise_records()` (per live promise: billed total on the job as of the promise + the job's dated payments). EXECUTE revoked from PUBLIC/anon, granted to authenticated.

Apply order: client first, then `supabase db push`. Nothing in the client reads the new RPCs until PR 3, so the order only matters for the trigger: once pushed, every promised date marked through the existing modal or call mode starts logging. Validated on a scratch Postgres 16 replay of the prod schema dump before push (scenario in the fragment).
