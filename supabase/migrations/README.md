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
