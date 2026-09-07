# One company — retiring job owners and assistant adoption

**Status:** proposal, 2026-09-06 · **Owner:** Will · **Ask (Will, 2026-09-06):** "Instead of jobs being owned by people and assistants being adopted by specific masters, tear down these walls. There are no job owners; assistants are just assistants and masters are just masters. It is one company, not multiple people operating independently under one company."

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

## Decisions owed (Will)

1. **Company owner id for Phase 3/4** — Malachi's account (the one master today), or a new `company_settings.owner_user_id` row so it never points at a person? *Recommendation:* the settings row; people change.
2. **Masters see masters' pay?** — unchanged by this plan (`pay_approved_masters`), but say so explicitly: is every master pay-approved in a one-company world, or does the grant list stay?
3. **Superintendents and primaries** — unchanged by this plan (assigned / customer-side), consistent with the X6 frame ("exactly what they need"). Confirm they stay walled.
4. **The word "master"** — keep as the role name (it is the license), or rename the role to "office lead"? Copy only; no schema change either way.

## Verify (each phase)

- **Role matrix probe** (read-only, impersonation, dev server): per role, row counts on the six core tables + one deep link per surface (Pipeline, Bids board, Estimates list, Customers, Banking, People). Office roles converge on dev's counts; field / primary / superintendent counts do not move.
- **The change-order rehearsal from X8 (P3)**: apply an accepted CO to a job another person created — must succeed after Phase 1.
- **An un-adopted assistant** (create one from the roster, do not adopt): sees the full Pipeline after Phase 1; before, sees nothing.
- `npm run check:migration-drift`, the nine-role render smokes, and the journey-map dossiers J1 / J31 / J24 re-walked as their roles after Phase 3.

## Sequencing with what is in flight

- Phase 1 is one additive migration and can ship this week; it is independent of the Tier 5 train (all merged and applied 2026-09-06).
- Phase 2 is a mechanical sweep — merge it alone, before the next PR that touches customers / projects / jobs / bids / estimates policies.
- Phase 3 rewrites `ACCESS_CONTROL.md`; the private journey-map corpus (`_roles.md`, dossiers J24 / J31) should get one addendum noting adoption is gone, so future walks do not re-verify a wall that no longer exists.
