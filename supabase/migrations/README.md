# Database Migrations

This directory contains SQL migration files for setting up database tables and policies.

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of the migration file
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

Or to run a specific migration:

```bash
supabase migration up
```

## Migration Files

### `20260228160000_update_step_assigned_to_rpc.sql`
Creates an RPC to update step `assigned_to_name`, bypassing RLS to avoid statement timeout.

**What it does**:
- Creates `update_step_assigned_to(p_step_id, p_assigned_to_name)` SECURITY DEFINER function
- Performs access check then updates the step directly (no RLS evaluation)
- Fixes "canceling statement due to statement timeout" when assigning people to workflow steps

**When to run**: If you see "Failed to assign person: canceling statement due to statement timeout" or "Could not find the function public.update_step_assigned_to" in the Add person to [Stage] modal.

**How to run**: Supabase Dashboard → SQL Editor → paste migration contents → Run.

### `create_email_templates.sql`
Creates the `email_templates` table with:
- Table schema with all 11 template types
- RLS policies (owners only)
- Index for faster lookups

**Run this first** to fix the "Could not find the table 'public.email_templates'" error.

### `verify_projects_rls_for_assistants.sql`
Verifies and ensures projects RLS policies allow assistants to see all projects from masters who adopted them.

**What it does**:
- Drops all existing policies on `projects` table to avoid conflicts
- Recreates SELECT, INSERT, UPDATE, DELETE policies with adoption checks
- Ensures assistants can see all projects owned by masters who adopted them

**When to run**: If assistants cannot see projects from masters who adopted them.

### `fix_users_rls_for_project_masters.sql`
Fixes users table RLS to allow assistants to see master information without recursion errors.

**What it does**:
- Creates `master_adopted_current_user(master_user_id UUID)` SECURITY DEFINER function
- Adds RLS policy allowing users to see masters who have adopted them
- Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion

**When to run**: If you see "infinite recursion detected in policy for relation 'users'" errors or 406 errors when loading master information.

**Key function**: `public.master_adopted_current_user()` - Checks if a master has adopted the current user without triggering RLS recursion.

### `optimize_workflow_step_line_items_rls.sql`
Optimizes RLS policies for `workflow_step_line_items` table to prevent timeout errors.

**What it does**:
- Creates `can_access_project_via_step(step_id_param UUID)` SECURITY DEFINER function
- Replaces expensive EXISTS checks with optimized helper function
- Prevents statement timeout errors when loading line items

**When to run**: If you see "canceling statement due to statement timeout" errors when loading line items.

**Key function**: `public.can_access_project_via_step()` - Efficiently checks project access via step without triggering RLS recursion.

### `fix_project_workflow_step_actions_rls.sql`
Fixes RLS policies for `project_workflow_step_actions` table to allow authenticated users to record actions.

**What it does**:
- Creates `can_access_step_for_action(step_id_param UUID)` SECURITY DEFINER function
- Allows authenticated users to insert actions for steps they have access to
- Fixes 403 Forbidden and 500 Internal Server Error when recording workflow actions

**When to run**: If you see 403 or 500 errors when setting start times, completing stages, or performing other workflow actions.

**Key function**: `public.can_access_step_for_action()` - Efficiently checks step access for recording actions without triggering RLS recursion.

### RLS performance (workflow_templates)

#### `optimize_workflow_templates_rls.sql`

Optimizes RLS on `public.workflow_templates` so `auth.uid()` and `auth.jwt()` are evaluated once per query instead of per row.

**What it does**:
- Loops over all RLS policies on `public.workflow_templates`
- Replaces bare `auth.uid()` with `(select auth.uid())` and `auth.jwt()` with `(select auth.jwt())` in USING and WITH CHECK expressions
- Drops and recreates each affected policy with the same name and command
- Collapses any double-wrap so already-optimized policies are not altered incorrectly

**When to run**: When you see slow queries or warnings about RLS policies re-evaluating `current_setting()` or `auth.*()` for each row on `workflow_templates`.

