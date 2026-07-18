# Adding a New Role

> **Purpose**: Step-by-step guide for adding a new user role (e.g., Primary) to PipeTooling. Use this to avoid policy/permission mistakes and ensure all touchpoints are updated.

**Related**: [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) — Role permissions matrix; [supabase/archive/README.md](../supabase/archive/README.md) — Migration reference.

> **Most recent worked example — `controller` (v2.662, 2026-07-14)**: enum migration [`20260714210000_add_user_role_controller.sql`](../supabase/migrations/20260714210000_add_user_role_controller.sql) (enum ADD VALUE must be its own migration — the value can't be added and used in one transaction) + capabilities migration [`20260714213000_controller_capabilities.sql`](../supabase/migrations/20260714213000_controller_capabilities.sql). Prefer extending the **capability functions** (`has_payroll_access()`, assistant-LIKE `is_assistant()`, client `isAssistantLike()`) over per-policy edits — controller landed in ~3 DB function edits instead of ~75 policy rewrites, plus the client role-gate sweep. Also update: `database.ts` user_role enum, `usePeopleAccess`, the `ROLES` picker, `PersonKind` roster chain (`peopleUsersTabShared`, `usersTabRosterRoleSections` — v2.664 learned this the hard way: users with an unmapped role silently vanish from People → Users), and the `create-user`/`invite-user` Edge functions' `validRoles` (redeploy both).

---

## Pre-flight Checklist

### 1. Database enum

Create a migration to add the role to the `user_role` enum:

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'new_role';
COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor, estimator, primary, superintendent, new_role';
```

**Reference**: [supabase/archive/migrations-pre-baseline/20260221210000_add_user_role_primary.sql](../supabase/archive/migrations-pre-baseline/20260221210000_add_user_role_primary.sql) (pre-baseline history — see note under "RLS by Table Category")

### 2. Regenerate types

After applying the migration:

```bash
supabase gen types typescript --local > src/types/database.ts
```

### 3. Edge Functions

Ensure the user-creation Edge Functions accept the new role in their validation:

- **Files**: `supabase/functions/create-user/index.ts` (`validRoles`) and `supabase/functions/invite-user/index.ts` (`VALID_ROLES`)
- Add `'new_role'` to both arrays (both use the same modern 9-role list: dev, master_technician, assistant, subcontractor, helpers, estimator, primary, superintendent, controller)
- If the role needs service type filtering (like estimator/subcontractor), add handling for `service_type_ids` when `role === 'new_role'` in both functions
- **Redeploy both functions** — CI does not deploy edge functions; a stale deployed copy will reject the new role even when the repo is correct (this exact drift broke Helper in create-user and the whole invite flow, fixed 2026-07-02)

### 4. Signup trigger

Add the role to the `handle_new_user` accepted `invited_role` list (new migration). The **latest** function body lives in `supabase/migrations/20260714213000_controller_capabilities.sql` (the `CREATE OR REPLACE FUNCTION public.handle_new_user()` block) — start from that, not the older `20260702160000_modernize_handle_new_user.sql`. Users invited with a role missing from that list fall back to `helpers`.

---

## Frontend Touchpoints

### Layout.tsx

(Line numbers drift — search for the symbol names.)

- **Paths constants** (`SUBCONTRACTOR_PATHS`, `PRIMARY_PATHS`, `SUPERINTENDENT_PATHS`, currently around lines 72–74): Add `NEW_ROLE_PATHS = ['/dashboard', '/materials', ...]` (array of allowed paths)
- **Redirect logic** (the role-branch `useEffect`, currently around lines 188–198): Add a branch for the new role, e.g.:
  ```tsx
  if (role === 'new_role' && (location.pathname === '/' || !NEW_ROLE_PATHS.includes(location.pathname))) {
    navigate('/dashboard', { replace: true })
  }
  ```
- **Estimator note**: estimator paths are no longer a Layout constant — the estimator branch calls `isEstimatorPathAllowed` from [src/lib/layoutRouteAccess.ts](../src/lib/layoutRouteAccess.ts). That file mirrors Layout's route guards for in-app links — **update it in lock-step with any Layout path change** (it has its own per-role path lists).

**Reference**: [src/components/Layout.tsx](../src/components/Layout.tsx), [src/lib/layoutRouteAccess.ts](../src/lib/layoutRouteAccess.ts)

### Dashboard.tsx

- **Paths constants** (`SUBCONTRACTOR_PATHS`, `PRIMARY_PATHS`, `SUPERINTENDENT_PATHS`, currently around lines 753–755): Add `NEW_ROLE_PATHS = new Set([...])`
- **getPathsForRole** (just below the constants, currently around lines 757–774): Add `if (role === 'new_role') return NEW_ROLE_PATHS`

**Reference**: [src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx)

### Settings / role pickers

- **ROLES**: the canonical assignable-role list lives in [src/lib/userRoles.ts](../src/lib/userRoles.ts) — add `'new_role'` there
- **PAGE_ACCESS**: the page-access matrix lives in [src/components/settings/SettingsPeopleTab.tsx](../src/components/settings/SettingsPeopleTab.tsx) (`PAGE_ACCESS` constant near the top) — add a `new_role` column to each row with `'yes'`, `'no'`, or `'yes limited'` as appropriate. *(Known gap: the matrix currently lacks a `controller` column — being fixed separately.)*
- **Report-enabled users** ([src/pages/Settings.tsx](../src/pages/Settings.tsx) — search `report_enabled_users`, currently used around lines 1103 and 1365): If the role can be report-enabled (like subcontractor), add logic to show the checkbox for users with this role
- **Service type filtering** (if applicable): Add UI for `new_role_service_type_ids` when creating/editing users with this role

### Page components

Role checks occur in many pages. Search for `role === 'primary'`, `role === 'estimator'`, etc. to find patterns. Key files:

- **Jobs.tsx** — Tab visibility (Reports, Stages, Billing, etc.)
- **Bids.tsx** — Tab visibility and feature gating
- **Materials.tsx** — Service type filtering
- **People.tsx** — Visibility of people/pay sections
- **Checklist.tsx** — Item visibility
- **Dashboard.tsx** — Recent Reports, Send task, quick actions

---

## RLS by Table Category

When adding a new role, update RLS policies on affected tables. Use existing migrations as templates.

> **Note**: migrations were squash-baselined at `supabase/migrations/20250101000000_baseline.sql`; every pre-baseline migration referenced in the tables below now lives in [`supabase/archive/migrations-pre-baseline/`](../supabase/archive/migrations-pre-baseline/) (reference-only — the live schema comes from the baseline).
>
> **Prefer capability functions over per-policy edits**: before templating dozens of per-table policies, check whether a single-point capability function already gates the area — e.g. `is_assistant()` (assistant-LIKE) and `has_payroll_access()`. The controller rollout ([`20260714213000_controller_capabilities.sql`](../supabase/migrations/20260714213000_controller_capabilities.sql)) landed in ~3 DB function edits instead of ~75 policy rewrites.

### Bids

| Table | Migration reference |
|------|---------------------|
| `bids_gc_builders`, `bids`, `bids_submission_entries` | `20260224100000_primary_bids_bid_board_access.sql` |
| `bids_count_rows` | `20260311000000_primary_bids_count_rows_access.sql` |
| `bid_pricing_assignments` | `20260410140000_fix_bid_pricing_assignments_primary_rls.sql` |
| Full bids access | `20260410130000_primaries_full_bids_access.sql` |
| Adoption-based access | `20260224110000_primary_bids_adoption_access.sql`, `20260231000023_primary_bids_see_adopted_master_bids.sql` |

### Materials

| Table | Migration reference |
|------|---------------------|
| `material_parts`, `material_part_prices`, `material_templates`, `purchase_orders`, `supply_houses`, etc. | `20260221210002_primary_materials_access.sql` |
| `assembly_book` | `20260224150000_primary_assembly_book_read.sql` |
| `fixture_types` | `20260312000002_primary_fixture_types_access.sql` |
| Price book | `20260312000010_primary_price_book_access.sql` |
| Supply houses | `20260224140000_primary_supply_houses_read.sql` |

### Reports

| Table / Function | Migration reference |
|------------------|---------------------|
| `reports` | `20260221210001_primary_reports_access.sql` |
| `list_reports_with_job_info()` | Same migration — add role to "see all reports" branch |
| `report_enabled_users` | For roles that get Recent Reports via opt-in (subcontractors) |

### Jobs ledger

| Table | Migration reference |
|------|---------------------|
| Tally parts, jobs ledger | `20260225000000_primary_jobs_tally_parts.sql` |
| Cost estimates, labor rows | `20260311000001_primary_cost_estimates_access.sql`, `20260311000002_primary_cost_estimate_labor_rows_access.sql` |

### People / Users

| Table | Migration reference |
|------|---------------------|
| `users` — allow new role to see masters | `20260224130000_allow_users_see_primaries.sql` |
| `users` — primaries see adopted masters | `20260230000015_primaries_see_adopted_masters.sql` |
| `users` SELECT policies | `20260230000008_consolidate_users_select_policies.sql` |

---

## Helper Functions

For roles that need dedicated policy helpers (e.g., to avoid recursion or simplify policies):

**Pattern** (mirror `is_estimator()`):

```sql
CREATE OR REPLACE FUNCTION public.is_new_role()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND role = 'new_role'
  );
