# One company — retiring job owners and assistant adoption

**Status:** approved 2026-09-06 (decisions below); COMPLETE — Phases 1–5c shipped (v2.2967 / v2.2970 / v2.2972 / v2.2976 / v2.2984 / v2.2987 / v2.2995 / v2.2999) · **Owner:** Will · **Ask (Will, 2026-09-06):** "Instead of jobs being owned by people and assistants being adopted by specific masters, tear down these walls. There are no job owners; assistants are just assistants and masters are just masters. It is one company, not multiple people operating independently under one company."

---
file: ONE_COMPANY_PLAN.md
type: Plan
purpose: Phased removal of per-person ownership (master_user_id) and adoption/sharing (master_assistants, master_shares) so the office is one company; what stays walled and why
audience: Owner, developers, AI agents
last_updated: 2026-09-06
key_sections:
  - name: "What the walls are today"
  - name: "What stays a wall"
  - name: "Phases"
  - name: "Decisions owed"
  - name: "Verify"
---

## Why this is the right move

The app was built for master plumbers running independent books under one roof: every customer, project, job, bid and estimate carries a `master_user_id`; assistants see a master's rows only after that master **adopts** them (`master_assistants`); masters see each other's rows only through **sharing** (`master_shares`); triggers keep a job's owner equal to its project's owner and a project's owner equal to its customer's owner; and RPCs refuse to cross owners ("job belongs to a different owner than the estimate" — hit live on 2026-09-06 while applying a change order to a job created by another session).

