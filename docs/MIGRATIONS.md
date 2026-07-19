# Database Migrations Reference

---
file: MIGRATIONS.md
type: Reference/Changelog
purpose: Complete database migration history organized by date and category
audience: Developers, Database Administrators, AI Agents
last_updated: 2026-07-18
estimated_read_time: 15-20 minutes
difficulty: Intermediate to Advanced

total_migrations: "84 live in supabase/migrations/ (baseline + post-baseline) + 847 archived pre-baseline files (squashed into the 2026-06-04 baseline)"
date_range: "Through July 17, 2026 — the latest real migration. Archive filenames dated 2027 are typos; that work happened March–June 2026 (see the note atop Recent Migrations)."
categories: "Bids, Materials, Workflow, RLS, Database Improvements"

key_sections:
  - name: "Recent Migrations"
    anchor: "#recent-migrations"
    description: "Latest schema changes by date"
  - name: "Migrations by Category"
    anchor: "#migrations-by-category"
    description: "Grouped by system/feature"
  - name: "Migrations by Feature"
    anchor: "#migrations-by-feature"
    description: "Complete feature implementation sequences"
  - name: "Migration Best Practices"
    anchor: "#migration-best-practices"
    description: "How to create safe migrations"
  - name: "Rollback Procedures"
    anchor: "#rollback-procedures"
    description: "How to revert changes"
  - name: "Migration Tracking"
    anchor: "#migration-tracking"
    description: "Viewing applied migrations and status"

