# Database Migrations Reference

---
file: MIGRATIONS.md
type: Reference/Changelog
purpose: Complete database migration history organized by date and category
audience: Developers, Database Administrators, AI Agents
last_updated: 2026-04-02
estimated_read_time: 15-20 minutes
difficulty: Intermediate to Advanced

total_migrations: ~87
date_range: "Through March 24, 2027"
categories: "Bids, Materials, Workflow, RLS, Database Improvements"

key_sections:
  - name: "Recent Migrations (Feb 2026)"
    line: ~18
    anchor: "#recent-migrations"
    description: "Latest schema changes by date"
  - name: "Migrations by Category"
    line: ~196
    anchor: "#migrations-by-category"
    description: "Grouped by system/feature"
  - name: "Migrations by Feature"
    line: ~337
    anchor: "#migrations-by-feature"
    description: "Complete feature implementation sequences"
  - name: "Migration Best Practices"
    line: ~397
    anchor: "#migration-best-practices"
    description: "How to create safe migrations"
  - name: "Rollback Procedures"
    line: ~452
    anchor: "#rollback-procedures"
    description: "How to revert changes"

quick_navigation:
  - "[Latest Changes](#recent-migrations) - April 2026"
  - "[By Category](#migrations-by-category) - Grouped by system"
  - "[Best Practices](#migration-best-practices) - How to migrate safely"
  - "[Rollback](#rollback-procedures) - Reverting changes"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Current schema"
  - "[DATABASE_IMPROVEMENTS_SUMMARY.md](./DATABASE_IMPROVEMENTS_SUMMARY.md) - v2.22 improvements"
  - "[supabase/archive/README.md](./supabase/archive/README.md) - Migration files"

prerequisites:
  - Understanding of PostgreSQL DDL
  - Familiarity with RLS concepts
  - Knowledge of Supabase migrations

when_to_read:
  - Creating new migrations
  - Understanding schema evolution
  - Debugging migration issues
  - Planning schema changes
  - Reviewing project history
---