The company today has **one master** (Malachi), two devs, three assistants, no controller. The data is already one company; only the schema and the copy still say otherwise. The walls now cost real things: an office person who was never adopted sees an empty Pipeline; a change order cannot be applied to a job someone else opened; every new table needs the adoption branch copied into its policies (the journey map's Tier-1 #4 and Tier-2 #28 were largely about those branches drifting).

## What the walls are today (sized 2026-09-06)

| Wall | Where | Size |
|---|---|---|
| `master_user_id` column | 34 tables (customers, projects, jobs_ledger, bids, estimates, …) | 43 column sites in `database.ts`; 66 client files read it (328 lines) |
| Adoption `master_assistants` | RLS helpers `master_adopted_current_user()`, `can_access_project*()`, the `users` SELECT policy; 7 client files (customer/job forms pick or filter by master) | 74 migration files mention ownership/adoption; 457 mentions in the baseline |
| Sharing `master_shares` | `assistants_share_master()`, `can_see_sharing_master()`; **no UI** left (only the backup export reads it) | dormant |
| Direct owner compares in policies (`master_user_id = auth.uid()` without a helper) | ~22 distinct policies | the mechanical sweep's real scope |
| Owner-equality triggers | `cascade_customer_master_to_projects`, "job owner must match project owner" | 2 |
| Owner-mismatch RPC guards | `apply_estimate_to_job` (the one hit live); `clone_price_book_version_to_bid` (bid-scoped, not owner) | 1 to remove |
| "Who is the owner of this new row" in the client | `resolveMasterUserId` (Estimates); the master picker in New Customer / Edit Customer / Job form / Prospects | 5 forms |

## What stays a wall (this plan does not touch)

- **Role capability** — dev · master · assistant · controller · estimator · primary · superintendent · subcontractor · helpers keep their surfaces and their predicates (`is_dev`, `is_master_or_dev`, `is_assistant`, `has_payroll_access`, `is_banking_staff`, `is_office_staff`, `can_edit_schedule_dispatch`). "Master" becomes a role that means master plumber, not a row owner.
- **Field and outsider scoping** — subs and helpers see their own jobs (`jobs_ledger_team_members`); superintendents see assigned projects (`project_superintendents`, v2.2836); primaries and customers see their own money; estimators keep service-type scoping; the customer / GC / sub portals keep their signed links.
- **Payroll access** — `pay_approved_masters` stays as a capability grant (which masters may read pay), unrelated to ownership.
- **Training mode**, the twins' write fence (`created_by` / assignment), the partner ledger — none of these read `master_user_id`.
- **`created_by`** — provenance stays on every row; it is who did it, not who owns it.

## Phases (each one PR or one short train; smallest shippable first)

### Phase 1 — Make ownership inert, at the helpers (one migration, ~a day, reversible)

Redefine the shared predicates so every office role passes, without touching the ~400 policies that call them:

- `master_adopted_current_user(master uuid)` → `is_office_staff()` (dev, master, assistant-like) — adoption is implied for everyone in the office.
- `assistants_share_master(a, b)` / `can_see_sharing_master(...)` → `is_office_staff()`.
- `can_access_project(p)` / `can_access_project_row(...)` / `can_access_project_via_step(...)` / `can_access_step_for_action(...)` → office roles `true`; keep the superintendent (assigned only), primary and field branches exactly as they are.
- `apply_estimate_to_job`: drop the `j.master_user_id IS DISTINCT FROM e.master_user_id` RAISE (keep the estimate-status and job-exists checks).
- The two owner-equality triggers become no-ops (`CREATE OR REPLACE … RETURN NEW`), so a job may sit on any project and a project on any customer.

`SET lock_timeout = '3s'`; every function `CREATE OR REPLACE`; nothing dropped. The `users` SELECT policy keeps its "masters see masters" shape (it reads `master_adopted_current_user`, which now says yes to the office).

**Effect:** the office is one company at the database. The columns still exist and are still written; nothing reads them for access any more except the ~22 direct-compare policies (Phase 2). **Rollback:** re-run the previous bodies (they live in git).

### Phase 2 — The mechanical sweep of the direct compares (one PR, merges alone)

A script (like `scripts/theme-tokenize.mjs`'s shape) rewrites the ~22 policies whose `USING` / `WITH CHECK` compare `master_user_id = auth.uid()` or join `master_assistants` inline: the owner branch becomes `public.is_office_staff()`; field / primary / superintendent branches are left byte-identical. Output is one migration with `DROP POLICY IF EXISTS` + `CREATE POLICY` per policy. Same rule as every sweep: cut from fresh `main`, merge before the next feature PR on those tables, and on a rebase conflict re-run the script rather than hand-resolve.

Verify with the role matrix probe (Phase 2b's method): impersonate each of the nine roles and count rows on customers, projects, jobs_ledger, bids, estimates, invoices — office roles must agree with dev; field / primary / superintendent counts must not change from before the sweep.

### Phase 3 — The client stops asking "whose is this" (2–3 PRs)

- **Stop choosing an owner.** New Customer, Edit Customer, the Job form, Prospects → Convert, and `resolveMasterUserId` in Estimates stop showing or computing a master. New rows are stamped with a **company owner id** from one place (`companyOwnerUserId()` in `src/lib/company.ts`, read from `company_settings` or the single master), so the column keeps a consistent value until Phase 4 retires it. The "Account man" field on jobs is a *person on the job*, not ownership — it stays.
- **Remove adoption from the UI and the copy.** People → Users → Team leads keeps team leadership (crew approvals) but loses any "adopt / adopted by" affordance; the assistant onboarding guide, `ACCESS_CONTROL.md` ("Ownership, Adoption, Sharing" → "One company; roles and assignments"), `PROJECT_DOCUMENTATION.md` and `GLOSSARY.md` are rewritten in the same PR. Release note: "Assistants no longer need to be adopted; every office person sees every job."
- **Backup export** stops exporting `master_shares`.

### Phase 4 — Data and provenance (one migration, after a quiet week on Phases 1–3)

- Backfill `master_user_id` to the company owner id on every one of the 34 tables (an `UPDATE … WHERE master_user_id <> company_owner`), so historical rows stop implying a second owner. Keep the columns (they are in 66 client files and dozens of RPC signatures; dropping them is a separate, larger sweep) but declare them **provenance only** in `PROJECT_DOCUMENTATION.md`.
- `master_assistants` and `master_shares`: stop writing, keep reading nowhere; rename to `_retired_master_assistants` / `_retired_master_shares` (rename, not drop — same posture as Person identity Phase E).

### Phase 5 — Drop, after a quiet quarter (optional)

Drop the two retired tables, drop the no-op triggers and dead helpers, and consider renaming `master_user_id` → `company_id` (or dropping it) table by table. Gate: no RPC signature still takes an owner argument, and the drift and role-matrix probes are green.

## Decisions (Will, 2026-09-06)

1. **Company owner id** — a settings row, never a person: `app_settings.company_owner_user_id`, read through `company_owner_user_id()` (Phase 1). Because every `master_user_id` column is a foreign key to `users(id)` (and `users.id` to `auth.users`), the value is still an account id until Phase 5 retires the columns; what changed is that no form and no RPC picks a person any more — they all read the row.
2. **Masters see masters' pay?** — **the grant stays.** `pay_approved_masters` keeps deciding which leaders may read pay; the damage from opening it by role is too great.
3. **Superintendents and primaries** — **stay walled** (assigned projects / customer-side), consistent with X6.
4. **The word "master"** — the role is called **"leader"** in copy (labels, guides, docs). No schema or enum change; `master_technician` stays the stored value.

## Progress

- **Phase 1 — shipped v2.2967** (`20260906190000_one_company_owners_inert.sql` + three Stripe edge redeploys). Also folded in: `create_job_from_estimate` stamps `company_owner_user_id()` first; the job ↔ customer and job ↔ GC owner-match triggers are no-ops alongside the job ↔ project one; `user_can_access_estimate` lost its adoption branches.
- **Phase 2 — PR #2724, v2.2970** (`20260906200000_one_company_policy_sweep.sql`, generated by `scripts/one-company-policy-sweep.py`): 135 policies on 47 tables wrapped `is_office_staff() OR (…)`. Finding: `sync_company_access_grants()` (v2.921) has adopted every office user under every master since 2026-07-22, so the ~52 RPC gates that still read the grant tables inline already pass for the office; they are Phase 5 scope, not a blocker.
- **Phase 3a — v2.2972** (client): `src/lib/companyOwner.ts` feeds every owner resolver; the Customer Master pickers, the job form's cross-master filters and the per-user "Create jobs as" overrides are gone; Settings → Jobs & billing → **Company owner account**; backups drop the two grant tables.
- **Phase 3b — v2.2976**: "master" → "leader" in every role label, toast, placeholder and help guide (`scripts/leader-rename.py`, 239 replacements; "Master Subcontract Agreement", "master plumber" and every identifier untouched). Developer docs keep the enum name and note the label. Also revokes `company_owner_user_id()` from `anon` (`20260906210000`).
- **Phase 4 — v2.2984** (`20260907010000_one_company_backfill_owner.sql`): 176 rows on 9 tables repointed to the company owner account with user triggers paused; the two developments guards no-op'd; grant tables + columns commented. **Rename deferred**: ~52 SECURITY DEFINER functions still read `master_assistants` / `master_shares` inline and `sync_company_access_grants()` keeps them complete for the office — renaming would break those gates. Phase 5 sweeps the functions first, then renames/drops and retires the sync.
- **Phase 5 — v2.2987** (`20260907050000_one_company_retire_grant_tables.sql`): instead of hand-sweeping 45 functions, `master_assistants` / `master_shares` become **views** computed from `users` (owners × assistant/controller/estimator; owners × owners); the tables are renamed `retired_*`; `sync_company_access_grants()` fills only the primary / superintendent tables; the 84 policies naming the pair are re-created byte-identical (`--rebind`) so they bind to the views. **Phase 5c (chore, after a quiet week)**: drop the two retired tables; then the 45 functions can lose their dead adoption branches at leisure.
- **Phase 5c — v2.2999** (`20260907070000_one_company_drop_retired_grant_tables.sql`): the two retired tables dropped (no CASCADE; 18 rows listed by name in the migration doc). First push failed as designed on four policies the file-based census could not see (dynamic `CREATE POLICY` in `20260817224600`); the migration now re-binds through `pg_depend`. **Lesson**: `scripts/one-company-policy-sweep.py` reads migration files — ten migrations create policies with `EXECUTE format(...)`, so for "what is live" ask `pg_policies` / `pg_depend`. **Plan complete.**
- **Function sweep — v2.3070** (`20260907160000_one_company_function_sweep.sql`): 32 RPC gates rewritten on their live definitions (five canonical `EXISTS` forms → `is_office_or_estimator()` / `is_master_or_dev()`), 2 partial, 11 left reading the views on purpose (they test a user other than the caller); `merge_user_accounts` stops writing the pair (it would have failed on the views). Nothing left on the plan. Historical note that preceded the sweep: the 45 functions that still name `master_assistants` / `master_shares` read the views; drop those branches when next editing them.

## Verify (each phase)

- **Role matrix probe** (read-only, impersonation, dev server): per role, row counts on the six core tables + one deep link per surface (Pipeline, Bids board, Estimates list, Customers, Banking, People). Office roles converge on dev's counts; field / primary / superintendent counts do not move.
- **The change-order rehearsal from X8 (P3)**: apply an accepted CO to a job another person created — must succeed after Phase 1.
- **An un-adopted assistant** (create one from the roster, do not adopt): sees the full Pipeline after Phase 1; before, sees nothing.
- `npm run check:migration-drift`, the nine-role render smokes, and the journey-map dossiers J1 / J31 / J24 re-walked as their roles after Phase 3.

## Sequencing with what is in flight

- Phase 1 is one additive migration and can ship this week; it is independent of the Tier 5 train (all merged and applied 2026-09-06).
- Phase 2 is a mechanical sweep — merge it alone, before the next PR that touches customers / projects / jobs / bids / estimates policies.
- Phase 3 rewrites `ACCESS_CONTROL.md`; the private journey-map corpus (`_roles.md`, dossiers J24 / J31) should get one addendum noting adoption is gone, so future walks do not re-verify a wall that no longer exists.