$$;
```

**Reference**: [supabase/archive/migrations-pre-baseline/20260212240000_allow_estimators_see_masters.sql](../supabase/archive/migrations-pre-baseline/20260212240000_allow_estimators_see_masters.sql)

**RLS performance**: Use `(select auth.uid())` and `(select auth.jwt())` in policies so the planner can cache the result per query. See [optimize_workflow_templates_rls.sql](../supabase/archive/optimize_workflow_templates_rls.sql) and Supabase RLS performance docs.

---

## Special Relationships

### Adoption (master–role junction table)

If the role needs adoption (like Primary or Superintendent), create a junction table mirroring `master_primaries`:

**Reference**: [supabase/archive/migrations-pre-baseline/20260223100000_create_master_primaries.sql](../supabase/archive/migrations-pre-baseline/20260223100000_create_master_primaries.sql), [supabase/archive/migrations-pre-baseline/20260520120001_create_master_superintendents.sql](../supabase/archive/migrations-pre-baseline/20260520120001_create_master_superintendents.sql)

- Table: `master_new_roles(master_id, new_role_id)` with FKs to `users`
- RLS: Masters and devs can read/manage; new_role users can read who adopted them
- **Superintendent example**: `master_superintendents(master_id, superintendent_id)` — superintendents get adoption-based access to projects, workflows, jobs, bids; no People page; can assign people in Workflow

### Service type filtering

If the role should be restricted to specific service types (e.g., Plumbing only):

- Add column: `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS new_role_service_type_ids UUID[] DEFAULT NULL`
- **Reference**: [supabase/archive/migrations-pre-baseline/20260224000000_add_primary_service_type_ids.sql](../supabase/archive/migrations-pre-baseline/20260224000000_add_primary_service_type_ids.sql)
- Update `create-user` Edge Function to accept and store `service_type_ids` when role is `new_role`
- Add Settings UI for editing this when creating/editing users

### Report-enabled users

For roles that get the Recent Reports section only when explicitly enabled (e.g., subcontractors):

- Table: `report_enabled_users(user_id)` — devs manage via Settings
- **Reference**: [src/pages/Settings.tsx](../src/pages/Settings.tsx) — search `report_enabled_users` / `reportEnabledUserIds` (load + save logic, currently around lines 1103 and 1365)
- [src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx) — search `isReportEnabledOnlyUser` (state + effect, currently around line 1096) and `showRecent`

---

## Copy-Paste Checklist

Use this when adding a new role:

- [ ] Migration: Add role to `user_role` enum + update COMMENT
- [ ] Migration: Add role to `handle_new_user` accepted `invited_role` list
- [ ] Regenerate types: `supabase gen types typescript --local > src/types/database.ts`
- [ ] Edge Functions: Add role to `validRoles` in `create-user/index.ts` AND `VALID_ROLES` in `invite-user/index.ts`, then redeploy both
- [ ] Layout.tsx: Add `NEW_ROLE_PATHS` and redirect logic (+ mirror in `src/lib/layoutRouteAccess.ts`)
- [ ] Dashboard.tsx: Add `NEW_ROLE_PATHS` and `getPathsForRole` branch
- [ ] Role pickers: Add to `ROLES` in `src/lib/userRoles.ts`; add `PAGE_ACCESS` column in `SettingsPeopleTab.tsx`
- [ ] **Capability functions first**: if the new role piggybacks on an existing capability, extend the single-point DB functions (`is_assistant()`, `has_payroll_access()`, client `isAssistantLike()`, …) instead of editing dozens of per-table policies — the controller rollout (`20260714213000_controller_capabilities.sql`) landed this way in ~3 function edits
- [ ] RLS: Update remaining policies on bids, materials, reports, jobs ledger, users (see table categories above)
- [ ] Helper function: Create `is_new_role()` if needed
- [ ] Adoption table: Create `master_new_roles` if role uses adoption
- [ ] Service type filtering: Add `new_role_service_type_ids` to users + create-user + Settings UI if needed
- [ ] Report-enabled: Add to Settings Report-enabled section + Dashboard logic if needed
- [ ] Page components: Update role checks in Jobs, Bids, Materials, People, Checklist, Dashboard
- [ ] Test all 9 roles: dev, master_technician, assistant, subcontractor, helpers, estimator, primary, superintendent, controller (and new role)