quick_navigation:
  - "[Latest Changes](#recent-migrations) - July 2026 · June 2026 baseline · archived pre-baseline"
  - "[By Category](#migrations-by-category) - Grouped by system"
  - "[Best Practices](#migration-best-practices) - How to migrate safely"
  - "[Rollback](#rollback-procedures) - Reverting changes"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Current schema"
  - "DATABASE_IMPROVEMENTS_SUMMARY.md - v2.22 improvements"
  - "[supabase/archive/README.md](../supabase/archive/README.md) - Migration files"

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
4. [Migrations by Feature](#migrations-by-feature)
5. [Migration Best Practices](#migration-best-practices)
6. [Rollback Procedures](#rollback-procedures)
7. [Migration Tracking](#migration-tracking)
8. [Related Documentation](#related-documentation)
9. [Future Migration Planning](#future-migration-planning)

---

## Overview

This document tracks all database migrations in the PipeTooling project. Migrations live in `supabase/migrations/`.

> **⚠️ Migrations are NOT applied by CI.** Merging to `main` deploys only the **client** (GitHub Pages) — it never runs `supabase db push`. The database and the client deploy on **separate tracks**: apply migrations manually with `supabase db push` against the linked prod project (`yewfzhbofbbyvkvtaatw`), and **sequence them** with the client when a change is coupled (e.g. a behavior the new client must understand — usually deploy the client first, then apply the migration). If `db push` reports a local/remote history mismatch, see the [migration drift runbook](../AGENTS.md#migration-history-drift-linked-project).

### Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20260206220800_add_unique_constraint_to_price_book_versions.sql`

### Key Principles
- **Append-only — never edit _or renumber_ an existing migration.** A version is **immutable once applied to prod**; to change behavior, add a *new* migration. Renumbering an already-applied file is the #1 cause of remote/local history drift here.
- **One version → one file.** Two files must never share a `YYYYMMDDHHMMSS` prefix — `db push` silently skips one. Create files with `supabase migration new …` (don't hand-invent timestamps). CI enforces both rules via [`scripts/check-migrations.sh`](../scripts/check-migrations.sh).
- **Apply manually — `supabase db push` ONLY**, and only after the file is on `main` (or in the PR merging right now). Never apply DDL via the Supabase MCP `apply_migration` / `execute_sql` or the dashboard SQL editor: `apply_migration` mints a server-timestamp ledger version that never matches the repo filename (renumber drift), and the other two leave no ledger row at all. See `CLAUDE.md` — reconciling past violations took a full ledger rewrite (2026-07-04). CI does **not** apply migrations.
- **Prefer idempotent / re-runnable DDL** so a migration survives a re-apply during drift recovery:
  - `CREATE TABLE/INDEX … IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
  - `CREATE OR REPLACE FUNCTION/VIEW …`
  - `DROP POLICY/TRIGGER IF EXISTS … ;` **before** re-creating it (plain `CREATE POLICY/TRIGGER` is not re-runnable)
- Destructive changes require explicit confirmation.
- Schema changes documented in this file.

---

## Recent Migrations

> **Reading older entries:** filenames beginning **`2027…`** are **typo-dated** (the real work happened March–June 2026). All of them predate the **2026-06-04 baseline squash** — the files now live in [`supabase/archive/migrations-pre-baseline/`](../supabase/archive/migrations-pre-baseline/) and their schema is part of [`20250101000000_baseline.sql`](../supabase/migrations/20250101000000_baseline.sql). Entries below keep the original filenames so they match the archive. The prod ledger was fully reconciled on **2026-07-04** (backup: `supabase_migrations._schema_migrations_backup_20260704`); since then, migrations apply **only** via `supabase db push` (see `CLAUDE.md`).

### July 2026

#### July 19, 2026

**`20260719120000_job_activity_consolidated_field_edits.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Consolidated Edit-Job activity events** (v2.750). Rewrites the `jobs_ledger_fields_to_activity()` SECURITY DEFINER trigger to emit ONE `field_edited` event per save — `"Job updated — changed A, B, C"` — covering every user-edited `jobs_ledger` field (was only 4 fields, one event each). Expands the trigger's `AFTER UPDATE OF …` column list to: customer_id, customer_name, job_name, hcp_number, click_number, job_address, customer_email, customer_phone, google_drive_link, job_pictures_link, job_plans_link, project_id, bid_id, service_type_id, master_user_id, revenue. Revenue keeps a separate `financial=true` event (dollar amount not exposed to non-financial roles); `payments_made` and `last_bill_date` deliberately excluded. Attribution unchanged (`auth.uid()`).
- **No RLS/table change**: `CREATE OR REPLACE FUNCTION` + `DROP/CREATE TRIGGER` only — no new table, so the read-only-blocks footer does not apply. Idempotent.
- **No client change**: the feed's fetch/render/realtime already handle `field_edited`; this only changes what the trigger writes.
- **Category**: Jobs / activity feed

**`20260718180000_report_email_subscriptions.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Report email subscriptions** (v2.746). Three new tables backing the "email reports to recipients" feature: `report_email_subscriptions` (one recipient — `recipient_user_id` FK `users` OR `recipient_email` text, enforced by a one-recipient CHECK — plus `all_authors`, `auto_send`, `enabled`), `report_email_subscription_authors` (author filter, unique per `(subscription_id, author_user_id)`, keyed on `reports.created_by_user_id`), and `report_email_dispatch_log` (idempotency ledger, unique `(subscription_id, report_id)` so auto + manual never double-send). Adds `SECURITY DEFINER` helper `can_manage_report_email_subscriptions()` (dev / master_technician / assistant / controller — deliberately excludes `primary`).
- **RLS**: config tables managed only by `can_manage_report_email_subscriptions()`; dispatch log is SELECT-only for managers (only the service-role `send-report-email` function inserts). `zzz_archive_on_delete` on the root subscriptions table. Ends with both `apply_read_only_write_blocks()` + `apply_read_only_stmt_blocks()` per the CREATE TABLE rule.
- **Ordering**: additive/greenfield — the client guards its own reads (modal shows a graceful load error until the tables exist), so client and migration can land in either order. Deploy the `send-report-email` edge function separately (`supabase functions deploy send-report-email`).
- **Category**: Reports / feature

**`20260718172650_customer_soft_archive.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Customer soft archive** (v2.736). Adds nullable `customers.archived_at timestamptz` and `customers.archived_by uuid REFERENCES users(id) ON DELETE SET NULL` (both `ADD COLUMN IF NOT EXISTS`, idempotent) + column comments documenting the semantics. Archived customers are hidden from the Customers list by default and excluded from pickers that link new jobs/estimates/bids/projects; existing links keep working and archived customers still render wherever already referenced. Never a delete.
- **No RLS change**: archiving is a same-row UPDATE already covered by the existing customers UPDATE policies (masters own rows, assistants of adopted masters, estimators). No new table, so the read-only-blocks footer does not apply.
- **Ordering**: the v2.736 client adds `archived_at` to several explicit customer select lists — push this migration immediately after the client PR merges or those loads 400.
- **Category**: Customers / feature

#### July 17, 2026

**`20260717210000_deleted_records_archive_people.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Close the last archive-coverage gap** found during the v2.707 delete-copy sweep: `public.people` (the roster table — not `public.users`) is UI-hard-deletable but was uncovered, so deleting a person was unrecoverable. Attaches the existing `zzz_archive_on_delete` trigger to `people` + its 4 `ON DELETE CASCADE` children (`external_team_job_payments`, `external_team_sub_managers`, `people_labels`, `team_feedback_peer_ratings`), chosen from the live catalog. Refreshes `list_deleted_records` to label a deleted person as kind `person`.
- **Impact**: A person delete now captures the person + its cascade children as one bundle and is restorable. No cross-table blocker existed (the already-covered children of `people` — pay_stubs, person_offsets, etc. — reference it via a nullable, non-cascading FK). `people_hours` stays deliberately excluded (derived/machine-churned). No restore-RPC change (topo order from the live catalog). No client change beyond softening the person-delete dialog copy.
- **Category**: Security / data-recovery

#### July 17, 2026

**`20260717250000_team_prospects_access_flag.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Per-user gate for the Team hiring board** (v2.714). `users.team_prospects_access boolean NOT NULL DEFAULT false` + `user_has_team_prospects_access()` (= `user_has_prospects_staff_access()` AND the flag). All eight `team_prospects` / `team_prospect_roles` policies re-created onto the new function — without the flag the board's data is unreadable server-side, regardless of role (devs included).
- **Guard**: `users_guard_privileged_columns()` re-created to also block non-dev changes to `team_prospects_access` (trigger column list extended). The row-scoped "Users can update own profile" policy would otherwise allow self-granting.
- **No seed**: nobody has the flag after applying — grant it in Settings → Active accounts (initially William, Malachi, Robert).
- **Category**: Prospects / access control

#### July 17, 2026

**`20260717230000_team_prospect_roles.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Role columns on the Team hiring board** (v2.712). New `team_prospect_roles` table (`name`, `position`, standard ownership + `updated_at` trigger) and `team_prospects.role_id` FK. Ranking (`rank_order`) is now scoped per role column; `role_id` NULL = virtual "Unsorted" column.
- **Key constraint**: the FK is **`ON DELETE RESTRICT`** — a role cannot be deleted while any candidate (any status, including hired/passed) references it. The UI disables the delete button until the column is empty; the FK makes the rule un-bypassable.
- **Safety rails**: same RLS surface as `team_prospects` (`user_has_prospects_staff_access()`), `zzz_archive_on_delete` archive trigger, and both read-only block re-applies.
- **Category**: Prospects / new feature

#### July 17, 2026

**`20260717190000_team_prospects.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Prospective-hires pipeline** (Prospects page → top-level **Team** tab, v2.709). New `team_prospects` table: candidate identity (`name` required, `phone_number`, `email`, `trade`, `source`, `notes`), pipeline `status` (`active` / `hired` / `passed`, enforced by CHECK — unlike the free-text `prospect_fit_status` on `prospects`), explicit drag ranking (`rank_order`, 1 = top candidate), `last_contact`, standard ownership (`master_user_id`, `created_by`) and timestamps (+ `update_updated_at_column` trigger).
- **RLS**: mirrors the customer-lead prospect tables — SELECT/UPDATE/DELETE for `user_has_prospects_staff_access()`; INSERT additionally requires `created_by = auth.uid()` and a valid owner (self for dev/master, adopted master for assistants, a master_technician for access-granted estimators).
- **Safety rails**: `zzz_archive_on_delete` BEFORE-DELETE trigger (deleted-records archive, root bundle) and both `apply_read_only_write_blocks()` + `apply_read_only_stmt_blocks()` so read-only (training) users cannot write.
- **Category**: Prospects / new feature

#### July 17, 2026

**`20260717180000_drop_dev_reset_estimates.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Remove a "wipe every estimate" button from prod.** `dev_reset_estimates_for_testing()` was `DELETE FROM public.estimates WHERE true` behind a dev-only type-"DELETE" confirm in Settings → Templates & testing. There is no staging env — this "reset for testing" ran against real data, so a dev could erase the whole estimate book in one click believing it was a test. Since v2.702 estimates are archived (so it became recoverable and now trips the bulk-deletion alert), but a standing delete-everything control has no legitimate prod use. `DROP FUNCTION`; the UI (the "Delete all estimates" section) is removed in the same PR.
- **Category**: Security / cleanup

#### July 17, 2026

**`20260717150000_claim_dev_break_glass.sql`** _(apply via `supabase db push` after the file is on `main`, and BEFORE `supabase functions deploy claim-dev`)_
- **Purpose**: **Close the claim-dev escalation path.** `claim-dev` was a form labelled only "Enter code" (Settings → Advanced, visible to every role except subcontractor/helpers) that promoted you to dev instantly, with no audit, no notification and no lockout — gated solely by a static shared secret. It promoted via a service-role client, so `auth.uid()` was NULL inside `users_guard_privileged_columns` (`20260716090000`) and that guard early-returned: the rule "only a dev can change a role; nobody self-promotes" had a deployed, UI-exposed bypass.
- **Now**: adds `claim_dev_attempts` (append-only audit, dev-only SELECT, no client write policy) and `claim_dev_attempt(p_user_id, p_code_ok)` — `SECURITY DEFINER`, **`REVOKE`d from `authenticated` and granted only to `service_role`** so the edge function is its sole caller (not a new door). It grants dev **only when no usable dev exists** (`role='dev' AND archived_at IS NULL AND read_only=false`), refuses `read_only`/archived callers even in a genuine lockout, takes `pg_advisory_xact_lock` so the check is race-free, and logs **every** branch (`granted` / `refused_bad_code` / `refused_dev_exists` / `refused_read_only` / `refused_unknown_user`).
- **The two real lockouts still work**: the only dev is archived, or the only dev is read-only. Bootstrap (no dev at all) still works.
- **No oracle**: the edge function returns the same opaque `{success:false}` for every refusal — a correct-code-but-refused response would confirm the secret is valid. The truth lives in `claim_dev_attempts`.
- **Related**: the `delete-user` edge function was **undeployed** the same day — ACTIVE v38, absent from this repo and from `config.toml`, called by no UI, superseded by `archive-user`, and its `users` hard-delete cascaded 100 FKs (jobs, customers, estimates, prospects, people, clock sessions, reports) into archived-but-**unrestorable** loss (`jobs_ledger.master_user_id` is NOT NULL, so restore blocks). Source preserved at `supabase/archive/functions-removed/delete-user/`.
- **Category**: Security / privilege escalation

#### July 17, 2026

**`20260717120000_bulk_deletion_alerts.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Bulk-deletion alerting.** Everything in v2.695–v2.704 (no self-escalation, 83 tables archived, one-click restore, airtight read-only) assumed *somebody notices* — nothing told you. Adds dev-only `list_bulk_deletion_alerts()`, a read-side aggregate over `deleted_records_archive` (no new capture needed: actor/time/bundle are already recorded). Returns one row per `(actor, time bucket)` exceeding the thresholds.
- **The unit is bundles, not rows**: deleting ONE job archives many rows (measured: minimal job = 5 rows/1 bundle; a real one 15–20+; a real prod bid count-clear was 19 rows/1 bundle). A row threshold would fire on a single legitimate delete. `count(distinct group_key)` = "how many *things*". Rows remain a **second** trigger for one enormous bundle (a customer cascading into 50 projects = 1 bundle, hundreds of rows). Thresholds OR'd.
- **Settings** are read server-side from `app_settings` (`bulk_delete_alert_*_v1`) with `COALESCE` defaults (5 bundles / 200 rows / 60 min / 168 h), which is why this needs a migration rather than being client-only — same reason as `20260618130000_hide_dev_tally_transactions.sql`. A NULL/garbage value falls back rather than silencing the alarm or firing on every delete.
- **Scope**: dev-only via the `WHERE public.is_dev()` idiom (non-devs get zero rows); excludes the caller's **own** deletions (you know what you did — other devs still see your bursts, so a spree is never invisible to everyone).
- **Known limitation (documented in the header)**: fixed time buckets, not a sliding window — a burst straddling a boundary splits and each half may fall under threshold. Accepted: sliding windows cost far more for a heuristic alarm, and a continuing spree trips the next bucket.
- **Category**: Security / monitoring

#### July 17, 2026

**`20260717000000_read_only_all_roles_and_rpc_block.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Make read-only (training) mode airtight so it can be offered for every role.** The toggle promised "every change is blocked" but only enforced RESTRICTIVE RLS — and a table's owner bypasses RLS, so all ~79 mutating `SECURITY DEFINER` RPCs granted to `authenticated` skipped it, none checking `is_read_only()`. **Live, not theoretical:** verified pre-migration on a local stack that a `read_only` master_technician successfully called `delete_ready_to_bill_invoice` (invoice deleted) and `migrate_job_ledger_costs_and_delete` (job deleted) — while the app showed them the amber "changes won't save" banner. Seven such RPCs admit `assistant`, the exact role the toggle already supported.
- **Fix**: table ownership bypasses RLS but **not triggers** — triggers fire inside `SECURITY DEFINER` functions. Adds `block_if_read_only()` + `apply_read_only_stmt_blocks()`, attaching a `read_only_block_stmt` **statement-level** `BEFORE INSERT/UPDATE/DELETE` trigger to every RLS-enabled public table. Closes all ~79 at once **without touching a single function body** — the alternative was rewriting ~268 KB of payroll/billing plpgsql to fix a permissions gap. Same idiom as `apply_read_only_write_blocks()` and the archive sweeps.
- **Safe by construction**: `is_read_only()` is false when `auth.uid()` is NULL, so cron/service-role/anon writes pass untouched (the carve-out the original migration documented). Statement-level ⇒ one indexed lookup per write **statement**, not per row. Also fixes a UX bug: RLS blocked UPDATE/DELETE by silently filtering to zero rows; the trigger raises, so users see why.
- **Passive browsing preserved** — excluded tables: `user_app_activity_daily` / `user_app_activity_page_daily` (the `bump_user_app_activity` heartbeat the original migration carved out), `estimate_customer_events` (anon link-view telemetry), `deleted_records_archive` (written only by its own definer trigger).
- **Self-flag guard**: extends `users_guard_privileged_columns` (v2.695) — you cannot read-only your **own** account. A read-only user's own-row UPDATE is filtered by the restrictive policy and no edge function touches the column, so self-flagging the last dev was a permanent lockout recoverable only by direct SQL.
- **Category**: Security / access control

#### July 16, 2026

**`20260716235000_fix_pay_stub_deductions_cascade_delete.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Fix a pre-existing bug that made any pay stub with deductions undeletable.** `pay_stub_deductions_enforce_gross_tr` is `BEFORE INSERT OR DELETE OR UPDATE` on `pay_stub_deductions`; during the parent's `ON DELETE CASCADE` the `pay_stubs` row is already gone, so the function's parent lookup found nothing and `RAISE`d `pay stub not found for pay_stub_id …`, aborting the whole delete. Same bug shape as `20260619120000_guard_activity_events_on_job_delete`. User-reachable: `People.tsx deletePayStub()` deletes `pay_stubs` directly and relies on the cascade.
- **Fix**: `CREATE OR REPLACE` the function body only (no trigger DDL — the trigger already points at this name and already wires DELETE). When the parent stub is gone, `RETURN OLD` on DELETE instead of raising; keep the `RAISE` for INSERT/UPDATE. Mirrors this table family's own precedent — `validate_pay_stub_payments_vs_net()` does the identical lookup and already returns quietly, which is why the two AFTER-DELETE validators were already cascade-safe. The `v_new_total > v_gross + 0.01` cap is **unchanged**.
- **Not caused by the archive work**: reproduces with the archive trigger dropped; latent since the baseline, found while testing tier-2 coverage. `pay_stub_payments_enforce_total_fn()` has the same shape but its trigger omits DELETE, so it is unreachable — deliberately left alone.
- **Impact**: no client change. Adds `SET search_path = public` (repo hardening convention, zero behaviour change); `SECURITY DEFINER` deliberately **not** added, as that would flip the lookup from invoker to owner and change RLS semantics.
- **Category**: Bug fix / payroll

**`20260716230000_deleted_records_archive_tier2.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Tier-2 archive coverage — 42 → 83 tables.** Phase 1/1.5 covered only the jobs and bids trees; everything else was hard-deleted with no snapshot. Adds customers (→ projects → workflows → steps), estimates, payroll (`pay_stubs` + days/deductions/additional lines/payments, `people_pay_config`, `person_offsets`), time (`clock_sessions`, `hours_reviewed`, `hours_days_correct`), AP (`supply_houses`, `supply_house_invoices`, links), sub labor, purchase orders, the material catalog (`material_parts`, `material_templates` + items/prices), licences and writeups. Tables were selected **from the live catalog** (transitive `ON DELETE CASCADE` closure), not hand-listed — hand-listing from `baseline.sql` is what made Phase 1 miss four bid tables.
- **Also fixes three silent holes**, all found by querying for `covered --NOT NULL FK--> uncovered ON DELETE CASCADE` (the generalised `price_book_versions` blocker from `20260716150000`): deleting a **supply house** or **supply-house invoice** orphaned archived `supply_house_invoice_job_allocations`; deleting a **material template/part** orphaned archived `bids_takeoff_template_mappings`; and **`projects`** being uncovered made project-anchored `reports` archived-but-**unrestorable** (restore nulls the dangling `project_id`, leaving all three anchors NULL and violating `reports_one_anchor`). Note `customers` cascades into `projects` — a customer delete is much wider than it looks, and is now captured as one bundle.
- **Deliberately excluded**: `people_hours` (6 server-side DELETEs, 0 client deletes — *derived* data recomputed from clock sessions; archiving it would churn the archive to protect rows that can just be recomputed). `mercury_transactions`, `service_types`, `users` remain uncovered but each has **zero** client deletes, so no UI path reaches the blocker; `users` additionally FKs to `auth.users`, outside the public-schema sweep.
- **Impact**: `restore_deleted_records` needed **no change** — its insert order is topologically sorted from the live `pg_constraint` catalog, so it picked all of these up automatically. `list_deleted_records` refreshed to label the new kinds (customer/project/estimate/pay stub/supply house invoice/…) via a generic name lookup. No client change.
- **Category**: Security / data-recovery

**`20260716210000_deleted_records_restore_fk_cycles.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Fixes a hang in `restore_deleted_records` (v2.698) — restoring a BID was impossible.** The bids tree has an FK cycle the jobs tree does not: `bids.selected_bid_version_id → bid_versions` (nullable) and `bid_versions.bid_id → bids` (NOT NULL). The topological `depth` CTE recursed with `UNION ALL` guarded only by `d < 50`, so the cycle exploded combinatorially and the function — **including a dry run** — spun until the connection was killed. With the v2.699 UI live, a dev previewing a deleted bid would hang. Even without the hang, no parent→child order can satisfy a cycle.
- **Fix**: identify nullable FK columns that are genuine **cycle back-edges** (child→parent where parent can reach child again, via a reachability closure) and defer only those — insert the row with that column NULL, then re-apply the archived value with a post-insert UPDATE once its target exists. All other edges, nullable or not, still constrain insert order. A path guard backstops any residual cycle.
- **Why the defer is narrow**: deferring *all* nullable FKs would break two ways — `reports.job_ledger_id`/`project_id`/`bid_id` are each nullable but `reports_one_anchor` CHECKs exactly one is non-null (nulling the anchor violates it), and dropping nullable edges from the ordering would stop `reports` following `jobs_ledger`. Neither is in a cycle, so neither is deferred.
- **Gotcha for future edits**: CTE aliases inside this function must not be `r`/`fk`/`t` — those are plpgsql record variables, and plpgsql resolves `r.src` to the variable, failing with `record "r" is not assigned yet` (55000).
- **Category**: Security / data-recovery

**`20260716180000_deleted_records_restore.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Deleted-records archive Phase 2 — restore RPCs (dev-only).** Adds `restored_at`/`restored_by` to `deleted_records_archive`, plus `list_deleted_records(p_limit)` (one row per restorable bundle: kind/label/row_count/tables/who/when; non-devs get zero rows) and `restore_deleted_records(p_group_key, p_dry_run)` → jsonb `{ok, dry_run, inserted, warnings, blockers}`. Mirrors `merge_user_accounts`: inlined dev gate returning `{ok:false, code:'forbidden'}`, top-level `WHEN OTHERS` envelope, and a **real** dry-run that executes then rolls back via a `P0R01` sentinel (counts live in plpgsql vars, so the preview is genuine, not simulated). `P0M01` is merge's sentinel and is deliberately not reused.
- **Impact**: **All-or-nothing.** A dangling reference through a **nullable** column is nulled with a warning (job comes back minus its deleted customer); through a **NOT NULL** column it is a blocker and nothing is committed. Inserts run parent→child in an order **topologically sorted from the live `pg_constraint` catalog** (no FK here is `DEFERRABLE`, so ordering is mandatory; a hardcoded list is what made Phase 1 miss four tables). One synthetic edge is injected because the FK graph can't see trigger-induced ordering: `jobs_ledger_team_members` must precede `job_schedule_blocks`, whose AFTER-INSERT trigger would otherwise pre-create the team-member row our archived row then collides with. `job_schedule_blocks.created_by` (stamped with the restorer by its BEFORE-INSERT trigger) is corrected post-insert. Bundles are collected with a recursive CTE, since grandchildren group under an intermediate parent. No client change — the UI is Phase 2b.
- **Gotcha for future edits**: the topo CTE pins `COLLATE "default"` on `pg_class.relname::text` — `name`'s text collation is `"C"` and mixing it with `unnest(text[])` in a recursive CTE fails with `42P21`.
- **Category**: Security / data-recovery

**`20260716150000_deleted_records_archive_coverage_bids.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Coverage fix for the Phase 1 archive.** Four `ON DELETE CASCADE` children of `bids` were added *after* the baseline and so were missed by `20260716120000`'s table list — `bid_versions` + `bid_payment_schedule_rows` + `price_book_versions` (all `bid_id → bids`) and `price_book_entries` (`version_id → price_book_versions`). Deleting a bid destroyed them **unarchived**. Attaches the existing `zzz_archive_on_delete` / `archive_deleted_record()` trigger to all four (same idempotent DO-block pattern).
- **Impact**: Also unblocks Phase 2 **bid restore**: `bid_count_row_custom_prices.price_book_version_id`, `bid_count_row_submission_hides.price_book_version_id` and `bid_pricing_assignments.price_book_version_id` are **NOT NULL** FKs to `price_book_versions` — with that parent cascading away unarchived, their archived children could never be re-inserted. Archive coverage 38 → **42** tables. `price_book_versions.bid_id` is nullable, so template price books archive as their own bundle while bid-scoped copies group under their bid. No client change.
- **Category**: Security / data-recovery

**`20260716120000_deleted_records_archive.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Trash safety-net — Phase 1 (capture).** High-value rows are hard-deleted and irrecoverable (a `jobs_ledger` delete cascades across ~17 child tables; `bids` across its own tree; PITR is off and is a whole-DB rollback anyway). Adds `public.deleted_records_archive` and a generic `BEFORE DELETE` trigger `archive_deleted_record()` (`SECURITY DEFINER`) that snapshots `to_jsonb(OLD)` of every deleted row of the covered tables, grouped under its top-level job/bid bundle. BEFORE-DELETE + reading only the deleting row avoids the AFTER-DELETE cascade trap (`20260619120000`); fires for all delete paths (direct `.delete()`, delete RPCs, cascade). Covers `jobs_ledger` + its cascade closure, `jobs_ledger_invoices`, `reports`, `bids` + its cascade closure (~38 tables). 90-day auto-purge via `pg_cron`.
- **Impact**: None for callers — capture is transparent and guarded so it can **never block a delete** (text keys, no casts, INSERT wrapped with `RAISE WARNING` on failure). Table is RLS-enabled, **dev-only SELECT**, no client write policy (only the `SECURITY DEFINER` trigger writes). Not in the realtime publication. No client change. **Phase 2 (separate PR)** adds dev-only `list_deleted_records`/`restore_deleted_records` RPCs + a "Recently deleted" Settings UI.
- **Category**: Security / data-recovery

**`20260716090000_guard_users_privileged_columns.sql`** _(apply via `supabase db push` after the file is on `main`)_
- **Purpose**: **Close a self-privilege-escalation hole.** The `"Users can update own profile"` RLS policy checks only row ownership (`auth.uid() = id`), not which columns change, and `authenticated` holds column UPDATE on `public.users` — so any authenticated user could PATCH their own row to `role='dev'` (full admin, incl. the cascading `jobs_ledger` hard-delete) or clear their own `read_only` training flag. Adds a `BEFORE UPDATE OF role, read_only, archived_at` trigger (`users_guard_privileged_columns()`, `SECURITY DEFINER`): only a `dev` may change `role`/`read_only`; `archived_at` is edge-flow-only.
- **Impact**: None for legitimate flows — dev `updateRole`/`updateReadOnly` (authenticated dev) still pass, and service-role edge functions (`archive-user`/`restore-user`/`claim-dev`/`merge-users`) pass because their calls carry no JWT (`auth.uid()` NULL → deny branches skipped, same as `prevent_bid_number_update_by_estimator_primary`). Blocks self-escalation for **every** non-dev role. No client change.
- **Category**: Security / RLS hardening

#### July 15, 2026

**`20260715120000_drop_show_in_cost_matrix.sql`** _(applied via `supabase db push` after the v2.675 client deploy)_
- **Purpose**: **Cost-matrix retirement phase 5.** Drops `people_pay_config.show_in_cost_matrix` after proving it dead: identical to `show_in_hours` for all rows, dual-written since v2.673, unreferenced by the v2.675 client. Recreates `list_people_pay_flags()` without the column (DROP + CREATE, `RETURNS TABLE` shape change; body otherwise per `20260714213000`) before the column drop so no broken window exists.
- **Impact**: None functionally — the "Include in Hours & crew costing" knob is now backed solely by `show_in_hours`. Stale clients that still `.select()` the column 400 on pay-config loads until the `autoUpdate` service worker refreshes them (minutes-scale).
- **Category**: Cleanup / Schema


**`20260715090000_retire_cost_matrix_shares_and_tags.sql`** _(pending — apply via `supabase db push` AFTER the v2.674 client deploys)_
- **Purpose**: **Cost-matrix retirement (phase 4, DB half).** Strips the `is_cost_matrix_shared_with_current_user()` term from every RLS policy that carried it: recreates `people_hours` / `people_crew_jobs` / `people_crew_bids` "select access" and `common_jobs` read (renamed "Pay access can read common jobs") with bodies identical to their current post-sweep definitions (`has_payroll_access() OR is_assistant()` [+ team-lead where present]) minus the share term; drops the standalone shared-user SELECT policies on `people_pay_config` / `people_teams` / `people_team_members`; drops tables `cost_matrix_teams_shares`, `people_cost_matrix_tags`, `cost_matrix_tag_colors` (their policies + the v2.660 grantee trigger die with them); drops `is_cost_matrix_shared_with_current_user()` and `cost_matrix_share_grantee_role_check()`.
- **Impact**: Access only narrows, and only for share holders — the sole existing share belonged to a pay-approved master whose access comes from pay approval. "View costs without pay admin" is the **controller** role's job now. ~20 tag rows discarded (confirmed unused). `people_pay_config.show_in_cost_matrix` stayed through v2.674 and was dropped by `20260715120000` (phase 5).
- **Category**: RLS / Cleanup / Feature retirement

#### July 14, 2026

**`20260714230000_controller_payroll_capability_sweep.sql`** _(applied via `supabase db push`)_
- **Purpose**: **Controller payroll-capability sweep (Phase 3 fix-up).** Controller verification caught a gap: policies written before `has_payroll_access()` existed still gated on `is_pay_approved_master()` directly (people_pay_config manage, cost-matrix/teams family, people_hours_display_order, clock-session pay branches), so a controller could read pay stubs but not wages. Generic rewriters swap `is_pay_approved_master` → `has_payroll_access` in every policy (public + storage) and every function body except `is_pay_approved_master`/`has_payroll_access` themselves (recursion guard); in-migration assertion requires zero leftover policy references.
- **Impact**: Identical behavior for devs/pay-approved masters (`has_payroll_access()` = `is_pay_approved_master() OR is_controller()`); controller gains the full payroll principal. Verified by rolled-back role-simulation: controller reads 21 wage rows + 218 pay stubs, keeps clock powers, `is_dev()` false. **`RECENT_FEATURES.md` v2.663**.
- **Category**: Roles / RLS / RPC / Security


**`20260714210000_add_user_role_controller.sql`** + **`20260714213000_controller_capabilities.sql`** _(applied via `supabase db push` after the client PR merged)_
- **Purpose**: **`controller` role (Phase 3).** "Acts like an assistant, sees like a dev on money": every assistant capability plus payroll access — but not dev admin. Enum value in its own migration (can't add + use in one transaction). Capabilities migration: **`is_controller()`**; **`is_assistant()` redefined as assistant-LIKE** (`role IN ('assistant','controller')`) so every assistant grant from Phases 1–2 extends to controller with one function edit (COMMENT documents the semantics); **`has_payroll_access()`** gains `is_controller()`; users-visibility policy's assistant branch becomes `role = ANY('{assistant,controller}')`; literal role lists gain `'controller'` (`list_people_pay_flags`, `get_man_hours_by_job`, cost-matrix grantee trigger, `handle_new_user` invite list).
- **Impact**: Client companion in the same PR (UserRole type, `isAssistantLike()` helper + sweep of viewer-gate role literals, `usePeopleAccess` controller branch with `canAccessPay`, wage-gate updates, `ROLES` picker). Edge functions `create-user` / `invite-user` `validRoles` gain `'controller'` — **redeploy both** (CI does not deploy edge functions). Type regen after apply. **`RECENT_FEATURES.md` v2.662**.
- **Category**: Roles / RLS / RPC / Security


**`20260714200000_dissolve_assistant_pay_linkage.sql`** _(applied via `supabase db push` after the client PR merged)_
- **Purpose**: **Dissolve assistant pay-linkage (Phase 2).** After the v2.660 lockdown, `is_assistant_of_pay_approved_master()` granted no pay visibility but still gated ~25 operational tables (clock_sessions, people_crew_jobs/bids, people_hours, attendance_incidents, writeups(+templates), common_jobs, vehicles(+possessions/odometer/replacement), housing_units/possessions, person_licenses(+cost lines), contract templates/documents/assignments, storage.objects contract signatures) and 14 clock/HR functions (approve/revoke/restore_clock_sessions, can_edit_clock_sessions_for_user, NCNS, salary-schedule staff fns, time-off, recompute, contract book, license-expiry notify, pay_access_clock_week_fence_bypass). Generic rewriters (pg_policies + pg_get_functiondef, bare-name replace incl. deparsed SELECT-wrapper aliases; public + storage schemas) swap it for `is_assistant()` everywhere — every assistant gets the same clock-management toolset; the week-fence bypass becomes `is_pay_approved_master() OR is_assistant()` so assistants keep historical clock-card corrections. In-migration assertion requires zero leftover references, then the function is dropped; `master_assistants` reverts to pure team structure.
- **Impact**: No client changes (client never referenced the concept). Dry-run validated in a rolled-back transaction incl. Grace-simulation: `can_edit_clock_sessions_for_user` false→true, licenses/writeups visible, pay config + pay stubs still 0 rows. **`RECENT_FEATURES.md` v2.661**.
- **Category**: Payroll / RLS / RPC / Security


**`20260714120000_assistant_pay_lockdown.sql`** _(applied via `supabase db push` after the client PR merged)_
- **Purpose**: **Assistant pay lockdown (Phase 1 of the pay-visibility overhaul).** Assistants must never be able to read what an individual makes, pay-linked or not. (1) New **`has_payroll_access()`** capability fn (dev + pay-approved masters; the planned `controller` role joins here). (2) `people_pay_config` loses the blanket assistant SELECT policy (own-row / cost-matrix-share / pay-master policies remain). (3) `pay_stubs` / `pay_stub_days` / `pay_stub_payments` / `pay_stub_deductions` / `pay_stub_additional_lines` policies rewritten onto `has_payroll_access()` — previously `is_assistant_of_pay_approved_master()` gave a pay-linked assistant full read/write via the API even though the Payroll tab was hidden; `person_offsets` (readable by ALL assistants before) also moves to `has_payroll_access()`. (4) `hours_reviewed` / `hours_days_correct` writes → pay masters + all assistants (clock management, not pay). (5) New **`list_people_pay_flags()`** SECURITY DEFINER RPC (staff-gated; non-wage columns only) keeps Hours/Quickfill/Crew rosters + salaried-hours logic working. (6) New **`get_dashboard_payroll_totals()`** SECURITY DEFINER RPC — org-level due + upcoming aggregates for the Dashboard AP card (assistants keep totals, never per-person rows); SQL mirrors `stubNetPay`/`buildApBucket`/`buildUpcomingPayrollSummary` (parity-verified against the live client: due exact to the cent, upcoming within open-session drift). (7) **`get_man_hours_by_job()`** recreated SECURITY DEFINER (hours only) so salaried credit survives. (8) `cost_matrix_teams_shares` BEFORE INSERT/UPDATE trigger: grantees must be dev/master.
- **Impact**: Client companion in the same PR: `usePayConfig` / Quickfill Hours / Unassigned-field-time / CrewJobsBlock / HoursUnassignedModal / `salaryPayConfigGate` / `teamLabor` read flags via the RPC (wage columns dropped from their selects); `useDashboardFinancials` assistant path uses the totals RPC; Job Summary Team-Labor/profit cells and the Projects day-modal Team-labor row are dev/master-only. Types hand-added to `database.ts` (regen after apply). **`RECENT_FEATURES.md` v2.660**.
- **Category**: Payroll / RLS / RPC / Security

#### July 13, 2026

**`20260713230000_list_user_display_names.sql`**
- **Purpose**: **`list_user_display_names(p_user_ids uuid[])`** — narrow SECURITY DEFINER lookup returning display name + `archived_at` only (no email/role/pay) for explicit ids, any authenticated caller. Dispatch showed "Unknown" for many people under non-dev roles: the `users` SELECT policy hides archived rows from everyone but devs and hides master_technician/dev rows from (e.g.) assistants, so name lookups for schedule-block assignees and job team members came back empty.
- **Impact**: Schedule dispatch name resolution (assignees + job team members). `GRANT EXECUTE TO authenticated`.
- **Category**: Users / RPC / Dispatch

**`20260713210000_tally_badge_respects_sorting_floor.sql`**
- **Purpose**: **`count_unlinked_mercury_transactions_for_tally()`** now applies the global sorting start date (`app_settings.job_tally_min_posted_ymd`, America/Chicago day semantics — clause copied from the stale-count sibling). The Dashboard Tally badge counted the caller's entire unlinked history (99+) while the Tally page hides rows posted before the floor. Body is the `20260709160000` version verbatim plus the floor clause.
- **Impact**: Dashboard Tally badge count matches the Tally page's "Show unlinked" view.
- **Category**: Tally / Banking / RPC

**`20260713190000_jobs_ledger_completeness.sql`**
- **Purpose**: Job completeness (0–100%) marked from the Job Detail modal, with attribution: `jobs_ledger.completeness_pct` (CHECK 0–100), `completeness_marked_by` (FK `users`), `completeness_marked_at`; AFTER UPDATE trigger `jobs_ledger_completeness_to_activity_upd` (SECURITY DEFINER, fires on `completeness_pct` change) logs every change to `job_activity_events` (`completeness_marked`, from → to in `detail`) so the activity panel shows who marked it and when.
- **Category**: Jobs / Schema / Triggers

**`20260713170000_drop_dead_salary_artifacts.sql`**
- **Purpose**: Salaried-area cleanup (audited 2026-07-04): drops `salary_force_close_open_sessions_after_shift()` (superseded — its fragment-close behavior moved inline into `salary_sync_one_user_clock_sessions` in `20260515092032`; zero callers in DB or client) and `clock_sessions.salary_split_derived` (written only by pre-consolidation split logic; never read). Both statements `IF EXISTS` — ensure-gone cleanup, idempotent (the function was already absent from prod; same-name recovered file `20260703194625` is a separate ledger artifact, see July 2–4 above).
- **Category**: Salary / Cleanup

**`20260713153000_bids_bid_due_time.sql`** — `bids.bid_due_time time`: optional time-of-day a bid is due, alongside `bid_due_date`. Wall-clock time exactly as entered; no timezone math (matches `bid_due_date` semantics).

**`20260713120000_time_off_paid_kind_people_employment_dates.sql`**
- **Purpose**: Employment-tab groundwork (schema only; UI + payroll wiring in follow-up PRs). (1) `user_time_off.kind` CHECK widened from `('unpaid')` to `('unpaid','paid')` — salary sync deliberately treats both alike (any time-off row clears the day's non-final `salary_schedule` sessions); the distinction is payroll math: only **unpaid** weekdays subtract from the salaried flat 8h credit (paid is salaried-only by product decision — hourly pay already follows logged hours). (2) `people.start_date` / `people.end_date` (nullable, inclusive dates) + `people_employment_dates_order` CHECK — salaried payroll credit clamps to the employment window (NULL start = no clamping; NULL end = currently employed).
- **Category**: People / Payroll / Schema

**`20260713090000_read_only_training_mode.sql`**
- **Purpose**: Read-only "training mode": `users.read_only` flag + `is_read_only()` helper + **`apply_read_only_write_blocks()`** — adds three RESTRICTIVE policies (`read_only_users_cannot_insert/update/delete`) to every RLS-enabled public table. A flagged user keeps their role's full read visibility (SELECT policies untouched) but every direct client write is denied at the database, regardless of UI gaps. Kept as a callable helper: rerun (or call from a migration) after CREATE TABLE — now a standing repo migration rule (see `CLAUDE.md`). Deliberately out of scope at this stage: service-role writes, postgres-owned SECURITY DEFINER RPCs, anon public accept flows, `storage.objects` — the RPC gap was later closed by `20260717000000_read_only_all_roles_and_rpc_block.sql` (v2.704 statement blocks).
- **Impact**: Toggled from Active Accounts (Manage accounts); the column is role-agnostic so any role can be flagged without another migration.
- **Category**: Security / RLS / Training mode

#### July 12, 2026

**`20260712190000_merge_user_accounts.sql`** + **`20260712191500_merge_user_accounts_fix_text_append.sql`**
- **Purpose**: **`merge_user_accounts(p_survivor, p_absorbed, p_dry_run)`** — dev-only SECURITY DEFINER merge of one user account into another: explicit handling for membership/unique tables (move-if-absent), additive activity aggregates, org pair tables (self-pair cleanup), label slug collisions, roster link, `estimates.accept_notify_user_ids` uuid[]; then a dynamic `pg_constraint` sweep of every remaining FK to `public/auth.users` and a coverage assert (zero leftover references or abort). `p_dry_run` executes fully and rolls back via sentinel, returning per-table counts (dialog preview). The `191500` follow-up fixes `text[] || 'literal'` array-literal parsing with `::text` casts.
- **Impact**: Active Accounts → **Merge users** (via Edge `merge-users`, which also bans the absorbed login). Rules: same role; absorbed archived or never signed in; live account survives.
- **Category**: Users / Admin / SECURITY DEFINER

#### July 11, 2026

**`20260711120000_list_latest_report_completion_pct.sql`**
- **Purpose**: SECURITY INVOKER RPC `list_latest_report_completion_pct(p_job_ids)` — latest valid field-report completion % (0–100) per job, parsed server-side (`reports.field_values` also carries signature data-URLs; never bulk-fetch client-side). New key wins over legacy "Who was on the job?"; latest percent-bearing report wins.
- **Impact**: Jobs → Job Summary **%** column and Quickfill **Complete, no Total Bill**.
- **Category**: Jobs / Reports / RPC

#### July 9, 2026

**`20260709120000_turnaway_report_template.sql`** — Turnaway report template + dispatch plumbing for the tech-side "client not home / site not ready" flow (Job Mode).
**`20260709130000_turnaway_trip_charge.sql`** — `create_turnaway_trip_charge(p_job_id, p_amount, p_reason, p_dispatch_request_id)`: inserts a **non-primary ready_to_bill** `jobs_ledger_invoices` row and bumps `jobs_ledger.revenue` by the same amount (keeps the primary-RTB invariant); per-reason defaults in `app_settings` (`trip_charge_client_not_home`, `trip_charge_site_not_ready`); idempotent per closed dispatch request.
**`20260709150000_help_feedback.sql`** — `help_feedback` table (+ RLS) for /help guide feedback; dev inbox + push via Edge `notify-help-feedback`.
**`20260709160000_payroll_counts_as_linked.sql`** — tally payroll-marked Mercury transactions count as linked in all unlinked counters.

#### July 2–4, 2026

**`20260702160000_modernize_handle_new_user.sql`** — `handle_new_user` (auth.users INSERT trigger) creates the `public.users` row; role from `raw_user_meta_data.invited_role` when modern, else `helpers`; idempotent vs edge-function upserts.
**`20260703160000_sync_last_sign_in_from_auth.sql`** — `on_auth_user_signed_in` trigger copies `auth.users.last_sign_in_at` → `public.users.last_sign_in_at` (one-time backfill; powers Last login + merge/never-signed-in checks).
**`20260703194625_drop_dead_salary_artifacts.sql`** — recovered file to match the prod ledger (PR #193).
**`20260704120000_fix_users_update_policy_recursion.sql`** — users UPDATE policy recursion fix.
**`20260704150000_job_collections_flag.sql`** + **`20260704160000_collections_flag_row_lock.sql`** — `jobs_ledger.collections_at/by/note` sticky flag (not a status; `status='billed' AND collections_at IS NOT NULL`), written only via `set_job_collections_flag()`; row-lock hardening.
**`20260704170000_customer_review_job_hours.sql`** — `list_customer_review_job_hours` RPC for the Bid Board Customer review modal (per-customer estimating/job hours).

### June 2026 (post-baseline)

**`20260605001052_drop_mercury_transactions_realtime.sql`** — drop Realtime CDC on `mercury_transactions` (2026-06-05 connection-pool incident mitigation).
**`20260608070012_add_count_tooling_plans_link_to_bids.sql`** — `bids.count_tooling_plans_link` (CountTooling source view-link captured by Counts import).
**`20260608120000_allow_helpers_working_to_ready_to_bill.sql`** — status-transition allowance tweak for helpers.
**`20260609120000_add_dual_rate_pay.sql`** — dual-rate pay support in pay config.
**`20260610120000_bid_scoped_pricings.sql`** — `price_book_versions.bid_id` + `clone_price_book_version_to_bid` (multiple frozen price-book copies per bid).
**`20260610170000_bid_versions_schema.sql`**, **`20260610180000_bid_version_rpcs.sql`**, **`20260610190000_bid_version_split_and_guards.sql`** — bid versions schema, RPCs, split + guards.
**`20260611130000_pinned_tabs_sort_order.sql`** — `user_pinned_tabs` sort order (pinned pages sync + drag-reorder).
**`20260616045050_add_recompute_people_hours_after_session_edit.sql`** — `recompute_people_hours_after_session_edit` RPC + 14-day backfill (Adjust-times resync; people_hours is incrementally maintained).
**`20260618120000_bid_pricing_user_prefs.sql`** — per-user remembered-default price book (Pricing tab dropdown).
**`20260618130000_hide_dev_tally_transactions.sql`** — `app_settings.hide_dev_tally_transactions` org flag read by the stale-tally follow-up RPC.
**`20260619120000_guard_activity_events_on_job_delete.sql`** — job_activity_events guard on job delete.
**`20260619130000_migrate_costs_allow_billed.sql`** — `migrate_job_ledger_costs_and_delete` 3-arg with `p_allow_billed` (2-arg dropped); reassign-costs-on-delete for billed jobs.
**`20260619140000_add_jobs_ledger_click_number.sql`**, **`20260619150000_click_number_remaining_rpcs.sql`**, **`20260619160000_click_number_remaining_rpcs_2.sql`**, **`20260619170000_next_job_number_suggestion.sql`** — Job Click Number (`jobs_ledger.click_number`, HCP-wins display bake-in across RPCs, `next_job_number_suggestion()`).

### Baseline (June 4, 2026)

**`20250101000000_baseline.sql`** — 847 pre-June-2026 migrations squashed into a single baseline + seed. The originals (including every `2027…`-typo-named file) live in [`supabase/archive/migrations-pre-baseline/`](../supabase/archive/migrations-pre-baseline/).


### May 2026 — "2027"-typo filenames (archived pre-baseline)

#### May 21, 2026

**`20270521120000_bid_count_row_submission_hides.sql`**
- **Purpose**: **Bids** **Pricing** — sparse **`bid_count_row_submission_hides`** (**`bid_id`**, **`count_row_id`**, **`price_book_version_id`**, PK composite; index on **`bid_id`, `price_book_version_id`**). Row present ⇒ omit fixture from **Cover Letter** + **Approval** pricing-grid lists only; totals unchanged. **RLS**: **`can_access_bid_for_pricing(bid_id)`** for pricing-capable roles. **Backfill** from **`bid_pricing_assignments.omit_from_submission_documents`**, then clears that flag on assignments.
- **Impact**: **[`Bids.tsx`](../src/pages/Bids.tsx)** loads/toggles hides; **`computeBidPricingRows`** + **`hiddenSubmissionCountRowIds`** ([`bidPricingRowCalculations.ts`](../src/lib/bidPricingRowCalculations.ts)); PDF/print (**v2.499** in **`RECENT_FEATURES.md`**). **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Bids / Pricing / RLS

**`20270521120100_drop_bid_pricing_assignments_omit_from_submission_documents.sql`**
- **Purpose**: **DROP** **`bid_pricing_assignments.omit_from_submission_documents`** (canonical hides are **`bid_count_row_submission_hides`**). **`duplicate_bid_to_service_type`** updated to **`INSERT`** matching hide rows after count-row map (same **`price_book_version_id`** semantics as source bid).
- **Impact**: Duplicate-bid UX in **[`BidFormModal.tsx`](../src/components/bids/BidFormModal.tsx)** / related flows preserves per-version omit state; regenerate **`src/types/database.ts`**.
- **Category**: Bids / Pricing / functions

#### May 22, 2026

**`20270522120000_schedule_day_email_requests_and_rpc.sql`**
- **Purpose**: **`schedule_day_email_requests`** (pending row per **`recipient_user_id`** + **`work_date`**, **`send_at`** UTC); **`can_access_project_row_for_user`**, **`list_job_schedule_blocks_for_schedule_email`** (mirrors **`job_schedule_blocks`** SELECT using viewer id); RLS (recipients see own rows; **INSERT** self-only for **master_technician**/**assistant** and base **dev** path — **dev → any non-archived recipient** added in **`20270523120000_dev_schedule_day_email_for_other.sql`**); pg_cron **`schedule-day-email-dispatch`** → Edge ([**`EDGE_FUNCTIONS.md`**](EDGE_FUNCTIONS.md)). **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.522**.
- **Impact**: **[`DashboardTeamActiveClockStrip.tsx`](../src/components/DashboardTeamActiveClockStrip.tsx)**, **[`ScheduleDayEmailModal.tsx`](../src/components/ScheduleDayEmailModal.tsx)**; **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Dashboard / Schedule / Email / RLS

#### May 23, 2026

**`20270523120000_dev_schedule_day_email_for_other.sql`**
- **Purpose**: RLS — **`schedule_day_email_requests_insert_dev_any_recipient`** (**`is_dev()`** + non-archived **`recipient_user_id`**); **`schedule_day_email_requests_select_dev`**. **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.523**.
- **Impact**: **[`ScheduleDayEmailModal.tsx`](../src/components/ScheduleDayEmailModal.tsx)** dev **Send to** picker.
- **Category**: Dashboard / RLS

**`20270523140000_agreed_write_down_billed_invoice.sql`**
- **Purpose**: **`jobs_ledger_invoices`** — **`agreed_write_down_note`**, **`agreed_write_down_at`**, **`agreed_write_down_by`** (**`auth.users`**), **`agreed_write_down_previous_amount`**, **`agreed_write_down_stripe_credit_note_id`**. **`apply_agreed_write_down_to_billed_invoice`** (**JWT**, **`billed`** rows **without** **`stripe_invoice_id`**). **`service_apply_agreed_write_down_from_stripe`** (**`service_role`** only; Stripe Edge path after credit note). **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.524**.
- **Impact**: **[`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx)**, **[`AgreedWriteDownModal.tsx`](../src/components/jobs/AgreedWriteDownModal.tsx)**; **[`stripe-invoice-agreed-write-down`](../supabase/functions/stripe-invoice-agreed-write-down/index.ts)**; **[`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md)**. **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Jobs / Billing / Stripe / RPC

### July 2026

#### July 4, 2026

**`20260704140000_tally_payroll_flags_and_rules.sql`** _(applied to prod 2026-07-04 via Supabase MCP `apply_migration`, ahead of client; validated by full-transaction dry-run first)_
- **Purpose**: **Job Parts Tally "mark as payroll" + auto-rules (dev-only).** New tables **`mercury_tally_payroll_flags`** (`mercury_transaction_id` PK, `is_payroll`, `source` manual/rule, `rule_id`; manual rows incl. false tombstones win over rules) and **`mercury_tally_payroll_rules`** (`name`, `criteria` jsonb V1, `enabled`, `sort_order`). Both dev-only RLS (`is_dev()`). RPCs (SECURITY DEFINER, `search_path=public`, dev-gated): **`set_tally_payroll_flag(uuid, bool)`** — RAISE P0001 when the tx has `mercury_transaction_job_allocations` (flag↔splits mutually exclusive → prevents double-counting payroll against clocked labor); **`bulk_apply_tally_payroll_rule_flags(jsonb)`** — insert `source='rule'` flags only where no flag row exists and no job allocations.
- **Impact**: [`JobTally.tsx`](../src/pages/JobTally.tsx) per-row toggle + rules manager; [`tallyPayrollRules.ts`](../src/lib/tallyPayrollRules.ts) preflight; [`mercuryTxRowFromTally.ts`](../src/lib/mercuryTxRowFromTally.ts) `tallyRowIsResolved` honors `is_payroll`. `npm run gen-types:linked` run after apply; no new security advisors. **`RECENT_FEATURES.md` v2.641**.
- **Category**: Tally / Banking / Payroll / RLS / RPC

#### July 3, 2026

**`20260703150000_customers_master_role_heal_and_guard.sql`** _(applied to prod 2026-07-03 via Supabase MCP `apply_migration`, ahead of client; validated by full-transaction dry-run first)_
- **Purpose**: **Customers mastered to non-master users — heal + guard.** JobFormModal's "Create customer from job" inserted `master_user_id = auth user` (the assistant), so 95 customers + their 104 consistently-linked jobs were "mastered" to assistants (the 20260630200000 invariant made new links fail with P0001 and orphan duplicates). Heals by repointing each mis-mastered customer to the assistant's master (`master_assistants`, else the org's single `master_technician`) — the existing #141 cascade triggers move linked jobs/projects automatically. Adds **`customers_master_role_check`** BEFORE INSERT/UPDATE OF `master_user_id` trigger (SECURITY DEFINER, `search_path=public`): the master must be a `dev`/`master_technician`.
- **Impact**: [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) companion client fix (customer takes the job's master). One-off surgery alongside (not in-migration): deleted 4 reference-free duplicate "Richard Visiko" orphans, linked job 886 to the healed keeper. Post-heal: 0 mis-mastered customers, 0 assistant-mastered jobs, 0 invariant violations. No type regen (no schema change). **`RECENT_FEATURES.md` v2.639**.
- **Category**: Customers / Jobs / Data healing / Triggers

**`20260703130000_dispatch_realtime_publication.sql`** _(applied to prod 2026-07-03 via Supabase MCP `apply_migration`, ahead of client)_
- **Purpose**: **Dispatch inbox live updates restored.** `dispatch_requests` and `dispatch_request_notes` were dropped from the **`supabase_realtime`** publication during the 2026-06-05 connection-incident cleanup, leaving the inbox's `postgres_changes` subscriptions connected but permanently silent — new requests/notes only appeared after a page reload. Idempotent `DO` block re-adds both tables (skips if already present). Both are low-volume (a handful of rows/day), so the connection-pool risk that motivated the trim doesn't apply.
- **Impact**: [`useDispatchInbox.ts`](../src/hooks/useDispatchInbox.ts) realtime channels fire again (no client change needed for that); companion same-tab nudge event shipped in the same PR. No type regen (no schema change). **`RECENT_FEATURES.md` v2.622**.
- **Category**: Dispatch / Realtime

**`20260703120000_user_app_activity_page_daily.sql`** _(applied to prod 2026-07-03 via Supabase MCP `apply_migration`, ahead of client)_
- **Purpose**: **People → Activity** — per-page time dimension. New **`user_app_activity_page_daily`** `(user_id, activity_date, page, active_seconds; PK user+date+page; seconds CHECK 0–86400)`; RLS SELECT mirrors `user_app_activity_daily` (own rows / `is_dev()` / `user_app_activity_viewers` grantees), writes only via the RPC. **`bump_user_app_activity`** dropped + recreated with added **`p_page text DEFAULT NULL`** (body md5-verified against prod before patching; grants re-applied) — one-arg calls from deployed clients keep working; `p_page` trimmed/clipped to 80 chars; zero-second pings skip the page write.
- **Impact**: [`useAppActivityHeartbeat.ts`](../src/hooks/useAppActivityHeartbeat.ts) page-aware bumps; [`appActivityPage.ts`](../src/lib/appActivityPage.ts) page keys; [`PersonActivityDetailModal.tsx`](../src/components/people/PersonActivityDetailModal.tsx) drilldown. `npm run gen-types:linked` run after apply. **`RECENT_FEATURES.md` v2.619**.
- **Category**: People / Activity / Telemetry / RLS

#### July 2, 2026

**`20260702150000_leader_split_week_fence_pay_access_bypass.sql`** _(applied to prod 2026-07-02 via Supabase MCP `apply_migration`, ahead of client)_
- **Purpose**: **People → Payroll → Draft Payroll** — Hours-breakdown day editing on any pay-period day. New helper **`pay_access_clock_week_fence_bypass()`** (`is_pay_approved_master() OR is_assistant_of_pay_approved_master()`; SECURITY DEFINER, `search_path=public`) ANDed into the this-or-last-week (America/Chicago) fence of **`leader_split_clock_session_segments`**, **`leader_split_clock_session_cluster`**, **`leader_replace_clock_session_cluster_mixed`** — bodies re-created verbatim from prod (md5(prosrc)-verified) apart from the one-line fence change each. The **`own_*`** split RPCs stay fenced; the client routes payroll-origin saves through the leader variants. Grants no new capability class (pay-access roles already write `clock_sessions` on any date via role-only RLS).
- **Impact**: [`DashboardMyTimeDayEditorModal.tsx`](../src/components/DashboardMyTimeDayEditorModal.tsx) `saveableRangeOverride` prop + leader-RPC routing; [`DraftPayrollPersonHoursBreakdownModal.tsx`](../src/components/pay/DraftPayrollPersonHoursBreakdownModal.tsx) clickable Date cells; [`People.tsx`](../src/pages/People.tsx) bridge. No type regen (signatures unchanged). **`RECENT_FEATURES.md` v2.597**.
- **Category**: People / Payroll / Clock Sessions / RPC

**`20260702120000_bid_payment_schedule.sql`** _(applied to prod 2026-07-02 via Supabase MCP `apply_migration`, ahead of client)_
- **Purpose**: **Bids → Cover Letter** — **Schedule of Values** (payment schedule). Adds **`bids.include_payment_schedule`** (boolean, NOT NULL DEFAULT false — the per-bid opt-in) and table **`bid_payment_schedule_rows`** `(id, bid_id FK → bids ON DELETE CASCADE, timing text CHECK IN (before_start, before_rough_in, after_rough_in, before_top_out, after_top_out, before_trim_set, after_trim_set), percent numeric CHECK 0–100, sort_order int, created_at)` + index `(bid_id, sort_order)`. **RLS**: one policy per verb, same predicate as the other bid-scoped pricing overlay tables — role ∈ (dev, master_technician, assistant, estimator, primary, superintendent) AND **`can_access_bid_for_pricing(bid_id)`**. Client seeds the 30/30/30/10 default rows on first enable (migration inserts no data; safe ahead of client deploy).
- **Impact**: [`BidsCoverLetterTab.tsx`](../src/components/bids/BidsCoverLetterTab.tsx) (editor + letter wiring), [`coverLetter.ts`](../src/lib/bidDocuments/coverLetter.ts) builders (optional trailing `paymentSchedule` param), [`approvalPdf.ts`](../src/lib/bidDocuments/approvalPdf.ts) (page-4 fetch), new kernel [`paymentSchedule.ts`](../src/lib/bidDocuments/paymentSchedule.ts). **`npm run gen-types:linked`** run after apply. **`RECENT_FEATURES.md` v2.596**.
- **Category**: Bids / Cover Letter / RLS

### June 2026

#### June 30, 2026

**`20260630200000_jobs_ledger_customer_master_invariant.sql`**
- **Purpose**: Invariant — **a job's linked customer must be owned by the job's master** (Stripe billing rejects mismatches with "Customer does not belong to this job master" in `preview-stripe-invoice` / `create-stripe-invoice` / `update-collect-payment-stripe-customer-email`; nothing kept the two in sync, so they drifted). (1) **Backfill**: non-project jobs re-owned to their customer's master ("job follows the customer"); project-linked jobs (master locked to the project owner by `jobs_ledger_project_master_match`) re-point to the unique same-name customer under the job master, else the customer link is cleared for re-pick. (2) **Cascade**: `cascade_customer_master_to_jobs_ledger` AFTER UPDATE trigger on `customers` re-owns directly-linked (non-project) jobs when a customer's `master_user_id` changes — mirrors `cascade_customer_master_to_projects`. (3) **Backstop**: `jobs_ledger_customer_master_match` BEFORE INSERT/UPDATE trigger rejects reintroduced divergence (P0001) — fires only when `customer_id` / `master_user_id` change, so editing unrelated fields on a legacy row is never blocked.
- **Impact**: The billing edge functions stop failing on drifted rows. The new backstop surfaced customers mastered to assistants — healed by `20260703150000_customers_master_role_heal_and_guard.sql` (above).
- **Category**: Jobs / Customers / Data integrity / Triggers

**`20260630190000_connection_monitor_health_checks.sql`**
- **Purpose**: Observability — extend the monitor with a `monitoring.health_checks` table + `checkpoint_activity` view (folded into `sample_connections()`): per-minute checkpoint counters, `io_wait_backends`, and a `sample_duration_ms` **latency canary**. Distinguishes an **infra freeze** (checkpoint stall, sampling gap, conns under ceiling) from **true connection-pool exhaustion**.
- **Impact**: The 2026-06-30 20:34 UTC outage **disproved** the connection-exhaustion theory — the DB froze while idle at 49/90 connections with a 130 s stalled checkpoint (storage/host I/O stall). This captures that fingerprint going forward. See [`SUPABASE_INCIDENT_RUNBOOK.md`](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md) **Phase B2**.
- **Category**: Observability / Incident response

**`20260630180000_connection_usage_monitor.sql`**
- **Purpose**: Observability — a 1-minute `pg_cron` sampler (`connection-usage-sample`) records the live `pg_stat_activity` breakdown into `monitoring.connection_samples` (private `monitoring` schema, **not** exposed by PostgREST). Views `monitoring.connection_breakdown` (per-service classification) + `monitoring.connection_totals` (total vs `max_connections`). 14-day rolling retention. Idempotent; cron scheduling guarded on the `pg_cron` extension.
- **Impact**: Captures *who* holds DB connections at peak so the recurring connection-pool-exhaustion outages (2026-06-05 / 06-24 / 06-30) can be sized with data — `max_connections` bump vs. compute upgrade vs. demand reduction. Analysis queries + interpretation in [`docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md`](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md) **Phase B2**.
- **Category**: Observability / Incident response



**`20260630170000_wrap_noarg_helpers_checklist_instances_rls.sql`**
- **Purpose**: Performance/RLS — wrap the no-arg `STABLE` helpers `is_dev_or_master_or_assistant()` and `can_define_task_style_checklist_items()` in `(select …)` across all four `checklist_instances` policies (SELECT/UPDATE/INSERT/DELETE) so Postgres evaluates them **once per query (InitPlan)** instead of **once per scanned row**. Same proven, semantics-preserving transform as PR #86 on the hot Realtime tables. Row-arg `checklist_item_created_by_auth_user(checklist_item_id)` and the already-wrapped `(select auth.uid())` are left unchanged.
- **Impact**: The "my open instances" read (PostgREST; 2nd-heaviest query on the DB after Realtime WAL CDC) dropped from **76.9 ms / 5,283 buffers → 3.2 ms / 445 buffers** for a staff user under RLS. **Row visibility unchanged** — verified on prod across every policy branch (dev 2424, estimator 1 [created-by], helpers 0, subcontractor 4 [assignee] all match original semantics). Follow-up to the 2026-06-30 connection-pool-exhaustion incident; reduces per-call buffer pressure during concurrency spikes. Applied to prod ahead of `db push` (idempotent DROP/CREATE → safe re-apply).
- **Category**: RLS / Performance / Checklist

#### June 24, 2026

**`20260624160000_mercury_unlinked_count_expr_index.sql`** _(merged in PR #115; applied to prod 2026-06-24)_
- **Purpose**: Add partial expression index `mercury_transactions_unlinked_debit_card_idx` on the IMMUTABLE helper `mercury_debit_card_id_from_raw(raw)` where `duplicate_of_transaction_id IS NULL`. The `count_unlinked_mercury_transactions_for_tally()` family joined on that computed key, forcing a Seq Scan + per-row JSON parse over ~11.4k `mercury_transactions`.
- **Impact**: `EXPLAIN ANALYZE` 363 ms → 6.5 ms warm (~56×); seq scan → index scan. Follow-up to the 2026-06-05 / 06-24 pool-exhaustion incidents.
- **Category**: Materials / Banking / Performance

**`20260624160100_trim_realtime_low_value_publication.sql`** _(merged in PR #115; applied to prod 2026-06-30)_
- **Purpose**: Drop `estimates_thread_notes` + `quickfill_office_arriving_daily_checks` from the `supabase_realtime` publication (11 → 9 tables). Both have a dedicated client channel (removed in the paired PR #115 client edits) with a clean non-realtime refresh path, so dropping them closes an idle CDC channel. `jobs_ledger_thread_notes` intentionally kept (rides shared multi-table channels). Idempotent DO block (drop-if-published).
- **Impact**: Sheds idle Realtime CDC channels; modest connection-pressure reduction. The real ceiling fixes for the recurring outages remain the compute-tier bump + Auth percentage-based connections (Dashboard) — see [`docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md`](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md).
- **Category**: Realtime / Performance

#### June 8, 2026

**Job activity ledger (Phase 2)** — three migrations:
- **`20260608010000_job_activity_events.sql`** — new append-only **`job_activity_events`** table `(id, job_id, event_type, occurred_at, actor_user_id, summary, detail jsonb, financial)` + indexes `(job_id, occurred_at desc)` and `(event_type, detail->>'source_id')`; RLS via new **`can_read_job_activity(job_id, financial)`** helper (operational = `job_status_events` family incl. team members; financial = `jobs_ledger_payments` family, role-gated). New **`humanize_job_status(text)`** helper and **`list_job_activity_events(p_job_id)`** SECURITY DEFINER reader RPC. **Triggers** (AFTER, SECURITY DEFINER, `set search_path = public`, `source_id`-deduped) on `job_status_events` (single status writer), `jobs_ledger_payments` (ins/del), `jobs_ledger_invoices` (ins + dated-col updates), `jobs_ledger_team_members` (ins/del), `jobs_ledger` (field edits: customer/address/revenue), `jobs_ledger_materials`, `jobs_ledger_fixtures`. Table added to the `supabase_realtime` publication.
- **`20260608010050_split_job_combine_separate_activity.sql`** — `CREATE OR REPLACE` of `split_job_ledger_fixtures_to_new_job` (verbatim) adding two `job_separated` event inserts before the success return.
- **`20260608010100_job_activity_events_backfill.sql`** — idempotent backfill (~3,094 rows) from `job_status_events`, `jobs_ledger_payments`, `jobs_ledger_invoices` (4 milestones), `jobs_ledger_invoice_stripe_email_sends`, `jobs_ledger_team_members`; guarded on `(event_type, detail->>'source_id')` so re-runs and trigger overlap never duplicate.
- **Validation**: the full set was run against prod inside a rolled-back transaction (triggers fired with correct counts; split RPC compiled; backfill = 3,094) before `supabase db push`. **`npm run gen-types:linked`** after apply. **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.595**.
- **Category**: Jobs / Activity ledger / Schema / RPC / Triggers

#### June 7, 2026

**`20260607234914_add_get_man_hours_by_job_rpc.sql`**
- **Purpose**: **Jobs → Stages** — back the new **man-hours applied** card line. New function **`get_man_hours_by_job()`** (`language sql`, `stable`, **`SECURITY INVOKER`**, `set search_path = public`) returns `table (job_id text, person_name text, man_hours numeric)`, one row per `(job_id, person_name)`. Mirrors the canonical [`teamLabor.ts`](../src/lib/teamLabor.ts) kernel: salaried = 8h Mon–Fri, hourly = `people_hours` (last 2 years), each crew day split across that day's `job_assignments` by `pct`. `grant execute … to authenticated`. **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.592**.
- **Impact**: [`Jobs.tsx`](../src/pages/Jobs.tsx) Stages board (`loadStagesManHours`, per-job total + per-person hover breakdown). `SECURITY INVOKER` → runs under the caller's RLS, so roles without labor read-access get no rows (line shows `—`). Already applied to prod (the regenerated `src/types/database.ts` includes it, `Args: never`); the migration file lands on `main` to keep history complete. PR #94.
- **Category**: Jobs / Labor / RPC

> **Type-drift reconciliation (not new schema):** `src/types/database.ts` was regenerated from prod (`npm run gen-types:linked`, PR #93) to clear ~169 lines of drift unrelated to feature work — removed the already-dropped `_freeze_crew_lead_bids_backup` / `_freeze_crew_lead_jobs_backup` types (see `20260605212913` above), added the `graphql_public` schema block + the `list_present_mercury_ids` RPC type, and alphabetized the `cost_estimate_*` blocks (column shapes unchanged). No schema change.

#### June 5, 2026

**`20260605225013_make_material_parts_part_type_id_nullable.sql`**
- **Purpose**: **Materials / Bids → Add Part** — make **part type optional**. `ALTER TABLE public.material_parts ALTER COLUMN part_type_id DROP NOT NULL`. The FK to `part_types` and the `idx_material_parts_part_type_id` index both tolerate `NULL` and are unchanged. **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.591**.
- **Impact**: [`PartFormModal.tsx`](../src/components/PartFormModal.tsx) drops the required-part-type guard (relabel **Part Type (optional)** / **No part type**, send `part_type_id || null`); types regenerated so `material_parts.part_type_id` is `string | null`; null-handling fixes in [`Materials.tsx`](../src/pages/Materials.tsx) + [`Duplicates.tsx`](../src/pages/Duplicates.tsx). Applied to prod via the Supabase MCP. **`npm run gen-types:linked`** after apply.
- **Category**: Materials / Bids / Schema

> **Repo reconciliation (not new schema):** five migrations that were applied to prod during the 2026-06-05 RLS/Realtime hardening but were missing their `.sql` files on `main` were recovered into `supabase/migrations/` so `supabase db push` is unblocked (local == remote): **`20260605202851_consolidate_rls_hot_tables_permissive_policies.sql`**, **`20260605210913_wrap_noarg_helpers_hot_tables_rls.sql`**, **`20260605212302_harden_helper_search_path.sql`**, **`20260605212913_drop_backup_tables.sql`**, **`20260605222106_drop_mercury_attribution_allocation_realtime.sql`**. No schema change. See the [migration drift runbook](../AGENTS.md#migration-history-drift-linked-project).

### May 2026

#### May 25, 2026

**`20260525204531_list_unlabeled_mercury_transactions.sql`**
- **Purpose**: Banking **Mercury** **Accounting** — **`list_unlabeled_mercury_transactions(p_limit int default null)`** SECURITY INVOKER RPC. Returns `setof public.mercury_transactions` filtered to rows that have **no** matching `mercury_transaction_drag_sort_assignments` row, ordered `posted_at DESC NULLS LAST, id DESC` (matches the existing master list ordering). `LIMIT p_limit` with `null` default returns all unlabeled rows; PostgREST's project-level cap stays the ultimate ceiling. Anti-join hits the primary key index on **`mercury_transaction_drag_sort_assignments(mercury_transaction_id)`** declared in **`20260502224616_mercury_drag_sort_org_wide_labels.sql`**, so no new index is required. RLS on both tables runs as the caller (existing **dev** / **master_technician** / **assistant** gating on `mercury_transactions` carries through). Single **`grant execute … to authenticated`** completes the migration.
- **Changes**: Single **`create or replace function`** statement plus the grant — re-applying is safe and idempotent. No table / index / RLS / trigger changes.
- **Impact**: **[`Banking.tsx`](../src/pages/Banking.tsx)** splits **`loadRows`** into **`loadAllRows`** + **`loadUnlabeledRows`** + **`loadRowsForActiveView`** (tab-aware dispatcher); the unlabeled-only RPC fires only when (Accounting tab + Hide labeled = on), the default 90% case. Drag Sort, User Review, Category Review, Sorting, and Ledger continue to use the master 15k fetch. **[`BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx)** drops local `hideLabeledTransactions` state, lifts it to props, derives `inputIsUnlabeledOnly`, and short-circuits both `loadAssignmentsForList` and the `displayTransactions` filter when the parent already pre-narrowed the input. New optional `onAfterAssignmentChange?` prop fires after each of the four assignment-table mutation flows (`clearRowDragSortLabel`, `handleQuickAssignLabel`, `handleApprove`, `handleApproveAll`) so the unlabeled list shrinks (or grows) in place. **`RECENT_FEATURES.md`** **v2.579**, **`AGENTS.md`** Banking Mercury Accounting row, **`GLOSSARY.md`** Accounting rules entry. **`npm run gen-types:linked`** after **`db push`** so the new RPC is typed (`Args: { p_limit?: number }`).
- **Category**: Banking / Mercury / Accounting / RPC

**`20260525160441_add_drag_sort_internal_transfers_builtin.sql`**
- **Purpose**: Backfill the **Internal Transfers** Drag Sort built-in (**`mercury_drag_sort_labels`**) into existing orgs without requiring a Drag Sort tab visit to trigger client-side seeding via **`ensureDragSortDefaultLabels()`**. New row: **`default_key='internal_transfers'`**, **`name='Internal Transfers'`**, **`schedule_c_line='N/A'`**, **`is_system_default=true`**, **`sort_order=9999`** (parks at the bottom of the sidebar away from Schedule-C-flavored buckets). Mirrors the **`20260520161301_mercury_drag_sort_employee_benefits_builtin.sql`** precedent.
- **Changes**: Single **`INSERT … ON CONFLICT (default_key) DO NOTHING`** statement so re-applying or running alongside the client seeder is safe (the `default_key` UNIQUE constraint is the canonical de-dupe). Per **`mercury_drag_sort_labels_guard_system_fields`** trigger, the row's **`name`** / **`schedule_c_line`** / **`description`** become immutable after insert. No new RLS / RPCs / triggers — covered by the existing **`mercury_drag_sort_labels`** policies + guard. The label is **mutually exclusive with `mercury_transaction_splits`** but that's enforced client-side via UI hard blocks (see **`RECENT_FEATURES.md`** **v2.572**), not via DB trigger.
- **Impact**: Adds the new bucket to every org's Drag Sort sidebar + Accounting tab dropdowns. Counts toward the new **`'internal_transfer'`** key in **[`overheadPartsAccountingBuckets.ts`](../src/lib/overheadPartsAccountingBuckets.ts)** so labeled rows are excluded from the Field Total / Hours modal's Materials total via **`sumMaterialsTotalUsdExcludingInternalTransfer`**. Sidebar rendering picks up the slate accent automatically once **[`dragSortLabelBucketCard.tsx`](../src/components/banking/dragSortLabelBucketCard.tsx)** receives the new **`defaultKey`** prop. Hard blocks in **[`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx)**, **[`BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx)**, **[`MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx)** prevent label/split coexistence. Helpers **`INTERNAL_TRANSFERS_DEFAULT_KEY`** + **`isInternalTransfersLabel`** in **[`dragSortDefaultLabels.ts`](../src/lib/dragSortDefaultLabels.ts)** centralize the default-key check. Applied via Supabase MCP **`apply_migration`**; observed `sort_order=270` post-apply because the client seeder's `index * 10` pricing ran before the migration and **`ON CONFLICT DO NOTHING`** preserved the existing row — both values still place the label at the bottom of the list, so no fix needed. **`RECENT_FEATURES.md`** **v2.572**, **`GLOSSARY.md`** **Internal Transfers (Banking Mercury Drag Sort built-in)**, **`AGENTS.md`** Drag Sort row. **`npm run gen-types:linked`** after **`db push`** (no schema column changes; ensures history sync).
- **Category**: Banking / Mercury / Drag Sort / Built-in catalog

#### May 19, 2026

**`20260519214147_add_percent_complete_to_project_workflow_steps.sql`**
- **Purpose**: Optional **0-100 progress estimate** on each workflow stage. Editable from three surfaces with a single source of truth: (1) **Forecast Specific gutter** (`/projects?tab=forecast`, Specific sub-tab) — right-aligned cell inside `StageGutterLabel` with a `%` column header in the sticky gutter header; (2) **Forecast Specific stage detail modal** header — compact **`Complete [N] %`** editor (**v2.559**); (3) **Workflow expanded stage card** — new `Complete: [ N ] %` row directly under the existing Expected dates row. NULL = "not tracked"; clamped 0-100 at the DB layer so ad-hoc SQL writers can't bypass the UI's `parsePercentCompleteInput` helper. Forecast All Stages intentionally does NOT render the column.
- **Changes**: **`ALTER TABLE public.project_workflow_steps ADD COLUMN IF NOT EXISTS percent_complete INTEGER NULL CHECK (percent_complete IS NULL OR (percent_complete BETWEEN 0 AND 100))`** + **`COMMENT ON COLUMN`** documenting the 0-100 semantics. Append-only (no edit to existing migrations, no second file sharing the same `YYYYMMDDHHMMSS` prefix). No new RLS — column inherits existing `project_workflow_steps` policies. No RPCs.
- **Impact**: New helper **[`parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts)** (`parsePercentCompleteInput(raw): number | null` — empty/non-numeric → null, **explicit `0` → null** (the helper treats a 0% estimate as functionally identical to "not tracked," so typing `0` clears the cell on all surfaces), negatives → null (clamp to 0 → null), > 100 → 100, fractional → `Math.round` (and fractionals that round to 0 such as `0.4` also clear); 14 unit tests in **[`parsePercentCompleteInput.test.ts`](../src/lib/parsePercentCompleteInput.test.ts)**). Forecast pipeline: **[`projectsForecastData.ts`](../src/lib/projectsForecastData.ts)** (`ForecastStage.percent_complete: number | null` + explicit `select(...)` column), **[`projectsForecastStageResolver.ts`](../src/lib/projectsForecastStageResolver.ts)** (`ForecastStageInput.percent_complete?` optional for legacy callers; `ResolvedStageBar.percentComplete: number | null` required; resolver passes through as `s.percent_complete ?? null`; +3 unit tests for round-trip / undefined→null / explicit-null pass-through). Shared grids: **[`ProjectsForecastTimelineGrid.tsx`](../src/components/projects/ProjectsForecastTimelineGrid.tsx)** + **[`ProjectsForecastSpecificGrid.tsx`](../src/components/projects/ProjectsForecastSpecificGrid.tsx)** got an optional `gutterHeader?: ReactNode` prop (default = empty spacer, preserving All Stages visuals). Forecast Specific: **[`ProjectsForecastSpecificTab.tsx`](../src/components/projects/ProjectsForecastSpecificTab.tsx)** — `StageGutterLabel` widened with `percentComplete` + `percentEditable` + `onPercentCommit`; uncontrolled input re-keyed off the persisted value; `e.stopPropagation()` on input events; `<PercentColumnGutterHeader />` rendered into the gutter header; `labelGutterWidth` bumped 260 → 300 on both grid call sites; `onCommitPercentComplete(stageId, next)` writes via `withSupabaseRetry(supabase.from('project_workflow_steps').update({ percent_complete: next }).eq('id', stageId))` with a `formatErrorMessage(err)` toast on failure; edit gate `canAlignStages(myRole)`; the optimistic-inserted bar gains `percentComplete: null` to satisfy the new required field. **v2.562** (client-only, no schema change) — gutter `%` commits stamp optimistic **`pendingPercentByStageId`** (merged into **`effectiveResolvedBars`**), call parent **`refreshStages()`** after successful write, and blur focused gutter inputs (`data-forecast-pct="true"`) when **Edit** toggles off. Stage modal: **[`ProjectsForecastSpecificStageModal.tsx`](../src/components/projects/ProjectsForecastSpecificStageModal.tsx)** — header **`Complete [N] %`** editor (**v2.559**). Workflow page: **[`Workflow.tsx`](../src/pages/Workflow.tsx)** — new "Row 2c: Percent complete" rendered under Expected dates inside every expanded stage card; same uncontrolled-input idiom; `updatePercentComplete(step, value)` mirrors `submitExpectedDates` shape (DB write + optimistic `setSteps` merge); edit gate `canManageStages || s.assigned_to_name === currentUserName`. Applied via Supabase MCP **`apply_migration`** (returned `{success: true}`); `npm run gen-types:linked` confirms `percent_complete: number | null` on `Database['public']['Tables']['project_workflow_steps']['Row']` / `['Insert']` / `['Update']`. **`RECENT_FEATURES.md`** **v2.559** / **v2.562**, **`GLOSSARY.md`** **Percent complete (workflow step)**.
- **Category**: Workflow / Projects / Forecast / schema

**`20260519170221_add_project_number_to_projects.sql`**
- **Purpose**: **Auto-assigned `Project #N`** on **`public.projects`** (mirrors the **`bids.bid_number`** pattern). Adds **`project_number TEXT DEFAULT ''`** + index, creates org-global **`projects_project_number_seq`**, backfills every existing row oldest-first via `row_number() OVER (ORDER BY created_at ASC NULLS LAST, id ASC)`, pins the sequence to `MAX(project_number) + 1`, and installs **`set_project_number_if_empty()`** as a **`BEFORE INSERT FOR EACH ROW`** trigger so manually-passed values are honored verbatim and only blanks get auto-filled. Backfill verified: 6 / 6 rows numbered 1–6 in `created_at` order; `projects_project_number_seq.last_value=7, is_called=true`.
- **Changes**: **`ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_number TEXT DEFAULT ''`** + **`CREATE INDEX IF NOT EXISTS idx_projects_project_number`** + **`COMMENT ON COLUMN`**; **`CREATE SEQUENCE IF NOT EXISTS public.projects_project_number_seq START 1`**; CTE-driven backfill; **`setval`** to **`MAX + 1`** (regex-guarded `^\s*\d+\s*$` on the existing values so non-numeric entries can't crash the cast); **`CREATE OR REPLACE FUNCTION public.set_project_number_if_empty()`** that fills only when **`NEW.project_number IS NULL OR trim(...) = ''`**; **`DROP TRIGGER IF EXISTS … ; CREATE TRIGGER projects_set_project_number BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION …`**. No new RLS — column inherits existing `projects` policies. The **`BEFORE INSERT`** scope means manual UPDATE renames stay free-text (cleared = stays cleared).
- **Impact**: New helper **[`projectNumberLabel.ts`](../src/lib/projectNumberLabel.ts)** (`formatProjectNumberLabel` / `formatProjectNumberBadge`, both null-safe and trim-safe; 11 unit tests in **[`projectNumberLabel.test.ts`](../src/lib/projectNumberLabel.test.ts)**). Display surfaces wired: **[`EditProjectForm.tsx`](../src/components/projects/EditProjectForm.tsx)** (round 1 = read-only badge in title; round 2 = first-position editable **`Project #`** input + live duplicate warning via `projects.select('id, name').eq('project_number', trimmed).neq('id', projectId).limit(1)` + `payload.project_number = projectNumber.trim()`), **[`Projects.tsx`](../src/pages/Projects.tsx)** (inline muted label next to the project-name `<Link>`), **[`Workflow.tsx`](../src/pages/Workflow.tsx)** (chip text `Project #N · {name}` with `Project: {name}` fallback), **[`Dashboard.tsx`](../src/pages/Dashboard.tsx)** (`SubscribedStep` type extended with `project_number: string | null`, projects loader select widened to `'id, name, project_number'`, in-memory `projectMap` carries `{ name, project_number }`, JSX renders `{formatProjectNumberLabel(sub.project_number) ?? 'Project'}: {sub.project_name}`). Unchanged: `NewProjectForm.tsx` (INSERT omits `project_number`, trigger fills); other surfaces showing project names (Jobs Stages, DetailJobModal, Calendar, ForecastSpecific, People active projects) intentionally untouched. **`RECENT_FEATURES.md`** **v2.557**, **`GLOSSARY.md`** **Project Number**, **`PROJECT_DOCUMENTATION.md`** `public.projects` Key Fields. Applied via Supabase MCP `apply_migration` (local file timestamp predated the `20260519171140` dispatch-requests migration); `npm run gen-types:linked` confirms `project_number: string | null` on `Database['public']['Tables']['projects']['Row']`.
- **Category**: Projects / schema / Sequence + Trigger

**`20260519171140_dispatch_requests_pending_action.sql`**
- **Purpose**: **Dashboard My Schedule → Dispatch task** flow. Adds a stable token to **`dispatch_requests`** that drives in-app action affordances on inbox rows. The first known value is **`'link_job_pictures'`** — *Add a Customer Pictures folder for a job*, surfaced as an **Add Customer Pictures URL** button on the dispatch inbox row that deep-links into **Edit Job** with the **Customer Pictures** input scrolled into view, focused, and flashed. Future tokens can extend the same UX without further schema changes.
- **Changes**: **`ALTER TABLE public.dispatch_requests ADD COLUMN IF NOT EXISTS pending_action text NULL`** (nullable so plain text tasks keep working unchanged) + **`COMMENT ON COLUMN`** documenting the known token. **Partial index** **`dispatch_requests_pending_action_open_job_idx`** on **`(job_ledger_id, pending_action) WHERE pending_action IS NOT NULL AND status = 'open'`** so the per-job dedupe lookup (*do we already have an open `link_job_pictures` request for this job?*) costs a single index seek even as `dispatch_requests` grows. No RLS additions — existing row policies cover the new column. No RPCs.
- **Impact**: **[`Dashboard.tsx`](../src/pages/Dashboard.tsx)** (`submitLinkJobPicturesDispatchRequest` — dedupe SELECT → INSERT → fire `notify-dispatch-request` Edge → toast); **[`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx)** (`jobPicturesLinkHighlight` flag mirrors `fixturesSectionHighlight` pattern — scroll/focus/flash + auto-close `dispatch_requests` after URL save); **[`JobFormModalContext.tsx`](../src/contexts/JobFormModalContext.tsx)** (`OpenEditJobOptions.jobPicturesLinkHighlight`); **[`DispatchInboxSection.tsx`](../src/components/DispatchInboxSection.tsx)** + **[`useDispatchInbox.ts`](../src/hooks/useDispatchInbox.ts)** (row type + select column list + `onLinkJobPictures?` prop + button render); wired from **[`Dashboard.tsx`](../src/pages/Dashboard.tsx)**, **[`Quickfill.tsx`](../src/pages/Quickfill.tsx)**, **[`ChecklistReviewInboxes.tsx`](../src/components/checklist/ChecklistReviewInboxes.tsx)** (all three `DispatchInboxSection` mounts). Edge **`notify-dispatch-request`** unchanged (already tolerates empty `links[]`). **`RECENT_FEATURES.md`** **v2.556**, **`GLOSSARY.md`** **Link Customer Pictures dispatch action**. Applied via Supabase MCP `apply_migration` (local file timestamp predated existing remote migrations); `npm run gen-types:linked` after apply.
- **Category**: Dashboard / Dispatch / schema

#### May 16, 2026

**`20260516162434_drop_crew_lead_inheritance_from_sync_rpcs.sql`**
- **Purpose**: Drop the "skip if **`crew_lead_person_name`** is set" branch from **`sync_crew_jobs_from_clock(p_person_name text, p_work_date date)`** and **`sync_crew_bids_from_clock(p_person_name text, p_work_date date)`**. Both RPCs now always recompute `job_assignments` / `bid_assignments` from approved closed **`clock_sessions`** for that (person, date) and force **`crew_lead_person_name = NULL`** on every `INSERT` / `ON CONFLICT DO UPDATE`. Pairs with **`20260516154601_freeze_crew_lead_inheritance.sql`** (data freeze) to fully retire the inherit-from-crew-lead feature.
- **Changes**: `CREATE OR REPLACE FUNCTION` for both; removed `v_crew_lead` declaration, `SELECT crew_lead_person_name INTO …` lookup, and the `IF v_crew_lead IS NOT NULL THEN RETURN; END IF;` early-exit; `INSERT … VALUES (…, NULL, v_assignments, v_person_id)` and `ON CONFLICT … DO UPDATE SET crew_lead_person_name = NULL, job_assignments = EXCLUDED.job_assignments, person_id = COALESCE(public.people_crew_jobs.person_id, EXCLUDED.person_id)` (mirror for bids). `COMMENT ON FUNCTION …` records the deprecation. **`approve_clock_sessions`** / **`revoke_clock_sessions`** call these RPCs unchanged.
- **Impact**: **[`CrewJobsBlock.tsx`](../src/components/CrewJobsBlock.tsx)** (Crew column / picker removed), **[`peopleHoursUnallocatedRows.ts`](../src/lib/peopleHoursUnallocatedRows.ts)**, **[`payReportAssignmentsBreakdown.ts`](../src/lib/payReportAssignmentsBreakdown.ts)**, **[`draftPayrollPersonBreakdown.ts`](../src/lib/draftPayrollPersonBreakdown.ts)**, **[`crewAssignments.ts`](../src/utils/crewAssignments.ts)**, **[`teamLabor.ts`](../src/utils/teamLabor.ts)**, **[`HoursUnassignedModal.tsx`](../src/components/HoursUnassignedModal.tsx)**, **[`PeopleHoursDayAuditModal.tsx`](../src/components/PeopleHoursDayAuditModal.tsx)**, **[`QuickfillUnassignedFieldTimeSection.tsx`](../src/components/quickfill/QuickfillUnassignedFieldTimeSection.tsx)**, **[`HoursSection.tsx`](../src/components/quickfill/HoursSection.tsx)**, **[`People.tsx`](../src/pages/People.tsx)**, **[`Jobs.tsx`](../src/pages/Jobs.tsx)** — all now read `row.job_assignments ?? []` directly. **`RECENT_FEATURES.md`** **v2.538**, **`GLOSSARY.md`** **Crew lead inheritance (deprecated)**, **`PROJECT_DOCUMENTATION.md`** People **Team Costs Tab**. `npm run gen-types:linked` ran after apply to refresh `src/types/database.ts` with the new function bodies. Applied via Supabase MCP `apply_migration` + `supabase migration repair --status applied 20260516162434 --linked` because the local file timestamp landed before existing remote migrations.
- **Category**: People / Crew Jobs / RPC

**`20260516154601_freeze_crew_lead_inheritance.sql`**
- **Purpose**: Materialize the effective `job_assignments` / `bid_assignments` of every **`people_crew_jobs`** / **`people_crew_bids`** follower row into its own column, then null out `crew_lead_person_name` everywhere. Lets us drop the inherit-from-crew-lead feature without losing any historical hours allocation. Idempotent — safely re-runnable.
- **Changes**: Creates audit backup tables **`public._freeze_crew_lead_jobs_backup`** and **`public._freeze_crew_lead_bids_backup`** via `CREATE TABLE IF NOT EXISTS … AS SELECT …` and snapshots every follower row before mutating; the tables are unprivileged (no RLS enabled, no grants to `authenticated` / `anon`), so only the migration owner / service role can read them. The materialization itself is a single `UPDATE … FROM followers LEFT JOIN leads …` per table: for each `people_crew_jobs` follower (`crew_lead_person_name IS NOT NULL`), resolves the lead on `(work_date, person_name = crew_lead_person_name)` and writes `job_assignments = COALESCE(l.job_assignments, '[]'::jsonb)` (orphans collapse to `'[]'`); mirror for `people_crew_bids` / `bid_assignments`. Same statement nulls out `crew_lead_person_name` on every updated row. A `DO $$ … RAISE EXCEPTION IF count > 0` guard at the end rolls back the transaction if any follower rows are left, and column `COMMENT`s are updated to mark `crew_lead_person_name` deprecated.
- **Impact**: Pre-flight audit captured **116** job follower rows and **29** bid follower rows; post-migration `SELECT COUNT(*) WHERE crew_lead_person_name IS NOT NULL` returns **0** on both tables. **`people_crew_jobs.crew_lead_person_name`** and **`people_crew_bids.crew_lead_person_name`** are now **always `NULL`**. Downstream readers stopped consulting the column in **v2.538** (see paired migration above). A future migration may drop the columns once any external consumers are updated. `RECENT_FEATURES.md` **v2.538**. Applied via Supabase MCP `apply_migration` + `supabase migration repair --status applied 20260516154601 --linked`.
- **Category**: People / Crew Jobs / Data freeze

#### May 15, 2026

**`20260515233801_pay_staff_remove_not_coming_in_for_user_day.sql`**
- **Purpose**: **`pay_staff_remove_not_coming_in_for_user_day(p_user_id uuid, p_work_date date)`** — **`SECURITY DEFINER`** RPC for the **Schedule Dispatch** *Undo Not coming in* flow. Symmetric to **`pay_staff_bulk_insert_user_time_off`** with the **same authz gate** (`is_dev` / `is_pay_approved_master` / `is_assistant_of_pay_approved_master` / `is_assistant`) and **per-target check** (`salary_schedule_staff_or_self_target`).
- **Changes**: Tightly scoped DELETE — only rows where `user_id = p_user_id AND start_date = p_work_date AND end_date = p_work_date AND kind = 'unpaid' AND note = 'Not coming in'` (so PTO and other variants are intentionally untouchable through this path). After delete, runs `sync_salary_clock_sessions_for_user_day(p_user_id, p_work_date)` when `p_work_date = (timezone('America/Denver', now()))::date` so any salary session that was hidden by the time-off entry comes back. Returns JSONB `{ ok, deleted, sync_warning? }` on success / `{ ok:false, message }` on bad args. `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role`.
- **Impact**: **[`ScheduleDispatchUndoNotComingInModal.tsx`](../src/components/schedule/ScheduleDispatchUndoNotComingInModal.tsx)** + **[`removeNotComingInForUserAsStaff`](../src/lib/notComingInTimeOff.ts)** + cell-chip click in **[`ScheduleDispatchHubPage.tsx`](../src/components/schedule/ScheduleDispatchHubPage.tsx)** / **[`ScheduleDispatchJobWeek.tsx`](../src/components/schedule/ScheduleDispatchJobWeek.tsx)**. Table-level RLS DELETE policy on `user_time_off` stays self-only — staff use this RPC, never a direct delete. **`RECENT_FEATURES.md`** **v2.535**. `npm run gen-types:linked` after apply.
- **Category**: Schedule Dispatch / People / Time off / SECURITY DEFINER RPCs

**`20260515102040_bid_estimators_tab.sql`**
- **Purpose**: **Bids → Estimators tab** (`?tab=estimators`, viewable by **all roles**). Creates:
  - **`bid_estimators_extra_users(user_id PK → public.users, added_at, added_by)`** — org-wide augmentation list for the estimators column set. RLS: authenticated read; **dev / master_technician / assistant** insert/delete (inline role check, not `is_dev_or_master_or_assistant()` which now also matches `primary`).
  - **`list_bid_estimators_window_hours(p_user_ids UUID[], p_start_date DATE, p_end_date DATE)`** **SECURITY DEFINER STABLE** → `(user_id, bid_id, work_date, hours NUMERIC)` per-day decimal hours per (user, bid). Filters: **`bid_id IS NOT NULL`**, **`rejected_at IS NULL`**, **`revoked_at IS NULL`**, window-bounded, clamped `COALESCE(clocked_out_at, now())`.
  - **`list_bid_estimators_all_time_hours(p_bid_ids UUID[])`** **SECURITY DEFINER STABLE** → `(bid_id, hours NUMERIC)` lifetime team clock hours per bid (denominator for the per-day cell percentages). Same session filter semantics.
- **Impact**: **[`BidsEstimatorsTab.tsx`](../src/components/bids/BidsEstimatorsTab.tsx)** + **[`BidsEstimatorsExtraUsersModal.tsx`](../src/components/bids/BidsEstimatorsExtraUsersModal.tsx)**; pure helpers **[`bidEstimatorsTab.ts`](../src/lib/bidEstimatorsTab.ts)** (14 tests). **[`Bids.tsx`](../src/pages/Bids.tsx)** wires the tab right of **Bid Costs** in all four primary-tab layout branches. **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.531**. `npm run gen-types:linked` after apply.
- **Category**: Bids / Pivot / RLS / SECURITY DEFINER RPCs

#### May 11, 2026

**`20260511015410_bids_working_board_archive.sql`**
- **Purpose**: **`bids.working_board_archived_at`** / **`working_board_archived_by`** (soft-hide from Unsent/Working UI and clock quick picks; **`bid_working_board_placements`** unchanged). **`BEFORE INSERT OR UPDATE`** trigger clears archive when **`bid_date_sent`** is set or **`outcome`** is **`won`/`lost`/`started_or_complete`**. Partial index on **`working_board_archived_at`** where not null.
- **Impact**: **[`Bids.tsx`](../src/pages/Bids.tsx)**, **[`BidsWorkingBoard.tsx`](../src/components/bids/BidsWorkingBoard.tsx)**, **[`BidFormModal.tsx`](../src/components/bids/BidFormModal.tsx)** (**Archive from board** footer — **`RECENT_FEATURES.md`** **v2.518**), **[`BidWorkingBoardArchivedModal.tsx`](../src/components/bids/BidWorkingBoardArchivedModal.tsx)**, **[`fetchWorkingBoardClockBidPicks.ts`](../src/lib/fetchWorkingBoardClockBidPicks.ts)**; **`BIDS_SYSTEM.md`**, **`RECENT_FEATURES.md`** **v2.517** / **v2.518**. **`npm run gen-types:linked`** after **`db push`** (or sync **`database.ts`**).
- **Category**: Bids / schema

**`20260511012922_split_job_ledger_fixtures_to_new_job.sql`**
- **Purpose**: **`split_job_ledger_fixtures_to_new_job`** — **`SECURITY DEFINER`**, source **working** only; no invoices/payments/collect flow; validates fixture + session IDs; **cannot** move **all** fixtures; revenue for moved lines matches app extended Specific Work math; **`INSERT`** new **`jobs_ledger`**, **`UPDATE`** fixtures + optional **`clock_sessions`**, subtract revenue from source, copy **`jobs_ledger_team_members`**; **`GRANT EXECUTE`** **`authenticated`** on full signature (incl. default **`p_clock_session_ids`**).
- **Impact**: **[`JobsCombineSeparateModal.tsx`](../src/components/jobs/JobsCombineSeparateModal.tsx)**, **[`Jobs.tsx`](../src/pages/Jobs.tsx)** — Stages **Combine / Separate** control at the **right** end of the toolbar row (**`RECENT_FEATURES.md`** **v2.516**). **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Jobs / Billing / RPC

**`20260511011751_migrate_job_ledger_merge_target_revenue.sql`**
- **Purpose**: **`migrate_job_ledger_costs_and_delete`** — same repoint/merge/delete behavior as **`20270425120000`**, plus **`UPDATE`** target **`jobs_ledger.revenue`** **`+=`** source **`revenue`** (**`COALESCE`** both to 0) after team-member cleanup and before **`DELETE`** source **`jobs_ledger`**. **`COMMENT ON FUNCTION`** notes revenue merge.
- **Impact**: **[`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx)** migrate dialog + toast (**`RECENT_FEATURES.md`** **v2.515**). No RPC signature change; **`npm run gen-types:linked`** not required.
- **Category**: Jobs / Billing / RPC

#### May 10, 2026

**`20260510215603_quickfill_office_arriving_daily_checks.sql`**
- **Purpose**: **`quickfill_office_arriving_daily_checks`** — **PK** **`(item_id text, work_date)`**, **`checked_at`**, **`checked_by`** (default **`auth.uid()`** → **`users`**). **RLS**: **SELECT**/**INSERT**/**DELETE** for **`is_dev_or_master_or_assistant()`**; **INSERT** **`WITH CHECK`** **`checked_by = auth.uid()`**. **`supabase_realtime`** publication on the table. **`app_settings`**: replaces **`authenticated_update_quickfill_office_arriving_leaving_done`** with **`authenticated_update_quickfill_office_leaving_done`** (**`UPDATE`** only **`key = 'quickfill_office_leaving_done'`**; legacy **`quickfill_office_arriving_done`** row not client-updated).
- **Impact**: **[`QuickfillOfficeSection.tsx`](../src/components/quickfill/QuickfillOfficeSection.tsx)** — **Office Arriving** uses daily checks + **Realtime**; **Office Leaving** still JSON. **`ACCESS_CONTROL.md`**, **`RECENT_FEATURES.md`**. **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Quickfill / RLS / Realtime

**`20260510215023_quickfill_difficult_people_daily_checks.sql`**
- **Purpose**: **`quickfill_difficult_people_daily_checks`** — **PK** **`(item_id, work_date)`**, **`checked_at`**, **`checked_by`** (default **`auth.uid()`**). **RLS**: **SELECT**/**INSERT**/**DELETE** for **`is_dev_or_master_or_assistant()`**; **INSERT** **`WITH CHECK`** **`checked_by = auth.uid()`**. **Removes** from **`quickfill_difficult_people_items`**: **`completed_at`**, **`completed_by`**, completion **CHECK**, partial index, **`quickfill_difficult_people_items_non_dev_update_guard`** trigger/function; **UPDATE** on items **dev-only** (**`quickfill_difficult_people_items_update_dev`** replaces staff update policy).
- **Impact**: **[`QuickfillDifficultPeopleSection.tsx`](../src/components/quickfill/QuickfillDifficultPeopleSection.tsx)** — per–company-day checkboxes (**`denverCalendarDayKey`**); **`ACCESS_CONTROL.md`**, **`RECENT_FEATURES.md`**. **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Quickfill / People / RLS

**`20260510213434_quickfill_difficult_people_items.sql`**
- **Purpose**: **`quickfill_difficult_people_items`** — org-wide Quickfill follow-ups (**`person_id`** → **`people`**, **`action_text`**, **`reason_text`**, **`created_by`**). *(Initial release added **`completed_*`** + non-dev completion trigger; those are **dropped** by **`20260510215023`** in favor of **`quickfill_difficult_people_daily_checks`**.)* **RLS**: **SELECT** **`is_dev_or_master_or_assistant()`**; **INSERT**/**DELETE** **`is_dev()`**; **UPDATE** **dev-only** after **`20260510215023`**.
- **Impact**: **[`QuickfillDifficultPeopleSection.tsx`](../src/components/quickfill/QuickfillDifficultPeopleSection.tsx)**, **[`Quickfill.tsx`](../src/pages/Quickfill.tsx)** **`difficult-people`** **`section_id`**; **`ACCESS_CONTROL.md`**, **`RECENT_FEATURES.md`**. **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Quickfill / People / RLS

#### May 5, 2026

**`20260505231245_list_mercury_drag_sort_label_assignment_counts.sql`**
- **Purpose**: Banking **Mercury** **Accounting** — **`list_mercury_drag_sort_label_assignment_counts()`** returns **`label_id`** + **`assignment_count`** from **`mercury_transaction_drag_sort_assignments`** (**`GROUP BY label_id`**). **`SECURITY INVOKER`** + assignments **SELECT RLS** (banking staff). Labels with zero assignments omit from result (UI treats missing as **0**).
- **Impact**: [`BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx); [`AccountingRuleFormModal.tsx`](../src/components/banking/AccountingRuleFormModal.tsx) (**SearchableSelect** ordering). **`npm run gen-types:linked`** after **`db push`** if typings regenerated from remote.
- **Category**: Banking / Mercury / RPC

#### May 4, 2026

**`20260504040116_bulk_accounting_label_suggestions_rpcs.sql`**
- **Purpose**: Banking **Mercury** **Accounting** — **`bulk_approve_accounting_label_suggestions(p_items jsonb)`** (atomic upsert **`mercury_transaction_drag_sort_assignments`** + approve rows in **`mercury_accounting_label_suggestions`**, max **500** per call, banking-staff guard); **`bulk_insert_accounting_label_suggestions(p_rows jsonb)`** (bulk **`pending`** inserts with **`ON CONFLICT … WHERE (status = 'pending') DO NOTHING`**, max **2000** per call). **`SECURITY DEFINER`**, **`SET search_path = public`**, **`GRANT EXECUTE`** **`authenticated`** + **`service_role`**.
- **Impact**: [`BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx) **Apply rules** / **Approve all** use RPCs + **`withSupabaseRetry`**; chunking on client when over cap. **`src/types/database.ts`** RPC typings after apply (**`npm run gen-types:linked`** preferred).
- **Category**: Banking / Mercury / RPC

**`20260504011219_mercury_accounting_label_rules_and_suggestions.sql`**
- **Purpose**: Banking **Mercury** **Accounting** tab — **`mercury_accounting_label_rules`** (named rules, **`label_id`** → **`mercury_drag_sort_labels`**, **`enabled`**, **`sort_order`**, **`criteria` jsonb** default **`{"v":1}`**, **`created_by`**); **`mercury_accounting_label_suggestions`** (queue: **`mercury_transaction_id`**, **`rule_id`**, **`suggested_label_id`**, **`status`** **`pending`/`approved`/`rejected`**, **`final_label_id`**, **`resolved_at`**, **`resolved_by`**). **Partial UNIQUE** one **`pending`** row per transaction; **`updated_at`** trigger on rules. **RLS**: banking staff **`dev`**, **`master_technician`**, **`assistant`** (same EXISTS pattern as Drag Sort org-wide tables).
- **Impact**: [`BankingMercuryAccountingTab.tsx`](../src/components/banking/BankingMercuryAccountingTab.tsx); [`accountingLabelRuleMatch.ts`](../src/lib/accountingLabelRuleMatch.ts) (**`resolveAccountingRuleAmountBounds`** — inclusive amount interval, **Min**/**Max** order normalization for **Test** / **Apply**; `accountingLabelRuleMatch.test.ts`; **`RECENT_FEATURES.md`** **v2.486**); [`Banking.tsx`](../src/pages/Banking.tsx) **`?tab=accounting`**; [`bankingDragSortStorage.ts`](../src/lib/bankingDragSortStorage.ts) per-tab hide-labeled key; shared ledger [`bankingMercuryDragSortLedger.tsx`](../src/components/banking/bankingMercuryDragSortLedger.tsx). **`npm run gen-types:linked`** after **`db push`**.
- **Category**: Banking / Mercury / RLS

#### May 2, 2026

**`20260502232908_mercury_transaction_org_notes.sql`**
- **Purpose**: Banking **Notes** panel — **organization-wide** scratch note per **`mercury_transactions`** row (**`mercury_transaction_org_notes`**, PK **`mercury_transaction_id`**, **`body`** ≤ **2000**, **`updated_by`**). **RLS** **SELECT** for **`dev`**, **`master_technician`**, **`assistant`**; **INSERT/UPDATE/DELETE** policies defined but **revoked** from **`authenticated`** on the table (writes via **`upsert_mercury_org_transaction_note`** **`SECURITY DEFINER`**, same role gate; empty body deletes).
- **Impact**: [`MercuryTxNotesDisclosure.tsx`](../src/components/banking/MercuryTxNotesDisclosure.tsx) (**Team note**); [`Banking.tsx`](../src/pages/Banking.tsx); [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx); [`useMercuryOrgNotesByTxId.ts`](../src/hooks/useMercuryOrgNotesByTxId.ts); [`bankingMercuryNotesSubRowColSpan.ts`](../src/lib/bankingMercuryNotesSubRowColSpan.ts) (`bankingMercuryNotesSubRowColSpan.test.ts`); **`npm run gen-types:linked`** after **`db push`**. **UI** (`RECENT_FEATURES.md` → **v2.475**–**v2.480**): **Edit note** under **Amount**; default **read-only preview** (**v2.476**–**v2.477**); editor polish (**v2.478**); **notes-band grouping** + tight spacing + optional **Drag Sort** **bank \| note** preview (**v2.479**); **Counterparty**-aligned notes sub-row (**spacer `colSpan`** + content cell, symmetric inner padding — **v2.480**); no **Notes** column (**v2.475**).
- **Category**: Banking / Mercury / RLS / RPC

**`20260502224616_mercury_drag_sort_org_wide_labels.sql`**
- **Purpose**: Banking **Drag Sort** — **org-wide** labels and assignments: merge duplicate **`mercury_drag_sort_labels`** (by **`default_key`** for built-ins, by **`lower(trim(name))`** for custom) and duplicate **`mercury_transaction_drag_sort_assignments`** (latest **`assigned_at`** wins per transaction); drop **`user_id`** from labels and assignments; PK **`mercury_transaction_id`** only on assignments; partial **UNIQUE** **`(default_key)`** on labels; RLS for banking staff **without** per-row **`auth.uid()`** ownership; update built-in guard trigger (no **`user_id`**).
- **Impact**: [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx), [`dragSortDefaultLabels.ts`](../src/lib/dragSortDefaultLabels.ts), [`src/types/database.ts`](../src/types/database.ts); **`ACCESS_CONTROL.md`**, **`GLOSSARY.md`**, **`PROJECT_DOCUMENTATION.md`**, **`AI_CONTEXT.md`**. Drops index **`20260502205309_mercury_drag_sort_assignments_user_tx_idx`** (obsolete).
- **Category**: Banking / Mercury / RLS

**`20260502225320_mercury_drag_sort_default_key_unique_not_partial.sql`**
- **Purpose**: Replace **partial** **`UNIQUE (default_key) WHERE default_key IS NOT NULL`** on **`mercury_drag_sort_labels`** with a **full** unique index on **`default_key`**. PostgREST **upsert** emits **`ON CONFLICT (default_key)`** without the partial predicate, so Postgres could not use **`20260502224616`**’s index — client **`ensureDragSortDefaultLabels`** failed and **`BankingMercuryDragSortTab`** cleared the list. Non-null duplicates still forbidden; multiple **`NULL`** **`default_key`** (custom labels) remain valid. Idempotent **INSERT** of built-in rows **`ON CONFLICT (default_key) DO NOTHING`** for orgs that ended up empty.
- **Impact**: [`dragSortDefaultLabels.ts`](../src/lib/dragSortDefaultLabels.ts) (still **`onConflict: 'default_key'`**); [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx). **`src/types/database.ts`** usually unchanged.
- **Category**: Banking / Mercury (index + seed)

**`20260502202929_rename_drag_sort_rent_lease_builtin_names.sql`**
- **Purpose**: Banking **Drag Sort** — rename two built-in **`default_key`** rows that shared **"Rent or Lease"**: **`rent_lease_20a`** → **Equipment Lease**, **`rent_lease_20b`** → **Property Lease**. Temporarily disables **`mercury_drag_sort_labels_guard_system_fields_trg`** for the **UPDATE** only.
- **Impact**: [`dragSortDefaultLabels.ts`](../src/lib/dragSortDefaultLabels.ts) (seed catalog match); **`RECENT_FEATURES.md`** **v2.473**
- **Category**: Banking / Mercury (data)

**`20260502205309_mercury_drag_sort_assignments_user_tx_idx.sql`**
- **Purpose**: Index **`mercury_transaction_drag_sort_assignments (user_id, mercury_transaction_id)`** for faster per-user assignment scans (Drag Sort single-query load).
- **Impact**: Performance only; no **`database.ts`** change required.
- **Category**: Banking / Mercury (index)

**`20260502193138_mercury_drag_sort_label_system_defaults.sql`**
- **Purpose**: Banking **Drag Sort** — **`is_system_default`** + **`default_key`** on **`mercury_drag_sort_labels`**; **UNIQUE** **`(user_id, default_key)`** for idempotent built-in labels; **trigger** blocks edits to name / line / description on built-ins. App seeds **Schedule C–style** defaults per user via [`dragSortDefaultLabels.ts`](../src/lib/dragSortDefaultLabels.ts).
- **Impact**: [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx); **`npm run gen-types:linked`** after **`db push`**
- **Category**: Banking / Mercury

**`20260502191955_mercury_drag_sort_labels_schedule_c.sql`**
- **Purpose**: Banking **Drag Sort** — add **`schedule_c_line`** (optional short text, max **32**) and **`description`** (optional, max **2000**) on **`mercury_drag_sort_labels`**. **RLS** unchanged.
- **Impact**: [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx); **`npm run gen-types:linked`** after **`db push`**
- **Category**: Banking / Mercury

**`20260502183057_mercury_drag_sort_labels.sql`**
- **Purpose**: Banking **Mercury** **Drag Sort** tab — **`mercury_drag_sort_labels`** (per-user label names + **`sort_order`**) and **`mercury_transaction_drag_sort_assignments`** (composite PK **`(mercury_transaction_id, user_id)`**, FK to label; **ON DELETE CASCADE** from **`mercury_transactions`** and labels). **RLS**: **SELECT/INSERT/UPDATE/DELETE** for **`authenticated`** when **`user_id = auth.uid()`** and **`users.role`** ∈ **`dev`**, **`master_technician`**, **`assistant`** (same gate as other Banking staff mutations).
- **Impact**: [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx); [`Banking.tsx`](../src/pages/Banking.tsx) **`?tab=drag_sort`**; **`RECENT_FEATURES.md`** **v2.467**; **`PROJECT_DOCUMENTATION.md`** §15; **`ACCESS_CONTROL.md`** Banking row; **`npm run gen-types:linked`** after **`db push`**
- **Category**: Banking / Mercury / RLS

**`20260502070926_contract_tables_assistant_no_delete.sql`**
- **Purpose**: **People → Contracts** — plain **`assistant`** must not **DELETE** from **`contract_templates`**, **`contract_template_documents`**, **`person_contract_assignments`**, or **`person_contract_documents`**. Replaces legacy **`FOR ALL`** policies (**`20260322140000_contracts_rls_all_masters.sql`**) with separate **SELECT** / **INSERT** / **UPDATE** / **DELETE** policies: **DELETE** uses the same role bundle **without** **`is_assistant()`** (**`is_dev()`**, **`is_pay_approved_master()`**, **`is_master_or_dev()`**, **`is_assistant_of_pay_approved_master()`** only).
- **Impact**: **[`RECENT_FEATURES.md`](RECENT_FEATURES.md)** **v2.464**; client **`canDeletePeopleContracts`** + **`ContractBookModal`** **`canDeleteLibraryEntries`**; **`ACCESS_CONTROL.md`** / **`PROJECT_DOCUMENTATION.md`**. Regenerate **`src/types/database.ts`** only if introspection policies matter for your workflow (usually unchanged).
- **Category**: People / Contracts / RLS

#### May 1, 2026

**`20260501205038_fix_checklist_items_rls_recursion.sql`**
- **Purpose**: Eliminate **infinite recursion** between **`checklist_items`** SELECT (assignee **`EXISTS`**) and **`checklist_item_assignees`** / **`checklist_instance_assignees`** policies that subqueried **`checklist_items`** under RLS for **`can_define_task_style_checklist_items()`** callers (e.g. **estimator** saving header **Task** from **Bids**).
- **Changes**: **`checklist_item_created_by_auth_user(uuid)`**, **`checklist_instance_parent_item_created_by_auth_user(uuid)`** — **`SECURITY DEFINER`**, **`SET row_security = off`**, narrow ownership checks; recreate affected **`checklist_items`** SELECT (creator branch before assignee **`EXISTS`**), junction policies, **`checklist_instances`** SELECT/INSERT creator branches; **`GRANT EXECUTE`** **`authenticated`**, **`service_role`**
- **Impact**: **[`RECENT_FEATURES.md`](RECENT_FEATURES.md)** **v2.450**; regenerate **`src/types/database.ts`** when linked schema includes this migration
- **Category**: Checklist / RLS

**`20260501030427_remove_jobs_ledger_payment_and_reconcile.sql`**
- **Purpose**: **`remove_jobs_ledger_payment_and_reconcile(p_payment_id uuid)`** — `SECURITY DEFINER` RPC deletes one **`jobs_ledger_payments`** row, recomputes **`jobs_ledger.payments_made`**, reconciles **`jobs_ledger_invoices`** **`paid`/`billed`** from remaining invoice-linked amounts (ε **`0.0001`**), may move **`jobs_ledger`** **`paid`→`billed`** via **`update_job_status`** when revenue exceeds payments; **rejects** payments tied to **Stripe-hosted** invoices (**`stripe_invoice_id`** non-empty). Roles: **`dev`**, **`master_technician`**, **`assistant`**, **`primary`** with same job-access pattern as other billing RPCs. Frees Mercury allocation capacity when the row had **`mercury_transaction_id`**.
- **Impact**: [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) **Unlink and remove** (Mercury) + persisted non-Stripe manual removal path; **`RECENT_FEATURES.md`** **v2.436**; **`npm run gen-types:linked`** picks up **`remove_jobs_ledger_payment_and_reconcile`** in **`src/types/database.ts`** once linked schema includes this migration.
- **Category**: Jobs / Billing / RPC

### April 2026

#### April 30, 2026

**`20260430213314_estimates_accept_notify_user_ids.sql`**
- **Purpose**: **`estimates.accept_notify_user_ids`** (`uuid[]`, nullable) — staff to email after **`sent` → `customer_accepted`** (Edge **`accept-estimate`** + **`estimate_accept_notify_filter_eligible_user_ids`**); draft-editable only; post-accept frozen with other estimate fields per **`estimates_protect_after_accept`**.
- **Impact**: [`Estimates.tsx`](../src/pages/Estimates.tsx) **Email when customer accepts**; [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) **accept-estimate**; **`PROJECT_DOCUMENTATION.md`** (Estimates); **`RECENT_FEATURES.md`** **v2.434** (UI: notify me + searchable **Also notify**, role-grouped options, default **`NULL`** → self + all **`master_technician`** on load).
- **Category**: Estimates / Email / RLS

**`20260430205318_search_jobs_ledger_service_type_name.sql`**
- **Purpose**: **`search_jobs_ledger`** **`RETURNS TABLE`** adds **`service_type_name`** via **`LEFT JOIN public.service_types`** (canonical trade name for UI pills).
- **Impact**: Unified job/bid search surfaces ([`unifiedJobBidSearch.ts`](../src/utils/unifiedJobBidSearch.ts), Clock In, Layout header search, strip assign, Dispatch/Estimator modals, People Hours audit); regenerate **`src/types/database.ts`**
- **Category**: Jobs / Search RPC

**`20260430203800_restore_pct_complete_on_jobs_ledger_detail_rpcs.sql`**
- **Purpose**: Restore **`pct_complete`** on **`get_jobs_ledger_by_ids`**, **`get_jobs_ledger_by_ids_paid_only`**, **`get_jobs_ledger_by_hcp_numbers`**, **`get_jobs_ledger_by_hcp_numbers_paid_only`** alongside **`service_type_id`** (regression fix after ledger-prefix RPC work).
- **Impact**: [`People.tsx`](../src/pages/People.tsx), job/bid label flows that use those RPCs; regenerate **`src/types/database.ts`**
- **Category**: Jobs / RPC

**`20260430202750_crew_rpcs_service_type_id_for_ledger_prefixes.sql`**
- **Purpose**: Add **`service_type_id`** to job/crew-related RPC result sets where needed for **trade-specific** ledger display prefixes.
- **Impact**: Client formatters keyed by **`service_type_id`** ([`ledgerDisplayPrefixes.ts`](../src/lib/ledgerDisplayPrefixes.ts)); stages/crew loads
- **Category**: Jobs / Bids / RPC

**`20260430201832_service_types_ledger_display_prefixes.sql`**
- **Purpose**: **`service_types.ledger_job_prefix`**, **`ledger_bid_prefix`** (nullable); backfill **Plumbing** `JP`/`BP`, **Electrical** `JE`/`BE`, **HVAC** `JH`/`BH`; replace **`search_jobs_ledger`** (returns **`service_type_id`**, prefix-aware HCP match) and **`search_bids_for_clock`** (returns **`service_type_id`**, prefix-aware bid match).
- **Impact**: [`Settings.tsx`](../src/pages/Settings.tsx) Service types modal; [`unifiedJobBidSearch.ts`](../src/utils/unifiedJobBidSearch.ts), Clock In, Jobs, Bids, Documents, My Time, Edge **`notify-dispatch-request`** / **`notify-estimator-request`**; **`PROJECT_DOCUMENTATION.md`**, **`GLOSSARY.md`**, **`RECENT_FEATURES.md`** **v2.432**
- **Category**: Settings / service_types / Search RPC / RLS unchanged

**`20260430071645_recurring_job_report_include_costs.sql`**
- **Purpose**: Per-recipient **`include_costs`** on **`recurring_job_report_schedule_recipients`** — when true, recurring digest emails add a **Cost** column (**hours × people_pay_config.hourly_wage** matched on **`trim(users.name)` = `person_name`**); missing wage renders **—**.
- **Impact**: **`recurringJobReportCore`**, **`recurring-job-report-preview`** / **`test-send`** (**`include_costs`** body) / **`dispatch`** (**`select include_costs`**); **[`RecurringEmailReportsModal.tsx`](../src/components/jobs/RecurringEmailReportsModal.tsx)**; **`EDGE_FUNCTIONS.md`**, **`RECENT_FEATURES.md`**, **`AGENTS.md`**, **`AI_CONTEXT.md`**, **`PROJECT_DOCUMENTATION.md`**, **`ACCESS_CONTROL.md`**
- **Category**: Jobs / Reports / Email

**`20260430064919_recurring_job_report_activity_scope_last_week.sql`**
- **Purpose**: **`calendar_last_week`** on **`recurring_job_report_schedule_recipients.activity_scope`**; **`reporting_window_calendar_week_prior_to_anchor`** (Sun–Sat week **before** the week containing anchor; **`reporting_date`** = that week’s Sunday for dispatch dedup).
- **Impact**: **`recurringJobReportCore`**, **`recurring-job-report-*`**; [`RecurringEmailReportsModal.tsx`](../src/components/jobs/RecurringEmailReportsModal.tsx)
- **Category**: Jobs / Reports / Email / RPC

**`20260430063059_recurring_job_report_activity_scope_crew_filter.sql`**
- **Purpose**: Recipient columns **`activity_scope`** (`calendar_yesterday` \| `calendar_today` \| `calendar_week`) and **`crew_filter`** (`all_users` \| `my_team`); **drop **`job_scope`**; backfill from legacy **`job_scope`**; **`reporting_window_calendar_civil_day`**; extend **`reporting_window_for_recurring_job_email`** so **`calendar_yesterday`** matches **`prior_calendar_day`** (day before anchor).
- **Impact**: **`recurringJobReportCore`**, **`recurring-job-report-preview`**, **`recurring-job-report-test-send`**, **`recurring-job-report-dispatch`**, **[`RecurringEmailReportsModal.tsx`](../src/components/jobs/RecurringEmailReportsModal.tsx)**; **`EDGE_FUNCTIONS.md`**, **`RECENT_FEATURES.md`**
- **Category**: Jobs / Reports / Email / RPC

**`20260430060716_recurring_job_report_recipient_job_scopes_schedule.sql`**
- **Purpose**: Recipient **`job_scope`** — `member_jobs_only`, `schedule_today`, `schedule_yesterday`, `schedule_this_week` (**drop `all_jobs`**; existing rows migrated to **`member_jobs_only`**); **`reporting_window_calendar_week_containing_anchor`**, optional **`p_anchor_date`** on **`reporting_window_for_recurring_job_email`** for preview anchoring; **`dispatch_log.reporting_date`** comment (week Sunday dedup for weekly scope).
- **Impact**: Edge **`recurringJobReportCore`**, **`recurring-job-report-*`**; [`RecurringEmailReportsModal.tsx`](../src/components/jobs/RecurringEmailReportsModal.tsx)
- **Category**: Jobs / Reports / Email

**`20260430054614_recurring_job_report_schedules.sql`**
- **Purpose**: **Recurring Email Reports (Jobs)** — `recurring_job_report_schedules`, `recurring_job_report_schedule_recipients`, `recurring_job_report_dispatch_log`; RLS dev/master/assistant for schedule scope master; trigger for `days_of_week` 0–6; **`user_can_manage_recurring_job_report_scope`**, **`reporting_window_for_recurring_job_email`**; pg_cron **`recurring-job-report-dispatch`** (`*/15`) via `PROJECT_URL` / `CRON_SECRET` vault secrets
- **Impact**: Edge **`recurring-job-report-preview`**, **`recurring-job-report-test-send`**, **`recurring-job-report-dispatch`**; [`RecurringEmailReportsModal.tsx`](../src/components/jobs/RecurringEmailReportsModal.tsx), [`Jobs.tsx`](../src/pages/Jobs.tsx) Reports tab
- **Category**: Jobs / Reports / Email / Cron / RLS

#### April 20, 2026

**`20260420234856_person_contract_documents_dashboard_prompt_after_clock_in.sql`**
- **Purpose**: **Dashboard post–clock-in contract reminder** — **`person_contract_documents.dashboard_prompt_after_clock_in`** (staff-set); RPC **`list_my_contract_dashboard_prompts()`** returns unsigned flagged rows for the current user (roster **email** + **name** or **`users.name`** match).
- **Changes**: **`ALTER TABLE person_contract_documents`**; **`CREATE FUNCTION list_my_contract_dashboard_prompts`**
- **Impact**: [`People.tsx`](../src/pages/People.tsx), [`Dashboard.tsx`](../src/pages/Dashboard.tsx), Edge **`get-contract-signing-link-for-self`**; **`RECENT_FEATURES.md`** v2.364
- **Category**: People / Contracts / RPC / Dashboard

**`20260420220523_revert_stripe_oob_invoice_payment.sql`**
- **Purpose**: **Undo Stripe out-of-band** — **`revert_stripe_oob_invoice_payment`** removes **`jobs_ledger_payments`** for the invoice, sets invoice **billed**, recomputes **`payments_made`**, **`paid`→`billed`** via **`update_job_status`** when needed, audit **`stripe_oob_payment_reverts`**, resets **`job_collect_payment_flows`** from **`terminal_completed`** to **`approved_for_terminal`** when **`stripe_invoice_id`** matches.
- **Changes**: **`CREATE TABLE stripe_oob_payment_reverts`** + RLS; **`CREATE FUNCTION revert_stripe_oob_invoice_payment`**
- **Impact**: Edge **`reverse-stripe-invoice-out-of-band-payment`**, [`HostedStripeBillPanel.tsx`](../src/components/jobs/HostedStripeBillPanel.tsx); **`RECENT_FEATURES.md`** v2.362; client refresh after unwind (**`onAfterOobUnwindSuccess`**, **`JobFormModal`** **`refreshEditingJobAndHydratePayments`**) — v2.363
- **Category**: Jobs / Billing / Stripe / RPC

**`20260420164136_person_contract_documents_signing_and_content.sql`**
- **Purpose**: **People → Contracts** — inline **`signing_body_html`**, **`canonical_document_url`**, public signing token fields, signer audit columns, and private Storage bucket **`contract-signer-signatures`** (staff SELECT policy) for digital signing (parallels Estimates acceptance flow).
- **Changes**: **`ALTER TABLE person_contract_documents`**; **`INSERT`** **`storage.buckets`**; **`CREATE POLICY`** **`contract_signer_signatures_select`**
- **Impact**: [`People.tsx`](../src/pages/People.tsx), [`ContractAccept.tsx`](../src/pages/ContractAccept.tsx), Edge **`get-contract-for-signer`**, **`accept-contract`**, **`send-contract-for-signature`**; **`RECENT_FEATURES.md`** v2.346
- **Category**: People / Contracts / Storage / Edge

**`20260420175612_contract_template_documents_book_body_and_tags.sql`**
- **Purpose**: **Contract Book** — **`contract_template_documents.book_body_html`** (nullable library body) and **`tags`** (**`TEXT[]`**, default **`{}`**) for staff-managed default text and labels per template document row.
- **Changes**: **`ALTER TABLE contract_template_documents`**
- **Impact**: [`People.tsx`](../src/pages/People.tsx), [`ContractBookModal.tsx`](../src/components/contracts/ContractBookModal.tsx); **`RECENT_FEATURES.md`** v2.351
- **Category**: People / Contracts

#### April 21, 2026

**`20260421015435_contract_body_book_and_signing_format.sql`**
- **Purpose**: **Contract body format** — **`contract_template_documents.book_body_format`** and **`person_contract_documents.signing_body_format`** (`html`|`plain`, default **`html`**) so staff can store plain text without HTML parsing on public/staff previews.
- **Changes**: **`ALTER TABLE`** both tables + **`CHECK`** constraints
- **Impact**: [`ContractBookModal.tsx`](../src/components/contracts/ContractBookModal.tsx), [`People.tsx`](../src/pages/People.tsx), [`ContractAccept.tsx`](../src/pages/ContractAccept.tsx), [`PersonContractSignedRecordModal.tsx`](../src/components/contracts/PersonContractSignedRecordModal.tsx), Edge **`get-contract-for-signer`**
- **Category**: People / Contracts

**`20260421025157_contract_body_format_allow_markdown.sql`**
- **Purpose**: Extend **`book_body_format`** / **`signing_body_format`** **`CHECK`** to allow **`markdown`** (stored source in `*_body_html` columns; client renders MD→HTML→sanitize).
- **Changes**: **`DROP CONSTRAINT`** / **`ADD CONSTRAINT`** on both tables; **`COMMENT ON COLUMN`**
- **Impact**: [`contractBodyFormat.ts`](../src/lib/contractBodyFormat.ts), [`ContractBodyDisplay.tsx`](../src/components/contracts/ContractBodyDisplay.tsx), contract UI toggles
- **Category**: People / Contracts

**`20260421044527_update_contract_book_entry.sql`**
- **Purpose**: **`update_contract_book_entry`** — atomic **Contract Book** save (library **`book_body_*`**, **`tags`**) plus optional **document name** rename that cascades to matching **`person_contract_documents`** for template assignees.
- **Changes**: **`CREATE OR REPLACE FUNCTION`** **`update_contract_book_entry`** (initial signature without **`canonical_document_url`**)
- **Impact**: [`ContractBookModal.tsx`](../src/components/contracts/ContractBookModal.tsx); superseded by later migrations extending the RPC
- **Category**: People / Contracts / RPC

**`20260421051202_contract_template_documents_canonical_url.sql`**
- **Purpose**: **`contract_template_documents.canonical_document_url`** (optional authoritative Doc/PDF link per library row); RPC signature gains **`p_canonical_document_url`**.
- **Changes**: **`ALTER TABLE`**; **`DROP FUNCTION`** / **`CREATE OR REPLACE`** **`update_contract_book_entry`**
- **Impact**: [`ContractBookModal.tsx`](../src/components/contracts/ContractBookModal.tsx), [`People.tsx`](../src/pages/People.tsx)
- **Category**: People / Contracts / RPC

**`20260421052041_contract_template_documents_updated_at.sql`**
- **Purpose**: **`contract_template_documents.updated_at`** (not null, default now) + **`BEFORE UPDATE`** trigger — drives **Applied version** “latest library row” logic when **`applied_contract_template_document_id`** is null.
- **Changes**: **`ALTER TABLE`**; **`CREATE TRIGGER`** **`update_contract_template_documents_updated_at`**
- **Impact**: [`People.tsx`](../src/pages/People.tsx) (Applied version display)
- **Category**: People / Contracts

**`20260421053133_update_contract_book_entry_sync_signing_to_assignees.sql`**
- **Purpose**: On **Contract Book** save, push library body + canonical URL into **`person_contract_documents`** for all template assignees (bulk sync to signer-facing rows).
- **Changes**: **`CREATE OR REPLACE`** **`update_contract_book_entry`**
- **Impact**: Superseded by **`20260421053919`** (revert — per-assignee signing copies must not be bulk-overwritten)
- **Category**: People / Contracts / RPC

**`20260421053919_revert_update_contract_book_entry_person_signing_sync.sql`**
- **Purpose**: **Revert** bulk sync from book save — person signing text is edited per assignee; **`update_contract_book_entry`** updates library + renames person rows on name change only (no mass **`UPDATE`** of signing fields). **Supersedes** the behavior introduced in **`20260421053133`**.
- **Changes**: **`CREATE OR REPLACE`** **`update_contract_book_entry`**
- **Impact**: [`People.tsx`](../src/pages/People.tsx), [`ContractBookModal.tsx`](../src/components/contracts/ContractBookModal.tsx)
- **Category**: People / Contracts / RPC

**`20260421054257_applied_contract_template_document_id.sql`**
- **Purpose**: **`person_contract_documents.applied_contract_template_document_id`** — optional FK pin to **`contract_template_documents`** for **Applied version** display; **`NULL`** = use max **`contract_template_documents.updated_at`** among assigned templates’ rows with the same **`document_name`**.
- **Changes**: **`ALTER TABLE`** **`ADD COLUMN`** **`REFERENCES`** **`contract_template_documents`**
- **Impact**: [`People.tsx`](../src/pages/People.tsx)
- **Category**: People / Contracts

**`20260421055733_contract_lineage_versions.sql`**
- **Purpose**: **Versioned** person contracts: **`contract_lineage_id`**, **`lineage_version`**, **`supersedes_person_contract_document_id`**; **`create_pending_contract_versions_after_book_save`** inserts a new **`unsent`** row when the latest row in a lineage is **`signed`** and **Contract Book** saved; **`update_contract_book_entry`** calls it after updating the library row.
- **Changes**: **`ALTER TABLE`** / **`DROP CONSTRAINT`** / indexes; **`CREATE OR REPLACE`** **`create_pending_contract_versions_after_book_save`**, **`update_contract_book_entry`**
- **Impact**: [`People.tsx`](../src/pages/People.tsx); **`RECENT_FEATURES.md`** v2.365
- **Category**: People / Contracts / RPC

**`20260419180746_collect_payment_complete_on_invoice_paid.sql`**
- **Purpose**: **Hosted invoice collect payment** — **`complete_job_collect_payment_flow_for_invoice(p_stripe_invoice_id)`** sets **`job_collect_payment_flows`** to **`terminal_completed`** when **`invoice.paid`** matches **`approved_for_terminal`** (**service role**). **`get_collect_payment_certify_payload`** adds **`collect_invoice`** JSON (**billed** **`jobs_ledger_invoices`** row linked from flow: **`hosted_invoice_url`**, **`stripe_invoice_id`**).
- **Changes**: **`CREATE OR REPLACE`** RPCs; **`REVOKE`/`GRANT`** on **`complete_job_collect_payment_flow_for_invoice`**
- **Impact**: [`stripe-webhook`](../supabase/functions/stripe-webhook/index.ts), [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx); **`RECENT_FEATURES.md`** v2.344
- **Category**: Jobs / Billing / Stripe / RPC

**`20260419183243_collect_payment_certify_payload_customer_email.sql`**
- **Purpose**: Certify payload includes **`billing_customer`** (**email** / **name** from **`jobs_ledger`** + **`customers`**) for Step 3 display and **`update-collect-payment-stripe-customer-email`** alignment.
- **Changes**: **`CREATE OR REPLACE`** **`get_collect_payment_certify_payload`**
- **Impact**: [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx); **`RECENT_FEATURES.md`** v2.344
- **Category**: Jobs / RPC

**`20260419201229_collect_payment_return_to_dispatch.sql`**
- **Purpose**: **`return_collect_payment_to_dispatch(p_job_id, p_note)`** — subcontractor moves flow from **`approved_for_terminal`** back to **`pending_dispatch`** with a note; **`certify_mode`** **`returned_from_terminal`** on **`job_collect_payment_flows`**.
- **Changes**: **`ALTER`** **`job_collect_payment_flows_certify_mode_check`**; **`CREATE OR REPLACE`** RPC
- **Impact**: [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx); **`RECENT_FEATURES.md`** v2.344
- **Category**: Jobs / RPC

**`20260419202031_collect_payment_return_set_initiated_by.sql`**
- **Purpose**: **`return_collect_payment_to_dispatch`** sets **`initiated_by_user_id`** to the subcontractor returning the job (queue display).
- **Changes**: **`CREATE OR REPLACE`** **`return_collect_payment_to_dispatch`**
- **Impact**: [`DashboardFieldCollectPaymentQueue.tsx`](../src/components/dashboard/DashboardFieldCollectPaymentQueue.tsx); **`RECENT_FEATURES.md`** v2.344
- **Category**: Jobs / RPC

**`20260419223818_jobs_ledger_invoices_supabase_realtime.sql`**
- **Purpose**: Add **`jobs_ledger_invoices`** to **`supabase_realtime`** publication so the field queue can refresh when invoice rows change (e.g. **`hosted_invoice_url`**, **`stripe_invoice_status`**) without relying on **`job_collect_payment_flows`** updates alone.
- **Changes**: **`ALTER PUBLICATION supabase_realtime ADD TABLE`** (idempotent **`DO`** block)
- **Impact**: [`DashboardFieldCollectPaymentQueue.tsx`](../src/components/dashboard/DashboardFieldCollectPaymentQueue.tsx); **`RECENT_FEATURES.md`** v2.344
- **Category**: Jobs / Realtime

**`20260419231724_collect_payment_payload_invoice_sent_at.sql`**
- **Purpose**: **`collect_invoice`** in **`get_collect_payment_certify_payload`** includes **`sent_to_customer_at`** for Step 3 (“invoice emailed” UX).
- **Changes**: **`CREATE OR REPLACE`** **`get_collect_payment_certify_payload`**
- **Impact**: [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx); **`RECENT_FEATURES.md`** v2.344
- **Category**: Jobs / RPC

#### April 20, 2026

**`20260420021701_job_book_entries_collect_payment.sql`**
- **Purpose**: **Job Book** — org-wide catalog **`job_book_entries`** (**Work** / **Cost** / optional **`service_type_id`**) used on **Collect Payment** Step 1 (and in **Settings** / **Jobs** for maintenance). **RLS**: **SELECT** for all **`authenticated`**; **INSERT/UPDATE/DELETE** for **`dev`**, **`master_technician`**, **`assistant`** only. **`add_collect_payment_fixture_from_job_book`**: **subcontractor** on RTB team job inserts one **`jobs_ledger_fixtures`** row and syncs **`jobs_ledger.revenue`**. **`get_collect_payment_certify_payload`** adds **`job_service_type_id`** (from linked **`bids.service_type_id`**) for client-side catalog filtering.
- **Changes**: **`CREATE TABLE`** **`job_book_entries`**; RLS policies; **`CREATE OR REPLACE`** **`get_collect_payment_certify_payload`**; **`CREATE`** **`add_collect_payment_fixture_from_job_book`** + **`GRANT`**
- **Impact**: [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx), [`JobBookSettingsSection.tsx`](../src/components/settings/JobBookSettingsSection.tsx), [`JobBookEditorPanel.tsx`](../src/components/settings/JobBookEditorPanel.tsx), [`JobBookModal.tsx`](../src/components/jobs/JobBookModal.tsx), [`Settings.tsx`](../src/pages/Settings.tsx); **`RECENT_FEATURES.md`** (v2.342 catalog, v2.343 Step 1 UX); **`ACCESS_CONTROL.md`**
- **Category**: Jobs / Collect Payment / Settings / RLS / RPC

**`20260420051645_pay_stub_additional_lines_source_clock_session.sql`**
- **Purpose**: Link **`pay_stub_additional_lines`** to an originating **`clock_sessions`** row (for example **prevailing wage** top-up). **Partial unique index** on **`(pay_stub_id, source_clock_session_id)`** when **`source_clock_session_id`** is not null.
- **Changes**: **`ALTER TABLE`** **`ADD COLUMN`** **`source_clock_session_id`** **`REFERENCES`** **`clock_sessions(id)`** **`ON DELETE SET NULL`**; **`CREATE UNIQUE INDEX`** **`pay_stub_additional_lines_stub_session_uniq`**
- **Impact**: [`PayStubAdditionalModal.tsx`](../src/components/pay/PayStubAdditionalModal.tsx), [`payStubPrevailingWageLine.ts`](../src/lib/payStubPrevailingWageLine.ts); **`RECENT_FEATURES.md`** v2.345
- **Category**: People / Payroll / RLS (column only; RLS unchanged)

#### April 19, 2026

**`20260419230155_update_job_status_cancel_collect_payment_flow.sql`**
- **Purpose**: **Ready to Bill → Working** (**`update_job_status`**) also **cancels** an in-progress **`job_collect_payment_flows`** row when **`status IN ('draft','pending_dispatch','approved_for_terminal')`** (sets **`cancelled`**, clears dispatch/terminal fields). Return JSON adds **`cancelled_collect_payment_flows`** count.
- **Changes**: **`CREATE OR REPLACE FUNCTION`** **`update_job_status`**
- **Impact**: [`Dashboard.tsx`](../src/pages/Dashboard.tsx), [`Jobs.tsx`](../src/pages/Jobs.tsx) send-back UX; field queue no longer shows **`pending_dispatch`** for that job; **`RECENT_FEATURES.md`** v2.340
- **Category**: Jobs / Billing / RPC

**`20260419161731_job_collect_payment_flows.sql`**
- **Purpose**: **Subcontractor field collect payment** — certify billable lines → staff **Approve for Terminal** → **Stripe Terminal** (PWA). Table **`job_collect_payment_flows`** (status machine, certify/dispatch/Stripe ids); **RLS** (team read, staff read; mutations via **`SECURITY DEFINER`** RPCs only); **Realtime** publication when missing. RPCs: **`get_collect_payment_certify_payload`**, **`submit_collect_payment_certification`**, **`approve_collect_payment_for_terminal`**, **`complete_job_collect_payment_flow_terminal`** (service role). **`list_ready_to_bill_assigned_jobs_for_dashboard()`** gains **`collect_payment_button_variant`** (`default` | `pending_dispatch` | `ready_terminal`).
- **Changes**: **`CREATE TABLE`** **`job_collect_payment_flows`**; policies; triggers; **`CREATE OR REPLACE`** RPCs; **`DROP`/`CREATE`** list RTB RPC with extra column
- **Impact**: [`CollectPaymentModal.tsx`](../src/components/jobs/CollectPaymentModal.tsx), [`DashboardFieldCollectPaymentQueue.tsx`](../src/components/dashboard/DashboardFieldCollectPaymentQueue.tsx), [`Dashboard.tsx`](../src/pages/Dashboard.tsx); Edge **`terminal-connection-token`**, **`create-terminal-collect-payment-intent`** (removed **v2.344** — hosted invoice + **`complete_job_collect_payment_flow_for_invoice`**); **`stripe-webhook`** `invoice.paid` / legacy `payment_intent.succeeded` branches; types; **`RECENT_FEATURES.md`** v2.339, v2.344
- **Category**: Jobs / Billing / Stripe Terminal / RPC

**`20260419154440_list_ready_to_bill_assigned_jobs_for_dashboard.sql`**
- **Purpose**: **Dashboard** **team-scoped Ready to Bill** for **`subcontractor`**, **`primary`**, **`superintendent`**, **`estimator`** — same row shape as **`list_assigned_jobs_for_dashboard()`** but **`jobs_ledger.status = 'ready_to_bill'`** and **`jobs_ledger_team_members`** join on **`auth.uid()`** (does **not** expose org-wide RTB like **`get_jobs_ledger_by_status`**).
- **Changes**: **`CREATE OR REPLACE FUNCTION`** **`list_ready_to_bill_assigned_jobs_for_dashboard()`** **`RETURNS TABLE`** (mirrors assigned RPC columns); **`GRANT EXECUTE`** to **`authenticated`**
- **Impact**: [`Dashboard.tsx`](../src/pages/Dashboard.tsx) team **Ready to Bill** block; types in [`database.ts`](../src/types/database.ts); **`RECENT_FEATURES.md`** v2.338
- **Category**: Jobs / Dashboard / RPC

#### April 16, 2026

**`20260416182749_migrate_legacy_revenue_to_first_fixture.sql`**
- **Purpose**: One-time backfill so **Edit Job** **Job Total** (Specific Work sum) matches legacy jobs that had **`jobs_ledger.revenue`** but no priced **named** fixture rows. Eligible: **`COALESCE(revenue,0) > 0`** and sum of **`round(count × COALESCE(line_unit_price,0), 2)`** over rows with **`trim(name) <> ''`** is **0**. **UPDATE** first fixture per job (**`line_unit_price`**, normalize **`count`**); **INSERT** **`Job total (migrated)`** when no fixtures. Does **not** change **`jobs_ledger.revenue`**.
- **Changes**: **`DO`** block + temp eligible set; **`RAISE NOTICE`** update/insert counts
- **Impact**: [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) **Job Total** / Stripe multi-line eligibility; **`RECENT_FEATURES.md`** v2.320
- **Category**: Jobs / Billing / Data

**`20260416154325_ncns_when_scheduled_no_clock.sql`**
- **Purpose**: Allow **`record_ncns_and_reject_sessions_for_day`** to record **NCNS** when the subject has **no** **`clock_sessions`** on **`work_date`** but has at least one **`job_schedule_blocks`** row (scheduled, never clocked); **`metadata.scheduled_without_clock`**; duplicate **`attendance_incidents`** same user/day rejected.
- **Changes**: **`CREATE OR REPLACE`** **`record_ncns_and_reject_sessions_for_day(uuid, date, text)`** — early branch before prior “no sessions” error
- **Impact**: [`DashboardMyTimeDayEditorModal.tsx`](../src/components/DashboardMyTimeDayEditorModal.tsx); **ACCESS_CONTROL** NCNS row
- **Category**: People / Attendance / Schedule

#### April 15, 2026

**`20260415222916_add_jobs_ledger_fixtures_unit_price_description.sql`**
- **Purpose**: Optional **unit price** and **per-line description** (**scope**) on **`jobs_ledger_fixtures`** (New/Edit Job **Specific Work**). **`line_description`** is **not** the Bill Customer request-body **`line_description`** override; it **is** combined with **`name`** for each Stripe invoice line when **`create-stripe-invoice`** / **`preview-stripe-invoice`** build multiple lines from billable fixtures.
- **Changes**: **`line_unit_price`** **`numeric(12,2) NULL`**, **`line_description`** **`text NULL`**
- **Impact**: [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx), [`DetailJobModal.tsx`](../src/components/jobs/DetailJobModal.tsx), [`Jobs.tsx`](../src/pages/Jobs.tsx) Billing grid; types
- **Category**: Jobs / Billing

**`20260415222132_drop_bids_count_rows_line_price_description.sql`**
- **Purpose**: Drop **`bids_count_rows.line_unit_price`** and **`line_description`** (revert optional Counts fields; UI/import/CSV and Documents bid-proposal helpers restored without these columns)
- **Changes**: **`ALTER TABLE public.bids_count_rows`** **`DROP COLUMN IF EXISTS`** for both columns
- **Impact**: [`Bids.tsx`](../src/pages/Bids.tsx), [`Documents.tsx`](../src/pages/Documents.tsx), types
- **Category**: Bids / Counts

**`20260415221117_bids_count_rows_line_price_description.sql`**
- **Purpose**: (Historical) Added optional **Unit price** and **Description** on count rows; **current** linked databases after **`20260415222132_...`** no longer have these columns
- **Changes**: **`bids_count_rows.line_unit_price`** **`numeric(12,2) NULL`**, **`line_description`** **`text NULL`** (since dropped)
- **Impact**: None on current schema; keep file for migration history only
- **Category**: Bids / Counts

#### April 14, 2026

**`20260414064105_jobs_ledger_invoice_stripe_email_sends.sql`**
- **Purpose**: Append-only log of successful **`send-stripe-invoice`** emails (one row per send); **SELECT** RLS aligned with **`jobs_ledger_invoices`**; **service role** inserts after invoice row update
- **Changes**: Table **`jobs_ledger_invoice_stripe_email_sends`** (`jobs_ledger_invoice_id`, **`sent_at`**, optional **`stripe_invoice_id`**); index on **`(jobs_ledger_invoice_id, sent_at DESC)`**; **ON DELETE CASCADE** from invoice
- **Impact**: [`send-stripe-invoice`](../supabase/functions/send-stripe-invoice/index.ts), [`StripeInvoiceSendFromStripeButton.tsx`](../src/components/jobs/StripeInvoiceSendFromStripeButton.tsx), types
- **Category**: Jobs / Billing / Stripe

**`20260414031557_ensure_rtb_primary_remainder_and_partials.sql`**
- **Purpose**: Multiple **Ready to Bill** invoice rows per job: **`is_primary_rtb_bundle`** marks the single **remainder** line whose **`amount`** **`ensure_single_ready_to_bill_invoice_for_job`** keeps in sync; **partial** RTB lines stay fixed.
- **Changes**: **`CREATE OR REPLACE`** **`ensure_single_ready_to_bill_invoice_for_job`** — drop “only one RTB” error; primary-only **UPDATE** / **INSERT**; error if &gt; one primary
- **Impact**: [`Jobs.tsx`](../src/pages/Jobs.tsx), [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx), [`SendRecordInvoiceModal.tsx`](../src/components/jobs/SendRecordInvoiceModal.tsx); **`GLOSSARY.md`** (primary vs partial RTB)
- **Category**: Jobs / Billing

#### April 9, 2026

**`20260409032340_external_send_channel_stripe_value.sql`**
- **Purpose**: Allow **`jobs_ledger_invoices.external_send_channel = 'stripe`** for finalized Stripe hosted invoices (Edge **`create-stripe-invoice`** sets this with **`sent_to_customer_at`**).
- **Changes**: **CHECK** constraint **`jobs_ledger_invoices_external_send_channel_check`** — allowed values include **`stripe`**; column comment update
- **Impact**: [`create-stripe-invoice`](../supabase/functions/create-stripe-invoice/index.ts), [`SendRecordInvoiceModal.tsx`](../src/components/jobs/SendRecordInvoiceModal.tsx)
- **Category**: Jobs / Billing / Stripe

#### April 8, 2026

**`20260408013952_jobs_ledger_last_work_date_clock_sessions_trigger.sql`**
- **Purpose**: **`jobs_ledger.last_work_date`** — cached **`MAX(work_date)`** of **approved**, non-rejected, non-revoked **`clock_sessions`** for the job; fast Stages/lists
- **Changes**: Column **`last_work_date date NULL`**; **`refresh_jobs_ledger_last_work_date(uuid)`** (`SECURITY DEFINER`); **`touch_jobs_ledger_last_work_date_from_clock_sessions`** + **AFTER INSERT/DELETE** and **AFTER UPDATE OF** **`job_ledger_id`**, **`work_date`**, **`approved_at`**, **`rejected_at`**, **`revoked_at`**; backfill; index **`idx_jobs_ledger_last_work_date`**
- **Impact**: [`database.ts`](../src/types/database.ts), [`DetailJobModal.tsx`](../src/components/jobs/DetailJobModal.tsx), [`limitedJobDetailSnapshot.ts`](../src/types/limitedJobDetailSnapshot.ts)
- **Category**: Jobs / Time

**`20260408014106_rename_estimated_completion_to_last_bill_date_and_fix_rtb_rpc.sql`**
- **Purpose**: Rename job-level bill date to **`last_bill_date`** (manual + future Stripe); **`ensure_single_ready_to_bill_invoice_for_job`** reads **`jl.last_bill_date`** for new RTB invoice **`estimated_bill_date`**
- **Changes**: **`RENAME COLUMN estimated_completion_date TO last_bill_date`**; **`CREATE OR REPLACE`** **`ensure_single_ready_to_bill_invoice_for_job`**
- **Impact**: [`Jobs.tsx`](../src/pages/Jobs.tsx), [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx), [`DetailJobModal.tsx`](../src/components/jobs/DetailJobModal.tsx), types
- **Category**: Jobs / Billing

**`20260408124821_bid_working_board.sql`**
- **Purpose**: Bids **Working** tab — per-user Kanban columns and bid card placements (only when user is **`estimator_id`** or **`account_manager_id`** on the bid)
- **Changes**: Tables **`bid_working_board_columns`** (`system_key` **`inbox`** / **`ready`** or custom — **`working`** added in **`20260422001732_bid_working_board_working_column.sql`**), **`bid_working_board_placements`** (`PRIMARY KEY (user_id, bid_id)`); helpers **`user_is_bid_estimator_or_account_manager`**, **`user_owns_working_board_column`**; **RLS** (own rows + assignment + column ownership); dev **SELECT** all; **Realtime** publication
- **Impact**: [`Bids.tsx`](../src/pages/Bids.tsx), [`BidsWorkingBoard.tsx`](../src/components/bids/BidsWorkingBoard.tsx), [`BidBoardNotesPanel.tsx`](../src/components/bids/BidBoardNotesPanel.tsx), [`database.ts`](../src/types/database.ts)
- **Category**: Bids

**`20260422001732_bid_working_board_working_column.sql`**
- **Purpose**: Fixed **Working** system column between **Inbox** and **Ready**; extends **`system_key`** check to **`working`**
- **Changes**: **`DROP`/`ADD`** **`bid_working_board_columns_system_key_check`** (`inbox` / **`working`** / `ready`); per-user backfill: bump **`position >= 1`** by **1_000_000**, insert **`Working`** at **1**, renumber with **`row_number()`** (avoids **`(user_id, position)`** violations during shift)
- **Impact**: [`BidsWorkingBoard.tsx`](../src/components/bids/BidsWorkingBoard.tsx) (three-column bootstrap), [`fetchWorkingBoardClockBidPicks.ts`](../src/lib/fetchWorkingBoardClockBidPicks.ts), [`ClockInOutButton.tsx`](../src/components/ClockInOutButton.tsx), [`database.ts`](../src/types/database.ts)
- **Category**: Bids / Clock

#### April 7, 2026

**`20260407033913_job_schedule_blocks.sql`**
- **Purpose**: Planned per-job work windows (assignee, **`work_date`**, **`time_start`** / **`time_end`** in America/Chicago wall time, **4:00–20:00**) for Jobs **Schedule** modal and Calendar preview/chips
- **Changes**: **`job_schedule_blocks`** (`REFERENCES jobs_ledger`, **`users`** for assignee and **`created_by`**); **`updated_at`** trigger; **`created_by`** default from **`auth.uid()`**; **RLS** aligned with job visibility / team / assignee read; **INSERT/UPDATE/DELETE** for **`dev`**, **`master_technician`**, **`assistant`**, **`superintendent`** with job manage access only
- **Impact**: [`ScheduleJobModal.tsx`](../src/components/jobs/ScheduleJobModal.tsx), [`PreviewJobModal.tsx`](../src/components/calendar/PreviewJobModal.tsx), [`Calendar.tsx`](../src/pages/Calendar.tsx), [`jobScheduleBlocks.ts`](../src/lib/jobScheduleBlocks.ts)
- **Category**: Jobs / Calendar

**`20260407034037_list_assigned_jobs_project_id.sql`**
- **Purpose**: **`list_assigned_jobs_for_dashboard`** adds **`project_id`** so Calendar **Job preview** can map workflow **`project_id`** to team jobs without broad **`jobs_ledger`** reads
- **Changes**: **`DROP`/`CREATE`** same RPC with extra **`project_id`** column in **`RETURNS TABLE`** and **`SELECT`**
- **Impact**: [`PreviewJobModal.tsx`](../src/components/calendar/PreviewJobModal.tsx); types in [`database.ts`](../src/types/database.ts)
- **Category**: Jobs / Calendar

**`20260407052651_job_schedule_blocks_min_duration_30m.sql`**
- **Purpose**: Align DB with client **`JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES`** (30 minutes)
- **Changes**: **`CHECK`** on **`job_schedule_blocks`**: **`(time_end - time_start) >= interval '30 minutes'`**
- **Impact**: [`ScheduleDispatch.tsx`](../src/pages/ScheduleDispatch.tsx), [`ScheduleJobModal.tsx`](../src/components/jobs/ScheduleJobModal.tsx), [`jobScheduleOverlap.ts`](../src/lib/jobScheduleOverlap.ts)
- **Category**: Jobs / Calendar

**`20260407061043_job_schedule_blocks_shared_block_group.sql`**
- **Purpose**: **Crew / mirror** schedule legs — multiple assignees share one logical planned window (same times and note)
- **Changes**: **`shared_block_group_id uuid NULL`** on **`job_schedule_blocks`**; partial index **`idx_job_schedule_blocks_shared_group`** where non-null; column comment
- **Impact**: [`jobScheduleBlocks.ts`](../src/lib/jobScheduleBlocks.ts), [`ScheduleDispatch.tsx`](../src/pages/ScheduleDispatch.tsx), [`ScheduleDispatchGrid.tsx`](../src/components/schedule/ScheduleDispatchGrid.tsx), [`ScheduleJobModal.tsx`](../src/components/jobs/ScheduleJobModal.tsx); **`RECENT_FEATURES.md`** v2.257
- **Category**: Jobs / Calendar

**`20260407165443_move_job_schedule_block_group.sql`**
- **Purpose**: Schedule **Dispatch** DnD — move all legs of a **linked** group to a new **`work_date`** in one transaction with per-assignee overlap validation on the target day (**`SECURITY INVOKER`**, **`GRANT EXECUTE`** to **`authenticated`**)
- **Changes**: **`move_job_schedule_block_group(p_job_id, p_shared_block_group_id, p_new_work_date)`**
- **Impact**: [`scheduleDispatchDragEnd.ts`](../src/lib/scheduleDispatchDragEnd.ts), [`jobScheduleBlocks.ts`](../src/lib/jobScheduleBlocks.ts); **`RECENT_FEATURES.md`** v2.258
- **Category**: Jobs / Calendar

**`20260428000741_auto_assign_job_team_member_on_schedule_block.sql`**
- **Purpose**: **AFTER INSERT** on **`job_schedule_blocks`** — add **`assignee_user_id`** to **`jobs_ledger_team_members`** for **`job_id`** (idempotent **`ON CONFLICT DO NOTHING`**); **`SECURITY DEFINER`** so roster INSERT is not gated by unrelated client policies; optional backfill from existing **`job_schedule_blocks`**
- **Changes**: **`ensure_job_team_member_from_schedule_block()`**, trigger **`job_schedule_blocks_ensure_job_team_member_tr`**
- **Impact**: Dispatch / Schedule Dispatch / **`ScheduleJobModal`** — any path that inserts **`job_schedule_blocks`**; assigned team roster for Jobs / Clock / subs visibility
- **Category**: Jobs / Calendar / Dispatch

**`20260428231416_material_po_generator.sql`**
- **Purpose**: **Materials PO Generator** — **`material_po_generator_entries`** (unique **`po_code`** 10000–99999, **`job_ledger_id`**, **`for_user_id`**, **`supply_house_id`**, notes, **`created_by`**); job-scoped **SELECT** **RLS** for dev / master / assistant (aligned with **`jobs_ledger`** visibility); **`insert_material_po_generator_entry`** (**`SECURITY DEFINER`**, random code retries)
- **Changes**: **`CREATE TABLE`** + **RLS** + **RPC**
- **Impact**: [`Materials.tsx`](../src/pages/Materials.tsx) **PO Generator** tab; [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.412
- **Category**: Materials / Ledger / RPC

**`20260428232212_material_po_generator_supply_house_optional.sql`**
- **Purpose**: **`supply_house_id`** nullable on **`material_po_generator_entries`**; **`insert_material_po_generator_entry`** accepts **`NULL`** supply house
- **Changes**: **`ALTER COLUMN`** **DROP NOT NULL**; **`CREATE OR REPLACE`** **`insert_material_po_generator_entry`**
- **Impact**: [`Materials.tsx`](../src/pages/Materials.tsx); Supply Houses invoice **Purchase Order #** warning includes ledger rows with **null** **`supply_house_id`** ([`SupplyHousesTab.tsx`](../src/components/SupplyHousesTab.tsx)); [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.412
- **Category**: Materials / Ledger / RPC

#### April 5, 2026

**`20260405072854_estimate_create_job_rpc.sql`**
- **Purpose**: Staff create a **`jobs_ledger`** row from a **`customer_accepted`** estimate and set **`estimates.job_ledger_id`** in one transaction; idempotent when already linked
- **Changes**: Partial unique index **`estimates_job_ledger_id_unique`** on **`estimates(job_ledger_id)`**; **`create_job_from_estimate`** (`SECURITY DEFINER`, `GRANT EXECUTE` to **`authenticated`**) — enforces **`user_can_access_estimate`** / **`superintendent_can_access_estimate`**, mirrors Jobs owner resolution (project **`master_user_id`** or **`job_owner_override_*`**), optional **`p_customer_id`** and field overrides
- **Impact**: [`Estimates.tsx`](../src/pages/Estimates.tsx) **Create job from estimate**; [`Jobs.tsx`](../src/pages/Jobs.tsx) **Source estimate** strip + **[`CustomerAcceptanceRecordModal`](../src/components/estimates/CustomerAcceptanceRecordModal.tsx)**; [`jobLedgerCustomer.ts`](../src/lib/jobLedgerCustomer.ts), [`resolveEffectiveJobMasterUserId.ts`](../src/lib/resolveEffectiveJobMasterUserId.ts)
- **Category**: Estimates / Jobs

**`20260405101849_count_unlinked_tally_stale_by_age.sql`**
- **Purpose**: Dashboard **stale tally** callout — count unlinked linked-card Mercury rows whose **`posted_at`** Chicago calendar date is **more than `min_age_days`** before today (default **2**), with the same scope as **`count_unlinked_mercury_transactions_for_tally`** (**`job_tally_min_posted_ymd`** floor, no **`mercury_transaction_job_allocations`**)
- **Changes**: **`count_unlinked_mercury_transactions_for_tally_stale(min_age_days integer DEFAULT 2)`** — `SECURITY DEFINER`, `GRANT EXECUTE` to **`authenticated`**
- **Impact**: [`DashboardTallyStaleBanner.tsx`](../src/components/DashboardTallyStaleBanner.tsx), [`Dashboard.tsx`](../src/pages/Dashboard.tsx) (focus refresh with tally unlinked count)
- **Category**: Dashboard / Job Parts Tally

**`20260405211552_tally_stale_staff_followup.sql`**
- **Purpose**: **Dev / master_technician / assistant** Dashboard follow-up for **other people’s** stale unlinked linked-card Mercury transactions (same age/floor/unlinked rules as **`count_unlinked_mercury_transactions_for_tally_stale`**); staff assign splits on behalf of the card owner
- **Changes**: **`staff_can_view_user_for_tally_followup(viewer, target)`** (internal definer helper, not granted to **`authenticated`**); **`list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days)`** (flat rows with contact + tx fields, **`LIMIT 500`**); **`search_jobs_for_tally_mercury_assign_as_user(p_for_user_id, search_text)`**; **`replace_mercury_job_splits_for_linked_card_as_staff(p_for_user_id, p_mercury_transaction_id, p_rows)`** — `SECURITY DEFINER`, grants where applicable
- **Impact**: [`DashboardTallyStaleStaffBanner.tsx`](../src/components/DashboardTallyStaleStaffBanner.tsx), [`DashboardStaleTallyStaffFollowUpModal.tsx`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx), **`tallyActAsUserId`** on [`MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx), [`Dashboard.tsx`](../src/pages/Dashboard.tsx)
- **Category**: Dashboard / Job Parts Tally

**`20260405213504_settings_job_counts_by_master.sql`**
- **Purpose**: Dev **Settings → People & accounts** job counts per master without scanning every **`jobs_ledger`** row on the client
- **Changes**: **`list_job_counts_by_master_for_dev_settings()`** — `RETURNS TABLE (master_user_id uuid, job_count bigint)`; **`SECURITY DEFINER`**, **`STABLE`**, **`is_dev()`** gate; `GROUP BY` on non-null **`master_user_id`**; **`REVOKE ALL`**, **`GRANT EXECUTE`** to **`authenticated`**
- **Impact**: [`Settings.tsx`](../src/pages/Settings.tsx) **`loadData`** (dev-only **`withSupabaseRetry`** RPC + parallel dev loaders)
- **Category**: Settings / Performance

#### April 6, 2026

**`20260406155949_tally_staff_list_include_all_unlinked.sql`**
- **Purpose**: Stale tally **staff follow-up** modal — optional **Show all** list (all unlinked linked-card rows) without Chicago calendar **min_age_days** filter; banner/hook still use stale-only
- **Changes**: **`DROP`** single-arg **`list_stale_unlinked_mercury_transactions_for_tally_staff(integer)`**; **`CREATE`** **`(min_age_days integer DEFAULT 2, include_all_unlinked boolean DEFAULT false)`** — when **`include_all_unlinked`**, skip age predicate; **`REVOKE`/`GRANT EXECUTE`** on new signature
- **Impact**: [`DashboardStaleTallyStaffFollowUpModal.tsx`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx), [`useStaleTallyStaffFollowUp.ts`](../src/hooks/useStaleTallyStaffFollowUp.ts) (**`include_all_unlinked: false`** for counts)
- **Category**: Dashboard / Job Parts Tally

**`20260406024629_estimate_customer_events.sql`**
- **Purpose**: Append-only **customer activity** for Approach A estimates — public link views and successful accept submits
- **Changes**: **`estimate_customer_events`** (`estimate_id`, `occurred_at`, `event_type`, `source`, `client_ip`, `user_agent`, `metadata` **`jsonb`**); **`CHECK`** on **`event_type`** (`public_link_view`, `public_accept_submitted`) and **`source`**; index **`(estimate_id, occurred_at DESC)`**; **RLS** **`SELECT`** aligned with **`estimates`** visibility; **`GRANT SELECT`** to **`authenticated`**; rows appended only via **`service_role`** Edge calls and **`SECURITY DEFINER`** Postgres (see later migrations: trigger + RPCs), not **`authenticated`** direct **`INSERT`**
- **Impact**: [`get-estimate-for-customer`](../supabase/functions/get-estimate-for-customer/index.ts), [`accept-estimate`](../supabase/functions/accept-estimate/index.ts), [`logEstimateCustomerEvent.ts`](../supabase/functions/_shared/logEstimateCustomerEvent.ts); **Customer activity** on [`Estimates.tsx`](../src/pages/Estimates.tsx) detail
- **Category**: Estimates / Edge / Audit

**`20260406025757_log_estimate_customer_event_rpc.sql`**
- **Purpose**: **`log_estimate_customer_event`** — **`SECURITY DEFINER`** insert into **`estimate_customer_events`**; **`GRANT EXECUTE`** to **`service_role`** only (Edge **`rpc`** + optional insert fallback from [`logEstimateCustomerEvent.ts`](../supabase/functions/_shared/logEstimateCustomerEvent.ts))
- **Impact**: [`logEstimateCustomerEvent.ts`](../supabase/functions/_shared/logEstimateCustomerEvent.ts); repeat **`accept-estimate`** (**`alreadyAccepted`**) audit
- **Category**: Estimates / Edge / Audit

**`20260406033952_estimates_audit_customer_accepted_trigger.sql`**
- **Purpose**: Reliable **`public_accept_submitted`** audit when **`estimates.status`** transitions **`sent` → `customer_accepted`** (same transaction as **`accept-estimate`** update)
- **Changes**: **`estimates_audit_customer_accepted_row`** + **`estimates_audit_customer_accepted_trigger`** (`AFTER UPDATE OF status`); copies **`acceptor_ip`**, **`acceptor_user_agent`**, and signature presence into **`estimate_customer_events`**
- **Impact**: [`accept-estimate`](../supabase/functions/accept-estimate/index.ts) (main path relies on trigger, no duplicate Edge insert); **Customer activity** on [`Estimates.tsx`](../src/pages/Estimates.tsx)
- **Category**: Estimates / Audit

**`20260406034514_record_estimate_public_link_view_rpc.sql`**
- **Purpose**: **`record_estimate_public_link_view`** — **`SECURITY DEFINER`** append **`public_link_view`** while the row is still **`sent`**; **`GRANT EXECUTE`** to **`service_role`**
- **Impact**: [`get-estimate-for-customer`](../supabase/functions/get-estimate-for-customer/index.ts) on each successful public **GET** **200**
- **Category**: Estimates / Edge / Audit

**`20260412184127_dedupe_record_estimate_public_link_view.sql`**
- **Purpose**: **`CREATE OR REPLACE`** **`record_estimate_public_link_view`** — skip insert when the same **`estimate_id`**, **`client_ip`**, and **`user_agent`** already have **`public_link_view`** within **5 seconds**; **`pg_advisory_xact_lock(hashtext(estimate_id::text))`** serializes concurrent calls per quote
- **Impact**: Fewer duplicate **Customer activity** rows from double client loads (e.g. React **Strict Mode** remount); [`get-estimate-for-customer`](../supabase/functions/get-estimate-for-customer/index.ts) unchanged
- **Category**: Estimates / Edge / Audit

**`20260412190051_update_estimate_thank_you_body_default.sql`**
- **Purpose**: **`UPDATE`** **`app_settings`** **`estimate_thank_you_body`** — append “We are excited to see you soon.” to the default thank-you paragraph (public accept / thank-you page)
- **Impact**: [`EstimateCustomerThankYou`](../src/components/estimates/EstimateCustomerThankYou.tsx); [`estimateCustomerExperience.ts`](../src/lib/estimateCustomerExperience.ts) builtin default kept in sync in app + Edge
- **Category**: Estimates / Customer experience

**`20260412190601_update_estimate_accept_page_footer_tagline.sql`**
- **Purpose**: **`UPDATE`** **`app_settings`** **`estimate_accept_page_footer`** — replace first-line tagline **Reliable plumbing today** → **Reliable service today** when the old phrase is present
- **Impact**: [`estimateCustomerExperience.ts`](../src/lib/estimateCustomerExperience.ts) **`BUILTIN_ACCEPT_PAGE_FOOTER`** + Edge shared copy; public accept footer via **`AcceptPageFooterBlock`**
- **Category**: Estimates / Customer experience

**`20260412230827_delete_ready_to_bill_invoice_idempotent.sql`**
- **Purpose**: **`delete_ready_to_bill_invoice(p_invoice_id)`** — **`SECURITY DEFINER`** delete **`jobs_ledger_invoices`** only when **`status = 'ready_to_bill'`** and caller has the same job access as the invoice **DELETE** policy; idempotent JSON **`{ ok, deleted?, error? }`** when the row is already gone (safe double-submit)
- **Changes**: **`GRANT EXECUTE`** to **`authenticated`**
- **Impact**: [`Jobs.tsx`](../src/pages/Jobs.tsx), [`Dashboard.tsx`](../src/pages/Dashboard.tsx) **Delete draft bill**; [`database.ts`](../src/types/database.ts)
- **Category**: Jobs / Billing

**`20260406173212_stale_tally_staff_job_search_scope.sql`**
- **Purpose**: Stale tally **Assign to jobs** — **`search_jobs_for_tally_mercury_assign_as_user`** uses **`jobs_ledger_row_visible_for_tally_assign(jl.id, auth.uid())`** (staff invoker ledger scope) for **non-subcontractor** card owners; **subcontractor** targets keep **`p_for_user_id`** (team-only) so results stay aligned with **`replace_mercury_job_splits_for_linked_card_as_staff`**
- **Changes**: **`CREATE OR REPLACE`** **`search_jobs_for_tally_mercury_assign_as_user`** — **`CASE`** on whether **`p_for_user_id`** is a subcontractor; updated **`COMMENT`**; **`REVOKE`/`GRANT EXECUTE`**
- **Impact**: [`MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx) (unchanged client); [`DashboardStaleTallyStaffFollowUpModal.tsx`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx)
- **Category**: Dashboard / Job Parts Tally

**`20260406175808_tally_assign_search_all_jobs_staff.sql`**
- **Purpose**: Stale tally **Assign to jobs** — **`dev` / `master_technician` / `assistant`** invokers can list **any** **`jobs_ledger`** row matching **`search_text`** (still **`LIMIT 50`**) for **non-subcontractor** targets, alongside **`staff_can_view_user_for_tally_followup`**; **subcontractor** targets unchanged (team-only via **`jobs_ledger_row_visible_for_tally_assign`**); other invokers fall back to invoker ledger visibility
- **Changes**: **`CREATE OR REPLACE`** **`search_jobs_for_tally_mercury_assign_as_user`** — three-branch **`OR`** on visibility; updated **`COMMENT`**; **`REVOKE`/`GRANT EXECUTE`**
- **Impact**: [`MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx); [`DashboardStaleTallyStaffFollowUpModal.tsx`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx)
- **Category**: Dashboard / Job Parts Tally

#### April 8, 2026

**`20260405010252_estimate_customer_experience_defaults_snapshot.sql`**
- **Purpose**: Dev-editable estimate customer copy defaults in **`app_settings`**; per-estimate **`customer_experience_overrides`**; frozen **`customer_experience_sent`** written when **send-estimate-to-customer** sets **`sent`**
- **Changes**: `customer_experience_overrides` / `customer_experience_sent` **`jsonb`** on **`public.estimates`** (object check); **`INSERT`** default **`estimate_*`** `app_settings` keys; extend **`estimates_protect_after_accept`** to freeze both json columns after **`customer_accepted`**
- **Impact**: [`Settings.tsx`](../src/pages/Settings.tsx) defaults; [`Estimates.tsx`](../src/pages/Estimates.tsx) overrides + previews; [`EstimateAccept.tsx`](../src/pages/EstimateAccept.tsx); Edge [`get-estimate-for-customer`](../supabase/functions/get-estimate-for-customer/index.ts) / [`send-estimate-to-customer`](../supabase/functions/send-estimate-to-customer/index.ts); [`src/lib/estimateCustomerExperience.ts`](../src/lib/estimateCustomerExperience.ts)
- **Category**: Estimates / Edge / Settings

#### April 7, 2026

**`20260405003103_estimates_global_estimate_number.sql`**
- **Purpose**: Global sequential **Quote #** on **`public.estimates`** (`estimate_number`), immutable after assignment
- **Changes**: `estimate_number` column + unique index; `estimates_estimate_number_seq` owned by column; `BEFORE INSERT` assigns number; `BEFORE UPDATE` rejects changes to `estimate_number`; backfill existing rows by `created_at`; extend post-accept immutability trigger to treat `estimate_number` like other frozen columns
- **Impact**: Staff URLs **`/estimates/{estimate_number}`** (UUID path still works); list/detail **Quote #** in [`Estimates.tsx`](../src/pages/Estimates.tsx)
- **Category**: Estimates

#### April 4, 2026

**`20260404212052_estimates_approach_a.sql`**
- **Purpose**: **`public.estimates`** — simple customer proposals with public token accept flow (Approach A); distinct from bid **`cost_estimates`**
- **Changes**: `estimate_status` enum; `estimates` table (snapshots, token hash, acceptance audit); `user_can_access_estimate` / `superintendent_can_access_estimate`; RLS for staff; triggers for `updated_at` and post-accept immutability; draft-only updates from authenticated clients
- **Impact**: [`Estimates.tsx`](../src/pages/Estimates.tsx), Edge [`get-estimate-for-customer`](../supabase/functions/get-estimate-for-customer/index.ts), [`accept-estimate`](../supabase/functions/accept-estimate/index.ts), [`send-estimate-to-customer`](../supabase/functions/send-estimate-to-customer/index.ts)
- **Category**: Estimates / Edge

### July 2026

> **Typo-dated headings — this is not real July 2026 work.** Apart from `20260701000000_create_hours_reviewed.sql` (a genuine July 1, 2026 file, live in `supabase/migrations/`), every file in this block has a `202705…`-prefixed "2027"-typo filename from the pre-baseline archive; the real work happened spring 2026 (March–June). In particular, do **not** confuse the phantom "July 13, 2026" heading below with the real July 13, 2026 migrations (`202607…` files) documented near the top of [Recent Migrations](#recent-migrations).

#### July 20, 2026

**`20270520120000_address_geocodes_estimator_map_access.sql`**
- **Purpose**: **`address_geocodes`** SELECT/INSERT/UPDATE/DELETE for **estimator** alongside **dev**, **master_technician**, and **assistant** (Map **`/map`** + Edge **`geocode-one`** / **`geocode-address-batch`** cache writes).
- **Changes**: Replace four **`address_geocodes`** policies with role allowlist **`IN ('dev', 'master_technician', 'assistant', 'estimator')`**; table **`COMMENT`**.
- **Impact**: **`ACCESS_CONTROL.md`** Map footnote; **`PROJECT_DOCUMENTATION.md`** §16; **`RECENT_FEATURES.md`** **v2.451**
- **Category**: Map / RLS

#### July 19, 2026

**`20270519120000_subcontractor_helpers_estimator_checklist_task_definitions.sql`**
- **Purpose**: Header **Task** modal end-to-end for **subcontractor**, **helpers**, and **estimator** — checklist **`INSERT`** / assignees / instances without widening **`is_dev_or_master_or_assistant()`** globally.
- **Changes**: **`can_define_task_style_checklist_items()`**; extend **`checklist_items`** (SELECT **`created_by_user_id`**, mutating policies), **`checklist_item_assignees`**, **`checklist_instance_assignees`**, **`checklist_instances`** — field roles scoped to items they created (**superseded in part** by **`20260501205038`** for recursion-safe ownership checks after policies referenced **`checklist_items`** from junction **`EXISTS`**).
- **Impact**: **[`Layout.tsx`](../src/components/Layout.tsx)** + **[`headerTaskDispatchEstimatorEligible.ts`](../src/lib/headerTaskDispatchEstimatorEligible.ts)** + **[`ChecklistAddModal.tsx`](../src/components/ChecklistAddModal.tsx)**; **`ACCESS_CONTROL.md`**; **`RECENT_FEATURES.md`** **v2.450**
- **Category**: Checklist / RLS / Field roles

#### July 18, 2026

**`20270518120000_list_assigned_jobs_service_type_name.sql`**
- **Purpose**: **`list_assigned_jobs_for_dashboard`** adds **`service_type_name`** (scalar subquery on **`service_types`**) and restores **`job_pictures_link`**, **`service_type_id`** on the recreated function (aligns with post-**`20270507120000`** RPC shape) so the Clock In default job list can show **trade** pills without an extra client fetch.
- **Impact**: [`ClockInOutButton.tsx`](../src/components/ClockInOutButton.tsx); regenerate **`src/types/database.ts`**; **`RECENT_FEATURES.md`** **v2.433**
- **Category**: Dashboard / RPC

#### July 16, 2026

**`20270516120000_salary_sync_close_continuous_fragments_at_t_end.sql`**
- **Purpose**: **Continuous** salary template — after My Time splits the single canonical block into indexed **`salary_schedule`** fragments (`salary_segment_index` 1..N), **`salary_sync`** could leave open rows beyond template **`t_end`**; closes them once **`p_now ≥ t_end`**
- **Changes**: **`CREATE OR REPLACE`** **`salary_sync_one_user_clock_sessions`** — in **`v_mode = 'continuous'`**, **`UPDATE`** open (**`clocked_out_at`** **`IS NULL`**) non-final **`salary_schedule`** rows with **`salary_segment_index IS NOT NULL`** to **`clocked_out_at = t_end`** when **`clocked_in_at < t_end`**, **before** the NULL-index canonical row logic; updated **`COMMENT`** + **`REVOKE ALL`**
- **Impact**: Sync / cron / Clock In strip refresh; see [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md) **Continuous template mode**
- **Category**: Salary / `clock_sessions` / RPC

#### July 15, 2026

**`20270515120000_report_list_rpc_include_coordinates.sql`**
- **Purpose**: Align **`reported_at_lat`** / **`reported_at_lng`** visibility in report **list** RPCs with roles that legitimately see location metadata (supersedes office-only NULL masking introduced in **`20260415120006`** / **`20260415120007`**)
- **Changes**: **`CREATE OR REPLACE`** on **`list_reports_with_job_info`**, **`list_reports_for_job_ledger`**, **`list_my_reports`** — return coordinates for **primary**, **superintendent**, **estimator**; **helpers** / **subcontractor** receive values **only on rows they authored** (`created_by_user_id = auth.uid()`)
- **Impact**: **[`JobReportsModal.tsx`](../src/components/JobReportsModal.tsx)** **`ReportLocationMapsLink`** when list payloads include coords; **`RECENT_FEATURES.md`** v2.418
- **Category**: Reports / RPC / Access control

#### July 14, 2026

**`20270514120000_list_reports_rpc_superintendent_job_anchor.sql`**
- **Purpose**: Superintendent-visible rows from **`list_reports_with_job_info`** / **`list_reports_for_job_ledger`** match **`superintendent_report_job_anchor_allowed`** (same predicate as **`reports`** INSERT policy)
- **Changes**: **`CREATE OR REPLACE`** both RPCs — superintendent branch uses shared anchor helper instead of stricter **`jobs_ledger`**/`project`-only filter
- **Impact**: **View Reports** lists newly saved superintendent reports (parity with Additional Report save); **`RECENT_FEATURES.md`** v2.418
- **Category**: Reports / RPC / Superintendent

#### July 13, 2026

**`20270513120000_superintendent_report_anchor_team_assignment.sql`**
- **Purpose**: Superintendent may anchor **`reports`** to jobs they access via **`jobs_ledger_team_members`** even when **`project_id`** is unset (parity with **`list_assigned_jobs_for_dashboard`**)
- **Changes**: **`CREATE OR REPLACE`** **`superintendent_report_job_anchor_allowed`** — add team-member **`EXISTS`** branch alongside project superintendent link
- **Impact**: Additional Report save on crew-assigned jobs without project link; **`RECENT_FEATURES.md`** v2.418
- **Category**: Reports / RLS / Superintendent

#### July 12, 2026

**`20270512120000_superintendent_report_anchor_row_security_off.sql`**
- **Purpose**: **`superintendent_report_job_anchor_allowed`** must read **`jobs_ledger`** inside **`SECURITY DEFINER`** without caller RLS hiding anchor rows
- **Changes**: **`CREATE OR REPLACE`** function — **`SET row_security TO off`** so **`jobs_ledger`** reads inside **`SECURITY DEFINER`** are not masked by **`jobs_ledger`** RLS during anchor evaluation
- **Impact**: Fixes false negatives when evaluating superintendent report insert eligibility; **`RECENT_FEATURES.md`** v2.418
- **Category**: Reports / RLS / Superintendent

#### July 11, 2026

**`20270511120000_superintendent_reports_job_anchor_security_definer.sql`**
- **Purpose**: **`reports`** INSERT for **`superintendent`** uses **`SECURITY DEFINER`** helper **`superintendent_report_job_anchor_allowed(job_ledger_id)`** instead of inline **`jobs_ledger`** subqueries under **`reports`** RLS
- **Changes**: **`CREATE`** helper + **`CREATE POLICY`** update on **`reports`** INSERT for superintendent role
- **Impact**: Reliable superintendent report submission against **`jobs_ledger`** RLS; foundation for **`20270512120000`** / **`20270513120000`** / **`20270514120000`**; **`RECENT_FEATURES.md`** v2.418
- **Category**: Reports / RLS / Superintendent

#### July 7, 2026

**`20270507120000_dashboard_my_last_report_at.sql`**
- **Purpose**: **Dashboard** assigned / ready-to-bill / superintendent job lists — **`my_last_report_at`** for **Leave Report** schedule reminders (max **`reports.created_at`** per job filtered to **`created_by_user_id = auth.uid()`**)
- **Changes**: **`CREATE OR REPLACE`** on **`list_assigned_jobs_for_dashboard`**, **`list_ready_to_bill_assigned_jobs_for_dashboard`**, **`list_superintendent_jobs_for_dashboard`** — add **`my_last_report_at timestamptz`** column
- **Impact**: [`Dashboard.tsx`](../src/pages/Dashboard.tsx) + [`shouldShowLeaveReportScheduleReminder`](../src/lib/leaveReportScheduleReminder.ts); [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.411
- **Category**: Dashboard / Reports

#### July 6, 2026

**`20270506120000_update_job_status_disallow_helpers_send_to_billing.sql`**
- **Purpose**: **`helpers`** must not move a job **Working → ready_to_bill** via the same path as other team members (**`update_job_status`**)
- **Changes**: **`CREATE OR REPLACE`** **`update_job_status`** — for **Working → ready_to_bill**, the **team-member** branch (`jobs_ledger_team_members`) skips updates when **`auth.uid()`** has **`users.role = 'helpers'`**
- **Impact**: Assigned Jobs UI hides **Send to Billing** for helpers; aligns server with [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md) helpers note; [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.411
- **Category**: Dashboard / Jobs / Access control

#### July 1, 2026

**`20260701000000_create_hours_reviewed.sql`**
- **Purpose**: Add `hours_reviewed` table for **People → Hours** **Review Hours** / hours-reviewed workflow
- **Changes**: Create `hours_reviewed` (person_name, start_date, end_date, reviewed_by, reviewed_at); UNIQUE(person_name, start_date); RLS for dev, pay-approved masters, assistants
- **Impact**: Review Hours modal "Mark as reviewed" checkbox; **Hours reviewed** ledger on **People → Hours**
- **Category**: People / Pay

### April 2026 — "2027"-typo filenames (archived pre-baseline)

#### April 3, 2026

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

#### April 8, 2026

**`20270408150000_tally_staff_followup_assistant_any_target.sql`**
- **Purpose**: Dashboard / Quickfill **stale tally staff follow-up** — **assistant** role sees **all** target users for Mercury stale-unlinked list and staff assign flows (same scope as **dev** via **`staff_can_view_user_for_tally_followup`**)
- **Changes**: **`CREATE OR REPLACE`** **`staff_can_view_user_for_tally_followup`** — treat **`v_role = 'assistant'`** like dev (**`RETURN true`** for any **`p_target`**); remove previous **`assistants_share_master`** / adopting-master-only branch; updated **`COMMENT`**
- **Impact**: [`useStaleTallyStaffFollowUp.ts`](../src/hooks/useStaleTallyStaffFollowUp.ts), [`DashboardStaleTallyStaffFollowUpModal.tsx`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx) (`list_stale_*`, `search_jobs_for_tally_mercury_assign_as_user`, `replace_mercury_job_splits_for_linked_card_as_staff`); [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md) stale tally row
- **Category**: Dashboard / Job Parts Tally / Access

**`20270408151000_tally_staff_followup_assistant_adopted_masters_job_team.sql`**
- **Purpose**: Narrow **assistant** stale tally follow-up from company-wide (Option B) to **adopted masters’ job context** (Option A)
- **Changes**: **`CREATE OR REPLACE`** **`staff_can_view_user_for_tally_followup`** — **`dev`** / **`is_dev()`** only for global targets; **assistant** = **`assistants_share_master`** OR adopting **master** OR **`jobs_ledger`** team member on jobs whose **`master_user_id IN (SELECT master_id FROM master_assistants WHERE assistant_id = p_viewer)`**; updated **`COMMENT`**
- **Impact**: Same RPCs as **`20270408150000`**; [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md) stale tally row
- **Category**: Dashboard / Job Parts Tally / Access

**`20270408153000_salary_sync_split_overlap_clock_in_tz_date.sql`**
- **Purpose**: **Split** template mode — **`salary_sync_one_user_clock_sessions`** overlap **NOT EXISTS** for canonical slots **1** / **2** should count sessions whose **clock-in** civil date in the template (or override) **timezone** matches **`p_work_date`**, not only **`work_date`**, so sync does not insert a duplicate empty **`salary_segment_index = 1`** row when **`work_date`** and sync day disagree at a boundary.
- **Changes**: **`CREATE OR REPLACE`** **`salary_sync_one_user_clock_sessions`** — in split-mode slot **1** / **2** overlap predicates, add **`OR (cs.clocked_in_at AT TIME ZONE tz)::date = p_work_date`** alongside **`cs.work_date = p_work_date`**; **`COMMENT`** + **`REVOKE ALL … FROM PUBLIC`**
- **Impact**: [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md); [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.249
- **Category**: People / Hours / Salary sync

**`20270408162000_salary_sync_split_half_open_overlap_semantics.sql`**
- **Purpose**: Document and pin **strict half-open** split-mode overlap for canonical slots **1** / **2** — same predicate shape as **`20270408153000`** (`clocked_in_at < t_close AND t_open < COALESCE(clocked_out_at, p_now)`), with file-level boundary matrix and **`COMMENT ON FUNCTION`** mentioning half-open semantics (adjacent blocks, **`approved_at`** open-row follow-up noted in SQL comments only).
- **Changes**: **`CREATE OR REPLACE`** **`salary_sync_one_user_clock_sessions`** + **`COMMENT`** + **`REVOKE ALL … FROM PUBLIC`**
- **Impact**: [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md) **Half-open intervals** subsection
- **Category**: People / Hours / Salary sync

**`20270408160000_invoice_allocation_lines_for_job_summary.sql`**
- **Purpose**: **Job Summary** tab **Parts Cost** — per-invoice supply-house lines allocated to jobs (not only rolled-up totals)
- **Changes**: **`get_invoice_allocation_lines_for_jobs(p_job_ids uuid[])`** — `RETURNS TABLE` (**`job_id`**, **`invoice_id`**, **`allocated_amount`**, invoice metadata, **`supply_house_name`**, **`pct`**); **`STABLE`**, **`SECURITY DEFINER`**, job visibility matches **`get_invoice_amounts_for_jobs`**; **`GRANT EXECUTE`** to **`authenticated`**
- **Impact**: [`Jobs.tsx`](../src/pages/Jobs.tsx) Job Summary **Parts Cost**
- **Category**: Jobs / Materials / Invoices

**`20270408161000_tally_staff_split_save_align_subcontractor_targets.sql`**
- **Purpose**: **Stale tally staff follow-up** — when **dev** / **master_technician** / **assistant** saves Mercury **job splits** for a **subcontractor’s** linked card, allow any **`jobs_ledger`** row the staff search could return (align with **`search_jobs_for_tally_mercury_assign_as_user`**), instead of requiring **`jobs_ledger_team_members`** per job
- **Changes**: **`CREATE OR REPLACE`** **`replace_mercury_job_splits_for_linked_card_as_staff`**
- **Impact**: [`MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx) **`tallyActAsUserId`** save path
- **Category**: Dashboard / Job Parts Tally

**`20270408163000_person_offsets_employee_credit_type.sql`**
- **Purpose**: **`person_offsets`** — **`employee_credit`** type for amounts **owed to** the person (e.g. overpayment held as a pending offset); distinct from **backcharge** / **damage** deductions
- **Changes**: Replace **`person_offsets_type_check`** — **`CHECK (type IN ('backcharge', 'damage', 'employee_credit'))`**; **`COMMENT ON TABLE`**
- **Impact**: [`PersonOffsetFormModal.tsx`](../src/components/pay/PersonOffsetFormModal.tsx), [`People.tsx`](../src/pages/People.tsx) **Offsets** + pay HTML, [`PayStubLessModal.tsx`](../src/components/pay/PayStubLessModal.tsx) (**Employee credit** listed, **Apply** disabled); [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.252
- **Category**: People / Pay

#### April 10, 2026

**`20270410120000_invoice_linked_payments_partial_mark_paid.sql`**
- **Purpose**: **Partial invoice payments** — link **`jobs_ledger_payments`** rows to **`jobs_ledger_invoices`**; **`mark_invoice_paid`** accepts optional **`p_amount`**, **`p_paid_on`**, **`p_note`** (remaining balance when amount omitted); **`mark_job_paid`** same optional fields for whole-job billed payments; **`mark_invoice_paid_from_stripe`** applies **remainder** after prior **`invoice_id`** payments and sets **`invoice_id`** on insert (idempotent if already **paid**)
- **Changes**: **`invoice_id`** on **`jobs_ledger_payments`**; **`DROP`/`CREATE`** RPCs (replace single-arg **`mark_invoice_paid`** / **`mark_job_paid`** with defaulted-args versions)
- **Impact**: [`BilledPaymentConfirmationModal.tsx`](../src/components/jobs/BilledPaymentConfirmationModal.tsx), [`Jobs.tsx`](../src/pages/Jobs.tsx), [`Dashboard.tsx`](../src/pages/Dashboard.tsx), [`stripe-webhook`](../supabase/functions/stripe-webhook/index.ts); [`database.ts`](../src/types/database.ts)
- **Category**: Jobs / Billing

**`20270410130100_drop_duplicate_mark_invoice_paid_overload.sql`**
- **Purpose**: Fix PostgREST **`mark_invoice_paid`** RPC ambiguity when a stray overload **`(uuid, date, text, numeric)`** exists alongside the canonical **`(uuid, numeric, date, text)`** from **`20270410120000`** — **`DROP FUNCTION IF EXISTS`** the duplicate signature only
- **Changes**: **`DROP FUNCTION IF EXISTS public.mark_invoice_paid(uuid, date, text, numeric)`**
- **Impact**: Single **`mark_invoice_paid`** overload; regenerate **`database.ts`** if duplicate union arm disappears
- **Category**: Jobs / Billing

**`20270410130300_stripe_webhook_events_dedupe.sql`**
- **Purpose**: **Stripe webhook dedupe log** — **`stripe_webhook_events`** stores **`stripe_event_id`** (unique) plus payload snapshot for **`invoice.*`**, **`payment_intent.*`**, **`charge.*`**; **`stripe-webhook`** inserts before processing and bails on duplicate
- **Changes**: **`CREATE TABLE`** + indexes; **dev-only** SELECT RLS (`is_dev()`)
- **Impact**: [`stripe-webhook`](../supabase/functions/stripe-webhook/index.ts); Banking **Stripe** → **Data** ([`BankingStripeWebhookEventsPanel.tsx`](../src/components/BankingStripeWebhookEventsPanel.tsx)); [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.284
- **Category**: Jobs / Billing / Dev tooling

#### April 19, 2026

**`20270419120001_ar_bank_allocations_breakdown.sql`**
- **Purpose**: **`list_ar_allocations_for_mercury_transaction`** ( **`jobs_ledger_payments`** linked to a Mercury row, with job/invoice labels); **`CREATE OR REPLACE`** **`list_mercury_transactions_for_bank_payments`** / **`count_mercury_transactions_for_bank_payments`** with **`includeFullyApplied`** only — inadvertently omitted **`returned`** and **`includeHiddenArDeposits`** (restored in **`20270419120002`**)
- **Impact**: [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx) **Applied to jobs** breakdown; list/count filter
- **Category**: Jobs / Banking / AR

**`20270419120002_list_mercury_bank_payments_returned_column.sql`**
- **Purpose**: Restore **`returned`** on **`list_mercury_transactions_for_bank_payments`** and **`includeHiddenArDeposits`** (or legacy **`includeFullyApplied`**) visibility for zero-remainder and **mercury_transaction_ar_returned** rows; align **`count_mercury_transactions_for_bank_payments`** with the same rules (**fixes regression** from **`20270419120001`** dropping the join)
- **Changes**: **`CREATE OR REPLACE`** both RPCs; **`LEFT JOIN`** **`mercury_transaction_ar_returned`**
- **Impact**: [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx); types **`returned`** on list returns
- **Category**: Jobs / Banking / AR

#### April 25, 2026

**`20270425120000_allow_ready_to_bill_migrate_job_ledger_delete.sql`**
- **Purpose**: **`migrate_job_ledger_costs_and_delete`** — allow source **`jobs_ledger.status`** **`working`** or **`ready_to_bill`** (invoices, payments, `payments_made`, collect-payment flow guards unchanged; supersedes **Working**-only check from **`20270424120000_migrate_job_ledger_costs_and_delete.sql`**)
- **Changes**: **`CREATE OR REPLACE FUNCTION`**; updated first billing-guard branch and function **`COMMENT`**
- **Impact**: [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) **`billingBlockedForMigrate`**; [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.394
- **Category**: Jobs / Billing / RPC

**`20270426120000_checklist_tech_tree.sql`**
- **Purpose**: **Checklist → Roadmap** — groups, per-group tasks, task assignees, prerequisite edges; RLS using **`is_dev_or_master_or_assistant()`** for structure and assignee/staff task completion.
- **Changes**: **`CREATE TABLE`** **`checklist_tech_tree_groups`**, **`checklist_tech_tree_group_tasks`**, **`checklist_tech_tree_task_assignees`**, **`checklist_tech_tree_edges`**
- **Impact**: [`Checklist.tsx`](../src/pages/Checklist.tsx) **`?tab=roadmap`**, [`ChecklistTechTreeTab.tsx`](../src/components/checklist/ChecklistTechTreeTab.tsx)
- **Category**: Checklist

**`20270427120000_checklist_tech_tree_multi_roadmap.sql`**

- **Purpose**: **Checklist → Roadmap** — multiple named roadmaps (`checklist_tech_tree_roadmaps`), **`roadmap_id`** on groups, **`checklist_tech_tree_roadmap_members`** (viewer/editor); backfill **Default** + viewer rows for all non-archived users; RLS helpers **`can_select_checklist_tech_tree_roadmap`**, **`can_edit_checklist_tech_tree_structure_for_roadmap`**, **`is_checklist_tech_tree_staff_or_primary`**.
- **Impact**: Roadmap tab picker and members UI; URL **`?tab=roadmap&roadmap=<uuid>`**
- **Category**: Checklist

### March 2026 — "2027"-typo filenames (archived pre-baseline)

#### March 31, 2026

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

#### March 24, 2026

**`20270324120000_add_last_report_at_to_list_assigned_jobs.sql`**
- **Purpose**: Add last report timestamp to subcontractor Assigned Jobs Dashboard cards
- **Changes**: DROP and recreate `list_assigned_jobs_for_dashboard()`; add `last_report_at TIMESTAMPTZ` to return type (subquery: `MAX(reports.created_at)` for job)
- **Impact**: Subcontractor Dashboard Assigned Jobs cards show "Open X" (time since last report) for "time since last report" display
- **Category**: Dashboard / Reports

#### March 27, 2026

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

#### March 29, 2026

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
- **Impact**: People **Payroll** tab **Additional** column + modal; Less modal receives **additionalSum** for net; print order Additional → Less → Net Pay
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

**`20260321120002_create_person_licenses.sql`**
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

**`20260321120001_add_supply_house_invoice_to_line_items.sql`**
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
- **Impact**: Settings → Team Hours Sharing; **People → Teams** (`?tab=teams`); Dashboard → My Team pending sessions for leaders; team leads without pay access can approve/reject member sessions
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
- **Impact**: Settings → Team Hours Sharing; **People → Teams**; **Leader dashboard** (dev edits); hook/UI omit strip-only members from detailed My Team and pending banner counts; strip unchanged
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
- **Impact**: [`Banking.tsx`](../src/pages/Banking.tsx) read-only grid; Edge Functions documented in **`EDGE_FUNCTIONS.md`**
- **Category**: Banking / Integrations / RLS

**`20260401195701_mercury_account_nicknames.sql`**
- **Purpose**: **Banking (dev)**: optional friendly labels per **`mercury_account_id`**; **RLS** dev **`SELECT` / **`INSERT`** / **`UPDATE`** / **`DELETE`** (edited from the Banking UI)
- **Changes**: `CREATE TABLE mercury_account_nicknames` (`mercury_account_id` PK, `nickname` 1–120 chars, `updated_at`); dev policies; **`GRANT`** to **`authenticated`** and **`service_role`**
- **Impact**: [`Banking.tsx`](../src/pages/Banking.tsx) account filter labels, sortable grid, nickname management block
- **Category**: Banking / Integrations / RLS

#### April 2, 2026

**`20260402003356_mercury_job_allocation_note.sql`**
- **Purpose**: **Banking** Mercury job splits: optional per-allocation **`note`**; **`replace_mercury_transaction_splits`** persists **`note`** from **`p_rows`**
- **Changes**: **`ALTER TABLE mercury_transaction_job_allocations ADD COLUMN note text`**; **`CREATE OR REPLACE`** **`replace_mercury_transaction_splits`** (insert includes **`note`** via **`NULLIF(trim(elem->>'note'), '')`**)
- **Impact**: [`MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx) positive charge / **$**–**%** UI saves notes; [`Banking.tsx`](../src/pages/Banking.tsx) loads **`note`**
- **Category**: Banking / RLS

**`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`**
- **Purpose**: Keep **`people_crew_jobs`** / **`people_crew_bids`** aligned when **`job_ledger_id`** or **`bid_id`** changes on an **approved** **`clock_sessions`** row (strip **Assign** / **Change** without a second approve); enable Realtime for crew tables
- **Changes**: Function **`clock_sessions_sync_crew_assignments_after_job_bid()`**; trigger **`clock_sessions_sync_crew_assignments_tr`** **`AFTER UPDATE OF job_ledger_id, bid_id`**; **`PERFORM`** **`sync_crew_jobs_from_clock`** and **`sync_crew_bids_from_clock`** when **`approved_at IS NOT NULL`**, **`rejected_at`** / **`revoked_at`** null, name present; conditional **`ALTER PUBLICATION supabase_realtime ADD TABLE`** for **`people_crew_jobs`** and **`people_crew_bids`**
- **Impact**: [`CrewJobsBlock.tsx`](../src/components/CrewJobsBlock.tsx) **`postgres_changes`** subscription receives writes from approve/sync/trigger; **Quickfill** and **Jobs → Team Labor** refetch automatically
- **Category**: Hours / Clock Sessions / Crew Jobs / Realtime

**`20260401004452_attendance_incidents_subject_select_own.sql`**
- **Purpose**: Let the **subject** of an attendance incident **SELECT** their own row (Calendar NCNS chip)
- **Changes**: `CREATE POLICY "Attendance incidents subject select own"` **`FOR SELECT`** **`USING (subject_user_id = auth.uid())`**
- **Impact**: [`Calendar.tsx`](../src/pages/Calendar.tsx) can load NCNS for signed-in user without staff/team-lead role; staff policies unchanged (ORed)
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
- **Impact**: [`Banking.tsx`](../src/pages/Banking.tsx) and [`BankingSortingSnapshotSection.tsx`](../src/components/quickfill/BankingSortingSnapshotSection.tsx) **`postgres_changes`** subscriptions (debounced **`loadRows`** / **`loadMercurySnapshot`**)
- **Category**: Banking / Integrations / Realtime

#### April 4, 2026

**`20260404050732_salary_sync_boundary_open_close.sql`**
- **Purpose**: **`salary_sync_one_user_clock_sessions`** — replace per-slot canonical `UPDATE`/overlap INSERT logic with **boundary** open/ close: at each template block end set **`clocked_out_at`** on **all** still-open **`clock_sessions`** for that user/**`work_date`** to that instant (every `origin`; **`approved_at`** does not block); inside each block insert/reopen canonical **`salary_schedule`** only when **no** open exists that day; catch-up closed rows when missing; PTO / no-template / excluded-weekend paths **close remaining opens** at **`p_now`** after deleting non-final **`salary_schedule`** rows; **split** mode deletes orphan NULL-index **`salary_schedule`** rows only; **continuous** skips NULL-index catch-up/open when pending indexed **`salary_schedule`** segments exist (preserves **`20270402100000`** intent)
- **Changes**: `CREATE OR REPLACE` **`salary_sync_one_user_clock_sessions`**; updated **`COMMENT`**; **`REVOKE ALL`** (unchanged surface area)
- **Impact**: Cron **`sync-salary-sessions`** and **`sync_salary_clock_sessions_for_user_day`**; removes split-template **half-open overlap** INSERT guard from sync (see [`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md))
- **Category**: People / Hours / Dashboard

#### April 24, 2026

**`20260424161028_mercury_debit_card_auto_assign_user.sql`**
- **Purpose**: **Banking** — optional auto-assignment of Mercury **person**/ **user** on linked-card transactions: switch from **`auto_assign_person_id`** to **`mercury_debit_card_user_links.auto_assign_user_id`** (FK **`public.users`**, same roster as Tally / User Card Link). Replaces trigger logic so **`mercury_transaction_attributions.user_id`** is set for unattributed rows; includes **`backfill_mercury_auto_attributions_for_debit_card`** for staff to backfill a card.
- **Changes**: **`ADD COLUMN auto_assign_user_id`**; **`DROP COLUMN auto_assign_person_id`**; **`CREATE OR REPLACE`** **`mercury_transactions_apply_debit_card_auto_attribution`**; backfill RPC updated for **`user_id`**
- **Impact**: [`BankingUserCardLinkModal.tsx`](../src/components/BankingUserCardLinkModal.tsx); see **`RECENT_FEATURES.md`** v2.401, **`PROJECT_DOCUMENTATION.md`** §15 Banking
- **Category**: Banking / Integrations

#### April 25, 2026

**`20260425064129_get_invoice_allocation_lines_website_url.sql`**
- **Purpose**: **Job Summary** — **`get_invoice_allocation_lines_for_jobs`** return shape adds **`website_url`** from **`supply_houses`** so the invoice column can open the same Materials / **Open website** URL as the supply house form.
- **Changes**: **`CREATE OR REPLACE FUNCTION`** — **`RETURNS TABLE`** + **`sh.website_url`**
- **Impact**: [`Jobs.tsx`](../src/pages/Jobs.tsx) Job Summary **Invoices from supply houses** (and Parts detail table)
- **Category**: Jobs / Materials / Invoices

**`20260425065352_get_invoice_allocation_lines_invoice_link.sql`**
- **Purpose**: **Job Summary** — RPC adds **`invoice_link`** from **`supply_house_invoices.link`** (per-invoice **View** URL in [SupplyHousesTab](../src/components/SupplyHousesTab.tsx)), preferred over the supply house **website** in the client.
- **Changes**: **`DROP` / `CREATE FUNCTION`** — **`i.link`**
- **Impact**: [`Jobs.tsx`](../src/pages/Jobs.tsx) job summary invoice table click target
- **Category**: Jobs / Materials / Invoices

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

**`20260322120005_fix_bid_search_and_j_prefix.sql`**
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
- **Impact**: NewReportModal and AdditionalReportModal request geolocation on submit; coordinates stored when permission granted; UI Maps affordance depends on RPC-returned coords (**expanded roles / own-row rules** — **`20270515120000_report_list_rpc_include_coordinates.sql`**, **`RECENT_FEATURES.md`** v2.418).
- **Category**: Reports

**`20260415120005_insert_report_add_location_params.sql`**
- **Purpose**: Allow insert_report RPC to accept optional location params
- **Changes**: Add `p_reported_at_lat`, `p_reported_at_lng` (DEFAULT NULL) to `insert_report` function
- **Impact**: Estimators submitting reports can pass location when available
- **Category**: Reports

**`20260415120006_list_reports_with_job_info_add_location.sql`**
- **Purpose**: Return reported_at_lat/lng in list_reports_with_job_info, role-gated
- **Changes**: Add reported_at_lat, reported_at_lng to RPC return; only dev/master_technician/assistant receive values; others get NULL
- **Impact**: Initial office-role-only masking for coordinates in **`list_reports_with_job_info`** / **`list_reports_for_job_ledger`** payloads. **Expanded**: **`20270515120000_report_list_rpc_include_coordinates.sql`** returns coordinates for **primary**, **superintendent**, **estimator**, and **helpers**/**subcontractor** on **own** rows (see **`RECENT_FEATURES.md`** v2.418).
- **Category**: Reports

**`20260415120007_list_my_reports_add_location.sql`**
- **Purpose**: Same role-gated location columns for list_my_reports
- **Changes**: Add reported_at_lat, reported_at_lng with same conditional as list_reports_with_job_info
- **Impact**: Initial office-role-only masking on **`list_my_reports`**. **Expanded**: **`20270515120000_report_list_rpc_include_coordinates.sql`** returns coords on the viewer’s **own** rows for **helpers** / **subcontractor** as well (**`RECENT_FEATURES.md`** v2.418).
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

**`20260416062502_hours_days_correct_authenticated_select.sql`**
- **Purpose**: Let all signed-in users see which `work_date` values are marked correct (company-wide lock)
- **Changes**: RLS policy `FOR SELECT TO authenticated USING (true)` on `hours_days_correct`; INSERT/DELETE unchanged (pay-approved master / assistant)
- **Impact**: Dashboard can hide My Time / strip editors for locked days without widening write access
- **Category**: People / Hours

#### April 17, 2026

**`20260417000000_add_estimated_completion_date_to_jobs_ledger.sql`**
- **Purpose**: Optional estimated completion date for jobs
- **Changes**: Add `estimated_completion_date DATE` to `jobs_ledger`
- **Impact**: Stages tab; Ham mode -1/+1 buttons adjust this date
- **Category**: Jobs / Stages
- **Note**: Renamed to **`last_bill_date`** in **`20260408014106_rename_estimated_completion_to_last_bill_date_and_fix_rtb_rpc.sql`** (April 8, 2026).

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

**`20260418061005_count_mercury_transactions_for_bank_payments.sql`**
- **Purpose**: Dashboard **Unallocated bank deposits** count and Jobs **Bank Payments** parity — same eligibility filter + remainder rules as **`list_mercury_transactions_for_bank_payments`**
- **Changes**: Create **`count_mercury_transactions_for_bank_payments(p_filter jsonb)`** (SECURITY DEFINER; dev / master_technician / assistant / primary)
- **Impact**: [`useArBankUnallocatedCount.ts`](../src/hooks/useArBankUnallocatedCount.ts); [`DashboardArBankUnallocatedBanner.tsx`](../src/components/DashboardArBankUnallocatedBanner.tsx)
- **Category**: Banking / Accounts Receivable / Dashboard

**`20260418063154_ar_sorting_exclude_counterparty_note.sql`**
- **Purpose**: **Accounts Receivable Sorting** — optional case-insensitive substring exclusions on Mercury **`counterparty_name`** and **`note`** (no SQL `LIKE` metacharacters)
- **Changes**: Replace **`list_mercury_transactions_for_bank_payments`** to apply **`excludeCounterpartyContains`** / **`excludeNoteContains`** from **`p_filter`**; align **`count_mercury_transactions_for_bank_payments`** with the same logic
- **Impact**: [`bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts); [`BankingSortingConfigModal.tsx`](../src/components/BankingSortingConfigModal.tsx); [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx)
- **Category**: Banking / Accounts Receivable

**`20260418073359_bank_payments_kind_badges_app_settings_doc.sql`**
- **Purpose**: Document **`app_settings.key`** **`bank_payments_kind_badges_v1`** for org-wide Jobs **Bank Payments** Mercury Kind badge JSON (no DDL; no seed row)
- **Changes**: Comment-only migration (`SELECT 1`) so local-only **`localStorage`** fallback stays correct before first dev upsert
- **Impact**: [`bankPaymentsKindBadges.ts`](../src/lib/bankPaymentsKindBadges.ts); [`appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts)
- **Category**: Banking / Accounts Receivable / Settings

**`20260418074400_bank_payments_sorting_config_app_settings_doc.sql`**
- **Purpose**: Document **`app_settings.key`** **`bank_payments_sorting_config_v1`** for org-wide Jobs **Accounts Receivable Sorting** Mercury filter JSON (`BankingSortingConfigV1`; no DDL; no seed row)
- **Changes**: Comment-only migration (`SELECT 1`) so legacy per-user **`localStorage`** fallback stays correct before first dev upsert
- **Impact**: [`bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts); [`appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts); [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx); [`useArBankUnallocatedCount.ts`](../src/hooks/useArBankUnallocatedCount.ts)
- **Category**: Banking / Accounts Receivable / Settings

**`20260418120000_create_dev_ignored_checklist_items.sql`**
- **Purpose**: Dev Ignored Tasks section in Recently Completed Tasks
- **Changes**: Create `dev_ignored_checklist_items` (dev_user_id, checklist_item_id, ignored_at) PK; RLS for devs to manage own rows
- **Impact**: Dashboard Recently Completed Tasks split into main section (non-ignored types) and collapsible Ignored section; Ignore/Un-ignore buttons; UNREAD count excludes ignored items
- **Category**: Checklist / Dashboard

**`20260418184112_mercury_transaction_ar_returned_and_include_hidden.sql`**
- **Purpose**: Jobs AR **Bank Payments** — hide “returned” Mercury deposits by default (e.g. bounced cheque still showing as credit); clearer **`p_filter`** key **`includeHiddenArDeposits`**
- **Changes**: **`mercury_transaction_ar_returned`** + RLS; **`set_mercury_transaction_ar_returned`**; replace **`list_mercury_transactions_for_bank_payments`** / **`count_mercury_transactions_for_bank_payments`** ( **`returned`** column; **`includeHiddenArDeposits`** with legacy **`includeFullyApplied`** fallback)
- **Impact**: [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx); [`src/types/database.ts`](../src/types/database.ts)
- **Category**: Banking / Accounts Receivable

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

**`20250310120001_optimize_bid_pricing_rls.sql`**
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

**`20260408180831_bids_materials_model_and_rough_part_lines.sql`**
- **Purpose**: Bid-level Exact vs Rough materials mode and rough takeoff part lines table
- **Changes**: `bids.materials_model`; `bids_takeoff_rough_part_lines` with RLS (short policy names)
- **Impact**: Takeoffs / CE / Pricing rough path; see RECENT_FEATURES v2.280 for catalog price link migration
- **Category**: Bids / Materials

**`20260408192820_rough_takeoff_line_catalog_price_source.sql`**
- **Purpose**: Track which `material_part_prices` row defaulted a rough line’s `unit_price`
- **Changes**: `bids_takeoff_rough_part_lines.source_material_part_price_id` nullable FK to `material_part_prices` ON DELETE SET NULL
- **Impact**: Reset to catalog, save line price to catalog row; cleared on manual unit price override
- **Category**: Bids / Materials

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

**`20260321120002_create_person_licenses.sql`**
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
- **Impact**: People → Payroll → Ledger shows Paid column with "Mark as paid" / "Paid [date]" + Unmark; users can record when they physically pay each person
- **Category**: People / Pay Stubs

**`20260328052640_pay_stub_paid_note.sql`**
- **Purpose**: Optional memo when marking a pay stub physically paid
- **Changes**: Add `paid_note TEXT` to `pay_stubs`
- **Impact**: Payroll tab mark-paid flow can store a short note
- **Category**: People / Pay Stubs

**`20260328215252_pay_stub_payments.sql`**
- **Purpose**: Multiple partial physical payments per pay stub (amount + paid date + memo)
- **Changes**: Create `pay_stub_payments` (FK `pay_stubs` ON DELETE CASCADE, `amount` > 0, `paid_at`, memo, created_by); BEFORE INSERT/UPDATE trigger caps sum(amount) per stub to `gross_pay` + 0.01; RLS SELECT/INSERT/UPDATE/DELETE for pay access (same helpers as `pay_stub_days`); backfill one row per stub where `pay_stubs.paid_at` IS NOT NULL
- **Impact**: People → Payroll ledger and Run Payroll use **Record payment**; installments can be removed one row at a time from the payment detail modal; fully paid = sum of installments ≥ gross; print/HTML pay report includes **Physical payments** block
- **Category**: People / Pay Stubs

#### March 29, 2026

**`20260329002111_pay_stub_deductions.sql`**
- **Purpose**: **Less** (deductions) per pay stub—manual lines or offset-linked; **Net Pay** = `gross_pay` − sum(deductions); cap installments at Net Pay
- **Changes**: Create `pay_stub_deductions` (FK `pay_stubs` ON DELETE CASCADE, amount > 0, `source` manual|offset, optional FK `person_offsets`, description, created_by); partial UNIQUE on `person_offset_id`; BEFORE trigger: sum(deductions) ≤ gross; AFTER trigger: sum(`pay_stub_payments`) ≤ Net Pay; backfill one row per `person_offsets` where `pay_stub_id` IS NOT NULL; replace `pay_stub_payments_enforce_total_fn` to use Net Pay; RLS same as `pay_stub_payments`
- **Impact**: Payroll ledger **Less** (click **$0.00** or amount → modal) and **Net Pay**; **Record payment** / trigger vs Net Pay; Run Payroll fully-paid uses Net Pay; print shows **Less** lines + **Net Pay**
- **Category**: People / Pay Stubs

#### March 27, 2026

**`20260327000000_devs_delete_pay_stubs.sql`**
- **Purpose**: Allow devs to delete pay stubs (e.g. to correct mistakes)
- **Changes**: Create RLS policy "Devs can delete pay stubs" on `pay_stubs` using `public.is_dev()`; `pay_stub_days` cascade automatically via FK ON DELETE CASCADE
- **Impact**: People → Payroll → Ledger shows a dev-only delete control (red trash icon); devs can remove erroneous pay stubs
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
- **Impact**: Generate flow now inserts pay_stub_days; clicking person name in Payroll ledger opens annual calendar modal (7×52 grid) with green/yellow/orange/gray day status; YTD earned, paid, unpaid totals
- **Category**: People / Pay

#### March 14, 2026

**`20260314000000_create_pay_stubs.sql`**
- **Purpose**: Ledger of generated pay stubs for employees; supports People → Payroll tab
- **Changes**: Create `pay_stubs` table (id, person_name, period_start, period_end, hours_total, gross_pay, created_at, created_by); RLS same as people_hours (is_pay_approved_master OR is_assistant_of_pay_approved_master) for SELECT/INSERT
- **Impact**: People page Payroll tab shows ledger and generator; users can create pay stubs by person and date range; print to PDF; HTML preview from bulk Generate Pay Reports (**View**) and related flows
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
- **Purpose**: Allow Masters, Assistants, and Devs to add/edit per-account text on each user in People → Users (column still `notes`; in-product UI since v2.398 labels it **Full name and title** alongside **phone** in the **Full name, title, and phone** modal)
- **Changes**: Add `notes text` column to `public.users`; RLS policy "Masters assistants devs can update user notes" for UPDATE
- **Impact**: People page Users tab shows `users.notes` after contact info when set; pencil (card icon) opens modal to edit `users.notes` and `users.phone`
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
- **Purpose**: Enable Realtime for people_hours so **People → Hours** updates when any user changes hours
- **Changes**: Adds `people_hours` to `supabase_realtime` publication (idempotent via pg_publication_tables check)
- **Impact**: When Dev, Master, or Assistant updates hours in **Hours**, all viewers of the **cost matrix** on **People → Hours** see updates automatically without refresh
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
- **Impact**: **People → Hours** **Teams** section; add teams, assign people, view combined cost for date range
- **Category**: People / Pay

**`20260213000002_create_people_hours.sql`**
- **Purpose**: Store hours worked per person per day
- **Changes**: Created `people_hours` (person_name, work_date, hours, entered_by); RLS for dev, approved masters, assistants
- **Impact**: Hours tab timesheet; editable for hourly people, read-only for salary (8 hrs/day)
- **Category**: People / Pay

**`20260314000000_create_pay_stubs.sql`**
- **Purpose**: Ledger of generated pay stubs for employees
- **Changes**: Created `pay_stubs` (person_name, period_start, period_end, hours_total, gross_pay, created_at, created_by); RLS same as people_hours
- **Impact**: People → Payroll tab; ledger, generators, print; HTML **View** in bulk modal
- **Category**: People / Pay

**`20260315000000_create_pay_stub_days.sql`**
- **Purpose**: Per-day paid allocation for mismatch detection
- **Changes**: Created `pay_stub_days` (pay_stub_id, person_name, work_date, hours_at_time, rate_at_time, paid_amount); backfill from existing pay_stubs
- **Impact**: Annual calendar modal when clicking person name; green/yellow/orange/gray day status; YTD totals
- **Category**: People / Pay

**`20260213000001_create_people_pay_config.sql`**
- **Purpose**: Per-person pay configuration
- **Changes**: Created `people_pay_config` (person_name, hourly_wage, is_salary, show_in_hours); RLS for dev and approved masters
- **Impact**: **People → Hours** **Review Hours & pay config** block; wage, salary flag, Show in Hours toggle
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
- `20250310120001_optimize_bid_pricing_rls.sql` - can_access_bid_for_pricing for bid_pricing_assignments and bid_count_row_custom_prices
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
- DATABASE_IMPROVEMENTS_SUMMARY.md - v2.22 improvements
- DATABASE_FIXES_TEST_PLAN.md - Testing procedures
- [supabase/archive/README.md](../supabase/archive/README.md) - Migration directory readme

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