## Table of Contents
1. [Overview](#overview)
2. [Recent Migrations](#recent-migrations)
3. [Migrations by Category](#migrations-by-category)
4. [Migration Best Practices](#migration-best-practices)
5. [Rollback Procedures](#rollback-procedures)

---

## Overview

This document tracks all database migrations in the PipeTooling project. Migrations are located in `supabase/migrations/` and are applied automatically by Supabase.

### Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20260206220800_add_unique_constraint_to_price_book_versions.sql`

### Key Principles
- Migrations are **append-only** (never edit existing migrations)
- Each migration is **idempotent** when possible
- Destructive changes require explicit confirmation
- Schema changes documented in this file

---

## Recent Migrations

### April 2026

#### April 5, 2026

**`20260405072854_estimate_create_job_rpc.sql`**
- **Purpose**: Staff create a **`jobs_ledger`** row from a **`customer_accepted`** estimate and set **`estimates.job_ledger_id`** in one transaction; idempotent when already linked
- **Changes**: Partial unique index **`estimates_job_ledger_id_unique`** on **`estimates(job_ledger_id)`**; **`create_job_from_estimate`** (`SECURITY DEFINER`, `GRANT EXECUTE` to **`authenticated`**) — enforces **`user_can_access_estimate`** / **`superintendent_can_access_estimate`**, mirrors Jobs owner resolution (project **`master_user_id`** or **`job_owner_override_*`**), optional **`p_customer_id`** and field overrides
- **Impact**: [`Estimates.tsx`](src/pages/Estimates.tsx) **Create job from estimate**; [`Jobs.tsx`](src/pages/Jobs.tsx) **Source estimate** strip + **[`CustomerAcceptanceRecordModal`](src/components/estimates/CustomerAcceptanceRecordModal.tsx)**; [`jobLedgerCustomer.ts`](src/lib/jobLedgerCustomer.ts), [`resolveEffectiveJobMasterUserId.ts`](src/lib/resolveEffectiveJobMasterUserId.ts)
- **Category**: Estimates / Jobs

**`20260405101849_count_unlinked_tally_stale_by_age.sql`**
- **Purpose**: Dashboard **stale tally** callout — count unlinked linked-card Mercury rows whose **`posted_at`** Chicago calendar date is **more than `min_age_days`** before today (default **2**), with the same scope as **`count_unlinked_mercury_transactions_for_tally`** (**`job_tally_min_posted_ymd`** floor, no **`mercury_transaction_job_allocations`**)
- **Changes**: **`count_unlinked_mercury_transactions_for_tally_stale(min_age_days integer DEFAULT 2)`** — `SECURITY DEFINER`, `GRANT EXECUTE` to **`authenticated`**
- **Impact**: [`DashboardTallyStaleBanner.tsx`](src/components/DashboardTallyStaleBanner.tsx), [`Dashboard.tsx`](src/pages/Dashboard.tsx) (focus refresh with tally unlinked count)
- **Category**: Dashboard / Job Parts Tally

**`20260405211552_tally_stale_staff_followup.sql`**
- **Purpose**: **Dev / master_technician / assistant** Dashboard follow-up for **other people’s** stale unlinked linked-card Mercury transactions (same age/floor/unlinked rules as **`count_unlinked_mercury_transactions_for_tally_stale`**); staff assign splits on behalf of the card owner
- **Changes**: **`staff_can_view_user_for_tally_followup(viewer, target)`** (internal definer helper, not granted to **`authenticated`**); **`list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days)`** (flat rows with contact + tx fields, **`LIMIT 500`**); **`search_jobs_for_tally_mercury_assign_as_user(p_for_user_id, search_text)`**; **`replace_mercury_job_splits_for_linked_card_as_staff(p_for_user_id, p_mercury_transaction_id, p_rows)`** — `SECURITY DEFINER`, grants where applicable
- **Impact**: [`DashboardTallyStaleStaffBanner.tsx`](src/components/DashboardTallyStaleStaffBanner.tsx), [`DashboardStaleTallyStaffFollowUpModal.tsx`](src/components/DashboardStaleTallyStaffFollowUpModal.tsx), **`tallyActAsUserId`** on [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx), [`Dashboard.tsx`](src/pages/Dashboard.tsx)
- **Category**: Dashboard / Job Parts Tally

**`20260405213504_settings_job_counts_by_master.sql`**
- **Purpose**: Dev **Settings → People & accounts** job counts per master without scanning every **`jobs_ledger`** row on the client
- **Changes**: **`list_job_counts_by_master_for_dev_settings()`** — `RETURNS TABLE (master_user_id uuid, job_count bigint)`; **`SECURITY DEFINER`**, **`STABLE`**, **`is_dev()`** gate; `GROUP BY` on non-null **`master_user_id`**; **`REVOKE ALL`**, **`GRANT EXECUTE`** to **`authenticated`**
- **Impact**: [`Settings.tsx`](src/pages/Settings.tsx) **`loadData`** (dev-only **`withSupabaseRetry`** RPC + parallel dev loaders)
- **Category**: Settings / Performance

#### April 6, 2026

**`20260406024629_estimate_customer_events.sql`**
- **Purpose**: Append-only **customer activity** for Approach A estimates — public link views and successful accept submits
- **Changes**: **`estimate_customer_events`** (`estimate_id`, `occurred_at`, `event_type`, `source`, `client_ip`, `user_agent`, `metadata` **`jsonb`**); **`CHECK`** on **`event_type`** (`public_link_view`, `public_accept_submitted`) and **`source`**; index **`(estimate_id, occurred_at DESC)`**; **RLS** **`SELECT`** aligned with **`estimates`** visibility; **`GRANT SELECT`** to **`authenticated`**; rows appended only via **`service_role`** Edge calls and **`SECURITY DEFINER`** Postgres (see later migrations: trigger + RPCs), not **`authenticated`** direct **`INSERT`**
- **Impact**: [`get-estimate-for-customer`](supabase/functions/get-estimate-for-customer/index.ts), [`accept-estimate`](supabase/functions/accept-estimate/index.ts), [`logEstimateCustomerEvent.ts`](supabase/functions/_shared/logEstimateCustomerEvent.ts); **Customer activity** on [`Estimates.tsx`](src/pages/Estimates.tsx) detail
- **Category**: Estimates / Edge / Audit

**`20260406025757_log_estimate_customer_event_rpc.sql`**
- **Purpose**: **`log_estimate_customer_event`** — **`SECURITY DEFINER`** insert into **`estimate_customer_events`**; **`GRANT EXECUTE`** to **`service_role`** only (Edge **`rpc`** + optional insert fallback from [`logEstimateCustomerEvent.ts`](supabase/functions/_shared/logEstimateCustomerEvent.ts))
- **Impact**: [`logEstimateCustomerEvent.ts`](supabase/functions/_shared/logEstimateCustomerEvent.ts); repeat **`accept-estimate`** (**`alreadyAccepted`**) audit
- **Category**: Estimates / Edge / Audit

**`20260406033952_estimates_audit_customer_accepted_trigger.sql`**
- **Purpose**: Reliable **`public_accept_submitted`** audit when **`estimates.status`** transitions **`sent` → `customer_accepted`** (same transaction as **`accept-estimate`** update)
- **Changes**: **`estimates_audit_customer_accepted_row`** + **`estimates_audit_customer_accepted_trigger`** (`AFTER UPDATE OF status`); copies **`acceptor_ip`**, **`acceptor_user_agent`**, and signature presence into **`estimate_customer_events`**
- **Impact**: [`accept-estimate`](supabase/functions/accept-estimate/index.ts) (main path relies on trigger, no duplicate Edge insert); **Customer activity** on [`Estimates.tsx`](src/pages/Estimates.tsx)
- **Category**: Estimates / Audit

**`20260406034514_record_estimate_public_link_view_rpc.sql`**
- **Purpose**: **`record_estimate_public_link_view`** — **`SECURITY DEFINER`** append **`public_link_view`** while the row is still **`sent`**; **`GRANT EXECUTE`** to **`service_role`**
- **Impact**: [`get-estimate-for-customer`](supabase/functions/get-estimate-for-customer/index.ts) on each successful public **GET** **200**
- **Category**: Estimates / Edge / Audit

#### April 8, 2026

**`20260405010252_estimate_customer_experience_defaults_snapshot.sql`**
- **Purpose**: Dev-editable estimate customer copy defaults in **`app_settings`**; per-estimate **`customer_experience_overrides`**; frozen **`customer_experience_sent`** written when **send-estimate-to-customer** sets **`sent`**
- **Changes**: `customer_experience_overrides` / `customer_experience_sent` **`jsonb`** on **`public.estimates`** (object check); **`INSERT`** default **`estimate_*`** `app_settings` keys; extend **`estimates_protect_after_accept`** to freeze both json columns after **`customer_accepted`**
- **Impact**: [`Settings.tsx`](src/pages/Settings.tsx) defaults; [`Estimates.tsx`](src/pages/Estimates.tsx) overrides + previews; [`EstimateAccept.tsx`](src/pages/EstimateAccept.tsx); Edge [`get-estimate-for-customer`](supabase/functions/get-estimate-for-customer/index.ts) / [`send-estimate-to-customer`](supabase/functions/send-estimate-to-customer/index.ts); [`src/lib/estimateCustomerExperience.ts`](src/lib/estimateCustomerExperience.ts)
- **Category**: Estimates / Edge / Settings

#### April 7, 2026

**`20260405003103_estimates_global_estimate_number.sql`**
- **Purpose**: Global sequential **Quote #** on **`public.estimates`** (`estimate_number`), immutable after assignment
- **Changes**: `estimate_number` column + unique index; `estimates_estimate_number_seq` owned by column; `BEFORE INSERT` assigns number; `BEFORE UPDATE` rejects changes to `estimate_number`; backfill existing rows by `created_at`; extend post-accept immutability trigger to treat `estimate_number` like other frozen columns
- **Impact**: Staff URLs **`/estimates/{estimate_number}`** (UUID path still works); list/detail **Quote #** in [`Estimates.tsx`](src/pages/Estimates.tsx)
- **Category**: Estimates

#### April 4, 2026

**`20260404212052_estimates_approach_a.sql`**
- **Purpose**: **`public.estimates`** — simple customer proposals with public token accept flow (Approach A); distinct from bid **`cost_estimates`**
- **Changes**: `estimate_status` enum; `estimates` table (snapshots, token hash, acceptance audit); `user_can_access_estimate` / `superintendent_can_access_estimate`; RLS for staff; triggers for `updated_at` and post-accept immutability; draft-only updates from authenticated clients
- **Impact**: [`Estimates.tsx`](src/pages/Estimates.tsx), Edge [`get-estimate-for-customer`](supabase/functions/get-estimate-for-customer/index.ts), [`accept-estimate`](supabase/functions/accept-estimate/index.ts), [`send-estimate-to-customer`](supabase/functions/send-estimate-to-customer/index.ts)
- **Category**: Estimates / Edge

### July 2026

#### July 1, 2026

**`20260701000000_create_hours_reviewed.sql`**
- **Purpose**: Add `hours_reviewed` table for Pay tab "hours reviewed" workflow
- **Changes**: Create `hours_reviewed` (person_name, start_date, end_date, reviewed_by, reviewed_at); UNIQUE(person_name, start_date); RLS for dev, pay-approved masters, assistants
- **Impact**: Review Hours modal "Mark as reviewed" checkbox; Hours reviewed ledger on Pay tab
- **Category**: People / Pay

### April 2027

#### April 3, 2027

**`20270403101000_salary_sync_cleanup_when_no_template.sql`**
- **Purpose**: When **`salary_work_schedule_templates`** is absent for a user, delete **non-final** `clock_sessions` with **`origin = 'salary_schedule'`** for that `work_date` (same guard as PTO path)
- **Changes**: `CREATE OR REPLACE` **`salary_sync_one_user_clock_sessions`** — replace `IF NOT FOUND` early return with `DELETE` + `RETURN`; update `COMMENT`
- **Impact**: Removing salaried template / switching to hourly + `sync_salary_clock_sessions_for_user_day` clears orphan auto sessions for processed dates; dashboard strip + Pay People cleanup align with `people_pay_config.is_salary`
- **Category**: People / Hours / Dashboard

**`20270403170000_quickfill_layout_app_settings.sql`**
- **Purpose**: Default **`app_settings`** rows for Quickfill section visibility (**`quickfill_hidden_section_ids`** JSON array in **`value_text`**) and Jobs Billing **Min HCP** (**`quickfill_jobs_billing_min_hcp`** in **`value_num`**, default 406)
- **Changes**: `INSERT ... ON CONFLICT (key) DO NOTHING` only; existing **`app_settings`** RLS (authenticated read, dev write) unchanged
- **Impact**: `/quickfill` loads shared layout from the database; dev-only **Active sections** panel updates these keys (replaces per-browser `localStorage`)
- **Category**: Quickfill / Settings

**`20270403180000_salary_split_indexed_segments_overlap_sync_guard.sql`**
- **Purpose**: Correct **My Time / People Hours** behavior when splitting **indexed** `salary_schedule` rows (slots 1–2), and prevent **split-template** sync from INSERTing canonical rows on top of material time that already overlaps each template window
- **Changes**: `CREATE OR REPLACE` **`split_own_clock_session_segments`**, **`split_own_clock_session_cluster`**, **`leader_split_clock_session_segments`**, **`leader_split_clock_session_cluster`** — when parent is `salary_schedule` with **`salary_segment_index IS NOT NULL`**, new segments use **`origin = 'user_punch'`** and **`salary_segment_index NULL`**; continuous parent (`NULL` index) still materializes children as indexed **`salary_schedule`** when `N ≥ 2`; **`salary_sync_one_user_clock_sessions`** — before INSERT for split slot 1 or 2, **`NOT EXISTS`** overlap with any non-rejected/non-revoked session on that day for **`[t_start,t_end)`** and **`[t_start2,t_end2)`**; updated **`COMMENT`** on sync function
- **Impact**: No double **`salary_schedule`** row after splitting an auto segment; cron / per-user sync respects **`user_punch`** (and other) time that already fills the scheduled block
- **Docs**: [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md)
- **Category**: People / Hours / Dashboard

### March 2027

#### March 31, 2027

**`20270331150000_company_calendar_america_chicago.sql`**
- **Purpose**: Unify company calendar (`work_date` “today”, editable week gates, salary “today” RLS, template default timezone) on **America/Chicago**
- **Changes**: `UPDATE` salary templates/overrides from `America/Denver` → `America/Chicago`; `ALTER` default timezone; recreate salary day-override policies; `CREATE OR REPLACE` `salary_sync_one_user_clock_sessions`, `sync_salary_clock_sessions_for_day`, `split_own_clock_session_segments`, `split_own_clock_session_cluster`, `replace_own_clock_session_cluster_mixed`, `leader_split_clock_session_segments`, `leader_split_clock_session_cluster`, `leader_replace_clock_session_cluster_mixed` (`v_tz` + messages)
- **Impact**: Dashboard clock “today”, My Time week range (`dateUtils`), split/replace RPC week windows, Settings salary defaults, Edge `sync-salary-sessions` cron date
- **Category**: Platform / Hours / People

**`20270331160000_users_read_own_people_pay_config.sql`**
- **Purpose**: Allow any authenticated user to **SELECT** their own **`people_pay_config`** row for Settings **Salaried workday** (`SalaryWorkScheduleSettings` loads `is_salary` by `person_name` = `users.name`)
- **Changes**: `DROP POLICY IF EXISTS "Users can read own people pay config row"`; `CREATE POLICY` **FOR SELECT** `USING` (exists `users` row for `auth.uid()` with `btrim(name) = btrim(people_pay_config.person_name)`); `COMMENT ON POLICY`
- **Impact**: Superintendent, primary, estimator, subcontractor (and others not pay-master / assistant / cost-matrix-shared) who are salaried see the workday editor; still no INSERT/UPDATE on `people_pay_config` without pay access
- **Category**: People / RLS / Settings

**`20270331170000_user_time_off.sql`**
- **Purpose**: **`user_time_off`** — per-user time-off ranges (`start_date`/`end_date`, `kind`) for **Calendar** and salary sync
- **Changes**: Create table + index `(user_id, start_date, end_date)`; RLS SELECT (self, `salary_schedule_staff_or_self_target`, team lead), INSERT/UPDATE/DELETE self-only
- **Impact**: Settings **Unpaid time off**; `/calendar` chips when salaried; input for **`salary_sync_one_user_clock_sessions`** time-off skip. **`kind`** became **`unpaid` only** in **`20270331190000`**
- **Category**: People / Calendar / RLS

**`20270331180000_salary_sync_respect_user_time_off.sql`**
- **Purpose**: On company **`work_date`** covered by **`user_time_off`**, delete **non-final** `clock_sessions` with **`origin = 'salary_schedule'`** and skip opening new salary sessions
- **Changes**: `CREATE OR REPLACE` **`salary_sync_one_user_clock_sessions`** with early PTO check + `DELETE` guarded by `approved_at`/`rejected_at`/`revoked_at` null; re-comment + `REVOKE ALL` on function
- **Impact**: PTO days no longer show **On shift** from auto salary sessions after sync
- **Category**: People / Hours / Dashboard

**`20270331190000_user_time_off_unpaid_only.sql`**
- **Purpose**: **`user_time_off.kind`** is **`unpaid` only** (backfill + constraint + default)
- **Changes**: `UPDATE` legacy `kind` → `unpaid`; drop/recreate `user_time_off_kind_check` **CHECK (`kind = 'unpaid')`**; `ALTER COLUMN kind SET DEFAULT 'unpaid'`; column comment
- **Impact**: Settings UI and Calendar labels are unpaid-only; inserts must satisfy constraint
- **Category**: People / Calendar

**`20270331191000_salary_template_exclude_weekends.sql`**
- **Purpose**: Default **Mon–Fri** salary materialization: skip **Sat–Sun** unless a **meaningful** `salary_work_schedule_day_overrides` row exists for that `work_date`
- **Changes**: `salary_work_schedule_templates.exclude_weekends` (NOT NULL DEFAULT true); `CREATE OR REPLACE` **`salary_sync_one_user_clock_sessions`** — after PTO and template load, if `exclude_weekends` and ISO weekend and not meaningful override, `DELETE` non-final `salary_schedule` rows for that day and `RETURN`
- **Impact**: Settings **Weekdays only** checkbox; Calendar **`resolveCalendarWorkday`** matches sync; optional weekend work via **Custom schedule for this date**
- **Category**: People / Hours / Calendar

**`20270331193000_writeups_templates_and_submissions.sql`**
- **Purpose**: **Writeups** — HR-style forms on People (**Writeups** tab; `writeup_templates`, `writeups`, enum **`writeup_disclosure`**)
- **Changes**: Create **`writeup_disclosure`**, **`writeup_templates`** (`schema` JSONB blocks), **`writeups`** (subject/filled_by FK to **`users`**, draft vs submitted, **`answers` JSONB**); RLS staff bundle matching contracts; submitted rows not updatable (draft UPDATE only); draft DELETE for staff, submitted DELETE for dev
- **Impact**: People **Writeups** tab; template builder + list/filter by subject; **Discussed with subject** / **Withheld from subject** on submit
- **Category**: People / RLS

**`20270402100000_salary_sync_continuous_skip_insert_when_split_segments_exist.sql`**
- **Purpose**: Avoid a **second** auto **`salary_schedule`** row at **`t_start`** after a **continuous** session was **split** into rows with **`salary_segment_index` 1..N** (no **`NULL`** index row remains for sync to find)
- **Changes**: **`salary_sync_one_user_clock_sessions`** — in **`v_mode = 'continuous'`**, when no pending **`salary_segment_index IS NULL`** row exists, **skip** INSERTs if **`EXISTS`** pending **`salary_schedule`** rows with **non-null** **`salary_segment_index`** (same non-final guards as elsewhere); updated function **`COMMENT`** + **`REVOKE ALL`**
- **Impact**: **`sync_salary_clock_sessions_for_user_day`**, cron **`sync-salary-sessions`**, and client **`syncSalaryClockSessionsForUserDay`** no longer recreate a duplicate overlapping session after split + sync
- **History hygiene**: Three mistaken **empty** files (`20260403062347`, `20260403062432`, `20260403062639`, duplicate slug) were removed from the repo and those version rows **reverted** on the linked DB via **`supabase migration repair --status reverted`**. This file is the single canonical migration for the behavior above.
- **Category**: People / Hours / Dashboard

**`20270331140000_salary_schedule_and_clock_origin.sql`**
- **Purpose**: Salaried 8h schedule templates, optional day overrides, `clock_sessions.origin` / `salary_segment_index`, and sync RPCs for auto open/close salary sessions
- **Changes**: Tables `salary_work_schedule_templates`, `salary_work_schedule_day_overrides`; unique partial indexes on salary sessions; restrict client INSERT to `user_punch`; `sync_salary_clock_sessions_for_day` (service_role), `sync_salary_clock_sessions_for_user_day` (authenticated); internal `salary_sync_one_user_clock_sessions`
- **Impact**: Settings Salaried workday; Edge Function `sync-salary-sessions`; Dashboard On shift / Off shift
- **Category**: People / Hours / Dashboard

#### March 24, 2027

**`20270324120000_add_last_report_at_to_list_assigned_jobs.sql`**
- **Purpose**: Add last report timestamp to subcontractor Assigned Jobs Dashboard cards
- **Changes**: DROP and recreate `list_assigned_jobs_for_dashboard()`; add `last_report_at TIMESTAMPTZ` to return type (subquery: `MAX(reports.created_at)` for job)
- **Impact**: Subcontractor Dashboard Assigned Jobs cards show "Open X" (time since last report) for "time since last report" display
- **Category**: Dashboard / Reports

#### March 27, 2027

**`20270327120000_user_app_activity_viewers.sql`**
- **Purpose**: Allow dev to grant assistant / master_technician / primary org-wide read on `user_app_activity_daily`
- **Changes**: Create `user_app_activity_viewers` with RLS; trigger restricts `viewer_user_id` to eligible roles; replace `user_app_activity_daily` SELECT policy to include allowlist
- **Impact**: People → Activity tab; dev grant/revoke UI
- **Category**: People / RLS

**`20270327130000_people_labels.sql`**
- **Purpose**: Normalized per-master roster labels and `people_labels` junction (e.g. peer review cohorts); FK integrity trigger
- **Changes**: Create `labels` (`master_user_id`, `name`, `slug`, UNIQUE `(master_user_id, slug)`); `people_labels` (`person_id`, `label_id`); `enforce_people_labels_same_master` BEFORE INSERT/UPDATE trigger; helper functions `user_can_read_labels_for_master`, `user_can_write_labels_for_master`; RLS for `authenticated` (read scope mirrors roster + superintendent adoption; write: dev, owning master, assistant); indexes on `label_id` / `person_id`
- **Impact**: `src/lib/labels.ts` helpers; optional UI to assign labels / filter peers later
- **Category**: People / RLS

**`20270327140000_user_labels.sql`**
- **Purpose**: Assign the same master-scoped `labels` catalog to login users without a `people` row (account-only users)
- **Changes**: Create `user_labels` (`user_id`, `label_id`); `enforce_user_labels_scope_master` BEFORE INSERT/UPDATE trigger (tagged user must be in scope for `labels.master_user_id`: self master/dev, `master_assistants`, `master_superintendents`, or `people` email match); RLS aligned with `people_labels` (join + `user_can_write_labels_for_master`)
- **Impact**: People → Users dev tag UI uses `people_labels` when a roster row exists, else `user_labels`; `setUserLabels` / `fetchUserLabelsForUserIds` in `src/lib/labels.ts`
- **Category**: People / RLS

**`20270328120000_user_tag_org.sql`**
- **Purpose**: Explicit per-login-user tag catalog org (`user_id` → `master_user_id`) for People → Users tags; read-only hints (adoption, jobs) stay in app code
- **Changes**: Create `user_tag_org` (`set_by`, `updated_at`, trigger); RLS dev read/write all, authenticated **SELECT** own row; **REPLACE** `enforce_user_labels_scope_master` to allow inserts when `user_tag_org` matches label master
- **Impact**: `src/lib/tagOrg.ts`; People → Users (dev) Tag org dropdown, signals, Clear override
- **Category**: People / RLS

#### March 29, 2027

**`20270329120000_list_feedback_peer_candidates_shared_labels_final.sql`**
- **Purpose**: Authoritative **`list_feedback_peer_candidates`** implementation: peers sharing at least one **`label_id`** with the reviewer (`user_labels` for reviewer; peers via `user_labels` or `people_labels`). Supersedes roster-based definitions from **`20260628141000`**–**`20260628141700`** on databases that applied those migrations.
- **Changes**: `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE` with `shared_tag_count`, `UNION ALL`, order and cap 5000; `COMMENT`; `GRANT EXECUTE` to `authenticated`
- **Impact**: Team Feedback peer picker (Settings preview and in-app wizard) uses label intersection only, not master roster union
- **Category**: Team Feedback / RPC

**`20270329140000_team_feedback_submissions_select_own.sql`**
- **Purpose**: Allow submitters to **read their own** `team_feedback_submissions` row after INSERT (PostgREST `insert().select('id')` requires SELECT on returned rows).
- **Changes**: `CREATE POLICY "team_feedback_submissions_select_own"` on `public.team_feedback_submissions` FOR SELECT TO `authenticated` USING (`reviewer_user_id = auth.uid()`). Complements existing dev-only SELECT-all policy.
- **Impact**: Non-dev users can complete team feedback submit flow without **403** on the returning read; dev reporting unchanged
- **Category**: Team Feedback / RLS

**`20270329150000_pay_stub_additional_lines.sql`**
- **Purpose**: **Additional** pay on a stub (quantity × rate per line); **Net Pay** = `gross_pay` − sum(`pay_stub_deductions`) + sum(generated `line_total`); installments stay capped at Net Pay.
- **Changes**: Create `pay_stub_additional_lines` (`line_total` generated as `round(quantity * rate, 2)` STORED); RLS same pattern as `pay_stub_deductions`; replace `validate_pay_stub_payments_vs_net` and `pay_stub_payments_enforce_total_fn` to add additional sum; AFTER trigger on additional lines mirroring deductions validation; update `pay_stub_payments` table comment.
- **Impact**: Pay History **Additional** column + modal; Less modal receives **additionalSum** for net; print order Additional → Less → Net Pay
- **Category**: People / Pay Stubs

**`20270329180000_housing_units_and_possessions.sql`**
- **Purpose**: Company housing units and dated user assignments (mirror **vehicles** / **vehicle_possessions**)
- **Changes**: Create `housing_units` (address, rent/utilities/insurance per week); `housing_possessions` (`housing_id`, `user_id`, `start_date`, `end_date` nullable); RLS aligned with vehicles (dev, pay-approved master, assistant-of, assistant)
- **Impact**: People → **Housing** tab; pay report HTML **Housing** block after vehicles when possession overlaps stub period
- **Category**: People / RLS

**`20270329190000_replace_own_clock_session_cluster_mixed.sql`**
- **Purpose**: Dashboard **My Time** editor: replace **N** time-contiguous sessions (mixed **job_ledger_id** / **bid_id**) with **M** segments in one transaction; optional **`job_ledger_id`** / **`bid_id`** per JSON segment (omit or null = no link)
- **Changes**: `CREATE OR REPLACE FUNCTION public.replace_own_clock_session_cluster_mixed(p_session_ids uuid[], p_segments jsonb)`; same auth/week/reject/revoke/approved rollback/DELETE/INSERT/lat-lng pattern as `split_own_clock_session_cluster`, but **no** same-job requirement between rows; **≥ 1** segment (supports merge-to-one-row); **GRANT EXECUTE** to `authenticated`
- **Impact**: `replaceOwnClockSessionClusterMixed` in `src/lib/splitOwnClockSessionSegments.ts`; heterogeneous strips and uncut multi-row time reshapes
- **Category**: Clock / RPC / Dashboard

**`20270329210000_workflow_step_line_items_item_date.sql`**
- **Purpose**: Optional user-entered date on workflow step line items
- **Changes**: `ALTER TABLE public.workflow_step_line_items ADD COLUMN item_date date NULL`; column comment
- **Impact**: Workflow Add/Edit Line Item date field; Line Items For Office Date column; clipboard bulk import sets `item_date` per row
- **Category**: Workflow

### March 2026

#### March 20, 2026

**`20260320120000_add_bid_number_to_bids.sql`**
- **Purpose**: Add short identifier for bids (like HCP for jobs)
- **Changes**: Add `bid_number TEXT DEFAULT ''` to `bids`; index `idx_bids_bid_number`
- **Impact**: Bids page form/list; search_bids_for_clock; clock session displays
- **Category**: Bids

**`20260320120001_search_bids_for_clock_add_bid_number.sql`**
- **Purpose**: Include bid_number in search and return
- **Changes**: Add `bid_number` to `search_bids_for_clock` SELECT and WHERE (ILIKE search)
- **Impact**: Clock In/Update Focus unified search; bid results show B456 format
- **Category**: Bids / Clock Sessions

**`20260320120002_bid_number_auto_generate.sql`**
- **Purpose**: Auto-generate bid_number for new bids; backfill existing
- **Changes**: Create `bids_bid_number_seq`; backfill bids by created_at (oldest first); `set_bid_number_if_empty` BEFORE INSERT trigger
- **Impact**: New bids get next number; Bid # read-only in UI when creating
- **Category**: Bids

**`20260320120004_prevent_estimator_primary_edit_bid_number.sql`**
- **Purpose**: Restrict Bid # editing to dev, master_technician, assistant
- **Changes**: `prevent_bid_number_update_by_estimator_primary` BEFORE UPDATE trigger
- **Impact**: Estimator and primary cannot change bid_number; UI shows read-only for them
- **Category**: Bids / Access Control

**`20260320130000_clock_sessions_pay_insert.sql`**
- **Purpose**: Pay-access can INSERT clock sessions (for split session in People Hours)
- **Changes**: Add RLS policy "Pay access can insert clock sessions" on `clock_sessions` FOR INSERT WITH CHECK (is_pay_approved_master OR is_assistant_of_pay_approved_master OR is_assistant)
- **Impact**: People Hours Edit modal can split sessions by creating two new sessions
- **Category**: Hours / Clock Sessions / RLS

**`20260320140000_add_project_id_to_jobs_ledger.sql`**
- **Purpose**: Link Jobs (billing) to Projects (multi-phase work)
- **Changes**: Add `project_id` (nullable FK → projects, ON DELETE SET NULL) to `jobs_ledger`; trigger `jobs_ledger_project_master_match` (job owner must match project owner when linked); RLS updates for superintendent project-level access; reports policy and `list_reports_with_job_info` for jobs with project_id
- **Impact**: Jobs can optionally belong to a project; Jobs page project selector; Projects page shows linked jobs and "Create Job"; superintendents with project assignment see linked jobs
- **Category**: Jobs / Projects / RLS

#### March 21, 2026

**`20260321120000_create_person_licenses.sql`**
- **Purpose**: Licenses per person (plumber, journeyman, etc.)
- **Changes**: Create `person_licenses` (person_name, license_type, note, date_of_expiry); indexes on person_name and date_of_expiry; RLS same as pay_stubs
- **Impact**: People Licenses tab; expiring-in-30-days section; person-centric expandable table with Add/Edit/Delete
- **Category**: People / Licenses

**`20260321130000_add_cost_to_company_to_person_licenses.sql`**
- **Purpose**: Add optional cost-to-company dollar amount per license (e.g. renewal fee)
- **Changes**: Add `cost_to_company NUMERIC(10, 2) DEFAULT NULL` to `person_licenses`
- **Impact**: People Licenses tab shows Cost to Company column; Add/Edit license modal has Cost to Company ($) input
- **Category**: People / Licenses

**`20260321140000_create_person_license_cost_lines.sql`**
- **Purpose**: Replace single cost_to_company with multiple cost lines per license (amount, note, date)
- **Changes**: Create `person_license_cost_lines` (person_license_id, amount, note, date); RLS same as person_licenses
- **Impact**: Licenses tab Cost to Company column shows sum of cost lines; inline sub-rows for Add/Edit/Delete cost lines
- **Category**: People / Licenses

**`20260321150000_migrate_cost_to_company_to_lines.sql`**
- **Purpose**: Migrate existing cost_to_company to cost lines, drop column
- **Changes**: INSERT one cost line per license where cost_to_company IS NOT NULL; DROP COLUMN cost_to_company
- **Impact**: Existing cost data preserved in person_license_cost_lines
- **Category**: People / Licenses

**`20260321120000_add_supply_house_invoice_to_line_items.sql`**
- **Purpose**: Link workflow step line items to supply house invoices
- **Changes**: Add `supply_house_invoice_id` (uuid, nullable, FK → supply_house_invoices.id ON DELETE SET NULL) to `workflow_step_line_items`; index on supply_house_invoice_id
- **Impact**: Workflow Add Supply House Invoice modal; View Invoice button on linked line items
- **Category**: Workflow / Materials

#### March 24, 2026

**`20260324120000_add_customer_contacts_contact_method.sql`**
- **Purpose**: Optional contact channel on general customer outreach rows (Builder Review / Bid Board customer notes UX parity with bid submission entries)
- **Changes**: `ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS contact_method text` (nullable); comment on column
- **Impact**: `CustomerNotesTable` and unified **All notes** on Bid Board can store/display/edit contact method; no new RLS (existing table policies cover the column)
- **Category**: Bids / Customers

#### March 26, 2026

**`20260326120000_estimator_prospects_access.sql`**
- **Purpose**: Estimator Prospects CRM access flag, helper, and RLS alignment with dev/master/assistant
- **Changes**: `users.estimator_prospects_access`; `user_has_prospects_staff_access()`; prospects-related policy updates
- **Impact**: Estimators with flag can use Prospects stack per ACCESS_CONTROL
- **Category**: People / RLS / Access Control

**`20260326120100_jobs_ledger_invoices_billed_at.sql`**
- **Purpose**: Track when jobs ledger invoices become billed (`billed_at`) for aging UI
- **Changes**: Column + trigger `jobs_ledger_invoices_billed_at_fn` / `jobs_ledger_invoices_billed_at_tr`
- **Impact**: Invoice rows record/clear `billed_at` with status transitions
- **Category**: Jobs / Schema

**`20260326120200_list_feedback_peer_candidates_shared_tag_count.sql`**
- **Purpose**: Team Feedback peer RPC — `shared_tag_count` and ordering by shared labels
- **Changes**: `CREATE OR REPLACE` `list_feedback_peer_candidates()` (label intersection / cap)
- **Impact**: Peer picker sorts by shared tags
- **Category**: Team Feedback / RPC

**`20260326120300_restrict_people_insert_dev_master_assistant.sql`**
- **Purpose**: Enforce ACCESS_CONTROL — only dev, master_technician, and assistant can INSERT into `people` (not estimator, primary, etc.)
- **Changes**: Replace `Users can insert own people` WITH CHECK: `master_user_id = auth.uid()` AND (`is_dev()` OR role in master_technician, assistant)
- **Impact**: RLS blocks roster inserts for estimators; People page hides Add + client guard for same roles
- **Category**: People / RLS / Access Control

**`20260326140000_user_dashboard_preferences.sql`**
- **Purpose**: Per-user choice to show dashboard quick-action buttons at the top vs inline with pinned tabs
- **Changes**: Create `user_dashboard_preferences` (`user_id` PK, `quick_buttons_placement` `top` | `with_pins`); RLS own row only; add to `supabase_realtime` publication
- **Impact**: Settings → Dashboard buttons placement; Dashboard layout
- **Category**: Dashboard / Schema

#### March 28, 2026

**`20260328220000_split_own_allow_previous_week.sql`**
- **Purpose**: Dashboard My Time day editor — allow splitting own clock sessions for **last week** as well as the current week
- **Changes**: `CREATE OR REPLACE` `split_own_clock_session_segments`; week gate allows `work_date` in current **or** previous America/Denver Sunday–Saturday week; updated error message and function `COMMENT`
- **Impact**: `splitOwnClockSessionSegments` RPC succeeds for sessions whose `work_date` is in the prior calendar week (Denver)
- **Note (product)**: Historical migrations and RPC week gates still apply wherever those code paths are used; the **Dashboard My Time** UI now only opens **Edit time** for the **current** Denver week (`getDefaultWeekRange()`). Last week on the dashboard is display-only there.
- **Category**: Hours / Clock Sessions / RPC

**`20260328230000_split_own_clock_session_cluster.sql`**
- **Purpose**: My Time editor — replace **several** contiguous same-job/bid sessions with N segment rows in one transaction (one vertical bar UX)
- **Changes**: Create `split_own_clock_session_cluster(p_session_ids uuid[], p_segments jsonb)`; validates order, contiguity, ownership, week gate; approved rollback per removed row; delete all ids; insert segments
- **Impact**: `splitOwnClockSessionCluster` client helper; merged clock clusters can save without orphan overlapping rows
- **Category**: Hours / Clock Sessions / RPC

#### March 29, 2026

**`20260329120000_user_dashboard_goals_and_ack.sql`**
- **Purpose**: Per-user daily goal lines (managed by dev/master/assistant) and per-calendar-day acknowledgment after the “My Roles Goals” gate
- **Changes**: Create `user_dashboard_goals` (`user_id`, `body`, `sort_order`, …); create `user_daily_goals_ack` (`user_id`, `local_date` PK, `completed_at`); RLS — goals SELECT own; dev/master/assistant ALL on goals; ack ALL own rows only
- **Impact**: Settings → per-user goals editor; full-screen overlay after first clock-in of the day when goals exist; Continue writes ack for that calendar day
- **Category**: Dashboard / Schema

**`20260329042321_add_primary_superintendent_to_people_kind.sql`**
- **Purpose**: First-class **Primary** and **Superintendent** rows on `public.people` (same roster/pay pattern as other kinds)
- **Changes**: Extend `people_kind_check` with `primary`, `superintendent`; index `(master_user_id, kind)`; idempotent backfill from `master_primaries` / `master_superintendents` joined to `users` (role match; skip duplicates by master + email/name)
- **Impact**: People → Users: Primaries/Superintendents use `byKind` + Add/Edit/Archive; `allRosterNames` / Pay config / Hours; Jobs and Quickfill roster helpers; Settings dev people table kind labels
- **Category**: People / Schema

#### March 30, 2026

**`20260330021739_jobs_ledger_thread_notes.sql`**
- **Purpose**: Append-only **thread notes** on jobs (`jobs_ledger`), similar to Dashboard Dispatch `dispatch_request_notes`
- **Changes**: Create `jobs_ledger_thread_notes` (`job_id` → `jobs_ledger` ON DELETE CASCADE, `author_user_id` → `users`, `body` 1–2000 chars, `created_at`); index `(job_id, created_at)`; RLS **SELECT** / **INSERT** predicates align with `job_status_events` (same `jobs_ledger` visibility path); `jobs_ledger_thread_note_stats(p_job_ids uuid[])` RPC; add table to `supabase_realtime` publication when missing
- **Impact**: Jobs **Stages** tables: expand column for thread (Central Time display, composer); Workflow linked-job chips: chevron + panel; `useJobThreadNotes` hook
- **Category**: Jobs / Schema / RPC / Realtime

**`20260330023918_extend_thread_note_stats_drop_stage_notes.sql`**
- **Purpose**: Stages **last activity** column reads latest thread preview; remove legacy `stage_notes`
- **Changes**: Backfill `jobs_ledger_thread_notes` from non-empty `jobs_ledger.stage_notes` (author `master_user_id`, skip jobs that already have thread rows); **`DROP FUNCTION`** `jobs_ledger_thread_note_stats(uuid[])` then **`CREATE FUNCTION`** (return type adds `last_note_body`, `last_note_author_name`; `GRANT EXECUTE` to `authenticated`); `ALTER TABLE jobs_ledger DROP COLUMN stage_notes`
- **Impact**: Jobs Stages replaces Stage Notes textarea with read-only latest thread line; RPC drives preview + badges
- **Category**: Jobs / Schema / RPC

**`20260330045018_stripe_jobs_billing_invoice_columns.sql`**
- **Purpose**: Stripe invoices + **record external send** metadata on ledger invoices; webhook-safe mark paid
- **Changes**: **`customers.stripe_customer_id`** (partial unique); **`jobs_ledger_invoices`**: **`stripe_invoice_id`**, **`stripe_invoice_status`**, **`hosted_invoice_url`**, **`external_send_channel`** (CHECK: `housecallpro` \| `physical` \| `stripe_manual`), **`external_send_note`**, **`sent_to_customer_at`** (partial unique on **`stripe_invoice_id`**); **`mark_invoice_paid_from_stripe(p_invoice_id)`** (**SECURITY DEFINER**, same payment/ledger effect as **`mark_invoice_paid`**; **`REVOKE ALL`** from **`PUBLIC`**, **`GRANT EXECUTE`** to **`service_role`** only)
- **Impact**: **Invoice / Update** UI; Edge Functions **`create-stripe-invoice`**, **`stripe-webhook`**
- **Category**: Jobs / Billing / Integrations

**`20260330055116_add_jobs_ledger_invoices_primary_rtb_bundle.sql`**
- **Purpose**: Mark the ensure/Stripe **full-balance** **`ready_to_bill`** line so Stages and Dashboard can show **one** row with the parent job
- **Changes**: **`jobs_ledger_invoices.is_primary_rtb_bundle`** NOT NULL DEFAULT false; partial **unique** index on **`job_id`** WHERE **`status = 'ready_to_bill'`** AND flag true; **`CREATE OR REPLACE`** **`ensure_single_ready_to_bill_invoice_for_job`** sets the flag on **INSERT** and on amount-sync **UPDATE** (Stripe-finalized rows unchanged)
- **Impact**: **`buildReadyToBillStageRows`** / **`buildReadyToBillDashboardUnits`**; manual partial inserts stay **`false`**
- **Category**: Jobs / Billing / UX

**`20260330065236_add_customer_id_to_get_jobs_ledger_by_status.sql`**
- **Purpose**: Dashboard **Ready to Bill** job cards can gate **Invoice / Update** without a second fetch
- **Changes**: **`DROP FUNCTION`** **`get_jobs_ledger_by_status(text)`** then **`CREATE`** with **`customer_id uuid`** in **`RETURNS TABLE`** and **`SELECT`** (Postgres cannot change return row type with **`CREATE OR REPLACE`**)
- **Impact**: **`JobForDashboard`** + billing customer guard on Dashboard; **`npm run gen-types:linked`** after apply
- **Category**: Jobs / Dashboard / RPC

**`20260330150000_team_leader_assignments.sql`**
- **Purpose**: Team leader assignments (leader → member) and scoped access to member clock sessions / crew sync tables
- **Changes**: Create `team_leader_assignments` (unique leader/member pair, no self-pair); helpers `is_team_lead_for_member`, `is_team_lead_for_person_name`, `can_manage_team_leader_assignments`; RLS on assignments; extend `clock_sessions`, `people_hours`, `people_crew_jobs`, `people_crew_bids` policies for team-lead paths; publish `team_leader_assignments` to `supabase_realtime` when missing
- **Impact**: Settings → Team Hours Sharing; Dashboard → My Team pending sessions for leaders; team leads without pay access can approve/reject member sessions
- **Category**: Hours / Clock Sessions / RLS

**`20260330160000_team_leader_approve_revoke_rpcs.sql`**
- **Purpose**: Allow `approve_clock_sessions` and `revoke_clock_sessions` for non–pay-access users when they are the team lead for the session’s user
- **Changes**: `CREATE OR REPLACE` both RPCs; per pending session, non–pay callers require `is_team_lead_for_member(auth.uid(), session.user_id)` (fail with access error if not)
- **Impact**: My Team approve/reject/revoke works for leaders who are not Pay Approved masters
- **Category**: Hours / RPCs

**`20260330170000_team_leader_clock_notify_prefs.sql`**
- **Purpose**: Child table for leader-only opt-in to receive notifications when an assigned member clocks in or out
- **Changes**: Create `team_leader_clock_notify_prefs` (`team_leader_assignment_id` UNIQUE FK → `team_leader_assignments`, `notify_enabled`, `updated_at`); RLS — SELECT/INSERT/UPDATE/DELETE when the user is the assignment’s leader or `can_manage_team_leader_assignments()`
- **Impact**: Dashboard My Team → per-member notify toggle; Edge Function `notify-team-lead-clock` (Database Webhook on `clock_sessions`)
- **Category**: Hours / Clock Sessions / RLS

#### March 27, 2026

**`20260327120000_dispatch_group_members_allow_estimator.sql`**
- **Purpose**: Task Dispatch group membership may include estimators as well as assistants (inbox + push notifications)
- **Changes**: `CREATE OR REPLACE` trigger function `dispatch_group_members_enforce_assistant` — allow `users.role` in `assistant`, `estimator`; update table/function comments
- **Impact**: Settings → Task Dispatch group can add estimators; Dashboard dispatch inbox eligibility for estimators in group; header Task Dispatch / Task buttons for estimators are client-side (`Layout.tsx`)
- **Category**: Task Dispatch / RLS / Access Control

**`20260327201115_bid_date_sent_attestation.sql`**
- **Purpose**: Persist mandatory **Bid Date Sent** attestation (modal checkboxes) on `bids`
- **Changes**: Add nullable `bid_date_sent_attested_at`, `bid_date_sent_attested_by`, and `bid_date_sent_ack_{email,phone,honesty}_{at,by}` with FK → `public.users(id)` ON DELETE SET NULL
- **Impact**: New/Edit Bid: changing **Bid Date Sent** opens attestation; save writes columns; clearing sent date clears attestations; UI shows days since sent and acknowledger
- **Category**: Bids / Schema

**`20260327220610_dispatch_request_notes.sql`**
- **Purpose**: Thread notes on Task Dispatch inbox items (Dashboard expand row)
- **Changes**: Create `dispatch_request_notes` (`request_id` FK → `dispatch_requests` ON DELETE CASCADE, `author_user_id` FK → `users`, `body`, `created_at`); index `(request_id, created_at)`; RLS SELECT same visibility as parent `dispatch_requests`; INSERT only when `author_user_id = auth.uid()` and user is dev or dispatch group member
- **Impact**: Dashboard Dispatch inbox: expand task for activity thread (preset notes, Central Time + days ago); **Marked closed** block last from `dispatch_requests` close fields; realtime refresh when notes insert (if replication enabled)
- **Category**: Task Dispatch / Schema

**`20260327225624_dispatch_inbox_note_stats_rpc.sql`**
- **Purpose**: RPC for dispatch inbox cards (note count / last activity per request)
- **Changes**: `dispatch_inbox_note_stats(p_request_ids uuid[])` — aggregates `dispatch_request_notes`; `GRANT EXECUTE` to `authenticated`
- **Impact**: Dashboard dispatch inbox can show thread stats on cards without N+1
- **Category**: Task Dispatch / RPC

**`20260327230557_team_leader_assignment_dashboard_visibility.sql`**
- **Purpose**: Per leader→member link, control whether the leader sees full **My Team** on Dashboard or **Currently clocked in** strip only
- **Changes**: Add `team_leader_assignments.dashboard_hours_visibility` (`'full'` | `'strip_only'`, default `'full'`); trigger `team_leader_assignments_dashboard_visibility_dev_only_trg` + function `team_leader_assignments_dashboard_visibility_dev_only()` — only `is_dev()` may change the column
- **Impact**: Settings → Team Hours Sharing → **Leader dashboard** (dev edits); hook/UI omit strip-only members from detailed My Team and pending banner counts; strip unchanged
- **Category**: Hours / Dashboard / RLS

### June 2026

#### June 21, 2026

**`20260621120000_dispatch_request_dismissals.sql`**
- **Purpose**: Per-user dismissals of closed dispatch requests
- **Changes**: Create `dispatch_request_dismissals` (user_id, request_id PK, dismissed_at); RLS SELECT/INSERT own rows; when dismissed, closed request hidden from that user's inbox
- **Impact**: Dispatch inbox: users can dismiss closed requests; other users still see until they dismiss
- **Category**: Task Dispatch / Schema

#### June 22, 2026

**`20260622120000_add_dispatch_closed_note.sql`**
- **Purpose**: Closed note when marking dispatch request closed
- **Changes**: Add `closed_note` (text, nullable) to `dispatch_requests`; required when closing (enforced in app)
- **Impact**: Closing a dispatch request requires user to enter a note
- **Category**: Task Dispatch / Schema

#### June 23, 2026

**`20260623190000_revoke_superintendent_jobs_billing.sql`**
- **Purpose**: Revoke superintendent access to Jobs billing data (jobs_ledger and child tables)
- **Changes**: Drop policies that included `superintendent` and `can_access_project_row`; recreate policies without them on jobs_ledger, jobs_ledger_materials, jobs_ledger_invoices, jobs_ledger_payments, jobs_ledger_fixtures, jobs_ledger_team_members, jobs_tally_parts, job_status_events
- **Impact**: Superintendents can no longer read or modify Jobs Billing tab data; correct ledger is Workflow Line Items For Office. Reports and list_reports_with_job_info unchanged.
- **Category**: Access control / Jobs / RLS

#### June 24, 2026

**`20260624000000_allow_superintendent_send_to_billing.sql`**
- **Purpose**: Allow superintendents to mark jobs Ready for Billing when job is in a project they supervise
- **Changes**: Extend `update_job_status` for `working -> ready_to_bill`: add branch allowing superintendents when job belongs to a project they are assigned to via `project_superintendents` or `master_superintendents`
- **Impact**: Dashboard Superintendent Jobs "Send to Billing" button works for superintendents; job moves to Ready to Bill
- **Category**: Jobs / Access Control

**`20260624000100_fix_cost_estimates_rls_use_helper.sql`**
- **Purpose**: Fix assistants failing to create cost estimates (RLS policy violation)
- **Changes**: Replace inline bid/users subqueries with `can_access_bid_for_pricing(bid_id)` on cost_estimates and cost_estimate_labor_rows (4 policies each)
- **Impact**: Assistants, primaries, superintendents can create and manage cost estimates without RLS recursion; aligns with bid_pricing_assignments pattern
- **Category**: Bids / RLS

**`20260624120000_cost_estimates_rls_drop_users_subquery.sql`**
- **Purpose**: Fix devs/assistants still hitting RLS when adding Bids Counts rows
- **Changes**: Remove redundant `EXISTS (SELECT 1 FROM users ...)` from cost_estimates and cost_estimate_labor_rows policies; use only `can_access_bid_for_pricing` (SECURITY DEFINER)
- **Impact**: Policies no longer fail due to users table RLS; `can_access_bid_for_pricing` already validates role internally
- **Category**: Bids / RLS

#### June 25, 2026

**Root cause**: Postgres truncates policy names to 63 characters. Long descriptive names collided or caused policies to be dropped; only `can_access_bid_for_pricing` used in recreated policies.

**`20260625120000_debug_cost_estimate_check_rpc.sql`**
- **Purpose**: Debug RPC for cost_estimate RLS diagnostics
- **Changes**: Create `debug_cost_estimate_check(p_bid_id)` — returns can_access, auth_id, user_role, bid_exists
- **Impact**: Dev diagnostics; safe to leave in prod
- **Category**: Bids / Debug

**`20260625130000_debug_cost_estimate_policies_rpc.sql`**
- **Purpose**: Debug RPC listing cost_estimates policies
- **Changes**: Create `debug_cost_estimate_policies()` — returns policyname, cmd, qual, with_check from pg_policies
- **Impact**: Dev diagnostics
- **Category**: Bids / Debug

**`20260625140000_cost_estimates_rls_recreate_all.sql`**
- **Purpose**: Recreate cost_estimates RLS with short names to avoid 63-char truncation collisions
- **Changes**: Drop all policies via pg_policies loop; recreate ce_select, ce_insert, ce_update, ce_delete using `can_access_bid_for_pricing`
- **Impact**: Fixes "new row violates row-level security policy" when only DELETE policy remained
- **Category**: Bids / RLS

**`20260625150000_cost_estimate_labor_rows_rls_recreate_all.sql`**
- **Purpose**: Same as above for cost_estimate_labor_rows
- **Changes**: Drop all policies; recreate celr_select, celr_insert, celr_update, celr_delete
- **Impact**: Bids Counts and Pricing tabs work for dev, assistant, estimator, primary
- **Category**: Bids / RLS

**`20260625160000_bid_pricing_assignments_rls_recreate_all.sql`**
- **Purpose**: Same as above for bid_pricing_assignments
- **Changes**: Drop all policies; recreate bpa_select, bpa_insert, bpa_update, bpa_delete
- **Impact**: Bids Pricing tab assignments work correctly
- **Category**: Bids / RLS

#### June 27, 2026

**`20260627120000_restore_rejected_clock_sessions.sql`**
- **Purpose**: Return rejected clock sessions to Pending (clear `rejected_at` / `rejected_by`)
- **Changes**: RLS `SELECT`/`UPDATE` for `is_dev()` on `clock_sessions`; `restore_rejected_clock_sessions(p_session_ids)` — pay/assistant, dev, or team lead for member; `GRANT EXECUTE` to `authenticated`
- **Impact**: People → Hours rejected section can “Return to pending”; dev dashboard org-wide tooling can update sessions via RPC
- **Category**: Hours / Clock Sessions / RLS

### May 2026

#### May 20, 2026 — Superintendent role

**`20260520120000_add_user_role_superintendent.sql`**
- **Purpose**: Add superintendent to user_role enum
- **Changes**: `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superintendent'`
- **Impact**: create-user Edge Function can create superintendent users
- **Category**: Access control / Roles

**`20260520120001_create_master_superintendents.sql`**
- **Purpose**: Adoption table for superintendents (masters adopt superintendents)
- **Changes**: Create `master_superintendents(master_id, superintendent_id)` with FKs to users; RLS for devs/masters to manage, superintendents to read who adopted them
- **Impact**: Superintendents get adoption-based access to projects, workflows, jobs, bids
- **Category**: Access control / Adoption

**`20260520120002_add_superintendent_service_type_ids.sql`**
- **Purpose**: Service type filtering for superintendents (like primary_service_type_ids)
- **Changes**: Add `superintendent_service_type_ids UUID[]` to users
- **Impact**: Devs can restrict superintendents to specific service types in Bids and Materials
- **Category**: Access control / Roles

**`20260520120003_superintendent_project_and_adoption_access.sql`**
- **Purpose**: Projects and adoption helpers for superintendent
- **Changes**: Update `can_access_project_row` and `master_adopted_current_user` to include master_superintendents
- **Impact**: Superintendents can access projects/workflows from adopted masters
- **Category**: Access control / RLS

**`20260520120004_workflow_rls_superintendent.sql`**
- **Purpose**: Workflow RLS for superintendent
- **Changes**: Add superintendent to project_workflow_steps and workflow_step_line_items policies
- **Impact**: Superintendents see stages and line items in accessible workflows
- **Category**: Access control / Workflow

**`20260520120005_superintendent_jobs_and_reports_rls.sql`**
- **Purpose**: Jobs and reports RLS for superintendent
- **Changes**: Add superintendent to list_reports_with_job_info, reports, jobs_ledger, jobs_ledger_materials, jobs_ledger_invoices, jobs_ledger_payments, jobs_tally_parts, jobs_ledger_team_members, job_status_events
- **Impact**: Superintendents access Reports, Stages, Billing, Sub Sheet Ledger tabs
- **Category**: Access control / Jobs / Reports

**`20260520120006_superintendent_people_rls.sql`**
- **Purpose**: People RLS for superintendent (Workflow roster only)
- **Changes**: Superintendent can SELECT people where master_user_id IN (adopted masters)
- **Impact**: Superintendents can assign people in Workflow Assign modal
- **Category**: Access control / People

**`20260520120007_superintendent_bids_and_customers_rls.sql`**
- **Purpose**: Bids and customers RLS for superintendent
- **Changes**: Update can_access_bid_for_pricing, superintendent_can_access_bid; add superintendent to bids, bids_gc_builders, bids_count_rows, bids_submission_entries, cost_estimates, cost_estimate_labor_rows, bids_takeoff_template_mappings, bid_pricing_assignments, bid_count_row_custom_prices; customers SELECT and INSERT (for Bids modal)
- **Impact**: Superintendents draft bids (Bid Board, Counts, Takeoff, Cost Estimate, RFI, Change Order, Lien Release); create customers from Bids
- **Category**: Access control / Bids / Customers

**`20260520120008_superintendent_materials_rls.sql`**
- **Purpose**: Materials RLS for superintendent
- **Changes**: Add superintendent to material_parts, material_part_prices, material_part_price_history, material_templates, material_template_items, purchase_orders, purchase_order_items, supply_houses
- **Impact**: Superintendents access Price book and Assembly book (subject to superintendent_service_type_ids)
- **Category**: Access control / Materials

**`20260520120010_create_project_superintendents.sql`**
- **Purpose**: Project-level superintendent assignment
- **Changes**: Create `project_superintendents(project_id, superintendent_id)` with RLS; update `can_access_project_row` to include project assignment
- **Impact**: Devs, masters, and assistants can assign superintendents to specific projects via Workflow page; superintendents gain access via adoption OR project assignment
- **Category**: Access control / Projects / Superintendent

---

### April 2026

#### April 1, 2026

**`20260401052909_mercury_transactions_ledger.sql`**
- **Purpose**: **Banking (dev)**: ledger table **`mercury_transactions`** synced from Mercury API (`sync-mercury-transactions` / **`mercury-webhook`**); **RLS** dev-only **`SELECT`**, no client writes (service role upserts)
- **Changes**: `CREATE TABLE mercury_transactions` (Mercury tx id, account, amounts, status/kind, category JSON, `raw`, `synced_at`); indexes; policies
- **Impact**: [`Banking.tsx`](src/pages/Banking.tsx) read-only grid; Edge Functions documented in **`EDGE_FUNCTIONS.md`**
- **Category**: Banking / Integrations / RLS

**`20260401195701_mercury_account_nicknames.sql`**
- **Purpose**: **Banking (dev)**: optional friendly labels per **`mercury_account_id`**; **RLS** dev **`SELECT` / **`INSERT`** / **`UPDATE`** / **`DELETE`** (edited from the Banking UI)
- **Changes**: `CREATE TABLE mercury_account_nicknames` (`mercury_account_id` PK, `nickname` 1–120 chars, `updated_at`); dev policies; **`GRANT`** to **`authenticated`** and **`service_role`**
- **Impact**: [`Banking.tsx`](src/pages/Banking.tsx) account filter labels, sortable grid, nickname management block
- **Category**: Banking / Integrations / RLS

#### April 2, 2026

**`20260402003356_mercury_job_allocation_note.sql`**
- **Purpose**: **Banking** Mercury job splits: optional per-allocation **`note`**; **`replace_mercury_transaction_splits`** persists **`note`** from **`p_rows`**
- **Changes**: **`ALTER TABLE mercury_transaction_job_allocations ADD COLUMN note text`**; **`CREATE OR REPLACE`** **`replace_mercury_transaction_splits`** (insert includes **`note`** via **`NULLIF(trim(elem->>'note'), '')`**)
- **Impact**: [`MercuryTransactionAllocationsModal.tsx`](src/components/MercuryTransactionAllocationsModal.tsx) positive charge / **$**–**%** UI saves notes; [`Banking.tsx`](src/pages/Banking.tsx) loads **`note`**
- **Category**: Banking / RLS

**`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`**
- **Purpose**: Keep **`people_crew_jobs`** / **`people_crew_bids`** aligned when **`job_ledger_id`** or **`bid_id`** changes on an **approved** **`clock_sessions`** row (strip **Assign** / **Change** without a second approve); enable Realtime for crew tables
- **Changes**: Function **`clock_sessions_sync_crew_assignments_after_job_bid()`**; trigger **`clock_sessions_sync_crew_assignments_tr`** **`AFTER UPDATE OF job_ledger_id, bid_id`**; **`PERFORM`** **`sync_crew_jobs_from_clock`** and **`sync_crew_bids_from_clock`** when **`approved_at IS NOT NULL`**, **`rejected_at`** / **`revoked_at`** null, name present; conditional **`ALTER PUBLICATION supabase_realtime ADD TABLE`** for **`people_crew_jobs`** and **`people_crew_bids`**
- **Impact**: [`CrewJobsBlock.tsx`](src/components/CrewJobsBlock.tsx) **`postgres_changes`** subscription receives writes from approve/sync/trigger; **Quickfill** and **Jobs → Team Labor** refetch automatically
- **Category**: Hours / Clock Sessions / Crew Jobs / Realtime

**`20260401004452_attendance_incidents_subject_select_own.sql`**
- **Purpose**: Let the **subject** of an attendance incident **SELECT** their own row (Calendar NCNS chip)
- **Changes**: `CREATE POLICY "Attendance incidents subject select own"` **`FOR SELECT`** **`USING (subject_user_id = auth.uid())`**
- **Impact**: [`Calendar.tsx`](src/pages/Calendar.tsx) can load NCNS for signed-in user without staff/team-lead role; staff policies unchanged (ORed)
- **Category**: People / RLS / Calendar

**`20260401190823_can_edit_clock_sessions_option_a_roles.sql`**
- **Purpose**: **Dashboard My Time** — broaden **`can_edit_clock_sessions_for_user`** so **master_technician**, **assistant**, and **superintendent** may use leader **split/replace-day** RPCs for **any** target user (same helper path as dev team-lead)
- **Changes**: `CREATE OR REPLACE FUNCTION can_edit_clock_sessions_for_user` with additional `EXISTS (... profiles.role IN (...))` branches; comment + **`GRANT EXECUTE`**
- **Impact**: Master / assistant / superintendent can merge or split another person’s day in **Edit time** without being that user; documented in **`RECENT_FEATURES.md`** v2.216 and **`ACCESS_CONTROL.md`**
- **Category**: Clock Sessions / People Hours / Access control

#### April 3, 2026

**`20260403051729_mercury_transactions_supabase_realtime.sql`**
- **Purpose**: **Realtime** for **`mercury_transactions`** so **Banking** / **Quickfill Banking sorting** refetch when the ledger changes (e.g. **`mercury-webhook`** upsert or **`sync-mercury-transactions`**)
- **Changes**: Conditional **`ALTER PUBLICATION supabase_realtime ADD TABLE public.mercury_transactions`** when not already published
- **Impact**: [`Banking.tsx`](src/pages/Banking.tsx) and [`BankingSortingSnapshotSection.tsx`](src/components/quickfill/BankingSortingSnapshotSection.tsx) **`postgres_changes`** subscriptions (debounced **`loadRows`** / **`loadMercurySnapshot`**)
- **Category**: Banking / Integrations / Realtime

#### April 4, 2026

**`20260404050204_salary_sync_boundary_open_close.sql`**
- **Purpose**: **`salary_sync_one_user_clock_sessions`** — replace per-slot canonical `UPDATE`/overlap INSERT logic with **boundary** open/ close: at each template block end set **`clocked_out_at`** on **all** still-open **`clock_sessions`** for that user/**`work_date`** to that instant (every `origin`; **`approved_at`** does not block); inside each block insert/reopen canonical **`salary_schedule`** only when **no** open exists that day; catch-up closed rows when missing; PTO / no-template / excluded-weekend paths **close remaining opens** at **`p_now`** after deleting non-final **`salary_schedule`** rows; **split** mode deletes orphan NULL-index **`salary_schedule`** rows only; **continuous** skips NULL-index catch-up/open when pending indexed **`salary_schedule`** segments exist (preserves **`20270402100000`** intent)
- **Changes**: `CREATE OR REPLACE` **`salary_sync_one_user_clock_sessions`**; updated **`COMMENT`**; **`REVOKE ALL`** (unchanged surface area)
- **Impact**: Cron **`sync-salary-sessions`** and **`sync_salary_clock_sessions_for_user_day`**; removes split-template **half-open overlap** INSERT guard from sync (see [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md))
- **Category**: People / Hours / Dashboard

#### April 25, 2026

**`20260425120000_add_job_owner_override_robert.sql`**
- **Purpose**: Job owner override so devs (e.g., Robert) can create jobs assigned to another user (e.g., Malachi)
- **Changes**: Insert `app_settings` row `job_owner_override_<robert_id>` = Malachi's user ID (by name matching)
- **Impact**: Jobs page New Job uses override when present; Settings → Jobs & dispatch → Job creation overrides (dev-only) to configure
- **Category**: Jobs / Settings

#### April 23, 2026

**`20260423120001_update_bids_count_rows_order_rpc.sql`**
- **Purpose**: Batch-update sequence_order for Bids Counts drag-and-drop reordering
- **Changes**: Create `update_bids_count_rows_order(p_bid_id uuid, p_ordered_ids uuid[])` SECURITY DEFINER RPC; uses `can_access_bid_for_pricing` for access check; updates sequence_order (0-based) from array index via unnest WITH ORDINALITY
- **Impact**: Counts tab drag reorder persists in one RPC call instead of N sequential updates
- **Category**: Bids / Counts

**`20260423120000_people_crew_bids.sql`**
- **Purpose**: Bid-level team labor (parallel to `people_crew_jobs`); synced from approved clock sessions with `bid_id`
- **Changes**: Create `people_crew_bids` (work_date, person_name, crew_lead_person_name, bid_assignments JSONB); RPC `get_bids_by_ids(p_bid_ids UUID[])`; `sync_crew_bids_from_clock(p_person_name, p_work_date)`; extend `approve_clock_sessions` and `revoke_clock_sessions` to sync bid assignments when sessions have `bid_id`
- **Impact**: Bids Pricing cost breakdown shows "Team Labor (clocked)" when users have clocked in with a bid; `loadTeamLaborDataForBids` powers display
- **Category**: Bids / Hours / Clock Sessions / Crew Bids

#### April 27, 2026

**`20260427120000_fix_approve_clock_sessions_cs_scope.sql`**
- **Purpose**: Fix "missing FROM-clause entry for table cs" error in approve_clock_sessions
- **Changes**: Replace `cs.clocked_in_at` with `v_session.clocked_in_at` in loop body (cs alias is only in scope inside the FOR SELECT)
- **Impact**: Approve button in People Hours and Quickfill Hours works correctly
- **Category**: Hours / Clock Sessions / Bugfix

#### April 26, 2026

**`20260426120000_approve_clock_sessions_composite_return.sql`**
- **Purpose**: Optional fallback if `approve_clock_sessions` returns 404 via REST despite schema reload
- **Changes**: Create `approve_clock_result` composite type; change `approve_clock_sessions` from `RETURNS TABLE(...)` to `RETURNS SETOF approve_clock_result`; same logic, same response shape (array of one row)
- **Impact**: Apply only if PostgREST fails to expose the TABLE-returning version; frontend unchanged
- **Category**: Hours / Clock Sessions / RPC

#### April 22, 2026

**`20260422120000_approve_clock_sessions_crew_jobs.sql`**
- **Purpose**: Auto-create/update `people_crew_jobs` when clock sessions with `job_ledger_id` are approved or revoked
- **Changes**: Add `sync_crew_jobs_from_clock(p_person_name, p_work_date)` helper; extend `approve_clock_sessions` to call it for each (person_name, work_date) with job_ledger_id; extend `revoke_clock_sessions` to call it after each revoke when session had job_ledger_id. Percentages computed from hours; skips when crew_lead_person_name is set
- **Impact**: Approving a session with a job creates/updates Crew Jobs for that person/date; revoking recomputes or removes
- **Category**: Hours / Clock Sessions / Crew Jobs

#### March 22, 2026

**`20260322120000_search_bids_for_clock_security_definer.sql`**
- **Purpose**: Fix bid search returning 0 results for subcontractors and others blocked by bids RLS
- **Changes**: Change `search_bids_for_clock` from SECURITY INVOKER to SECURITY DEFINER; function bypasses bids RLS so subcontractors can search bids for Clock In and Dispatch; filtering by `p_service_type_ids` remains enforced in function logic
- **Impact**: Clock In, Update Focus, Dispatch, Crew Jobs / Bids, Add job or bid search now return bids for all roles
- **Category**: Bids / Clock Sessions / Task Dispatch

**`20260322120001_fix_bid_search_and_j_prefix.sql`**
- **Purpose**: Fix bids still not showing (2-arg overload) and J651/B88 search normalization
- **Changes**: DROP 2-arg `search_bids_for_clock(TEXT, UUID)` overload so frontend calls use the 3-arg SECURITY DEFINER version; `search_jobs_ledger` normalizes "J" prefix (J651 matches hcp_number 651); `search_bids_for_clock` normalizes "B" prefix (B88 matches bid_number 88)
- **Impact**: Bids now appear in search; "J651" finds job 651; "B88" finds bid 88
- **Category**: Bids / Clock Sessions / Search

**`20260322140000_contracts_rls_all_masters.sql`**
- **Purpose**: Allow all masters (not just Pay Approved) to manage contracts
- **Changes**: Update RLS on contract_templates, contract_template_documents, person_contract_assignments, person_contract_documents to include `is_master_or_dev()` in USING/WITH CHECK
- **Impact**: Non-pay-approved masters can manage contract templates and assignments
- **Category**: People / Contracts / RLS

**`20260322170000_fix_projects_rls_recursion.sql`**
- **Purpose**: Fix "infinite recursion detected in policy for relation projects" on /projects
- **Changes**: Add overload `can_access_project_row(project_id, master_user_id, customer_id)` that uses passed values instead of reading projects; add `user_assigned_to_project_as_superintendent` SECURITY DEFINER helper; update projects SELECT policy to use the overload
- **Impact**: Projects page loads without recursion; assigned-steps access path preserved
- **Category**: RLS / Bugfix / Projects

#### April 21, 2026

**`20260421120000_add_subcontractor_service_type_ids.sql`**
- **Purpose**: Subcontractor service type restrictions for Clock In and Task Dispatch
- **Changes**: Add `subcontractor_service_type_ids UUID[] DEFAULT NULL` to `users`; NULL/empty = all types
- **Impact**: Settings Active Accounts Edit/Manual Add; ClockInOutButton; DispatchTaskModal filter bids by allowed types
- **Category**: Access control / Clock Sessions / Task Dispatch

**`20260421120001_search_bids_for_clock_service_type_ids.sql`**
- **Purpose**: Support subcontractors with multiple allowed service types in bid search
- **Changes**: Add optional `p_service_type_ids UUID[]` to `search_bids_for_clock`; when non-empty, filter `WHERE b.service_type_id = ANY(p_service_type_ids)`; backward compatible with `p_service_type_id`
- **Impact**: Clock In, Update Focus, Dispatch modals pass `p_service_type_ids` for restricted subcontractors
- **Category**: Bids / Clock Sessions / Task Dispatch

#### April 20, 2026

**`20260420120000_dispatch_requests_job_bid_reference.sql`**
- **Purpose**: Task Dispatch optional job or bid reference
- **Changes**: `dispatch_requests` adds `job_ledger_id`, `bid_id` (mutually exclusive, FKs with ON DELETE SET NULL), `reference_summary` (client-set denormalized line for inbox/push); `dispatch_requests_guard_update` extended so non-devs cannot change those columns after insert
- **Impact**: Dispatch modal unified job/bid picker; Dashboard inbox and `notify-dispatch-request` can show reference text
- **Category**: Task Dispatch / Schema

#### April 19, 2026

**`20260419120000_dispatch_group_and_requests.sql`**
- **Purpose**: Task Dispatch — subs and all roles can send short messages to a dev-configured group of assistants; separate from checklist
- **Changes**: `dispatch_group_members` (PK `user_id` → `users`, trigger restricts to `role = assistant`); `dispatch_requests` (`from_user_id`, `title`, `links` text[], `status` open/closed, `closed_at`, `closed_by_user_id`); `is_dispatch_group_member()`; update guard trigger for non-dev body edits; RLS on both tables
- **Impact**: Settings (dev) Dispatch group; header Task Dispatch modal; Dashboard Dispatch inbox; Edge Function `notify-dispatch-request` for push without exposing member list
- **Category**: Access control / Notifications

#### April 15, 2026

**`20260415120000_add_location_to_reports.sql`**
- **Purpose**: Optional location capture when reports are submitted
- **Changes**: Add `reported_at_lat`, `reported_at_lng` (both NUMERIC, nullable) to `reports`
- **Impact**: NewReportModal and AdditionalReportModal request geolocation on submit; coordinates stored when permission granted; ReportViewModal shows location icon (dev/master/assistant only)
- **Category**: Reports

**`20260415120005_insert_report_add_location_params.sql`**
- **Purpose**: Allow insert_report RPC to accept optional location params
- **Changes**: Add `p_reported_at_lat`, `p_reported_at_lng` (DEFAULT NULL) to `insert_report` function
- **Impact**: Estimators submitting reports can pass location when available
- **Category**: Reports

**`20260415120006_list_reports_with_job_info_add_location.sql`**
- **Purpose**: Return reported_at_lat/lng in list_reports_with_job_info, role-gated
- **Changes**: Add reported_at_lat, reported_at_lng to RPC return; only dev/master_technician/assistant receive values; others get NULL
- **Impact**: ReportViewModal shows location icon only for devs, masters, assistants
- **Category**: Reports

**`20260415120007_list_my_reports_add_location.sql`**
- **Purpose**: Same role-gated location columns for list_my_reports
- **Changes**: Add reported_at_lat, reported_at_lng with same conditional as list_reports_with_job_info
- **Impact**: My Reports modal and Dashboard report views respect location visibility by role
- **Category**: Reports

**`20260415120003_add_checklist_item_links.sql`**
- **Purpose**: URL placeholders in checklist item titles
- **Changes**: Add `links text[] DEFAULT '{}'` to `checklist_items`; links[0] maps to [1], links[1] to [2], etc.
- **Impact**: Add/Edit modal has Links section; ChecklistTitleWithLinks component; Dashboard, Checklist, People display clickable links
- **Category**: Checklist

**`20260415120004_create_checklist_item_assignees.sql`**
- **Purpose**: Multi-assignee support for checklist items; junction table replaces single assigned_to_user_id
- **Changes**: Create `checklist_item_assignees` (checklist_item_id, user_id) PK; RLS for dev/master/assistant/primary + assignees read own; migrate existing data from checklist_items.assigned_to_user_id
- **Impact**: Add/Edit checklist modal uses checkboxes for multiple assignees
- **Category**: Checklist

**`20260415120001_create_checklist_instance_assignees.sql`**
- **Purpose**: Multi-assignee support for checklist instances
- **Changes**: Create `checklist_instance_assignees` (checklist_instance_id, user_id) PK; same RLS pattern; migrate from checklist_instances.assigned_to_user_id
- **Impact**: Dashboard, Checklist, People fetch instances via checklist_instance_assignees
- **Category**: Checklist

**`20260415120002_drop_checklist_assigned_to_user_id.sql`**
- **Purpose**: Remove legacy single-assignee columns; RLS policies updated to use junction tables
- **Changes**: Drop `assigned_to_user_id` from checklist_items and checklist_instances; recreate RLS policies to use checklist_item_assignees and checklist_instance_assignees
- **Impact**: All checklist assignee logic uses junction tables
- **Category**: Checklist

**Note**: April 15 migrations share timestamps with Reports migrations; Supabase runs them in lexical filename order.

#### April 16, 2026

**`20260416000000_add_stage_notes_to_jobs_ledger.sql`**
- **Purpose**: Short note for Stages tab
- **Changes**: Add `stage_notes TEXT` to `jobs_ledger`
- **Impact**: Stages tab Stage Notes column; editable by any user with job access
- **Category**: Jobs / Stages

**`20260416120000_create_user_completed_task_mute_preferences.sql`**
- **Purpose**: User preference to mute completed task push notifications (global)
- **Changes**: Create `user_completed_task_mute_preferences` (user_id PK, muted_until timestamptz); RLS for users to manage own row
- **Impact**: Settings and Dashboard mute modal; send-checklist-notification skips sending when recipient has muted_until > now
- **Category**: Checklist / Notifications
- **Note**: Superseded by April 17 migrations; replaced with per-task `user_checklist_item_mute_preferences`

#### April 17, 2026

**`20260417000000_add_estimated_completion_date_to_jobs_ledger.sql`**
- **Purpose**: Optional estimated completion date for jobs
- **Changes**: Add `estimated_completion_date DATE` to `jobs_ledger`
- **Impact**: Stages tab; Ham mode -1/+1 buttons adjust this date
- **Category**: Jobs / Stages

**`20260417120000_create_user_checklist_item_mute_preferences.sql`**
- **Purpose**: Per-task mute: user mutes completed-task push notifications for a specific checklist item
- **Changes**: Create `user_checklist_item_mute_preferences` (user_id, checklist_item_id, muted_until) PK; RLS for users to manage own rows
- **Impact**: ChecklistItemMuteModal; inline bell-off icon on Checklist Today, Manage, Dashboard for notification recipients; Settings Muted Tasks list; send-checklist-notification checks per-task mute by checklist_item_id
- **Category**: Checklist / Notifications

**`20260417120001_drop_user_completed_task_mute_preferences.sql`**
- **Purpose**: Remove global mute table; replaced by per-task user_checklist_item_mute_preferences
- **Changes**: DROP TABLE user_completed_task_mute_preferences
- **Impact**: Global mute removed; per-task mute only
- **Category**: Checklist / Notifications

#### April 18, 2026

**`20260418120000_create_dev_ignored_checklist_items.sql`**
- **Purpose**: Dev Ignored Tasks section in Recently Completed Tasks
- **Changes**: Create `dev_ignored_checklist_items` (dev_user_id, checklist_item_id, ignored_at) PK; RLS for devs to manage own rows
- **Impact**: Dashboard Recently Completed Tasks split into main section (non-ignored types) and collapsible Ignored section; Ignore/Un-ignore buttons; UNREAD count excludes ignored items
- **Category**: Checklist / Dashboard

#### April 10, 2026

**`20260410130000_primaries_full_bids_access.sql`**
- **Purpose**: Give primaries full, unrestricted access to bids (same as estimators)
- **Changes**: Update RLS policies on bids, bids_gc_builders, bids_count_rows, bids_submission_entries, cost_estimates, cost_estimate_labor_rows, bids_takeoff_template_mappings, bid_pricing_assignments, bid_count_row_custom_prices, customers; add primary to all bid-related policies; update can_access_bid_for_pricing helper; primaries see all customers (for New Bid GC picker)
- **Impact**: Primaries can see all bids, full CRUD, all Bids tabs (Builder Review, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission, RFI, Change Order, Lien Release)

**`20260410140000_fix_bid_pricing_assignments_primary_rls.sql`**
- **Purpose**: Fix bid_pricing_assignments RLS so primary users can insert (fixes "new row violates row-level security policy" for primaries on Pricing tab)
- **Changes**: Drop and recreate bid_pricing_assignments SELECT/INSERT/UPDATE/DELETE policies to include `primary` in the role list; uses `can_access_bid_for_pricing(bid_id)` helper
- **Impact**: Primary users (e.g. Trace) can assign price book entries and set unit cost overrides on Bids Pricing tab without RLS violation
- **Category**: Bids / RLS

### March 2026

#### March 11, 2026

**`20260311120000_add_monthly_payment_day_to_supply_houses.sql`**
- **Purpose**: Add monthly payment day for supply house Due column
- **Changes**: Add `monthly_payment_day INTEGER CHECK (monthly_payment_day >= 1 AND monthly_payment_day <= 31)` to `supply_houses`
- **Impact**: Supply house list Due column uses `monthly_payment_day` (e.g. "15th") instead of invoice due_date; Edit Supply House form includes "Monthly payment date" field
- **Category**: Materials / Supply Houses

#### March 12, 2026

**`20260312120002_approve_clock_sessions_rpc.sql`**
- **Purpose**: Atomic approval of clock sessions and merge into people_hours
- **Changes**: Create `approve_clock_sessions(p_session_ids UUID[])` RPC; caller must have pay access; upserts hours into `people_hours`, sets `approved_at`/`approved_by` on sessions
- **Impact**: People Hours tab Approve button calls this RPC; cross-midnight sessions attributed to clock-in date; devs excluded from Pay roster
- **Category**: Hours / Clock Sessions

**`20260312130000_add_notes_to_clock_sessions.sql`**
- **Purpose**: Require notes on clock-in ("What are you working on today?")
- **Changes**: Add `notes TEXT NOT NULL DEFAULT ''` to `clock_sessions`
- **Impact**: ClockInOutButton modal requires notes before clock-in; People Hours tab shows notes in pending sessions; edit modal requires notes before save
- **Category**: Hours / Clock Sessions

#### March 13, 2026

**`20260313180000_add_job_ledger_id_to_clock_sessions.sql`**
- **Purpose**: Optional job association for clock sessions (job-level hour reporting)
- **Changes**: Add `job_ledger_id UUID REFERENCES jobs_ledger(id) ON DELETE SET NULL` to `clock_sessions`
- **Impact**: Clock In and Update Focus modals include optional job search/select; sessions store selected job for reporting
- **Category**: Hours / Clock Sessions

#### March 15, 2026

**`20260315120000_add_location_to_clock_sessions.sql`**
- **Purpose**: Optional location capture at clock-in and clock-out
- **Changes**: Add `clock_in_lat`, `clock_in_lng`, `clock_out_lat`, `clock_out_lng` (all NUMERIC, nullable) to `clock_sessions`
- **Impact**: ClockInOutButton requests geolocation on clock-in and clock-out; coordinates stored when permission granted; People Hours pending table shows Location column with links to Google Maps
- **Category**: Hours / Clock Sessions

**`20260315120001_add_rejected_to_clock_sessions.sql`**
- **Purpose**: Reject flow for pending clock sessions (move to Rejected section instead of delete)
- **Changes**: Add `rejected_at` (TIMESTAMPTZ), `rejected_by` (UUID FK → users.id) to `clock_sessions`
- **Impact**: People Hours tab Reject button; `approve_clock_sessions` excludes rejected sessions
- **Category**: Hours / Clock Sessions

**`20260315120002_approve_clock_sessions_exclude_rejected.sql`**
- **Purpose**: Exclude rejected sessions from approval
- **Changes**: Update `approve_clock_sessions` to filter out sessions where `rejected_at IS NOT NULL`
- **Category**: Hours / Clock Sessions

**`20260315120003_revoke_clock_sessions_rpc.sql`**
- **Purpose**: Revoke approved sessions (move back to Pending, subtract hours from people_hours)
- **Changes**: Create `revoke_clock_sessions(p_session_ids UUID[])` RPC; subtracts session hours from `people_hours`, clears `approved_at`/`approved_by`
- **Impact**: Approved Sessions Revoke button in People Hours and Quickfill
- **Category**: Hours / Clock Sessions

**`20260315120004_add_revoked_to_clock_sessions.sql`**
- **Purpose**: Accountability for revoked sessions
- **Changes**: Add `revoked_at` (TIMESTAMPTZ), `revoked_by` (UUID FK → users.id) to `clock_sessions`
- **Impact**: Action column shows "Revoked by [name] at [timestamp]" on Pending rows that were revoked
- **Category**: Hours / Clock Sessions

**`20260315120005_revoke_set_revoked_by_approve_clear.sql`**
- **Purpose**: Set revoked_at/revoked_by when revoking; clear when re-approving
- **Changes**: Update `revoke_clock_sessions` to set `revoked_at`/`revoked_by`; update `approve_clock_sessions` to clear them
- **Category**: Hours / Clock Sessions

### March 2025

#### March 10, 2025

**`20250310120000_normalize_bids_count_rows_sequence_order.sql`**
- **Purpose**: Fix non-deterministic ordering when duplicate sequence_order exists; enables correct Count row ordering
- **Changes**: Data migration; assign unique sequence_order (0,1,2,...) per bid to all bids_count_rows
- **Impact**: Counts tab refetch returns deterministic order; used by drag-and-drop reordering (v2.122)
- **Category**: Bids / Counts

**`20250310120000_optimize_bid_pricing_rls.sql`**
- **Purpose**: Mitigate statement timeout (57014) on Pricing tab when loading bid_pricing_assignments and bid_count_row_custom_prices
- **Changes**: Create `can_access_bid_for_pricing(bid_id UUID)` SECURITY DEFINER helper; recreate RLS policies on both tables to use the helper instead of per-row correlated EXISTS subqueries
- **Impact**: Reduces RLS evaluation cost for bids with many count rows; Pricing tab loads faster without timeout
- **Category**: Bids / RLS

### April 2026

#### April 10, 2026

**`20260410120000_add_group_tag_to_bids_count_rows.sql`**
- **Purpose**: Add optional Group/Tag column to Bids Counts
- **Changes**: Add `group_tag TEXT` to `bids_count_rows`
- **Impact**: Counts tab shows Group/Tag column between Fixture and Plan Page; user can enter optional group or tag per row; Import supports 4-column format (Fixture, Count, Group/Tag, Plan Page)
- **Category**: Bids / Counts

#### April 9, 2026

**`20260409120000_add_get_jobs_ledger_paid_only_rpcs.sql`**
- **Purpose**: Paid-only variants for People Review "Only Count Jobs Marked Paid in Full" checkbox
- **Changes**: Create `get_jobs_ledger_by_ids_paid_only(p_job_ids uuid[])` and `get_jobs_ledger_by_hcp_numbers_paid_only(p_hcp_numbers text[])`; same return types as originals but filter to `jobs_ledger.status = 'paid'` only
- **Impact**: People Review tab uses these RPCs when checkbox is checked; revenue, profit, labor hours, and labor cost exclude non-paid jobs
- **Category**: People / Review

#### April 8, 2026

**`20260408120000_add_unit_price_override_to_bid_pricing_assignments.sql`**
- **Purpose**: Per-bid unit price override in Bids Pricing tab Price Model
- **Changes**: Add `unit_price_override NUMERIC(10,2) NULL` to `bid_pricing_assignments`
- **Impact**: In Price Model, Unit Cost column is editable when a price book entry is assigned; user can override the book price for this bid; Reset button clears override
- **Category**: Bids / Pricing

**`20260408160000_create_get_jobs_ledger_office.sql`**
- **Purpose**: SECURITY DEFINER RPC to fetch the Office job (HCP 000 or `job_name ILIKE '%Office%'`)
- **Changes**: Create `get_jobs_ledger_office()` returning single job row
- **Impact**: HoursUnassignedModal uses this instead of direct `jobs_ledger` access; bypasses RLS for Office job lookup
- **Category**: Database / RLS Hardening

**`20260408170000_create_get_projects_by_ids.sql`**
- **Purpose**: SECURITY DEFINER RPC to fetch project id, name, address by IDs
- **Changes**: Create `get_projects_by_ids(p_ids uuid[])` returning project details
- **Impact**: AddInspectionModal, NewReportModal use this for selected project instead of direct `projects` access
- **Category**: Database / RLS Hardening

**`20260408180000_create_get_jobs_ledger_by_status.sql`**
- **Purpose**: SECURITY DEFINER RPC to fetch jobs by status
- **Changes**: Create `get_jobs_ledger_by_status(p_status text)` returning jobs matching status
- **Impact**: Dashboard, BilledAwaitingPaymentSection use this instead of direct `jobs_ledger` fetches
- **Category**: Database / RLS Hardening

### March 2026

#### March 10, 2026

**`20260310120000_assistants_see_prospect_timer_events.sql`**
- **Purpose**: Allow assistants to see all prospect_timer_events for Prospects Team tab
- **Changes**: Create policy "Assistants can see all prospect timer events" on `prospect_timer_events` FOR SELECT USING (public.is_assistant())
- **Impact**: Assistants can access Prospects Team tab and view per-user cards marked/updated activity
- **Category**: Prospects / Team Tab / RLS

**`20260310180000_add_labor_rate_to_people_labor_job_items.sql`**
- **Purpose**: Per-row labor rate in New Job Labor Specific Work table
- **Changes**: Add `labor_rate NUMERIC(10, 2) NULL` to `people_labor_job_items`; backfill from `people_labor_jobs.labor_rate`
- **Impact**: Each line item in the Specific Work table has its own Rate ($/hr) and Cost; job-level labor_rate kept for Sub Labor table display (set from first row when saving)
- **Category**: Jobs / Sub Sheet Ledger

#### March 9, 2026

**`20260309120000_add_pct_complete_to_jobs_ledger.sql`**
- **Purpose**: Job completeness percentage for Jobs Stages Working section; Value Created = Total Bill × (% complete / 100)
- **Changes**: Add `pct_complete INTEGER CHECK (pct_complete >= 0 AND pct_complete <= 100)` to `jobs_ledger`
- **Impact**: Jobs → Stages → Working shows new column "% Complete / Value Created"; user can enter 0–100; % Complete input above Value Created
- **Category**: Jobs / Stages

#### March 31, 2026

**`20260331020000_create_person_offsets.sql`**
- **Purpose**: Backcharges and damages per person; pending (pay_stub_id null) or applied (linked to pay stub)
- **Changes**: Create `person_offsets` (person_name, type backcharge|damage, amount, description, occurred_date, pay_stub_id nullable); RLS same as pay_stubs
- **Impact**: People Offsets tab; offsets shown on pay reports (applied reduce net pay, pending listed for visibility)
- **Category**: People / Offsets

**`20260331191952_estimator_inbox_group_and_requests.sql`**
- **Purpose**: **Estimator Inbox** — parallel to Task Dispatch: separate group, requests, thread notes, dismissals, and `estimator_inbox_note_stats` RPC
- **Changes**: `estimator_group_members` (assistant/estimator); `is_estimator_group_member()`; `estimator_requests` (mirror dispatch columns + job/bid/location/closed_note); guard trigger; `estimator_request_notes`; `estimator_request_dismissals`; RLS aligned with dispatch; `GRANT EXECUTE` on `estimator_inbox_note_stats(uuid[])`
- **Impact**: Layout purple pencil → send modal; Dashboard **Estimator inbox**; Settings **Estimator Inbox group**; Edge `notify-estimator-request`
- **Category**: Dashboard / Notifications / RLS

**`20260331232529_ncns_reject_day_sessions.sql`**
- **Purpose**: **NCNS** (no-call-no-show) from team **My Time** day editor: record **`attendance_incidents`** and reject all **closed** **`clock_sessions`** for a user **`work_date`**
- **Changes**: Create **`attendance_incidents`** ( **`incident_type`** check **`no_call_no_show`**, **`metadata`** JSONB); RLS (staff bundle + team lead for subject, dev update/delete); **`record_ncns_and_reject_sessions_for_day`** — pay staff or team lead for subject; for **approved** sessions subtract **`people_hours`** (same as **`revoke_clock_sessions`**), sync crew job/bid, then **`rejected_at`** / clear approval; insert incident with **`had_approved_sessions`** in **`metadata`**
- **Impact**: Dashboard **My Time** modal (strip) **NCNS** button; **two-step** confirm when any session was approved
- **Category**: People / Hours / Dashboard / RLS

**`20260321120000_create_person_licenses.sql`**
- **Purpose**: Licenses per person (plumber, journeyman, etc.)
- **Changes**: Create `person_licenses` (person_name, license_type, note, date_of_expiry); indexes on person_name and date_of_expiry; RLS same as pay_stubs
- **Impact**: People Licenses tab; expiring-in-30-days section; person-centric expandable table with Add/Edit/Delete
- **Category**: People / Licenses

**`20260321130000_add_cost_to_company_to_person_licenses.sql`**
- **Purpose**: Add optional cost-to-company dollar amount per license (e.g. renewal fee)
- **Changes**: Add `cost_to_company NUMERIC(10, 2) DEFAULT NULL` to `person_licenses`
- **Impact**: People Licenses tab shows Cost to Company column; Add/Edit license modal has Cost to Company ($) input
- **Category**: People / Licenses

**`20260321140000_create_person_license_cost_lines.sql`**
- **Purpose**: Replace single cost_to_company with multiple cost lines per license (amount, note, date)
- **Changes**: Create `person_license_cost_lines` (person_license_id, amount, note, date); RLS same as person_licenses
- **Impact**: Licenses tab Cost to Company column shows sum of cost lines; inline sub-rows for Add/Edit/Delete cost lines
- **Category**: People / Licenses

**`20260321150000_migrate_cost_to_company_to_lines.sql`**
- **Purpose**: Migrate existing cost_to_company to cost lines, drop column
- **Changes**: INSERT one cost line per license where cost_to_company IS NOT NULL; DROP COLUMN cost_to_company
- **Impact**: Existing cost data preserved in person_license_cost_lines
- **Category**: People / Licenses

**`20260331010000_create_vehicle_replacement_value_entries.sql`**
- **Purpose**: Replacement value entries per vehicle per date (like odometer)
- **Changes**: Create `vehicle_replacement_value_entries` (vehicle_id, replacement_value, read_date, UNIQUE vehicle_id+read_date); RLS same as vehicles
- **Impact**: People Vehicles tab shows Replacement value section with add/delete entries
- **Category**: People / Vehicles

**`20260331000000_create_vehicles.sql`**
- **Purpose**: Fleet vehicle tracking for People page; vehicle CRUD, odometer entries, possession assignments (user + start/end date)
- **Changes**: Create `vehicles` (year, make, model, vin, weekly_insurance_cost, weekly_registration_cost); `vehicle_odometer_entries` (vehicle_id, odometer_value, read_date, UNIQUE vehicle_id+read_date); `vehicle_possessions` (vehicle_id, user_id, start_date, end_date). RLS same as pay_stubs: dev, pay-approved master, assistant_of_pay_approved_master, assistant
- **Impact**: People page gains Vehicles tab (visible when canAccessPay); vehicle info shown on Pay reports for users with possession during pay period
- **Category**: People / Vehicles

#### March 30, 2026

**`20260330000000_common_jobs_get_job_details_rpc.sql`**
- **Purpose**: Fix Common Jobs not showing for assistants when a dev (impersonating) adds a job; assistants could not read job details from jobs_ledger due to RLS (master_assistants visibility)
- **Changes**: Create `get_jobs_ledger_by_ids(p_job_ids uuid[])` SECURITY DEFINER RPC that fetches job details (id, hcp_number, job_name, job_address) for given IDs, bypassing jobs_ledger RLS
- **Impact**: Assign User to Jobs modal uses this RPC instead of direct jobs_ledger query when loading Common Jobs; assistants now see the same Common Jobs list as devs
- **Category**: People / Hours / Crew Jobs / RLS

#### March 7, 2026

**`20250407120001_common_jobs_assistant_rls.sql`**
- **Purpose**: Ensure all assistants (not just pay-approved) can INSERT/SELECT/DELETE common_jobs; fixes assistants' Common Jobs not persisting between sessions
- **Changes**: Drop and recreate common_jobs RLS policies to explicitly include `is_assistant()` alongside `is_assistant_of_pay_approved_master()`
- **Impact**: Assistants (e.g. Taunya) can add and see Common Jobs across sessions
- **Category**: People / Hours / Crew Jobs / RLS

**`20250407120000_common_jobs_allow_duplicates.sql`**
- **Purpose**: Allow the same job to appear multiple times in Common Jobs; broaden access so any user who can open Assign User to Jobs modal can add/remove jobs
- **Changes**: Add `id UUID` column as PRIMARY KEY; drop `job_id` as PK; create index on `job_id`; backfill existing rows with `gen_random_uuid()`
- **Impact**: Users can add the same job to Common Jobs multiple times for quick access; remove deletes by row `id` (not `job_id`); add flow no longer filters out jobs already in list
- **Category**: People / Hours / Crew Jobs

**`20250307120000_create_common_jobs.sql`**
- **Purpose**: Org-wide quick-add jobs for Assign User to Jobs modal (People > Hours)
- **Changes**: Create `common_jobs` table (job_id PK FK jobs_ledger, sequence_order); RLS SELECT for pay access + shared read; INSERT/DELETE for pay access users (dev, pay-approved master, assistant)
- **Impact**: Assign User to Jobs modal shows Common Jobs section above Jobs; display mode shows quick-add buttons; edit mode allows add/remove from shared list
- **Category**: People / Hours / Crew Jobs

#### March 28, 2026

**`20260328000000_pay_stubs_physical_payment.sql`**
- **Purpose**: Track physical payment separately from stub creation; record when a pay stub was actually paid (cash, check, direct deposit)
- **Changes**: Add `paid_at TIMESTAMPTZ` and `paid_by UUID REFERENCES users(id)` to `pay_stubs`; create UPDATE policy for pay access users (same predicate as SELECT/INSERT)
- **Impact**: People > Pay History > Ledger shows Paid column with "Mark as paid" / "Paid [date]" + Unmark; users can record when they physically pay each person
- **Category**: People / Pay Stubs

**`20260328052640_pay_stub_paid_note.sql`**
- **Purpose**: Optional memo when marking a pay stub physically paid
- **Changes**: Add `paid_note TEXT` to `pay_stubs`
- **Impact**: Pay History mark-paid flow can store a short note
- **Category**: People / Pay Stubs

**`20260328215252_pay_stub_payments.sql`**
- **Purpose**: Multiple partial physical payments per pay stub (amount + paid date + memo)
- **Changes**: Create `pay_stub_payments` (FK `pay_stubs` ON DELETE CASCADE, `amount` > 0, `paid_at`, memo, created_by); BEFORE INSERT/UPDATE trigger caps sum(amount) per stub to `gross_pay` + 0.01; RLS SELECT/INSERT/UPDATE/DELETE for pay access (same helpers as `pay_stub_days`); backfill one row per stub where `pay_stubs.paid_at` IS NOT NULL
- **Impact**: People > Pay History ledger and Run Payroll use **Record payment**; installments can be removed one row at a time from the payment detail modal; fully paid = sum of installments ≥ gross; print/HTML pay report includes **Physical payments** block
- **Category**: People / Pay Stubs

#### March 29, 2026

**`20260329002111_pay_stub_deductions.sql`**
- **Purpose**: **Less** (deductions) per pay stub—manual lines or offset-linked; **Net Pay** = `gross_pay` − sum(deductions); cap installments at Net Pay
- **Changes**: Create `pay_stub_deductions` (FK `pay_stubs` ON DELETE CASCADE, amount > 0, `source` manual|offset, optional FK `person_offsets`, description, created_by); partial UNIQUE on `person_offset_id`; BEFORE trigger: sum(deductions) ≤ gross; AFTER trigger: sum(`pay_stub_payments`) ≤ Net Pay; backfill one row per `person_offsets` where `pay_stub_id` IS NOT NULL; replace `pay_stub_payments_enforce_total_fn` to use Net Pay; RLS same as `pay_stub_payments`
- **Impact**: Pay History ledger **Less** (click **$0.00** or amount → modal) and **Net Pay**; **Record payment** / trigger vs Net Pay; Run Payroll fully-paid uses Net Pay; print shows **Less** lines + **Net Pay**
- **Category**: People / Pay Stubs

#### March 27, 2026

**`20260327000000_devs_delete_pay_stubs.sql`**
- **Purpose**: Allow devs to delete pay stubs (e.g. to correct mistakes)
- **Changes**: Create RLS policy "Devs can delete pay stubs" on `pay_stubs` using `public.is_dev()`; `pay_stub_days` cascade automatically via FK ON DELETE CASCADE
- **Impact**: People > Pay History > Ledger shows a dev-only delete control (red trash icon); devs can remove erroneous pay stubs
- **Category**: People / Pay Stubs / RLS

#### March 26, 2026

**`20260326000000_fix_cost_estimate_labor_rows_rls_assistants.sql`**
- **Purpose**: Fix 500 Internal Server Error when assistants (or dev/master/estimator) fetch cost estimate labor rows on Bids > Pricing
- **Changes**: Create `is_bid_pricing_user()` SECURITY DEFINER helper; simplify cost_estimate_labor_rows RLS policies to use helper instead of nested users/bids subqueries (avoids recursion)
- **Impact**: Assistant William and other bid-pricing users can load Pricing tab without 500
- **Category**: Bids / RLS

#### March 22, 2026

**`20260322000000_create_inspection_quick_links.sql`**
- **Purpose**: Make inspection quick links editable; replace hardcoded permit portal list with lookup table
- **Changes**: Create `inspection_quick_links` table (id, label, url, sequence_order); RLS SELECT for authenticated, INSERT/UPDATE/DELETE for dev, master, assistant, primary (via `can_manage_inspection_types`); seed 7 links
- **Impact**: Jobs Inspections tab Quick Links section has "Edit Quick Inspection Links" button; links fetched from DB; users who see Inspections tab can add/edit/delete links
- **Category**: Jobs / Inspections

#### March 21, 2026

**`20260321000000_create_inspection_types.sql`**
- **Purpose**: Make inspection types editable; replace hardcoded CHECK with lookup table
- **Changes**: Create `inspection_types` table (name PK, sequence_order); create `can_manage_inspection_types()` helper; seed 8 types; drop `inspections_type_check`, add FK `inspections.inspection_type` → `inspection_types(name)` ON UPDATE CASCADE ON DELETE RESTRICT; RLS SELECT for authenticated, INSERT/UPDATE/DELETE for dev, master, assistant, primary
- **Impact**: Jobs Inspections tab has "Edit Inspection Types" button; Add Inspection modal fetches types from DB; users who see Inspections tab can add/edit/delete types
- **Category**: Jobs / Inspections

#### March 20, 2026

**`20260320000001_search_jobs_for_reports_add_address.sql`**
- **Purpose**: Add address to job search results for Add Inspection and New Report modals
- **Changes**: Alter `search_jobs_for_reports` RPC to return `address` column; jobs_ledger uses `job_address`, projects uses `address`
- **Impact**: Add Inspection job search displays "Suzy Wilson (HCP: 612) - 8201 Wilke Rd. Kingsbury Tx 78638"; New Report modal also receives address in results
- **Category**: Jobs / Inspections, Reports

**`20260320000000_create_inspections.sql`**
- **Purpose**: Add Inspections tab to Jobs page; scheduled inspections linked to jobs (jobs_ledger or projects)
- **Changes**: Create `inspections` table (id, job_ledger_id, project_id, address, inspection_type, scheduled_date, created_by_user_id, created_at, updated_at); CHECK exactly one of job_ledger_id/project_id; CHECK inspection_type in 8 allowed values; RLS for dev, master, assistant, primary (SELECT/INSERT/UPDATE); devs only for DELETE
- **Impact**: Jobs page Inspections tab with quick links to permit portals, calendar, Add Inspection modal; Dashboard "Upcoming inspection (3 days)" for assistants
- **Category**: Jobs / Inspections

#### March 19, 2026

**`20260319000002_insert_report_rpc.sql`**
- **Purpose**: Add `insert_report` RPC (SECURITY DEFINER) to bypass RLS for estimators
- **Changes**: Create `insert_report(p_template_id, p_field_values, p_job_ledger_id, p_project_id)` function; validates `is_estimator()` and inserts with `created_by_user_id = auth.uid()`
- **Impact**: Estimators use RPC instead of direct insert; fixes persistent "new row violates row-level security policy" when policy-based fix insufficient
- **Category**: Reports / RLS

**`20260319000000_fix_is_estimator_search_path.sql`**
- **Purpose**: Fix search_path for `is_estimator()` SECURITY DEFINER function (same pattern as is_assistant, is_master_or_dev)
- **Changes**: `ALTER FUNCTION public.is_estimator() SET search_path = public`
- **Impact**: Ensures is_estimator() resolves public.users correctly when used in reports RLS policy; may fix "new row violates row-level security policy" for estimators
- **Category**: Reports / RLS

#### March 18, 2026

**`20260318000000_estimators_insert_reports_use_helper.sql`**
- **Purpose**: Fix estimators RLS by using `public.is_estimator()` (SECURITY DEFINER) instead of inline EXISTS
- **Changes**: Drop and recreate "Estimators can insert reports" policy; avoids RLS recursion when policy reads users table
- **Impact**: Estimators can submit Job Reports; fixes "new row violates row-level security policy"
- **Category**: Reports / RLS

#### March 17, 2026

**`20260317000000_fix_estimators_insert_reports.sql`**
- **Purpose**: Fix RLS so estimators can insert reports (fixes "new row violates row-level security policy")
- **Changes**: Drop and recreate "Estimators can insert reports" policy on `public.reports` FOR INSERT
- **Impact**: Estimators (e.g. Juan) can submit Job Reports from Dashboard/Jobs
- **Category**: Reports / RLS

#### March 16, 2026

**`20260316000000_create_hours_days_correct.sql`** *(applied)*
- **Purpose**: Mark days as verified in Hours tab; locks that day from further edits for payroll clarity
- **Changes**: Create `hours_days_correct` table (work_date PK, marked_by, marked_at); RLS same as people_hours (SELECT/INSERT/DELETE)
- **Impact**: Hours tab footer has "Correct" checkbox per day column; when checked, that day's hours are read-only; Pay Stubs Generator payments table shows orange rows for days not marked Correct
- **Category**: People / Pay

#### March 15, 2026

**`20260315000000_create_pay_stub_days.sql`**
- **Purpose**: Per-day allocation when pay stubs are generated; enables mismatch detection when hours change after payment
- **Changes**: Create `pay_stub_days` table (pay_stub_id, person_name, work_date, hours_at_time, rate_at_time, paid_amount); RLS same as pay_stubs; backfill existing pay_stubs with daily allocations from current people_hours and pay_config
- **Impact**: Generate flow now inserts pay_stub_days; clicking person name in Pay History ledger opens annual calendar modal (7×52 grid) with green/yellow/orange/gray day status; YTD earned, paid, unpaid totals
- **Category**: People / Pay

#### March 14, 2026

**`20260314000000_create_pay_stubs.sql`**
- **Purpose**: Ledger of generated pay stubs for employees; supports People → Pay History tab
- **Changes**: Create `pay_stubs` table (id, person_name, period_start, period_end, hours_total, gross_pay, created_at, created_by); RLS same as people_hours (is_pay_approved_master OR is_assistant_of_pay_approved_master) for SELECT/INSERT
- **Impact**: People page Pay History tab shows ledger and generator; users can create pay stubs by person and date range; print to PDF; HTML preview from bulk Generate Pay Reports (**View**) and related flows
- **Category**: People / Pay

#### March 13, 2026

**`20260313000000_allow_estimators_insert_reports.sql`**
- **Purpose**: Fix RLS so estimators can create reports (was causing "new row violates row-level security policy")
- **Changes**: Add policy "Estimators can insert reports" on `public.reports` FOR INSERT WITH CHECK (user is estimator AND created_by_user_id = auth.uid())
- **Impact**: Estimators can now submit Job Reports from Dashboard/Jobs; previously INSERT was blocked
- **Category**: Reports / RLS

**`20260313000001_drop_claim_dev_with_code.sql`**
- **Purpose**: Remove deprecated claim_dev_with_code function (dev promotion now via Settings)
- **Changes**: DROP FUNCTION IF EXISTS public.claim_dev_with_code(text)
- **Category**: Database / Cleanup

#### March 12, 2026

**`20260312000000_add_bids_count_tooling_link.sql`**
- **Purpose**: Add Count Tooling link field to bids (counttooling.com URLs)
- **Changes**: Add `count_tooling_link TEXT` column to `public.bids`
- **Impact**: New Bid and Edit Bid modals include "Count Tooling" URL input between Job Plans and Bid Submission; Submission & Followup panel and PDF exports display the link when present
- **Category**: Bids

### February 2026

#### February 21–31, 2026

**`20260309000000_add_address_to_prospects.sql`**
- **Purpose**: Add address field to prospects
- **Changes**: Add `address TEXT` column to `public.prospects`
- **Impact**: Prospects can store and display address in New Prospect modal, Edit modal, Prospect List (desktop table and mobile cards), Convert tab summary, and Cant Reach section; address pre-fills customer form when converting prospect to customer
- **Category**: Prospects

**`20260310000000_prospect_devs_see_timer_events.sql`**
- **Purpose**: Allow devs to see all prospect_timer_events for Prospects Team tab activity tracking
- **Changes**: Add RLS policy "Devs can see all prospect timer events" on `prospect_timer_events` FOR SELECT USING (public.is_dev())
- **Impact**: Devs can view per-user counts of cards marked/updated on the Prospects Team tab
- **Category**: Prospects / RLS

**`20260310000001_create_user_prospect_quick_notes.sql`**
- **Purpose**: Per-user quick note buttons for Prospects Follow Up (e.g. "left voicemail")
- **Changes**: Create `user_prospect_quick_notes` (id, user_id, label, sequence_order, created_at); RLS for users to manage own rows
- **Impact**: Below comments textarea, above saved comments: quick note buttons appear; clicking fills the comments box so the user can then click Didn't Answer or Answered to add with that tag; users can add and delete their own quick notes via "+ Add" and ×
- **Category**: Prospects

**`20260308000000_add_assistants_share_master_to_invoice_insert.sql`**
- **Purpose**: Fix assistants (e.g. Wendi) unable to create invoices on jobs they see via shared masters
- **Changes**: Add `assistants_share_master(auth.uid(), j.master_user_id)` to INSERT policies for `jobs_ledger_invoices` and `jobs_ledger_payments`; drop and recreate both policies
- **Impact**: Assistants with assistants_share_master access can now create invoices; INSERT matches SELECT/UPDATE/DELETE
- **Category**: Jobs / RLS

**`20260307000002_prospect_email_sent.sql`**
- **Purpose**: Track when user has sent an email to a prospect for a given template
- **Changes**: Create `prospect_email_sent` (prospect_id, user_id, template_key, created_at); RLS for users to see/insert own rows
- **Impact**: Prospects Follow Up mail icon shows envelope-check (green) after user clicks mail icon for that template+prospect
- **Category**: Prospects

**`20260306000000_prospect_copy_subject.sql`**
- **Purpose**: Store subject line per prospect copy template per user; dev defaults in app_settings
- **Changes**: Add `subject_text TEXT` to `user_prospect_copy_templates`; add `prospect_copy_*_subject` keys to `app_settings`
- **Impact**: Edit modal includes Subject field; subject supports same placeholders as body; devs set defaults in Settings
- **Category**: Prospects / Settings

**`20260305000000_add_users_phone.sql`**
- **Purpose**: Store user's phone for My Profile and prospect copy template `[user phone number]` placeholder
- **Changes**: Add `phone TEXT` column to `public.users`
- **Impact**: Settings → My Profile; `[user phone number]` in prospect copy templates
- **Category**: Settings / Prospects

**`20260304000000_prospect_copy_templates.sql`**
- **Purpose**: Per-user copy templates for Prospects Follow Up (No Response, Phone followup, Just checking in)
- **Changes**: Create `user_prospect_copy_templates` (user_id, template_key, body_text); RLS for users to manage own rows
- **Impact**: Follow Up copy section with three template buttons; edit modal with placeholder chips; blank-fields modal when copying with missing data
- **Category**: Prospects

**`20260303000001_prospect_calling_locks.sql`**
- **Purpose**: Prevent multiple users from calling the same prospect; support Option D (Hybrid) for Prospects
- **Changes**: Create `prospect_calling_locks` (prospect_id PK, user_id, locked_at); RLS: SELECT (all), INSERT/UPDATE/DELETE (own)
- **Impact**: Follow Up acquires lock when viewing a prospect; others exclude it from their list; lock released on Next/Cant reach/No longer fit or when switching away
- **Category**: Prospects

**`20260303000000_add_mark_job_paid.sql`**
- **Purpose**: Support marking whole jobs (status=billed) as paid; adds remaining amount to payments
- **Changes**: New RPC `mark_job_paid(p_job_id)`: inserts (revenue - payments_made) into jobs_ledger_payments, updates payments_made, sets status to paid
- **Impact**: Jobs page Stages and Dashboard can "Mark Paid" on whole jobs in Billed; mirrors mark_invoice_paid for partial invoices
- **Category**: Jobs

**`20260302000000_create_jobs_ledger_invoices.sql`**
- **Purpose**: Support partial invoices per job; invoices flow through Ready to Bill → Billed → Paid; jobs stay in Working
- **Changes**: Create `jobs_ledger_invoices` (job_id, amount, status: ready_to_bill | billed | paid, sequence_order); RLS mirrors jobs_ledger_payments. RPC `mark_invoice_paid(p_invoice_id)`: inserts payment, updates payments_made, sets job status to paid when fully paid
- **Impact**: Edit Job modal has "Create partial invoice" section; Stages Ready to Bill and Billed show invoices (not jobs); Dashboard Ready to Bill and Waiting for Payment show invoice rows; Mark as Billed, Mark Paid, Send back actions
- **Category**: Jobs

**`20260301000000_create_jobs_ledger_payments.sql`**
- **Purpose**: Support multiple payments per job; total = sum of amounts; Remaining = Total Bill - total
- **Changes**: Create `jobs_ledger_payments` (job_id, amount, sequence_order); RLS mirrors jobs_ledger_materials (dev, master, assistant, primary). Data migration: insert one row per job where payments_made > 0
- **Impact**: New Job and Edit Job modals show Payments Made as add/remove table; jobs_ledger.payments_made kept in sync on save
- **Category**: Jobs

**`20260226220000_add_payments_made_to_jobs_ledger.sql`**
- **Purpose**: Track amount paid to date per job; Remaining = revenue - payments_made
- **Changes**: Add `payments_made NUMERIC(12, 2) DEFAULT 0` to `public.jobs_ledger`
- **Impact**: New Job and Edit Job modals include Payments Made ($) and Remaining ($); Stages/Dashboard use for Remaining display
- **Category**: Jobs

**`20260231000025_create_prospect_timer_events.sql`**
- **Purpose**: Track time spent prospecting per prospect and per user per day
- **Changes**: Create `prospect_timer_events` (user_id, prospect_id, created_at, timer_seconds, button_name); RLS for users to see/insert own events; indexes on user_id, created_at
- **Impact**: Follow Up saves timer when clicking No Longer a Fit, Next Prospect, or Can't reach; Prospect List shows total time per prospect; "my time" modal shows today/yesterday/7 days/lifetime
- **Category**: Prospects

**`20260231000021_search_jobs_ledger.sql`**
- **Purpose**: Search jobs_ledger for Crew Jobs job picker
- **Changes**: Create `search_jobs_ledger(search_text)` RPC; returns id, hcp_number, job_name, job_address from jobs_ledger filtered by HCP, name, address
- **Impact**: Crew Jobs (Jobs Team Labor, Quickfill) use this for job search modal
- **Category**: Jobs / Quickfill / Crew Jobs

**`20260231000020_create_people_crew_jobs.sql`**
- **Purpose**: Store crew lead and job/percentage assignments per person per day for Crew Jobs
- **Changes**: Create `people_crew_jobs` (work_date, person_name, crew_lead_person_name, job_assignments JSONB); RLS same as people_hours
- **Impact**: Jobs Team Labor tab; Quickfill Crew Jobs; crew members inherit crew lead job breakdown. Crew jobs auto-created from approved clock sessions with `job_ledger_id` (see `20260422120000_approve_clock_sessions_crew_jobs.sql`)
- **Category**: Jobs / Quickfill / Crew Jobs

**`20260231000011_fixture_cost_list_and_po.sql`**
- **Purpose**: Support fixture-only entries sent to office for pricing
- **Changes**: Update `list_tally_parts_with_po` to return fixture_cost, part_id (nullable); update `create_po_from_job_tally` to skip entries where part_id is null
- **Impact**: Jobs Parts tab shows editable fixture cost; fixture-only rows don't create PO items
- **Category**: Jobs / Tally

**`20260231000010_add_fixture_sent_for_pricing.sql`**
- **Purpose**: Allow fixture-only tally entries (sent to office for pricing)
- **Changes**: `jobs_tally_parts.part_id` DROP NOT NULL; add `fixture_cost NUMERIC(10,2)` nullable
- **Impact**: Job Parts Tally can send fixture-only entries; office enters cost in Jobs Parts
- **Category**: Jobs / Tally

**`20260231000000_add_bids_submitted_to.sql`**
- **Purpose**: Add Submitted to (name, phone, email) field for bid submission tracking
- **Changes**: Add `submitted_to TEXT` column to `public.bids`
- **Impact**: Edit Bid and New Bid modals include "Submitted to (name, phone, email):" below Bid Date Sent; RFI tab pulls this value for "The bid was submitted to"
- **Category**: Bids

**`20260230000015_primaries_see_adopted_masters.sql`**
- **Purpose**: Allow primaries to see masters who have adopted them in Send task Notify dropdown
- **Changes**: Update `master_adopted_current_user()` to also check `master_primaries` (previously only checked `master_assistants`)
- **Impact**: Primary users (e.g. Trace) can now see their adopting master (e.g. Malachi) in Dashboard Send task Notify list

**`20260230000016_optimize_projects_rls.sql`**
- **Purpose**: Optimize projects RLS to avoid timeouts
- **Changes**: Add `can_access_project_row()` helper; simplify projects RLS policy to use it
- **Impact**: Faster project list loads, fewer RLS evaluation timeouts
- **Category**: Projects / RLS

**`20260230000017_add_job_plans_link_to_jobs_ledger.sql`**
- **Purpose**: Add Job Plans link field below Google Drive in New/Edit Job form
- **Changes**: Add `job_plans_link TEXT` column to `public.jobs_ledger`
- **Impact**: Jobs Billing tab New Job and Edit Job modals now include a "Job Plans" URL input
- **Category**: Jobs

**`20260230000014_add_notes_to_prospects.sql`**
- **Purpose**: Add notes field for Prospect List notes panel
- **Changes**: Add `notes TEXT` column to `public.prospects`
- **Impact**: Prospect List shows split layout with info card and notes textarea; Save/Cancel persist notes
- **Category**: Prospects

**`20260230000013_add_email_to_prospects.sql`**
- **Purpose**: Add email field to prospects
- **Changes**: Add `email TEXT` column to `public.prospects`
- **Impact**: Email shown in Prospect List (table + mobile cards), Follow Up info block, Convert prospect summary; editable in Edit and New Prospect modals; pre-filled in Convert form
- **Category**: Prospects

**`20260230000012_add_note_to_prospect_callbacks.sql`**
- **Purpose**: Add optional note to prospect callbacks for Set Call back modal
- **Changes**: Add `note TEXT` column to `public.prospect_callbacks`
- **Impact**: Set Call back date and time modal has Note field; Follow Up displays note after callback date, e.g. `2/24/26, 9:26 PM (note-contents)`
- **Category**: Prospects / Callbacks

**`20260229000004_add_users_notes.sql`**
- **Purpose**: Allow Masters, Assistants, and Devs to add/edit general notes on each user in People → Users
- **Changes**: Add `notes text` column to `public.users`; RLS policy "Masters assistants devs can update user notes" for UPDATE
- **Impact**: People page Users tab shows notes after email; Edit (card icon) button opens modal to edit note
- **Category**: People / Users / RLS

**`20260228190000_create_user_dashboard_buttons.sql`**
- **Purpose**: Allow users to configure which Dashboard quick-action buttons are visible
- **Changes**: Create `user_dashboard_buttons` table (user_id, button_key, visible); RLS for dev, master_technician, assistant
- **Impact**: Settings → Dashboard buttons section; Dashboard filters buttons by user preferences
- **Category**: Dashboard / Settings / RLS

**`20260228100000_subcontractors_read_jobs_ledger_team_members.sql`**
- **Purpose**: Fix subcontractor "Submit for review" in Job Tally (RLS violation)
- **Changes**: Add policy allowing subcontractors to read their own rows in jobs_ledger_team_members (user_id = auth.uid())
- **Impact**: Subcontractors can now insert into jobs_tally_parts; the INSERT policy checks team membership via jobs_ledger_team_members, which previously blocked subs from reading that table
- **Category**: Jobs / Job Tally / RLS

**`20260226000000_reports_delete_dev_only.sql`**
- **Purpose**: Restrict report DELETE to devs only
- **Changes**: Split reports RLS; devs/masters/assistants/primary get SELECT, INSERT, UPDATE; devs only get DELETE
- **Impact**: Only devs see Delete button on Jobs Reports tab; RLS blocks delete for other roles
- **Category**: Jobs / Reports / RLS

**`20260225000001_reports_to_realtime.sql`**
- **Purpose**: Dashboard Recent Reports updates immediately when a report is added
- **Changes**: Add reports table to supabase_realtime publication
- **Category**: Dashboard / Realtime

**`20260225000000_primary_jobs_tally_parts.sql`**
- **Purpose**: Allow primaries to add parts in Job Tally page
- **Changes**: Add primary to jobs_tally_parts RLS policies (SELECT, INSERT, UPDATE, DELETE)
- **Impact**: Primaries can save tally parts when adding parts to jobs; fixes "new row violates row-level security policy" error
- **Category**: Jobs / Job Tally / Primary / RLS

**`20260224150000_primary_assembly_book_read.sql`**
- **Purpose**: Allow primaries to read assembly types and templates for adopted masters
- **Changes**: RLS policies for material_templates, material_template_items, assembly_types
- **Category**: Materials / Primary / RLS

**`20260224140000_primary_supply_houses_read.sql`**
- **Purpose**: Allow primaries to read supply houses
- **Changes**: RLS policy for supply_houses
- **Category**: Materials / Primary / RLS

**`20260224130000_allow_users_see_primaries.sql`**
- **Purpose**: Allow users to see primaries in task assignee dropdown and similar pickers
- **Changes**: RLS or view updates for users table
- **Category**: Primary / RLS

**`20260224120000_primary_projects_adoption_access.sql`**
- **Purpose**: Primaries see projects from adopting masters (adoption-based access)
- **Changes**: RLS policies for projects
- **Category**: Primary / Adoption

**`20260224110000_primary_bids_adoption_access.sql`**
- **Purpose**: Primaries see bids from adopting masters
- **Changes**: RLS policies for bids
- **Category**: Primary / Adoption

**`20260224100000_primary_bids_bid_board_access.sql`**
- **Purpose**: Primaries can access bid board for adopted masters
- **Changes**: RLS policies for bid-related tables
- **Category**: Primary / Bids

**`20260224000000_add_primary_service_type_ids.sql`**
- **Purpose**: Restrict primaries to specific service types in Materials (like estimator_service_type_ids)
- **Changes**: Added `primary_service_type_ids` UUID[] to users table
- **Impact**: Devs can limit which service types (Plumbing, Electrical, etc.) a primary sees in Materials
- **Category**: Primary / Materials

**`20260223100000_create_master_primaries.sql`**
- **Purpose**: Track which masters have adopted which primaries
- **Changes**: Created `master_primaries` table (master_id, primary_id); RLS for masters and devs
- **Impact**: Enables adoption-based access for primaries (mirrors master_assistants)
- **Category**: Primary / Adoption

**`20260223000000_primary_add_materials_to_jobs.sql`**
- **Purpose**: Allow primaries to view jobs and add materials to jobs_ledger
- **Changes**: RLS policies for jobs_ledger and jobs_ledger_materials (SELECT, INSERT, UPDATE, DELETE for primaries)
- **Impact**: Primaries can add materials to jobs in Jobs Billing tab; Edit/Delete hidden in UI
- **Category**: Jobs / Primary / RLS

**`20260221210002_primary_materials_access.sql`**
- **Purpose**: Allow primaries to read materials (parts, prices, supply houses)
- **Changes**: RLS policies for material_parts, material_part_prices, supply_houses
- **Category**: Materials / Primary / RLS

**`20260221210001_primary_reports_access.sql`**
- **Purpose**: Allow primaries to access reports
- **Changes**: RLS policies for reports table; list_reports_with_job_info RPC
- **Category**: Jobs / Primary / RLS

**`20260221210000_add_user_role_primary.sql`**
- **Purpose**: Add primary role to users
- **Changes**: Extended role enum or users.role to include 'primary'
- **Category**: Primary / Auth

**`20260222160000_tally_parts_po_status.sql`**, **`20260222150000_tally_parts_po_name.sql`**, **`20260222140000_tally_parts_po_link.sql`**
- **Purpose**: Job Tally PO enhancements (status, name, link)
- **Category**: Jobs / Job Tally

**`20260222120000_create_po_from_job_tally.sql`**, **`20260222130000_po_name_include_time.sql`**
- **Purpose**: Create PO from Job Tally; PO name includes timestamp
- **Category**: Jobs / Job Tally / Materials

**`20260222000000_create_jobs_tally_parts.sql`**
- **Purpose**: Job Tally parts table for tallying materials per job
- **Category**: Jobs / Job Tally

#### February 20–21, 2026

**`20260311120000_add_monthly_payment_day_to_supply_houses.sql`**
- **Purpose**: Add monthly payment day for supply house Due column
- **Changes**: Add `monthly_payment_day INTEGER CHECK (monthly_payment_day >= 1 AND monthly_payment_day <= 31)` to `supply_houses`
- **Impact**: Supply house list Due column uses `monthly_payment_day` (e.g. "15th") instead of invoice due_date; Edit Supply House form includes "Monthly payment date" field
- **Category**: Materials / Supply Houses

**`20260220210000_create_external_team.sql`**
- **Purpose**: External Team section in Materials Supply Houses & External Subs tab
- **Changes**: Created `external_team_sub_managers` (person_id, user_id) and `external_team_job_payments` (person_id, note, amount, is_paid); RLS for dev, master, assistant
- **Impact**: Subcontractors (people kind='sub') can have Sub Manager assigned and job payments tracked; unpaid payments contribute to Outstanding total
- **Category**: Materials / External Team

**`20260220200000_create_jobs_receivables.sql`**
- **Purpose**: Jobs Receivables tab for AR tracking
- **Changes**: Created `jobs_receivables` (master_user_id, payer, point_of_contact, account_rep_name, amount); RLS mirrors jobs_ledger (dev, master, assistant; assistants_share_master)
- **Impact**: Assistants enter Payer, Point Of Contact, Account Rep, Amount to Collect; total displayed at top
- **Category**: Jobs / Receivables

**`20260220190000_create_supply_house_invoices_and_po_link.sql`**
- **Purpose**: Supply Houses tab with invoices and PO linkage
- **Changes**: Created `supply_house_invoices` (supply_house_id, invoice_number, invoice_date, due_date, amount, link, is_paid); added `supply_house_id` to `purchase_orders`; RLS for dev, master, assistant
- **Impact**: Per-supply-house invoice tracking; unpaid invoices sum to AP total; POs can be linked to supply house
- **Category**: Materials / Supply Houses

**`20260220180000_create_app_settings.sql`**
- **Purpose**: App-level settings storage
- **Changes**: Created `app_settings` table
- **Impact**: Centralized app configuration
- **Category**: Settings

**`20260219280000_allow_devs_read_user_pinned_tabs.sql`**
- **Purpose**: Allow devs to read user_pinned_tabs for "Pin for" and Unpin All
- **Changes**: RLS policy for devs to SELECT user_pinned_tabs
- **Category**: Dashboard / Pins

**`20260219270001_fix_jobs_ledger_assistant_visibility_rls.sql`**
- **Purpose**: Fix assistants seeing jobs_ledger for their master
- **Changes**: Updated RLS to use assistants_share_master
- **Category**: Jobs / RLS

**`20260219270000_allow_assistants_see_all_jobs_ledger.sql`**
- **Purpose**: Allow assistants to see jobs_ledger entries for their master
- **Changes**: RLS policy for assistants
- **Category**: Jobs / RLS

**`20260219260000_create_cost_matrix_tag_colors.sql`**
- **Purpose**: Tag colors for Cost matrix
- **Changes**: Created cost_matrix_tag_colors table (tag TEXT PK, color TEXT)
- **Category**: People / Pay
- **Note**: If build fails with "cost_matrix_tag_colors" not in types, add the table to `src/types/database.ts` or run `supabase gen types typescript`

**`20260219250000_create_people_cost_matrix_tags.sql`**
- **Purpose**: Cost matrix tags per person
- **Changes**: Created people_cost_matrix_tags table
- **Category**: People / Pay

**`20260219240000_create_jobs_ledger_fixtures.sql`**
- **Purpose**: Jobs ledger fixture tracking
- **Changes**: Created jobs_ledger_fixtures table
- **Category**: Jobs

**`20260219230000_allow_devs_delete_user_pinned_tabs.sql`**
- **Purpose**: Allow devs to delete pins (Unpin All)
- **Changes**: RLS policy for devs to DELETE user_pinned_tabs
- **Category**: Dashboard / Pins

**`20260219220000_add_user_pinned_tabs_to_realtime.sql`**
- **Purpose**: Realtime for Dashboard pins
- **Changes**: Added user_pinned_tabs to supabase_realtime publication
- **Category**: Dashboard / Realtime

**`20260219210000_create_customer_contact_persons.sql`**
- **Purpose**: Customer contact persons
- **Changes**: Created customer_contact_persons table
- **Category**: Customers

**`20260219200000_create_user_pinned_tabs.sql`**
- **Purpose**: Store pins for users (e.g. dev "Pin for")
- **Changes**: Created user_pinned_tabs (user_id, path, label, tab); RLS for own pins, dev manage
- **Impact**: Dashboard shows pinned links; dev can pin AR, Supply Houses AP, External Team, Cost matrix for masters/devs
- **Category**: Dashboard / Pins

**`20260219180000_allow_all_to_see_labor_jobs_in_scope.sql`**
- **Purpose**: Broaden labor jobs visibility
- **Changes**: RLS for people_labor_jobs and people_labor_job_items
- **Category**: Jobs / Labor

#### February 18, 2026

**`20260218000002_add_people_hours_to_realtime.sql`**
- **Purpose**: Enable Realtime for people_hours so Pay/Hours tabs update when any user changes hours
- **Changes**: Adds `people_hours` to `supabase_realtime` publication (idempotent via pg_publication_tables check)
- **Impact**: When Dev, Master, or Assistant updates hours in Hours tab, all users viewing Pay tab see the Cost matrix update automatically without refresh
- **Category**: People / Pay / Realtime

**`20260218000001_schedule_reminder_cron.sql`**
- **Purpose**: Schedule send-scheduled-reminders Edge Function every 15 minutes
- **Changes**: Enables pg_cron and pg_net; creates cron job invoking `/functions/v1/send-scheduled-reminders` with X-Cron-Secret from Vault
- **Prerequisites**: Vault secrets `project_url`, `cron_secret`; Edge Function secret `CRON_SECRET`; pg_cron and pg_net enabled in Dashboard
- **Impact**: Assignees with incomplete tasks receive push reminders at configured times (CST)
- **Category**: Checklist / Notifications

**`20260218000000_add_checklist_reminder_fields.sql`**
- **Purpose**: Per-item scheduled reminders (dev-only)
- **Changes**: Added `reminder_time` (time, nullable) and `reminder_scope` (text, 'today_only' | 'today_and_overdue') to `checklist_items`
- **Impact**: Dev can set reminder time (CST) and scope on each checklist item in Manage tab; send-scheduled-reminders uses these
- **Category**: Checklist

#### February 17, 2026

**`20260217230000_add_material_parts_service_type_name_index.sql`**
- **Purpose**: Reduce disk IO for Materials Price Book queries
- **Changes**: Added composite index `idx_material_parts_service_type_name` on (service_type_id, name)
- **Impact**: Faster parts loading when filtering by service type and ordering by name
- **Category**: Materials / Performance

**`20260217210000_create_cost_matrix_teams_shares.sql`**
- **Purpose**: Share Cost Matrix and Teams with selected masters/assistants (view-only)
- **Changes**: Created `cost_matrix_teams_shares` (shared_with_user_id); `is_cost_matrix_shared_with_current_user()`; RLS for dev manage, shared users SELECT; added SELECT policies for shared users on people_pay_config, people_teams, people_team_members, people_hours
- **Impact**: Dev can grant view-only Cost matrix and Teams access; shared users see Cost matrix and Teams but cannot edit
- **Category**: People / Pay

**`20260217200000_allow_masters_assistants_read_push_subscriptions.sql`**
- **Purpose**: Allow masters and assistants to see push notification status (green dot) in People
- **Changes**: Added RLS policy on `push_subscriptions` for role in (master_technician, assistant)
- **Impact**: Masters and assistants see green dot next to users with push notifications enabled
- **Category**: Notifications

**`20260217070000_checklist_repeat_days_of_week_array.sql`**
- **Purpose**: Support multiple days per week for weekly checklist repeats
- **Changes**: Added `repeat_days_of_week` (integer[]); migrated from `repeat_day_of_week`; dropped `repeat_day_of_week`
- **Impact**: Add/Edit checklist item shows 7 checkboxes (Sun–Sat) instead of single dropdown
- **Category**: Checklist

**`20260217060000_allow_assignees_read_checklist_items.sql`**
- **Purpose**: Allow assignees to read checklist items (for Today/History views)
- **Changes**: RLS policy for checklist_items allowing assigned users to read
- **Impact**: Users can see their checklist items in Today and History tabs
- **Category**: Checklist

**`20260217041500_create_push_subscriptions.sql`**
- **Purpose**: Store Web Push subscriptions for checklist and workflow notifications
- **Changes**: Created `push_subscriptions` (user_id, endpoint, p256dh_key, auth_key); RLS for own subscriptions
- **Impact**: Settings push notifications; send-checklist-notification Edge Function
- **Category**: Notifications

**`20260217050000_create_checklist.sql`**
- **Purpose**: Checklist system for recurring tasks
- **Changes**: Created `checklist_items`, `checklist_instances`; `is_dev_or_master_or_assistant()`; RLS for dev/master/assistant manage, assignees read/update own instances
- **Impact**: Checklist page (Today, History, Manage tabs); repeat types: day_of_week, days_after_completion, once
- **Category**: Checklist

#### February 13, 2026

**`20260213000007_create_people_hours_display_order.sql`**
- **Purpose**: Custom order for people in Hours tab
- **Changes**: Created `people_hours_display_order` (person_name, sequence_order); RLS for pay-access users
- **Impact**: Users can reorder people in Hours timesheet via up/down buttons
- **Category**: People / Pay

**`20260213000006_restrict_show_in_hours_to_dev.sql`**
- **Purpose**: Restrict Show in Hours toggle to dev only
- **Changes**: Added trigger on `people_pay_config` to reject show_in_hours updates from non-dev users
- **Impact**: Only dev can control who appears in Hours tab; defense in depth
- **Category**: People / Pay

**`20260213000005_allow_all_assistants_hours.sql`**
- **Purpose**: Allow all assistants of approved masters to read/write people hours
- **Changes**: Updated people_hours RLS to use `is_assistant_of_pay_approved_master()`
- **Impact**: Assistants of Pay Approved Masters can enter timesheet hours
- **Category**: People / Pay

**`20260213000004_add_show_in_cost_matrix.sql`**
- **Purpose**: Control who appears in Cost matrix and Teams
- **Changes**: Added `show_in_cost_matrix` (BOOLEAN, default false) to `people_pay_config`
- **Impact**: Per-person toggle to include/exclude from Cost matrix and Teams
- **Category**: People / Pay

**`20260213000003_create_people_teams.sql`**
- **Purpose**: Create teams for combined cost tracking
- **Changes**: Created `people_teams` (id, name) and `people_team_members` (team_id, person_name); RLS for pay-access users
- **Impact**: Pay tab Teams section; add teams, assign people, view combined cost for date range
- **Category**: People / Pay

**`20260213000002_create_people_hours.sql`**
- **Purpose**: Store hours worked per person per day
- **Changes**: Created `people_hours` (person_name, work_date, hours, entered_by); RLS for dev, approved masters, assistants
- **Impact**: Hours tab timesheet; editable for hourly people, read-only for salary (8 hrs/day)
- **Category**: People / Pay

**`20260314000000_create_pay_stubs.sql`**
- **Purpose**: Ledger of generated pay stubs for employees
- **Changes**: Created `pay_stubs` (person_name, period_start, period_end, hours_total, gross_pay, created_at, created_by); RLS same as people_hours
- **Impact**: People → Pay History tab; ledger, generators, print; HTML **View** in bulk modal
- **Category**: People / Pay

**`20260315000000_create_pay_stub_days.sql`**
- **Purpose**: Per-day paid allocation for mismatch detection
- **Changes**: Created `pay_stub_days` (pay_stub_id, person_name, work_date, hours_at_time, rate_at_time, paid_amount); backfill from existing pay_stubs
- **Impact**: Annual calendar modal when clicking person name; green/yellow/orange/gray day status; YTD totals
- **Category**: People / Pay

**`20260213000001_create_people_pay_config.sql`**
- **Purpose**: Per-person pay configuration
- **Changes**: Created `people_pay_config` (person_name, hourly_wage, is_salary, show_in_hours); RLS for dev and approved masters
- **Impact**: Pay tab People pay config; wage, salary flag, Show in Hours toggle
- **Category**: People / Pay

**`20260213000000_create_pay_approved_masters.sql`**
- **Purpose**: Control access to Pay and Hours tabs
- **Changes**: Created `pay_approved_masters` (user_id); `is_pay_approved_master()` and `is_assistant_of_pay_approved_master()` functions; Settings section to manage approved masters
- **Impact**: Only dev and approved masters see Pay/Hours; assistants of approved masters see Hours
- **Category**: People / Pay

#### February 12, 2026

**`20260212260000_add_job_date_to_people_labor_jobs.sql`**
- **Purpose**: Add optional job date to labor jobs
- **Changes**: Added `job_date` (DATE, nullable) to `people_labor_jobs`
- **Impact**: When set, used for display in Ledger and print for sub; otherwise `created_at` is used
- **Category**: People / Labor

**`20260212250000_add_job_number_to_people_labor_jobs.sql`**
- **Purpose**: Add optional job number to labor jobs
- **Changes**: Added `job_number` (VARCHAR(10), nullable) to `people_labor_jobs`
- **Impact**: Shown in Labor form, Ledger, and print for sub
- **Category**: People / Labor

**`20260212240000_allow_estimators_see_masters.sql`**
- **Purpose**: Allow estimators to see masters in Customer Owner dropdown
- **Root Cause**: RLS blocked estimators from reading master_technician/dev users, causing "No masters found"
- **Changes**: Created `is_estimator()` SECURITY DEFINER function; added SELECT policy for estimators on users where role IN ('master_technician', 'dev')
- **Impact**: Estimators can add customers via Bids modal and select a master as owner
- **Category**: Access Control / RLS

**`20260212230000_allow_viewing_masters_see_sharing_masters.sql`**
- **Purpose**: Allow viewing masters and their assistants to see sharing masters' user rows
- **Root Cause**: "Created by [name]" showed "Unknown" when viewing shared people because users table RLS blocked reading dev/master rows
- **Changes**: Created `can_see_sharing_master()` SECURITY DEFINER function; added SELECT policy on users
- **Impact**: Creator names display correctly for shared people
- **Category**: Access Control / RLS

**`20260212220000_allow_assistants_read_master_shares_for_viewing.sql`**
- **Purpose**: Allow assistants to read master_shares where they assist the viewing master
- **Changes**: Added SELECT policy on `master_shares` for assistants whose master is the viewing_master_id
- **Impact**: Assistants (e.g., Taunya) can see people and labor jobs shared with their master (e.g., Malachi)
- **Category**: Access Control / RLS

**`20260212210000_add_master_shares_to_people.sql`**
- **Purpose**: Add master_shares support to people, people_labor_jobs, people_labor_job_items
- **Changes**: Added SELECT policies for shared access via master_shares and master_assistants; when Dev shares with another Master, both that Master and their assistants can see shared people and labor jobs
- **Impact**: Shared people and ledger visible to viewing master and their assistants
- **Category**: Access Control / People

**`20260212200000_add_is_fixed_to_people_labor_job_items.sql`**
- **Purpose**: Support fixed labor hours (like cost_estimate_labor_rows)
- **Changes**: Added `is_fixed` (BOOLEAN, default false) to `people_labor_job_items`; when true, labor hours = hrs_per_unit (count ignored)
- **Impact**: Labor form supports fixed-rate items
- **Category**: People / Labor

**`20260212190000_create_people_labor_jobs.sql`**
- **Purpose**: Create People Labor and Ledger tables
- **Changes**: Created `people_labor_jobs` (assigned_to_name, address, labor_rate) and `people_labor_job_items` (fixture, count, hrs_per_unit, sequence_order); RLS for dev, master, assistant, estimator
- **Impact**: Labor tab and Ledger tab on People page
- **Category**: People / Labor

**`20260212180000_add_estimator_cost_to_cost_estimates.sql`**
- **Purpose**: Add estimator cost parameters to cost estimates (per-count-type or flat amount)
- **Changes**:
  - Added `estimator_cost_per_count` (numeric(10,2), default 10) to `cost_estimates`
  - Added `estimator_cost_flat_amount` (numeric(10,2), nullable) to `cost_estimates`
- **Impact**: Enables estimator cost in Labor Total on Cost Estimate, Pricing, prints, and PDFs

**`20260212170000_add_service_type_filter_to_parts_price_count.sql`**
- **Purpose**: Make Price Book "Sort by #" respect the selected service type and enable Part Type/Manufacturer filters
- **Changes**:
  - Added optional `filter_service_type_id` (uuid, default NULL) parameter to `get_parts_ordered_by_price_count`
  - When provided, filters results to parts belonging to that service type
- **Impact**: Materials Price Book tab correctly filters by Plumbing/Electrical/HVAC when sorting by price count; Part Type and Manufacturer dropdowns now work
- **Category**: Materials Enhancement / Database

#### February 11, 2026

**`20260211200000_create_counts_fixture_groups.sql`**
- **Purpose**: Configurable quick-select groups for adding count rows in Bids
- **Changes**:
  - Created `counts_fixture_groups` (id, service_type_id, label, sequence_order)
  - Created `counts_fixture_group_items` (id, group_id, name, sequence_order)
  - RLS: All authenticated users can read; only devs can insert/update/delete
  - Seeded Plumbing fixture groups (Bathrooms, Kitchen, Laundry, Plumbing Fixtures, Appliances)
- **Impact**: Fixture quick-adds in Bids Counts are now managed per service type in Settings → Counts Quick-adds
- **Category**: Bids Enhancement / Settings

**`20260211210000_allow_devs_update_delete_people.sql`**
- **Purpose**: Allow devs to edit and delete people entries created by other users
- **Changes**:
  - Added "Devs can update any people" policy (UPDATE using is_dev())
  - Added "Devs can delete any people" policy (DELETE using is_dev())
- **Impact**: Devs can rename, update email/phone/notes, and delete people in Settings → People Created by Other Users
- **Category**: Access Control / Settings

#### February 10, 2026

**`add_fixed_price_to_pricing_assignments.sql`**
- **Purpose**: Add fixed price feature for flat-rate pricing in Bids Pricing tab
- **Root Cause**: Revenue calculations always multiplied price by count, which doesn't work for flat-rate items (permits, delivery fees, one-time charges)
- **Changes**:
  - Added `is_fixed_price` (BOOLEAN, default false) column to `bid_pricing_assignments`
  - Created index on `is_fixed_price` for query performance
  - Added column comment explaining behavior
- **Impact**: Users can now mark pricing assignments as fixed price to bypass count multiplication
- **Behavior**: 
  - Unchecked (default): Revenue = Price × Count
  - Checked: Revenue = Price (ignores count)
- **Category**: Bids Enhancement / User Feature

#### February 8, 2026

**`restrict_supply_house_deletion_to_devs.sql`**
- **Purpose**: Restrict supply house deletion to dev role only
- **Root Cause**: All roles (dev, master, assistant, estimator) could delete supply houses, risking accidental data loss
- **Changes**: Changed DELETE RLS policy to only allow 'dev' role
- **Impact**: Only devs can delete supply houses; UI delete button hidden for other roles
- **Category**: Access Control / Data Protection

**`preserve_price_history_on_deletion.sql`**
- **Purpose**: Preserve all price history records permanently, even after part/supply house deletion
- **Root Cause**: CASCADE constraints deleted historical pricing data when business entities were removed
- **Changes**: 
  - Made part_id and supply_house_id nullable
  - Changed both FK constraints from ON DELETE CASCADE to ON DELETE SET NULL
- **Impact**: Price history is now truly permanent; orphaned records show pricing trends even for deleted items
- **Category**: Database Improvements / Data Preservation

**`fix_price_history_user_deletion.sql`**
- **Purpose**: Allow user deletion when they have price history records
- **Root Cause**: NO ACTION constraint blocked deletion if user had changed_by records in material_part_price_history
- **Changes**: Changed material_part_price_history.changed_by FK to ON DELETE SET NULL
- **Impact**: Users can be deleted smoothly; price history preserved but attribution nulled
- **Category**: Database Improvements / User Management

#### February 7, 2026

**`fix_masters_see_other_masters_recursion.sql`**
- **Purpose**: Fix infinite recursion in "Masters and devs can see other masters" policy
- **Root Cause**: Policy used EXISTS on users table causing infinite loop
- **Changes**: 
  - Created `is_master_or_dev()` SECURITY DEFINER helper function
  - Dropped and recreated policy using the helper function
- **Impact**: Masters can now see other masters without recursion errors
- **Category**: RLS Bug Fix

**`allow_masters_see_other_masters.sql`**
- **Purpose**: Allow masters to see other masters in "Share with other Master" feature
- **Root Cause**: Missing SELECT policy - masters could not query other master_technician users
- **Changes**: Added SELECT policy allowing masters and devs to view all master_technician users
- **Impact**: Initial fix (had recursion bug, fixed by next migration)
- **Category**: Access Control / RLS Bug Fix

**`allow_assistants_update_customers.sql`**
- **Purpose**: Allow assistants to update customer information
- **Root Cause**: Missing UPDATE policy - assistants could SELECT and INSERT customers but not UPDATE them
- **Changes**: Added UPDATE policy for assistants matching INSERT policy logic
- **Impact**: Assistants can now edit customer details for customers owned by masters who have adopted them
- **Category**: Access Control / RLS

**`fix_cost_estimates_rls_for_assistants.sql`**
- **Purpose**: Fix RLS policies to allow assistants to create cost estimates
- **Root Cause**: INSERT policy had flawed logic with redundant/complex nested EXISTS checks
- **Changes**: 
  - Dropped all 4 existing policies (SELECT, INSERT, UPDATE, DELETE)
  - Created simplified policies that only check user role
  - Aligned with bids table access pattern (all dev/master/assistant/estimator users can access)
- **Impact**: Assistants can now create/edit cost estimates without RLS errors
- **Category**: RLS Bug Fix

#### February 6, 2026

**`add_unique_constraint_to_price_book_versions.sql`**
- **Purpose**: Ensure unique price book version names
- **Changes**: Added UNIQUE constraint on `price_book_versions.name`
- **Impact**: Prevents duplicate version names
- **Category**: Data Integrity

**`add_cost_estimate_driving_cost_fields.sql`**
- **Purpose**: Add driving cost calculation fields
- **Changes**: 
  - Added `driving_cost_rate` (NUMERIC(10,2), default 0.70) to `cost_estimates`
  - Added `hours_per_trip` (NUMERIC(10,2), default 2.0) to `cost_estimates`
- **Impact**: Enables automatic driving cost calculation in Cost Estimate tab
- **Formula**: `(Total Hours / Hours Per Trip) × Rate Per Mile × Distance to Office`
- **Category**: Bids Enhancement

#### February 5, 2026

**`create_parts_with_price_count_function.sql`**
- **Purpose**: Server-side sorting by price count
- **Changes**: Created `get_parts_ordered_by_price_count(ascending_order BOOLEAN)` function
- **Returns**: Array of part UUIDs sorted by price count
- **Impact**: Enables sorting all parts by price count (not just current page)
- **Category**: Materials Performance

**`create_supply_house_stats_function.sql`**
- **Purpose**: Supply house statistics and coverage
- **Changes**: Created `get_supply_house_price_counts()` function
- **Returns**: Table of `(supply_house_id, name, price_count)` sorted by count DESC
- **Impact**: Shows pricing coverage stats in Supply Houses modal
- **Category**: Materials Performance

**`update_people_kind_constraint.sql`**
- **Purpose**: Update people table constraints
- **Changes**: Modified CHECK constraint on `people.kind` enum
- **Impact**: Ensures valid kind values (assistant, master_technician, sub)
- **Category**: Data Integrity

#### February 4, 2026

**`create_transaction_functions.sql`**
- **Purpose**: Atomic multi-step operations with rollback
- **Changes**: Created 4 database functions:
  1. `create_project_with_template()` - Atomic project + workflow creation
  2. `duplicate_purchase_order()` - Atomic PO duplication
  3. `copy_workflow_step()` - Atomic step copying with sequence update
  4. `create_takeoff_entry_with_items()` - Atomic takeoff entry creation
- **Impact**: Prevents partial data on failures, better reliability
- **Category**: Database Improvements

**`add_data_integrity_constraints.sql`**
- **Purpose**: Prevent invalid data at database level
- **Changes**:
  - CHECK `purchase_order_items.quantity > 0`
  - CHECK `bids_count_rows.count >= 0`
  - CHECK `material_part_prices.price >= 0`
  - UNIQUE INDEX on `material_template_items(template_id, part_id)` WHERE item_type='part'
  - Updated FK cascading for `projects.master_user_id` (ON DELETE SET NULL)
- **Impact**: Database rejects invalid data before it corrupts system
- **Category**: Data Integrity

**`add_cascading_customer_master_to_projects.sql`**
- **Purpose**: Maintain customer-project master consistency
- **Changes**: Created trigger `cascade_customer_master_to_projects()`
- **Logic**: When `customers.master_user_id` changes, automatically updates `projects.master_user_id` for all customer's projects
- **Impact**: No orphaned projects with wrong master assignment
- **Category**: Database Improvements

**`add_updated_at_triggers.sql`**
- **Purpose**: Automatic timestamp management
- **Changes**:
  - Created reusable trigger function `update_updated_at_column()`
  - Applied BEFORE UPDATE triggers to 20 tables
- **Tables**: bids, customers, projects, material_parts, purchase_orders, workflow_steps, and 14 others
- **Impact**: Eliminates manual timestamp management, ensures consistency
- **Category**: Database Improvements

**`allow_assistants_insert_customers.sql`**
- **Purpose**: Let assistants create customers
- **Changes**: New INSERT policy on `customers` for assistants
- **Logic**: Assistants can create when selecting master who adopted them
- **Impact**: Assistants can add customers for their masters
- **Category**: Access Control

**`add_bids_loss_reason.sql`**
- **Purpose**: Track why bids were lost
- **Changes**: Added `loss_reason` (TEXT, nullable) to `bids` table
- **Impact**: Better bid outcome analysis
- **Category**: Bids Enhancement

**`add_takeoff_book_entry_items.sql`**
- **Purpose**: Support multiple template/stage pairs per takeoff entry
- **Changes**:
  - Created `takeoff_book_entry_items` table
  - Migrated existing `template_id` and `stage` from `takeoff_book_entries` to items
  - One entry can now have multiple (Template, Stage) pairs
- **Impact**: More flexible takeoff book mappings
- **Category**: Bids Enhancement

**`add_takeoff_book_entries_alias_names.sql`**
- **Purpose**: Support alternative fixture names in takeoff book
- **Changes**: Added `alias_names` (TEXT[], default '{}') to `takeoff_book_entries`
- **Impact**: Entries match multiple fixture name variations
- **Category**: Bids Enhancement

#### February 3, 2026

**`add_labor_book_entries_alias_names.sql`**
- **Purpose**: Support alternative fixture names in labor book
- **Changes**: Added `alias_names` (TEXT[], default '{}') to `labor_book_entries`
- **Impact**: Entries match multiple fixture name variations
- **Category**: Bids Enhancement

**`add_bids_outcome_started_or_complete.sql`**
- **Purpose**: Add new bid outcome option
- **Changes**: Updated `bids.outcome` CHECK constraint to include `'started_or_complete'`
- **Impact**: Better tracking of bid lifecycle
- **Category**: Bids Enhancement

#### February 2, 2026

**`add_bids_bid_submission_link.sql`**
- **Purpose**: Track bid submission URLs
- **Changes**: Added `bid_submission_link` (TEXT, nullable) to `bids`
- **Impact**: Link to submitted bid documents
- **Category**: Bids Enhancement

**`add_bids_design_drawing_plan_date.sql`**
- **Purpose**: Track design drawing plan dates
- **Changes**: Added `design_drawing_plan_date` (DATE, nullable) to `bids`
- **Impact**: Project planning timeline tracking
- **Category**: Bids Enhancement

**`allow_masters_see_all_bids.sql`**
- **Purpose**: Update bids RLS for proper access
- **Changes**: Updated SELECT, INSERT, UPDATE, DELETE policies on bids and related tables
- **Impact**: Masters can see and manage bids properly
- **Category**: Access Control

**`create_takeoff_book_versions_and_entries.sql`**
- **Purpose**: Create takeoff book system
- **Changes**:
  - Created `takeoff_book_versions` table
  - Created `takeoff_book_entries` table (before entry_items split)
  - RLS policies for dev, master, assistant, estimator
- **Impact**: Standardized fixture-to-template mappings
- **Category**: Bids Enhancement

**`add_bids_selected_takeoff_book_version.sql`**
- **Purpose**: Link bids to takeoff book versions
- **Changes**: Added `selected_takeoff_book_version_id` (UUID, FK, nullable) to `bids`
- **Impact**: Persist takeoff book selection per bid
- **Category**: Bids Enhancement

**`create_labor_book_versions_and_entries.sql`**
- **Purpose**: Create labor book system
- **Changes**:
  - Created `labor_book_versions` table
  - Created `labor_book_entries` table with hours per stage
  - Seeded "Default" version with sample entries
  - RLS policies for dev, master, assistant, estimator
- **Impact**: Standardized labor hour estimates
- **Category**: Bids Enhancement

**`add_bids_selected_labor_book_version.sql`**
- **Purpose**: Link bids to labor book versions
- **Changes**: Added `selected_labor_book_version_id` (UUID, FK, nullable) to `bids`
- **Impact**: Persist labor book selection per bid
- **Category**: Bids Enhancement

#### February 1, 2026

**`add_bid_pricing_assignments_version.sql`**
- **Purpose**: Link pricing assignments to price book versions
- **Changes**: Added version tracking to bid pricing assignments
- **Impact**: Version-aware pricing assignments
- **Category**: Bids Enhancement

**`create_price_book_versions_and_entries.sql`**
- **Purpose**: Create price book system
- **Changes**:
  - Created `price_book_versions` table
  - Created `price_book_entries` table with prices per stage
  - RLS policies for dev, master, assistant, estimator
- **Impact**: Standardized fixture pricing for margin analysis
- **Category**: Bids Enhancement

**`create_bid_pricing_assignments.sql`**
- **Purpose**: Link count rows to price book entries
- **Changes**:
  - Created `bid_pricing_assignments` table
  - UNIQUE constraint on `(bid_id, count_row_id)`
  - RLS follows bid access
- **Impact**: Persist fixture-to-entry assignments for margin tracking
- **Category**: Bids Enhancement

**`add_bids_selected_price_book_version.sql`**
- **Purpose**: Link bids to price book versions
- **Changes**: Added `selected_price_book_version_id` (UUID, FK, nullable) to `bids`
- **Impact**: Persist price book selection per bid
- **Category**: Bids Enhancement

**`revert_price_book_and_bids_job_type.sql`**
- **Purpose**: Rollback migration (if needed)
- **Changes**: Drops price book tables and `bids.job_type` column
- **Impact**: Allows reverting price book feature
- **Category**: Rollback

**`add_purchase_orders_stage.sql`**
- **Purpose**: Track PO stage association
- **Changes**: Added `stage` (TEXT, nullable) to `purchase_orders`
- **Impact**: Link POs to specific workflow stages
- **Category**: Materials Enhancement

---

## Migrations by Category

### Database Improvements (Infrastructure)

**Automatic Timestamp Management**:
- `add_updated_at_triggers.sql` (Feb 4, 2026)
  - 20 tables with automatic `updated_at` triggers
  - Reusable `update_updated_at_column()` function

**Cascading Updates**:
- `add_cascading_customer_master_to_projects.sql` (Feb 4, 2026)
  - Maintains customer-project master consistency
  - Automatic propagation of ownership changes

**Data Integrity Constraints**:
- `add_data_integrity_constraints.sql` (Feb 4, 2026)
  - 4 CHECK constraints (positive quantities, non-negative counts/prices)
  - 1 UNIQUE INDEX (no duplicate parts per template)

**Atomic Transaction Functions**:
- `create_transaction_functions.sql` (Feb 4, 2026)
  - 4 functions for complex multi-step operations
  - Automatic rollback on failure

### Bids System Enhancements

**Core Bids Features**:
- `create_bids.sql` - Initial bids table
- `add_bids_customer_id.sql` - Link to customers table
- `split_bids_project_name_and_address.sql` - Separate fields
- `add_bids_estimated_job_start_date.sql` (Feb 1-4, 2026)
- `add_bids_gc_contact.sql` - Project contact fields
- `add_bids_estimator_id.sql` - Estimator assignment
- `add_bids_loss_reason.sql` (Feb 4, 2026)
- `add_bids_outcome_started_or_complete.sql` (Feb 3, 2026)
- `add_bids_design_drawing_plan_date.sql` (Feb 2, 2026)
- `add_bids_bid_submission_link.sql` (Feb 2, 2026)

**Takeoff Book System**:
- `create_takeoff_book_versions_and_entries.sql` (Feb 2, 2026)
- `add_takeoff_book_entries_alias_names.sql` (Feb 4, 2026)
- `add_takeoff_book_entry_items.sql` (Feb 4, 2026) - Multiple templates per entry
- `add_bids_selected_takeoff_book_version.sql` (Feb 2, 2026)

**Labor Book System**:
- `create_labor_book_versions_and_entries.sql` (Feb 2, 2026)
- `add_labor_book_entries_alias_names.sql` (Feb 3, 2026)
- `add_bids_selected_labor_book_version.sql` (Feb 2, 2026)

**Price Book System**:
- `create_price_book_versions_and_entries.sql` (Feb 1, 2026)
- `create_bid_pricing_assignments.sql` (Feb 1, 2026)
- `add_bid_pricing_assignments_version.sql` (Feb 2, 2026)
- `add_bids_selected_price_book_version.sql` (Feb 1, 2026)
- `add_unique_constraint_to_price_book_versions.sql` (Feb 6, 2026)
- `add_fixed_price_to_pricing_assignments.sql` (Feb 10, 2026) - Fixed price feature for flat-rate items

**Cost Estimate Enhancements**:
- `create_cost_estimates.sql` - Initial cost estimates
- `create_cost_estimate_labor_rows.sql` - Labor hours table
- `add_cost_estimate_driving_cost_fields.sql` (Feb 6, 2026)
- `fix_cost_estimates_rls_for_assistants.sql` (Feb 7, 2026) - Simplified RLS policies

**Counts and Submission**:
- `create_bids_count_rows.sql` - Fixture counts
- `add_bids_count_rows_page.sql` - Plan page reference
- `create_bids_submission_entries.sql` - Submission tracking

### Materials System Enhancements

**Performance Functions**:
- `create_supply_house_stats_function.sql` (Feb 5, 2026)
  - Function: `get_supply_house_price_counts()`
  - Returns: Coverage statistics per supply house
- `create_parts_with_price_count_function.sql` (Feb 5, 2026)
  - Function: `get_parts_ordered_by_price_count(ascending_order)`
  - Returns: Part IDs sorted by price count
- `20260212170000_add_service_type_filter_to_parts_price_count.sql` (Feb 12, 2026)
  - Function: Added `filter_service_type_id` parameter to `get_parts_ordered_by_price_count`
  - Price Book filters by service type when sorting by price count

**Core Materials**:
- `create_supply_houses.sql` - Supply house management
- `create_material_parts.sql` - Parts catalog
- `create_material_part_prices.sql` - Price book
- `create_material_templates.sql` - Template system
- `create_purchase_orders.sql` - PO management

**Purchase Order Features**:
- `add_finalized_notes_tracking.sql` - Add-only notes for finalized POs
- `add_purchase_orders_stage.sql` (Feb 1, 2026) - Stage association
- `add_purchase_order_to_line_items.sql` - Link POs to workflow line items

**Price Tracking**:
- `create_price_history_trigger.sql` - Automatic price change logging
- `add_price_confirmation_fields.sql` - Assistant price confirmation

### Workflow Enhancements

**Financial Tracking**:
- `add_private_notes_to_workflow_steps.sql` - Private notes field
- `create_workflow_step_line_items.sql` - Line items per stage
- `create_workflow_projections.sql` - Workflow-level projections
- `add_link_to_line_items.sql` - URL field for external references
- `20270329210000_workflow_step_line_items_item_date.sql` - Optional `item_date` on line items

**Action Tracking**:
- `create_project_workflow_step_actions.sql` - Action history ledger
- Tracks: started, completed, approved, rejected, reopened

**Rejection Workflow**:
- `add_next_step_rejection_fields.sql` - Cascading rejection notices

### Access Control and RLS

**Master-Assistant System**:
- `create_master_assistants.sql` - Adoption relationships
- `update_customers_rls_for_master_sharing.sql`
- `update_projects_rls_for_master_sharing.sql`
- `update_project_workflows_rls_for_master_sharing.sql`
- `update_project_workflow_steps_rls_for_master_sharing.sql`
- `update_workflow_step_line_items_rls_for_master_sharing.sql`
- `update_workflow_projections_rls_for_master_sharing.sql`

**Master Sharing**:
- `create_master_shares.sql` - Master-to-master sharing

**RLS Optimizations**:
- `20250310120000_optimize_bid_pricing_rls.sql` - can_access_bid_for_pricing for bid_pricing_assignments and bid_count_row_custom_prices
- `optimize_rls_for_master_sharing.sql` - Helper function pattern to prevent timeouts
- `optimize_workflow_step_line_items_rls.sql` - Can access project via step
- `fix_project_workflow_step_actions_rls.sql` - Can access step for action
- `optimize_workflow_templates_rls.sql` - Evaluates auth functions once per query
- `fix_users_rls_for_project_masters.sql` - Prevents recursion with SECURITY DEFINER

**Role-Specific Access**:
- `allow_assistants_access_bids.sql` - Assistants full bids access
- `allow_assistants_insert_customers.sql` - Assistants can create customers
- `allow_assistants_update_customers.sql` (Feb 7, 2026) - Assistants can edit customers
- `allow_masters_see_other_masters.sql` (Feb 7, 2026) - Masters can view other masters for sharing
- `allow_estimators_access_bids.sql` - Estimators full bids access
- `allow_estimators_select_customers.sql` (Feb 4, 2026) - Estimators SELECT/INSERT customers
- `20260212220000_allow_assistants_read_master_shares_for_viewing.sql` (Feb 12, 2026) - Assistants read master_shares
- `20260212230000_allow_viewing_masters_see_sharing_masters.sql` (Feb 12, 2026) - Creator names for shared people
- `20260212240000_allow_estimators_see_masters.sql` (Feb 12, 2026) - Estimators see masters in dropdown
- `verify_projects_rls_for_assistants.sql` - Assistants see all stages
- `fix_cost_estimates_rls_for_assistants.sql` (Feb 7, 2026) - Simplified RLS for cost estimates

**Customer Management**:
- `add_customers_delete_rls.sql` - Masters can delete own customers

**Dashboard Button Visibility**:
- `20260228190000_create_user_dashboard_buttons.sql` (Feb 28, 2026) - User-configurable quick-action buttons (Job, Job Labor, Bid, Project, Part, Assembly, New Prospect); RLS for dev, master_technician, assistant

**User Notes**:
- `20260229000004_add_users_notes.sql` (Feb 29, 2026) - Add `notes` column to users; RLS for dev, master_technician, assistant to UPDATE; People page shows notes after email with edit icon

### Email and Notifications

**Email Templates**:
- `create_email_templates.sql` - Template storage
- `seed_email_templates.sql` - Default templates
- RLS policies use `is_dev()` function

**Notifications**:
- `add_notification_fields_to_workflow_steps.sql` - Stage notification settings
- `create_step_subscriptions.sql` - User notification preferences

### User Management

**Core User System**:
- `create_users_table.sql` - Public users table
- `create_handle_new_user_trigger.sql` - Auto-create public.users record

**People Roster**:
- `create_people_table.sql` - People without user accounts
- `update_people_kind_constraint.sql` (Feb 5, 2026) - Kind enum validation
- `allow_devs_read_all_people.sql` - Devs see all roster entries
- `20260212190000_create_people_labor_jobs.sql` (Feb 12, 2026) - Labor jobs and items tables
- `20260212200000_add_is_fixed_to_people_labor_job_items.sql` (Feb 12, 2026) - Fixed labor hours
- `20260212250000_add_job_number_to_people_labor_jobs.sql` (Feb 12, 2026) - Job number field
- `20260212260000_add_job_date_to_people_labor_jobs.sql` (Feb 12, 2026) - Job date field
- `20260212210000_add_master_shares_to_people.sql` (Feb 12, 2026) - Master shares for people/labor

---

## Migrations by Feature

### Complete Feature Implementation Sequences

#### Bids System (6 tabs)
1. `create_bids.sql` - Core table
2. `create_bids_count_rows.sql` - Counts tab
3. `create_cost_estimates.sql` + `create_cost_estimate_labor_rows.sql` - Cost Estimate tab
4. `create_takeoff_book_*` → `add_takeoff_book_*` - Takeoff tab
5. `create_labor_book_*` → `add_labor_book_*` - Labor book for Cost Estimate
6. `create_price_book_*` + `create_bid_pricing_assignments.sql` - Pricing tab
7. `create_bids_submission_entries.sql` - Submission & Followup tab

#### Materials System (3 tabs)
1. `create_supply_houses.sql` - Vendors
2. `create_material_parts.sql` + `create_material_part_prices.sql` - Price Book tab
3. `create_material_templates.sql` + `create_material_template_items.sql` - Templates tab
4. `create_purchase_orders.sql` + `create_purchase_order_items.sql` - Purchase Orders tab
5. `create_price_history_trigger.sql` - Price tracking
6. Performance functions - Search and sort enhancements

#### Workflow Financial Tracking
1. `add_private_notes_to_workflow_steps.sql` - Private notes
2. `create_workflow_step_line_items.sql` - Line items per stage
3. `create_workflow_projections.sql` - Workflow-level projections
4. `add_link_to_line_items.sql` - External links
5. `add_purchase_order_to_line_items.sql` - PO integration

---

## Migration Best Practices

### Before Creating Migration

1. **Test locally first**: Use Supabase local development
   ```bash
   supabase migration new descriptive_name
   ```

2. **Make idempotent when possible**:
   ```sql
   -- Good: Will succeed if already exists
   CREATE TABLE IF NOT EXISTS my_table (...);
   
   -- Good: Will succeed if already exists
   DO $$ BEGIN
     ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
   EXCEPTION WHEN duplicate_column THEN
     -- Column already exists, that's fine
   END $$;
   ```

3. **Check dependencies**: Verify foreign keys and constraints

4. **Consider data migration**: If altering columns with data, handle existing records

### After Creating Migration

1. **Test in development**: Apply to local database first
   ```bash
   supabase migration up
   ```

2. **Test rollback** (if possible): Create down migration or test revert

3. **Update TypeScript types**: Run type generation
   ```bash
   supabase gen types typescript --local > src/types/database.ts
   ```

4. **Document in RECENT_FEATURES.md**: Add to feature log

5. **Update this file**: Add to Recent Migrations section

### Migration Safety

**Safe Operations**:
- Adding nullable columns
- Creating new tables
- Adding indexes
- Creating functions
- Adding RLS policies

**Potentially Breaking**:
- Dropping columns/tables
- Changing column types
- Adding NOT NULL to existing columns
- Changing foreign key cascading

**Destructive Operations**:
- Require explicit confirmation
- Document rollback procedure
- Consider data export first

---

## Rollback Procedures

### Revert Migration (Generic)

```bash
# Create rollback migration
supabase migration new revert_feature_name

# In migration file:
# - DROP tables in reverse dependency order
# - Remove columns with ALTER TABLE DROP COLUMN
# - Drop functions with DROP FUNCTION
```

### Example Rollback Migrations

**`revert_price_book_and_bids_job_type.sql`** (Feb 1, 2026):
```sql
-- Drops in dependency order
DROP TABLE IF EXISTS bid_pricing_assignments;
DROP TABLE IF EXISTS price_book_entries;
DROP TABLE IF EXISTS price_book_versions;
ALTER TABLE bids DROP COLUMN IF EXISTS job_type;
```

### Emergency Rollback

**If migration causes production issues**:

1. **Identify breaking migration**: Check error logs
2. **Create hotfix migration**: Revert specific changes
3. **Deploy immediately**: `supabase migration up`
4. **Verify functionality**: Test affected features
5. **Post-mortem**: Document issue and prevention

---

## Migration Tracking

### Viewing Applied Migrations

**In Supabase Dashboard**:
- Database → Migrations tab
- Shows all applied migrations with timestamps

**Via SQL**:
```sql
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

### Checking Migration Status

```bash
# List all migrations and their status
supabase migration list

# Show migration diff
supabase db diff
```

---

## Related Documentation

- [PROJECT_DOCUMENTATION.md - Database Schema](./PROJECT_DOCUMENTATION.md#database-schema)
- [DATABASE_IMPROVEMENTS_SUMMARY.md](./DATABASE_IMPROVEMENTS_SUMMARY.md) - v2.22 improvements
- [DATABASE_FIXES_TEST_PLAN.md](./DATABASE_FIXES_TEST_PLAN.md) - Testing procedures
- [supabase/archive/README.md](./supabase/archive/README.md) - Migration directory readme

---

## Future Migration Planning

### Planned Enhancements

**Performance**:
- Add indexes on frequently queried columns
- Optimize RLS policies with helper functions
- Consider materialized views for complex queries

**Features**:
- Notification scheduling tables
- Document generation metadata
- Bid comparison analytics tables
- Historical reporting tables

**Data Quality**:
- Additional CHECK constraints for business rules
- Computed columns for derived values
- Audit trigger for sensitive operations
