# 20260910233000_discount_activity_events.sql (2026-09-10, v2.3256)

The discount trail (fragment `docs/recent-features/v2.3256.md`):

- **`log_job_discount_event(p_job_id, p_event_type, p_summary, p_detail)`** → `uuid` — SECURITY DEFINER; the Edit Job client calls it after a billing-slice save that changed a discount row, with `discount_added` / `discount_changed` / `discount_removed` (any other type is refused). Gate: signed in, role in dev / master_technician / assistant / controller, and `can_read_job_activity(job, false)`. Inserts a **financial** `job_activity_events` row (summary capped at 500 chars). `EXECUTE` granted to `authenticated` only.
- **`jobs_ledger_fixtures_to_activity()`** recreated from its live body (20260608010000) with one added guard: `where new.line_kind is distinct from 'discount'`. The save engine reinserts a job's rows with fresh ids on every autosave, so the trigger's per-row dedupe would have re-logged *Specific work added: Negotiated discount* on every save; discount rows log through the RPC instead. Work rows are unchanged.

Apply order: client first (the log call is best-effort — a missing RPC only warns in the console), then `bash scripts/db-push.sh`. No edge function.
