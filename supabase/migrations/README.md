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
