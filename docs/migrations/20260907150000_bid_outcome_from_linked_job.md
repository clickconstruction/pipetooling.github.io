# 20260907150000 — a job opened from a bid decides the bid (2026-09-07, v2.3069)

Per-GC bids Q1, answered by the owner: yes, so long as the person is told. `AFTER INSERT OR UPDATE OF bid_id` trigger `jobs_ledger_bid_outcome_from_job` on `jobs_ledger`: a row that gains a `bid_id` sets that bid's `outcome = 'started_or_complete'` unless it already reads that. `SECURITY DEFINER` (`search_path = public`) so the link never depends on the job writer's `bids` update access; skipped in digital-twin sessions (outcomes are human acts there — `twin_no_send_guard` would otherwise raise and block the job insert). Removing a link never clears an outcome.

Covers every writer: the Job form (create, and an edit that changes the link), **Open the job** from a won bid, `auto_create_job_from_signed_estimate`, imports. The client toast (v2.3069) is the Job form's: it reads the bid's outcome before and after its own write and announces a move for five seconds.

**Back-fill** in a `DO` block: every bid with a job that did not read started_or_complete is moved, with a `RAISE NOTICE` count. Expected on prod: small — v2.2859 measured 0 of 815 jobs carrying `bid_id` at the time; links have been routine only since.

Idempotent (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`, the back-fill is a no-op on rerun). No new table → no read-only policy calls. No type change → no `gen-types`.
