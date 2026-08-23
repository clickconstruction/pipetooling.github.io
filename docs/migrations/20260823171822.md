# 20260823171822.sql (2026-08-23, v2.2175)

**Purpose:** primary scoping, part 2 of 3 — a `primary` sees only **estimates** they created
(the "created and sent" proxy; `estimates` has no `sent_by`) or that hang off a job they are
the Account Man for (`jobs_ledger.account_manager_user_id`).

**Mechanism:** RESTRICTIVE `primary_scope_estimates` (USING + WITH CHECK on the row's own
`created_by` / `job_ledger_id`) and `primary_scope_estimates_thread_notes` (via
`primary_can_access_estimate(estimate_id)`). Helpers from part 1. No-op for other roles.

**Safety:** no table DDL; idempotent; rollback = drop the two policies. Note the permissive
`user_can_access_estimate()` helper still says "primary-all" — that is fine (restrictive ANDs
with it) and keeps the `apply_estimate_to_job` RPC semantics unchanged.
