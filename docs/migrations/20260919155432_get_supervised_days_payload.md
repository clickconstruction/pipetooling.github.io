# 20260919155432_get_supervised_days_payload.sql (2026-09-19, v2.3613)

Supervision, PR 3 — the supervisor's Dashboard ([`docs/recent-features/v2.3613.md`](../recent-features/v2.3613.md)).

- **`get_supervised_days_payload(p_from date, p_to date) RETURNS jsonb`** — `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`. For the caller: `supervisor` (a master, or a helper / sub with `needs_supervision` off); `job_days` — every (job, day) in the range where they were listed on a `job_schedule_blocks` row or clocked in, with the job's ledger fields, `report_count` / `my_report_count` (reports anchored to the job, dated on the company calendar), and `crew` (everyone else listed or clocked there); `sessions` — the crew's `clock_sessions` on those job-days (rejected and revoked out, pending in), never the caller's own, no wage fields. Anyone who cannot run a job gets `{"supervisor": false, "job_days": [], "sessions": []}`.
- **Why SECURITY DEFINER**: `clock_sessions` SELECT admits a sub or helper to their own rows only; this is the one narrow window the supervision rule opens — sessions on job-days the caller supervised — and the function decides that from the schedule and the clock, not from a list.
- Grants: `REVOKE … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated`.

No table changes; `CREATE OR REPLACE`, idempotent. Apply order: push while the PR is open (the client calls the RPC with an `as never` cast until the types are regenerated), then `npm run gen-types:linked`.
