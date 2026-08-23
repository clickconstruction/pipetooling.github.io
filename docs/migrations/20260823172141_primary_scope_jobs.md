# 20260823172141_primary_scope_jobs.sql (2026-08-23, v2.2177)

**Purpose:** primary scoping, part 3 of 3 — a `primary` sees only **jobs** they are the
Account Man for (`jobs_ledger.account_manager_user_id`), which also scopes the Documents page
(a ledger view over jobs/estimates/bids).

**Mechanism:** RESTRICTIVE `primary_scope_jobs_ledger` (row's own `account_manager_user_id`)
and `primary_scope_<child>` on the job_id children (fixtures, invoices, materials, payments,
team members, thread notes + stats cache, tally parts, activity/status/pct events, follow-up
reviews, promised pay dates, property owners, share links, hazmat incidents, payment-chase
touches, collect-payment flows) via `primary_can_access_job(job_id)`; `inspections` via
`job_ledger_id` (NULL anchors pass). Helpers from part 1. No-op for other roles.

**Deliberately not scoped (D1):** `reports`; `list_reports_with_job_info` and
`search_jobs_for_reports` are SECURITY DEFINER, so the Reports tab and its job picker behave
exactly as before for primaries.

**Side effect to know:** adding materials to a job (Edit Job, `jobs_ledger_materials`) now
works only on a primary's Account-Man jobs.

**Safety:** no table DDL; idempotent; rollback = drop the `primary_scope_*` policies.
