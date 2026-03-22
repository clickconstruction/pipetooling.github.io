# Adding a New Role

> **Purpose**: Step-by-step guide for adding a new user role (e.g., Primary) to PipeTooling. Use this to avoid policy/permission mistakes and ensure all touchpoints are updated.

**Related**: [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) — Role permissions matrix; [supabase/migrations/README.md](./supabase/migrations/README.md) — Migration reference.

---

## Pre-flight Checklist

### 1. Database enum

Create a migration to add the role to the `user_role` enum:

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'new_role';
COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor, estimator, primary, superintendent, new_role';
```

**Reference**: [supabase/migrations/20260221210000_add_user_role_primary.sql](supabase/migrations/20260221210000_add_user_role_primary.sql)

### 2. Regenerate types

After applying the migration:

```bash
supabase gen types typescript --local > src/types/database.ts
```

### 3. Edge Functions

Ensure the `create-user` Edge Function accepts the new role in its validation:

- **File**: `supabase/functions/create-user/index.ts`
- **Location**: `validRoles` array (around line 89)
- Add `'new_role'` to the array: `const validRoles = ['dev', 'master_technician', 'assistant', 'subcontractor', 'estimator', 'primary', 'superintendent', 'new_role']`
- If the role needs service type filtering (like estimator/subcontractor), add handling for `service_type_ids` when `role === 'new_role'`

---

## Frontend Touchpoints

### Layout.tsx

- **Paths constant** (lines 36–39): Add `NEW_ROLE_PATHS = ['/dashboard', '/materials', ...]` (array of allowed paths)
- **Redirect logic** (lines 91–100): Add `useEffect` branch for the new role, e.g.:
  ```tsx
  if (role === 'new_role' && (location.pathname === '/' || !NEW_ROLE_PATHS.includes(location.pathname))) {
    navigate('/dashboard', { replace: true })
  }
  ```

**Reference**: [src/components/Layout.tsx](src/components/Layout.tsx) — `SUBCONTRACTOR_PATHS`, `ESTIMATOR_PATHS`, `PRIMARY_PATHS`, `SUPERINTENDENT_PATHS`

### Dashboard.tsx

- **Paths constant** (lines 166–168): Add `NEW_ROLE_PATHS = new Set([...])`
- **getPathsForRole** (lines 171–173): Add `if (role === 'new_role') return NEW_ROLE_PATHS`

**Reference**: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)

### Settings.tsx

- **ROLES** (line 121): Add `'new_role'` to the `UserRole[]` array
- **PAGE_ACCESS** (line 123): Add a `new_role` column to each row with `'yes'`, `'no'`, or `'yes limited'` as appropriate
- **Report-enabled users** (lines 8327–8337): If the role can be report-enabled (like subcontractor), add logic to show the checkbox for users with this role
- **Service type filtering** (if applicable): Add UI for `new_role_service_type_ids` when creating/editing users with this role

**Reference**: [src/pages/Settings.tsx](src/pages/Settings.tsx)

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

**Reference**: [supabase/migrations/20260212240000_allow_estimators_see_masters.sql](supabase/migrations/20260212240000_allow_estimators_see_masters.sql)

**RLS performance**: Use `(select auth.uid())` and `(select auth.jwt())` in policies so the planner can cache the result per query. See [optimize_workflow_templates_rls.sql](supabase/migrations/optimize_workflow_templates_rls.sql) and Supabase RLS performance docs.

---

## Special Relationships

### Adoption (master–role junction table)

If the role needs adoption (like Primary or Superintendent), create a junction table mirroring `master_primaries`:

**Reference**: [supabase/migrations/20260223100000_create_master_primaries.sql](supabase/migrations/20260223100000_create_master_primaries.sql), [supabase/migrations/20260520120001_create_master_superintendents.sql](supabase/migrations/20260520120001_create_master_superintendents.sql)

- Table: `master_new_roles(master_id, new_role_id)` with FKs to `users`
- RLS: Masters and devs can read/manage; new_role users can read who adopted them
- **Superintendent example**: `master_superintendents(master_id, superintendent_id)` — superintendents get adoption-based access to projects, workflows, jobs, bids; no People page; can assign people in Workflow

### Service type filtering

If the role should be restricted to specific service types (e.g., Plumbing only):

- Add column: `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS new_role_service_type_ids UUID[] DEFAULT NULL`
- **Reference**: [supabase/migrations/20260224000000_add_primary_service_type_ids.sql](supabase/migrations/20260224000000_add_primary_service_type_ids.sql)
- Update `create-user` Edge Function to accept and store `service_type_ids` when role is `new_role`
- Add Settings UI for editing this when creating/editing users

### Report-enabled users

For roles that get the Recent Reports section only when explicitly enabled (e.g., subcontractors):

- Table: `report_enabled_users(user_id)` — devs manage via Settings
- **Reference**: [src/pages/Settings.tsx](src/pages/Settings.tsx) lines 8327–8337 (Report-enabled users section)
- [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) lines 521–522, 530 — `isReportEnabledOnlyUser` and `showRecent` logic

---

## Copy-Paste Checklist

Use this when adding a new role:

- [ ] Migration: Add role to `user_role` enum + update COMMENT
- [ ] Regenerate types: `supabase gen types typescript --local > src/types/database.ts`
- [ ] Edge Function: Add role to `validRoles` in `create-user/index.ts`
- [ ] Layout.tsx: Add `NEW_ROLE_PATHS` and redirect logic
- [ ] Dashboard.tsx: Add `NEW_ROLE_PATHS` and `getPathsForRole` branch
- [ ] Settings.tsx: Add to `ROLES`, add `PAGE_ACCESS` column
- [ ] RLS: Update policies on bids, materials, reports, jobs ledger, users (see table categories above)
- [ ] Helper function: Create `is_new_role()` if needed
- [ ] Adoption table: Create `master_new_roles` if role uses adoption
- [ ] Service type filtering: Add `new_role_service_type_ids` to users + create-user + Settings UI if needed
- [ ] Report-enabled: Add to Settings Report-enabled section + Dashboard logic if needed
- [ ] Page components: Update role checks in Jobs, Bids, Materials, People, Checklist, Dashboard
- [ ] Test all 7 roles: dev, master, assistant, subcontractor, estimator, primary, superintendent (and new role)