**Reference**: [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — wrap JWT/auth functions in `(select ...)` so the planner can cache the result (initPlan) per query.

### Master-to-Master Sharing Migrations

**Date**: 2026-01-21

#### `create_master_shares.sql`
Creates the `master_shares` table for master-to-master sharing relationships.

**What it does**:
- Creates junction table tracking which masters share with which other masters
- Prevents self-sharing with CHECK constraint
- Sets up RLS policies for managing shares
- Creates indexes for performance

**When to run**: When implementing master-to-master sharing feature.

#### `update_*_rls_for_master_sharing.sql` (6 migration files)
Updates RLS policies to allow masters to access resources from masters who have shared with them.

**Migration files**:
- `update_customers_rls_for_master_sharing.sql`
- `update_projects_rls_for_master_sharing.sql`
- `update_project_workflows_rls_for_master_sharing.sql`
- `update_project_workflow_steps_rls_for_master_sharing.sql`
- `update_workflow_step_line_items_rls_for_master_sharing.sql`
- `update_workflow_projections_rls_for_master_sharing.sql`

**What they do**:
- Add `master_shares` checks to existing SELECT policies
- Shared masters receive assistant-level access (can see but not modify, cannot see private notes/financials)
- Follows same pattern as `master_assistants` adoption checks

**When to run**: After creating `master_shares` table, run all 6 RLS update migrations to enable sharing access.

### RLS Timeout Fix (Master Sharing)

If you see 500 errors like `canceling statement due to statement timeout` after enabling master sharing, run:

#### `optimize_rls_for_master_sharing.sql`

**What it does**:
- Adds optimized `SECURITY DEFINER` helper functions for access checks (including `master_shares`)
- Replaces the heaviest RLS policies (which use slow join-based `EXISTS` checks) with helper-function-based policies for:
  - `project_workflows`
  - `project_workflow_steps`
  - `workflow_step_line_items`

**When to run**: If workflow pages start returning statement timeout errors after applying the master sharing RLS migrations.

### Assistants – Materials access

#### `allow_assistants_access_materials.sql`

Allows assistants full access to Materials (same as masters): price book, templates, purchase orders, supply houses.

**What it does**:
- Updates RLS on `material_parts`, `material_part_prices`, `material_part_price_history`, `material_templates`, `material_template_items`, `purchase_orders`, `purchase_order_items`, `supply_houses`
- Drops "Devs and masters only" policies and creates "Devs, masters, and assistants" policies for SELECT, INSERT, UPDATE, DELETE (where applicable)

**When to run**: If an assistant gets **"new rows violates row-level security policy for table material_parts"** (or other materials tables) when adding a part or using Materials. Apply via **SQL Editor** (copy the file contents and run) or `supabase db push` if the project is linked.

### Estimator role and access

Run these when introducing the **estimator** role. Order: add role enum first, then materials, then bids, then customers (Bids-only).

#### `add_user_role_estimator.sql`

Adds the `estimator` value to the `user_role` enum so users can be assigned the estimator role.

**What it does**:
- `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'estimator'`
- Updates type comment to include estimator

**When to run**: Before any estimator RLS migrations. Required for `create-user` Edge Function to accept `role: 'estimator'`.

#### `allow_estimators_access_materials.sql`

Grants estimators the same access to Materials as assistants: price book, templates, purchase orders, supply houses.

**What it does**:
- Updates RLS on `material_parts`, `material_part_prices`, `material_part_price_history`, `material_templates`, `material_template_items`, `purchase_orders`, `purchase_order_items`, `supply_houses`
- Drops "Devs, masters, and assistants" policies and creates "Devs, masters, assistants, and estimators" policies for SELECT, INSERT, UPDATE, DELETE (where applicable)

**When to run**: When estimators should see and use the Materials page (same visibility as assistants for Materials).

#### `allow_estimators_access_bids.sql`

Grants estimators full access to Bids (same as assistants): bid board, counts, takeoffs, cover letter, submission & followup.

**What it does**:
- Updates RLS on `bids_gc_builders`, `bids`, `bids_count_rows`, `bids_submission_entries`
- Drops "Devs, masters, and assistants" policies and creates "Devs, masters, assistants, and estimators" policies for SELECT, INSERT, UPDATE, DELETE (where applicable)

**When to run**: When estimators should see and use the Bids page. Run after `add_user_role_estimator.sql`. Estimators still have no access to `/customers` or `/projects` (enforced by app redirect).

#### `add_bids_estimator_id.sql`

Adds an optional estimator user reference to each bid (who is assigned to the bid).

**What it does**:
- Adds `estimator_id` (UUID, FK → `users.id` ON DELETE SET NULL) to `public.bids`
- Creates index `idx_bids_estimator_id` for lookups

**When to run**: When the Bids UI needs to show/store which estimator is assigned to a bid. Run after `create_bids.sql` (and typically after `add_user_role_estimator.sql`).

### Bids tables

Core migrations for the Bids feature (run in order when setting up Bids):

- **`create_bids_gc_builders.sql`** – Legacy GC/Builder entities (name, address, contact_number, email, notes, created_by).
- **`create_bids.sql`** – Main bids table (drive_link, plans_link, gc_builder_id, project_name, address, bid_due_date, outcome, etc.).
- **`create_bids_count_rows.sql`** – Fixture/count rows per bid (bid_id, fixture, count, sequence_order).
- **`create_bids_submission_entries.sql`** – Submission/follow-up entries per bid (bid_id, contact_method, notes, occurred_at).
- **`add_bids_customer_id.sql`** – Links bids to `customers` (customer_id FK).
- **`add_bids_count_rows_page.sql`** – Plan page field on count rows (page).
- **`split_bids_project_name_and_address.sql`** – Separate project_name and address columns.
- **`add_bids_estimated_job_start_date.sql`** – Estimated job start date when outcome is won.
- **`add_bids_gc_contact.sql`** – Per-bid project contact (gc_contact_name, gc_contact_phone, gc_contact_email).
- **`add_bids_estimator_id.sql`** – Optional estimator assigned to bid.

After these, apply **`allow_assistants_access_bids.sql`** and/or **`allow_estimators_access_bids.sql`** and **`allow_estimators_select_customers.sql`** as needed for role access.

### Estimators – Customers access (Bids only)

#### `allow_estimators_select_customers.sql`

Allows estimators to see all customers (for the Bids GC/Builder dropdown and joined customer data) and to create customers from the Add Customer modal in Bids, but only when assigning a valid master as customer owner.

**What it does**:
- Drops the existing customers SELECT policy and recreates it with an additional condition: users with role `estimator` can SELECT all rows in `customers`
- Adds a new INSERT policy: users with role `estimator` can INSERT into `customers` only when `master_user_id` IS NOT NULL and references a user with role `master_technician` or `dev`
- No change to UPDATE or DELETE (estimators cannot edit or delete customers)

**When to run**: When enabling estimators to use the Bids page GC/Builder dropdown (see and select customers, or add new customers from "+ Add new customer" and assign them to a master). Estimators still have no access to the `/customers` or `/projects` pages (enforced by Layout redirect).

### Primary role and access

Run these when introducing the **primary** role. Order: add role enum first, then create adoption table, then RLS migrations. For a full step-by-step guide to adding any new role, see [ADDING_A_NEW_ROLE.md](../ADDING_A_NEW_ROLE.md).

#### `add_user_role_primary.sql`

Adds the `primary` value to the `user_role` enum so users can be assigned the primary role.

**What it does**:
- `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'primary'`
- Updates type comment to include primary

**When to run**: Before any primary RLS migrations. Required for `create-user` Edge Function to accept `role: 'primary'`.

#### `20260223100000_create_master_primaries.sql`

Creates the `master_primaries` junction table for master–primary adoption (masters adopt primaries to grant access).

**What it does**:
- Creates `master_primaries(master_id, primary_id)` with FKs to `users`
- RLS: Masters and devs can read/manage; primaries can read who adopted them

**When to run**: When primaries need adoption-based access (like assistants). Run after `add_user_role_primary.sql`.

#### Primary RLS migrations (run in dependency order)

- `20260221210001_primary_reports_access.sql` — Reports table and `list_reports_with_job_info`
- `20260221210002_primary_materials_access.sql` — Materials tables (parts, templates, POs, supply houses)
- `20260223100000_create_master_primaries.sql` — Adoption junction table
- `20260224000000_add_primary_service_type_ids.sql` — Service type filtering on users
- `20260224100000_primary_bids_bid_board_access.sql` — Bids Bid Board (initial)
- `20260224110000_primary_bids_adoption_access.sql` — Bids adoption-based access
- `20260224120000_primary_projects_adoption_access.sql` — Projects via adoption
- `20260224130000_allow_users_see_primaries.sql` — Users table visibility
- `20260224140000_primary_supply_houses_read.sql` — Supply houses
- `20260224150000_primary_assembly_book_read.sql` — Assembly book
- `20260225000000_primary_jobs_tally_parts.sql` — Jobs tally parts
- `20260231000023_primary_bids_see_adopted_master_bids.sql` — Bids from adopted masters
- `20260311000000_primary_bids_count_rows_access.sql` — Bids count rows
- `20260311000001_primary_cost_estimates_access.sql` — Cost estimates
- `20260311000002_primary_cost_estimate_labor_rows_access.sql` — Cost estimate labor rows
- `20260312000010_primary_price_book_access.sql` — Price book
- `20260312000001_primary_bid_count_row_custom_prices_access.sql` — Custom prices
- `20260312000002_primary_fixture_types_access.sql` — Fixture types
- `20260230000015_primaries_see_adopted_masters.sql` — Users: primaries see adopted masters
- `20260410130000_primaries_full_bids_access.sql` — Full Bids access
- `20260410140000_fix_bid_pricing_assignments_primary_rls.sql` — Bid pricing assignments

**When to run**: Apply in order when enabling the primary role. See [ADDING_A_NEW_ROLE.md](../ADDING_A_NEW_ROLE.md) for the complete guide.

### Superintendent role and access

Run these when introducing the **superintendent** role. Order: add role enum first, then create adoption table, then service type IDs, then RLS migrations. See [ADDING_A_NEW_ROLE.md](../ADDING_A_NEW_ROLE.md) for the complete guide.

#### Superintendent migrations (run in dependency order)

- `20260520120000_add_user_role_superintendent.sql` — Add superintendent to user_role enum
- `20260520120001_create_master_superintendents.sql` — Adoption junction table
- `20260520120002_add_superintendent_service_type_ids.sql` — Service type filtering on users
- `20260520120003_superintendent_project_and_adoption_access.sql` — Projects and can_access_project_row, master_adopted_current_user
- `20260520120004_workflow_rls_superintendent.sql` — Workflow tables (project_workflow_steps, workflow_step_line_items)
- `20260520120005_superintendent_jobs_and_reports_rls.sql` — Jobs reports RLS (ledger revoked in `20260623190000_revoke_superintendent_jobs_billing.sql`)
- `20260520120006_superintendent_people_rls.sql` — People table (for Workflow roster)
- `20260520120007_superintendent_bids_and_customers_rls.sql` — Bids tables and customers (SELECT + INSERT for Bids)
- `20260520120008_superintendent_materials_rls.sql` — Materials tables

**When to run**: Apply in order when enabling the superintendent role. Superintendents have adoption-based access via `master_superintendents`; no People page; Jobs tabs: Reports, Sub Sheet Ledger only (no Stages or Billing; revoked in `20260623190000`); Bids tabs: draft flow only (no Pricing, Cover Letter, Submission).

### Revert price book and bids.job_type

#### `revert_price_book_and_bids_job_type.sql`

Reverses previously applied price-book–related schema changes (e.g. if the price book feature was reverted in code but migrations had already been run).

**What it does**:
- Drops `public.bid_pricing_assignments` (if exists)
- Drops `public.price_book_entries` (if exists)
- Drops `public.price_book_versions` (if exists)
- Drops `public.bids.job_type` column (if exists)

**Order**: Drops in dependency order so foreign keys are respected. Uses `IF EXISTS` so the migration is safe if some objects were already removed.

**When to run**: When you want to remove the price book tables and `bids.job_type` from the database (e.g. after reverting the price book feature in the codebase).
