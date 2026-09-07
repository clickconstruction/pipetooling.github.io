# 20260907010000_one_company_backfill_owner.sql (2026-09-07, v2.2984)

One company, **Phase 4** of [`docs/ONE_COMPANY_PLAN.md`](../ONE_COMPANY_PLAN.md): the data says what Phases 1–3 made true.

- **Two more owner-equality guards → no-ops**: `developments_gc_customer_master_match_fn` and `jobs_ledger_development_master_match_fn` (added 2026-08-01, missed by Phase 1's list). Triggers kept.
- **Backfill**: every non-null `master_user_id` on the 15 tables that carry one (`customers`, `developments`, `projects`, `jobs_ledger`, `jobs_receivables`, `estimates`, `bid_proposal_rooms`, `prospects`, `team_prospects`, `team_prospect_roles`, `people`, `people_labor_jobs`, `labels`, `user_tag_org`, `workflow_templates`) becomes `company_owner_user_id()`. Counted at 04:55 UTC: **176 rows** — people_labor_jobs 70, team_prospects 62, people 18, prospects 10, estimates 7, team_prospect_roles 4, bid_proposal_rooms 2, jobs_receivables 2, customers 1 — filed under an estimator (76), an assistant (75) and a dev (25). Every `master_user_id` FK is `ON DELETE CASCADE`, so those rows would have been deleted with the account that filed them.
- **How**: per table, only when something differs — `ALTER TABLE … DISABLE TRIGGER USER` → `UPDATE` → `ENABLE TRIGGER USER`, one `RAISE NOTICE` per table. Pausing user triggers means no `updated_at` bump, no `'owner'` field-edited row in `job_activity_events`, no customer → projects / jobs cascade, no accepted-estimate immutability refusal (signed content untouched). RI triggers stay on. Refuses to run if the owner account is not a leader/dev; does nothing when the settings row is unset. Idempotent.
- **Catalog comments**: `master_assistants` / `master_shares` marked RETIRED; `master_user_id` on customers / projects / jobs_ledger / estimates / prospects / people marked provenance-only.

**Not done, deliberately**: renaming the grant tables. ~52 SECURITY DEFINER functions still read them inline (SQL-language bodies resolve names at call time), and `sync_company_access_grants()` keeps them complete so those gates pass for every office user. Rename/drop waits for the Phase 5 function sweep.

Verify after push: the REST count of `master_user_id=neq.<owner>` on each table is 0 (the Phase 4 fragment has the probe).
