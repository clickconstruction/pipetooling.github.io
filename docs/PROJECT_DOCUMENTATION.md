# PipeTooling Project Documentation

> **New to this project?** Start with [AI_CONTEXT.md](./AI_CONTEXT.md) for a 30-second overview, then return here for deep technical details.

---
file: PROJECT_DOCUMENTATION.md
type: Technical Reference
purpose: Complete technical documentation covering architecture, database schema, and development patterns
audience: Developers, AI Agents, Technical Staff
last_updated: 2026-05-21
estimated_read_time: 45-60 minutes
difficulty: Advanced

key_sections:
  - name: "Database Schema"
    line: ~600
    anchor: "#database-schema"
    description: "Complete table definitions, relationships, and RLS policies"
  - name: "Authentication & Authorization" 
    line: ~1247
    anchor: "#authentication--authorization"
    description: "User roles, permissions, and access patterns"
  - name: "Database Functions"
    line: ~711
    anchor: "#database-functions"
    description: "Triggers, helper functions, and transaction functions"
  - name: "Key Features"
    line: ~1480
    anchor: "#key-features"
    description: "Feature-by-feature implementation details"
  - name: "Materials Management"
    line: ~763
    anchor: "#materials-management-tables"
    description: "Price book, templates, purchase orders"
  - name: "Bids Management"
    line: ~879
    anchor: "#bids-management-tables"
    description: "Bids tables and book systems"

quick_navigation:
  - "[Database Schema](#database-schema)"
  - "[User Roles](#user-roles)"
  - "[RLS Patterns](#row-level-security-rls-patterns)"
  - "[Common Patterns](#common-patterns)"
  - "[Known Issues](#known-issues--gotchas)"

related_docs:
  - "[AI_CONTEXT.md](./AI_CONTEXT.md) - Quick project overview"
  - "[BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids system details"
  - "[ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Role permissions"
  - "[EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) - API reference"
  - "[MIGRATIONS.md](./MIGRATIONS.md) - Schema changes"
  - "[TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - White screen, Supabase, sign-in; app crash / load investigation (runbooks + capture script)"
  - "[docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md](./runbooks/AGENT_APP_CRASH_INVESTIGATION.md) - AI agent playbook: find why the app crashed; Cursor rule [.cursor/rules/supabase-incident-triage.mdc](../.cursor/rules/supabase-incident-triage.mdc)"
  - "[docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md) - Supabase CLI + Dashboard logs workflow"
  - "[GLOSSARY.md](./GLOSSARY.md) - Term definitions"

prerequisites:
  - Basic understanding of PostgreSQL and RLS
  - Familiarity with React and TypeScript
  - Understanding of Supabase concepts

when_to_read:
  - Adding new database tables or modifying schema
  - Understanding RLS policy patterns
  - Implementing new features
  - Debugging database access issues
  - Learning project architecture
---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Layer Improvements](#database-layer-improvements)
5. [Database Schema](#database-schema)
6. [Authentication & Authorization](#authentication--authorization)
7. [Key Features](#key-features)
8. [File Structure](#file-structure)
9. [Development Workflow](#development-workflow)
10. [Deployment](#deployment)
11. [Common Patterns](#common-patterns)
12. [Known Issues & Gotchas](#known-issues--gotchas)
13. [Future Development Notes](#future-development-notes)

---

## Project Overview

**PipeTooling** is a web application designed for Master Plumbers to track plumbing work across multiple projects and crews. The key innovation is that it allows tracking work for crews that don't have direct access to the site.

### Core Use Case
A Master Plumber can:
- Manage customer information
- Create projects with custom workflow steps
- Assign work to crew members (even those without accounts)
- Track progress through workflow stages
- Inspect and approve/reject work
- Send bills upon approval
- Use templates to standardize workflows

### Key Differentiators
- **Plain text workflow steps**: Maximum flexibility - any step can be described in plain text
- **Crew tracking without accounts**: People can be assigned to work without having user accounts
- **Role-based access**: Owners, Masters, Assistants, and Subcontractors have different permissions
- **Template system**: Reusable workflow templates for common job types
- **Notification subscriptions**: Users can subscribe to stage notifications
- **Calendar view**: Visual calendar showing assigned work
- **Checklist**: Recurring checklist items (weekly by day(s), days-after-completion) with push notifications; items due today shown on Dashboard. **Header Task** (global add modal): **subcontractor**, **helpers**, and **estimator** match office paths where **[`headerTaskDispatchEstimatorEligible.ts`](../src/lib/headerTaskDispatchEstimatorEligible.ts)** allows; RLS uses **`can_define_task_style_checklist_items()`** plus ownership helpers (**`checklist_item_created_by_auth_user`**, **`checklist_instance_parent_item_created_by_auth_user`**) so field-created tasks save without policy recursion (**RECENT_FEATURES.md** v2.450). **Links**: Titles can include placeholders `[1]`, `[2]`, etc. mapped to URLs in `checklist_items.links`; Add/Edit modal has Links section; `ChecklistTitleWithLinks` renders clickable links. **Multi-assignee**: Add/Edit modal assigns to one or more users via checkboxes; junction tables `checklist_item_assignees` and `checklist_instance_assignees`. **Review tab** (roles with **Manage**): **Outstanding by person** (filters, table, reminders, expandable rows) appears first; below that, **`ChecklistReviewInboxes`** — **Task Dispatch** and **Estimator Inbox** cards (open then closed; hidden for assistants). **Roadmap** tab (tech tree, `?tab=roadmap`, `roadmap=<uuid>`): multiple named graphs in **`checklist_tech_tree_roadmaps`** with **`roadmap_id`** on **`checklist_tech_tree_groups`**; membership in **`checklist_tech_tree_roadmap_members`** (viewer/editor). Tasks and edges remain **`checklist_tech_tree_group_tasks`**, **`checklist_tech_tree_edges`**, **`checklist_tech_tree_task_assignees`** (`ChecklistTechTreeTab`, `ChecklistTechTreeRoadmapBar`, `ChecklistTechTreeRoadmapMembersModal`). v2.408 — roadmap picker, **New roadmap**, **Members** modal; URL sync; RLS scopes read/edit by roadmap (staff/primary bypass). v2.407 — when the graph has groups, a floating **canvas** icon row (`ChecklistTechTreeMapActionIconButtons`) provides **enter full screen**, **Organize**, **Add group**, **Edit tasks** (reorder for editors), **Show all** / **Collapse all**; an empty graph keeps **Add group** / **Edit tasks** as text in the roadmap toolbar; full-screen mode shows the same icons in the overlay header with an icon-only **exit** (`.checklistTechTreeExitFs` in `index.css`), not duplicated in the corner. **FWD (Forward)** (dev-only): Button/link on each task to forward it—edit title, assign to one user; creates new task and removes original. Manage tab shows comma-separated assignees; **Manage** also has a full-width **Search by title or assignee** (client-side filter on the loaded table; composes with **Filter by assignee**). **Scheduled reminders** (dev-only): Per-item reminder time (CST) and scope (today only / today+overdue); pg_cron invokes `send-scheduled-reminders` every 15 minutes to notify assignees with incomplete tasks. **Per-task mute**: Users who receive notifications for a task (notify_on_complete_user_id or creator when notify_creator_on_complete) can mute that specific task via inline bell-off icon on Checklist Today, Manage, Dashboard; Settings shows Muted Tasks list; `send-checklist-notification` skips when recipient has active mute for that checklist_item_id.

---

## Tech Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript 5.6.2** - Type safety
- **Vite 5.4.10** - Build tool and dev server
- **React Router DOM 6.28.0** - Client-side routing

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication (email/password)
  - Row Level Security (RLS) policies
  - Edge Functions (Deno runtime)
  - Real-time subscriptions (people_hours for Pay/Hours sync; clock_sessions for Hours tab pending; user_pinned_tabs for Dashboard pins; force-reload broadcast for Global Reload)

### Hosting
- **GitHub Pages** - Static site hosting
- **GitHub Actions** - CI/CD pipeline

### Key Dependencies
- `@supabase/supabase-js` - Supabase client library
- **`recharts`** - Charting for **Quickfill → Prospects** team activity (30-day **Marked + Updated** lines; see **`RECENT_FEATURES.md`** v2.382)

---

## Architecture

### High-Level Architecture
```
┌─────────────────┐
│  GitHub Pages   │  (Static hosting)
│   (Frontend)    │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Supabase      │
│  ┌───────────┐  │
│  │ PostgreSQL │  │  (Database with RLS)
│  └───────────┘  │
│  ┌───────────┐  │
│  │   Auth     │  │  (Email/password auth)
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Edge Fns  │  │  (Deno functions)
│  └───────────┘  │
└─────────────────┘
```

### Data Flow
1. User interacts with React frontend
2. Frontend calls Supabase client (`supabase.from()`, `supabase.auth`, `supabase.functions.invoke()`)
3. Supabase enforces RLS policies based on user role and relationships
4. Edge Functions handle privileged operations (user creation, deletion, impersonation)
5. Database stores all data with proper relationships and constraints

### Client-Side Routing
- All routes except `/sign-in`, `/sign-up`, `/reset-password`, and `/reset-password-confirm` are protected
- `ProtectedRoute` component checks authentication
- Role-based navigation hiding (subcontractors see limited nav)
- Client-side redirects enforce role restrictions

**Public Routes**:
- `/sign-in` - Sign in page
- `/dev-login` - Dev-only auth bypass (sign in as any user by email; only when `import.meta.env.DEV`; requires `VITE_DEV_LOGIN_SECRET` and Edge Function `DEV_LOGIN_SECRET`). See `EDGE_FUNCTIONS.md` → dev-login.
- `/sign-up` - Sign up page
- `/reset-password` - Request password reset
- `/reset-password-confirm` - Confirm password reset (from email link)

---

## Database Layer Improvements

**Last Updated**: 2026-02-04

The application underwent comprehensive database layer improvements to address systematic issues with data integrity, transaction handling, and maintainability. These enhancements make the system more robust and reliable.

### Automatic Timestamp Management

**Problem**: Manual `updated_at` sets throughout the codebase were error-prone and inconsistent.

**Solution**: Database triggers automatically set `updated_at` on all UPDATE operations.

**Implementation**:
- Created trigger function: `update_updated_at_column()`
- Applied BEFORE UPDATE triggers to 20 tables
- Removed 9 manual timestamp sets from frontend code

**Tables with automatic timestamps**:
- bids, customers, projects, material_parts, purchase_orders
- workflow_steps, material_templates, supply_houses, users
- And 11 more tables

**Usage**: No code changes needed - timestamps are set automatically:
```typescript
// This automatically sets updated_at
await supabase.from('customers').update({ name: 'New Name' }).eq('id', id)
```

---

### Cascading Updates

**Problem**: Changing a customer's master user didn't update their projects, causing data inconsistency.

**Solution**: Trigger automatically cascades master user changes to all related projects.

**Implementation**:
- Trigger: `cascade_customer_master_update` on customers table
- Function: `cascade_customer_master_to_projects()`
- Automatically updates `projects.master_user_id` when `customers.master_user_id` changes

**Example**:
```sql
-- Update customer master
UPDATE customers SET master_user_id = '<new_user>' WHERE id = '<customer_id>';
-- All projects for this customer automatically update their master_user_id
```

---

### Data Integrity Constraints

**Problem**: Invalid data could be inserted (negative prices, duplicate parts in templates, etc.).

**Solution**: Database-level constraints prevent invalid data at the source.

**Constraints Added**:

1. **Positive Quantities**
   ```sql
   ALTER TABLE purchase_order_items
   ADD CONSTRAINT purchase_order_items_quantity_positive
   CHECK (quantity > 0);
   ```

2. **Non-Negative Counts**
   ```sql
   ALTER TABLE bids_count_rows
   ADD CONSTRAINT bids_count_rows_count_non_negative
   CHECK (count >= 0);
   ```

3. **Non-Negative Prices**
   ```sql
   ALTER TABLE material_part_prices
   ADD CONSTRAINT material_part_prices_price_non_negative
   CHECK (price >= 0);
   ```

4. **Unique Parts per Template**
   ```sql
   CREATE UNIQUE INDEX material_template_items_unique_part_per_template
   ON material_template_items (template_id, part_id)
   WHERE item_type = 'part';
   ```

**Benefits**:
- Database rejects invalid data before it can corrupt the system
- Clear error messages guide developers
- Business rules enforced consistently

---

### Atomic Transaction Functions

**Problem**: Multi-step operations could fail partway through, leaving partial/corrupted data.

**Solution**: Database functions with automatic transaction rollback.

#### Available Functions

**1. `create_project_with_template`**

Creates a project with workflow and steps atomically.

```typescript
const { data, error } = await supabase.rpc('create_project_with_template', {
  p_name: 'New Project',
  p_customer_id: customerId,
  p_address: '123 Main St',
  p_master_user_id: userId,
  p_template_id: templateId,
  p_notes: 'Optional notes'
})
// Returns: { project_id, workflow_id, success }
```

**Benefits**:
- All-or-nothing: if template steps fail, project isn't created
- No orphaned projects or workflows
- Single network round-trip

---

**2. `duplicate_purchase_order`**

Duplicates a PO with all items as a draft atomically.

```typescript
const { data, error } = await supabase.rpc('duplicate_purchase_order', {
  p_source_po_id: sourcePoId,
  p_created_by: userId
})
// Returns: { new_po_id, items_copied, success }
```

**Benefits**:
- Guaranteed complete copy or nothing
- No partial duplicates if item copying fails
- Resets price confirmation status

---

**3. `copy_workflow_step`**

Copies a step and updates sequence numbers atomically.

```typescript
const { data, error } = await supabase.rpc('copy_workflow_step', {
  p_step_id: stepId,
  p_insert_after_sequence: 2  // Insert after position 2
})
// Returns: { new_step_id, new_sequence, success }
```

**Benefits**:
- No gaps in sequence order
- Atomic sequence number updates
- Consistent workflow state

---

**4. `create_takeoff_entry_with_items`**

Creates takeoff entry with multiple items atomically.

```typescript
const { data, error } = await supabase.rpc('create_takeoff_entry_with_items', {
  p_bid_id: bidId,
  p_page: 'A',
  p_entry_data: { item_type: 'pipe', item_size: '2"' },
  p_items: [
    { quantity: 10, location: 'Floor 1', notes: 'Main line' },
    { quantity: 5, location: 'Floor 2', notes: 'Branch' }
  ]
})
// Returns: { entry_id, items_created, success }
```

**Benefits**:
- Complete entry or nothing
- No orphaned entries without items

---

### Error Handling Utilities

**Location**: `src/utils/errorHandling.ts`

Provides utilities for resilient database operations:

**1. Retry Logic**
```typescript
import { withRetry, withSupabaseRetry } from '@/utils/errorHandling'

// Automatically retries on transient failures
const data = await withSupabaseRetry(
  () => supabase.from('users').select('*'),
  'fetch users',
  { maxRetries: 3, initialDelay: 1000 }
)
```

**2. Error Checking**
```typescript
import { checkSupabaseError } from '@/utils/errorHandling'

const result = await supabase.from('users').select('*')
checkSupabaseError(result, 'fetch users')  // Throws on error
// Safe to use result.data here
```

**3. Delete Chains**
```typescript
import { executeDeleteChain } from '@/utils/errorHandling'

await executeDeleteChain([
  {
    operation: () => supabase.from('items').delete().eq('parent_id', id),
    description: 'delete child items'
  },
  {
    operation: () => supabase.from('parent').delete().eq('id', id),
    description: 'delete parent'
  }
])
// All operations succeed or all fail with detailed error
```

**Features**:
- Exponential backoff retry strategy
- Detects transient vs. permanent errors
- Comprehensive error messages
- Custom `DatabaseError` class

---

### TypeScript Type Safety

**Location**: `src/types/database-functions.ts`

Type-safe interfaces for all database functions:

```typescript
import type { 
  CreateProjectWithTemplateParams,
  CreateProjectWithTemplateResult 
} from '@/types/database-functions'

// Full type safety and IntelliSense
const params: CreateProjectWithTemplateParams = {
  p_name: 'Project',
  p_customer_id: customerId,
  // ... TypeScript ensures all required fields
}

const result = await supabase.rpc<CreateProjectWithTemplateResult>(
  'create_project_with_template',
  params
)
// result.data is typed: { project_id, workflow_id, success }
```

---

### Migration Files

All improvements are captured in versioned migration files:

1. **`add_updated_at_triggers.sql`** (157 lines)
   - 20 automatic timestamp triggers
   - Reusable trigger function

2. **`add_cascading_customer_master_to_projects.sql`** (40 lines)
   - Customer-to-project master cascade
   - Automatic relationship maintenance

3. **`add_data_integrity_constraints.sql`** (77 lines)
   - 4 check constraints
   - 1 unique index
   - Data cleanup for duplicates

4. **`create_transaction_functions.sql`** (373 lines)
   - 4 atomic transaction functions
   - Full rollback support

---

### Testing

**Test Plan**: See `DATABASE_FIXES_TEST_PLAN.md` for comprehensive test scenarios.

**Verification Queries**:
```sql
-- Verify triggers exist
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE 'update_%_updated_at';

-- Verify constraints exist
SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname LIKE '%_positive' OR conname LIKE '%_non_negative';

-- Verify functions exist
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname IN (
  'create_project_with_template',
  'duplicate_purchase_order',
  'copy_workflow_step',
  'create_takeoff_entry_with_items'
);
```

---

### Backward Compatibility

**All changes are backward compatible**:
- Existing frontend code continues to work unchanged
- Database functions are optional enhancements
- Triggers and constraints are transparent to application code
- No breaking changes to APIs or behavior

**Gradual Adoption**:
- Continue using existing patterns
- Adopt database functions when refactoring
- Error handling utilities available for new code

---

## Database Schema

### Core Tables

#### `public.users`
- **Purpose**: User accounts with roles
- **Key Fields**:
  - `id` (uuid, PK) - Matches `auth.users.id`
  - `email` (text)
  - `name` (text, nullable)
  - `role` (enum: `'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'`)
  - `last_sign_in_at` (timestamptz, nullable)
- **Relationships**: Referenced by `customers.master_user_id`, `people.master_user_id`
- **RLS**: 
  - Users can read their own record
  - Masters/devs can see all assistants
  - Users can see masters who have adopted them (via `master_adopted_current_user()` function)
  - Viewing masters and their assistants can see sharing masters (via `can_see_sharing_master()` - enables "Created by [name]" for shared people)
  - Estimators can see master_technician and dev users (for Customer Owner dropdown in Add Customer modal)
  - Uses `SECURITY DEFINER` functions to avoid recursion in RLS policies
- **Helper Functions**:
  - `public.is_dev()` - Checks if current user has dev role (avoids recursion)
  - `public.master_adopted_current_user(master_user_id UUID)` - Checks if master adopted current user (avoids recursion)
  - `public.can_see_sharing_master(sharing_master_id UUID)` - True if current user (or their master) is viewing_master for that sharing_master
  - `public.is_estimator()` - Checks if current user has estimator role

#### `public.customers`
- **Purpose**: Customer information
- **Key Fields**:
  - `id` (uuid, PK)
  - `master_user_id` (uuid, FK → `users.id`) - **The master who owns this customer**
  - `name` (text)
  - `address` (text, nullable)
  - `contact_info` (jsonb, nullable) - Contains `{ phone: string, email: string }`
  - `date_met` (date, nullable) - Date when customer was first met
- **RLS**: 
  - SELECT: Users can see customers where `master_user_id` matches their ID, they're a dev/master, they're in `master_assistants`, they're in `master_shares`, or they're an **estimator** (estimators can see all customers, for Bids GC/Builder dropdown only; they cannot access `/customers` page)
  - INSERT: Estimators can insert customers only when `master_user_id` is set to a valid master (dev or master_technician); see migration `allow_estimators_select_customers.sql`
  - DELETE: Masters can delete their own customers (`master_user_id = auth.uid()`), devs can delete any customer
- **Special Features**: 
  - **Quick Fill**: Expandable block (collapsed by default) with a "Quick Fill" button next to the "New customer" title; when expanded, paste tab-separated data (name, address, email, phone, date) and click "Fill Fields" to auto-fill the form
  - **Master selection**: Assistants, devs, and **estimators** (when creating from Bids Add Customer modal) must select a master when creating customers
    - Assistants: Can only select from masters who adopted them
    - Devs: Can select from all masters in the system
    - Estimators: Can select from all masters when creating from the Add Customer modal in Bids (they cannot access `/customers` page)
    - Masters: Automatically assigned as customer owner
  - **Master can be updated**: When editing, masters and devs can change the customer owner
  - **Customer owner displayed** in customer list

#### `public.projects`
- **Purpose**: Project records
- **Key Fields**:
  - `id` (uuid, PK)
  - `customer_id` (uuid, FK → `customers.id`)
  - `master_user_id` (uuid, FK → `users.id`, nullable) - **The master who owns this project**
  - `name` (text)
  - `description` (text, nullable)
  - `status` (enum: `'active' | 'completed' | 'on_hold' | 'awaiting_start'`)
  - `housecallpro_number` (text, nullable) - External system reference (separate from `project_number`)
  - `project_number` (text, default `''`) - **Auto-assigned short identifier** (e.g. `'42'`). Filled on INSERT by the `projects_set_project_number` trigger from `projects_project_number_seq` when the column is null / blank; manual values are honored verbatim. Editable from Edit Project as the first form field (free-text, blank allowed, warn-but-allow duplicates). Displayed as **`Project #N`** via [`formatProjectNumberLabel`](../src/lib/projectNumberLabel.ts) on the Edit Project modal, Projects list rows, Workflow chip (`Project #N · {name}`), and Dashboard subscribed stages line (`Project #N: {name}`). See **GLOSSARY.md** → **Project Number**, migration **`20260519170221`**, **`RECENT_FEATURES.md`** **v2.557**.
  - `plans_link` (text, nullable) - URL to plans
  - `address` (text, nullable) - Project address (can differ from customer address)
  - `street_name` (text, nullable) - Street name (for future use)
  - `project_type` (text, nullable) - Project type (for future use)
- **Sequence + Trigger** (for `project_number`):
  - `projects_project_number_seq` — org-global sequence (single counter for the whole table; matches `bids_bid_number_seq` pattern)
  - `set_project_number_if_empty()` — plpgsql function called by `projects_set_project_number` BEFORE INSERT FOR EACH ROW; assigns `nextval(...)` only when `NEW.project_number IS NULL OR trim(...) = ''`
  - Sequence is pinned to `MAX(project_number) + 1` after backfill so the next insert never collides with a backfilled row
- **RLS**: 
  - SELECT: Users can see projects they own OR projects from masters who adopted them
    - Assistants can see **all projects** from masters who adopted them (not just assigned stages)
    - Migration: `supabase/archive/verify_projects_rls_for_assistants.sql` ensures correct policy
  - INSERT: Assistants, masters, and devs can create projects; project owner automatically matches customer owner
  - UPDATE: Assistants, masters, and devs can update projects they own or from masters who adopted them (project owner cannot be changed; `project_number` is editable per **v2.557**)
  - DELETE: Only devs and masters can delete projects
- **Special Features**: 
  - Address auto-fills from customer but can be overridden
  - Active stage displayed in project list
  - Project owner (master) displayed in project list and workflow page
  - **Projects page master/superintendents display**: Each project row shows Master badge (blue) and Superintendents with access (adoption + project assignment) as badges
  - **Projects page linked jobs**: Each project row shows linked jobs (from `jobs_ledger.project_id`); "Create Job" link opens New Job form with project pre-filled
  - **Project owner automatically matches customer owner** - cannot be changed or selected separately
  - Clicking project name navigates to workflow page (not edit page)
  - **Assigned Superintendents**: Devs, masters, and assistants can assign superintendents to projects via Workflow page; see `project_superintendents` table

#### `public.project_superintendents`
- **Purpose**: Junction table for project-level superintendent assignment
- **Key Fields**:
  - `project_id` (uuid, FK → `projects.id` ON DELETE CASCADE)
  - `superintendent_id` (uuid, FK → `users.id` ON DELETE CASCADE)
  - `created_at` (timestamptz, nullable)
- **Primary Key**: `(project_id, superintendent_id)`
- **RLS**: Devs, masters, assistants can SELECT/INSERT/DELETE for projects they can access (`can_access_project_row`); superintendents can SELECT rows where they are assigned
- **Purpose**: Superintendents gain access to specific projects via assignment (in addition to adoption via `master_superintendents`); UI on Workflow page

#### `public.project_workflows`
- **Purpose**: Workflow instances for projects
- **Key Fields**:
  - `id` (uuid, PK)
  - `project_id` (uuid, FK → `projects.id`)
  - `template_id` (uuid, FK → `workflow_templates.id`, nullable)
  - `name` (text)
  - `status` (enum: `'draft' | 'active' | 'completed'`)
- **RLS**: Users can see workflows for projects they have access to

#### `public.project_workflow_steps`
- **Purpose**: Individual steps in a workflow
- **Key Fields**:
  - `id` (uuid, PK)
  - `workflow_id` (uuid, FK → `project_workflows.id`)
  - `template_step_id` (uuid, FK → `workflow_template_steps.id`, nullable)
  - `sequence_order` (integer)
  - `name` (text) - **Plain text step description**
  - `step_type` (enum: `'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null`)
  - `assigned_to_name` (text, nullable) - **Person assigned (may not be a user)**
  - `inspector_name` (text, nullable)
  - `scheduled_start_date` (timestamptz, nullable)
  - `scheduled_end_date` (timestamptz, nullable)
  - `started_at` (timestamptz, nullable) - **Can be set via "Set Start" button with date/time picker**
  - `ended_at` (timestamptz, nullable)
  - `status` (enum: `'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved'`)
  - `percent_complete` (integer, nullable, **CHECK 0-100**) - **v2.559** Optional 0-100 progress estimate. NULL = "not tracked" (the default; the column is brand new so most rows will be NULL until users start filling it in). Editable from three surfaces: the **Forecast Specific gutter** (`%` column, edit gate **`dragEdit && canAlignStages(myRole)`**), the **Forecast Specific stage detail modal** header (`Complete [N] %`, edit gate `canEditExpectedDates(myRole)` — **v2.559**), and the **Workflow expanded stage card** (`Complete: [ N ] %` row, edit gate `canManageStages || s.assigned_to_name === currentUserName`). All surfaces parse input through shared `parsePercentCompleteInput.ts`, which maps **empty / non-numeric / explicit `0` / anything that clamps or rounds to 0 (e.g. negatives, `0.4`)** to `null` — typing `0` clears the cell (a 0% estimate is functionally identical to "not tracked"). **v2.562** — Forecast Specific gutter commits apply an optimistic **`pendingPercentByStageId`** overlay, call **`refreshStages()`** after a successful write, and blur focused gutter inputs when **Edit** toggles off so values are not lost on unmount. Migration `20260519214147_add_percent_complete_to_project_workflow_steps.sql`.
  - `inspection_notes` (text, nullable)
  - `rejection_reason` (text, nullable)
  - `assigned_skill` (text, nullable)
  - `notes` (text, nullable) - General notes for the step (visible to all users)
  - `private_notes` (text, nullable) - **Private notes visible only to owners and master_technicians**
  - `notify_assigned_when_started` (boolean, default false)
  - `notify_assigned_when_complete` (boolean, default false)
  - `notify_assigned_when_reopened` (boolean, default false)
  - `notify_next_assignee_when_complete_or_approved` (boolean, default true) - Cross-step notification
  - `notify_prior_assignee_when_rejected` (boolean, default true) - Cross-step notification
  - `approved_by` (text, nullable) - Name of person who approved
  - `approved_at` (timestamptz, nullable) - When approval occurred
- **RLS**: 
  - Owners and masters can see all steps
  - Assistants and subcontractors can only see steps where `assigned_to_name` matches their name
- **Special Features**:
  - Steps can be re-opened after completion/approval/rejection
  - Approval tracking shows who approved and when
  - Cross-step notifications notify adjacent step assignees
  - **Action Ledger** at bottom of each card shows complete history
  - **Private Notes** section for owners/masters only
  - **Line Items** within private notes for financial tracking

#### `public.workflow_templates`
- **Purpose**: Reusable workflow templates
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text)
  - `description` (text, nullable)
- **RLS**: Only owners can CRUD templates

#### `public.workflow_template_steps`
- **Purpose**: Steps within a template
- **Key Fields**:
  - `id` (uuid, PK)
  - `template_id` (uuid, FK → `workflow_templates.id`)
  - `sequence_order` (integer)
  - `name` (text)
- **RLS**: Only owners can CRUD template steps

#### `public.master_assistants`
- **Purpose**: Junction table tracking master-assistant adoption relationships
- **Key Fields**:
  - `master_id` (uuid, FK → `users.id`) - Master who adopted the assistant
  - `assistant_id` (uuid, FK → `users.id`) - Assistant who was adopted
  - `created_at` (timestamptz, nullable)
- **Unique Constraint**: `(master_id, assistant_id)` - Composite primary key
- **RLS**: 
  - Masters can manage their own adoptions (adopt/unadopt assistants)
  - Assistants can read who adopted them
  - Devs can read all adoptions
- **Purpose**: Enables assistants to access customers and projects from masters who have adopted them

#### `public.master_shares`
- **Purpose**: Junction table tracking master-to-master sharing relationships
- **Key Fields**:
  - `sharing_master_id` (uuid, FK → `users.id`) - Master who is sharing their jobs
  - `viewing_master_id` (uuid, FK → `users.id`) - Master who can view the shared jobs
  - `created_at` (timestamptz, nullable)
- **Unique Constraint**: `(sharing_master_id, viewing_master_id)` - Composite primary key
- **Check Constraint**: Prevents self-sharing (`sharing_master_id != viewing_master_id`)
- **RLS**: 
  - Masters can manage shares where they are the `sharing_master_id` (they control who sees their jobs)
  - Viewing masters can read shares where they are the `viewing_master_id` (to see who shared with them)
  - Devs can manage all shares
- **Purpose**: Enables masters to grant other masters assistant-level access to their customers and projects

#### `public.team_leader_assignments`
- **Purpose**: Directed **leader → member** links so a leader can view and approve/reject/revoke that member’s clock sessions from Dashboard **My Team** without full People Hours pay access. Any `users.role` may be leader or member; multiple leaders can share the same member (first approver wins; others see `approved_by`).
- **Key Fields**: `id` (uuid, PK); `leader_user_id`, `member_user_id` (FK → `users.id`, ON DELETE CASCADE); `created_at` (timestamptz); `created_by_user_id` (uuid, nullable, FK → `users`); `dashboard_hours_visibility` (`'full'` | `'strip_only'`, default `'full'`) — per link, what the **leader** sees on Dashboard: full **My Team** (roster, week totals, clock activity, pending approval) vs **clock strip only** (member still appears in **Currently clocked in** with **Today** hours; detailed My Team rows hidden). **Only dev** may change this column (DB trigger).
- **Constraints**: `UNIQUE (leader_user_id, member_user_id)`; `CHECK (leader_user_id <> member_user_id)`.
- **RLS**: Leaders and members can read rows they appear on; dev, master_technician, and assistant can manage all rows (**Settings → Team Hours Sharing** or **People → Teams**). **SQL:** `is_team_lead_for_member(leader, member)`, `can_manage_team_leader_assignments()`.
- **Usage**: **Settings → Dashboard & alerts → Team Hours Sharing** **or** **People → Teams** (`/people?tab=teams` — **[`PeopleTeamsTab.tsx`](../src/components/people/PeopleTeamsTab.tsx)**); dev, master_technician, and assistant manage rows (**Leader dashboard** column: **dev-only**); extends `clock_sessions` SELECT/UPDATE and `approve_clock_sessions` / `revoke_clock_sessions` for team-lead paths.

#### `public.team_leader_clock_notify_prefs`
- **Purpose**: Per **team leader assignment** (`team_leader_assignments.id`), whether that leader receives **Web Push** when the linked member clocks in or out (Edge Function `notify-team-lead-clock`, triggered by Database Webhook on `clock_sessions`).
- **Key Fields**: `id` (uuid, PK); `team_leader_assignment_id` (uuid, UNIQUE, FK → `team_leader_assignments(id)` ON DELETE CASCADE); `notify_enabled` (boolean, default false); `updated_at` (timestamptz).
- **RLS**: SELECT/INSERT/UPDATE/DELETE when the user is the assignment’s `leader_user_id` or `can_manage_team_leader_assignments()` (same pattern as assignment visibility).
- **Usage**: Dashboard → My Team → “Notify on clock in/out” per person you lead.

#### `public.people`
- **Purpose**: Roster of people (may or may not have user accounts)
- **Key Fields**:
  - `id` (uuid, PK)
  - `master_user_id` (uuid, FK → `users.id`)
  - `kind` (check constraint: includes `assistant`, `master_technician`, `sub`, `estimator`, `dev`, `primary`, `superintendent`)
  - `name` (text)
  - `email` (text, nullable)
  - `phone` (text, nullable)
  - `notes` (text, nullable)
  - `archived_at` (timestamptz, nullable) – when set, person is archived (hidden from roster); can be restored
- **RLS**: Users can only see/manage their own roster entries; devs can see all entries and can update/delete any people (via `20260211210000_allow_devs_update_delete_people.sql`); shared access via `master_shares` (viewing master and their assistants can see shared people)

#### `public.labels` / `public.people_labels` / `public.user_labels`
- **Purpose**: Master-scoped label catalog (`labels.master_user_id` → `users.id`) and many-to-many links from roster rows (`people_labels.person_id`, `people_labels.label_id` → `labels.id`) or from accounts (`user_labels.user_id`, `user_labels.label_id` → `labels.id`) when no roster row exists. Stable `slug` per master (`UNIQUE (master_user_id, slug)`) for filters (e.g. peer cohorts).
- **Integrity**: `BEFORE INSERT OR UPDATE` trigger on `people_labels` requires `people.master_user_id` = `labels.master_user_id`. `user_labels` uses `enforce_user_labels_scope_master`: tagged user must be in scope for the label’s master (self master/dev, assistant/superintendent adoption, or `people` email match under that master).
- **RLS**: `user_can_read_labels_for_master` / `user_can_write_labels_for_master`; read scope aligns with roster visibility (incl. `master_shares`, superintendent adoption); writes for dev, owning master, or assistant on that master. Junction rows use join + write helper.

#### `public.clock_sessions`
- **Purpose**: User clock-in/clock-out sessions. Approved sessions merge into `people_hours`. Used by Dashboard Clock In/Out button and People Hours tab pending section.
- **Key Fields**:
  - `id` (uuid, PK)
  - `user_id` (uuid, FK → `users.id` ON DELETE CASCADE)
  - `clocked_in_at` (timestamptz, required)
  - `clocked_out_at` (timestamptz, nullable) - null = session still open
  - `work_date` (date, required) - derived from clock-in date (local timezone)
  - `notes` (text, required) - "What are you working on?"
  - `job_ledger_id` (uuid, nullable, FK → `jobs_ledger.id` ON DELETE SET NULL) - Optional job for job-level hour reporting
  - `bid_id` (uuid, nullable, FK → `bids.id` ON DELETE SET NULL) - Optional bid for pre-job work; mutually exclusive with job_ledger_id
  - `clock_in_lat`, `clock_in_lng` (numeric, nullable) - GPS at clock-in
  - `clock_out_lat`, `clock_out_lng` (numeric, nullable) - GPS at clock-out
  - `approved_at` (timestamptz, nullable)
  - `approved_by` (uuid, FK → `users.id`, nullable)
  - `rejected_at` (timestamptz, nullable)
  - `rejected_by` (uuid, FK → `users.id`, nullable)
  - `revoked_at` (timestamptz, nullable)
  - `revoked_by` (uuid, FK → `users.id`, nullable)
  - `origin` (`user_punch` | `salary_schedule`) - salary rows are created/closed by `sync_salary_clock_sessions_for_day` / `sync_salary_clock_sessions_for_user_day` (not by the Clock In button)
  - `salary_segment_index` (smallint, nullable) — **`null`**: one **continuous**-template row for the day **or** canonical single block; **`1`** / **`2`**: **split**-template canonical morning/afternoon slots. Splitting the **continuous** parent in My Time can produce **additional** indexed **`salary_schedule`** rows (**`1..N`**) that are not the same as split-template semantics (see runbook).
- **RLS**: Users SELECT/INSERT/UPDATE own (for clock out); pay-access (approved masters, assistants) SELECT/UPDATE/DELETE all for approval and edit; team leads may SELECT (and UPDATE for reject) rows where `is_team_lead_for_member(auth.uid(), user_id)`. Inserts from the client must use `origin = 'user_punch'`.
- **Realtime**: Table in `supabase_realtime` publication for Hours tab live updates.
- **RPCs**: `approve_clock_sessions(p_session_ids UUID[])` merges hours into `people_hours` and marks sessions approved; callers without pay access may process a session only when `is_team_lead_for_member(auth.uid(), session.user_id)`. For sessions with `job_ledger_id`, also creates/updates `people_crew_jobs` (percentages by hours); for sessions with `bid_id`, also creates/updates `people_crew_bids`. `revoke_clock_sessions(p_session_ids UUID[])` subtracts hours from `people_hours` and moves sessions back to Pending; same team-lead authorization for non–pay-access callers; for sessions with `job_ledger_id`, recomputes or removes `people_crew_jobs`; for sessions with `bid_id`, recomputes or removes `people_crew_bids`.
- **Salary scheduling** (auto **`salary_schedule`** rows): Templates **`salary_work_schedule_templates`** (**`exclude_weekends`** default true) and optional **`salary_work_schedule_day_overrides`**; unpaid **`user_time_off`**, missing template, and excluded-weekend paths delete **non-final** `salary_schedule` rows for the day. Edge **`sync-salary-sessions`** calls **`sync_salary_clock_sessions_for_day`** for the **America/Chicago** calendar date; Settings save triggers **`sync_salary_clock_sessions_for_user_day`**. Core logic: **`salary_sync_one_user_clock_sessions`** — canonical **`salary_schedule`** opens/closes against template windows (**half-open overlap** semantics for **split** mode, **`20270421140000`**); **continuous** days with pending **indexed** `salary_schedule` segments (after splitting the continuous row in My Time) **skip** new NULL-index inserts (**`20270402100000`**), and **`20270516120000`** closes those **open** fragments at **`t_end`** once **`p_now ≥ t_end`**. Older **boundary** migration **`20260404050204`** described mass-closing all origins at block ends—current deployed body differs; authoritative detail in **[`SALARY_CLOCK_SESSIONS.md`](./SALARY_CLOCK_SESSIONS.md)**. Splitting an **indexed** salary slot produces **`user_punch`** children with **`salary_segment_index` null**. **Operator / AI runbook**: [`SALARY_CLOCK_SESSIONS.md`](./SALARY_CLOCK_SESSIONS.md). **Settings UI**: [`SalaryWorkScheduleSettings.tsx`](../src/components/SalaryWorkScheduleSettings.tsx), [`salaryScheduleEndTimeDisplay.ts`](../src/lib/salaryScheduleEndTimeDisplay.ts). Dashboard: **On shift** / **Off shift** — [`ClockInOutButton.tsx`](../src/components/ClockInOutButton.tsx). **`people_pay_config`** self-read for salaried Settings: policy **`Users can read own people pay config row`** (`20270331160000`).

#### `public.user_dashboard_goals`
- **Purpose**: Lines shown in the **My Roles Goals** full-screen gate after the user’s first clock-in of a calendar day when at least one row exists. Managed in Settings by dev, master_technician, or assistant for a chosen user.
- **Key Fields**: `id` (uuid, PK); `user_id` (uuid, FK → `users.id` ON DELETE CASCADE); `body` (text); `sort_order` (int); `created_at` (timestamptz).
- **RLS**: Users SELECT own rows; dev/master/assistant SELECT/INSERT/UPDATE/DELETE all rows (manage any user’s goals).

#### `public.user_daily_goals_ack`
- **Purpose**: Records that the user completed the daily goals checklist for a **calendar day** (`local_date`); prevents the gate from showing again until the next day.
- **Key Fields**: `user_id` (uuid, FK → `users.id` ON DELETE CASCADE); `local_date` (date); `completed_at` (timestamptz). **Primary Key**: `(user_id, local_date)`.
- **RLS**: Users SELECT/INSERT/UPDATE/DELETE own rows only.

#### `public.hours_reviewed`
- **Purpose**: Tracks which person-weeks have been marked as reviewed on **People → Hours** (**Review Hours**). Supports a weekly "hours reviewed" workflow for dev, pay-approved masters, and assistants.
- **Key Fields**:
  - `person_name` (text, NOT NULL)
  - `start_date` (date, NOT NULL) - week start
  - `end_date` (date, NOT NULL) - week end
  - `reviewed_by` (uuid, FK → auth.users.id)
  - `reviewed_at` (timestamptz)
- **Unique**: `(person_name, start_date)` - one review record per person per week
- **RLS**: Same as person_offsets (dev, pay-approved masters, assistants)
- **Usage**: Review Hours modal "Mark as reviewed" checkbox; Hours reviewed ledger on **People → Hours**

#### `public.checklist_items` (key fields)
- **Purpose**: Recurring checklist task definitions. See `checklist_item_assignees` for assignees.
- **Key Fields**: `title`, `links` (text[], URLs for placeholders [1], [2], etc. in title; links[0]=[1], links[1]=[2])

#### `public.checklist_item_assignees`
- **Purpose**: Junction table for checklist item assignees (many-to-many). Replaces legacy single `assigned_to_user_id` on checklist_items.
- **Key Fields**:
  - `checklist_item_id` (uuid, FK → checklist_items.id ON DELETE CASCADE)
  - `user_id` (uuid, FK → users.id ON DELETE CASCADE)
- **Primary Key**: `(checklist_item_id, user_id)`
- **RLS**: Dev/master/assistant/primary can manage; users can read rows where they are assigned (`user_id = auth.uid()`)

#### `public.checklist_instance_assignees`
- **Purpose**: Junction table for checklist instance assignees (many-to-many). Replaces legacy single `assigned_to_user_id` on checklist_instances.
- **Key Fields**:
  - `checklist_instance_id` (uuid, FK → checklist_instances.id ON DELETE CASCADE)
  - `user_id` (uuid, FK → users.id ON DELETE CASCADE)
- **Primary Key**: `(checklist_instance_id, user_id)`
- **RLS**: Dev/master/assistant/primary can manage; users can read rows where they are assigned
- **Usage**: Dashboard, Checklist, People fetch instances via `checklist_instance_assignees!inner(user_id)`; Today/History filter by assignee

#### `public.user_checklist_item_mute_preferences`
- **Purpose**: Per-task mute: user mutes completed-task push notifications for a specific checklist item
- **Key Fields**:
  - `user_id` (uuid, FK → auth.users.id ON DELETE CASCADE)
  - `checklist_item_id` (uuid, FK → checklist_items.id ON DELETE CASCADE)
  - `muted_until` (timestamptz, required) - when mute expires; far-future for "forever"
- **Primary Key**: `(user_id, checklist_item_id)`
- **RLS**: Users can SELECT/INSERT/UPDATE/DELETE own rows only
- **Usage**: ChecklistItemMuteModal, Settings Muted Tasks list, `send-checklist-notification` skips when recipient has active mute for that checklist_item_id

#### `public.dev_ignored_checklist_items`
- **Purpose**: Task types a dev has chosen to move to the Ignored section in Recently Completed Tasks
- **Key Fields**:
  - `dev_user_id` (uuid, FK → auth.users.id ON DELETE CASCADE)
  - `checklist_item_id` (uuid, FK → checklist_items.id ON DELETE CASCADE)
  - `ignored_at` (timestamptz, default now)
- **Primary Key**: `(dev_user_id, checklist_item_id)`
- **RLS**: Devs can SELECT/INSERT/DELETE own rows only
- **Usage**: Dashboard Recently Completed Tasks; main section excludes ignored types; collapsible Ignored section with Un-ignore

#### `public.dispatch_group_members`
- **Purpose**: Assistants who receive Task Dispatch push notifications and see the Dispatch inbox on Dashboard. Dev assigns membership in Settings.
- **Key Fields**: `user_id` (uuid, PK, FK → users ON DELETE CASCADE) — must be `users.role = assistant` (enforced by trigger)
- **RLS**: SELECT dev or own row (`user_id = auth.uid()`); INSERT/DELETE dev only

#### `public.dispatch_requests`
- **Purpose**: Task Dispatch messages (task text + optional links, same `[1]`/`[2]` placeholders as checklist). **Header** opens [`DispatchTaskModal.tsx`](../src/components/DispatchTaskModal.tsx) (**Send a task to Dispatch** / **What do you need?**). Optional block (no separate “Optional” intro line): **Reference Job or Bid** (full width) with bid **service type tag toggles** matching **Clock In** unified search (shared [`BidServiceTypeSearchToggles`](../src/components/BidServiceTypeSearchToggles.tsx) + [`buildClockBidsSearchParams`](../src/lib/clockBidsSearchParams.ts) for `search_bids_for_clock`); unified search result rows show the same **trade** pills on **jobs** and **bids** when **`service_type_name`** is returned (**`RECENT_FEATURES`** **v2.433**). Then **Attach this location** and **Links** + **[+ add]** in a two-column row; **URL** inputs render **full width** when links exist. **Send to Estimator Inbox** uses the same layout in [`EstimatorTaskModal.tsx`](../src/components/EstimatorTaskModal.tsx) (`estimator-modal-links-label`). Any authenticated user may create a dispatch request (`from_user_id = auth.uid()`). Dev and dispatch group members see open requests on Dashboard and may mark closed. See `RECENT_FEATURES.md` v2.370. **Inbox cards** on Dashboard, Quickfill, and Checklist Review use [`DispatchInboxSection.tsx`](../src/components/DispatchInboxSection.tsx) / [`EstimatorInboxSection.tsx`](../src/components/EstimatorInboxSection.tsx) with [`useNarrowViewport640`](../src/hooks/useNarrowViewport640.ts): at **≤640px** the title stacks above message stats; **closed** rows place **Dismiss** beside stats; muted **Expand for thread** (only when `note_count` > 0 from `dispatch_inbox_note_stats`) sits under **Dismiss** on narrow viewports (**`RECENT_FEATURES`** **v2.452**).
- **Key Fields**: `title`, `links` (text[], same `[1]`/`[2]` pattern as checklist_items), `status` (`open` | `closed`), `closed_at`, `closed_by_user_id`, `closed_note` (text, nullable — required when closing, enforced in app); optional `job_ledger_id` **or** `bid_id` (not both, FKs to `jobs_ledger` / `bids`); `reference_summary` (nullable text, client-set at send time, same “J… · …” / “B… · …” format as Clock In unified search — informational for inbox and push); **`pending_action`** (text, nullable — stable token for in-app action affordances; **`NULL`** for plain text tasks. Known values: **`link_job_pictures`** — Dashboard My Schedule photo icon → *Add Customer Pictures URL* button on inbox row → **`useJobFormModal().openEditJob(jobId, { jobPicturesLinkHighlight: true })`** scrolls/focuses/flashes the Customer Pictures input; saving a non-empty URL auto-closes any open `link_job_pictures` rows for that `job_ledger_id`. Partial index **`dispatch_requests_pending_action_open_job_idx`** on `(job_ledger_id, pending_action) WHERE pending_action IS NOT NULL AND status = 'open'` makes per-job dedupe a single-seek lookup. See **`RECENT_FEATURES.md`** **v2.556**, **`MIGRATIONS.md`** **`20260519171140_dispatch_requests_pending_action`**)
- **RLS**: SELECT if author, dev, or dispatch group member; INSERT authenticated as self; UPDATE dev or dispatch member (body columns protected from non-dev by trigger)

#### `public.dispatch_request_dismissals`
- **Purpose**: Per-user dismissals of closed dispatch requests. When a dispatch user dismisses a closed request, it is hidden from their inbox; other users still see it until they dismiss it.
- **Key Fields**: `user_id` (uuid, FK → auth.users ON DELETE CASCADE), `request_id` (uuid, FK → dispatch_requests ON DELETE CASCADE), `dismissed_at` (timestamptz, default now())
- **Primary Key**: `(user_id, request_id)`
- **RLS**: SELECT/INSERT own rows only (`user_id = auth.uid()`)

#### `public.dispatch_request_notes`
- **Purpose**: Chronological thread notes on `dispatch_requests` (Dashboard Dispatch inbox — expand row). Closing the request still uses `dispatch_requests.closed_*`; the UI shows that as the final block after note rows.
- **Key Fields**: `request_id` (uuid, FK → `dispatch_requests` ON DELETE CASCADE), `author_user_id` (uuid, FK → `users`), `body` (text, 1–2000 chars), `created_at` (timestamptz)
- **RLS**: SELECT if the user may read the parent request (author, dev, or dispatch group member); INSERT only when `author_user_id = auth.uid()` and user is dev or dispatch group member (same parent visibility in `WITH CHECK`)

#### `public.people_labor_jobs`
- **Purpose**: Labor jobs from Jobs page (Labor tab); displayed in Sub Sheet Ledger tab on Jobs
- **Key Fields**:
  - `id` (uuid, PK)
  - `master_user_id` (uuid, FK → `users.id` ON DELETE CASCADE)
  - `assigned_to_name` (text, required)
  - `address` (text, default '')
  - `job_number` (varchar(10), nullable)
  - `job_date` (date, nullable)
  - `labor_rate` (numeric(10,2), nullable)
  - `distance_miles` (numeric(6,2), nullable) - round-trip miles for drive cost; editable inline in Sub Sheet Ledger
  - `invoice_link` (text, nullable) - optional URL to subcontractor invoice document; set via **Link Invoice** in New/Edit Sub Labor modal
  - `created_at` (timestamptz)
- **RLS**: Dev, master, assistant, estimator can read/insert/update/delete own jobs; dev can manage any; shared access via `master_shares` for SELECT

#### `public.people_labor_job_items`
- **Purpose**: Fixture rows per labor job; labor hours = count × hrs_per_unit (or hrs_per_unit when is_fixed)
- **Key Fields**:
  - `id` (uuid, PK)
  - `job_id` (uuid, FK → `people_labor_jobs.id` ON DELETE CASCADE)
  - `fixture` (text, default '')
  - `count` (numeric(12,2), default 1)
  - `hrs_per_unit` (numeric(8,2), default 0)
  - `is_fixed` (boolean, default false) - when true, labor hours = hrs_per_unit
  - `labor_rate` (numeric(10,2), nullable) - Labor rate ($/hr) per line item; NULL falls back to job-level rate
  - `sequence_order` (integer, default 0)
- **RLS**: Follows job access (owner or dev or shared)

#### `public.step_subscriptions`
- **Purpose**: User subscriptions to step notifications
- **Key Fields**:
  - `id` (uuid, PK)
  - `step_id` (uuid, FK → `project_workflow_steps.id`)
  - `user_id` (uuid, FK → `users.id`)
  - `notify_when_started` (boolean, default false)
  - `notify_when_complete` (boolean, default false)
  - `notify_when_reopened` (boolean, default false)
- **Unique Constraint**: `(step_id, user_id)`
- **RLS**: Users can only manage their own subscriptions

#### `public.workflow_step_line_items`
- **Purpose**: Private line items for workflow stages (expenses/credits)
- **Key Fields**:
  - `id` (uuid, PK)
  - `step_id` (uuid, FK → `project_workflow_steps.id` ON DELETE CASCADE)
  - `link` (text, nullable) - Optional link to external resources (e.g., Google Sheets, supply house listings)
  - `item_date` (date, nullable) - Optional user-entered date (service/billing); Add/Edit Line Item + table column + clipboard import
  - `memo` (text, required) - Description of the line item
  - `amount` (numeric(10, 2), required) - **Supports negative numbers** for credits/refunds
  - `purchase_order_id` (uuid, FK → `purchase_orders.id` ON DELETE SET NULL, nullable) - Link to purchase order if added from Materials
  - `supply_house_invoice_id` (uuid, FK → `supply_house_invoices.id` ON DELETE SET NULL, nullable) - Link to supply house invoice if added from Materials
  - `sequence_order` (integer) - Order within the step
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: 
  - Devs, masters, and assistants (via master adoption) can read/write line items for projects they can access
  - Uses `can_access_project_via_step()` helper function to optimize performance and prevent timeout errors
  - UI only exposes line items to devs, masters, and assistants (not subcontractors)
- **Special Features**:
  - Aggregated in Ledger at top of workflow page
  - Amounts formatted with commas (e.g., `$1,234.56`)
  - Negative amounts displayed in red with parentheses
  - **Link field**: Optional URL field for external resources (Google Sheets, supply house listings)
    - Auto-formats URLs (adds https:// if missing)
    - Displayed as clickable link icon next to memo in both Ledger and Private Notes sections
    - Opens in new tab with security attributes (`target="_blank"`, `rel="noopener noreferrer"`)
  - **Purchase Order Integration**: Can be linked to finalized purchase orders from Materials system
    - Shows "View PO" button when linked to a purchase order
    - PO details displayed in modal when clicked
  - **Supply House Invoice Integration**: Can be linked to supply house invoices from Materials system
    - "Add Supply House Invoice" button when supply house invoices exist; modal with search by invoice #, supply house name, amount, date, PO #, paid/unpaid
    - Clicking a row adds line item with memo and amount from invoice; links via `supply_house_invoice_id`
    - "View Invoice" button on linked line items opens modal with invoice #, supply house, amount, link
  - Assistants can view Ledger table but cannot see financial totals
- **Migrations**: 
  - `supabase/archive/optimize_workflow_step_line_items_rls.sql` - RLS optimization
  - `supabase/archive/add_link_to_line_items.sql` - Added link field
  - `supabase/archive/add_purchase_order_to_line_items.sql` - Added purchase_order_id field
  - `supabase/migrations/20260321120001_add_supply_house_invoice_to_line_items.sql` - Added supply_house_invoice_id field
  - `supabase/archive/migrations-pre-baseline/20270329210000_workflow_step_line_items_item_date.sql` - Added optional `item_date`

#### `public.workflow_projections`
- **Purpose**: Project cost projections for entire workflow
- **Key Fields**:
  - `id` (uuid, PK)
  - `workflow_id` (uuid, FK → `project_workflows.id` ON DELETE CASCADE)
  - `stage_name` (text, required) - Stage name for the projection
  - `memo` (text, required) - Description
  - `amount` (numeric(10, 2), required) - **Supports negative numbers**
  - `sequence_order` (integer) - Order within the workflow
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Only owners and master_technicians can read/write
- **Special Features**:
  - Displayed above Ledger section
  - Amounts formatted with commas
  - Total calculation at bottom

#### `public.email_templates`
- **Purpose**: Customizable email templates for notifications
- **Key Fields**:
  - `id` (uuid, PK)
  - `template_type` (text, unique) - One of 11 template types
  - `subject` (text, required) - Email subject line
  - `body` (text, required) - Email body with variable support
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Only devs can read/write (uses `is_dev()` function)
- **Template Types**: See `EMAIL_TEMPLATES_SETUP.md` for complete list

#### `public.project_workflow_step_actions`
- **Purpose**: Action history ledger for workflow steps
- **Key Fields**:
  - `id` (uuid, PK)
  - `step_id` (uuid, FK → `project_workflow_steps.id`)
  - `action_type` (text) - e.g., 'started', 'completed', 'approved', 'rejected', 'reopened'
  - `performed_by` (text) - Name of person who performed the action
  - `performed_at` (timestamptz) - When the action occurred
  - `notes` (text, nullable) - Optional notes about the action
- **RLS**: 
  - Users can read actions for steps they have access to
  - Authenticated users can insert actions for steps they have access to
  - Uses `can_access_step_for_action()` helper function to optimize performance
- **Purpose**: Provides complete audit trail of all step state changes
- **Migration**: `supabase/archive/fix_project_workflow_step_actions_rls.sql`

### Database Functions

#### `public.handle_new_user()`
- **Trigger**: Fires on `auth.users` INSERT
- **Purpose**: Creates corresponding `public.users` record
- **Logic**: Checks `raw_user_meta_data.invited_role` (any of the 8 modern roles) to set initial role, defaults to `'helpers'`; `ON CONFLICT (id) DO NOTHING` so edge-function upserts can race it safely (migration `20260702160000_modernize_handle_new_user.sql`)

#### `public.sync_last_sign_in_at()`
- **Trigger**: `on_auth_user_signed_in` — fires on `auth.users` UPDATE OF `last_sign_in_at`
- **Purpose**: Copies `auth.users.last_sign_in_at` (ground truth for every login mechanism: password, magic link, invite acceptance, imitate) into `public.users.last_sign_in_at`, which the Settings "Last login" column displays (migration `20260703160000_sync_last_sign_in_from_auth.sql`)
- **History**: Replaces the dropped `touch_last_sign_in()` client RPC — SignIn fired it un-awaited microseconds before the post-login hard reload, so the request was aborted on page unload and the column stayed NULL for everyone

#### `public.is_dev()`
- **Returns**: `boolean`
- **Purpose**: Checks if current user has `'dev'` role
- **Usage**: Used in RLS policies to avoid recursion
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS

#### `public.master_adopted_current_user(master_user_id UUID)`
- **Returns**: `boolean`
- **Purpose**: Checks if the given master has adopted the current user
- **Usage**: Used in users table RLS policy to allow assistants to see masters who adopted them
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS and avoid recursion
- **Migration**: `supabase/archive/fix_users_rls_for_project_masters.sql`

#### `public.can_access_project_via_step(step_id_param UUID)`
- **Returns**: `boolean`
- **Purpose**: Checks if the current user can access a project via a workflow step
- **Usage**: Used in `workflow_step_line_items` RLS policies to optimize performance
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS and avoid recursion
- **Migration**: `supabase/archive/optimize_workflow_step_line_items_rls.sql`

#### `public.can_access_step_for_action(step_id_param UUID)`
- **Returns**: `boolean`
- **Purpose**: Checks if the current user can access a step for recording actions
- **Usage**: Used in `project_workflow_step_actions` RLS policies to optimize performance
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS and avoid recursion
- **Migration**: `supabase/archive/fix_project_workflow_step_actions_rls.sql`

#### `public.claim_dev_with_code(code text)`
- **Returns**: `boolean`
- **Purpose**: Deprecated. Replaced by claim-dev Edge Function (DEV_PROMOTION_CODE secret).
- **Usage**: Called from Settings page

#### `public.track_price_history()`
- **Trigger**: Fires on `material_part_prices` INSERT and UPDATE
- **Purpose**: Automatically logs price changes to `material_part_price_history` table
- **Logic**: 
  - Calculates `price_change_percent` from old and new prices
  - Handles INSERT (old_price is NULL) and UPDATE (old_price from OLD record) correctly
  - Records `changed_at` (current timestamp) and `changed_by` (current user)
- **Migration**: `supabase/archive/create_price_history_trigger.sql`

#### `public.get_supply_house_price_counts()`
- **Returns**: Table of `(supply_house_id uuid, name text, price_count integer)`
- **Purpose**: Returns price coverage statistics for all supply houses
- **Usage**: Used in Supply Houses modal statistics section on Materials page
- **Logic**:
  - LEFT JOIN to include supply houses with zero prices
  - Counts prices per supply house
  - Sorted by `price_count DESC` (most prices first)
- **Migration**: `supabase/archive/create_supply_house_stats_function.sql`
- **Example Result**:
```sql
supply_house_id | name              | price_count
----------------|-------------------|------------
uuid1           | Supply House A    | 450
uuid2           | Supply House B    | 320
uuid3           | Supply House C    | 0
```

#### `public.get_parts_ordered_by_price_count(ascending_order boolean, filter_service_type_id uuid DEFAULT NULL)`
- **Returns**: Table of `(part_id uuid, price_count bigint)`
- **Purpose**: Returns part IDs sorted by price count, optionally filtered by service type
- **Parameters**:
  - `ascending_order`: `true` for fewest prices first, `false` for most prices first
  - `filter_service_type_id`: Optional; when provided, only returns parts for that service type (Plumbing, Electrical, HVAC)
- **Usage**: Used for server-side sorting in Price Book (click "#" column header); respects selected service type
- **Logic**:
  - LEFT JOIN to include parts with zero prices
  - When `filter_service_type_id` is set, filters to that service type
  - Counts prices per part
  - Sorts by price_count according to parameter, then by name
  - Returns ordered table of part IDs and counts
- **Migrations**: `create_parts_with_price_count_function.sql`, `20260212170000_add_service_type_filter_to_parts_price_count.sql`
- **Frontend Integration**: Frontend fetches parts by ID in correct order for current page; passes `filter_service_type_id` from selected service type

### Service Types Table

#### `public.service_types`
- **Purpose**: Define trade types (Plumbing, Electrical, HVAC, etc.) for categorizing materials and bids
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required) - Service type name (e.g., "Plumbing")
  - `description` (text, nullable) - Optional description
  - `color` (text, nullable) - Hex color code for UI display
  - `sequence_order` (integer, required) - Display order (lower numbers first)
  - `ledger_job_prefix` (text, nullable) - Shown before **HCP** numbers in the app (e.g. `JP`). **Trimmed** in UI logic. **Null or blank** means use the legacy default **`J`**.
  - `ledger_bid_prefix` (text, nullable) - Shown before **bid #** in the app (e.g. `BP`). **Null or blank** means use the legacy default **`B`**.
  - `created_at`, `updated_at` (timestamptz)
- **Initial Data**:
  - Plumbing (sequence_order: 1)
  - Electrical (sequence_order: 2)
  - HVAC (sequence_order: 3)
- **Ledger display prefixes (jobs/bids)**:
  - **Migration**: [`20260430201832_service_types_ledger_display_prefixes.sql`](../supabase/migrations/20260430201832_service_types_ledger_display_prefixes.sql) adds columns and backfills **Plumbing** → `JP`/`BP`, **Electrical** → `JE`/`BE`, **HVAC** → `JH`/`BH`; other rows stay null (**`J`**/**`B`** in the client).
  - **Settings (dev)**: Service type add/edit modal — optional prefix fields with validation (trim, max length, uniqueness across rows).
  - **Client**: [`src/lib/ledgerDisplayPrefixes.ts`](../src/lib/ledgerDisplayPrefixes.ts) — `buildPrefixMap`, `resolveJobPrefix` / `resolveBidPrefix`, `formatLedgerJobLabel` / `formatLedgerBidLabel` (and related helpers used in Clock In, Jobs, Bids, Documents, My Time, push copy, etc.). Many flows load `service_type_id` with rows so labels match the trade.
  - **Search RPCs** (prefix-aware match from **`20260430201832`**): `search_jobs_ledger` and `search_bids_for_clock` return **`service_type_id`** and treat typed queries as **legacy `J`/`B` + digits** or **configured prefix + remainder** when matching `hcp_number` / `bid_number`. Follow-up **[`20260430205318_search_jobs_ledger_service_type_name.sql`](../supabase/migrations/20260430205318_search_jobs_ledger_service_type_name.sql)** adds **`service_type_name`** on **`search_jobs_ledger`** (JOIN **`service_types`**) for unified-search **trade** pills on job rows; **[`20270518120000_list_assigned_jobs_service_type_name.sql`](../supabase/archive/migrations-pre-baseline/20270518120000_list_assigned_jobs_service_type_name.sql)** adds **`service_type_name`** to **`list_assigned_jobs_for_dashboard`**. Client: **`serviceTypeTagForUnifiedRow`** / **`getBidServiceTypeTag`** in [`unifiedJobBidSearch.ts`](../src/utils/unifiedJobBidSearch.ts) (**`RECENT_FEATURES`** **v2.433**).
  - **Crew / detail RPCs**: [`20260430202750_crew_rpcs_service_type_id_for_ledger_prefixes.sql`](../supabase/migrations/20260430202750_crew_rpcs_service_type_id_for_ledger_prefixes.sql) adds `service_type_id` where needed; [`20260430203800_restore_pct_complete_on_jobs_ledger_detail_rpcs.sql`](../supabase/migrations/20260430203800_restore_pct_complete_on_jobs_ledger_detail_rpcs.sql) restores **`pct_complete`** on `get_jobs_ledger_by_ids*`, `get_jobs_ledger_by_hcp_numbers*`.
- **Estimates**: **Quote #** still uses the global **`E…`** pattern; trade-specific prefixes apply to **jobs ledger** and **bids** only unless extended later.
- **RLS**:
  - SELECT: All authenticated users
  - INSERT/UPDATE/DELETE: Dev role only
- **Relationships**:
  - Referenced by: `material_parts.service_type_id`
  - Referenced by: `material_templates.service_type_id`
  - Referenced by: `purchase_orders.service_type_id`
  - Referenced by: `bids.service_type_id`
  - Referenced by: `counts_fixture_groups.service_type_id`
- **Foreign Key Behavior**: ON DELETE RESTRICT (prevents deletion of service types in use)
- **Management**: Devs can add, edit, delete (if not in use), and reorder service types in Settings page

### Materials Management Tables

#### `public.supply_houses`
- **Purpose**: Supply house/vendor information
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `contact_name` (text, nullable)
  - `phone` (text, nullable)
  - `email` (text, nullable)
  - `address` (text, nullable)
  - `website_url` (text, nullable) - Order portal / vendor site; shown as **Open website** next to supply house dropdowns (Materials, Bids) and beside phone in the expanded Supply Houses row
  - `notes` (text, nullable)
  - `monthly_payment_day` (integer, nullable) - Day of month (1-31) when payment is typically due; used for Due column in supply house list
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Only devs and master_technicians can CRUD

#### `public.material_parts`
- **Purpose**: Parts catalog
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `manufacturer` (text, nullable)
  - `part_type_id` (uuid, FK → `part_types.id`, **nullable** as of v2.591) - Optional part category; a part may have no type
  - `link` (text, nullable) - Product/vendor URL
  - `notes` (text, nullable) - Can include SKU numbers
  - `service_type_id` (uuid, FK → `service_types.id`, required) - Trade category
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Only devs and master_technicians can CRUD
- **Filtering**: UI filters parts by selected service type

#### `public.material_part_prices`
- **Purpose**: Prices for parts by supply house
- **Key Fields**:
  - `id` (uuid, PK)
  - `part_id` (uuid, FK → `material_parts.id`)
  - `supply_house_id` (uuid, FK → `supply_houses.id`)
  - `price` (numeric(10, 2), required)
  - `effective_date` (date, nullable)
  - `created_at`, `updated_at` (timestamptz)
- **Unique Constraint**: `(part_id, supply_house_id)` - One price per part per supply house
- **RLS**: Only devs and master_technicians can CRUD
- **Trigger**: `track_price_history()` automatically logs changes

#### `public.material_part_price_history`
- **Purpose**: Historical price change tracking - permanent audit trail
- **Key Fields**:
  - `id` (uuid, PK)
  - `part_id` (uuid, FK → `material_parts.id`, nullable) - ON DELETE SET NULL (preserves history if part deleted)
  - `supply_house_id` (uuid, FK → `supply_houses.id`, nullable) - ON DELETE SET NULL (preserves history if supply house deleted)
  - `old_price` (numeric(10, 2), nullable) - NULL for new prices
  - `new_price` (numeric(10, 2), required)
  - `price_change_percent` (numeric(5, 2), nullable) - Calculated percentage change
  - `changed_at` (timestamptz, required)
  - `changed_by` (uuid, FK → `users.id`, nullable) - ON DELETE SET NULL (preserves history if user deleted)
  - `notes` (text, nullable) - Optional notes about the change
  - `created_at` (timestamptz)
- **RLS**: Only devs and master_technicians can read
- **Data Preservation**: Price history records are **never deleted** - all foreign keys use ON DELETE SET NULL to preserve audit trail even when parts, supply houses, or users are deleted

#### `public.material_templates`
- **Purpose**: Reusable material templates (can contain parts and/or nested templates)
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `description` (text, nullable)
  - `service_type_id` (uuid, FK → `service_types.id`, required) - Trade category
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Only devs and master_technicians can CRUD
- **Filtering**: UI filters templates by selected service type

#### `public.material_template_items`
- **Purpose**: Items within material templates (supports nested structure)
- **Key Fields**:
  - `id` (uuid, PK)
  - `template_id` (uuid, FK → `material_templates.id`)
  - `item_type` (enum: 'part' | 'template', required)
  - `part_id` (uuid, FK → `material_parts.id`, nullable) - Set if item_type is 'part'
  - `nested_template_id` (uuid, FK → `material_templates.id`, nullable) - Set if item_type is 'template'
  - `quantity` (integer, default 1)
  - `sequence_order` (integer, required)
  - `notes` (text, nullable)
  - `created_at`, `updated_at` (timestamptz)
- **Check Constraint**: Ensures either `part_id` or `nested_template_id` is set based on `item_type`
- **RLS**: Only devs and master_technicians can CRUD

#### `public.purchase_orders`
- **Purpose**: Purchase orders for materials
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `status` (enum: 'draft' | 'finalized', default 'draft')
  - `created_by` (uuid, FK → `users.id`, required)
  - `service_type_id` (uuid, FK → `service_types.id`, required) - Trade category
  - `finalized_at` (timestamptz, nullable) - Set when status changes to 'finalized'
  - `notes` (text, nullable) - Can be added to finalized POs (add-only)
  - `notes_added_by` (uuid, FK → `users.id`, nullable) - User who added notes to finalized PO
  - `notes_added_at` (timestamptz, nullable) - When notes were added
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: 
  - Devs and master_technicians can CRUD
  - Special policy allows updating notes fields on finalized POs (but only when notes is null - add-only)
- **Filtering**: UI filters purchase orders by selected service type
- **Special Features**:
  - Draft POs are editable, finalized POs are immutable (except notes can be added once)
  - Notes on finalized POs show user name and timestamp

#### `public.purchase_order_items`
- **Purpose**: Items within purchase orders
- **Key Fields**:
  - `id` (uuid, PK)
  - `purchase_order_id` (uuid, FK → `purchase_orders.id`)
  - `part_id` (uuid, FK → `material_parts.id`, required)
  - `quantity` (integer, required)
  - `selected_supply_house_id` (uuid, FK → `supply_houses.id`, nullable) - Supply house selected for this item
  - `price_at_time` (numeric(10, 2), required) - Price at time of PO creation/finalization
  - `sequence_order` (integer, required)
  - `notes` (text, nullable)
  - `price_confirmed_at` (timestamptz, nullable) - When assistant confirmed the price
  - `price_confirmed_by` (uuid, FK → `users.id`, nullable) - Assistant who confirmed the price
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: 
  - Devs and master_technicians can CRUD
  - Assistants can update `price_confirmed_at` and `price_confirmed_by` fields only

### Estimates (customer proposals, Approach A)

- **Purpose**: Lightweight quotes sent to customers: draft → **Send** (hashed public token + email) → customer opens **`/estimate/accept?t=…`** → **accept-estimate** Edge Function records name, consent, IP/UA (`customer_accepted`). Distinct from **`cost_estimates`** (bid takeoff pricing).
- **Table**: `public.estimates` — see migrations [`20260404212052_estimates_approach_a.sql`](../supabase/migrations/20260404212052_estimates_approach_a.sql) (Approach A), [`20260405003103_estimates_global_estimate_number.sql`](../supabase/migrations/20260405003103_estimates_global_estimate_number.sql) (global **`estimate_number`**), and [`20260405010252_estimate_customer_experience_defaults_snapshot.sql`](../supabase/migrations/20260405010252_estimate_customer_experience_defaults_snapshot.sql) (**`customer_experience_overrides`**, **`customer_experience_sent`**). **`estimate_customer_events`** ([`20260406024629_estimate_customer_events.sql`](../supabase/migrations/20260406024629_estimate_customer_events.sql), [`20260406025757_log_estimate_customer_event_rpc.sql`](../supabase/migrations/20260406025757_log_estimate_customer_event_rpc.sql), [`20260406033952_estimates_audit_customer_accepted_trigger.sql`](../supabase/migrations/20260406033952_estimates_audit_customer_accepted_trigger.sql), [`20260406034514_record_estimate_public_link_view_rpc.sql`](../supabase/migrations/20260406034514_record_estimate_public_link_view_rpc.sql), [`20260412184127_dedupe_record_estimate_public_link_view.sql`](../supabase/migrations/20260412184127_dedupe_record_estimate_public_link_view.sql)) is an append-only timeline of **public link views** and **accept submissions** (**`client_ip`** / **`user_agent`** per event when available; **`metadata`** holds e.g. **`had_signature`**, **`repeat_after_accepted`**). **Link views** are inserted by **`record_estimate_public_link_view`** (called from **`get-estimate-for-customer`** while **`sent`**). **First accept** events are inserted by trigger **`estimates_audit_customer_accepted_trigger`** on **`sent` → `customer_accepted`** (copies **`acceptor_ip`** / **`acceptor_user_agent`**). Repeat **`accept-estimate`** posts (**`alreadyAccepted`**) may append via **`log_estimate_customer_event`** from Edge. Staff **`SELECT`** uses the same visibility shape as **`estimates`**. **`job_ledger_id`** links to **`jobs_ledger`** after acceptance; [**`create_job_from_estimate`**](../supabase/migrations/20260405072854_estimate_create_job_rpc.sql) inserts the job and sets the link atomically (unique when non-null). Status enum **`estimate_status`**. Staff edit only while **`draft`**; **`sent`** / accept transitions use service role in Edge Functions.
- **`estimate_number`**: Monotonic global **Quote #** per row (`public.estimates_estimate_number_seq` on insert; trigger forbids changing the column after assignment). Gaps in the sequence are possible if draft rows are deleted. List and detail show **Quote #**; canonical staff URL is **`/estimates/{estimate_number}`**. Legacy **`/estimates/{uuid}`** still resolves; the app **`replace`**-navigates to the numeric path when opened by UUID.
- **RLS**: Staff roles aligned with bids/jobs (`user_can_access_estimate`, broad read for estimator/primary/dev/assistant/master like bids). No anon/customer PostgREST access.
- **Edge**: **`get-estimate-for-customer`** (GET), **`accept-estimate`** (POST), **`send-estimate-to-customer`** (JWT + Resend). Optional secret **`ESTIMATE_PUBLIC_ORIGIN`** for link base; else client sends **`public_origin`**. Response may include **`accept_url`** (e.g. when Resend is not configured or for staff copy-open after send).
- **UI**: [`Estimates.tsx`](../src/pages/Estimates.tsx) (list **Quote #** column; **`sent`** detail: **`h1`** with **`# {estimate_number}`** + title; **For** / **Acceptance page logo** / **Line items**; **`customer_accepted`** detail: **`#`** + status only (no duplicate title); frozen quote **card** ([`EstimateCustomerDocument.tsx`](../src/components/estimates/EstimateCustomerDocument.tsx) + optional [`EstimateCustomerAttachmentCard`](../src/components/estimates/EstimateCustomerAttachmentCard.tsx)) first, then customer/email (**Customer:** opens [`CustomerSnapshotModal`](../src/components/customers/CustomerSnapshotModal.tsx)), **Customer acceptance**, collapsible **Customer activity** (**`EstimateDetailCustomerActivitySection`** in [`Estimates.tsx`](../src/pages/Estimates.tsx): **`sent`** default expanded, **`customer_accepted`** default collapsed), **Job** block **centered** — **Create job from estimate** (primary blue) / link / **Unlink job** (modal; clears **`job_ledger_id` only**); **Customer activity** copy — **“Customer opened quote link”** / **“Customer accepted estimate”**, optional IP / **`(with signature)`**, datetime (refetch on **`window` `focus`** while **`sent`**); **`sent`**: **Copy customer link** / **Open customer link** under waiting copy; [`EstimateCustomerAcceptLinkButtons.tsx`](../src/components/estimates/EstimateCustomerAcceptLinkButtons.tsx) — when **`sent`**, omitted from the top of **Customer experience**; **Customer experience** collapsible **Email** / **Acceptance page** / **Thank you**; **draft** **Customize customer copy** under preview tabs; **Line item catalog** modal **Insert from catalog** / **Edit book**; public [`EstimateAccept.tsx`](../src/pages/EstimateAccept.tsx) (**`AbortController`** on initial load). Shared body + modal: [`EstimateAcceptBody.tsx`](../src/components/estimates/EstimateAcceptBody.tsx) — **Approve** modal omits **`accept_instructions`**; primary submit centered; [`EstimateTermsHeaderNotice.tsx`](../src/components/estimates/EstimateTermsHeaderNotice.tsx) — linked **Terms and Conditions.** only; **accepted** staff inline record: disclosure + disabled checked **`accept_checkbox_label`** before **Full name**. [`EstimateCustomerThankYou.tsx`](../src/components/estimates/EstimateCustomerThankYou.tsx) — centered thank-you + **`public/chick.png`**; **Valid through** / **`doc_*`** on document unchanged. Nav: Materials → **Estimates** → Bids (where applicable). See **RECENT_FEATURES** **v2.288**.
- **Mobile / narrow viewport (`≤640px`)**: **`estimatesPageShellCss`** on **`.estimates-page-modern`** (`width: 100%`, **`min-width: 0`**, **`max-width: min(1100px | 900px, 100%)`** via **`estimates-page-shell--list`** vs **`--detail`**, tighter padding **`@media (max-width: 640px)`**); list tables wrapped with **`estimateListTableScrollWrapStyle`** (**`overflow-x: auto`**, **`max-width: 100%`**); **`EstimateListCards`** (**`useNarrowViewport640`**) replaces **`EstimateListTable`** on Ledger / Stages at **`≤640px`** (cards keep thread expand + **`JobThreadNotesPanel`**); Customer experience **Email** HTML preview horizontal scroll + **`estimate-email-html-preview-root`** responsive **`img`**; expanded draft **`CustomerNotesTable`** in **`overflow-x: auto`**; preview shells **`max-width: min(640px, 100%)`**; **[`AcceptHeaderBrandPicker.tsx`](../src/components/estimates/AcceptHeaderBrandPicker.tsx)** **`max-width: min(900px, 100%)`**. See **RECENT_FEATURES** **v2.430**.
- **Customer copy**: Merge order: **`customer_experience_sent`** (frozen when estimate moves to **`sent`**) overrides live merges; else **`app_settings`** keys `estimate_*` (dev: [`Settings.tsx`](../src/pages/Settings.tsx) **Estimate customer experience defaults**) plus optional **`customer_experience_overrides`** on the row. Draft **Customize customer copy** groups fields into **Email**, **Acceptance page**, and **Thank you** under each respective preview tab (with **Acceptance** covering both **`doc_*`** quote-document strings and **`accept_*`** accept-form strings); each textarea **shows** merged defaults (builtins plus **`app_settings`**) until staff edits, and **`customer_experience_overrides`** persists only changed keys. Templates support **`{{accept_url}}`**, **`{{title}}`**, **`{{estimate_number}}`** in email subject/body. Shared logic: [`src/lib/estimateCustomerExperience.ts`](../src/lib/estimateCustomerExperience.ts) and [`supabase/functions/_shared/estimateCustomerExperience.ts`](../supabase/functions/_shared/estimateCustomerExperience.ts) (keep in sync). Builtin thank-you body and accept-page footer tagline match **v2.288**; **[`20260412190051_update_estimate_thank_you_body_default.sql`](../supabase/migrations/20260412190051_update_estimate_thank_you_body_default.sql)** and **[`20260412190601_update_estimate_accept_page_footer_tagline.sql`](../supabase/migrations/20260412190601_update_estimate_accept_page_footer_tagline.sql)** update **`app_settings`** on existing deploys. Public GET JSON includes **`customer_experience`** (no email fields) for the accept page; **`already_accepted`** **409** includes **`customer_experience`** for thank-you. Legacy **`estimateCustomerEmail.ts`** files are unused by the app; Edge sends **`resolveEstimateCustomerExperience`** output.
- **Customer on draft**: Staff pick a **`customers`** row via [`CustomerSearchCombobox`](../src/components/customers/CustomerSearchCombobox.tsx) (search shows CRM email and phone); **Edit customer** opens the global [`EditCustomerModal`](../src/components/EditCustomerModal.tsx) (same as Customers/Bids); optional **Create new customer** opens [`NewCustomerForm`](../src/components/NewCustomerForm.tsx). **`estimates.customer_id`** is saved on draft. Send uses **`contact_info.email`** when present; if the CRM record has no email, **Send to email (override)** supplies the address for the Edge function—**`customer_email`** on the row may then reflect that override (not the CRM field). Shared display helpers: [`customerContactDisplay.ts`](../src/lib/customerContactDisplay.ts).
- **Email when customer accepts (staff)**: Column **`accept_notify_user_ids`** (`uuid[]`, nullable; [**`20260430213314_estimates_accept_notify_user_ids.sql`**](../supabase/migrations/20260430213314_estimates_accept_notify_user_ids.sql)). After **`sent` → `customer_accepted`**, **`accept-estimate`** (Edge) emails each eligible **`users.email`** for ids in this array (**`estimate_accept_notify_filter_eligible_user_ids`**). **`NULL`**: never saved for this field—draft detail load in [`Estimates.tsx`](../src/pages/Estimates.tsx) initializes selection to **deduped current user + every `master_technician`** (falls back to self only if the query fails). **`[]`**: explicitly no staff recipients. **Draft UI**: **Notify me** (self) + **Also notify** ([`SearchableMultiSelect`](../src/components/SearchableMultiSelect.tsx); self omitted from the multi list); options ordered **Master technicians → Assistants → Superintendents → everyone else** with small section captions on labeled separators ([`SearchableSelectSeparatorListRow`](../src/components/SearchableSelect.tsx)). Saved **non-null** arrays load as stored. See **RECENT_FEATURES** **v2.434** and **`EDGE_FUNCTIONS.md`** **accept-estimate**.

### Documents page (`/documents`)

- **Purpose**: Cross-cutting **ledger** views for **Estimates**, **Bid proposals**, and **Jobs** (plus **Upload** placeholder) with shared **Docs | Title | Job | Customer | Status | Total** tables, client-side search, and quick links to edit flows.
- **Routing / tabs**: [`App.tsx`](../src/App.tsx) route **`documents`**; primary tab from **`?tab=`** — `search`, `estimates`, `bid-proposals`, `jobs`, `supply-invoices`, `upload` ([`documentsPageTab.ts`](../src/lib/documentsPageTab.ts)); legacy `ledger=` query supported. Dashboard pins: [`pinnedTabs.ts`](../src/lib/pinnedTabs.ts).
- **Estimates ledger**: Recent estimates (`draft`, `sent`, `declined`, `customer_accepted`); **Docs** opens **sent** / **customer_accepted** preview modals; **draft** rows show a soft **+** to set **`customer_attachment_url`** (same **Check link** / Save pattern as **Documents** add-link modal). Title links to **`/estimates/{estimate_number}`**.
- **Bid proposals ledger**: Bids with **`bids_count_rows`** for search; **Docs** — submission document + project **`drive_link`**; **+** when either link is missing (radio when both missing). Lost bids hidden unless the user is searching.
- **Jobs ledger**: **`jobs_ledger`** (recent rows); **Docs** opens **`google_drive_link`** (Customer Files); **+** sets that field; title links **`/jobs?edit=`**; status labels via [`jobsLedgerStatusPipeline.ts`](../src/lib/jobsLedgerStatusPipeline.ts). **Billed** **`jobs_ledger_invoices`** appear as indented child rows (second query by **`job_id`**); click opens **[`DocumentsJobBilledInvoiceModal`](../src/components/documents/DocumentsJobBilledInvoiceModal.tsx)** — **View bill** (Stripe / outside) plus **PipeTooling-layout** PDF preview.
- **Add-link modal**: [`DocumentsAddDriveLinkModal.tsx`](../src/components/documents/DocumentsAddDriveLinkModal.tsx); **Check link** uses [`checkGoogleDriveAttachmentUrl`](../src/lib/checkGoogleDriveAttachmentUrl.ts) (Edge **`check-estimate-attachment-url`**; Google Drive/Docs hosts only).
- **Layout**: No visible page title; visually hidden **`h1`**; tabs and full-width search sit tight under the app header ([`Documents.tsx`](../src/pages/Documents.tsx)).
- **Access**: Same route guards as other office pages — see [`layoutRouteAccess.ts`](../src/lib/layoutRouteAccess.ts) and nav in [`Layout.tsx`](../src/components/Layout.tsx) (Documents nav link for estimator, primary, dev, master, assistant; superintendents may open **`/documents`** via URL if allowed by **`SUPERINTENDENT_PATHS`**).

### Bids Management Tables

**See [BIDS_SYSTEM.md](./BIDS_SYSTEM.md) for complete Bids system documentation including all tabs, workflows, and features.**

#### `public.bids_gc_builders`
- **Purpose**: GC/Builder entities for bids (legacy; prefer linking bids to `customers` via `bids.customer_id`)
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `address` (text, nullable)
  - `contact_number` (text, nullable)
  - `email` (text, nullable)
  - `notes` (text, nullable)
  - `created_by` (uuid, FK → `users.id`, required)
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Devs and masters can CRUD; assistants have full access (see `allow_assistants_access_bids.sql`)
- **Migrations**: `create_bids_gc_builders.sql`, `allow_assistants_access_bids.sql`

#### `public.bids`
- **Purpose**: Main bids table (Bid Board)
- **Key Fields**:
  - `id` (uuid, PK)
  - `drive_link` (text, nullable) - Project folder link
  - `plans_link` (text, nullable) - Plans link from project folder
  - `gc_builder_id` (uuid, FK → `bids_gc_builders.id` ON DELETE SET NULL, nullable) - Legacy GC/Builder
  - `customer_id` (uuid, FK → `customers.id` ON DELETE SET NULL, nullable) - Customer (GC/Builder); same list as Customers page
  - `project_name` (text, nullable) - **Required in UI**
  - `bid_number` (text, nullable) - Short identifier (e.g. "456"); auto-generated for new bids; displayed as B456 in search and clock displays; editable only by dev/master/assistant
  - `address` (text, nullable)
  - `gc_contact_name` (text, nullable) - Project contact person for this bid
  - `gc_contact_phone` (text, nullable) - Project contact phone for this bid
  - `gc_contact_email` (text, nullable) - Project contact email for this bid
  - `bid_due_date` (date, nullable)
  - `bid_date_sent` (date, nullable)
  - `bid_date_sent_attested_at` (timestamptz, nullable), `bid_date_sent_attested_by` (uuid, FK → `users.id` ON DELETE SET NULL) — when/how bid “sent” was confirmed in the attestation modal
  - `bid_date_sent_ack_email_at` / `bid_date_sent_ack_email_by`, `bid_date_sent_ack_phone_at` / `bid_date_sent_ack_phone_by`, `bid_date_sent_ack_honesty_at` / `bid_date_sent_ack_honesty_by` — per-checkbox acknowledgment timestamps and users (FK → `users.id` ON DELETE SET NULL)
  - `submitted_to` (text, nullable) - Submitted to: name, phone, email (architect/engineer or via GC); used in RFI
  - `outcome` (text, nullable) - `'won' | 'lost' | 'started_or_complete'`
  - `loss_reason` (text, nullable) - Why bid was lost (when outcome is 'lost')
  - `bid_value` (numeric(14, 2), nullable)
  - `agreed_value` (numeric(14, 2), nullable)
  - `profit` (numeric(14, 2), nullable) - Projected maximum profit
  - `estimated_job_start_date` (date, nullable) - When outcome is won; shown in New/Edit modal and Won table
  - `distance_to_office` (numeric(10, 2), nullable) - Distance from office in miles (used for driving cost calculation)
  - `last_contact` (timestamptz, nullable)
  - `notes` (text, nullable)
  - `created_by` (uuid, FK → `users.id`, required)
  - `estimator_id` (uuid, FK → `users.id` ON DELETE SET NULL, nullable) - Estimator user assigned to this bid
  - `service_type_id` (uuid, FK → `service_types.id`, required) - Trade category
  - `selected_takeoff_book_version_id` (uuid, FK → `takeoff_book_versions.id` ON DELETE SET NULL, nullable) - Selected takeoff book version
  - `selected_labor_book_version_id` (uuid, FK → `labor_book_versions.id` ON DELETE SET NULL, nullable) - Selected labor book version
  - `selected_price_book_version_id` (uuid, FK → `price_book_versions.id` ON DELETE SET NULL, nullable) - Selected price book version
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Devs, masters, assistants, and estimators have full access (see `allow_assistants_access_bids.sql`, `allow_estimators_access_bids.sql`)
- **Filtering**: UI filters all bid tabs by selected service type
- **Special Features**: 
  - GC/Builder field uses `customers` table as primary source (searchable combobox)
  - Legacy `gc_builder_id` retained for backward compatibility
  - Clicking GC/Builder name opens modal with customer details and all bid statuses
  - "Save and start Counts" button in New Bid modal
- **Migrations**: `create_bids.sql`, `add_bids_customer_id.sql`, `split_bids_project_name_and_address.sql`, `add_bids_estimated_job_start_date.sql`, `add_bids_gc_contact.sql`, `add_bids_estimator_id.sql`, `add_bids_loss_reason.sql`, `add_bids_outcome_started_or_complete.sql`, `20260231000000_add_bids_submitted_to.sql`, `20260320120000_add_bid_number_to_bids.sql`, `20260320120002_bid_number_auto_generate.sql`, `20260320120004_prevent_estimator_primary_edit_bid_number.sql`, `20260327201115_bid_date_sent_attestation.sql`, `allow_assistants_access_bids.sql`, `allow_estimators_access_bids.sql`

#### `public.bids_count_rows`
- **Purpose**: Fixture and count rows per bid (Counts tab)
- **Key Fields**:
  - `id` (uuid, PK)
  - `bid_id` (uuid, FK → `bids.id` ON DELETE CASCADE, required)
  - `fixture_or_tiein` (text, required) - Fixture or tie-in name
  - `count` (integer, required, CHECK count >= 0) - Quantity
  - `plan_page` (text, nullable) - Plan page reference
  - `sequence_order` (integer, required, default 0)
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Access follows parent bid; devs, masters, assistants, estimators
- **Migrations**: `create_bids_count_rows.sql`, `add_bids_count_rows_page.sql`, `add_data_integrity_constraints.sql`, `allow_assistants_access_bids.sql`

#### `public.bids_submission_entries`
- **Purpose**: Submission and follow-up entries per bid (Submission & Followup tab)
- **Key Fields**:
  - `id` (uuid, PK)
  - `bid_id` (uuid, FK → `bids.id` ON DELETE CASCADE, required)
  - `contact_method` (text, nullable)
  - `notes` (text, nullable)
  - `occurred_at` (timestamptz, required, default now())
  - `created_at` (timestamptz)
- **RLS**: Access follows parent bid; devs, masters, assistants, estimators
- **Migrations**: `create_bids_submission_entries.sql`, `allow_assistants_access_bids.sql`

#### `public.cost_estimates`
- **Purpose**: Cost estimates for bids (Cost Estimate tab)
- **Key Fields**:
  - `id` (uuid, PK)
  - `bid_id` (uuid, FK → `bids.id` ON DELETE CASCADE, unique)
  - `labor_rate` (numeric(10,2), nullable) - Hourly labor rate
  - `driving_cost_rate` (numeric(10,2), default 0.70) - Rate per mile for driving
  - `hours_per_trip` (numeric(10,2), default 2.0) - Hours per trip for driving calculation
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Devs, masters, assistants, estimators have full access
- **Driving Cost Formula**: `(Total Man Hours / Hours Per Trip) × Rate Per Mile × Distance to Office`
- **Migrations**: `create_cost_estimates.sql`, `add_cost_estimate_driving_cost_fields.sql`

#### `public.cost_estimate_labor_rows`
- **Purpose**: Labor hours per fixture for cost estimates
- **Key Fields**:
  - `id` (uuid, PK)
  - `cost_estimate_id` (uuid, FK → `cost_estimates.id` ON DELETE CASCADE)
  - `fixture_name` (text, required)
  - `rough_in_hrs` (numeric(10,2), default 0)
  - `top_out_hrs` (numeric(10,2), default 0)
  - `trim_set_hrs` (numeric(10,2), default 0)
  - `sequence_order` (integer)
  - `created_at` (timestamptz)
- **RLS**: Follows parent cost_estimate access
- **Migrations**: `create_cost_estimate_labor_rows.sql`

#### Takeoff Book Tables

**Purpose**: Standardized mappings from fixture names to material templates and stages

##### `public.takeoff_book_versions`
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `created_at` (timestamptz)
- **RLS**: dev, master_technician, assistant, estimator (full CRUD)
- **Migrations**: `create_takeoff_book_versions.sql`

##### `public.takeoff_book_entries`
- **Key Fields**:
  - `id` (uuid, PK)
  - `version_id` (uuid, FK → `takeoff_book_versions.id` ON DELETE CASCADE)
  - `fixture_name` (text, required)
  - `alias_names` (text[], nullable) - Array of alternative names for case-insensitive matching
  - `sequence_order` (integer)
  - `created_at` (timestamptz)
  - **UNIQUE** `(version_id, fixture_name)`
- **RLS**: dev, master_technician, assistant, estimator (full CRUD)
- **Migrations**: `create_takeoff_book_entries.sql`, `add_takeoff_book_entries_alias_names.sql`

##### `public.takeoff_book_entry_items`
- **Purpose**: Multiple (Template, Stage) pairs per takeoff entry
- **Key Fields**:
  - `id` (uuid, PK)
  - `entry_id` (uuid, FK → `takeoff_book_entries.id` ON DELETE CASCADE)
  - `template_id` (uuid, FK → `material_templates.id` ON DELETE CASCADE)
  - `stage` (text, required) - 'Rough In', 'Top Out', 'Trim Set'
  - `created_at` (timestamptz)
- **RLS**: dev, master_technician, assistant, estimator (full CRUD)
- **Migrations**: `add_takeoff_book_entry_items.sql`

#### Labor Book Tables

**Purpose**: Standardized labor hours for fixtures across plumbing stages

##### `public.labor_book_versions`
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `created_at` (timestamptz)
- **RLS**: dev, master_technician, assistant, estimator (full CRUD)
- **Migrations**: `create_labor_book_versions_and_entries.sql`

##### `public.labor_book_entries`
- **Key Fields**:
  - `id` (uuid, PK)
  - `version_id` (uuid, FK → `labor_book_versions.id` ON DELETE CASCADE)
  - `fixture_type_id` (uuid, FK → `fixture_types.id` ON DELETE CASCADE)
  - `alias_names` (text[], nullable) - Array of alternative names for matching
  - `rough_in_hrs` (numeric(10,2), required)
  - `top_out_hrs` (numeric(10,2), required)
  - `trim_set_hrs` (numeric(10,2), required)
  - `sequence_order` (integer)
  - `created_at` (timestamptz)
  - **UNIQUE** `(version_id, fixture_type_id)`
- **RLS**: dev, master_technician, assistant, estimator (full CRUD)
- **Entry Creation**: Input field with autocomplete; auto-creates fixture types if they don't exist
- **Migrations**: `create_labor_book_versions_and_entries.sql`, `add_labor_book_entries_alias_names.sql`

#### Price Book Tables

**Purpose**: Standardized pricing for fixtures across plumbing stages

##### `public.price_book_versions`
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, **unique**, required) - Unique constraint ensures no duplicate version names
  - `created_at` (timestamptz)
- **RLS**: dev, master_technician, assistant, estimator (full CRUD)
- **Migrations**: `create_price_book_versions_and_entries.sql`, `add_unique_constraint_to_price_book_versions.sql`

##### `public.price_book_entries`
- **Key Fields**:
  - `id` (uuid, PK)
  - `version_id` (uuid, FK → `price_book_versions.id` ON DELETE CASCADE)
  - `fixture_type_id` (uuid, FK → `fixture_types.id` ON DELETE CASCADE)
  - `rough_in_price` (numeric(10,2), required)
  - `top_out_price` (numeric(10,2), required)
  - `trim_set_price` (numeric(10,2), required)
  - `total_price` (numeric(10,2), required)
  - `sequence_order` (integer)
  - `created_at` (timestamptz)
  - **UNIQUE** `(version_id, fixture_type_id)`
- **RLS**: dev, master_technician, assistant, estimator (full CRUD)
- **Entry Creation**: Input field with autocomplete; auto-creates fixture types if they don't exist
- **Migrations**: `create_price_book_versions_and_entries.sql`

##### `public.bid_pricing_assignments`
- **Purpose**: Persist fixture-to-price-book-entry assignments for margin analysis
- **Key Fields**:
  - `id` (uuid, PK)
  - `bid_id` (uuid, FK → `bids.id` ON DELETE CASCADE)
  - `count_row_id` (uuid, FK → `bids_count_rows.id` ON DELETE CASCADE)
  - `price_book_entry_id` (uuid, FK → `price_book_entries.id` ON DELETE CASCADE)
  - `price_book_version_id` (uuid, FK → `price_book_versions.id` ON DELETE CASCADE)
  - `is_fixed_price` (boolean, default: false) - When true, revenue = price (ignores count)
  - `created_at` (timestamptz)
  - **UNIQUE** `(bid_id, count_row_id)`
- **RLS**: Access controlled via bid access policies
- **Fixed Price Feature**: Allows flat-rate pricing without count multiplication (useful for permits, delivery fees)
- **Migrations**: `create_bid_pricing_assignments.sql`, `add_fixed_price_to_pricing_assignments.sql`

##### `public.counts_fixture_groups`
- **Purpose**: Configurable quick-select groups for adding count rows in Bids (Counts tab)
- **Key Fields**:
  - `id` (uuid, PK)
  - `service_type_id` (uuid, FK → `service_types.id` ON DELETE CASCADE)
  - `label` (text, required) - Group label (e.g., "Bathrooms", "Kitchen")
  - `sequence_order` (integer)
  - `created_at` (timestamptz)
- **RLS**: All authenticated users can read; only devs can insert/update/delete
- **Migrations**: `create_counts_fixture_groups.sql`
- **Usage**: Managed in Settings → Counts Quick-adds; used by NewCountRow in Bids to populate fixture quick-add buttons per service type

##### `public.counts_fixture_group_items`
- **Purpose**: Individual fixtures within a quick-add group
- **Key Fields**:
  - `id` (uuid, PK)
  - `group_id` (uuid, FK → `counts_fixture_groups.id` ON DELETE CASCADE)
  - `name` (text, required) - Fixture name (e.g., "1/2 Bath", "Kitchen Sink")
  - `sequence_order` (integer)
  - `created_at` (timestamptz)
- **RLS**: All authenticated users can read; only devs can insert/update/delete
- **Migrations**: `create_counts_fixture_groups.sql`

### Foreign Key Relationships
```
users (id)
  ├── customers.master_user_id
  ├── people.master_user_id
  ├── projects.master_user_id
  ├── master_assistants.master_id
  ├── master_assistants.assistant_id
  ├── master_shares.sharing_master_id
  └── master_shares.viewing_master_id

customers (id)
  ├── projects.customer_id
  └── bids.customer_id

projects (id)
  ├── project_workflows.project_id
  ├── project_superintendents.project_id
  └── jobs_ledger.project_id

project_workflows (id)
  └── project_workflow_steps.workflow_id

workflow_templates (id)
  ├── project_workflows.template_id
  └── workflow_template_steps.template_id

workflow_template_steps (id)
  └── project_workflow_steps.template_step_id

users (id)
  └── step_subscriptions.user_id

project_workflow_steps (id)
  ├── step_subscriptions.step_id
  ├── project_workflow_step_actions.step_id
  └── workflow_step_line_items.step_id

project_workflows (id)
  └── workflow_projections.workflow_id

users (id)
  ├── purchase_orders.created_by
  ├── purchase_orders.notes_added_by
  └── material_part_price_history.changed_by

supply_houses (id)
  ├── material_part_prices.supply_house_id
  └── material_part_price_history.supply_house_id

material_parts (id)
  ├── material_part_prices.part_id
  ├── material_part_price_history.part_id
  ├── material_template_items.part_id
  └── purchase_order_items.part_id

material_templates (id)
  ├── material_template_items.template_id
  └── material_template_items.nested_template_id

purchase_orders (id)
  ├── purchase_order_items.purchase_order_id
  └── workflow_step_line_items.purchase_order_id (ON DELETE SET NULL)

bids_gc_builders (id)
  └── bids.gc_builder_id (ON DELETE SET NULL)

users (id)
  ├── bids_gc_builders.created_by
  ├── bids.created_by
  └── bids.estimator_id (ON DELETE SET NULL)

takeoff_book_versions (id)
  ├── takeoff_book_entries.version_id (ON DELETE CASCADE)
  └── bids.selected_takeoff_book_version_id (ON DELETE SET NULL)

takeoff_book_entries (id)
  └── takeoff_book_entry_items.entry_id (ON DELETE CASCADE)

material_templates (id)
  └── takeoff_book_entry_items.template_id (ON DELETE CASCADE)

labor_book_versions (id)
  ├── labor_book_entries.version_id (ON DELETE CASCADE)
  └── bids.selected_labor_book_version_id (ON DELETE SET NULL)

price_book_versions (id)
  ├── price_book_entries.version_id (ON DELETE CASCADE)
  └── bids.selected_price_book_version_id (ON DELETE SET NULL)

bids (id)
  ├── bids_count_rows.bid_id (ON DELETE CASCADE)
  ├── bids_submission_entries.bid_id (ON DELETE CASCADE)
  ├── cost_estimates.bid_id (ON DELETE CASCADE)
  └── bid_pricing_assignments.bid_id (ON DELETE CASCADE)

cost_estimates (id)
  └── cost_estimate_labor_rows.cost_estimate_id (ON DELETE CASCADE)

bids_count_rows (id)
  └── bid_pricing_assignments.count_row_id (ON DELETE CASCADE)

price_book_entries (id)
  └── bid_pricing_assignments.price_book_entry_id (ON DELETE CASCADE)

service_types (id)
  └── counts_fixture_groups.service_type_id (ON DELETE CASCADE)

counts_fixture_groups (id)
  └── counts_fixture_group_items.group_id (ON DELETE CASCADE)
```

**Important**: When deleting, respect foreign key order:
1. `step_subscriptions` (references steps)
2. `project_workflow_step_actions` (references steps)
3. `workflow_step_line_items` (references steps)
4. `purchase_order_items` (references purchase_orders and parts)
5. `material_template_items` (references templates and parts)
6. `material_part_price_history` (references parts and supply_houses)
7. `material_part_prices` (references parts and supply_houses)
8. `project_workflow_steps` (references workflows)
9. `project_workflows` (references projects)
10. `purchase_orders` (references users)
11. `material_templates` (no dependencies)
12. `material_parts` (no dependencies)
13. `supply_houses` (no dependencies)
14. `counts_fixture_group_items` (references counts_fixture_groups)
15. `counts_fixture_groups` (references service_types)
16. `bids_count_rows` (references bids)
17. `bids_submission_entries` (references bids)
18. `bids` (references customers, users, bids_gc_builders)
19. `bids_gc_builders` (references users)
20. `projects` (references customers)
21. `customers` (references users)

---

## Authentication & Authorization

### Authentication Flow
1. User signs up or signs in via `SignIn.tsx` / `SignUp.tsx`
2. Supabase Auth handles email/password authentication
3. `handle_new_user()` trigger creates `public.users` record
4. `useAuth()` hook provides current user state
5. `ProtectedRoute` redirects unauthenticated users to `/sign-in`

### Password Management
- **Password Reset (Forgot Password)**:
  - Available on sign-in page via "Forgot password?" link
  - Route: `/reset-password` - Request password reset email
  - Route: `/reset-password-confirm` - Set new password after clicking email link
  - Uses `supabase.auth.resetPasswordForEmail()` to send reset email
  - Uses `supabase.auth.updateUser()` to set new password
- **Change Password**:
  - Available in Settings page for all authenticated users
  - Requires current password verification
  - Validates new password (minimum 6 characters, must match confirmation)
  - Uses `supabase.auth.updateUser()` to update password

### User Roles

#### `dev`
- **Full access**: All features
- **Customer/Project Creation**:
  - Must select a master when creating customers (from all masters in the system)
  - Projects automatically inherit the customer's owner (cannot be changed)
  - Can update customer owner when editing
- **Special permissions**:
  - Manage user roles in Settings
  - Create/edit/delete workflow templates
  - Invite users with predefined roles
  - Manually create users
  - Delete users
  - Impersonate other users (via "imitate" button)
  - Claim dev role via Settings (enter promotion code; stored in DEV_PROMOTION_CODE secret)

#### `master_technician`
- **Access**: Dashboard, Customers, Projects, People, Calendar, Settings
- **Master-Assistant Relationship**:
  - Can adopt assistants via checkboxes in **Settings → People & accounts** (Sharing and Adoption)
  - Adopted assistants can access their customers and projects
  - Can see all assistants and manage adoptions
- **Can**: 
  - Create customers, projects, workflows, assign people
  - Automatically assigned as owner when creating customers
  - Projects automatically inherit customer owner (cannot be changed)
  - Update customer owner when editing
  - Adopt/unadopt assistants in **Settings → People & accounts**
  - See which assistants they have adopted
- **Cannot**: 
  - Change project owner (automatically matches customer owner)
  - Manage user roles, templates, or other users

#### `assistant`
- **Access**: Dashboard, Customers, Projects, People, Calendar
- **Master-Assistant Relationship**:
  - Masters can "adopt" assistants via checkboxes in **Settings → People & accounts**
  - Assistants can work for multiple masters (many-to-many relationship)
  - Assistants can only see customers/projects from masters who adopted them
- **Master-Sharing Relationship**:
  - Masters can "share" with other masters via checkboxes in **Settings → People & accounts**
  - Shared masters receive assistant-level access (can see but not modify, cannot see financial totals)
  - Shared masters can see customers/projects from masters who shared with them
- **Can**: 
  - **Create and edit customers** (must select a master who adopted them as customer owner)
  - **Create and edit projects** (project owner automatically matches customer owner)
  - View customers and projects from masters who adopted them
  - **View ALL stages** in workflows they have access to (not just assigned stages)
  - Use action buttons (Set Start, Complete, Re-open) on assigned stages
  - **View and edit line items** in Ledger (but cannot see financial totals)
  - Subscribe to stage notifications
- **Cannot**: 
  - Delete projects (restricted to devs/masters)
  - Delete customers (restricted to devs/masters)
  - Change project owner (automatically matches customer owner)
  - Manage users
  - Access Settings (except to see which masters adopted them)
  - Edit/delete/assign stages
  - See private notes
  - See projections or financial totals (Ledger Total, Total Left on Job)
  - Create customers without selecting a master who adopted them

#### `subcontractor`
- **Access**: Dashboard, Calendar only
- **Restrictions**:
  - Navigation links hidden (except Dashboard, Calendar)
  - Client-side redirects enforce path restrictions
  - Cannot access Customers, Projects, People, Settings, Templates
  - **Can only see stages when a stage is assigned to them** (by name match)
  - Can only Start and Complete their stages
  - Cannot see stages they're not assigned to
  - Cannot edit/delete/assign stages
  - Cannot see private notes, line items, or projections

#### `estimator`

**Purpose**: Dedicated role for bid estimation and material management without access to ongoing project operations.

##### Pages Allowed
- **Dashboard** - Checklist items due today, Builder Review link; Send task via header (if dev/master/assistant)
- **Materials** - Full access to price book, parts, templates, purchase orders
- **Bids** - Full access to all Bids tabs and features
- **Calendar** - View calendar
- **Checklist** - Today, History, Review, Manage tabs
- **Settings** - Change password, push notifications

##### Pages Blocked
- Customers, Projects, People, Templates
- **Layout redirects**: Attempts to access blocked pages redirect to `/bids`

##### Bids Capabilities

**Full Bids System Access**:
- All Bids tabs (Bid Board, Builder Review, **Unsent/Working** Kanban (`tab=working`), Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission & Followup). Builder Review: customers sorted by last contact (Oldest first / Newest first); PIA checkbox per customer excludes that customer when Oldest first is selected (stored per user in localStorage). **General contact** (`customer_contacts`) uses the same stacked-card notes UX as bid notes (contact method quick picks, inline add/edit/delete); optional `contact_method` column on `customer_contacts`.
- Create, edit, and delete bids
- Enter fixture counts with quick-select and number pad
- Map counts to material templates (Takeoff tab)
- Calculate costs with labor book and driving costs (Cost Estimate tab)
- Analyze margins with price book (Pricing tab)
- Generate cover letters and track submissions

**Customer Access via Bids**:
- **SELECT**: Can see all customers in GC/Builder dropdown (RLS policy allows estimator SELECT on customers table)
- **CREATE**: Can create new customers via "+ Add new customer" modal in Bids
  - Opens Add Customer modal (same form as /customers/new but without Quick Fill)
  - **Must assign Customer Owner (Master)** - dropdown shows all masters
  - **RLS**: INSERT policy allows estimators when `master_user_id` is set to valid master (dev or master_technician)
  - New customer automatically selected as bid's GC/Builder
- **NO UPDATE/DELETE**: Cannot modify or delete existing customers
- **NO UI ACCESS**: Cannot navigate to `/customers` page

**NewCustomerForm Component**:
- Supports estimator role with Customer Owner dropdown
- Shows all masters for estimator selection
- Requires master selection (validation enforced)
- Used in Bids Add Customer modal with `showQuickFill={false}`, `mode="modal"`

##### Materials Capabilities

**Full Materials Access**:
- Same permissions as master_technicians
- Price Book: View, edit, and manage all parts and prices
- Supply Houses: Full CRUD on supply house records
- Templates: Create and edit material templates
- Purchase Orders: Create draft and finalized POs
- Price History: View price change tracking

**Use Case**: Estimators can manage material pricing and templates while focusing on bids, without access to ongoing project management.

##### Database Access

**RLS Policies**:
- `customers`:
  - SELECT: Allowed (for dropdowns and bid data) - `allow_estimators_select_customers.sql`
  - INSERT: Allowed when `master_user_id` is set to valid master
  - UPDATE/DELETE: Not allowed
- `bids` and related tables (count_rows, submission_entries, cost_estimates, etc.):
  - Full CRUD access - `allow_estimators_access_bids.sql`
- `material_*` tables (parts, prices, templates, purchase_orders):
  - Full CRUD access (same as master_technician)
- `takeoff_book_*`, `labor_book_*`, `price_book_*`:
  - Full CRUD access (same as master_technician)

##### Workflow Integration

**Typical Estimator Workflow**:
1. Receive bid request
2. Create or find customer in Bids (GC/Builder dropdown)
3. Create new bid with project details
4. Enter fixture counts (Counts tab)
5. Map to material templates (Takeoff tab, create PO if needed)
6. Calculate labor and costs (Cost Estimate tab)
7. Analyze margins (Pricing tab)
8. Generate cover letter and submit bid
9. Track follow-ups and outcomes (Submission & Followup tab)

**Benefits of Estimator Role**:
- **Focused interface**: Only sees estimation-relevant pages
- **Streamlined access**: Can create customers when needed for bids without full customer management
- **Material management**: Can update pricing and templates for accurate estimates
- **Security**: Cannot access ongoing projects, workflows, or sensitive operational data
- **Flexibility**: Can work for multiple masters by creating customers for different masters

#### `primary`

**Purpose**: Role for users who need Materials, Jobs (Reports tab only), Bids (Bid Board, RFI, Change Order, Lien Release), and Dashboard with Recent Reports—without access to Customers, Projects, People, or other Jobs/Bids tabs.

##### Pages Allowed
- **Dashboard** - Recent Reports section, Checklist items due today; Send task via header
- **Materials** - Full access (same as estimator/master)
- **Jobs** - Reports tab only (view and create reports)
- **Bids** - Bid Board, RFI, Change Order, Lien Release tabs only (view bids, generate documents)
- **Calendar** - View calendar
- **Checklist** - Today, History, Review, Manage tabs
- **Settings** - Change password, push notifications

##### Pages Blocked
- Customers, Projects, People, Templates
- **Jobs tabs other than Reports**: Billing, Sub Sheet Ledger, Crew P&L
- **Layout redirects**: Attempts to access blocked pages redirect to `/dashboard`

##### Materials Capabilities

**Full Materials Access** (same as estimator/master_technician):
- Price Book: View, edit, and manage all parts and prices
- Supply Houses: Full CRUD on supply house records
- Templates: Create and edit material templates
- Purchase Orders: Create draft and finalized POs
- Price History: View price change tracking

##### Jobs Reports Capabilities

- **Reports tab only**: View all reports via `list_reports_with_job_info` RPC
- **Full CRUD on reports**: Create, edit, and delete reports (RLS policy grants Primary same access as dev/masters/assistants)
- Other Jobs tabs (Billing, Sub Sheet Ledger, Crew P&L) are hidden

##### Dashboard Capabilities

- **Recent Reports**: Same section as masters (list of recent reports)
- **Send task**: Via header; can create and assign checklist tasks to other users (ChecklistAddModal "detail send")

**Use Case**: Primary users handle materials, job reports, task assignment, and bid documents (RFI, Change Order, Lien Release) without access to customer/project management or full bid creation/editing.

### Row Level Security (RLS) Patterns

#### Common Pattern: Master-Assistant Adoption and Master Sharing
Policies check if user owns the resource OR a master who owns it has adopted them OR a master who owns it has shared with them:
```sql
master_user_id = auth.uid()  -- User owns it
OR EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND role IN ('dev', 'master_technician')  -- User is a master/dev
)
OR EXISTS (
  SELECT 1 FROM public.master_assistants
  WHERE master_id = master_user_id
  AND assistant_id = auth.uid()  -- A master who owns it has adopted this assistant
)
OR EXISTS (
  SELECT 1 FROM public.master_shares
  WHERE sharing_master_id = master_user_id
  AND viewing_master_id = auth.uid()  -- A master who owns it has shared with this master
)
```

**Note**: Shared masters receive assistant-level access (can see but not modify, cannot see financial totals).

This pattern is used in:
- `customers` table: Assistants can see customers from masters who adopted them
- `projects` table: Assistants can see projects from masters who adopted them

#### Owner-Only Operations
```sql
EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
```

#### User's Own Data
```sql
user_id = auth.uid()
```

### Impersonation Flow
1. Dev/Master/Assistant clicks "imitate" button (Settings or People → Users)
2. Frontend calls `login-as-user` Edge Function with `redirectTo`:
   - **Settings**: `http://localhost:5173/dashboard` (for local dev)
   - **People → Users**: `https://pipetooling.com/dashboard` (for production)
3. Edge Function generates magic link for target user
4. Frontend stores original session in `localStorage` (key: `'impersonation_original'`) so it survives reloads
5. Browser redirects to magic link URL with tokens in hash
6. AuthHandler component processes tokens and sets session
7. User is redirected to dashboard as the target user
8. **Restore session**: **[`Layout.tsx`](../src/components/Layout.tsx)** (desktop nav, not mobile) shows a short **Back** button with **`title="Back to my account"`** and an **`aria-label`** that names returning to the original signed-in account; **[`Settings.tsx`](../src/pages/Settings.tsx)** impersonation banner uses the full label **Back to my Account**. Both clear **`impersonation_original`** and call **`setSession`** with the stored tokens.

**Restrictions**:
- No one can impersonate a dev
- Assistants cannot impersonate masters (assistants may impersonate assistants, subcontractors, estimators)

**Production (pipetooling.com)**: For imitate to work on production, configure Supabase Auth:
- **Authentication** → **URL Configuration**
- **Site URL**: Set to production URL (e.g. `https://pipetooling.com`)
- **Redirect URLs**: Add `https://pipetooling.com/**` and `http://localhost:5173/**`. Both are needed for Settings (localhost) and People (pipetooling.com) imitate flows.

**Back-button safeguards**: When impersonating, the app clears the magic-link hash from the URL immediately (before async work) to prevent back-button issues. A `pageshow` handler reloads on bfcache restore; a `popstate` handler redirects to dashboard when the user hits back.

---

## Key Features

**See also specialized documentation**:
- **[BIDS_SYSTEM.md](./BIDS_SYSTEM.md)** - Complete Bids system documentation (all 6 tabs, workflows, and integrations)
- **[EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)** - Edge Functions API reference (user management, email notifications)
- **[ACCESS_CONTROL.md](./ACCESS_CONTROL.md)** - Complete role-based permissions matrix and RLS patterns
- **[MIGRATIONS.md](./MIGRATIONS.md)** - Database migration history and tracking

### 1. Customer Management
- **Page**: `Customers.tsx`, `CustomerForm.tsx`
- **Features**:
  - **Search** at top (below header): Filters by name, address, master user, phone, email (client-side)
  - List customers with name, address, **customer owner (master)**
  - Create/edit customers
  - **Assistants and devs must select a master** when creating customers
    - Assistants: Can only select from masters who adopted them
    - Devs: Can select from all masters in the system
    - Masters: Automatically assigned as customer owner
  - **Master can be updated** when editing (for masters and devs)
  - **Quick Fill**: Expandable block (collapsed by default) with a "Quick Fill" button next to the "New customer" title; when expanded, paste tab-separated data (name, address, email, phone, date) and click "Fill Fields" to auto-fill form
  - **Date Met**: Track when customer relationship started
  - **Contact Info**: Structured storage of email and phone (JSONB)
  - **Customer owner displayed** in customer list
  - **Delete functionality**: Masters can delete their own customers, devs can delete any customer (delete button in edit form only)
  - **Contact Icons**: Clickable phone, email, and map icons if contact/address info exists
  - **Click customer name** to edit (removed redundant "Edit" link)
- **Data**: Name, address, contact info (JSONB), date_met

### 2. Project Management
- **Page**: `Projects.tsx`, `ProjectForm.tsx`
- **Tabs** (top of page, `pageUnderlineTabStyle`, `?tab=stages|job-history|forecast`, default `stages`):
  - **Overview** (rendered label as of **v2.551** — internal state + URL param still `stages` so existing bookmarks keep working) — the project listing UI described below.
  - **Job History** (renamed from **Job Schedule** in **v2.553** — URL value is now `job-history`) — horizontally-scrollable Gantt of working jobs (see "Job History Tab" subsection below).
  - **Forecast** (added **v2.554**, two sub-tabs `?forecastSub=specific|all-stages`) — forward-looking Gantt driven by `project_workflow_steps.scheduled_start_date` / `scheduled_end_date` plus actual `started_at` / `ended_at`. See "Forecast Tab" subsection.
- **Features (Overview tab)**:
  - List projects with status, customer, active stage, **project owner (master)**
  - Create/edit projects
  - **Project owner automatically matches customer owner** - cannot be changed or selected separately
  - Delete projects (with confirmation)
  - Link to HouseCallPro number
  - Link to plans
  - **Map link**: Clickable map icon next to plans link (if project has address)
  - Create workflow from template
  - **Project owner displayed** in project list and workflow page
  - **Stage Summary**: Color-coded workflow stage sequence displayed below description
    - Green for completed/approved, red for previous work incomplete, orange (bold) for in_progress, gray for pending
  - **Current Stage**: Shows active stage with progress `[current / total]` (e.g., `[3 / 5]`)
    - Stages marked incomplete stop progress and are shown as current stage
  - **Click project name** to view workflow (removed redundant "Workflow" link)
  - **Empty state**: When filtering by customer, shows `**[Customer Name]** has no projects yet. Add one.`
- **Data**: Name, description, status, customer, master_user_id (project owner, matches customer owner), address, external references

#### Job History Tab (v2.548–v2.553)

A horizontally-scrollable Gantt that answers *"what jobs has the team worked on, and how concentrated were each of those jobs?"* — a read that the Overview list doesn't visualize. Renamed from **Job Schedule** → **Job History** in **v2.553** (deep namespace rename: all components / libs / tests / `localStorage` keys / Realtime channel name / URL `?tab=` value). Lives at `/projects?tab=job-history` (respects `?customer=` for single-customer scope).

- **Rows**: every job with `jobs_ledger.status = 'working'`. Jobs with zero approved `clock_sessions` are omitted (no bar to draw).
- **Columns**: one Chicago calendar day (`APP_CALENDAR_TZ`), 36 px wide.
- **Bars** span from a job's earliest approved `clock_sessions.work_date` to its latest approved + closed `work_date` (`clocked_out_at IS NOT NULL`). Open-ended jobs (no closed clock-out yet) extend to today with a **dashed** right edge. Bars whose start or end fall outside the visible window are clipped at the edge with a dashed border to signal continuation.
- **Per-day highlight inside the bar**: each day with at least one matching session paints a sub-cell, background scaling with the **distinct user count** that day on a 5-step blue palette (`#dbeafe → #bfdbfe → #93c5fd → #60a5fa → #3b82f6`, foreground flips to white at count ≥ 4). The count renders as a small bold digit and is its own `<button>` so a click opens the day-detail modal (v2.549) without bubbling to the bar's Job Detail handler; gap days inside the bar show the bar's neutral background (`#f1f5f9`) so the eye distinguishes "scheduled but no clock activity" from "actually worked".
- **Job label** (v2.549): `{trade-prefix}{HCP} · {Job Name}` (trade prefix from `service_types.ledger_job_prefix` via `buildLedgerPrefixMap`, defaults to `J`). Positioned at `position: absolute; right: 100%; marginRight: 6` so it sits **just outside** the bar's left edge — scrolls in lock-step with the bar but never overlaps a day cell. The label is its own `<button>`; clicking it opens **Edit Job** (separate from the bar background click → Job Detail).
- **Today** marker: 2 px orange (`#fb923c`) vertical accent line; bar cells on today get an `inset 0 0 0 1px #fb923c` outline.
- **Three click targets per bar** (v2.549):
  - **Label** (`{HCP} · {Job Name}` pill) → `useJobFormModal().openEditJob(jobId)`.
  - **Bar background** (any un-highlighted area) → `useJobDetailModal().openJobDetail({...})`.
  - **Numbered day cell** → opens [`ProjectsJobHistoryDayModal`](../src/components/projects/ProjectsJobHistoryDayModal.tsx) with People & sessions, costs, mini-Gantt, and report viewer for that (job, work_date).
- **Default scroll position**: on mount and on range change, the timeline imperatively parks `scrollLeft` at the right edge so the most recent days are visible.

**Layout toggle** (v2.550, default flipped to **Compact** in v2.553): a segmented `[ Expanded | Compact ]` control in the toolbar.

- **Expanded**: one row per job — the v2.548–v2.549 layout, byte-equivalent.
- **Compact** (default as of v2.553): non-overlapping bars pack onto shared rows ("lanes") via [`packBarsIntoLanes`](../src/lib/projectsJobHistoryLanePacking.ts). The pack predicate is **label-width-aware** — each bar reserves a left-side label slot sized from the bar's actual label text width (`{HCP} · {Job Name}` measured via a hidden `<canvas>` at the runtime page font), so two bars only share a lane when the calendar gap between them is at least as wide as the later bar's label plus a one-column **breathing margin** (`LABEL_BREATHING_COLS = 1`, v2.551). `MAX_LABEL_DAY_COLS = 14` caps any one absurdly long job name. Lane display order is `max(lastWorkDateYmd) DESC` so the lane with the most recent activity sits on top. Choice persists per browser via `localStorage` key `projects_job_history_layout_mode_v1`; default `'compact'` as of v2.553 (existing explicit `'expanded'` choices are still honored verbatim).

**Toolbar** (v2.551 layout — left-to-right, single wrapping flex row; v2.553 added the **Only show jobs with projects** checkbox below the search):

```
[ Search ]  [ From ] [ To ]  [ Last 90d ] [ Last 365d ]  [ Expanded | Compact ]
[ ☐ Only show jobs with projects ]
```

- **Search** (v2.551): client-side substring filter across the full display label, prefix+number, raw HCP number, job name, and address. Predicate in [`projectsJobHistoryBarSearch.ts`](../src/lib/projectsJobHistoryBarSearch.ts). The search input's **placeholder doubles as the count summary** (`Loading…` / `No working jobs…` / `29 jobs · 91 days`); when the user types, a small `k of N matches` inline label appears next to the input (with `aria-live="polite"` for screen readers). Clear button (`×`) inside the input.
- **Only show jobs with projects** (v2.553): checkbox under the search bar. When on, `projectFilteredBars = bars.filter(b => b.projectId != null)` is applied **before** the search filter so the match counter (`k of N matches`) and loaded-row summary text both reflect the same filtered population the user sees on screen. Toggle persists per browser under `localStorage` key `projects_job_history_only_with_projects_v1`; default `false`.
- **From / To** (v2.551 compact width): both `<input type="date">` instances are styled to `width: 92px` (`dateInputStyle`) so the browser visually clips the trailing `YYYY` while preserving the full `YYYY-MM-DD` value. Calendar picker on click works as normal; hover shows the full date via `title`.
- **Quick-pick chips**: `Last 90d`, `Last 365d`.
- **Layout toggle**: `Expanded` / `Compact` segmented buttons (active = inset blue, `aria-pressed="true"`).

**Range picker** mirrors People → Review's custom-range UX: From / To `<input type="date">` with cross-bounding `min` / `max` + *"Pick both dates to set the range."* hint when one input is empty. Defaults to Today − 90d → Today (Chicago); last-used range persists under `localStorage` key `projects_job_history_range_v1`. The range is a **viewport**, not a query filter — the underlying `clock_sessions` fetch is unbounded by date so bar bounds stay correct regardless of selection.

**Realtime**: channel `projects-job-history-${authUserId}` subscribes to `clock_sessions` with `filter: \`job_ledger_id=in.(${jobIds.join(',')})\`` when ≤ 80 jobs in scope (unfiltered fallback), and unfiltered to `jobs_ledger` `event: '*'` so jobs flipping INTO or OUT OF `working` are caught. Both paths coalesce into a single 280 ms debounce gated on `document.visibilityState === 'visible'`.

**Files**:
- [`src/lib/projectsJobHistoryData.ts`](../src/lib/projectsJobHistoryData.ts) — `ProjectsJobHistoryBar` (carries `projectId` as of v2.553), `aggregateClockSessionsToBars`, `peopleCountColor`, `enumerateDaysInRange` (pure; 20 unit tests).
- [`src/lib/projectsJobHistoryLanePacking.ts`](../src/lib/projectsJobHistoryLanePacking.ts) — `packBarsIntoLanes`, `labelDayColsFromPx`, `measureLabelWidthPx`, layout-mode storage helpers (21 unit tests; default flipped to `'compact'` in v2.553).
- [`src/lib/projectsJobHistoryBarSearch.ts`](../src/lib/projectsJobHistoryBarSearch.ts) — `normalizeBarSearchQuery`, `barMatchesSearch`, `filterBarsBySearch` (16 unit tests).
- [`src/lib/projectsJobHistoryDayCosts.ts`](../src/lib/projectsJobHistoryDayCosts.ts) — day-detail cost aggregator (29 unit tests).
- [`src/lib/fetchProjectsJobHistoryClockSessions.ts`](../src/lib/fetchProjectsJobHistoryClockSessions.ts) — chunked Supabase fetch (100 ids per `IN`).
- [`src/components/projects/ProjectsJobHistoryTab.tsx`](../src/components/projects/ProjectsJobHistoryTab.tsx) — orchestration (jobs + sessions + service-types loader, range state, search state, **only-with-projects state**, layout-mode state, Realtime subscription, day-modal state).
- [`src/components/projects/ProjectsJobHistoryTimeline.tsx`](../src/components/projects/ProjectsJobHistoryTimeline.tsx) — pure presentational (sticky 2-tier header, today vertical line, CSS-grid rows, `JobBarContent` subcomponent shared between Expanded and Compact modes, canvas-measured compact-mode pack inputs).
- [`src/components/projects/ProjectsJobHistoryDayModal.tsx`](../src/components/projects/ProjectsJobHistoryDayModal.tsx) — focused per-cell modal.
- [`src/pages/Projects.tsx`](../src/pages/Projects.tsx) — wires `<ProjectsJobHistoryTab customerId={customerId} />` into the Job History tab.

No DB / migration / RLS / RPC / Edge changes; all data comes from existing `jobs_ledger`, `clock_sessions`, `service_types`, plus `mercury_transaction_job_allocations` / `supply_house_invoice_job_allocations` / `people_pay_config` for day-detail costs and the existing `list_reports_with_job_info` RPC for day-detail reports.

#### Forecast Tab (v2.554)

A forward-looking Gantt of every workflow stage on every project-linked job. Driven by `project_workflow_steps.scheduled_start_date` / `scheduled_end_date` (the **Expected dates** modal added in v2.552 writes these) plus each stage's actual `started_at` / `ended_at`. Lives at `/projects?tab=forecast` with two independent sub-tabs.

**URL params**:

```
?tab=forecast                              # default sub-tab = specific
?tab=forecast&forecastSub=all-stages
?tab=forecast&forecastJob=<jobId>          # specific tab only — selected job
```

**Scope** (both sub-tabs):

- **Jobs**: every `jobs_ledger` row with `project_id IS NOT NULL`, **any `status`** (working / ready_to_bill / billed). RLS on `project_workflow_steps` keeps role-based visibility tight (dev / master see all; assistant / superintendent via `can_access_project_via_workflow`; subcontractor / helpers see only assigned stages).
- **Stages**: every step of each job's workflow, **all `status` values**.
- **Unscheduled stages** (no expected, no actual dates): render as **1-day grey dashed** placeholders chained to the prior stage's resolved end so they're always positioned somewhere instead of invisible.

##### Sub-tab: **Specific**

One job, vertical Gantt. Pick a job via the typeahead at the top of the tab; the rest of the tab redraws as one row per stage in `sequence_order` ASC. Selection persists to `?forecastJob=` + `localStorage` key `projects_forecast_specific_selected_job_v1`.

- **Search**: substring match on HCP / name / address / project name via [`projectsForecastJobSearch.ts`](../src/lib/projectsForecastJobSearch.ts); dropdown shows the current selection at the top + 15 other suggestions.
- **Range picker** (sparse mode only — when `showDates` is OFF): defaults to **auto-fit** `[min(resolvedStart), max(resolvedEnd)]` padded ±3 days. User can override via From / To; override persists under `projects_forecast_specific_range_v1`. **Reset to fit** chip restores the auto-fit. The range picker does not apply to dense mode (when **Show dates** is ON) — see the next bullet.
- **Dense window + pan pillars + `Today` button** (**v2.560**, dense mode only — when `showDates` is ON): the day rail is now anchored to **today** with a 180-day window centered on it (`[today − 90, today + 90]`) instead of the resolved-bar envelope used pre-v2.560. The window grows in 90-day chunks via in-line `←` / `→` pillar columns sitting AT the rail's start / end as inline-flex siblings of the day-grid block inside the horizontal scroller (the day-grid block is wrapped in a `display: flex` container with `alignItems: 'stretch', minWidth: '100%'`; left pillar is the first flex child, day-grid the middle child `flex: '1 0 auto', width: totalWidth, position: relative`, right pillar the last). The pillars scroll WITH the rail, so the user only sees each one after scrolling all the way to the corresponding edge (`... | 22 | 23 | 24 | →`) — no day cells are ever obscured. Each click adds 90 days to that edge (window only grows, never slides) and **deliberately does NOT snap the scroller** to the freshly-loaded edge: the user explicitly asked for "load the days but don't move me." `→` clicks need no scroll adjustment (new columns appear off-screen to the right, so already-visible cells stay put). `←` clicks apply an explicit `scrollLeft += FORECAST_SPECIFIC_EXTEND_DAYS × FORECAST_COL_W` (= 90 × 36 = 3240 px) via `ForecastTimelineGridHandle.adjustScrollLeftByPx` from a `useLayoutEffect` keyed on `denseDayKeys.length` — without it the browser-preserved `scrollLeft` would leave the user looking at the newly-inserted historical days instead of the cells they were reading. To see the freshly-loaded days, the user scrolls in that direction manually. Both auto-center-on-today effects add a `leftPillarOffsetPx = onPanLeft != null ? PAN_PILLAR_W_PX : 0` term to the scroll-target math so "today" still visually centers in the viewport when the left pillar (a 36px-wide leading sibling) is present. A toolbar `Today` button (left of `Edit` in the right-side cluster, gated on `hasJob && showDates`) re-runs the same reset on demand: it clears both pan overrides AND bumps a `todayResetTick` counter that is composed into `autoCenterTodayResetKey` as `` `${selectedJobId ?? ''}::${todayResetTick}` ``, so the grid's auto-center effect re-fires even when the user hasn't switched jobs. Resets to the default window on every job switch (`reset_per_job` — no persistence). Stages outside the visible window are reached by clicking the pillars; the trade-off is explicit and chosen so different jobs all open at the same temporal anchor regardless of when their stages were scheduled. Pure helpers in [`src/lib/projectsForecastSpecificWindow.ts`](../src/lib/projectsForecastSpecificWindow.ts) (`computeForecastSpecificDefaultWindow`, `computeForecastSpecificEffectiveWindow` with only-grow guard, `extendForecastSpecificWindowLeft`, `extendForecastSpecificWindowRight`, plus the exported `FORECAST_SPECIFIC_DEFAULT_BACK_DAYS = 90` / `FORECAST_SPECIFIC_DEFAULT_FORWARD_DAYS = 90` / `FORECAST_SPECIFIC_EXTEND_DAYS = 90` constants) — 13 unit tests. Grid plumbing: `ProjectsForecastTimelineGrid` is wrapped in `forwardRef`, exposes `ForecastTimelineGridHandle { scrollToEdge(side) }`, and accepts new optional props (`onPanLeft` / `onPanRight` / `panLeftLabel` / `panRightLabel` / `autoCenterTodayResetKey`); All Stages omits all of them and behaves identically to pre-v2.560. The new `autoCenterTodayResetKey` prop (Specific passes `selectedJobId ?? ''`) keys the auto-center-on-today effect so pan clicks mutate `dayKeys` without yanking scroll back to today — only a job switch re-centers.
- **Stage row**: sticky left gutter shows sequence number (status-colored chip) + stage name + assignee (blue underline). Body is the colored Gantt bar spanning `[startYmd, endYmd]`. Click anywhere on the row → opens the **stage detail modal** ([`ProjectsForecastSpecificStageModal.tsx`](../src/components/projects/ProjectsForecastSpecificStageModal.tsx)) — see below.
- **Stage detail modal**: opens when a stage row is clicked. Header (top): status-colored sequence chip, stage name, status / type / assignee pills. Header (top-right, **v2.559** — third edit surface for `percent_complete`): compact `Complete [N] %` editor between the title block and the close button. Same uncontrolled-input + save-on-blur + `parsePercentCompleteInput` + visual-clear pattern as the gutter cell (typing `0` clears, Enter blurs to commit). Permission gate `canEditExpectedDates(myRole)` = dev / master_technician / assistant / superintendent; roles outside that set see `Complete 45%` read-only when the value is non-null and nothing in the header when it's null. Renders only once `step` (the fetched `ForecastStageDetail`) has loaded so the slot stays empty during the initial fetch and the close button stays at the right edge as before. Save path: parent-level `savePercent` `useCallback` that runs `supabase.from('project_workflow_steps').update({ percent_complete: next }).eq('id', step.id)` + toast on error + `await load()` reload; `savingPercent` boolean disables the input and appends `· saving…` to the label while in flight. Body: detail readouts, status-reason blocks, inspection notes, **Adjust stage** editor (step name, assignee, expected start/end + length, also-push-next-stage checkbox), **Notes for Tech** / **Notes for Office** collapsible textareas (save on blur), and the **Line Items For Office** section. Footer: `Open in Workflow ↗` deep-link (new tab), `Clear dates`, `Cancel`, `Save`. The page-level Forecast Specific Gantt row also still navigates here on click.
- **`%` column** (**v2.559**, persistence **v2.562**): right-aligned cell inside the sticky left gutter on every row, with a `%` column header in the gutter header (this sub-tab only — All Stages keeps its empty gutter header). Backed by new `project_workflow_steps.percent_complete` (INT 0-100, nullable; migration `20260519214147_add_percent_complete_to_project_workflow_steps.sql`). Empty cell == `NULL` == "not tracked". Edit gate: **`dragEdit && canAlignStages(myRole)`** — the page's **Edit** toggle has to be on too (mirrors the `+` insert button on the same gutter row), so by default every role sees the same muted read-only `NN%` text. **Hide-when-empty**: when the currently-selected job has no `percent_complete` values anywhere AND the user isn't in Edit mode, the entire column (header + per-row cells) is omitted and `labelGutterWidth` shrinks from 300 back to the pre-v2.559 **260** so the stage name reclaims the freed gutter space. Driven by `showPercentColumn = dragEdit || resolvedBars.some(b => b.percentComplete != null) || pendingPercentByStageId.size > 0`, plumbed through `renderGutterLabel` as the new `showPercentCell` prop on `StageGutterLabel` (defaults to `true` so any future caller keeps the original contract). Once any stage has a value the column shows for every role (including read-only ones), and toggling Edit on a job that already has at least one value doesn't reflow the timeline. Uncontrolled `<input type="number" min={0} max={100} data-forecast-pct="true">` (no-spinner) re-keyed off the persisted value (merged with **`pendingPercentByStageId`** via **`effectiveResolvedBars`**) so read-only **`NN%`** cells update immediately after commit; Enter blurs to commit; user input flows through shared [`parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts) (empty → null, **`0` → null**, clamp 0-100, round fractionals). Commits via **`onCommitPercentComplete`**: optimistic overlay stamp → `withSupabaseRetry(supabase.from('project_workflow_steps').update({ percent_complete: next }).eq('id', stageId))` → parent **`refreshStages()`** on success (reverts overlay + toast on failure). **v2.562** — toggling **Edit** off blurs any focused gutter `%` input before unmount so **`0 → null`** clears are not lost. Same field is also editable from the stage detail modal header and the Workflow page expanded stage card (see below).

##### Sub-tab: **All Stages**

One row per job-with-project, stages laid out side-by-side horizontally. Designed to make crew-assignment gaps obvious — the whitespace between consecutive stage bars on a row is the gap.

- **Range picker**: default **today − 7d → today + 90d** (forward-leaning), persisted under `projects_forecast_all_range_v1`. **Reset to default** chip restores it.
- **Search**: same substring matcher as Specific; matched rows shown, others hidden; `k of N matches` inline status with `aria-live="polite"`.
- **Only show jobs with active stages** (default `false`): checkbox below the range picker; filters out jobs whose every stage is `completed` / `approved` / `skipped`. Persisted under `projects_forecast_all_active_only_v1`.
- **Row label** (sticky left gutter): `{prefix}{HCP} · {Job Name}` with `{project_name}` on a second line when present. Click → opens `/workflows/${project_id}` (no `#step-` anchor).
- **Stage bar**: clicking opens the same Workflow deep-link with `#step-${stage_id}` for that specific stage.

Row windowing — a row only renders when at least one of its bars overlaps the visible date range, so a job whose stages are all outside the window doesn't take up a blank line.

##### Pure stage resolver: [`projectsForecastStageResolver.ts`](../src/lib/projectsForecastStageResolver.ts)

Every visible bar comes from `resolveForecastStages(stagesIn, todayYmd)`, which walks stages in `sequence_order` and emits a `ResolvedStageBar[]`:

1. `start = scheduled_start_date ?? prior.endYmd ?? actual(started_at) ?? todayYmd`
2. `end = scheduled_end_date ?? actual(ended_at) ?? ymdAddDays(start, 1)`
3. `isUnscheduled = !scheduled_start && !scheduled_end && !started_at && !ended_at` → grey dashed 1-day swatch at the chained position.
4. `colorKey` = stage status, with `skipped` winning over `unscheduled` (intentional skips keep their muted strikethrough swatch even with no dates), and `unscheduled` winning over everything else.

Does not clamp `endYmd >= startYmd` — bad data surfaces as a visibly-flipped bar rather than being silently hidden. 19 unit tests; companion [`projectsForecastJobSearch.test.ts`](../src/lib/projectsForecastJobSearch.test.ts) covers 12 search cases.

##### Color palette: [`projectsForecastColors.ts`](../src/lib/projectsForecastColors.ts)

Mirrors `getStepStatusStyle` from [`Workflow.tsx`](../src/pages/Workflow.tsx) so colors map 1:1 between the two pages: pending (light grey), in_progress (orange `#E87600`), completed / approved (green `#059669`), rejected (red `#b91c1c`), skipped (muted with strikethrough), unscheduled (grey dashed border, exactly 1 day wide).

##### Shared grid: [`ProjectsForecastTimelineGrid.tsx`](../src/components/projects/ProjectsForecastTimelineGrid.tsx)

Generic Gantt primitive used by both sub-tabs. Sticky 2-tier date header (month-run band + day-digit band), today vertical line in orange, weekend tints, optional sticky label gutter with caller-controlled width, and a `renderRow(row, idx, ctx)` callback. Auto-scrolls to **center** `todayYmd` on mount. `forecastBarColumnSpan(...)` helper computes `gridColumn` spans and `clipLeft` / `clipRight` flags so callers can dash the appropriate edge.

##### Data loaders: [`projectsForecastData.ts`](../src/lib/projectsForecastData.ts)

- `fetchForecastJobs({ customerId })` joins `jobs_ledger.project_id` → `projects(name)` → `project_workflows.id` (one workflow per project; ties broken by `id ASC`). Jobs whose project has no workflow row are dropped.
- `fetchForecastStages(workflowIds)` returns `ForecastStage[]` sorted by `(workflow_id, sequence_order)`. Empty input short-circuits to no round-trip.
- `groupStagesByWorkflow(stages)` returns `Map<workflowId, ForecastStage[]>` for in-memory join.

##### Realtime

Channel `projects-forecast-${authUserId}` subscribes to `project_workflow_steps` filtered by `workflow_id=in.(...)` when ≤ 80 workflows in scope (unfiltered fallback), and unfiltered to `jobs_ledger event: '*'` for jobs flipping into / out of the project-linked set. 280 ms debounce + `document.visibilityState === 'visible'` gate via [`useDocumentVisibility`](../src/hooks/useDocumentVisibility.ts). Mirrors the Job History pattern.

**Files** (all new):
- [`src/lib/projectsForecastData.ts`](../src/lib/projectsForecastData.ts)
- [`src/lib/projectsForecastStageResolver.ts`](../src/lib/projectsForecastStageResolver.ts) + tests (19 cases)
- [`src/lib/projectsForecastColors.ts`](../src/lib/projectsForecastColors.ts)
- [`src/lib/projectsForecastJobSearch.ts`](../src/lib/projectsForecastJobSearch.ts) + tests (12 cases)
- [`src/lib/projectsForecastToolbarStyles.ts`](../src/lib/projectsForecastToolbarStyles.ts)
- [`src/components/projects/ProjectsForecastTab.tsx`](../src/components/projects/ProjectsForecastTab.tsx)
- [`src/components/projects/ProjectsForecastSpecificTab.tsx`](../src/components/projects/ProjectsForecastSpecificTab.tsx)
- [`src/components/projects/ProjectsForecastAllStagesTab.tsx`](../src/components/projects/ProjectsForecastAllStagesTab.tsx)
- [`src/components/projects/ProjectsForecastTimelineGrid.tsx`](../src/components/projects/ProjectsForecastTimelineGrid.tsx)
- Modified: [`src/pages/Projects.tsx`](../src/pages/Projects.tsx) (added `'forecast'` to `ProjectsPageTab`, parser update, third tab button, mount).

No DB / migration / RLS / RPC / Edge changes — relies entirely on the existing `project_workflow_steps` columns (`scheduled_start_date`, `scheduled_end_date`, `started_at`, `ended_at`, `status`) and existing RLS.

### 3. Workflow Management
- **Page**: `Workflow.tsx` (~1,500+ lines - most complex component)
- **Route**: `/workflows/:projectId`
- **Purpose**: Central interface for managing project workflows, tracking progress through stages, assigning work, and handling financials

#### Core Features

**Step Assignment**:
- **Autocomplete dropdown** in "Add Step" modal for "Assigned to" field
- Shows all masters and subcontractors (from `users` and `people` tables)
- Real-time search/filter as you type
- Source indicators: "(user)" for signed-up users, "(not user)" for roster entries
- **Add person prompt**: If name doesn't match, shows "Add [name]" option
- Opens modal to add name, email, phone, notes (defaults to `kind: 'sub'`)
- Automatically selects newly added person after creation
- Duplicate name checking (case-insensitive)

**Visual Workflow Display**:
  - **Linked jobs** (header): Chips for `jobs_ledger` rows with `project_id` = this project; link to Jobs Stages. Each chip has a **thread expand** control (chevron + optional note count) that opens the same **job thread notes** panel as Jobs Stages (`jobs_ledger_thread_notes` via `useJobThreadNotes`). Composer: **Enter** posts the note; **Shift+Enter** inserts a newline; textarea **auto-grows** from one line; activity list scrolls inside a capped **`max-height`** region with **newest-at-bottom** visibility after updates ([`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx)). **Arrived** / **Leaving** stamp buttons are **Job Detail**–only (**v2.446**); same templated notes when used (**`buildJobThreadStampBody`** / **`jobThreadNoteStampBody.ts`**, **`submitStamp`**) — see [`RECENT_FEATURES.md`](RECENT_FEATURES.md). Non-empty **`job_schedule_blocks.note`** rows merge into the same list as read-only **Schedule** entries (linked **`shared_block_group_id`** legs deduped) — **v2.445**, [`jobThreadScheduleActivity.ts`](../src/lib/jobThreadScheduleActivity.ts).
  - **Workflow Header**: Shows all stage names with "→" separators, color-coded by status
    - Green: completed/approved
    - Red: previous work incomplete
    - Orange: in_progress (bolded)
    - Gray: pending
    - Clickable stage names scroll to specific step cards
  - Step cards displayed in sequence order
  - Step cards are collapsible; click header to toggle. Completed/approved cards default collapsed.
  - Collapsed view: Header shows Start/End dates, line item count and total, Notes/Pvt word counts. Action buttons remain visible. Assign and Notify hidden.
  - Each card shows full stage details, status, assigned person, and actions (collapsible structure)

**Step Management**:
  - Add steps at beginning, end, or after specific step
  - Delete steps (with foreign key cleanup)
  - Reorder steps via "change order" button
  - Edit step names and details
  - Create workflows from templates
  - Auto-creates workflow if none exists for project

**Person Assignment**:
  - Assign people to steps from roster or user list
  - Display assigned person on right side of card
  - **v2.552**: assignees render as **name only** styled as a blue underlined `<button>`; clicking opens a **Person contact info** modal showing **email**, **phone**, and a **User** / **Guest** chip. (Previously the email was shown inline as `name • email`, which was noisy in stage lists.) Reuses the `contacts` map Workflow already loads — no new query. New `PersonContactInfo` type + `PersonDisplayWithContact` component + `personContactModal` state on the page.
  - Current user always appears first in assignment modal (highlighted with "(You)" label)
  - Excludes current user from roster list to prevent duplicates

**Step Status Actions**:
  - **Set Start** (blue): Date/time picker modal to set custom start time (replaces immediate start)
    - Allows setting historical or future start times
    - Pre-filled with current date/time
  - **Complete** (green): Worker marks stage as finished (sets `ended_at` timestamp). Visible to assigned person or managers.
  - **Approve** (blue): Managers/owners sign off with audit trail (who approved, when). Dev, master, assistant, and superintendent; visually separated from Complete.
  - **Previous work incomplete** (red): Owners/masters can mark prior work incomplete with reason notes. Dev, master, assistant, and superintendent.
  - **Re-open**: Reopen completed/approved/marked-incomplete stages (resets status to pending)
    - Available for completed, approved, or marked-incomplete stages via "Re-open" button
    - Visible to devs, masters, and assistants (on Workflow page only)
    - Button appears inline with Edit and Delete buttons (bottom right of card)
    - Clears rejection reason, approval info, and next step rejection notices
    - Records 'reopened' action in action ledger
    - Sends notifications to subscribed users
  - **Step States**: `pending` → `in_progress` → `completed` / `rejected` / `approved`
  - **Time Tracking**: `started_at`, `ended_at` (shows "unknown" if null)
  - **Expected dates** (**v2.552**): every stage card shows an `Expected:` line under the actual Start / End row backed by `project_workflow_steps.scheduled_start_date` / `scheduled_end_date`. Expanded view renders `Expected: Start [MM/DD/YYYY] · End [MM/DD/YYYY]` with each date as a clickable button (when unset, the missing word becomes `Start set` / `End set`, still clickable). Collapsed view renders an abbreviated `Exp: MM/DD → MM/DD`. Clicking any of those opens the **Expected dates** modal with two `<input type="date">` fields plus a **Duration (days)** field that **auto-computes** the end from the start (or vice versa) — dispatchers can say *"rough-in takes 5 days starting Thursday"* and the modal fills in the end automatically. **Cascade rule**: the next stage's `scheduled_start_date` defaults to the prior stage's `scheduled_end_date` when the next stage doesn't have its own scheduled start yet (defaults-only — explicit user choices on downstream stages are never silently overwritten). These expected dates feed the **Forecast** tab (`/projects?tab=forecast`, **v2.554**).
  - **Percent complete** (**v2.559**): every **expanded** stage card now also shows a `Complete: [ N ] %` row directly under the Expected dates row, backed by `project_workflow_steps.percent_complete` (INT 0-100 nullable; migration `20260519214147_add_percent_complete_to_project_workflow_steps.sql`, `CHECK 0-100`). Optional — NULL = "not tracked" (the default), rendered as `Complete: —`. Edit gate `canManageStages || s.assigned_to_name === currentUserName` (assignees can update their own progress without manager rights). Uncontrolled `<input type="number" min={0} max={100}>` re-keyed off the persisted value so a Forecast Specific edit elsewhere flows back through `refreshSteps()`; Enter blurs to commit; user input flows through shared [`parsePercentCompleteInput.ts`](../src/lib/parsePercentCompleteInput.ts) (empty → null, **`0` → null**, clamp 0-100, round fractionals). Save path: new `updatePercentComplete(step, value)` next to `submitExpectedDates` — Supabase `.update({ percent_complete: value })` + error toast on failure + optimistic `setSteps` merge. Same field is editable from the **Forecast Specific gutter** `%` column and the **stage detail modal** header (see Projects → Forecast Tab → Specific). Collapsed stage rows do NOT render this row.
  - **Default-collapsed empty notes** (**v2.552**): the **Tech notes** and **Office notes** disclosure sections inside a stage card now default to **collapsed** when the corresponding `notes` / `private_notes` field is empty / whitespace-only. Sections with content still default to expanded so existing notes-rich stages look unchanged. Controlled by `isSectionDefaultExpanded(step, section)` in [`Workflow.tsx`](../src/pages/Workflow.tsx).

**Financial Tracking**:
  - **Line Items For Office**: Track actual expenses/credits per stage
    - Fields: Date (optional, `item_date`), Link (optional URL), Memo (description), Amount (supports negative for credits/refunds)
    - **Clipboard import** (Add Line Item only): Tab-separated lines (`M/D/YYYY`, memo, amount); header paste icon; see `parseWorkflowLineItemPaste.ts`
    - Located within Private Notes section of each stage
    - **Link field**: Optional URL for external resources (Google Sheets, supply house listings)
      - Auto-formats URLs (adds https:// if missing)
      - Displayed as clickable link icon (chain link SVG) next to memo
      - Opens in new tab with security attributes
    - Amounts formatted with commas: `$1,234.56`
    - Negative amounts displayed in red with parentheses: `($1,234.56)`
    - **Purchase Order Integration**: Can add finalized purchase orders as line items
      - "Add PO" button appears when finalized POs are available
      - Creates line item with PO total and links to original PO
      - "View PO" button appears on linked line items
    - **Supply House Invoice Integration**: Can add supply house invoices as line items
      - "Add Supply House Invoice" button when invoices exist; modal with search
      - "View Invoice" button on linked line items
    - **Assistants**: Can add/edit line items but cannot see financial totals
  - **Projections**: Track projected costs for entire workflow (Devs/Masters only)
    - Fields: Stage name, Memo, Amount (supports negative)
    - Displayed in separate section at top of page
    - Light blue background to distinguish from Ledger
    - Total calculation at bottom
    - Includes "Total Left on Job: Projections - Ledger = ..."
  - **Ledger**: Aggregated view of all line items from all stages
    - Table format: Stage, Memo, Amount
    - Visible to devs, masters, and assistants
    - **Ledger Total**: Only visible to devs/masters (hidden from assistants)
    - Located in separate section below Projections

**Private Notes** (Owners/Masters only):
  - Separate text area from regular notes
  - Yellow/amber background (`#fef3c7`) to distinguish visually
  - Visible only to owners and master_technicians
  - Line items section located within private notes area

**Action History Ledger**:
  - Complete audit trail at bottom of each stage card
  - Shows: Action type, performer name, timestamp, optional notes
  - Action types: 'started', 'completed', 'approved', 'rejected', 'reopened'
  - Chronologically ordered (newest first)
  - Visible to all users who can see the stage
  - Provides full audit trail for compliance and debugging

**Notification Management**:
  - **Two Subscription Types**:
    - **Assigned person**: Notify when step started/complete/re-opened (stored on step as `notify_assigned_when_*`)
    - **Current user (ME)**: Notify when step started/complete/re-opened (stored in `step_subscriptions`)
  - **Cross-Step Notifications**:
    - Notify next step assignee when current step is completed or approved (default: enabled)
    - Notify prior step assignee when current step is marked incomplete (default: enabled)
    - Stored on step as `notify_next_assignee_when_complete_or_approved` and `notify_prior_assignee_when_rejected`
  - Notification preferences displayed in workflow step cards
  - **Email Delivery**: ✅ Fully implemented
    - Automatically sends emails when workflow steps change status
    - Uses `send-workflow-notification` Edge Function
    - Fetches email templates from `email_templates` table
    - Replaces template variables (name, email, project_name, stage_name, etc.)
    - Sends via Resend email service
    - Respects notification preferences (only sends if enabled)
    - Non-blocking (sent asynchronously, won't block UI)
    - Email lookup from both `people` and `users` tables
    - **Testing Guide**: See WORKFLOW_EMAIL_TESTING.md for comprehensive testing scenarios

**Access Control**:
  - **Owners/Masters**: See all stages, full access to all features
  - **Assistants**: 
    - See ALL stages in workflows they have access to (via master adoption)
    - Can use Set Start, Complete, Approve, Send Back: Previous Work Incomplete, and Re-open on assigned stages
    - Can view and edit line items and private notes (but cannot see financial totals)
    - Cannot see projections or financial totals
    - Cannot add, edit, delete, or assign stages
    - Notification settings: "ASSIGNED" column hidden, only "ME" column visible
  - **Superintendents**:
    - See all stages in workflows for projects they have access to (via adoption or project assignment)
    - Can use Set Start, Complete, Approve, and Send Back: Previous Work Incomplete on stages in accessible workflows
    - Can assign people; cannot add, edit, or delete stages
  - **Subcontractors**: 
    - Only see stages where `assigned_to_name` matches their name
    - Can only use Set Start and Complete on assigned stages
    - Cannot see private notes, line items, projections, or ledger
    - Cannot add, edit, delete, or assign stages
    - Error message if accessing workflow with no assigned stages
    - Notification settings: "ASSIGNED" column hidden, only "ME" column visible

**Additional Features**:
  - **Predefined Phrases**: Quick-add buttons for common steps:
    - "initial walkthrough", "check work walkthrough", "customer walkthrough"
    - "send bill", "wait on payment"
    - "rough in", "top out", "trim"
    - "change order:"
  - **Contact Integration**: Email and phone numbers are clickable (mailto:/tel: links)
  - **Direct Navigation**: Links to specific step cards via hash fragments (`#step-{id}`)
    - Automatically scrolls to step when navigating with hash
    - Workflow header stage names are clickable and scroll to their cards

### 4. Template System
- **Page**: `Templates.tsx` (dev-only)
- **Features**:
  - Create/edit/delete workflow templates
  - Manage template steps (add/edit/remove/reorder)
  - Use templates when creating projects
- **Data**: Template name, description, ordered steps

### 5. People Roster
- **Page**: `People.tsx`
- **Tabs**: **Users** (default), **Payroll** (legacy URL **`?tab=pay_stubs`**), **Hours** (timesheet + team due totals + pay tools — former **Pay** merged here; legacy **`?tab=pay`** / **`?tab=team_costs`** rewrite to **`hours`**), **Team Costs**, **Vehicles**, **Housing**, **Offsets**, **Contracts** (dev, pay-approved masters, assistants), **Review** (dev-only), **Feedback** (dev-only; URL **`?tab=feedback`**)
- **Features**:
  - **Users tab** lists roster groups in fixed order: Master Technicians, Assistants, Primaries, Estimators, Superintendents, Subcontractors, then Devs (Devs section dev-only). **Search** (name, email, phone, notes): sections with **no** matching rows are **hidden** (no section heading or **Add** for that slice); when **every** section would be empty, one muted **No matches.** appears under the search (**`role="status"`** — **`RECENT_FEATURES.md`** v2.443). With an empty search query, sections still appear including **None yet.** where applicable.
  - For users with login accounts, optional **`users.notes`** (text, nullable) stores **full name and job title** for display (e.g. legal name plus credential). The list shows that text after contact info (`—` suffix); the pencil opens the **Full name, title, and phone** modal, which edits **`users.notes`** and **`users.phone`**. (Roster-only **`people.notes`** remains a separate field—see **Data** line below; UI label on Add/Edit person is still **Notes**.)
  - List people by kind (Assistant, Master Technician, Subcontractor, Estimator, Primary, Superintendent) merged with matching user accounts; adoption (`master_primaries`, `master_superintendents`) remains the access grant—backfill migration can create matching `people` rows
  - Add people without user accounts
  - Merge display of roster entries and signed-up users (deduplicated by email)
  - Show active projects per person
  - Invite roster entries as users (sends invitation email)
  - **Contact Integration**: 
    - Email addresses are clickable (opens email client)
    - Phone numbers are clickable (opens phone dialer)
  - Display shows "(account)" next to people who have user accounts; green dot indicates push notifications enabled (visible to devs, masters, assistants). **Narrow viewport (≤640px)** on **Users**: email and phone appear on a **second line** below the name row (**`usersTabContactRowStyle`**, **`useNarrowViewport640`** in **`People.tsx`**).
  - **Impersonate (dev-only)**: On Users tab, devs see an imitate icon per user; redirects to pipetooling.com/dashboard (production)
  - **Hours tab** (dev, approved masters, assistants; **Teams** for pay staff): **`?tab=hours`**; legacy **`?tab=pay`** and **`?tab=team_costs`** rewrite to **`hours`**. **`people-hours-pay-tools`** (**Review Hours** / **People pay config**) when **`canAccessPay`** is a **fixed toolbar** (not collapsible). **Section jump** — centered chip row (**`id="people-hours-sections-nav"`**) is **first** in the Hours stack after pay tools (**Clock strip**, **Week**, **Sessions**, **Hours grid**, **Due totals**, **Teams**): **`jumpToHoursTabSection`** expands collapsible targets and smooth-scrolls; **Week** scrolls only (**week** is never collapsible). **Week / date range** — **Week range** **`h3`** left-aligned; **no** bordered card shell ( **`scroll-margin-top`** anchor **`people-hours-week`** ). Wide layout: **← last week** then **Start** / **End** with labels **above** **`type="date"`** inputs; narrow: carousel + **`details`** **Custom dates**. Anchors: **`people-hours-week`**, **`people-hours-sections-nav`**, **`people-hours-clock-strip`**, **`people-hours-sessions`**, **`people-hours-grid`**, **`people-hours-pay-tools`**, **`people-hours-due-summaries`**, **`people-hours-teams`**; **`scroll-margin-top`** avoids the sticky header. **`?tab=hours&section=rejected`** expands **Sessions**, opens **Rejected**, scrolls to **`people-hours-rejected`**, then drops **`section`** from the URL. Collapsible sections other than **Week range** use the shared bordered card shell and chevron headers (**`RECENT_FEATURES.md`** **v2.455**, layout **v2.495**). **Dashboard-style clock strip** ([**`PeopleHoursDashboardClockStrip.tsx`**](../src/components/people/PeopleHoursDashboardClockStrip.tsx) wraps [**`DashboardTeamActiveClockStrip.tsx`**](../src/components/DashboardTeamActiveClockStrip.tsx) like **`Dashboard.tsx`**) with **Everyone** / **Organization** when eligible ([**`dashboardClockStripScopeStorage.ts`**](../src/lib/dashboardClockStripScopeStorage.ts) — **`dashboard_clock_strip_scope`**). **Strip calendar day** — chevrons + **Today**; **`shiftWorkDateYmd`** / week helpers from [**`peopleHoursClockStripSelectedDay.ts`**](../src/lib/peopleHoursClockStripSelectedDay.ts) (shared with **`QuickfillPeopleHoursNewSection`**); **`stripWorkDateYmd`** keeps **live open-session** semantics only when that day is **today** (**`America/Chicago`** **`denverCalendarDayKey`**). **`onSessionsChanged`** bumps **`People.tsx`** **`loadAllClockSessionsRef`** so Pending/Approved lists refresh after strip actions. See **`RECENT_FEATURES.md`** v2.453. **Pending clock sessions** (collapsible) below the strip: sessions clocked out but not yet approved. Columns: Person; **Time & location** (line 1: duration and in/out times; line 2: work date + location text, or `In: — | Out: —` when GPS is missing); **Notes & job** (spanning two columns): notes with **job/bid label** below in the same cell; Location (map pins / links when present); **Action** (accountability: "Approved/Rejected/Revoked by … at" on one line, timestamp on the next; short locale date/time, no seconds); **Actions** (Force clock out, then **Approve**, **Reject**, **Edit**). Assignment controls for job/bid live in the Job column when shown. **Approved Sessions** (collapsible) with Revoke button. **Rejected Sessions** (collapsible) with Delete. Approve merges hours via `approve_clock_sessions` RPC (and syncs crew jobs when a job is linked); Revoke subtracts via `revoke_clock_sessions` RPC. **Edit** opens shared **`ClockSessionEditSplitModal`** (clock in/out, required notes; **Split session** with midpoint preview replaces one session with two; each part can get a different job). **Correct-day audit** from weekly grid cells: **`PeopleHoursDayAuditModal`**—read-only unless the user can edit crew jobs (**Edit** / **Done**); crew draft + **Save** matches unassigned-hour upserts; per-row **Edit** uses the same clock modal; **Add session** when the day has no clock rows. **Highlight by job** above the grid (`search_jobs_ledger` + clear chip) tints rows/cells when that person-week includes the selected job in `unifiedAssignments`; **missing job** / merge **flash** / hours **flash** still override visually. Datetime helpers: `src/utils/datetimeLocal.ts`. Timesheet with day columns (editable HH:MM:SS for hourly; read-only for salary); per-person HH:MM:SS and Decimal total columns; two footer rows (Total HH:MM:SS, Total Decimal) with per-day sums and grand total. Subscribes to `people_hours` and `clock_sessions` Realtime; refetches when another user changes hours. **Manual hours → My Time draft**: For an editable, non-**Correct** day, when a cell blurs with **hours &gt; 0** (same access gates as **`saveHours`**), **`People.tsx`** opens **`DashboardMyTimeDayEditorModal`** with a **draft** session built in **`peopleHoursManualDraftSession.ts`** (8:00 AM **`America/Chicago`** on **`work_date`**, closed span for the entered duration; draft id prefix `draft:people-hours:`). **`persistDirtyChangesAsync`** in the modal **`INSERT`**s a real **`clock_sessions`** row on save. If **`users.name`** (trim) does not match the roster **`person_name`**, a toast runs and hours are **saved to `people_hours` only**. After a successful draft save, People runs **`saveHours(..., 0)`** for that person/date so **`approve_clock_sessions`** does not double-count against an old manual total. Grid display uses **`max(people_hours, pending closed clock hours)`** for hourly rows so pending sessions remain visible before approval. **Revoked sessions are excluded** from the cell display sum (**v2.537**, **`sumClosedPendingClockHoursForCell`** / **`pendingUnapprovedCountsByWorkDate`** in [`src/lib/peopleHoursPendingByCell.ts`](../src/lib/peopleHoursPendingByCell.ts)) — revoke clears **`approved_at`** but leaves **`rejected_at`** null, so revoked rows still load via the **`approved_at IS NULL AND rejected_at IS NULL`** filter on **`pendingClockSessions`**; the explicit **`revoked_at`** check in the helpers ensures the cell value drops as soon as **`revoke_clock_sessions`** has subtracted the hours from **`people_hours`**, matching the amber pending-vs-payroll badge. **Close persists drafts** (**v2.533**): **`requestClose`** in **`DashboardMyTimeDayEditorModal`** collects every cluster id whose sessions include an **`isDraftPeopleHoursSessionId`** member into **`draftClusterIds`** and merges them into **`effectiveDirty`** before deciding whether to skip persistence — so typing a value into an empty cell and hitting **Close** without assigning a job still **`INSERT`**s the pending **`clock_sessions`** row (previously the draft was silently discarded unless a split or job assignment also marked the cluster dirty). Toast copy on draft per-session **Edit** clarifies *"This block isn't saved yet — Close will save it as a pending session that can be approved or rejected from People → Hours."* **Pending vs payroll visibility on the grid** (**v2.533**, gated on **`canAccessHours || canAccessPay`**): each cell shows a small amber **`! n`** pill in the top-right when pending closed clock sessions for that person+day sum to **more** than the saved **`people_hours`** value (the cell hour value itself is unchanged because matrix display already uses **`max(people_hours, pending)`**, so the badge surfaces the gap that **Draft Payroll** would otherwise undercount). Clicking the badge opens **[`PeopleHoursPendingCellPopover`](../src/components/people/PeopleHoursPendingCellPopover.tsx)** anchored to the cell (portal, repositions on resize/scroll); the popover lists pending sessions with **`HH:MM – HH:MM (X.XXh)`** + job/bid label, per-row **✕** reject (two-click confirm) and footer **Approve all (n)** which calls **`approveClockSessions`** ([`src/lib/approveClockSessions.ts`](../src/lib/approveClockSessions.ts)) — same **`approve_clock_sessions`** RPC as the Pending Sessions section, so crew jobs / crew bids stay in sync. **View in My Time** opens the existing **`DashboardMyTimeDayEditorModal`** for inspection. A week-strip roll-up banner above the grid summarizes the org-wide gap (**`Pending: N people · H h not yet in payroll across K days`**) with a **Review & approve** button → **[`PeopleHoursBulkApprovePendingModal`](../src/components/people/PeopleHoursBulkApprovePendingModal.tsx)** (lists each affected person/day with **`+H.HH h`**, runs **`approve_clock_sessions`** against every session id at once). Each day-column header gets a small amber dot (**`workDateHasAnyPendingExcess`**) and each person row's right-most total cell gets a muted **`+X.XX pending`** subline (**`personPendingExcessHours`**). All gap detection lives in pure helpers in **[`src/lib/peopleHoursPendingByCell.ts`](../src/lib/peopleHoursPendingByCell.ts)** (**`buildPeopleHoursPendingByCellMap`** folds **`pendingClockSessions`** + **`peopleHours`** + roster + visible day window into a `Map<personName|workDate, {count, pendingHours, peopleHoursValue, diffHours, sessionIds, sessions}>` — only emits keys where **`pendingHours > peopleHoursValue + 1e-9`**, skips salary-only people via the caller's **`isSalaryOnly`** predicate, and excludes rejected / revoked sessions). Covered by 6 unit tests in **[`src/lib/peopleHoursPendingByCell.test.ts`](../src/lib/peopleHoursPendingByCell.test.ts)**. The modal instance for this path passes **`allowNcnsFromMyTime={false}`** (no **NCNS** button). Opening My Time from a pending session row still allows NCNS per role rules. **At the top** (when **`canAccessPay`**): **Review Hours** and **People pay config** (outside any collapsible card; **`PeoplePayConfigModal`** for wages / the merged Include in Hours & crew costing flag—dev and pay-approved masters). **Review Hours** opens a modal (person/week, **Mark as reviewed**). **Below the grid** (when **`canAccessPay`**): **Due by Team**; **Teams** section (`people_teams`): pay-eligible users add/rename teams, add/remove members, or delete a team via **×** next to the name (confirmation modal). **Realtime**: hours views update when hours or sessions change—no manual refresh. (The **Cost matrix** grid, trade tags, tag colors, and the dev **Share Cost Matrix and Teams** grant retired in v2.673–v2.674.)
  - **Overhead tab** (`?tab=overhead`, **dev** and **master_technician** only — not **assistant**; **Teams** remains dev / master / assistant): week / custom **Start** / **End**; **Advanced** / **Simple** table view (**`overheadTableViewStorage.ts`**, localStorage **`people_overhead_table_simple_view_v1`**): **Simple** hides **Bid labor ($)**, **Office labor ($)**, and **Office parts ($)** — **Office Total ($) / Hours** and breakdown modals from those scopes are unchanged (**`RECENT_FEATURES.md`** v2.465). **Advanced** table columns: **Date | Bid labor ($) | Office labor ($) | Office parts ($) | Office Total ($) / Hours | Overhead % | Field Total ($) / Hours**; **Simple**: **Date | Overhead % | Office Total ($) / Hours | Field Total ($) / Hours** (no per-row **Detail** column or inline session list — v2.466; session lines live in breakdown modals). **Advanced** only: **Office Total ($) / Hours** has **no** left border (no vertical rule between **Office parts ($)** and **Office Total**); **Overhead %** and **Field Total ($) / Hours** keep left borders (**`RECENT_FEATURES.md`** v2.502). **Overhead %** = **Office Total ($)** ÷ **Field Total ($) × 100** per day (rounded whole percent; **`RECENT_FEATURES.md`** v2.501); **—** when field total is $0. Toolbar **Overhead office job** (dev) opens a modal to set **`app_settings`** **`overhead_office_job_ledger_id_v1`** (**Choose / Change / Clear** via **`search_jobs_ledger`**). **Labor** from **approved, closed** **`clock_sessions`** on the org **office** **`jobs_ledger`** and time on **bids** (`bid_id` set; if both office job and bid are set on a session, **office** wins); **$** = hours × **`people_pay_config.hourly_wage`**. **Office parts ($)** = materials on that office job: **Mercury** allocations by **posted** date (Chicago), **supply** invoice allocations by **invoice** date, **tally** lines by **`created_at`** (Chicago); **Total ($)** (dollars in the combined column) = labor + office parts (no cross-source dedupe). The **hours** figure in **Office Total ($) / Hours** is the sum of **office + bid** overhead session hours that day only (parts add no hours). The **hours** in **Field Total ($) / Hours** are **jobs-ledger** field labor hours for that column’s scope only (not bid-only clock; materials add no hours). **Field total ($)** = labor on other **`jobs_ledger`** rows (not bid-only) plus materials on those jobs when an office job is configured; when none is configured, all non–bid-only jobs ledger labor and all jobs’ materials — **not** added into overhead **Office Total ($)**. Click **$** cells for breakdown modals. **`fetchOverheadOfficePartsByDay.ts`**, **`fetchOtherJobsPartsByDay`**, **`mergeOverheadDayTableRows`**, **`overheadDailyLabor.ts`**, **`overheadOfficeJobSettings.ts`** (**`RECENT_FEATURES.md`** v2.459–v2.462, v2.466).
  - **Team Costs Tab** (dev, approved masters, assistants): **Crew Jobs / Bids** table with date picker and prev/next day buttons; per-person job/bid percentage assignments (each row owns its own percentages — the "inherit from crew lead" feature was frozen in **v2.538**, see **`RECENT_FEATURES.md`**, **MIGRATIONS.md** `20260516154601_freeze_crew_lead_inheritance` and `20260516162434_drop_crew_lead_inheritance_from_sync_rpcs`). **Team Job Labor** table: all-time aggregate of jobs with man hours and cost; searchable; clickable breakdown modals.
  - **Vehicles Tab** (dev, pay-approved masters, assistants): Fleet vehicle CRUD (year, make, model, VIN, weekly insurance/registration cost); odometer entries (date + value); possession assignments (user + start/end date). Vehicle info shown on Pay reports when user has possession during pay period (person_name must match users.name).
  - **Housing Tab** (dev, pay-approved masters, assistants): Housing unit CRUD (address; weekly rent, utilities, insurance); possession assignments (user + start/end date). Housing line items appear on Pay reports when the person has an assignment overlapping the stub period (`housing_units`, `housing_possessions`).
  - **Offsets Tab** (dev, pay-approved masters, assistants): **Backcharges**, **damages**, and **employee credits** (`person_offsets.type`). Pending rows (`pay_stub_id` null) or Applied (linked to a pay stub). Pending offsets appear on printed pay reports. **Employee credit** is money owed *to* the person (e.g. overpayment recorded as an offset); it is **not** applied as a **Less** deduction from **PayStubLessModal** (no **Apply** for that type). Other offset types still flow through **`pay_stub_deductions`** when applied from **Less** or the Offsets tab.
  - **Contracts Tab** (dev, pay-approved masters, assistants): **Search** across people and contract names (matching document lines in results). **Manage templates** lists each **`contract_templates`** title with indented **`contract_template_documents`** (Contract Book library rows). **Assign template** opens a searchable modal; **Contract Book** modal (**View** / **Edit**) saves via RPC **`update_contract_book_entry`** (library **`book_body_*`**, **`tags`**, optional **`canonical_document_url`**, rename with cascade to assigned **`person_contract_documents`** where the old name matches). **Destructive actions are dev + master_technician only** (**`canDeletePeopleContracts`**): **assistant** does not get row **⋯ → Delete**, **Manage templates → Delete**, edit **Delete**, **Contract Book Delete**, **Unassign** in the assign modal, or template save that **removes** checklist document lines — **Postgres RLS** also omits plain **assistant** from **DELETE** on **`contract_templates`**, **`contract_template_documents`**, **`person_contract_assignments`**, and **`person_contract_documents`** (**`MIGRATIONS.md`**, **`20260502070926_contract_tables_assistant_no_delete.sql`**; **`RECENT_FEATURES.md`** v2.464). Per-person table: multiple **`person_contract_documents`** rows per logical agreement — **`contract_lineage_id`** + **`lineage_version`** (**Ver.** column); **`supersedes_person_contract_document_id`** links an amendment row to the prior signed row. **Applied version** prefers **`applied_contract_template_document_id`** when set, else the newest **`contract_template_documents.updated_at`** among assigned templates for that **`document_name`**. Saving **Contract Book** after a signer’s latest row is **`signed`** appends a new **`unsent`** row (next version) via **`create_pending_contract_versions_after_book_save`** — staff **Send** / **Resend** signing email uses the row **`id`** as today. Row **⋯** menu holds **Edit document** and related actions. **Add document**: **Upload Signed** vs **Request Signature**; public signing **`/contract/accept`** and Edge **`get-contract-for-signer`** / **`accept-contract`** / **`send-contract-for-signature`**. The public page shows the document **title** and signing content (no **For:** signer-name line); thank-you uses **title-only** copy, **`public/pup.jpg`**, and a bottom CTA (**Dashboard** vs **Sign in**) driven by **`list_my_contract_dashboard_prompts`** when the browser has a session (**`RECENT_FEATURES.md`** v2.368). See **`RECENT_FEATURES.md`** v2.365–v2.346; **`MIGRATIONS.md`** (`20260421055733`, `20260421054257`, related **Contract Book** RPC migrations).
  - **Payroll tab** (`?tab=pay_stubs`; UI label **Payroll**): Single-person pay report generator (person + date range). **Draft Payroll** (**[`DraftPayrollModal.tsx`](../src/components/pay/DraftPayrollModal.tsx)**) sits on the right of the toolbar and opens with the **prior** Sunday–Saturday week (**`en-CA`**) merging **`people_crew_jobs`** / **`people_crew_bids`** into the review grid — grid **Cash Due** = hours × **`people_pay_config.hourly_wage`**; **Hours** &gt; **0** opens **[`DraftPayrollPersonHoursBreakdownModal`](../src/components/pay/DraftPayrollPersonHoursBreakdownModal.tsx)** (**[`draftPayrollPersonBreakdown.ts`](../src/lib/draftPayrollPersonBreakdown.ts)**, **[`payReportAssignmentsBreakdown.ts`](../src/lib/payReportAssignmentsBreakdown.ts)**); row **View** is neutral grey (**`#6b7280`**); **dev** **`PayStubDeleteIcon`** beside **View** deletes the stub (**`payStubDeleteConfirm`**, **`Z_PEOPLE_PAY_MODAL_NESTED`** so confirm stacks above the modal). **Print**: period line includes **(Week N)** (ISO week from stub midpoint — **`ymdAddDays`**, **`isoWeekNumberFromGregorianYmd`**); roster **`N of M paid · Total · Left`** summary (**left-aligned**, matches modal banner). **Ledger** lists pay stubs with a full-width **Search** (person name) and a helper line under **Ledger** (unpaid stub count + sum of **Balance** for the filtered list); empty-state copy points to **Draft Payroll** when nothing matches. Columns: Person (link → **Annual Pay to Date** grid: earned vs **allocated** pay by work day from `pay_stub_days`—not cash payout dates), Period, Hours, **Gross Pay**, **Less** (click dollar amount to open modal: manual charges or apply pending offsets that are not employee credits), **Additional** (click to open **[`PayStubAdditionalModal`](../src/components/pay/PayStubAdditionalModal.tsx)**: quantity × rate lines, **Ideal Total** / **Change Line to hit Target** tools, and optional **prevailing wage** top-up from **approved** **`clock_sessions`** in the stub period—**`source_clock_session_id`** on **`pay_stub_additional_lines`**; human-readable **`description`**; **`RECENT_FEATURES.md`** v2.345), **Net Pay**, **Paid to date**, **Balance** (vs Net Pay), **Payment** (Unpaid / Partial / Paid, detail icon for installments and optional per-row delete, or legacy memo), **Record payment** (single **Amount paid**; confirm records up to remaining balance, optional flow to record excess as **employee credit**; DB trigger prevents total installments from exceeding **Net Pay**), Created, **Actions** (**Print**). Devs: red trash **PayStubDeleteIcon** to delete a stub.
  - **Pay Report** (pay stub document): Date | Hours | **Jobs / Bids** from `people_crew_jobs` / `people_crew_bids`; **Gross Pay**, optional itemized **Additional** (`pay_stub_additional_lines`; descriptions omit any legacy **`[pw:<uuid>]`** machine prefix in HTML output), **Less** and **Net Pay**; pending offsets FYI; **Vehicles** then **Housing** (weekly amounts for units in possession during the period); **Physical payments** footer from `pay_stub_payments` (amount, date, memo, total).
  - **Review Tab** (dev-only): Per-person metrics for a selected period (today, yesterday, last week, last two weeks, last 30 days): Profit for this period, Revenue per Man Hour, Profit per Man Hour; Jobs Worked list; Hours and Pay. **Only Count Jobs Marked Paid in Full** checkbox: when checked, revenue, profit, and labor hours exclude non-paid jobs; uses paid-only RPCs and filters labor/crew jobs to paid jobs only.
    - **Team Summary** (embedded iframe + **Open in print view** popup, both via **`openTeamSummaryWindow`**, auto-refreshes when the period / paid toggle / pay config / 90-day overhead rate changes — `srcDoc={teamSummaryHtml}` + `team-summary-resize` `postMessage` for height). Iterates `showPeopleForReview` (sorted `payConfig` keys, excludes archived + external-only). Per-person row built by **`derivePersonTeamSummary`** from a single shared **`TeamReviewUnion`** (`loadTeamReviewUnion`).
    - **11 columns**, sorted by `r.profit` desc with name tiebreak: **Name** · **Hours** · **Overhead hrs** (Office + Bid) · **Overhead labor** · **Field hrs** · **Gross Revenue** · **Net Revenue** · **Profit (after overhead)** · **Gross Revenue/hr** · **Net Revenue/hr** · **Profit/hr (after overhead)**. Footer is the team total. Every cell is click-to-drilldown via a `data-type` attribute → `<dialog>`-style modal with its own `buildXxxBody` HTML; `Escape` / backdrop / × close. Print mode (`@media print` in the generated HTML) hides modals + click chrome.
    - **Overhead labor column** (**v2.540**, between Overhead hrs and Field hrs): per-person `-((officeHours + bidHours) × people_pay_config.hourly_wage)`, stored as a **negative dollar amount** so it renders `-$X` red via `negStyle` and sums to a negative team total. Field labor is intentionally excluded — it is already subtracted at the per-job level inside Net Revenue (`job_net = revenue − parts − total_labor`), so listing it again here would visually double-count for field workers. The drilldown (`buildOverheadLaborBody`) shows source / hourly_wage / Office / Bid split + a separate **For context: this person's field labor** memo row that displays `fieldHours × wage` greyed out with the explanatory note that it lives in Net Revenue. Pure field workers render `—` (cell not clickable when `n >= 0`).
    - **Convention 1** (**v2.539**): per-person crew labor in `derivePersonTeamSummary` (and lifetime `teamLaborCostByJobId` denominator in `loadTeamReviewUnion`) multiplies crew percentages by **`dayHoursRaw`** (share of total session hours, including the configured Office overhead job), matching the **`sync_crew_jobs_from_clock`** trigger. Print footnote on the Field hours drilldown describes "day total × pct, Office filtered as overhead."
    - **Profit (after overhead)** uses Method A: `r.profit − r.fieldHours × overheadRate`, where `overheadRate = overheadTotal / fieldHours90d` from `reviewOverheadRates`. Office and bid hours are not charged the rate (they fund it). Per-person row therefore shows `$0` Profit (after overhead) for pure office workers — their cost shows in the new **Overhead labor** column instead. The **Overhead Method A: $X / field hour (rolling 90-day rate)** meta line above the table opens an "Overhead rate decomposition" modal (`buildOverheadRateBody`).
    - **Files**: [`src/pages/People.tsx`](../src/pages/People.tsx) — `derivePersonTeamSummary` (~L8556), `loadTeamReviewUnion` (~L8260), `openTeamSummaryWindow` / iframe HTML (~L8851–9850), Team Summary embedded UI (~L17324). See **`RECENT_FEATURES.md`** **v2.540** (Overhead labor column), **v2.539** (Convention 1 / Option E).
  - **Feedback Tab** (dev-only): **[`TeamFeedbackDevSettingsBlock`](../src/components/team-feedback/TeamFeedbackDevSettingsBlock.tsx)** standalone layout — **Enabled** (persists to **`team_feedback_settings`**), **Last collected**, **Settings** (modal: cadence, copy, previews via **[`TeamFeedbackSettingsSection`](../src/components/team-feedback/TeamFeedbackSettingsSection.tsx)**), **Eligibility** (modal: **[`TeamFeedbackEligibilityOverview`](../src/components/team-feedback/TeamFeedbackEligibilityOverview.tsx)**), raw submissions (**[`TeamFeedbackDevReports`](../src/components/team-feedback/TeamFeedbackDevReports.tsx)**: inline **`TeamFeedbackSubmissionDetailModal`** on row click, dev delete, CSV). Parity with **Settings → People & accounts** team feedback block; see **`RECENT_FEATURES.md`** v2.290.
  - **Master Shares**: When a Dev shares with another Master, that Master and their assistants see shared people; shared people show "Created by [name]" instead of Archive
  - **Data**: `people`: name, email, phone, notes, kind; optional **`account_user_id`** (`users.id`) links a roster row to exactly one login for clock → pay resolution. Logged-in **users** also have `users.notes` (app UI: full name and title) and `users.phone` (editable with notes on the Users tab for eligible roles). **`people_pay_config`** / **`people_hours`**: canonical **`person_id`** → **`people.id`** (plus denormalized **`person_name`** for display and legacy queries); satellite pay tables (**`people_hours_display_order`**, **`hours_reviewed`**, **`person_offsets`**, **`people_team_members`**, **`people_crew_*`**, **`pay_stubs`**, **`pay_stub_days`**) also carry **`person_id`** where applicable. people_pay_config (hourly_wage, is_salary, show_in_hours, show_in_cost_matrix); people_hours (person_name, person_id, work_date, hours); people_crew_jobs (work_date, person_name, person_id, crew_lead_person_name (deprecated; always NULL after v2.538 freeze migration), job_assignments); people_crew_bids (work_date, person_name, person_id, crew_lead_person_name (deprecated; always NULL after v2.538 freeze migration), bid_assignments); people_teams; clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, approved_at, approved_by, rejected_at, rejected_by, revoked_at, revoked_by); hours_reviewed (person_name, person_id, start_date, end_date, reviewed_by, reviewed_at) for **Review Hours** / hours-reviewed workflow on **People → Hours**; pay_stubs / pay_stub_days / **pay_stub_deductions** / **pay_stub_additional_lines** (optional **source_clock_session_id** → **clock_sessions** for prevailing-wage lines) / pay_stub_payments for **Payroll** tab; **user_dashboard_goals** / **user_daily_goals_ack** for My Roles Goals. Job/Bid display: `J123 · [name] - [address]` for jobs, `B456 · [project name] - [address]` for bids.
- **Pay roster**: `allRosterNames()` builds the pay-config roster on **Hours** from all non-dev `people` kinds (including **primary** and **superintendent**) merged with matching user accounts via `byKind`. **Devs are excluded**—they do not appear in **People** pay config. If a dev's clock session is approved, hours go to `people_hours` but are not visible in the Hours grid.
- **Cross-midnight work**: `work_date` is set from clock-in date. All session hours are attributed to that date; hours after midnight are not split across days.
- **Note**: Labor and Sub Sheet Ledger (labor jobs) were moved to the **Jobs** page; see section 6.

### 6. Jobs Page
- **Page**: `Jobs.tsx`
- **Shared jobs list**: [`JobsListCacheProvider`](../src/contexts/JobsListCacheContext.tsx) in [`App.tsx`](../src/App.tsx); [`Jobs.tsx`](../src/pages/Jobs.tsx) and [`JobsAccountsReceivable.tsx`](../src/pages/JobsAccountsReceivable.tsx) use [`useJobsListCache`](../src/contexts/JobsListCacheContext.tsx) so one fetch (per user + optional Stages customer filter) backs the main jobs board and **Accounts Receivable** without redundant loads (**`RECENT_FEATURES.md`** → v2.380).
- **Header**: "Jobs" title on the right of the tab bar (matches People page pattern)
- **Tabs** (in order): Reports | **Stages** (default) | Billing | **Team Labor** | **Sub Labor** | **Crew P&L** (dev-only, tab key `teams-summary`) | Parts | Job Summary | Inspections
- **Features**:
  - **Reports tab**: Field reports list, **New report**, **Templates** for users who manage report templates. **Recurring Email Reports** ([`RecurringEmailReportsModal.tsx`](../src/components/jobs/RecurringEmailReportsModal.tsx)) — dev, master_technician, and assistant: **recurring** wall-clock schedules (`recurring_job_report_schedules`), per-recipient routing (`recurring_job_report_schedule_recipients`) with **activity scope** (calendar yesterday / today / this week / last week), **crew filter** (**all users** vs **my team** via `team_leader_assignments`), and optional **Include costs** (adds a **Cost** column to clock-time rows in HTML and plain-text email: **hours × `people_pay_config.hourly_wage`** when **`trim(users.name)`** matches **`person_name`**; **—** when wage is null or there is no pay row). Digest subject/body use **Daily summary** vs **Weekly summary** labels in [`recurringJobReportCore.ts`](../supabase/functions/_shared/recurringJobReportCore.ts) by scope. **Preview** / **test send** invoke Edge **`recurring-job-report-preview`** and **`recurring-job-report-test-send`**; production send uses pg_cron **`recurring-job-report-dispatch`** (**`CRON_SECRET`**, **`RESEND_API_KEY`**). Idempotency row per schedule + recipient + **`reporting_date`** in **`recurring_job_report_dispatch_log`**. This is **not** the Dashboard **Email schedule** (one-off **Schedule Dispatch** day email — see **§8 Dashboard**). Implementation: [`recurringJobReportCore.ts`](../supabase/functions/_shared/recurringJobReportCore.ts); **`RECENT_FEATURES.md`** v2.420, v2.425; **`EDGE_FUNCTIONS.md`**; **`MIGRATIONS.md`** (`20260430054614`, `20260430071645`).
  - **Sub Labor Tab** (Sub Sheet Ledger): Add labor jobs; form fields: **Top row** HCP, Address, Distance (mi), Date of Labor, Service type (all same height). **Subcontractors**: **Search for crew** — centered field, **placeholder** + **`aria-label`** (no separate label above the input). When the search text is non-empty, **External Subs**, **Internal Subs**, and **Office Team** each show only if that group has at least one matching name; if none match, a single muted **No crew match this search** line appears. **External Subs** list with **Add Sub** (opens add-person modal titled **Add Sub**). **Internal Subs** and **Office Team** are collapsible: headers are full-width; **collapsed** state: **▶** and title **centered**; **expanded** state: **▼** and title **left-aligned** above the checkbox list. **Specific Work (Line Items)**: **Link Invoice** (left) and **Add line item** (right) below the bordered table; **Link Invoice** expands an inline URL field with **Save** / **Cancel** (Edit saves immediately to DB; New commits locally until main **Save**). Saved links show in the expanded Sub Labor table row as a clickable **Invoice link**. **Itemize hours and rate** (in the totals row) uses a **muted grey** label. **New / Edit Sub Labor** modal footer (right-aligned): **Cancel**, **Print**, **Save**; when Save is disabled, the orange **Required:** field list appears immediately **to the right of Save**; **Delete** follows when editing an existing job. Fixture rows: Fixture, Count, hrs/unit, Fixed, Labor Hours, Rate ($/hr) per row, Cost per row; default rate $20. Count, hrs/unit, and Rate inputs blur on scroll to prevent accidental value changes. Collapsible **Labor book** section: select version, apply matching labor hours to form rows; manage versions and entries (Rough In, Top Out, Trim Set hrs). Table of all labor jobs (User, Job #, Address, Distance, Labor rate, Total hrs, Drive, Total cost, Print for sub, Date); Distance has inline Edit button; Edit opens modal; Delete removes job; date editable inline. **Edit Sub Labor** modal: Payments table with Date, Type, Amount, Memo, Edit button per row; Edit opens Edit Payment modal (Amount, Memo, Remove with confirmation, Cancel, Save). Remove is moved into the Edit Payment modal, not in the row. Uses same roster (people + users) as People.
  - **Team Labor Tab** (dev, master; hidden from assistants): Uses **`CrewJobsBlock`** (same as Quickfill **Crew Jobs / Bids**): per-day assignments + Team Job Labor table—all-time aggregate of jobs from **`people_crew_jobs`**. Columns: HCP, Job name + address, Team Job Labor total. Click a row to expand per-person breakdown: Person | Crew Job Costs | Crew Man Hours. Searchable by HCP, job name, address. **Realtime** on **`people_crew_jobs`** / **`people_crew_bids`** (filtered by selected date) refreshes the grid and aggregate when **`approve_clock_sessions`**, sync RPCs, or the **`clock_sessions_sync_crew_assignments_tr`** trigger updates rows (**`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`**). Add jobs via Sub Labor or Jobs Team Labor or Quickfill Crew Jobs.
  - **Billing Tab** (HCP Jobs): Jobs ledger (HCP #, Job Name, Address, materials, team members, revenue); New Job, search; **Edit** and **Delete** per row, vertically centered in the row. **Edit Job** footer **Delete** (non-primary) opens an in-app **confirm** dialog (**`deleteJobConfirmOpen`** in **`JobFormModal`**) instead of **`window.confirm`** (**`RECENT_FEATURES`** v2.344). Google Drive and Job Plans icons shown when links are filled; stacked vertically. New/Edit Job modals include Job Total ($) and Remaining ($) side by side; **Job Total** and **Payments received** amounts show **comma thousands** on blur (`Jobs.tsx`, `MoneyDecimalAmountInput`). **Billing** accordion in **Edit Job** ([`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx)):
    - **Ready to Bill**: draft invoice list with **See in Stages** and **Preview / Stripe bill…** (Bill Customer via [`BillCustomerModalContext`](../src/contexts/BillCustomerModalContext.tsx)).
    - **Partial invoice** (below **Ready to Bill**, above **Outstanding billing**): gray card with **Break off Invoice:** / **Send to Ready to Bill:** label, amount field, **`+`** or **Ready to Bill** button, then a muted **`N% of job total`** (payments plus current draft amount vs Job Total; **hidden** at **100%**). **Billing progress** track: paid (blue), draft preview (light blue), **5%** tick marks, optional yellow **field progress** dot (`pct_complete`), green triangle thumb — thumb snaps to **5%** while dragging (`JobFormModal.tsx`, **`snapBreakOffCombinedPctToStep`**). Gray footer line *Break off an amount…* only (no section title; **Remaining (billable)** / **Use full remaining** not shown).
    - **Outstanding billing**: table **Date** (short month + day and **`(+n)`** calendar age from invoice creation), **Billed**, **Actions**—**Discount** ( **`dev`** / **`master_technician`** / **`assistant`** / **`primary`** when the billed line has open balance; **[`AgreedWriteDownModal.tsx`](../src/components/jobs/AgreedWriteDownModal.tsx)** — non-Stripe **`apply_agreed_write_down_to_billed_invoice`**, Stripe **`stripe-invoice-agreed-write-down`** + **`service_apply_agreed_write_down_from_stripe`** ), **See in Stages** (omitted when exactly one billed row and amount equals Job Total from Specific Work in Edit Job), **Bill** (Stripe hosted invoice), and compact **StripeInvoiceSharePanel** copy/SMS/email icons in one row; optional full-width second row for **outside send Note** and **Stripe memo** (no gray panel; no top border above that row). **Label** column removed; layout uses fixed column widths. **[`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.524**.
    - **Payments received**: same section title / scroll wrapper pattern as Outstanding billing; columns **Date**, **Amount ($)**, **Memo**; **Record Payment** (right-aligned). **Stripe-linked** payment rows: default body background + **blue left inset** only (not the same gray as **thead**). **Mercury-linked** rows (read-only): **Unlink and remove** calls RPC **`remove_jobs_ledger_payment_and_reconcile`** (**`SECURITY DEFINER`**, migration **`20260501030427`**): deletes the **`jobs_ledger_payments`** row, recomputes **`jobs_ledger.payments_made`**, reconciles **`jobs_ledger_invoices`** **`paid`/`billed`** from remaining amounts when **`invoice_id`** is set (**non-Stripe** invoices only — Stripe-hosted rows with **`stripe_invoice_id`** are rejected by RPC and **Unlink** is hidden in UI), may move **`jobs_ledger`** **`paid`→`billed`** when revenue exceeds payments; frees Mercury allocation capacity on that deposit so **Bank payments** can re-apply it. Persisted **non-Mercury** rows on **non-Stripe** invoices use the same RPC when removing after confirm. Removing the sole payment line still seeds **`[newEmptyPaymentRow()]`** after refresh (**`RECENT_FEATURES.md`** → v2.436, v2.336). After **Undo out-of-band payment** on a hosted Stripe bill (**`UnwindStripeOobPaymentModal`**), **`refreshEditingJobAndHydratePayments`** reapplies form rows from the server so **Payments received** does not stay on stale local state (**`RECENT_FEATURES.md`** → v2.363). Read-only **Ref** shows **`abc..xyz`** for long / UUID-shaped **`reference_number`**; click copies the full value ([`abbreviatePaymentReference.ts`](../src/lib/abbreviatePaymentReference.ts)).
  - **Customer link for Ready to Bill billing** (`jobs_ledger.customer_id`): Required before **Invoice / Update** or **Ham mode** instant **billed** on **Stages**. If missing: toast and **Edit Job** opens with **Customer** expanded and red emphasis on **Link to customer** + **Create customer from job** (`billingCustomerHighlight`). **Dashboard** Ready to Bill shows a toast only. **Bill Customer** (**`SendRecordInvoiceModal`**) is opened via shared **[`BillCustomerModalContext`](../src/contexts/BillCustomerModalContext.tsx)** / **`BillCustomerModalProvider`** in **`App.tsx`** from Jobs Stages, Dashboard Ready to Bill, and **Edit Job** billing (**Preview / Stripe bill…** on **Ready to Bill** rows). The modal has three top tabs — **Stripe bill**, **HouseCall Pro**, and **Physical invoice** (external sends use date + memo and set **`external_send_channel`** **`housecallpro`** or **`physical`**). The **Stripe bill** tab shows a debounced **pre-submit preview** via Edge **`preview-stripe-invoice`** ([`StripeBillPreSubmitPreview.tsx`](../src/components/jobs/StripeBillPreSubmitPreview.tsx), [`stripeInvoicePreview.ts`](../src/lib/stripeInvoicePreview.ts)); **`preview-stripe-invoice`** applies **`stripeInvoiceLinesDataForFixtureOrderDisplay`** on **`lines.data`** so **multi-line** staff previews list rows in **invoice.stripe.com** order when the Stripe API returns an inverted line array (**`RECENT_FEATURES.md`** **v2.528**); **Share/copy** helpers live in [`stripeInvoiceShareCopy.ts`](../src/lib/stripeInvoiceShareCopy.ts) (**`StripeInvoiceSharePanel`**). When the job has **billable** Specific Work rows (non-empty **`name`**, **`count × line_unit_price` > 0**), **Line on bill** defaults **empty** so **`preview-stripe-invoice`** / **`create-stripe-invoice`** emit **one Stripe line per fixture** in **`jobs_ledger_fixtures.sequence_order`** ascending (same order as **Physical** invoice services and Edit Job **Specific Work**), unless the user enters custom text, which forces a **single** line for the full amount. **`SendRecordInvoiceModal`** and Edge **`create-stripe-invoice`** enforce the same customer rule. **`get_jobs_ledger_by_status`** includes **`customer_id`** for Dashboard job cards (`20260330065236`).
  - **Bill Customer** ([`SendRecordInvoiceModal.tsx`](../src/components/jobs/SendRecordInvoiceModal.tsx)) — Opened via **[`BillCustomerModalContext`](../src/contexts/BillCustomerModalContext.tsx)**; optional **`onAfterOobUnwindSuccess`** (e.g. from **Edit Job**) runs after **Undo out-of-band payment** on the post-create hosted bill so the parent job and **Payments received** stay in sync (**`RECENT_FEATURES.md`** → v2.363). **Line on bill** and **Memo** are **collapsible** (collapsed by default) on **Stripe bill** and **Physical invoice**; **HouseCall Pro** collapses **Memo** only. **[`billCustomerMemoPresets.ts`](../src/lib/billCustomerMemoPresets.ts)** normalizes memo preset bodies with **[`normalizePhysicalInvoiceFooterPlainText`](../src/lib/physicalInvoiceDocument.ts)** before applying the character cap; active preset highlighting uses the same normalization. **Physical invoice** Resend email HTML/text from **[`buildPhysicalInvoiceEmailBodies`](../src/lib/physicalInvoiceDocument.ts)** omits **Service date** and the prior **Issuer** summary block; issuer **tagline** (Settings → physical issuer) appears **bold** under the intro. The attached **PDF** remains the full layout. After **Stripe bill** create, **HouseCall Pro** save, or **Physical invoice** email success, **`maybePromoteJobToBilledAfterCustomerInvoice`** ([`promoteJobToBilledIfFullyInvoiced.ts`](../src/lib/promoteJobToBilledIfFullyInvoiced.ts)) refetches the job and, when there is no remaining **`ready_to_bill`** line and **`jobBillingUnallocatedDollars`** ([`jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts)) is fully allocated to billed lines (same basis as Stages “unallocated” / RTB exposure), calls **`update_job_status`** so **`jobs_ledger.status`** becomes **billed**, inserting **ready_to_bill** first when the RPC requires it (**`RECENT_FEATURES.md`** → v2.366). Edge **`send-physical-invoice-email`** updates the invoice row and sends email only; it does **not** promote **`jobs_ledger`** by itself ([`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md) → **send-physical-invoice-email**).
  - **Last work date / Last bill date (Detail) / Last manual bill date** (`jobs_ledger.last_work_date`, UI-only middle row, `jobs_ledger.last_bill_date`): **Last work date** is maintained by the database: latest **`work_date`** among **approved** **`clock_sessions`** for the job (**`20260408013952_jobs_ledger_last_work_date_clock_sessions_trigger.sql`**). **Last manual bill date** (UI label; column **`last_bill_date`**) is the user-entered billing / Stages aging field (renamed from **`estimated_completion_date`**; **`20260408014106_rename_estimated_completion_to_last_bill_date_and_fix_rtb_rpc.sql`**). **Edit Job** edits **Last manual bill date** only. **Job Detail modal** ([`DetailJobModal.tsx`](../src/components/jobs/DetailJobModal.tsx)) shows **three** read-only date rows: **Last work date**, **Last bill date**, **Last manual bill date**. The **Last bill date** row is derived in the client by **`deriveRecordedBillingActivityDetail`** ([`stagesJobReferenceDates.ts`](../src/lib/stagesJobReferenceDates.ts)): calendar-latest **invoice / payment** activity only (`jobs_ledger_invoices` **`sent_to_customer_at`** / **`billed_at`**, `jobs_ledger_payments` **`paid_on`**). It **does not** duplicate **`last_bill_date`** (that is the **Last manual bill date** row). **`—`** when no activity qualifies; **limited** Detail loads without invoice/payment children always show **`—`** for **Last bill date** (see modal source). Primary line + **`title`** tooltips use [`formatJobDetailModalDateYmd.ts`](../src/lib/formatJobDetailModalDateYmd.ts). **Stages `b:`** still uses **`deriveStagesBillingActivityDetail`**, which **includes** **`last_bill_date`** with invoice/payment dates. Invoice **`estimated_bill_date`** still falls back to **`last_bill_date`** when null.
  - **Job Detail modal** (open from Jobs, Dashboard **Assigned Jobs** / **Superintendent Jobs** title, Dashboard **My schedule**, Schedule Dispatch hub job title, etc.): **Title row** — `h2` plus optional **trade** pill (**PLUM** / **ELEC** / **HVAC**, same rules as Jobs Stages job subline) from [`buildServiceTypeTradePill.ts`](../src/lib/serviceTypeTradePill.ts) / [`getBidServiceTypeTag`](../src/utils/unifiedJobBidSearch.ts) when a service type name is present; **Edit** (gear) when the role allows. **Close** is a **bottom-right** footer at the end of the dialog body (scrolls with content inside the modal). There is **no** separate **Service type** row under **Status**. On **limited** (e.g. subcontractor) loads, muted *Payments and invoices are not shown…* / *You are assigned…* lines are **centered**. **`useNarrowViewport640`** — ~640px and below stacks the three-date band vertically; wider viewports use a 3-column date grid (each date in a soft box). **Status** (**`JobLedgerStatusPipeline`** — [`JobLedgerStatusPipeline.tsx`](../src/components/jobs/JobLedgerStatusPipeline.tsx), [`jobsLedgerStatusPipeline.ts`](../src/lib/jobsLedgerStatusPipeline.ts)) sits centered below the dates: **Working → Ready to bill → Billed → Paid** with the current step emphasized. **Job Total** is below **Specific Work (Fixtures / Tie-ins / Repair)** on full detail (and below **Materials cost** on limited snapshot views that omit fixtures); **`subcontractor`** omits **Job Total** (`showJobDetailJobTotal` in [`jobDetailModalRole.ts`](../src/lib/jobDetailModalRole.ts)). **Customer Files** / **Job Plans** ([`DetailJobModalFilesPlansRow`](../src/components/jobs/DetailJobModal.tsx)): the row is omitted when both **`google_drive_link`** and **`job_plans_link`** are empty after trim; otherwise only the columns with a link are shown. **Assigned Team**: read-only **`team_members`** list (**No team members listed.** when empty). **Specific Work (Fixtures / Tie-ins / Repair)** lists each fixture as **`[1]`**, **`[2]`, …** followed by **name × count**, optional **`@ $… ea.`** from **`jobs_ledger_fixtures.line_unit_price`**, and optional **`line_description`** (scope) on a second muted line. For **Stripe** hosted invoices, each row’s line item description is **`name`** plus, when scope is non-empty, **` — `** + trimmed scope, clamped to **500** characters (see [`stripeInvoiceItemsFromFixtures.ts`](../supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts)). **New/Edit Job** ([`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx)) Specific Work **3-column** table: first row **Line Item**, **Count**, and a third column with **Unit price** (**`MoneyDecimalAmountInput`**) and **+** / remove in one **flex** row (minimal gap); below that row, **`(n / 500) · name and optional scope for Stripe`** ([`stripeInvoiceFixtureLineLength`](../src/lib/stripeInvoiceLineDescription.ts)); **Add scope or notes** expands a full-width scope **`textarea`** (**`colSpan` 3**) with a visually hidden label (no visible **Description** heading). Full-detail sections use headings **Other job charges** and **Specific Work (Fixtures / Tie-ins / Repair)**. **Materials cost** ([`JobDetailMaterialsCostSection.tsx`](../src/components/jobs/JobDetailMaterialsCostSection.tsx)): same four accordions as **Edit Job** (supply house invoices, Mercury card charges, Job Parts Tally, **Other job charges**), loaded via [`fetchJobMaterialsCostSnapshot.ts`](../src/lib/fetchJobMaterialsCostSnapshot.ts) / **`useJobMaterialsCostSnapshot`**; expandable rows for roles allowed by **`canExpandJobDetailMaterials`** in [`jobDetailModalRole.ts`](../src/lib/jobDetailModalRole.ts) (dev, master_technician, assistant, primary, superintendent, estimator); **subcontractor** gets a non-expandable summary. **Mercury** lines table: **Posted** as short US date ([`formatMercuryCardChargesPostedDate.ts`](../src/lib/formatMercuryCardChargesPostedDate.ts)); **Card** column from debit card id in transaction **`raw`**, with nicknames from [`useMercuryLedgerNicknames.ts`](../src/hooks/useMercuryLedgerNicknames.ts). **Edit job** (gear on the **title** row) keeps Detail open and opens **`JobFormModal`** above it (**`JOB_FORM_OVERLAY_Z_INDEX`** 1010 vs Detail backdrop 1004 in [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx)); on save, Detail refreshes (**`loadDetail`**, **`materialsCostRefreshKey`**). **`onEditJobSaved`**: Schedule Dispatch hub passes a refresh callback; other entry points may omit. **Job thread notes** in Detail use **`JobThreadNotesPanel`** with **`showSectionTitle`**, **`showEmptyPlaceholder`**, and **`showComposerLabel`** disabled for minimal chrome (`RECENT_FEATURES.md` → v2.337, v2.278, v2.277, v2.276, v2.264); **v2.444** — **DetailJobModal** does not wrap the panel in an outer scroll container (thread scroll stays inside the activity region); **v2.445** — **`activity`** merges **`fetchJobScheduleBlocksForJob`** notes with thread rows (**`useJobThreadNotesForModal`**); **v2.446** — **Arrived** / **Leaving** stamps only on **Job Detail** (**`jobThreadStampActions`**); **v2.447** — header trade pill + bottom **Close** + centered limited footnotes; auto-grow composer and scroll-to-newest match Stages / Workflow panels.
  - **Stages Tab**: **Combine / Separate** (top toolbar **far right** — after **Total by Name** / icon cluster; **`C / S`** when the Stages **New Job** label shortens; **dev**, **master_technician**, **assistant** only): **[`JobsCombineSeparateModal`](../src/components/jobs/JobsCombineSeparateModal.tsx)** — **Combine** uses **`migrate_job_ledger_costs_and_delete`** (parity with **Edit Job → Migrate and Delete**); **Separate** uses **`split_job_ledger_fixtures_to_new_job`** on **working** jobs only (move selected **`jobs_ledger_fixtures`** and optional **`clock_sessions`**; v1 does not repoint parts tally, Mercury, supply allocations, crew jobs JSON, **`job_schedule_blocks`**, or reports — see **`RECENT_FEATURES.md`** **v2.516**). **Pipeline alerts** (top row): optional red-outline **No customer (n)** / **No customer pictures (n)** (**[`StagesNoCustomerJobsModal`](../src/components/jobs/StagesNoCustomerJobsModal.tsx)**, **[`StagesAlertJobListModal`](../src/components/jobs/StagesAlertJobListModal.tsx)**; lists follow **Stages search**; **no customer pictures** = **working** jobs with empty **`job_pictures_link`**, **[`jobsStagesBoard.ts`](../src/lib/jobsStagesBoard.ts)**). **Working** shows jobs with "Ready to Bill" button, **ClickTooling wrench icon** (safety orange; opens clicktooling.com with customer info pre-filled), and green Create Partial Invoice icon (to left of Edit); **AIA G702-G703** — green **FileSpreadsheet** icon when **`showAiaG702G703`** ([`aiaG702G703Eligibility.ts`](../src/lib/aiaG702G703Eligibility.ts); **`isStaffFullJobLedgerDetailRole`**, job **`status`** or standalone row **`jobs_ledger_invoices.status`** ∈ {**ready_to_bill**, **billed**}) opens [`AiaG702G703Modal`](../src/components/jobs/AiaG702G703Modal.tsx) (Mission Hills `.xlsx` prefill from job + physical issuer draft; **Change Orders** subtotal fields grouped in a collapsed **\<details\>** via **`detailsGroupId`** on [`aiaG702G703Template.ts`](../src/lib/aiaG702G703Template.ts)); **View bill** [`BilledBillViewModal`](../src/components/jobs/BilledBillViewModal.tsx) shows the same control when eligible (**`RECENT_FEATURES.md`** → v2.398). **Ready to Bill** and **Billed Awaiting Payment** show both **jobs** (status-based) and **invoices** in a **unified table** (jobs use blue buttons, invoices use green). When a **Ready to Bill** invoice has **`is_primary_rtb_bundle` true** (primary remainder from **`ensure_single_ready_to_bill_invoice_for_job`** / Stripe), **Stages** shows **one merged row** with job context plus that **Billing line** amount and both job-level actions and the green **Invoice / Update** for that line (see **`buildReadyToBillStageRows`** / **`job_with_primary_rtb`**). **Partial** drafts (**`is_primary_rtb_bundle` false**) use **separate** invoice rows, including when only one draft exists. **Paid in Full** shows jobs where payments_made ≥ revenue; stage title shows count only (no total). On **Ready to Bill** only, secondary actions are **Job: Send Job Back** (job row) and **Delete draft bill** (remove draft bill / bundle line); **Billed** rows keep **Send back** and **Remove line** (and matching confirmation modal copy). Job actions: Ready to Bill, **Invoice / Update** (**Bill Customer** modal via **`BillCustomerModalContext`**: top tabs **HouseCall Pro** and **Physical invoice** for external send + date + note, or whole-job **billed**; **Stripe bill** tab uses a debounced **pre-submit preview** (**`preview-stripe-invoice`**) before create, then calls RPC **`ensure_single_ready_to_bill_invoice_for_job`** to create or sync a single **`ready_to_bill`** `jobs_ledger_invoices` row from **unallocated** balance—revenue minus payments minus amounts already on **`ready_to_bill`**/**`billed`** invoice rows—unless multiple **`ready_to_bill`** rows already exist, in which case the user must use an invoice row or consolidate), Mark Paid, Send back. Invoice actions: **Invoice / Update** (same **Bill Customer** modal; **Stripe bill** tab creates Stripe invoice and stores **`hosted_invoice_url`** / **`stripe_invoice_id`** on **`jobs_ledger_invoices`**), Mark Paid, Send back. **Stripe** payment completion can flow through Edge **`stripe-webhook`** → **`mark_invoice_paid_from_stripe`**. **Total by Name** button next to Billed Awaiting Payment header opens modal with job-name breakdown; modal includes "take me to Job: Stages: Billed" link. **Bank payments** ([`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx); dev, master_technician, assistant, primary): **Accounts Receivable** beside the **Billed Awaiting Payment** header stays enabled for those roles even when **Stages search** hides all billed rows; **[`Jobs.tsx`](../src/pages/Jobs.tsx)** passes **`bankPaymentsModalBilledRows`** (**`buildJobsStagesBoardLists(jobs, '').billedRows`**) into the modal so allocation targets match the full billed board, while the **Billed** table and **Print** still use the search-filtered list (**`RECENT_FEATURES.md`** → v2.336). The modal allocates Mercury deposits to billed work (non-Stripe path); **Sorting configuration…** opens [`BankingSortingConfigModal.tsx`](../src/components/BankingSortingConfigModal.tsx) with title **Accounts Receivable Sorting** and per-user filters in **`bank_payments_sorting_config_v1_<userId>`** ([`loadBankPaymentsSortingConfig`](../src/lib/bankingSortingConfig.ts)), seeded once from shared Banking / Quickfill **`banking_sorting_config_v1_<userId>`**; [`useMercuryLedgerNicknames`](../src/hooks/useMercuryLedgerNicknames.ts) enriches lists when the hook is enabled. Optional **Kind** badge label + color (Accounts Receivable Sorting **Kinds** tab; **dev**-only editor) persist in **`app_settings`** (**`bank_payments_kind_badges_v1`**, JSON in **`value_text`**; [`appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts)), with **`localStorage`** as a read-through cache ([`bankPaymentsKindBadges.ts`](../src/lib/bankPaymentsKindBadges.ts)), and render as colored pills on **Bank transactions** (and the selected-transaction summary) for everyone who opens **Bank Payments**. **Accounts Receivable Sorting** also supports **exclude** lists: case-insensitive substring filters on Mercury **counterparty** and **note** ([`bankingSortingConfig.ts`](../src/lib/bankingSortingConfig.ts)); the same filter drives RPC **`count_mercury_transactions_for_bank_payments`** (Dashboard **Unallocated bank deposits** banner when count &gt; 0 — [`DashboardArBankUnallocatedBanner.tsx`](../src/components/DashboardArBankUnallocatedBanner.tsx), [`useArBankUnallocatedCount.ts`](../src/hooks/useArBankUnallocatedCount.ts), navigates to **`/jobs?tab=stages&openBankPayments=true`**). **Allocations** in [`BankPaymentsModal.tsx`](../src/components/jobs/BankPaymentsModal.tsx): row one — **billed line** picker + **Remove**; row two — **Amount**; **Add allocation** on a right-aligned footer row; Apply uses **`apply_mercury_bank_payment_allocations`**. Create Partial Invoice icon (Working, Ready to Bill) opens modal to create partial invoice. Edit pencil opens Edit Job modal. **Billed Awaiting Payment** only ([`renderUnifiedStagesTable`](../src/pages/Jobs.tsx) option **`editJobIconBesideTimeOpen`**): **Open …** (relative age) and **Edit** sit on the same primary actions row immediately after one another—**merged** rows use job **`created_at`**; **standalone** invoice rows use the billing line **`created_at`**. **Ready to Bill**, **Working**, and other callers keep **Edit** in the secondary icon row (wrench / partial invoice) when those controls apply. Stages opens by default (not Reports) for non-primary users. **Assigned / HCP column**: read-only **`j:`** and **`b:`** lines (T±n weekday labels): **`j:`** = later of **`last_work_date`** (approved clock sessions) and max **`job_schedule_blocks.work_date`** (schedule dates batch-loaded in **`loadJobs`**); the **`loadJobs`** effect depends on **`searchParams.get('customer')`** (**`customerParamForJobsReload`**) so unrelated query-string changes do not refetch the full jobs list; **`b:`** = calendar-latest of **last manual bill date** (**`last_bill_date`**) and billing-activity dates from **`jobs_ledger_invoices`** **`sent_to_customer_at`** / **`billed_at`** and **`jobs_ledger_payments`** **`paid_on`** (`—` when all are unset). **Ready to Bill**: **Missing Billed Date** (when **last manual bill date** is unset) stays a separate control. **View Reports column**: Report count ("X report(s)") displays bold and darker when count > 0; muted when 0. **Confirmation modals** (when Ham mode OFF): Ready to Bill, **Invoice / Update** (external-send path requires checkbox), Mark Paid, and Send back use confirmation before proceeding. **Ham mode** (dev/assistant only): When ON, **Invoice / Update** skips the modal and sets **billed** in one click (same as before); other Ham shortcuts unchanged (invoice rows may still offer ±1 on per-invoice est. bill date). **Last activity** column: read-only preview of the latest **job thread** note (author, Central Time weekday + time, days-ago label, clamped body from `jobs_ledger_thread_note_stats`); **—** when there are no thread notes. When the job has **exactly one** unambiguous **billed** Stripe line with **`sent_to_customer_at`** set (**`stagesJobLevelStripeEmailedHintInvoice`** in [`Jobs.tsx`](../src/pages/Jobs.tsx)), a second block appears below the thread preview (or below **—** when there are no notes): three lines — **Stripe emailed customer**; send time + days-ago (**`getDispatchNoteDisplayMeta`**); **[`StripeInvoiceSendFromStripeButton`](../src/components/jobs/StripeInvoiceSendFromStripeButton.tsx)** **Resend invoice email** (Edge **`send-stripe-invoice`**, same confirm modal as **Send Email invoice from Stripe** in **Bill Customer** / hosted bill UI). Resend uses **`micro`** / **`unboxed`** styling, **`hideInlineSuccessLine`** so the green inline line does not duplicate the hint, and is disabled when **`stripe_invoice_status`** is **paid**. **`sent_to_customer_at`** on the ledger row is updated to the **latest** send; append-only **`jobs_ledger_invoice_stripe_email_sends`** stores each successful **PipeTooling** send for the **Send Email invoice from Stripe?** modal **Most recent sends** list ([`StripeInvoiceSendFromStripeButton`](../src/components/jobs/StripeInvoiceSendFromStripeButton.tsx)). **Job thread notes** (`jobs_ledger_thread_notes`): Leading expand column on each job row (and invoice rows, keyed by parent job); expanded panel lists chronological notes (Central Time + days-ago labels) and a composer (**Enter** submits; **Shift+Enter** newline; textarea **auto-grows**; inner **`max-height`** scroll **`activityListMaxHeight`** snaps to show **newest** notes at the bottom after load/update; [`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx)); **Arrived** / **Leaving** stamps — **Job Detail** modal only (**v2.446**; **`jobThreadNoteStampBody.ts`**, **`submitStamp`**); Dispatch **`job_schedule_blocks`** rows with notes merge into the same timeline as read-only **Schedule** entries (**v2.445**, [`jobThreadScheduleActivity.ts`](../src/lib/jobThreadScheduleActivity.ts)); note count badge on collapse; RLS matches `job_status_events` job access. **Thread stats at scale**: **`useJobThreadNotes`** loads stats in chunks of **200** job IDs and abandons stale in-flight chunk loops when a newer refresh runs (**`threadStatsRefreshGenRef`**); **Stages** batches note-stat refreshes with a **320ms** debounce (**`THREAD_STATS_STAGES_DEBOUNCE_MS`** in **`Jobs.tsx`**) so search typing does not overlap **`jobs_ledger_thread_note_stats`** RPCs. **Job name**: When job name contains a comma, text after comma wraps to second line (gray). **View Reports modal**: Full-screen; Escape or Spacebar closes it (nested modals close first).
  - **Job Summary Tab**: HCP, Name, Address, Team Labor, Sub Labor, Parts Cost, Total Bill, Revenue before Overhead. Team Labor column loads when Job Summary tab is active. **Parts Cost** uses RPC **`get_invoice_allocation_lines_for_jobs`** for per-invoice supply-house lines (same job visibility as **`get_invoice_amounts_for_jobs`**). The tab uses a **dedicated** jobs list: **[`fetchJobsLedgerWithDetailsForStages`](../src/lib/fetchJobsLedgerWithDetailsForStages.ts)** with **`statusScope: 'all'`** and **`customerFilter: null`** (all pipeline statuses; ignores `?customer=` URL scoping used elsewhere on Jobs). A bottom control sets **“Only include jobs with HCP # greater than [n]”** (default **500**, persisted in **`localStorage`** as **`jobs_jobSummary_minHcpExclusive`**; client-side filter in [`applyMinHcpFilter`](../src/lib/jobSummaryHcpFilter.ts); full snapshot is still loaded, then filtered). Unnumbered or non–all-digit HCP values always pass the filter. **Mercury** card-charge subtotals follow the same **filtered** job set. Table order: no HCP # first, then by HCP. See **`RECENT_FEATURES.md`** v2.395–v2.396. **Cost breakdown print** (expanded job row, **[`printJobSummaryCostBreakdown`](../src/pages/Jobs.tsx)**): **Print / Save as PDF**; button shows **Preparing…** and **`aria-busy`** while invoice lines and Mercury rows load (`printCostBreakdownJobId` state). Printed HTML order matches the on-screen **Cost breakdown**: **Summary** (key amounts), **Person summary** (full job; in-app person search does not apply to print), **Team Labor**, **Sub Labor**, **Parts Cost** (Parts from Tally, other job charges, **Invoices from supply houses** line table, card charges, per-person tally/card), then **Total bill** / revenue before overhead (no separate **Invoices** section before **Team Labor**; supply line detail is only under **Parts Cost**). See **`RECENT_FEATURES.md`** v2.403, v2.405. **Person summary cost breakdown** (expanded, same section): line-level **drilldown** modals ([`JobSummaryCostCellDrilldownModal`](../src/components/jobs/JobSummaryCostCellDrilldownModal.tsx), state **`jobSummaryCostDrilldown`**, Mercury filters in [`jobSummaryDrilldownMercuryFilter.ts`](../src/lib/jobSummaryDrilldownMercuryFilter.ts)); each modal can **Print** (new window) and **Export CSV** ([`elementToLikelyCsv`](../src/lib/domTableToCsv.ts), UTF-8 BOM). **`.jobSummaryBreakdownInteractive`** / **`.jobSummaryBreakdownInteractiveMuted`** in [`index.css`](../src/index.css) mark clickable cells. Person-row **Supply** is always **`—`** (not interactive); person **Hours** at **0** use **`—`** and are not interactive. **Mercury** drilldown tables (**[`JobSummaryDrilldownMercuryTable`](../src/components/jobs/JobSummaryCostCellDrilldownModal.tsx)**) can show **Reassign** (roles with Parts/Banking-style Mercury edit access) to open **`MercuryTransactionAllocationsModal`** and change job splits. See **`RECENT_FEATURES.md`** v2.404, v2.406.
  - **Parts Tab**: Shows jobs with tally parts, Other job charges, or Invoices from Supply Houses. Includes jobs that have only Other job charges (no tally parts) or only supply house invoice allocations (no tally parts, no materials). Tally parts from Job Parts Tally; search and "Show my jobs only" (hidden for subcontractors). **Unattributed** (Mercury card lines with no resolved person/user name in client attribution): toolbar **Unattributed** opens a modal listing unattributed lines across **scoped** jobs (same job list + card-activity filter + optional **Show my jobs only**); expanded **Cost by person** includes an **Unattributed** row when card charges &gt; 0 — staff with Banking-style access get **Unattributed — assign** to open the per-job list (**Assign** opens [`MercuryTransactionAllocationsModal`](../src/components/MercuryTransactionAllocationsModal.tsx); optional **Add {user}** when the first word of the **debit card nickname** matches exactly one `list_users_for_banking_attribution` user). Tables show **Posted**, **Card**, **Account** (from `mercury_transactions` + nicknames), **Counterparty**, allocation to job, actions. Data: [`fetchMercuryJobAllocationsWithAttributionForJob`](../src/lib/fetchMercuryJobAllocationsWithAttributionForJob.ts), [`fetchUnattributedMercuryLinesForManyJobs`](../src/lib/fetchUnattributedMercuryForManyJobs.ts). See **`RECENT_FEATURES.md`** v2.402. **Expanded** rows include **Cost by person** ([`buildPartsPerPersonCostRows`](../src/lib/partsPerPersonCostSummary.ts) in [`partsPerPersonCostSummary.ts`](../src/lib/partsPerPersonCostSummary.ts)); the per-person table **does not** list a separate **Job (no per-person split)** data row (job-level other charges and supply invoices still appear in the **Total** row). Fixture-only entries (sent to office) have editable cost; jobs with unpriced fixtures highlighted in red. Parts total includes fixture cost. Columns: Parts from Tally, Other job charges, Invoices from Supply Houses, Total Parts Cost.
  - **Inspections Tab**: Quick links to permit/inspection portals (editable via Edit Quick Inspection Links); Add Inspection modal (job selection, address, type, date); Edit Inspection Types button (add/edit/delete types; anyone who sees the tab can manage); calendar grid with inspection chips per day; Upcoming list (next 14 days); day click opens modal with day's inspections.
  - **Crew P&L** (formerly "Teams", tab key `teams-summary`, dev-only — **v2.656**): per-person labor cost vs **hours-weighted billing credit** (job total × person's share of the job's clocked crew hours; ≈-marked equal-split estimate when a revenue job has no clocked hours). Roster-keyed identity (account users + crew person_names + sub-sheet free-text → `people`; *unmatched* tag otherwise); columns Hours / Labor Cost / Billing / Profit / $-per-hr, sortable + searchable; date presets + custom; row drill-down to per-job lines → Job Detail. Kernel [`crewPnlSummary.ts`](../src/lib/crewPnlSummary.ts), component [`JobsCrewPnlTab.tsx`](../src/components/jobs/JobsCrewPnlTab.tsx).
  - **Job Summary expanded rows** (v2.646–v2.656): open with quick links (**Job Detail** / **Edit Job**) + Stages-style **Assigned / HCP / Last-Activity** header, then the **Charges & Value timeline** — a profit step chart (payments − charges: red falls with per-source icons, green payment rises with 💵, dashed $0 line, end-of-line value labels, blue value-created line from report completion % × job total, 🚩 per report) that scrolls horizontally on busy jobs. Kernel [`jobChargesTimeline.ts`](../src/lib/jobChargesTimeline.ts), chart [`JobSummaryChargesTimelineChart.tsx`](../src/components/jobs/JobSummaryChargesTimelineChart.tsx). The table's last column **%** = 100% when all invoices are paid (total > 0) → latest field-report % (RPC `list_latest_report_completion_pct`) → `pct_complete` → "—" ([`jobSummaryPercentComplete.ts`](../src/lib/jobSummaryPercentComplete.ts)). The same chart renders at the bottom of **Parts cost** in the **Job Detail** and **Edit Job** modals via self-fetching [`JobChargesTimelineStandalone.tsx`](../src/components/jobs/JobChargesTimelineStandalone.tsx) (per-job team labor via `fetchTeamLaborBreakdownForJob`).
- **Data**: Labor/Sub Sheet Ledger use `people_labor_jobs`, `people_labor_job_items`; labor book uses `labor_book_versions`, `labor_book_entries`; service types and fixture types; HCP Jobs use `jobs_ledger`, **`jobs_ledger_fixtures`** (fixture/tie-in lines: **`name`**, **`count`**, optional **`line_unit_price`**, optional **`line_description`** as **scope** text on that row’s Stripe line when **multi-line Specific Work** billing is used; **`jobs_ledger.revenue`** remains the canonical job total in RPCs — a one-time migration **`20260416182749_migrate_legacy_revenue_to_first_fixture.sql`** may have copied legacy **`revenue`** onto the first priced **named** Specific Work row when the UI sum was **$0**), `jobs_ledger_materials`, `jobs_ledger_payments` (nullable **`invoice_id`** → payments that apply toward a **`jobs_ledger_invoices`** row for partial pay; whole-job billed payments leave **`invoice_id`** null), `jobs_ledger_invoices` (column **`is_primary_rtb_bundle`**: ensure/Stripe primary RTB line for merged Stages/Dashboard rows; default false for manual partials), `jobs_ledger_team_members`, `jobs_ledger_thread_notes` (append-only thread per job; RPC `jobs_ledger_thread_note_stats` returns counts, last activity time, preview body, author name for Stages), **`job_schedule_blocks`** (planned assignee windows 4:00–20:00 Central per **`work_date`**, minimum **30 minutes**; optional **`shared_block_group_id`**: non-null UUID ties legs together so **`time_*`** and **`note`** stay in sync across assignees — **+ → Linked copy** on Dispatch job/hub cards, group **Edit** in modal, **Linked** badge when a group has multiple legs in the week; **legacy** solo rows have **`NULL`**; **new** rows get a fresh UUID on insert; drag-to-reassign another team member is **solo-only**, not for linked legs); **Schedule** button on **[`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx)** header for dev / master_technician / assistant when the job has at least one team member; **[`ScheduleJobModal`](../src/components/jobs/ScheduleJobModal.tsx)**); **Schedule dispatch** — [`ScheduleDispatch.tsx`](../src/pages/ScheduleDispatch.tsx) **routes** by query: no **`jobId`** → [`ScheduleDispatchHubPage`](../src/components/schedule/ScheduleDispatchHubPage.tsx); with **`jobId`** → [`ScheduleDispatchJobWeek`](../src/components/schedule/ScheduleDispatchJobWeek.tsx) (people×days grid). Week hub has **People** (roster from `jobs_ledger_team_members` on visible jobs plus block assignees; **Only people with blocks this week** checkbox; optional **· Salary** marker via [`fetchSalariedUserIdSetFromUserIds`](../src/lib/salaryPayConfigGate.ts); assignee×day read-only chips) and **Jobs** (job×day block counts) tabs, [`fetchJobScheduleBlocksForHubDateRange`](../src/lib/jobScheduleBlocks.ts) + [`fetchTeamMemberUserIdsForJobIds`](../src/lib/scheduleDispatchHub.ts) per week plus hub helpers ([`scheduleDispatchHub.ts`](../src/lib/scheduleDispatchHub.ts), [`ScheduleDispatchHub.tsx`](../src/components/schedule/ScheduleDispatchHub.tsx)); hub defaults to **People**; optional **`hubTab=jobs`** with **`week`** for **Jobs** tab; **Add schedule block** modal ([`ScheduleDispatchAddBlockModal`](../src/components/schedule/ScheduleDispatchAddBlockModal.tsx), add mode): timeline shows other **`job_schedule_blocks`** for the same assignee and **`work_date`** as occupied orange bands (job label); bands are draggable drafts; linked **`shared_block_group_id`** legs on that day move together; the **new** block’s dual-thumb range is clamped to free gaps (4:00–20:00 Central, 30-minute steps; default open prefers first ~4h gap); **Save** runs overlap validation on draft-adjusted rows, **`updateJobScheduleBlock`** / **`updateJobScheduleBlockGroup`** for moves, then **`insertJobScheduleBlock`** ([`scheduleDispatchAddBlockTimeline.ts`](../src/lib/scheduleDispatchAddBlockTimeline.ts), [`DispatchAddBlockTimeRange.tsx`](../src/components/schedule/DispatchAddBlockTimeRange.tsx)); DB **INSERT** still allows **superintendent** with project/job access for API consistency; Inspections use `inspections`, `inspection_types` (editable lookup), and `inspection_quick_links` (editable permit portal links). `jobs_receivables` retained for Data backup (dev) export.
- **Superintendent Jobs tabs**: Superintendents see Reports and Sub Sheet Ledger only (no Stages, Billing, Team Labor, Crew P&L); default tab Reports. RLS on jobs_ledger and child tables excludes superintendents; correct ledger for superintendents is Workflow Line Items For Office.
- **Job–Project link**: `jobs_ledger.project_id` (nullable FK → projects). Jobs can optionally link to projects for multi-phase billing; not all jobs need projects. New/Edit Job modal has Project dropdown; job rows show linked project badge; Projects page shows linked jobs and "Create Job" link. When linking a job to a project during edit, `master_user_id` is automatically updated to the project owner (trigger enforces match).
- **New Job — Import from estimate or bid** ([`JobFormImportEstimateOrBidModal.tsx`](../src/components/jobs/JobFormImportEstimateOrBidModal.tsx), [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx)): On **New Job** only, the header row places **Import** in a **centered** flex column between the **New Job** title and **Link to: Bid | Project**; the control label is **Import** with a full-phrase **`aria-label`** for accessibility. **Import** is hidden when the sheet is no longer empty (**`newJobFormHasBlockingContent`** / **`newJobImportBlockedByContent`**: project/bid/customer/address/HCP/links/fixtures/materials/payments/team, or a **trade** change after load; auto-picked **trade** on open does not hide **Import** until **`initialNewJobServiceTypeIdRef`** mismatch). Opening **Import** shows a nested overlay (**`JOB_FORM_IMPORT_SOURCE_OVERLAY_Z_INDEX`**): dialog title **Import from estimate or bid**, then search and results (no body blurb above the search field). Debounced **`search_estimates_for_nav`** + **`search_bids_for_clock`** (no job ledger search). Choosing a **bid** links it and prefills job name, address, customer, service type when the user’s role allows that type, and fills Google Drive / Job Plans from the bid only when those fields are still empty. Choosing an **estimate** prefills name, address, customer (or estimate email when there is no customer), and **Specific Work** from **`line_items_snapshot`** via [`normalizeEstimateLineItemsFromJson`](../src/lib/estimateLineItemNormalize.ts) / [`fixturesPayloadForCreateJobFromEstimate`](../src/lib/createJobFromEstimateSubmit.ts); clears any bid link; blocked with a toast if **`estimates.job_ledger_id`** is already set. **HCP #** is never auto-filled. **Alternate path — Copy Bid → Open Job** (**`RECENT_FEATURES.md`** **v2.493**): from **Bids** **New/Edit Bid**, the **Service Type** chip opens the **Copy Bid** overlay ([`BidFormModal.tsx`](../src/components/bids/BidFormModal.tsx)); **Open Job** in the bottom **Job** section closes that overlay and opens the global **New Job** sheet via [`JobFormModalContext.tsx`](../src/contexts/JobFormModalContext.tsx) **`openNewJob({ prefillBidId })`**. After [`JobFormModal.tsx`](../src/components/jobs/JobFormModal.tsx) finishes init (**`initDone`**), **`applyPrefillFromBid`** runs once (same prefill behavior as choosing a bid in **Import**). Requires a persisted bid id (*Save the bid first* when the row is still unsaved).

### 6a. Job Parts Tally
- **Page**: `JobTally.tsx`
- **Route**: `/tally`
- **Features**: Select Job/HCP; add parts or send fixture-only entries to office (Send button below fixture input). Fixture-only entries (green background) are sent for office to price; office enters cost in Jobs Parts tab. "Show my jobs only" checkbox (hidden for subcontractors) filters job picker to jobs where user is team member.
- **Clock Out gate** (anywhere **[`ClockInOutButton.tsx`](../src/components/ClockInOutButton.tsx)** is shown; non-salary path only): Tapping **Clock Out** checks for **unlinked** linked-card Mercury transactions using the same rules as the **Transactions** tab (including optional org floor **`job_tally_min_posted_ymd`**). When at least one applies, **[`TallyPreClockOutModal.tsx`](../src/components/tally/TallyPreClockOutModal.tsx)** opens first so the user can **Assign** splits (**[`MercuryTransactionAllocationsModal`](../src/components/MercuryTransactionAllocationsModal.tsx)** **`tallySelfService`**), see **Recent jobs** from **[`fetchRecentClockJobPicksForUser`](../src/lib/fetchRecentClockJobPicksForUser.ts)** (HCP #, name, address), optionally open **`/tally?tab=transactions`**, or use **Continue to clock out** (or close via backdrop / **Escape**) to open the normal **Review before clock out** modal. Shared helpers in **[`mercuryTxRowFromTally.ts`](../src/lib/mercuryTxRowFromTally.ts)**. **Transaction's Job Assignment** in that modal (and self-service tally generally) also lists **Dispatch schedule** jobs and **clock session** quick picks for the **calendar day of the transaction’s posted time** (**[`fetchDispatchScheduledJobsForAssigneeDay`](../src/lib/jobScheduleBlocks.ts)**, **`denverCalendarDayKey`**; target user **`tallyActAsUserId` or signed-in user** — see **`RECENT_FEATURES.md`** **v2.520**; copy/labels **v2.521**).
- **Transactions tab** (linked Mercury debit card purchases): Three columns **Posted**, **Amount**, **Counterparty**; per-row jobs sub-banner with **Assign jobs** and job links (opens **Transactions for…** drilldown via [`TallyJobTransactionsModal.tsx`](../src/components/tally/TallyJobTransactionsModal.tsx)). **Filter by card**, **Show all** / **Show unlinked**, **Transactions to sort** (unlinked count in card scope; when search is active, **· Showing m of k** for filtered vs scoped row count). **Search** (`type="search"`) sits **immediately above** the table header row; client-side filter in [`tallyTransactionSearch.ts`](../src/lib/tallyTransactionSearch.ts) after card + scope; no visible **Search transactions** label (**`aria-label="Search transactions"`** on the input); placeholder **Counterparty, note, job, amount…**; **Clear**; dedicated empty copy when the scoped list is non-empty but search matches nothing. **Mercury memo**: non-empty `note` shows a note control with [`MercuryTransactionNoteIcon.tsx`](../src/components/icons/MercuryTransactionNoteIcon.tsx) in **Counterparty** to expand/collapse memo in-cell (one open row at a time; **Escape** closes). [`tallyJobSplits.ts`](../src/lib/tallyJobSplits.ts) **`parseTallyJobSplitsJson`** for allocations modal and job drilldown. Data from **`list_my_linked_mercury_transactions_for_tally`** and **`list_my_linked_mercury_debit_cards_for_tally`**. **Dashboard**: optional amber badge on the **Job Parts Tally** icon when **`count_unlinked_mercury_transactions_for_tally`** is greater than zero (all linked cards, same “unlinked” rule: no **`mercury_transaction_job_allocations`** for the transaction).

### 6b. Quickfill
- **Page**: `Quickfill.tsx`
- **Route**: `/quickfill`
  - **Section chrome**: Each visible block is wrapped in **`QuickfillSectionWrapper`** with a **left-aligned** section title (**`h2`**, **`1.5rem`** and **`fontWeight: 700`**, matching Banking page title weight). After the **first** visible section (order follows **`SECTIONS`** in code), a **full-width** **`2px`** top border (**`#94a3b8`**) separates blocks. **Jump row** (centered buttons under the page **`h1`**): one **muted** subline per button — compact relative time plus **who** marked (**`formatJumpMarkSublineRelative`** in **[`Quickfill.tsx`](../src/pages/Quickfill.tsx)**; e.g. **`2d Taunya`**); **`title`** / **`aria-label`** retain **Last marked …** for accessibility (**`RECENT_FEATURES`** **v2.513**). Jump buttons and **Active sections** use the same labels (e.g. **People Hours (Old)** for the legacy hours grid). **Jobs Billing** reminder counts only jobs whose **`hcp_number`** parses as an integer **≥ Min HCP (inclusive)** (default **406**); the threshold is configured next to **Jobs Billing** in **Active sections** and stored in **`localStorage`** as **`pipetooling_quickfill_jobs_billing_min_hcp`**.
  - **Features**: Sections (in order per **`SECTIONS`**): **Warnings** (dev / master_technician / assistant only; **`quickfill_section_marks.section_id` = `warnings`**; **shown only when** **`list_stale_unlinked_mercury_transactions_for_tally_staff`** returns at least one row — same stale tally staff follow-up as Dashboard: **[`DashboardTallyStaleStaffBanner`](../src/components/DashboardTallyStaleStaffBanner.tsx)** + **[`DashboardStaleTallyStaffFollowUpModal`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx)**; counts loaded via shared **[`useStaleTallyStaffFollowUp`](../src/hooks/useStaleTallyStaffFollowUp.ts)** and **[`TALLY_STALE_MIN_AGE_DAYS`](../src/lib/tallyStaleMinAgeDays.ts)**). When **Warnings** renders, it also includes **Unallocated bank deposits** — **[`DashboardArBankUnallocatedBanner`](../src/components/DashboardArBankUnallocatedBanner.tsx)** + **[`QuickfillMetricReporter`](../src/pages/Quickfill.tsx)** (**`ar-bank-unallocated`**) when **`count_mercury_transactions_for_bank_payments`** &gt; 0 (same filter as Jobs **Bank Payments**). **People Hours (Old)** (grid plus pending / approved sessions; link to People Hours), **People Hours (new)**, **Banking sorting**, **Crew Jobs / Bids**, **Billed Awaiting Payment** (count and total, HCP/Job/Assigned/Remaining table, link to Jobs Stages), Unpriced Fixtures (count + link to Jobs Parts), Cant Reach, Supply Houses, **Jobs Billing** ( **`JobsBillingReminderSection`**: counts only jobs at/above Min HCP; threshold in **Active sections** / **`app_settings`**), **Complete, no Total Bill** (**v2.649**, `complete-no-bill`: non-paid jobs resolved **100% complete** — same rule as the Job Summary % column via RPC `list_latest_report_completion_pct` — with empty/$0 `revenue`, shown as inline cards with first-clock-in/session/hours line, **Job Detail** + **Edit job** buttons, and an **Activity ▾** accordion embedding the Job-Detail feed; kernel [`quickfillCompleteNoBill.ts`](../src/lib/quickfillCompleteNoBill.ts); dev/master/assistant; reuses the Jobs Billing min-HCP threshold). **Banking sorting** (paginated snapshot of Mercury transactions that still need a linked person and/or job splits, for dev/master/assistant—uses the same per-user Banking sorting config as [`Banking.tsx`](../src/pages/Banking.tsx) **Sorting** tab via [`loadBankingSortingConfig`](../src/lib/bankingSortingConfig.ts); loads up to 5000 recent `mercury_transactions`, then runs **`fetchMercuryRelationsState`** and **`fetchMercuryNicknameMaps`** in parallel; summary shows **Without person**, **Not split to jobs**, **Total available**; **Link…** opens attributions in **Person** and/or **Jobs** cells when missing—no separate Link column; link to full Banking). **`mercury_transactions`** is in **`supabase_realtime`** ([**`20260403051729_mercury_transactions_supabase_realtime.sql`**](../supabase/migrations/20260403051729_mercury_transactions_supabase_realtime.sql)); **[`BankingSortingSnapshotSection.tsx`](../src/components/quickfill/BankingSortingSnapshotSection.tsx)** debounced-refetches on inserts/updates (e.g. **`mercury-webhook`** or dev sync). **People Hours (new)** (Dashboard strip + day nav; **≤640px** viewport stacks **full date** on line 1 and **Previous day | Next day | Today** on line 2; amber notice under nav: assistance does not approve). **People Hours (Old)** — grid plus **Pending clock sessions** (same table layout and accountability formatting as People Hours; Force clock out; **Approve**, **Reject**, **Edit** in that order) and **Approved Sessions** (Revoke). **Edit** uses **`ClockSessionEditSplitModal`**; correct-day cell flow uses **`PeopleHoursDayAuditModal`** with the same props/refresh behavior as People. Same date range and Realtime subscription as People Hours. Unpriced fixtures visible to dev, master_technician, assistant. **Crew Jobs / Bids** (below Hours): same as Jobs Team Labor tab; date picker, Crew Jobs table (Name, Crew, Jobs/Bids with job and bid assignments), Team Job Labor table (HCP, Job, People, Man hours with breakdown modal; **Job Cost column hidden** in Quickfill). **[`CrewJobsBlock.tsx`](../src/components/CrewJobsBlock.tsx)** subscribes to **`postgres_changes`** on **`people_crew_jobs`** / **`people_crew_bids`** filtered by the selected **`work_date`**, and reloads Team Job Labor when those rows change (e.g. after **`approve_clock_sessions`** or assigning a job on an approved session—see migration **`20260402120000_clock_sessions_sync_crew_assignments_trigger.sql`**). Visible to dev, pay-approved masters, assistants.
  - **Schedule** ([`QuickfillScheduleSection.tsx`](../src/components/quickfill/QuickfillScheduleSection.tsx), [`Quickfill.tsx`](../src/pages/Quickfill.tsx), [`DispatchAddBlockTimeRange.tsx`](../src/components/schedule/DispatchAddBlockTimeRange.tsx)): read-only per-user **`DispatchAddBlockTimeRange`** for a selected company-calendar day (Hub roster + batched **`job_schedule_blocks`**); Previous / Next / Today; link to **`/schedule-dispatch`** with **`week`**, optional **`day`** (and **`jobId`** when deep-linking from a band); **`quickfill_section_marks.section_id` = `schedule`**; section visible only for **dev**, **master_technician**, **assistant**, **superintendent** (same gate as **`sectionWouldRenderOnPage`** in **`Quickfill.tsx`**). Realtime on **`job_schedule_blocks`** refetches when the selected **`work_date`** changes. **Section header** omits the **N open** backlog line and **Mark history** (**`QuickfillSectionWrapper`** **`showOutstandingInHeader={false}`** **`showMarkHistoryButton={false}`** for **`schedule`** only); **`useReportQuickfillSectionMetric('schedule', null, false)`** so **`quickfill_section_mark_events.outstanding_count`** is not populated with the old roster “no blocks” count. Centered amber **schedule conflicts** prompt (*Are there any obvious schedule conflicts?*). **Secondary** (clock session) timeline strips use the same **bar height** and **label font size** as **occupied** (schedule block) strips.
  - **Prospects** ([`QuickfillProspectsSection.tsx`](../src/components/quickfill/QuickfillProspectsSection.tsx), [`prospectWarmthCounts.ts`](../src/lib/prospectWarmthCounts.ts), [`prospectTeamActivity.ts`](../src/lib/prospectTeamActivity.ts), [`prospectTeamActivityChartData.ts`](../src/lib/prospectTeamActivityChartData.ts), [`ProspectTeamActivityLineChart.tsx`](../src/components/quickfill/ProspectTeamActivityLineChart.tsx)): **Active** lead counts by **warmth** (Warmth **3** / **2** / **1** / **0**, plus **Warmth 4+** when any — excludes **`prospect_fit_status`** **`not_a_fit`** and **`cant_reach`**, same as **Prospects → Prospect List**). **Team (last 30 days)** — **line chart** (**recharts**): one series per **dev** / **master_technician** / **assistant** user; **Y** = **Marked + Updated** per day (sum of unique-prospect counts from timers and from comments; **`buildProspectTeamActivityChartData`**). **Prospects** page **Team** tab remains **per-day tables**. **Estimators** with **`estimator_prospects_access`**: warmth + **Open Prospects** only. **`canAccessProspects`** in **`Quickfill.tsx`**; **`quickfill_section_marks.section_id` = `prospects`**; metrics report total **active** count. CTA: **`/prospects?tab=prospect-list`**. See **`RECENT_FEATURES.md`** → v2.381 / v2.382.381; **`ACCESS_CONTROL.md`** → Quickfill.
  - **Stages: customer link & customer pictures** (`quickfill_section_marks.section_id` = `no-customer-stages`, label in **`SECTIONS`**): **[`QuickfillStagesNoCustomerSection.tsx`](../src/components/quickfill/QuickfillStagesNoCustomerSection.tsx)**; data from **[`useQuickfillStagesJobsWithoutCustomer`](../src/hooks/useQuickfillStagesJobsWithoutCustomer.ts)** (**dev** / **master_technician** / **assistant**). Mirrors **Jobs → Stages** with an **empty** search: **`buildStagesJobsWithoutCustomerList`** (no linked customer — **Open list (n)** → **[`StagesNoCustomerJobsModal`](../src/components/jobs/StagesNoCustomerJobsModal.tsx)**) and **`buildStagesWorkingJobsWithoutPicturesList`** (**working** jobs with empty **`job_pictures_link`** — **No customer pictures (n)** → **[`StagesAlertJobListModal`](../src/components/jobs/StagesAlertJobListModal.tsx)**; Quickfill uses **`titleId`** **`stages-no-job-pictures-quickfill-modal-title`**). Section **outstanding** count and visibility use the **union** of distinct job **`id`**s (**`quickfillStagesAlertsUnionCount`**). See **`RECENT_FEATURES.md`** → v2.413.
  - **Unassigned field time** (`quickfill_section_marks.section_id` = `unassigned-field-time`, **dev** / **master_technician** / **assistant**; **v2.537**): **[`QuickfillUnassignedFieldTimeSection.tsx`](../src/components/quickfill/QuickfillUnassignedFieldTimeSection.tsx)** lists per (person, work_date) cells where the org paid for **field-type** time the team summary cannot allocate to a job. **v2.546 — approved-clock-only sourcing**: every input now comes from approved-closed `clock_sessions` only. Pure helper **`buildApprovedClosedHoursByPersonByDate`** (in **[`peopleHoursUnallocatedRows.ts`](../src/lib/peopleHoursUnallocatedRows.ts)**) sums approved-closed hours per (person, work_date) across every bucket (office, bid, field, unassigned); `computeUnallocatedFieldRows` uses that map for both candidate keys and `dayHoursRaw`. Math: `approvedClockOnDay = Σ approved-closed clock for person+date`; `dayHoursRaw = is_salary ? (weekday && approvedClockOnDay > 0 ? 8 : 0) : approvedClockOnDay`; `overheadOnDay = Σ approved-closed (office + bid) clock` (matches **`overheadBucketForSession`**, office = **`overhead_office_job_ledger_id_v1`**, bid = **`bid_id`** set); `fieldHours = max(0, dayHoursRaw - overheadOnDay)`; **`crewAttributedHrs = dayHoursRaw × Σ pct/100`** over **`people_crew_jobs`** + **`people_crew_bids`** assignments excluding the office job (**Convention 1, share-of-total-day**, matches the `sync_crew_jobs_from_clock` trigger — v2.539); `unallocatedHrs = max(0, fieldHours - crewAttributedHrs - subLaborHrs)`; only emits when **`unallocatedHrs > thresholdHours`** — covered by **21 unit tests** in [`peopleHoursUnallocatedRows.test.ts`](../src/lib/peopleHoursUnallocatedRows.test.ts) (v2.546 added `buildApprovedClosedHoursByPersonByDate` helper tests + `skips salary weekdays with NO approved clock` + `skips when a closed session is still pending approval` + `uses approved-clock hours (not people_hours) for hourly people` gates; Paige-shaped Office + non-Office regression from v2.539 stayed green). **Two key effects of v2.546**: (1) manual `people_hours` grid overrides no longer create rows when no clock backs them up — hourly `dayHoursRaw` reads straight from approved clock; (2) salary weekdays without approved clock no longer produce phantom 8h rows (PTO / sick / no-show salary days now correctly drop off). **Pending sessions are explicitly excluded** — the section defers to the Pending Sessions UI (v2.537) so it doesn't nag about something payroll hasn't approved yet. UI: window selector **3 / 7 / 14 / 30** days (default **14**, **`localStorage`** **`quickfill_unassigned_field_window_days`**) and threshold **≥ 0.25 / 0.5 / 1 / 2 / 4 h** (default **1 h**, **`quickfill_unassigned_field_threshold`**); single-line summary `{H} h across {N} {person|people} · {K} {day|days}`; day groups with header `{Weekday} · {H} h unassigned` and a row table **Person | Day hrs | Overhead | Field | Unalloc. (amber bold) | Context | [Open day audit]**. Realtime on **`people_crew_jobs`** / **`people_crew_bids`** / **`clock_sessions`** — v2.546 dropped the no-longer-relevant `people_hours` subscription and parallel Supabase query (manual grid edits no longer trigger a reload of a section that doesn't read them). **Open day audit** mounts **`PeopleHoursDayAuditModal`** for that person+day. **Audit modal additions (v2.537)**: read-only **Dispatch** panel above **Clock sessions** uses **[`usePersonDayScheduleData`](../src/hooks/usePersonDayScheduleData.ts)** + **[`QuickfillScheduleUserRow`](../src/components/schedule/QuickfillScheduleUserRow.tsx)** (same hourly strip used by **User day schedule** modal and Quickfill **Schedule**) with primary scheduled bands and secondary recorded bands via **`clockSessionsToDispatchSecondaryBands`**, plus a plain-text `<ul>` of every block (`time_start–time_end · {job/HCP label} · — {note}`) and an **Open in Schedule Dispatch** deep-link (**`/schedule-dispatch?week={Sunday}&day={workDate}`**, week from **`companyWeekStartSundayContaining`**). Each clock session row shows a status pill — **Approved** (green) / **Pending** (amber) / **Open** (grey) — with explanatory tooltips, and an inline **Approve** button next to **Edit** for closed pending rows when **`canEditCrewJobs`** (calls **`approveClockSessions`** → **`approve_clock_sessions`** RPC, same path as the Pending Sessions section so **`sync_crew_jobs_from_clock`** still runs server-side; **`approvingSessionIds: Set<string>`** so only the in-flight row disables; refreshes sessions and bubbles **`onCrewSaved?.()`** so Quickfill drops the row when the gap closes). When there are **no** crew assignments yet but at least one closed pending session links to a job/bid, a **pending-approval banner** in **Job / bid assignments** reads `\"{N} pending session(s) link to {Job/Bid label[, ...]}. Approve {it/them} above to auto-assign these hours.\"` (labels via **`formatJobLedgerShortLine`** / **`formatBidLedgerShortLine`** + trade prefix map — supports **v2.432** ledger display prefixes like **`BE249`**); for **2+** sessions an **Approve all (N)** button on the banner runs them through one RPC call. Why it works: **`people_crew_jobs`** is populated by **`sync_crew_jobs_from_clock`**, which the **`clock_sessions_sync_crew_assignments_after_job_bid`** trigger only runs for **approved** sessions, so a clocked-but-unapproved session never auto-creates the crew row that the team summary needs. The badge + Approve button surfaces this directly. **Layout**: **Clock sessions** list grows naturally — the inner **`maxHeight: 220`** + **`overflowY: 'auto'`** was removed so the list lays out at full height and the modal's outer **`maxHeight: '90vh'`** + **`overflow: 'auto'`** handles overflow (no nested scrollbar). **Audit modal additions (v2.545)**: per-clock-session **`Assign`** popover — every row whose `job_ledger_id` and `bid_id` are both null now shows the shared **`AssignSessionJobPopover`** ([`src/components/clock-sessions/AssignSessionJobPopover.tsx`](../src/components/clock-sessions/AssignSessionJobPopover.tsx), the same portal control the Dashboard clock strip uses) right beside the existing **Approve** / **Edit** buttons in the row's right-side actions cluster, gated on `canEditCrewJobs && !sessionsUserMissing && !!s.user_id && !s.job_ledger_id && !s.bid_id`. Portal `popoverZIndex={1110}` (above modal `zIndex: 1002`); Dispatch quick-picks seeded from `dispatchScheduleAssigneeUserId={s.user_id}` + `dispatchScheduleWorkDateYmd={workDate}` so the day's `job_schedule_blocks` jobs surface above the unified search. On save it `UPDATE`s `clock_sessions.job_ledger_id` (or `bid_id`) for **just that session**; the **`clock_sessions_sync_crew_assignments_after_job_bid`** trigger (migration **`20260402120000`**) fires and re-runs **`sync_crew_jobs_from_clock`** — which per **v2.538** always rewrites `people_crew_jobs.job_assignments` for already-approved sessions, so the audit modal's **Job / bid assignments** panel and the Quickfill Unassigned list both update on the next `refreshSessions()` + `onCrewSaved?.()` refresh. **This is the canonical fix** for *"session was never linked to a job"* (e.g. *Darren clocked 6 hours with notes about the ATV but `job_ledger_id IS NULL`*) — preferred over directly editing `people_crew_jobs` because the source of truth stays the clock session itself. **Audit modal additions (v2.543)**: inline **`Assign a job or bid`** blue-outline button now sits next to *No job or bid assignments for this day.* in the **Job / bid assignments** panel when **`canEditCrewJobs && !isEditMode`** and the day has zero crew assignments — one click flips `isEditMode = true`, opens the **Search HCP, bid #, job name, project, address…** input with cleared text/results, and any picked result lands at **100%** with the existing **Save crew** button persisting via the same `people_crew_jobs` / `people_crew_bids` upserts. Post-**v2.545** this CTA is the **override** path (use it when the session is overhead and shouldn't allocate to its linked job); the per-row **`Assign`** popover above is the canonical fix for missing job links. View-mode subtitle now matches reality — editing keeps the existing copy, **`!isEditMode && canEditCrewJobs`** says *“Click Edit to change assignments or sessions.”*, **`!canEditCrewJobs`** says *“View only — you don't have permission to edit this day.”* (the prior hardcoded *“This day is marked Correct (view only).”* was misleading because the modal never actually consults **`hours_reviewed`**).
  - **Office Arriving** / **Office Leaving** ([`QuickfillOfficeSection.tsx`](../src/components/quickfill/QuickfillOfficeSection.tsx)): dev-only **Edit checklist** / **Done editing** per variant (**`localStorage`**: **`quickfill_office_arriving_dev_edit`**, **`quickfill_office_leaving_dev_edit`**); off = normal checklist; on = drag reorder, **Remove**, dev add panel. **Edit checklist** row **right-aligned**; checklist rows **`alignItems: center`** (checkbox aligned with label).
  - **Email**, **Texts**, **Physical inbox** ([`QuickfillEmailInboxSection.tsx`](../src/components/quickfill/QuickfillEmailInboxSection.tsx), [`QuickfillTextsSection.tsx`](../src/components/quickfill/QuickfillTextsSection.tsx), [`QuickfillPhysicalInboxSection.tsx`](../src/components/quickfill/QuickfillPhysicalInboxSection.tsx)): self-reported backlog in a textarea; inner **Mark … up to date!** writes **`quickfill_section_marks`** and a **`quickfill_section_mark_events`** row with **`note_text`**. **Email** / **Texts** intro: one flex row each — **Open Gmail** \| *Still in inbox -* … / **Open SMS** \| *Still to text -* … Sections use padding / **`#fafafa`** fill **without** an outer **1px** grey border on the **`section`**. **Physical inbox** adds the same **Task**, **Task Dispatch**, and **Estimator Inbox** header actions (modal contexts from **`ChecklistAddModalContext`**, **`DispatchTaskModalContext`**, **`EstimatorTaskModalContext`**) with the same role gates as [`Layout.tsx`](../src/components/Layout.tsx). Section ids: **`email-inbox`**, **`texts`**, **`physical-inbox`**.
  - **Stale tally — Assign to jobs** (same flow as **Warnings** / **[`DashboardStaleTallyStaffFollowUpModal`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx)**): **[`MercuryTransactionAllocationsModal.tsx`](../src/components/MercuryTransactionAllocationsModal.tsx)** re-seeds job split lines only when **`open`**, **`transaction?.id`**, or **`initialUserId`** change, so typing in splits is not cleared on unrelated parent re-renders; follow-up modal memoizes **`parseTallyJobSplitsJson`** output and passes **`EMPTY_JOB_LABEL_BY_ID`** for stable props.

### 7. Calendar View
- **Page**: `Calendar.tsx`
- **Features**:
  - Month-view calendar
  - Shows steps assigned to current user (by `assigned_to_name`)
  - **Bids** (due dates) and **prospect callbacks** for roles that have access (same as prior behavior)
  - **My Day single-day card** (above the month grid, **all authenticated viewers**, both viewports — **v2.558**): full-width card with **← prev / heading / next →** layout. Heading reads `My Day · {Today | Yesterday | Tomorrow | weekday, MMM D}` via **`formatMyDayHeadingLabel(ymd, todayKey)`** ([`Calendar.tsx`](../src/pages/Calendar.tsx)); day math runs on the `YYYY-MM-DD` calendar key with the pure helper **`shiftYmd(ymd, delta)`** (no timezone math). The card lists the same **`renderPlannedWorkChips`** that the day-detail modal uses (long-form `573 · Johnny Ingram` label + `8:00 AM–12:00 PM` time + optional dispatch note); clicking a chip calls **`useJobDetailModal().openJobDetail({ jobId })`**. Scrubbing past the visible grid range triggers a `useEffect` that bumps **`currentMonth`** to the month containing the new **`myDayKey`** so the existing planned-work load effect refreshes **`plannedByWorkDate`**; **Today** in the header resets both `currentMonth` and `myDayKey`. Empty-state copy **No planned work.** is centered.
  - **Salaried workday layer** (when `people_pay_config.is_salary` and a **`salary_work_schedule_templates`** row exists): optional **Show my workday** checkbox (per-user **`localStorage`** **`calendar_show_my_workday_${uid}`**; **defaults to `false` — v2.558**). Renders **unpaid time off** (`user_time_off`, `kind` always `unpaid`) and scheduled blocks (**override** or **template**) via **`resolveCalendarWorkday`**; chips link to Settings **Salaried workday** or **Unpaid time off**. Data for that layer is loaded for the **full visible grid** (including leading/trailing padding days from adjacent months), so time off and overrides match every painted cell. **Upcoming** includes time-off ranges and future **day overrides**.
  - **Show recorded time** toggle (per-user **`localStorage`** **`calendar_show_recorded_time_${uid}`**; **defaults to `false` — v2.558**) controls the **Recorded Xh** chip and per-session lines below.
  - **Show weekends** toggle — when **off**, Saturday + Sunday columns are hidden from the month grid (`visibleDays` drops them, `dayHeaders` becomes `Mon–Fri`, `gridColumns` flips to `repeat(5, 1fr)`); My Day arrows are unaffected and still step one calendar day at a time. **v2.558** — the toggle now defaults from **viewport** state (**`useState(() => !mobileCalendarLayout)`**) and is **not persisted**: every page open mobile (`max-width: 640px`, **`CALENDAR_MOBILE_CHROME_MQ`**) starts **unchecked** and desktop starts **checked**; in-session flips work but a refresh resets to the viewport default. The legacy `calendar_show_weekends_${uid}` localStorage key is no longer read or written (its hydration `useEffect` and the `setItem` write inside the toggle handler are both gone).
  - **Toggle placement**: on **mobile** (`mobileCalendarLayout`), **Show my workday** / **Show recorded time** / **Show weekends** move from the month-header row to a centered flex cluster **below** the grid; on **desktop** they sit beside the **Today** button in the month-header row. Three render helpers (**`renderShowMyWorkdayToggle`**, **`renderShowRecordedTimeToggle`**, **`renderShowWeekendsToggle`**) mount the same checkbox in either location.
  - **Month grid — bottom chip column**: PTO links, scheduled **workday** link(s), **NCNS**, and optional **recorded** line sit in a bottom flex stack with **`alignItems: center`** so each row shrink-wraps and centers horizontally (top stack for workflow / bid / prospect unchanged unless product asks). When **Show recorded time** is on, the **Recorded Xh** summary chip remains; **per-session chips** (capped with **+N**, **America/Chicago** times, job/bid label, tooltip with notes) reflect **non-rejected, non-revoked** own-user **`clock_sessions`** from the same month query (**`CLOCK_SESSION_CALENDAR_SELECT`**). The **day** detail modal includes a **Clock sessions** list (range, duration, salary badge when applicable, **`notes`**). **Planned work** chips (indigo, capped **+N**) load **`job_schedule_blocks`** for the signed-in user on visible grid days and now include the block **note** (**v2.558**, **`PlannedBlockRow.note`** + `note` column on the `job_schedule_blocks` SELECT) rendered as a muted indigo subline under the time row in **`renderPlannedWorkChips`** (matches how Dashboard My Schedule surfaces dispatch notes); the day modal lists the same. **Workflow** stage chips open **Job preview** (read-only: stages on project, team jobs from **`list_assigned_jobs_for_dashboard`** filtered by **`project_id`**, your schedule rows); subs omit **Open in Jobs**; **Workflow** link stays available.
  - **Mobile-only compact mini-chip format** in grid cells (**v2.558**): planned-work mini-chips inside the month grid cells use a compact format on mobile only via the new **`compactScheduleWindow`** helper (drops `:00` minutes and adds spaces around an en-dash → `8 AM – 12 PM`) and a space-separated label (`573 Johnny Ingram` instead of `573 · Johnny Ingram`). Desktop grid cells, the My Day card, and the day-detail modal all keep the long-form labels and times.
  - **All dates/times displayed in Central Time (America/Chicago)**
  - **Two-line display**: Stage name (top, bold) and Project name (bottom, gray)
  - Color-coded by status
  - Links to workflow pages
  - Navigation (prev/next month, "Today")
  - **Access Control**: Assistants/subcontractors only see stages assigned to them
- **Settings**: **`TimeOffSettings`** (`#settings-time-off`) — self-service CRUD on **`user_time_off`** (unpaid-only ranges)

### 8. Dashboard
- **Page**: `Dashboard.tsx`
- **Layout**: No page title; content starts with pinned links and sections
- **Features**:
  - **Clock In/Out** (all authenticated users): Full-width safety orange Clock In button; clicking opens modal with required "What are you working on?" notes and optional unified job/bid search below. Single search input searches both jobs (`search_jobs_ledger`) and bids (`search_bids_for_clock`); matching rows can show **trade** color pills (**`[plum]`** / **`[elec]`** / **`[hvac]`**) for Plumbing, Electrical, and HVAC when **`service_type_name`** is present (**`list_assigned_jobs_for_dashboard`** default list + typed search; shared **[`serviceTypeTagForUnifiedRow`](../src/utils/unifiedJobBidSearch.ts)**; bid-only service-type toggles still filter **`search_bids_for_clock`** only — see **`RECENT_FEATURES`** **v2.433**). Results show as `J123 · [job name] - [address]` or `B456 · [project name] - [address]` (ledger letter/prefix per **`service_types`** — **v2.432**). **Assigned jobs list** loads automatically when **Clock In**, **Update Focus**, or **Review before clock out** opens via `list_assigned_jobs_for_dashboard` (with loading state in the results panel), in parallel with **`fetchDispatchScheduledJobsForAssigneeDay`** for **On schedule:** quick-picks from **`job_schedule_blocks`** (company **today** for clock-in/update-focus; **open session `work_date`** for clock-out review). **Job/bid summary + Clear** — **Clock In** (orange): shown only after a **typed** unified-search pick (**`associationChipFromSearch`**). **Update Focus** (gray): shown after a typed pick **or**, once dispatch/working lists have loaded, when the hydrated session job/bid is **not** on those quick picks (**`showUpdateFocusAssociationChip`**). **Review before clock out** (gray): chip only after typed search (**`associationChipFromSearch`**). **Dispatch**, **Working**, **Use last**, and hydrated **`selectedAssociation`** use row highlights when IDs match; **Update Focus** and **Review before clock out** hydrate **`selectedAssociation`** from **`openSession`**. **Complete Clock In** with empty required notes shows the validation toast and refocuses the notes textarea (**`clockInNotesRef`**, deferred via **`queueMicrotask`**). **Review before clock out** can list **Missing reports from today (click to make report):** for schedule jobs missing a same-day field report (roles per **`canLeaveJobFieldReport`**); each row opens **`AdditionalReportModal`**. **Update Focus** shows the salaried explainer line only when on a salary session; hourly users no longer see the subtitle about closing and reopening a session. Jobs that appear on the schedule are removed from the assigned default list to avoid duplicates. No separate control. When the user has **multiple** service types for bid filtering, an optional dropdown filters bids (estimator/primary/subcontractor rules per role); when there is **exactly one** type, that type still applies but the **“Filtering by: …”** label is not shown. Notes and search fields use a **2px** slate border; **Clock In** field focus ring is orange (`#ff6600`); **Update Focus** notes/search focus ring is blue (`#3b82f6`). When clocked in, shows total hours worked today (sum of all sessions), solid red Clock Out button (white text), and solid blue Update Focus button (white text). Update Focus modal starts blank with cursor in notes; includes the same unified job/bid search and assigned-job prefetch. When **not** clocked in but **today’s `work_date`** already has at least one **clock_sessions** row (same query as the clock button’s “today” list), **Dashboard** passes **`onOpenMyTimeDayEditor`** into **[`ClockInOutButton`](../src/components/ClockInOutButton.tsx)** so a compact blue **clock** icon (**View today’s time**) opens **[`DashboardMyTimeDayEditorModal`](../src/components/DashboardMyTimeDayEditorModal.tsx)** in **read-only punch** mode (`clockTimesReadOnly`, **`openMyTimePreviewFromClock`** in [`Dashboard.tsx`](../src/pages/Dashboard.tsx)): same-day timeline editing, assignments, and **Save on close** when the date is in the dashboard edit window; **Adjust times**, force clock-out, reject, and NCNS stay disabled; modal title includes **— punch times locked**. Body scroll lock when modal open (iOS/Android). Requires user name in Settings. Optionally captures GPS location at clock-in and clock-out (shown in People Hours pending sessions). **My Roles Goals**: After the **first successful clock-in of the calendar day**, if the user has at least one row in `user_dashboard_goals`, a full-screen **“My Roles Goals”** overlay appears (large checkboxes per goal, **Continue**); **Continue** records `user_daily_goals_ack` for that day so the gate stays dismissed until the next calendar day. Dev, master, and assistant edit per-user goals in Settings.
  - **Job Mode** (per-user toggle in the header gear menu, gated by **`canLeaveJobFieldReport(role)`** — all 9 roles: dev, master_technician, assistant, controller, helpers, subcontractor, estimator, primary, superintendent): Mobile-first focused view. Per-user `localStorage` (**[`jobModeToggle.ts`](../src/lib/jobModeToggle.ts)**, **[`useJobModeEnabled.ts`](../src/hooks/useJobModeEnabled.ts)**); when on, **[`Dashboard.tsx`](../src/pages/Dashboard.tsx)** takes an early-return path that renders only the tally / pinned-tabs banner, **[`DashboardJobModeCard`](../src/components/jobMode/DashboardJobModeCard.tsx)**, the existing `AdditionalReportModal` mount, and a **Show full dashboard** link (component-local state, resets every page load). The card shows three stacked lines (HCP number / Job Name / Address — derived from the user's open clock session and today's `job_schedule_blocks`) and two large side-by-side buttons: **Leave Report** (blue) and **Next Job** (green). Pure picker **[`pickCurrentAndNextScheduleBlock`](../src/lib/jobModePickCurrentNext.ts)** decides the state — `no-clock-no-schedule`, `not-clocked-in-with-schedule`, `on-scheduled-job-not-last`, `on-scheduled-job-last`, `on-off-schedule-job`, `on-bid` — which drives the right button label (Clock In, Start First Job, Next Job, Last job of the day, Switch to Scheduled Job, Start First Scheduled Job, or Choose Next Job that opens the existing Update Focus modal). Multi-window same-job continuations are skipped — Next Job means a different `job_id`. Tapping Next Job opens **[`JobModeAdvanceNotesModal`](../src/components/jobMode/JobModeAdvanceNotesModal.tsx)** (single-line notes, **Cancel** / **Skip notes** / **Confirm**, Enter submits, Escape cancels). Confirm calls `applyUpdateFocusDirect` on **[`UpdateFocusOpenerBridgeContext`](../src/contexts/UpdateFocusOpenerBridgeContext.tsx)**, which **[`ClockInOutButton`](../src/components/ClockInOutButton.tsx)** registers — same close-and-insert mutation the existing Update Focus modal uses (or in-place `UPDATE` for salaried users; or `INSERT`-only when there's no open session and the user is starting their first job of the day). Realtime subscriptions on `clock_sessions` (this user) and `job_schedule_blocks` (this user, this work_date) keep the card current; a 1-minute interval re-checks `denverCalendarDayKey(Date.now())` so the day rolls over automatically. **Schedule blocks are jobs only — there is no `bid_id` on `job_schedule_blocks`** — so when the user is clocked into a bid, the card shows "Clocked into a bid" and Next Job points at the first scheduled block of the day. Toggle persists per device, not per user account; matches the **`dashboard_clock_strip_scope`** pattern. See **`RECENT_FEATURES`** **v2.545**.
  - **Quick-action buttons** (dev, master_technician, assistant): Job, Job Labor, Bid, Project, Part, Assembly, New Prospect. Each opens the corresponding create flow. **Dashboard button visibility**: Users can configure which buttons to show in Settings → Dashboard buttons (checkboxes for each).
  - **User Review modal** (global **[`UserReviewModal`](../src/components/UserReviewModal.tsx)**, provider **[`UserReviewModalContext`](../src/contexts/UserReviewModalContext.tsx)** in [`App.tsx`](../src/App.tsx), rendered in [`Layout.tsx`](../src/components/Layout.tsx)): Opened by clicking a person **name** in **[`DashboardTeamActiveClockStrip`](../src/components/DashboardTeamActiveClockStrip.tsx)**. Three view modes: **Day** / **Week** / **Month** toggled via the toolbar (`< Day | Week | Month >` with prev/next chevrons + **Today**); **Week** = company-week Sun–Sat (**`companyWeekStartSundayContaining`**), **Month** = rolling 30-day window anchored on the selected day. **Top section** — read-only schedule strip per day via **[`UserDayScheduleSection`](../src/components/userReview/UserDayScheduleSection.tsx)** (Day), **[`UserWeekScheduleSection`](../src/components/userReview/UserWeekScheduleSection.tsx)** (Week), **[`UserMonthScheduleSection`](../src/components/userReview/UserMonthScheduleSection.tsx)** (Month). Each per-day row uses **[`UserScheduleDayRow`](../src/components/userReview/UserScheduleDayRow.tsx)** → **[`QuickfillScheduleUserRow`](../src/components/schedule/QuickfillScheduleUserRow.tsx)** → **[`DispatchAddBlockTimeRange`](../src/components/schedule/DispatchAddBlockTimeRange.tsx)** (`disabled` + `showProposedRange={false}`). Data via **[`usePersonDayScheduleData`](../src/hooks/usePersonDayScheduleData.ts)** (Day) / **[`usePersonWeekScheduleData`](../src/hooks/usePersonWeekScheduleData.ts)** (Week) / **[`usePersonMonthScheduleData`](../src/hooks/usePersonMonthScheduleData.ts)** (Month) — all subscribe to **`job_schedule_blocks`** + **`clock_sessions`** Realtime via **`useRealtimeChannel`**. **Bottom section** (banking roles only — **`canAccessBanking`**) — **[`UserMercuryWindowSection`](../src/components/userReview/UserMercuryWindowSection.tsx)**: Mercury transactions for the same date window summarized by **By Job** / **By Label** / **By Date** (segmented sort under the centered `Transactions: -$X · N tx` total, persisted under `localStorage` key `user_review_tx_sort_v1`); shared **`TransactionsTable`** columns `Amount | Posted | Counterparty | Job | Label | Edit` with **Amount** right-aligned `tabular-nums` bold; pure pivots `buildUserJobLabelBreakdown` / `buildUserLabelTopBreakdown` / `buildUserDateFlatBreakdown` share a private `scanDistinctTxs` so totals stay byte-identical across modes. Non-banking roles see no Transactions section. **Date header click** (Week / Month, both viewports) — opens **[`UserDaySummaryModal`](../src/components/userReview/UserDaySummaryModal.tsx)** (read-only per-day list of blocks + sessions; row click closes Summary then opens **`ScheduleBlockPreviewModal`** for blocks or **`DashboardMyTimeDayEditorModal`** for sessions when staff). **Name-in-title click** (Day / Week / Month, all viewports) — staff (**`dev`** / **`master_technician`** / **`assistant`** / **`superintendent`** — `SWITCH_SUBJECT_ROLES`) get **[`UserReviewSwitchUserModal`](../src/components/userReview/UserReviewSwitchUserModal.tsx)** (`SearchableSelect` over the last 30 days of distinct **`clock_sessions.user_id`**, archived users dropped, current subject omitted; lazy-loaded via **[`useUserReviewRoster`](../src/hooks/useUserReviewRoster.ts)** + ref-cached for instant re-open; picking a user calls `modal.open({ userId, displayName, workDateYmd })` preserving the anchor day, `rangeMode` is local so Day / Week / Month survives the swap). Non-staff see plain text. **Schedule-rail trim + stretch** (Day / Week / Month per-day rows): the grey rail derives from one shared `{ loSlotIndex, hiSlotIndex } | null` per view (earliest band start / latest band end across **every row in the view**, computed by **[`computeUserReviewSharedSlotWindow`](../src/lib/userReviewSharedSlotWindow.ts)**) and the visible strip **stretches** that window edge-to-edge so the user sees more of the active part of the day. Cross-row alignment preserved via the shared-window invariant — `9 AM` lands at the same screen x on every row in the same view. **4-hour minimum window floor** via **`applyRailWindowMinFloor(window, USER_REVIEW_RAIL_MIN_FLOOR_SLOTS = 8)`** (symmetric expansion around mid + defensive re-clamp + deficit shift) wrapped at the orchestrator boundary. Empty days hide the rail entirely. Bands, fill, orientation labels (`8 AM` / `12 PM` / `4 PM` chips in both per-strip and shared-header **[`QuickfillScheduleOrientationLabelsRow`](../src/components/schedule/QuickfillScheduleUserRow.tsx)**) all route through internal `slotToTrackT(slotIndex, slotCount, window)` so they paint at their wall-time x in the rescaled strip; orientation marks filter to inside-window slots. Quickfill / Schedule Dispatch / schedule-block modals stay unchanged because they don't pass the opt-in `railTrimWindow` prop. See [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.566 (User Day Summary), v2.567 (Switch user), v2.568 (rail trim), **v2.569** (rail stretch + 4 h floor).
  - **Email schedule** (dev, master_technician, assistant when **`enableScheduleDayEmail`** on **[`Dashboard.tsx`](../src/pages/Dashboard.tsx)** — same strip as **Mix** / scope toggle): **[`DashboardTeamActiveClockStrip`](../src/components/DashboardTeamActiveClockStrip.tsx)** **Email schedule** opens **[`ScheduleDayEmailModal`](../src/components/ScheduleDayEmailModal.tsx)** for the strip’s **`work_date`**. Queues **one** Resend send per **`recipient_user_id` + `work_date`** (**`schedule_day_email_requests`**; pending rows deduped). **Schedule** picks a future **Central** wall time (**`send_at`** UTC); **Queue soon** sets **`send_at`** to now so the row is due on the next pg_cron run (~15 minutes). Edge **[`schedule-day-email-dispatch`](../supabase/functions/schedule-day-email-dispatch/index.ts)** sends when **`send_at` ≤ now**; content uses **`list_job_schedule_blocks_for_schedule_email`** (same visibility idea as Schedule Dispatch for that recipient). **Master** / **assistant**: always self. **Dev**: optional **Send to** another non-archived user (**RLS** **`schedule_day_email_requests_insert_dev_any_recipient`**). See **`RECENT_FEATURES.md`** v2.522–**v2.523**, **`ACCESS_CONTROL.md`**, **`EDGE_FUNCTIONS.md`**, **`MIGRATIONS.md`** (`20270522120000`, `20270523120000`).
  - **Pinned Links** (from Settings or Layout Pin): Users manage their own page pins in Settings → Dashboard Page Pins → Page pins (Clear all, Remove per pin). Dev can pin Billed Awaiting Payment, Supply Houses AP, Sub Labor Due, and Internal Team labor to masters/devs dashboards. Pins show labels: "Billed Awaiting Payment (count) - $total", "Supply Houses: $X", "Sub Labor Due: $X,XXX", "Internal Team: $X,XXX". Billed pin navigates to Jobs Stages and opens Total by Name modal. Supply Houses link navigates to Materials Supply Houses, Sub Labor Due to Jobs Sub Labor tab, Internal Team to People → Hours.
  - **My Bids** (dev, master_technician, assistant, estimator, primary): Collapsible section; title **My Bids (`n`)** after load where **`n`** counts visible bids (not user-hidden); plain **My Bids** while loading. **Primary** defaults **collapsed**; other roles default **expanded** (**`RECENT_FEATURES`** **v2.494**). **Lost bids** are excluded from this list; use the dashboard banner below when any **lost** bid assigns you as **estimator** or **account manager** with no **Reason for loss** (**`RECENT_FEATURES`** **v2.496**).
  - **Recent Reports** (dev, master_technician, assistant, primary): Collapsible list with unread count in the header; dev / master / assistant auto-expand when any loaded report is unread; **primary** does not auto-expand on unread (**`RECENT_FEATURES`** **v2.494**).
  - **Currently clocked in** (when at least one **open** clock session applies in the current view): Compact table **below pinned links** (and **above** the **Pending clock sessions** yellow banner when the banner is shown). The **Currently In** inner table (if **open** sessions are listed) uses a first column whose **minimum width** includes the full **name** plus the optional salary-schedule suffix **`(s)`** (not the longest *name* string alone): **`stripCurrentlyInFirstCol`** and **`<colgroup>`** on the first **`<col />`**, with **`stripCurrentlyInNameWithSuffix`** (`inline-flex`, nowrap) wrapping the name **button**/text and **`(s)`**; the strip’s **horizontal scroll** (`overflowX: auto` on the table wrapper) applies when the table is wider than the viewport (see `RECENT_FEATURES` v2.400). The **Clocked in today** subsection uses **one table** whose **`thead`** row combines the **collapse** chevron (same gutter as row carets), **Clocked in today**, and (when expanded) **Today | First clock-in**, with **Show all** / **Needs attention** in a top-right overlay when that filter applies (**Needs attention** lists people with at least one today session that is **unassigned** (no job and no bid) or **pending approval**—closed and not approved—using the same merged approve status as the strip, including optimistic approve; defaults to **Needs attention** focused mode; subsection expanded by default unless saved collapsed in **`dashboard_clock_strip_clocked_in_today_collapsed`**). **Copy day job mix** (**Mix**, **dev** / **master_technician** / **assistant** only—same condition as **`enableCopyDayJobMix`** / strip scope toggle): when **Clocked in today** has rows, an optional header control turns **Mix** mode on so each person row can act as **source** or **target** for copying **percentage job time** from another person’s **closed** sessions that day; **[`CopyDayJobMixModal`](../src/components/day-job-mix/CopyDayJobMixModal.tsx)** + **[`dayJobMixPercentages.ts`](../src/lib/dayJobMixPercentages.ts)** / **[`dayJobMixApply.ts`](../src/lib/dayJobMixApply.ts)** plan segments; **`leader_replace_clock_session_cluster_mixed`** (**[`leaderClockSessionSplit.ts`](../src/lib/leaderClockSessionSplit.ts)**) applies. **[`copyDayJobMixTargetGate.ts`](../src/lib/copyDayJobMixTargetGate.ts)** requires every **salary_schedule** session in the **target** day to be **closed** before replace. The strip passes **`clockStripWorkDateYmd`** from **[`useDashboardMyTeamSectionState`](../src/hooks/useDashboardMyTeamSectionState.ts)** so the modal and RPCs use the same **`work_date`** as the table. **Mix** and **Show all** / **Needs attention** share **`stripClockedInChromeBtnLayout`** plus **`scopeBtn`** padding/typography so the header chips match height (**`RECENT_FEATURES`** v2.428). Columns: header **Currently clocked in (n)** (counts open sessions), **Clocked in** (time), **Elapsed** (live duration for open session), **Today** (sum of **clock session** hours for today’s `work_date` for that person; excludes manual **People Hours** grid). **Assign** job/bid (**[`AssignSessionJobPopover`](../src/components/clock-sessions/AssignSessionJobPopover.tsx)**): **Scheduled this day (Dispatch)** quick-picks above the search field list distinct **`jobs_ledger`** rows from **`job_schedule_blocks`** for that assignee and **`work_date`** (Schedule Dispatch stores **jobs** only, not bids); **`fetchDispatchScheduledJobsForAssigneeDay`** in **[`jobScheduleBlocks.ts`](../src/lib/jobScheduleBlocks.ts)**. After a successful Supabase update, **`applyOptimisticClockSessionAssign`** in [`useDashboardMyTeamSectionState`](../src/hooks/useDashboardMyTeamSectionState.ts) patches **`pendingSessions`**, **`orgWidePendingSessions`**, **`todaySessionsRows`**, and **`todaySessionsRowsOrg`** with **`AssignSessionJobSavedPatch`** (embeds from the picked search row) so **Currently In** and **Clocked in today** labels update immediately; **`loadPending({ silent: true })`** still runs to reconcile and uses **`Promise.all`** for **`loadTeamHoursSummary`**, **`loadTodayClockSessions`**, and org-wide / salary strip loaders (and parallel today-org + salary inside **`loadOrgWidePending`**). **Per-session approve/reject** (dev, master_technician, assistant): when a person row is expanded, each **today** session line shows status (**open** / **pending** / **approved**); **pending** closed sessions can be **approved** via RPC (`approve_clock_sessions` on **short click**). After a **successful** approve, the strip shows **approved** immediately via **`optimisticStripApprovedIds`** / **`stripApproveStatusForSession`** in [`DashboardTeamActiveClockStrip`](../src/components/DashboardTeamActiveClockStrip.tsx) (before **`loadPending`** refreshes **`approved_at`**; cleared when the server row catches up, the session leaves the strip, or **revoke** / strip **reject** runs). **Long-press** (~0.56s), **Shift+click**, and the screen-reader **Session actions** control open **[`ClockSessionStripActionsModal`](../src/components/ClockSessionStripActionsModal.tsx)** with **Edit** (**current assignment** summary from strip embeds, **Open job** / **Open bid** links, **Change assignment** and **Clear assignment**, **focus memo**, and **job/bid** search—search starts collapsed when a job or bid is already linked until **Change assignment**), **Approve** / **Reject…** (pending), and **Revoke approval…** (approved; `revoke_clock_sessions` after **`window.confirm`**). **Reject…** in that modal closes it and opens the existing **in-app confirmation** overlay in [`DashboardTeamActiveClockStrip`](../src/components/DashboardTeamActiveClockStrip.tsx) for `rejected_at` / `rejected_by`. **Z-index** order stacks the assign popover, then the actions modal, then the reject confirm. See [`ClockSessionStripApproveControl`](../src/components/ClockSessionStripApproveControl.tsx). **Everyone / Organization** (dev, master_technician, assistant only): toggle **`clockStripScope`** **`team`** (roster / team loaders) vs **`everyone`** (org-wide pending + today **`clock_sessions`** where **`orgWideStripEnabled`**); UI labels **Everyone** | **Organization**. When **`localStorage`** **`dashboard_clock_strip_scope`** is **unset**, **`readClockStripScopeFromStorage`** in [`Dashboard.tsx`](../src/pages/Dashboard.tsx) defaults eligible roles to **`everyone`** (**Organization**); an effect persists that default once **`role`** hydrates. Explicit stored **`team`** or **`everyone`** always wins. **RLS** still bounds rows (default scope + assistant toggle labels + merged-header narrow viewport behavior: **`RECENT_FEATURES`** v2.429). **Jobs worked today**: when at least one today session in strip scope is **job-linked** (**`job_ledger_id`**) **or** **unassigned** (**no** **`job_ledger_id`** and **no** **`bid_id`**), a collapsible **two-column** subsection below **Clocked in today** lists **No job or bid** **first** when any unassigned sessions exist (muted label, **not** a job **`Link`**; **`JOBS_WORKED_TODAY_UNASSIGNED_ID`** — **v2.367** in [`RECENT_FEATURES.md`](RECENT_FEATURES.md)); remaining rows **group by job** (**chevron** | **job**): first line is the job **`Link`** plus inline **`[ totalHours • peopleCount ]`** (distinct people, **`formatHoursH`** on summed seconds—see **v2.203** in [`RECENT_FEATURES.md`](RECENT_FEATURES.md)), second line optional address; expand a row for per-session lines: **`ClockSessionStripApproveControl`** (same approve/pending UI as **Clocked in today** detail), person, range, and duration (**detail row** **`colSpan` 2** via **`JOBS_WORKED_TODAY_COL_SPAN`**). **Duration** is a button when **`onOpenStripMyTimeEditor`** is set (same roles as **Clocked in today** **Today** hours), opening **`DashboardMyTimeDayEditorModal`** for that person. **`hasIntervalOverlapToday`** on **[`ClockedInTodayStripRow`](../src/hooks/useDashboardMyTeamSectionState.ts)** drives an amber **Overlap** badge beside the person in **Clocked in today** and in **Jobs worked today** detail rows when today’s sessions for that user overlap by more than **`CLUSTER_CONTIGUITY_EPS_MS`** (**`hasPairwiseClockIntervalOverlap`**). Scope-toggle **`paddingRight`** gutter on the job column matches other strip metric cells. When **`mergeClockedInHeaderIntoJobs`** combines **Clocked in today** and **Jobs worked today** orange **`thead`** text on one row, **≤640px** (**`shortCurrentlyInHeader`** / **`STRIP_SHORT_CURRENTLY_IN_HEADER_MQ`**) keeps **Clocked in today (n)** and **Jobs worked today (m)** on one flex line via **`nowrap`** and an inner **`overflowX: auto`** wrapper (**`mergedJobsHeaderTitlesOverflowWrap`** / **`wrapMergedJobsHeaderTitles`**). Data: **`jobsWorkedTodayStripRows`** (same scope as **`todaySessionsForStripScope`**; bid-only and rejected/revoked excluded); collapse pref **`dashboard_clock_strip_jobs_worked_today_collapsed`**. **`jobLedgerIdsForReportsLookupKey`** in [`useDashboardMyTeamSectionState`](../src/hooks/useDashboardMyTeamSectionState.ts) avoids refetching strip **missing field report** metadata on every pending refresh so job-row **report-needed** indicators do not flicker after **Approve** (**`RECENT_FEATURES`** **v2.495**). **Implementation**: [`DashboardTeamActiveClockStrip`](../src/components/DashboardTeamActiveClockStrip.tsx), [`useDashboardMyTeamSectionState`](../src/hooks/useDashboardMyTeamSectionState.ts) (`orgWidePendingSessions`, `hoursTodayByUserId` / `hoursTodayByUserIdOrg`, `jobsWorkedTodayStripRows`).
  - **My Time**: Expandable **this week** and **last week** detail. **This week** — per-day grid with interactive cells that open **Edit time** when the day falls in the current **America/Chicago** Sunday–Saturday week (`getDefaultWeekRange()` from `src/utils/dateUtils.ts`). **Last week** — day totals in the grid are read-only (no cell **Edit time**); **last week** hours can still be edited by opening **Edit time** from the **clock strip** (Dashboard / Quickfill **People Hours (new)**), which uses **this + last week** in **`DashboardMyTimeDayEditorModal`** with a **prior-week confirmation** step before the editor (**prior-week gate**: footer omits **NCNS**, **Not coming in**, and the extra **Close**—**Cancel** / **Continue editing** remain). **Strip / grid** opens the modal with full **punch** capabilities (`clockTimesReadOnly` off). **Clock** row **View today’s time** opens the same modal for **today** with **`clockTimesReadOnly`**: **`allowTimelineEdits`** stays on (splits, merges, assign, notes) but **`allowPunchTimeActions`** is off—no Adjust times, force clock-out, reject, or NCNS; title suffix **— punch times locked**. **Close** / backdrop / Escape runs **`requestClose`**, which **auto-saves** dirty clusters when the day is editable and validation passes (same path as strip editor). **Edit time** modal: **Visual** vs **Form** toggle; on open, defaults to **Form** under ~560px viewport width and **Visual** otherwise (see `DashboardMyTimeDayEditorModal.tsx` and `.myTimeDayClusterFormGrid` in `src/index.css`). **Timeline**: sessions that **pairwise overlap** by more than **`CLUSTER_CONTIGUITY_EPS_MS`** (**`hasPairwiseClockIntervalOverlap`**) are **not** grouped into one card—**`buildDayTimeline`** may take **`splitClustersWithPairwiseOverlap`** so each overlapping session is its own cluster; **`expandClustersSplitPairwiseOverlaps`** keeps list state aligned. **Overlapping clock intervals** still show an amber **Overlapping clock times** **`role="status"`** block above the relevant **session cluster**. When a segment’s allocation chips show multiple jobs/bids (**`multiAlloc`**), Form and Visual add the label **Multiple jobs/bids in this span** (with **`aria-label`** on the group). **Form** mode uses a two-column layout: left column **Split**, **Ends at**, and related controls (no separate **Span** label); block header one line **date | start–end**; **time range + duration** on one line (aligned with Visual); long job labels **ellipsis**; **Split** / segment remove align **right** on narrow widths with job row able to stack below ~560px; soft segment dividers (**.`myTimeDayClusterFormSegmentDivider`** in `src/index.css`); **double** gray bottom border when the **next** cluster **overlaps** the current one; **thicker** gray separators between clusters (Form + Visual). In **compact** modal width (~520px **`myTimeCompactLayout`**), the session list scroll area drops border/radius (“frameless” strip). Inner boundaries are edited with **Ends at** on the earlier segment (no duplicate cluster-level start control); per-segment **Split** via `addSplitMidInSegment` in `src/lib/myTimeDayTimeline.ts`. **Merge up** / **Merge down** (Form and Visual) remove a virtual segment by merging with the neighbor above or below (`removeSegmentMergeWithPrev` / `removeSegmentMergeWithNext` in the same module); at least two segments must remain and min segment duration matches splits; **no browser confirm** when the two segments’ job/bid allocation labels already match (`mergeAllocChoiceRequired`). When job/bid labels on the two segments differ, **Combine segments — choose job** (`MyTimeMergeSegmentsModal`) sets **`segmentJobOverrides`** on [`SplitEditorState`](../src/lib/myTimeDayTimeline.ts) so chips and **Save** match; inner-boundary **drag** / **nudge** clears those overrides. Same-day segments use `type="time"` inputs; cross-day clusters use `datetime-local` (`myTimeDayEditorDatetime.ts`, `MyTimeDayClusterForm.tsx`). **Coalesced mixed cluster save** (when the editor has **fewer segments than** `clock_sessions` **rows** in one cluster, e.g. after merging segments): each row’s persisted **`notes`** value matches the **editor segment** for that row’s time partition via **`partitionMixedClusterEditorSegmentsToRowNotes`** / **`coalescedMixedClusterPartitionForSave`** (not one combined note written to every row; **v2.371** in [`RECENT_FEATURES.md`](RECENT_FEATURES.md)). **Add disjoint session** (v2.571): a small ghost-grey **`+`** button at the bottom-right of `myTimeDayTimelineScroll` (right-aligned, tucked under the last cluster's bottom border to visually match the per-cluster **`×`** reject buttons in Visual mode) opens **[`AddDisjointSessionModal`](../src/components/my-time-day-editor/AddDisjointSessionModal.tsx)** — a sub-modal with Clock in / Clock out **`datetime-local`** fields (same shape as the existing Adjust times modal). Default times are computed by **`computeAddDisjointDefaults`**: last session end + 1 h gap, +2 h duration (e.g. last session 1–2 PM → defaults 3–5 PM); for an empty day it falls back to **8 AM** Chicago wall (`salaryZonedWallClockToUtcMs(dateStr, 8, 0, 0, APP_CALENDAR_TZ)`) + 2 h. Validation blocks blank fields, `out <= in`, sessions shorter than **`MIN_SEGMENT_MS`**, future-stamped times, and overlap with any existing session in **`addDisjointExistingIntervals`** (open punches treated as extending to `nowMs` so the user can't slot a closed session "underneath" an in-progress one; error names the conflicting range like *Overlaps an existing session at 13:00 – 14:00*). On confirm, **`handleAddDisjointConfirm`** appends a normalized `DayEditorSession` with a synthetic **`DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX`** id and a seeded `notes='Disjoint session'` (non-empty so `buildPayloads` accepts the segment on Save) into local `fetchedSessions`; the existing **`isDraftPeopleHoursSessionId`** INSERT branch in `persistDirtyChangesAsync` persists it as a fresh `clock_sessions` row on Save — no new DB / RPC / migration code. Gating: button renders only when `effectiveEditable && allowPunchTimeActions && !priorWeekGateActive && sessionsProp.length === 0 && !sessionsLoading && !pendingAuthForFetch` — i.e. on editor instances that self-fetch their day; People-Hours-seeded callsites that pass `sessionsProp` explicitly never see the button (pushing a synthetic draft into their controlled state would desync). `closeTopmostSubFlow` dismisses the disjoint sub-modal first on Escape / backdrop / discard-on-dirty before falling through to other sub-flows. Use **People → Hours** (correct-day audit, pending approvals, etc.) to change time outside the dashboard **this + last week** (America/Chicago) edit window. **Components**: [`DashboardMyTimeSection.tsx`](../src/components/DashboardMyTimeSection.tsx), [`DashboardMyTimeDayEditorModal.tsx`](../src/components/DashboardMyTimeDayEditorModal.tsx), [`MyTimeDayClusterForm.tsx`](../src/components/my-time-day-editor/MyTimeDayClusterForm.tsx), [`MyTimeDayClusterVisual.tsx`](../src/components/my-time-day-editor/MyTimeDayClusterVisual.tsx), [`AddDisjointSessionModal.tsx`](../src/components/my-time-day-editor/AddDisjointSessionModal.tsx), [`myTimeDayTimeline.ts`](../src/lib/myTimeDayTimeline.ts), [`peopleHoursManualDraftSession.ts`](../src/lib/peopleHoursManualDraftSession.ts).
  - **Assistant layout order**: For assistants, Tally and Job Report row and pinned pages appear directly below Clock In/Out, before Ready to Bill and Dispatch. Order: Clock In → Tally + Job Report + pinned pages → Ready to Bill / Dispatch / Billed → Inspections → rest. Non-assistant roles keep the original order. **Lost bids need a reason** (dev, master_technician, assistant, estimator, primary — same **`hasBidsAccess`** as **My Bids**): when **`bids`** with **`outcome = 'lost'`** name the viewer as **`estimator_id`** or **`account_manager_id`** and **`loss_reason`** is empty or whitespace-only (client count up to **500** rows), an amber banner (**[`DashboardLostBidsMissingReasonBanner`](../src/components/DashboardLostBidsMissingReasonBanner.tsx)**) appears above the tally row; click navigates to **`/bids?tab=bid-board`** with **`lostSummary=1`** and **`lostSummaryTab=<user id>`** (query keys removed after handling), which expands the bid-board **Lost** section, opens **Bid Tabs on Lost** (**[`BidBoardLostSummaryModal`](../src/components/bids/BidBoardLostSummaryModal.tsx)**), and selects that staff tab when the id matches a row (**`initialStaffTabUserId`**); invalid tab falls back to **All**. **`closeLostSummaryModal`** in **`Bids.tsx`** clears the pass-through id when the modal closes so manual reopen defaults to **All**. See **`RECENT_FEATURES`** **v2.496**. **Unallocated bank deposits** — **Dashboard** ([**`DashboardArBankUnallocatedBanner`](../src/components/DashboardArBankUnallocatedBanner.tsx)**) above the tally row: **dev** and **assistant** only (**`canRoleSeeArBankUnallocatedDashboardBanner`** in [`useArBankUnallocatedCount.ts`](../src/hooks/useArBankUnallocatedCount.ts)); **master_technician** does not see this Dashboard banner (**`RECENT_FEATURES`** **v2.497**) but still has **Jobs → Stages** AR count / **Bank Payments** via **`canRoleUseArBankCount`**. **Quickfill** **Warnings** and the **`/accounts-receivable`** route still use **`canRoleSeeArBankUnallocatedOrgNudge`** (**dev**, **master_technician**, **assistant**). When **`count_mercury_transactions_for_bank_payments`** is &gt; **0** for an enabled viewer, the count uses the same org-wide **Accounts Receivable Sorting** filter as Jobs **Bank Payments** ([**`resolveBankPaymentsSortingConfigForAr`**](../src/lib/bankingSortingConfig.ts) + **`app_settings`** **`bank_payments_sorting_config_v1`** when present; see §15 Banking). Click navigates to **`/accounts-receivable`**. **`primary`** does not see the org-nudge surfaces; they may still use **Accounts Receivable** / **Bank Payments** from **Jobs → Stages** (badge/count via **`canRoleUseArBankCount`**). Count from **[`useArBankUnallocatedCount`](../src/hooks/useArBankUnallocatedCount.ts)** refreshes on **`window` `focus`** when the hook is enabled for that page. The **Job Parts Tally** shortcut can show a small **unlinked** count badge (**`count_unlinked_mercury_transactions_for_tally`**) matching Job Tally **Show unlinked** (linked-card scope). When **`count_unlinked_mercury_transactions_for_tally_stale`** (default **2** Chicago calendar days since **`posted_at`**) is positive, an orange **Stale tally transactions** banner (**[`DashboardTallyStaleBanner`](../src/components/DashboardTallyStaleBanner.tsx)**) appears above the tally row; it navigates to **`/tally?tab=transactions`** on click (**`window` `focus`** refreshes counts with the unlinked badge). **Dev / master_technician / assistant** also get a blue **Stale tally follow-up** banner (**[`DashboardTallyStaleStaffBanner`](../src/components/DashboardTallyStaleStaffBanner.tsx)**) when **`list_stale_unlinked_mercury_transactions_for_tally_staff`** returns rows — people count and transaction count (up to **500** loaded); opens **[`DashboardStaleTallyStaffFollowUpModal`](../src/components/DashboardStaleTallyStaffFollowUpModal.tsx)** to **Assign** via staff **`replace_mercury_job_splits_for_linked_card_as_staff`** (see migration **`20260405211552_tally_stale_staff_followup.sql`** and **`ACCESS_CONTROL.md`** Dashboard matrix).
  - **Ready to Bill / Billed Awaiting Payment** (dev, master_technician, assistant): Lists mirror Jobs Stages (including **merged** job + **`is_primary_rtb_bundle`** invoice via **`readyToBillDashboardUnits`**); **`get_jobs_ledger_by_status`** supplies **`customer_id`** on job cards for the same customer gate as Jobs. **Invoice / Update** opens the same **Bill Customer** [`SendRecordInvoiceModal`](../src/components/jobs/SendRecordInvoiceModal.tsx) via [`BillCustomerModalContext`](../src/contexts/BillCustomerModalContext.tsx) (job rows load **`jobs_ledger`** billing fields when the modal opens). Without a linked customer: toast only (no navigation). **Ready to Bill** secondary button labels and send-back confirmation copy match Jobs (**Job: Send Job Back**, **Delete draft bill**). No Ham-mode shortcut on the Dashboard (always modal).
  - **My Team (team leads)** (users with **`team_leader_assignments`** as leader): Collapsible **My Team** with **Start–End** week controls; optional **People you lead** roster with per-person **Notify on clock in/out**, **Pending** / **Approved** / **Total** hours for the range, then (when loaded) **Clock activity** (expandable ledger of team **`clock_sessions`** in range) **above** **Active clock sessions** **above** **Pending sessions** (approve/reject in range). Assignments with **`dashboard_hours_visibility = strip_only`** omit that member from this detailed UI (and from pending-approval counts/lists) but they still show in **Currently clocked in** when applicable. If **every** assignment for that leader is **strip_only**, the **My Team** section is **not shown** on the Dashboard (leaders use **Currently clocked in** only for those members). When pending approvals exist for **full** members, a **Pending clock sessions** banner appears on the Dashboard: the **entire yellow bar** is a single **button** (accessible name: go to pending sessions in My Team); it **expands My Team** if collapsed and **scrolls** to the **Pending sessions** card. Pending session data continues to load from the dashboard hook while **My Team** is collapsed.
  - **Upcoming inspection (3 days)** (assistant, dev, master, primary): Next 3 days of inspections (address, type, date) for jobs the user can access; links to Jobs Inspections tab.
  - **User Role Display**: Shows current user's role
  - **How It Works** (Masters/Devs only): Explains system structure
    - PipeTooling helps Masters better manage Projects with Subs.
      Three types of People: Masters, Assistants, Subs
    - Master accounts have Customers
    - Customers can have Projects
    - Masters assign People to Project Stages
    - When People complete Stages, Masters are updated
  - **Sharing** (Masters/Devs only): Explains sharing features
    - Masters can choose to adopt assistants in **Settings → People & accounts**
      - → they can manage stages and see private notes but not financial totals
    - Masters can choose to share with other Masters
      - → they have the same permissions as assistants
  - **Subcontractors** (Masters/Devs only): Quick summary
    - Only see a stage when it is assigned to them
    - Can only Start and Complete their stages
    - Cannot see private notes or financials
    - Cannot add, edit, delete, or assign stages
    - When a Master or Assistant selects to Notify when a stage updates, that stage will show up in their Projects: Subscribed Stages below:
  - **Projects: Assigned Stages**: Disclosure header (chevron + title with count); expandable list of steps assigned to the current user (by `assigned_to_name`). **`aria-controls`** **`dashboard-assigned-stages-panel`**; region **`aria-labelledby`** **`dashboard-assigned-stages-heading`**. After the first assigned load, a one-time effect may collapse the section when no step is **`in_progress`** (user toggles afterward are respected).
    - Shows project name, stage name, status
    - Displays start/end times
    - Clickable project address opens Google Maps in new tab
    - Project links include hash fragment to scroll directly to step card
    - Shows project address and plans link if available
    - Displays notes and rejection reasons if present
    - Shows next step rejection notices if present
    - Action buttons: Set Start, Complete, Approve, Send Back: Previous Work Incomplete (based on role and status; dev, master, assistant, superintendent)
  - **Projects: Subscribed Stages**: Same disclosure pattern as Assigned (**`subscribedStagesExpanded`**, **`dashboard-subscribed-stages-panel`**, **`dashboard-subscribed-stages-heading`**); lists stages the user subscribed to (notification preferences). See **`RECENT_FEATURES`** v2.427.
    - Links to projects and workflows
  - **Team Ready to Bill** (dashboard, non-staff only): Collapsible section **above** Assigned Jobs for **`subcontractor`**, **`primary`**, **`superintendent`**, **`estimator`** — **`ready_to_bill`** jobs where the user is on the team via RPC **`list_ready_to_bill_assigned_jobs_for_dashboard()`** (same shape as assigned jobs; team-scoped, not org-wide **`get_jobs_ledger_by_status`**). Cards include optional **Customer pictures** (images icon under the address when **`job_pictures_link`** is set; **`openInExternalBrowser`**). **Subcontractor** cards: **Leave Report** and **Collect Payment** (opens **`CollectPaymentModal`**, certify → dispatch → staff **Approve for payment** → **hosted Stripe invoice** / **send-stripe-invoice**; **`stripe-webhook`** **`invoice.paid`** completes **`job_collect_payment_flows`** via **`complete_job_collect_payment_flow_for_invoice`**). Step 1 includes a collapsible **Add line items from Job Book** section (loads **`job_book_entries`** whenever Step 1 is open; full-width **search**; **default collapsed**; placed under the line-items table, above certify / request correction). Catalog rows are filtered by **`job_service_type_id`** from **`get_collect_payment_certify_payload`**; **Add** calls **`add_collect_payment_fixture_from_job_book`** and updates **`jobs_ledger.revenue`**. If there is no Ready-to-Bill **`invoice`** on the payload, the amber *No Ready-to-Bill invoice row yet* line appears only while **`fixtures`** is still empty (it hides after at least one line exists). Step 2 **Call Dispatch** is in the modal **footer** with **Close**. Staff edit the catalog under **Settings → Job Book** or **Jobs → Stages** (book icon → **[`JobBookModal`](../src/components/jobs/JobBookModal.tsx)**; shared **[`JobBookEditorPanel`](../src/components/settings/JobBookEditorPanel.tsx)**) (**[`JobBookSettingsSection`](../src/components/settings/JobBookSettingsSection.tsx)**). No **Send to Billing** in this block.
  - **Field: Waiting for Approval** (dashboard, **dev** / **master_technician** / **assistant**): Collapsible **Field: Waiting for Approval** queue (**[`DashboardFieldCollectPaymentQueue`](../src/components/dashboard/DashboardFieldCollectPaymentQueue.tsx)**) for subcontractor **Collect Payment** flows pending **Approve for payment**. **Realtime** on **`jobs_ledger_invoices`** refreshes invoice/Stripe fields without requiring **`job_collect_payment_flows`** row updates alone. Read-only **Line Items** table joins job fixtures with Stripe invoice lines (**`get-stripe-invoice-details`**); **[`fieldQueueFixtureStripeLineMatch`](../src/lib/fieldQueueFixtureStripeLineMatch.ts)** flags likely mismatches (**red** rows). **Job total** row can show *Items in red are not included on the selected invoice.* when any row is red. **Prepare Bill** is **blue** when the job has no billed Stripe invoice yet and **green** when at least one exists; **Add Line Items** opens **Edit Job** with a short **Specific Work** highlight (**`fixturesSectionHighlight`** in **`JobFormModalContext`** / **`JobFormModal`**). Shared Stripe details parsing: **`parseStripeInvoiceDetailsResponse`** (**[`stripeInvoiceDetailsResponse.ts`](../src/lib/stripeInvoiceDetailsResponse.ts)**), also used by **`HostedStripeBillPanel`**. See **`RECENT_FEATURES.md`** v2.341, v2.344.
  - **Assigned Jobs**: Job cards from `list_assigned_jobs_for_dashboard` (status working; user in jobs_ledger_team_members). RPC returns `last_report_at` (max `reports.created_at` for the job) for subcontractor "time since last report" display, and `my_last_report_at` (max `reports.created_at` for the job where **`created_by_user_id`** is the current user) — used for **Leave Report** schedule reminders: after a **`job_schedule_block`** on **today** (company TZ) has ended and the viewer has **no** qualifying report in the last **12 elapsed hours**, **`shouldShowLeaveReportScheduleReminder`** may show a nag icon on **Leave Report** ([`leaveReportScheduleReminder.ts`](../src/lib/leaveReportScheduleReminder.ts), **`RECENT_FEATURES.md`** v2.411). **`job_pictures_link`** is included on this RPC (and team ready-to-bill / superintendent list RPCs); when set, an **images** icon appears **below** the Maps address row and opens the URL via **`openInExternalBrowser`** (**`DashboardJobPicturesLinkRow`** — **`RECENT_FEATURES.md`** v2.414, v2.415). When **empty**, the icon flips to a red **camera-slash** affordance titled *No customer photos link — tap to ask Dispatch to set one*; tapping it calls **`submitLinkJobPicturesDispatchRequest`** which dedupe-SELECTs **`dispatch_requests`** for any open row with **`(job_ledger_id = thisJob, pending_action = 'link_job_pictures', status = 'open')`**, otherwise INSERTs a new row tagged **`pending_action = 'link_job_pictures'`** + **`reference_summary`** = `\`HCP ${hcp} | ${jobName} - ${jobAddress}\`` and fires **`notify-dispatch-request`**; toast confirms *Sent to Dispatch.* (or *Already sent.* on a dedupe hit). Dispatcher resolves it from the inbox **Add Customer Pictures URL** button (see `dispatch_requests.pending_action`). See **`RECENT_FEATURES.md`** **v2.556**. **HCP · job name** is keyboard-focusable and opens **Job Detail** (`DetailJobModal`, `scheduleJobDetail` with `scheduleContext: null`). Each card shows HCP, name, address, View Reports, **Send to Billing** for roles other than **`helpers`** (outlined secondary — white background, `#2563eb` border/text; distinguishes from primary **Leave Report**) [`RECENT_FEATURES.md`](RECENT_FEATURES.md) v2.409 — **`helpers`** omit this control; server **`update_job_status`** also blocks **Working → ready_to_bill** for helpers on the team path (`20270506120000_update_job_status_disallow_helpers_send_to_billing.sql`, v2.411), Open X (time since created or since last report). Subcontractors also see Last report, Leave Report. Superintendents: View link removed. **View Reports** (**[`JobReportsModal.tsx`](../src/components/JobReportsModal.tsx)**): full-screen detail uses **`ReportDetailBody`** (**[`ReportViewModal.tsx`](../src/components/ReportViewModal.tsx)**) with **`fieldLayout="inline"`** (single-line **label — value** for non-signature fields); **`ReportLocationMapsLink`** when **`reported_at_lat`** / **`reported_at_lng`** are returned by list RPCs (**[`RECENT_FEATURES.md`](RECENT_FEATURES.md)** v2.418). **In-progress stage banner**: When job has `in_progress_stage_name`, a full-width soft purple banner spans the bottom of the card; click navigates to Workflow at that step. On mobile, "Open X" displays on one line.
  - **Superintendent Jobs** (superintendent role): Collapsible section (expanded by default) for project-linked jobs from `list_superintendent_jobs_for_dashboard` that are not already in Assigned Jobs. Same card layout as Assigned Jobs (View Reports, **Send to Billing** outlined as above, Open X; no View link); optional **Customer pictures** row under the address when **`job_pictures_link`** is set. **HCP · job name** opens **Job Detail** as on Assigned Jobs. Superintendents can mark jobs Ready for Billing (see `update_job_status` and migration `20260624000000_allow_superintendent_send_to_billing`). In-progress stage banner at bottom links to workflow step.
  - **My Notification History**: Expandable ledger of recent notifications (timestamp, title, channel badge, links to project/workflow/checklist)
  - **Recently Completed Tasks (7 days)**: Expandable section showing checklist items completed in the last 7 days, grouped by completer. **Main section**: Only task types not in dev's ignore list; each item has Mark as read (envelope icon), Re-send (arrow-turn-up icon), Ignore (ban icon) buttons; when read, shows Read (envelope-open icon). **Ignored section** (collapsed by default): Task types dev has ignored; each item has Un-ignore. UNREAD count excludes ignored items.
  - **Performance**: Parallel fetches and progressive rendering with per-section loading flags; skeleton UI for Checklist, Assigned, Subscribed
  - **Checklist FWD (dev-only)**: Each checklist item shows a light grey "fwd" link on the far right; opens modal to edit title and assign to one user; creates new task and removes original. Manage tab shows comma-separated assignees; **Manage** also has client-side **Search by title or assignee** (v2.416).
  - **Card Layout**: 
    - Format: "Stage name - Assigned person"
    - Project link below title
    - Status, start/end times displayed
    - Color-coded by status (green for approved/completed, red for previous work incomplete)

### 9. Settings
- **Page**: `Settings.tsx`
- **Layout/Navigation**:
  - **Gear menu** (top-right in Layout): Settings link (all users); Global Reload (dev-only, broadcasts reload to all connected clients via Supabase Realtime)
  - **Top button row** (Settings page): Sign out, Hard Reload (clears caches, reloads current user only), Change password
  - **In-page jump links**: **People & accounts** (`#settings-people`) appears for **dev** and **master_technician**. Adoption, master-to-master sharing, primaries/superintendents, **Share Cost Matrix and Teams**, and related UI all live in that single group (there is no separate **Sharing & access** section or anchor).
- **Features (All Users)**:
  - **Sign out**: At top of Settings page
  - **Hard Reload**: At top of Settings page; clears caches and reloads current user only
  - **Change Password**: Change your own password (requires current password verification)
  - **My Profile**: Edit own name, email, and phone. Stored in `users` table. Phone is used for `[user phone number]` in prospect copy templates.
- **Features (Dev, Master, Assistant)**:
  - **Dashboard buttons**: Checkboxes to show/hide each quick-action button (Job, Job Labor, Bid, Project, Part, Assembly, New Prospect) on the Dashboard. Stored per-user in `user_dashboard_buttons`.
  - **My Roles Goals** (dev, master, assistant): Pick a user and manage that user’s **daily goal** lines (add, edit, delete, reorder). Stored in **`user_dashboard_goals`**. These drive the full-screen **“My Roles Goals”** gate on the target user’s Dashboard after their first clock-in of the day (see Dashboard **Clock In/Out**); acknowledgment per calendar day is **`user_daily_goals_ack`**.
  - **Dashboard Page Pins** (all roles): Collapsible section visible to all authenticated users. **Page pins** card: Clear all + per-pin Remove list. Shows merged pins from localStorage and `user_pinned_tabs`, filtered by role. Users can manage their own pins (add via Layout pin icon; remove individual pins or clear all in Settings). **Pin Billed, Cost matrix, Supply Houses AP, Sub Labor Due** remain dev-only (checkboxes to pin financial totals to masters/devs dashboards).
  - **Job Book** (Collect Payment): Collapsible **Job Book (Collect Payment line items)** (**[`JobBookSettingsSection`](../src/components/settings/JobBookSettingsSection.tsx)**; shared **[`JobBookEditorPanel`](../src/components/settings/JobBookEditorPanel.tsx)**) — maintain **`job_book_entries`** (**Work**, **Cost**, optional **`service_types`** restriction, reorder). **Add line** focuses **Work** with the default label selected; **Cost** at **0** selects all on focus for faster typing. The same editor opens from **Jobs → Stages** (toolbar book icon, **[`JobBookModal`](../src/components/jobs/JobBookModal.tsx)**). **RLS**: all **`authenticated`** users may **SELECT** (subcontractors read the list in **`CollectPaymentModal`**); **INSERT/UPDATE/DELETE** for **dev** / **master_technician** / **assistant** only.
- **People & accounts** (`settings-people`):
  - **Dev-only blocks** (in order before sharing): Active Accounts and user tools — action row includes **Invite via email**, **Manually add user**, **Archive user**, **Archive User & Reassign Customers**, and **Merge users** (**v2.652**: keep + merge-away pickers with eligibility rules — same role, absorbed archived or never signed in, live account survives; **Preview merge** dry-run shows per-table counts via `merge_user_accounts`; Edge `merge-users` bans the absorbed login); each account row's **Edit** mode ends with a red **Archive** button whose confirm explains the effects (login banned · hidden from lists · nothing deleted · restorable) and warns when the account owns customers — **Role visibility**, **Task Dispatch** group for assistants, **Pay Approved Masters**, **Team feedback** (same **[`TeamFeedbackDevSettingsBlock`](../src/components/team-feedback/TeamFeedbackDevSettingsBlock.tsx)** as **People → Feedback**: **Enabled** persists to DB; **Settings** / **Eligibility** modals; raw submissions with detail modal, CSV, dev delete), **Additional People** (People Created by Me / Other Users), etc.
  - **Sharing and Adoption** (dev and master_technician): Collapsible section for masters and devs (after the dev-only blocks above).
  - **Team feedback aggregates** (pay-approved `master_technician`): Shown after Sharing in this same group.
  - **Adopt Assistants**: Checkbox list to adopt/unadopt assistants
    - Shows all assistants in the system
    - Checkbox indicates adoption status
    - Assistants can see which masters adopted them
    - Adopted assistants gain access to master's customers and projects
  - **Adopt primaries / Adopt superintendents** (master/dev): Same group, within Sharing and Adoption
  - **Share with other Master**: Checkbox list to share/unshare with other masters
    - Shows all other masters in the system (excluding self)
    - Checkbox indicates sharing status
    - Shared masters receive assistant-level access (cannot see financial totals)
    - Viewing masters can see who has shared with them
  - **Share Cost Matrix and Teams** (dev): Grant view-only Pay cost matrix and teams to selected masters or assistants—UI in this group (moved from People Pay; not under Dashboard Page Pins)
- **Jobs & dispatch** (`settings-jobs`, dev): **Job creation overrides** (per user, “create jobs as” another master/assistant; bulk re-assign with confirmation). **Default Labor Rate** ($/hr) for new labor jobs in Jobs → + Labor.
- **Features (Dev Only)**:
  - View all users with roles
  - Change user roles
  - Enter admin code to claim dev role
  - Invite users via email (with role)
  - Manually create users (with password)
  - Delete users (with confirmation)
  - Send magic link to user
  - Impersonate users ("imitate" button)
  - Set a user's password ("Set password" button next to Send email to sign in / imitate)
  - Display last login time
  - **Email Template Management**: Create and edit email templates for all notification types
  - **Prospect copy templates** (dev): Edit default body and subject for No Response Email, Phone call Follow up Email, and Just checking in Email. Stored in `app_settings`. New users inherit these defaults.
  - View all people entries (not just own entries)
  - **Pin to Dashboard** (dev-only, within Dashboard Page Pins section): Pin Billed Awaiting Payment, Supply Houses AP, Sub Labor Due, and Cost matrix (Internal Team) to masters/devs dashboards. Checkbox list of masters/devs, "Pin To Dashboard" and "Unpin All" buttons. Pins appear as shortcut links on the target user's Dashboard with live totals (Billed Awaiting Payment (count) - $total, Supply Houses: $X, Sub Labor Due: $X, Internal Team: $X).
  - **Duplicate Materials** (`/duplicates`): Dev-only page for finding and removing duplicate material parts. Groups parts with 80%+ name similarity; shows Name, Manufacturer, Part Type, Service Type, Best Price, Supply House; filters by "Only show 100% name match" and service type (Plumbing, Electrical, HVAC); delete with type-to-confirm. Accessible via Settings → Duplicate Materials link.
  - **Data backup (dev)**: Export projects, materials, or bids as JSON for backup
    - "Export projects backup" downloads customers, projects, workflows, steps, step actions, subscriptions, line items, projections
    - "Export materials backup" downloads supply houses, material parts, part prices, material templates, template items
    - "Export bids backup" downloads bids, bids_gc_builders, bids_count_rows, bids_submission_entries, cost_estimates, cost_estimate_labor_rows, fixture_labor_defaults, bid_pricing_assignments, price_book_versions, price_book_entries, labor_book_versions, labor_book_entries, takeoff_book_versions, takeoff_book_entries, purchase_orders, purchase_order_items
    - Filenames include date (e.g. `projects-backup-2026-01-26.json`). Exports respect RLS.
  - **Team feedback** (dev): Same admin tools under **People & accounts** or **People → Feedback** (`?tab=feedback`); end-user flow: clock-out prompt and optional Dashboard **Quick feedback**; see **`RECENT_FEATURES.md`** v2.157, v2.162, v2.167, and v2.290.

### 10. Notifications
- **System**: `step_subscriptions` table + step-level flags + `send-workflow-notification` Edge Function
- **Features**:
  - **Two Subscription Types**:
    - **Assigned person**: Notify when step started/complete/re-opened (stored on step as `notify_assigned_when_*`)
    - **Current user (ME)**: Notify when step started/complete/re-opened (stored in `step_subscriptions`)
  - **Cross-Step Notifications**:
    - Notify next step assignee when current step is completed or approved (default: enabled)
    - Notify prior step assignee when current step is marked incomplete (default: enabled)
    - Stored on step as `notify_next_assignee_when_complete_or_approved` and `notify_prior_assignee_when_rejected`
  - Subscribed stages shown in Dashboard
  - Notification preferences displayed in workflow step cards
  - **Email Delivery**: ✅ Fully implemented
    - Automatically sends emails when workflow steps change status
    - Uses customizable email templates from `email_templates` table
    - Sends via Resend email service
    - Respects notification preferences (only sends if enabled)
    - Non-blocking (sent asynchronously, won't block UI)
- **Notification Triggers**:
  - **Step Started**: Sends `stage_assigned_started` to assigned person, `stage_me_started` to subscribed users
  - **Step Completed/Approved**: Sends `stage_assigned_complete` to assigned person, `stage_me_complete` to subscribed users, `stage_next_complete_or_approved` to next step assignee
  - **Step marked incomplete**: Sends `stage_prior_rejected` to prior step assignee
  - **Step Reopened**: Sends `stage_assigned_reopened` to assigned person, `stage_me_reopened` to subscribed users
- **Email Lookup**: Recipients are found by matching names in `people` and `users` tables
- **Template Variables**: Supports `{{name}}`, `{{email}}`, `{{project_name}}`, `{{stage_name}}`, `{{assigned_to_name}}`, `{{workflow_link}}`, `{{previous_stage_name}}`, `{{rejection_reason}}`

### 11. Materials Management
- **Page**: `Materials.tsx`
- **Route**: `/materials`
- **Access**: Devs, master_technicians, assistants, and estimators (estimators see Price Book, Assembly Book, Templates, Purchase Orders; Supply Houses and PO Generator tabs hidden from estimators)
- **Purpose**: Comprehensive system for managing parts, prices, templates, and purchase orders

#### Features

**Price Book Tab**:
- **Filters**: Part Type and Manufacturer dropdowns filter the part list. Filters reset when switching service type (Plumbing/Electrical/HVAC). Work in both paginated and Load All modes.
- **Best Price column**:
  - Shows the lowest available price for each part in the form `$X.XX (Supply House)`.
  - When a part has **no prices**, the Best Price cell is left **blank** instead of displaying "No prices" to keep the table cleaner.
- **Row expansion**:
  - Clicking a part row expands a details panel directly below that row.
  - Expanded content includes:
    - **Notes (SKU, etc.)** – free-text notes from the part record.
    - **Prices list** – all known prices for the part, each on its own line in the form `$X.XX Supply House` (for example, `$3.59 Home Depot`).
    - **Edit prices** button – opens the Part Prices Manager modal for that part.
  - The previous per-row **"Prices"** button in the main table has been removed; all price edits now start from the expanded row.
- **`#` column (price count) and sorting**:
  - `#` shows the number of prices for each part (`part.prices.length`).
  - The `#` column header is clickable:
    - When active, parts are sorted by **fewest prices first** (ascending count), then by name.
    - The header shows an up-arrow indicator when the price-count sort is active.
    - Clicking again toggles back to the default name sort.
- **Data refresh / sync behavior**:
  - Part Prices Manager (`PartPricesManager`) reads and writes `material_part_prices` (with `supply_houses(*)`).
  - After a **successful add, edit, or delete**:
    - The manager reloads its own local prices.
    - It calls the parent `onClose` callback, which clears the modal and re-runs `loadParts()` on the Materials page.
    - `loadParts()` refetches `material_parts` and `material_part_prices` and rebuilds `partsWithPrices`, so Best Price, `#`, and the expanded Prices list all update immediately.
  - A previous **Bad Request** issue when loading prices with no parts has been fixed; `loadParts()` now short-circuits when there are no parts and handles price loading more defensively.
- **Supply house price coverage summary**:
  - At the bottom of the Price Book tab, the UI shows a **Supply house price coverage** section.
  - Implementation:
    - Aggregates `parts[].prices[]` by `supply_house.id`.
    - Maps IDs back to names using `supply_houses`, defaulting to "Unknown supply house" when unresolved.
    - Renders a list like `Home Depot – 42 prices`, sorted alphabetically by supply house name and omitting supply houses with zero prices.
- **Layout**:
  - The page-level `Materials` heading has been removed so the tabs appear at the top of the content area.
  - **Tab order** (dev, master, assistant): **Supply Houses** | **PO Generator** | | **Price Book** | **Assembly Book** | **Assemblies & Purchase Orders** | **Purchase Orders** (**Supply Houses** and **PO Generator** are first, with a vertical-bar separator before **Price Book**—same pattern as Bids Builder Review | Counts). **Supply Houses** and **PO Generator** hidden from estimators and primaries.
- **Parts Management**:
  - Create/edit/delete parts with name, manufacturer, fixture type, notes (SKU numbers)
  - Fixture type dropdown with predefined options (Fitting, Pipe, Drain, Sink, Faucet, Toilet, Shower, Bathtub, Valve, Water Heater, Vent, Trap, Elbow, Tee, Coupling, Other)
  - Search and filter by name, manufacturer, fixture type, notes
  - **Delete button**: Located in Edit Part modal (left side, only visible when editing)
- **Supply House Management**:
  - "Manage Supply Houses" button opens management modal
  - Create/edit supply houses with contact information (all roles: dev, master, assistant, estimator)
  - Manage supply house details (name, contact name, phone, email, address, notes)
  - **Delete supply houses**: **Dev-only operation** (restricted via RLS and UI)
    - Delete button: Located in Edit Supply House form (left side, only visible to devs when editing)
    - Database enforces deletion restriction via RLS policy
    - When a supply house is deleted, all associated price history records are preserved (price history `supply_house_id` set to NULL)
  - Supply houses appear in "Add Price" dropdown after creation
- **Price Management**:
  - Add/edit prices for parts across different supply houses
  - In the PO modal’s supply-house price table, setting New Price to **0** and clicking "Update price" **removes** that price from the price book (deletes the part from that supply house); button label shows "Remove from supply house" when value is 0
  - Track effective dates for prices
  - **Price History**: View complete history with "View History" button
    - Shows: Date Changed, Supply House, Old Price, New Price, Change %, Effective Date, Notes
    - Highlights positive/negative changes with colors
    - Shows "Initial Price" for first entry (where old_price is null)
  - Automatic price history tracking via database trigger (`track_price_history()`)
  - Best price highlighting in prices table
  - **Edit Price Modal**: Delete button only visible after Edit is pressed (right side, next to Update/Cancel)

**Templates & Purchase Orders Tab**:
- **Material Templates**:
  - Search templates by name or description (text input above the list; "No templates match" when filter has no results)
  - Create/edit/delete templates for grouping parts
  - Support nested templates (templates can contain other templates)
  - Add parts and/or templates to templates with quantities
  - **Searchable part picker (Add Item – Part)**: When adding a part to a template, type to filter parts by name, manufacturer, fixture type, or notes; dropdown shows matching parts (up to 50); click to select, Clear to reset. Same filter logic as Price Book.
  - **Delete button**: Located in Edit Template modal (left side)
- **Draft Purchase Orders**:
  - Create purchase orders from templates or manually
  - Add multiple templates and individual parts to a single PO
  - **Searchable part picker (Add Part)**: When adding a part to a draft PO, same combobox as template Add Item—search by name, manufacturer, fixture type, or notes; dropdown with Clear. Uses same filter as Price Book.
  - Edit PO name inline (default: "New Purchase Order [current date]")
  - View all items with best prices from available supply houses
  - **Supply house dropdown**: Each line item’s Supply House cell is a dropdown showing supply houses that have a price for that part, formatted as "Supply House Name - $X.XX". Selecting an option immediately updates the PO item’s supply house and price and recalculates the PO total. "None" clears the supply house. Options load when the dropdown is opened.
  - **Update price in PO**: In the selected PO section, "Update" expands a per-part price table (supply house, current price, new price). "Update price" saves or, if new price is 0, **removes** that price from the price book ("Remove from supply house"). "Use for PO" sets the PO item’s supply house and price.
  - Price confirmation system for assistants:
    - Per-item checkbox to confirm prices
    - Shows "time since checked"
    - Creates price history entry when confirmed
  - Finalize purchase orders (becomes immutable)
  - **Delete button**: Located in selected PO section (left side)

**Purchase Orders (Management) Tab**:
- **PO Management**:
  - View all purchase orders (draft and finalized)
  - Filter by status (all, draft, finalized)
  - Search by name
  - **View PO details inline**: When a PO is selected (View), its details appear in an **inline section** above the "Search purchase orders" bar and table (no modal). Section shows PO name, notes (if finalized), status, items table (column headers use **"Qty"**), **Grand Total** (footer colspan 5; totals coerce to number with NaN fallback), **With Tax** row (editable tax % default 8.25, calculated total), and buttons (Delete, Print, Close, Duplicate as Draft, Go to Projects). Close hides the section. **Open from Bids**: Navigating from Bids Takeoff "View purchase order" passes `location.state.openPOId`; Materials opens Purchase Orders tab and displays that PO, then clears state.
  - **Supply house dropdown**: In the selected PO section, each line item’s Supply House cell is a dropdown (draft only) showing "Supply House Name - $X.XX" options; selecting one updates the PO item and total. For **finalized** POs, Supply House is read-only text (no dropdown).
  - **Confirmed column**: Shown only for **draft** POs (checkbox and timestamp). Hidden for finalized POs.
  - **Print**: Print button opens a new window with a print-friendly document. **Draft**: shows Part, Qty, All prices (every supply house price for that part), Chosen, Total; **Finalized**: shows Part, Qty, Supply House, Price, Total. Grand Total in both. Print window closes after print/cancel.
  - **Finalized PO Features**:
    - **Notes**: Add notes to finalized POs (add-only, cannot be edited)
      - Notes display at top of PO view with user name and timestamp
      - Use cases: final bill amounts, pickup difficulties
    - **Duplicate as Draft**: Create new draft PO from finalized PO
      - Copies all items with same prices and supply houses
      - Resets confirmation status
      - Automatically opens new draft for editing
    - **Add to Workflow**: Link to add PO as line item to workflow steps
  - **Delete button**: Located in selected PO section (left side)

**PO Generator Tab** (dev, master, assistant only; same visibility as Supply Houses):
- **Route**: `/materials?tab=po-generator` (also in [`pinnedTabs.ts`](../src/lib/pinnedTabs.ts) for Materials).
- **Form**: Job (**searchable**, service-type chip filters **`jobs_ledger`**), **for user** (searchable), optional **supply house** (searchable; persisted as **`supply_house_id`** or **null** on ledger rows), optional notes → **Generate** calls **`insert_material_po_generator_entry`** and appends a **unique random** **`po_code`** (10000–99999) to **`material_po_generator_entries`**.
- **Ledger**: Read-only table on the tab (columns include PO #, job, user, supply house, notes, created at/by) — visibility follows **`material_po_generator_entries`** **RLS** (job-scoped for dev / master / assistant).

**Supply Houses Tab** (dev, master, assistant only; hidden from estimators):
- **Header**: "Show paid invoices" toggle (top right) - when off, hides paid supply house invoices; when on, shows all.
- **Supply Houses section**: Summary at top with AP total (Supply Houses: $X); expandable rows per supply house; Add Supply House button. Per supply house: name, address, phone (with **Open website** when **`website_url`** is set), email, **Monthly payment date** (day 1-31, sets Due column); **Invoices** (Invoice #, **Purchase Order #**, Date, Due, Amount, Jobs, Paid, Link, Actions); **Purchase orders** linked via `supply_house_id`. **Purchase Order #** column: red **alert** icon when the cell text parses to a **PO Generator-style** five-digit code (10000–99999) that is **not** found on visible **`material_po_generator_entries`** for **this** **`supply_house_id`** **or** **`supply_house_id IS NULL`** on the ledger row (so codes generated without a supply house still clear the warning). Shop-style references **`NNNNN-N`** (e.g. **`40326-1`**) are **not** parsed as generator codes (**[`parsePoGeneratorCodeFromPurchaseOrderName.ts`](../src/lib/parsePoGeneratorCodeFromPurchaseOrderName.ts)**). If the ledger query errors, **no** icons (fail open). Due column uses `monthly_payment_day` from supply house (e.g. "15th"); unpaid invoices sum to outstanding. Tables: `supply_house_invoices`, `supply_houses`; `purchase_orders.supply_house_id`. UI: **[`SupplyHousesTab.tsx`](../src/components/SupplyHousesTab.tsx)** (also used from Quickfill **`SupplyHousesSection`**).
- **Dev-only Settings**: Pin Supply Houses AP and Pin Sub Labor Due to Dashboard (like Pin AR); pins show on masters/devs Dashboards.

**Integration with Workflows**:
- Finalized purchase orders can be added as line items to workflow steps
- PO details (name, item count, total) displayed in line item memo
- "View PO" button on line items opens PO details modal
- Links back to original purchase order for full details
- Purchase orders sorted by name in "Add PO" dropdown

#### Database Schema

**Tables**:
- `material_po_generator_entries` - Materials **PO Generator** ledger: unique **`po_code`** (integer 10000–99999), **`job_ledger_id`**, **`for_user_id`**, optional **`supply_house_id`**, **`notes`**, **`created_by`**, **`created_at`**; inserts via **`insert_material_po_generator_entry`** (client **SELECT** under job-scoped RLS)
- `supply_houses` - Supply house information (name, contact_name, phone, email, address, notes, monthly_payment_day)
- `supply_house_invoices` - Invoices per supply house (invoice_number, **purchase_order_number**, invoice_date, due_date, amount, link, is_paid); unpaid sum = AP
- `material_parts` - Parts catalog (name, manufacturer, fixture_type, notes)
- `material_part_prices` - Prices for parts by supply house (with effective_date, unique constraint on part_id + supply_house_id)
- `material_part_price_history` - Historical price changes (old_price, new_price, price_change_percent, changed_at, changed_by, notes)
- `material_templates` - Reusable material templates (name, description)
- `material_template_items` - Items within templates (supports nested templates and parts with quantities)
- `purchase_orders` - Purchase orders (name, status: draft/finalized, notes, notes_added_by, notes_added_at, created_by, finalized_at, supply_house_id)
- `purchase_order_items` - Items in purchase orders (part_id, quantity, selected_supply_house_id, price_at_time, price_confirmed_at, price_confirmed_by, sequence_order, notes)

**Database Functions**:
- `insert_material_po_generator_entry(p_job_ledger_id, p_for_user_id, p_supply_house_id, p_notes)` - **SECURITY DEFINER**; assigns random unused **`po_code`**; returns new row id and code (Materials PO Generator tab)
- `track_price_history()` - Trigger function that automatically logs price changes to history table
  - Fires on INSERT and UPDATE of `material_part_prices`
  - Calculates percentage change: `((NEW.price - OLD.price) / OLD.price) * 100`
  - Records timestamp, user, and optional notes
  - Handles initial prices (old_price is NULL for new prices)

**RLS Policies**:
- All tables restricted to devs and master_technicians for CRUD operations
- Purchase order notes can be added to finalized POs (add-only via RLS policy - only when notes is null)
- Assistants can confirm prices on PO items (can update price_confirmed_at and price_confirmed_by fields only)
- Price history table: devs and master_technicians can read (write handled by trigger)

### 12. Action History & Audit Trail
- **System**: `project_workflow_step_actions` table
- **Features**:
  - Complete ledger of all step state changes
  - Tracks: who performed action, when, action type, optional notes
  - Action types: 'started', 'completed', 'approved', 'rejected', 'reopened'
  - Displayed in "Action Ledger" section on each step card
  - Provides full audit trail for compliance and debugging

### 13. Bids Management
- **Page**: `Bids.tsx`
- **Route**: `/bids`
- **Access**: Devs, master_technicians, assistants, and **estimators** (estimators see Dashboard, Materials, Bids, Calendar, Checklist in nav; no access to `/customers` or `/projects`)
- **Purpose**: Track bids, fixture counts, and submission/follow-up per bid

#### Features

**Bid Board Tab**:
- **Sections** (**v2.369+**): Collapsible outcome groups; the first section header is **Unsent / Working Bids** (unsent bids; ties naming to the **Unsent/Working** Kanban tab). Dev **Bid Costs** and **Submission & Followup** use the same label for the unsent bucket.
- **Due-date row order** (**v2.507**): Inside each section, bids sort by **`bid_due_date`** ascending (earliest first); bids with **no due date** (**unmarked**) sort **after** all dated rows; **`id`** tie-break (**[`compareBidsForBidBoardDueDate`](../src/lib/compareBidsForBidBoardDueDate.ts)**, **`RECENT_FEATURES.md`**, **`BIDS_SYSTEM.md`**).
- **Weekly bids sent** (**v2.437+**): Below those sections and above **Estimating Health** — pivot of sent bids by **Sunday–Saturday** company week and **estimator** (**`bidBoardWeeklySentStats`**, **`BidBoardWeeklySentSection`**). **Estimator labor cost** (**v2.442**, **`dev` only**): second table under that block — labor **$ / estimate** and **¢ / $ bid value** from **`clock_sessions`** + **`people_pay_config`** vs the same sent counts and **`bid_value`** sums (**`bidBoardWeeklyEstimatorLaborCost`**, **`BidBoardWeeklyEstimatorLaborDevSection`**). See **`BIDS_SYSTEM.md`** (Bid Board); **`RECENT_FEATURES.md`** v2.437–v2.442.
- **Bid #** (**v2.279+**): When **`bid_number`** is set, the label uses **`formatBidLedgerNumberLabel`** / trade **`ledger_bid_prefix`** (not only **`B{n}`**). On the **board**, **`BidBoardBidNumberMark`** renders prefix and number with **prefix** at **`0.7em`** and **digits** at inherited size (**v2.498**). The cell is **clickable** and opens **Bid preview** (same as the **Preview** eye column); otherwise **`-`**. Inline notes: expand the row (first column); **All notes | Bid notes | Customer notes** use **`UnifiedBidCustomerNotes`** / **`BidNotesTable`** / **`CustomerNotesTable`** (see **RECENT_FEATURES** v2.148, v2.279).
- **Evaluate**: Button to the left of "New" opens a modal with an evaluation checklist (LOCATION, PAYMENT TERMS, BID DOCUMENTS, COMPETITION, STRENGTHS); checklist state resets when the modal is closed.
- **Search**: Full-width search input filters bids by project name, address, customer name, or GC/builder name (case-insensitive). Empty state reflects search and "hide lost" filter.
- Table of bids; all column headers and cells are **centered**. Columns: Project Folder, Job Plans, GC/Builder, Project Name, Address, Win/ Loss, Bid Value, Estimator, Bid Due Date, Bid Date Sent, Distance to Office (miles), Last Contact, Notes, Edit. (Agreed Value and Maximum Profit columns are not shown.)
- **Win/ Loss**: Header is a **button** that toggles hiding/showing lost bids; when hiding lost, label shows "(hiding lost)" and is underlined.
- **Display formatting**: Bid Due Date and Bid Date Sent use **YY/MM/DD** (e.g. 26/02/12). Last Contact uses **short date with day of week** (e.g. "Sun 2/1"). Bid Value uses **compact currency** (e.g. $121k). Distance to Office (miles) column shows value + **mi** (e.g. 66.6mi).
- **Empty bid-value alert** (**v2.532**): When a bid is in **"Not yet won or lost"** (**`bid_date_sent`** set + **`outcome`** not **`won`** / **`lost`** / **`started_or_complete`**) and **`bid_value`** is null / `0` / unparseable, the **Bid Value** cell renders a red filled-circle **`$`** button (18×18 px, **`#dc2626`**) instead of the **—** em-dash from **`formatBidValueShort(null)`**. Click opens the **Edit Bid** modal, scrolls the **Bid Value** field into view (center), focuses + selects it, and flashes a transient amber outline (**`#d97706`**) + background (**`#fffbeb`**) for **1.6s** so the user can type a value immediately. Predicate **[`shouldShowEmptyBidValueAlert`](../src/lib/bidBoardEmptyBidValueAlert.ts)** is reusable for other bid surfaces; focus is wired via **`openEditBid(bid, { focus: 'bidValue' })`** → **`pendingBidFormFocus`** effect in **[`Bids.tsx`](../src/pages/Bids.tsx)**; **Bid Value** input id **`bid-form-bid-value`** in **[`BidFormModal.tsx`](../src/components/bids/BidFormModal.tsx)**.
- **Notes**: Clicking the Notes cell opens a **quick-edit modal** (Notes – [project name]) with a textarea; Save updates the bid's notes and refreshes the table; Cancel closes without saving. Notes cell is clickable with cursor pointer and tooltip "Click to add notes" / "(click to edit)".
- **Edit**: Edit column shows only a **gear/settings icon** (no visible button box; header text hidden, `title`/`aria-label` for accessibility). Opens the full New/Edit Bid modal.
- "New" button opens modal to create/edit bids. **Top of form** (CSS grid `bid-form-top-fields`): **Desktop** — row 1: Estimator, Account Man, Bid Date; row 2: Bid #, **Project Name** (required; spans two columns). **Mobile** — row 1: Estimator | Account Man; row 2: Bid # | Bid Date; row 3: **Project Name** full width. **Estimator**, **Account Man**, **Service Type**, and **Win/Loss** use [`SearchableSelect`](../src/components/SearchableSelect.tsx) (portal list, `z-index` above the modal overlay) instead of native `<select>`. **Estimator** and **Account Man** lists: **`loadEstimatorUsers`** in **`Bids.tsx`** — **non-archived** users only, exclude **Helper** (`helpers` role), exclude display name exactly **delete** (trim, case-insensitive); **`RECENT_FEATURES`** **v2.449**. **Service Type** is required for submit (`bidFormMissingFields` / `bidFormCanSubmit`). **Service Type**, **Win/Loss**, and **Bid Date Sent** share a flex row. **Project Address** is full width, then **Distance to Office (miles)** and **Plan Pages** on a **two-column row** (map link beside distance). Modal `maxWidth` **720px**. **"Save and start Counts"** (bottom left) saves the bid and opens it in the Counts tab. **Win/Loss audit note** (**v2.507**): After a successful **Save** or **Save and start Counts**, when **`outcome`** changes from the value before save (**new bid** first save included), **`insertOutcomeChangeBidNoteAfterSave`** inserts **`bids_submission_entries`** and updates **`bids.last_contact`** using **[`outcomeChangeBidNote.ts`](../src/lib/outcomeChangeBidNote.ts)** (body includes **who changed** (`profileName` or session email) and optional loss reason when **Lost**). Runs before the optional **Confirm bid sent** modal note, which can supersede **`last_contact`**. Then: Project Folder (inline **bid folders** links), Job Plans, **Bid Submission**, **Design Drawings Plan Date**, GC/Builder picker, **Project Contact**, **Submitted to**, Bid Value / Agreed / Maximum Profit, etc. When outcome is **Won**, **Estimated Job Start Date** is shown. Distance uses min 0, step 0.1. Profit label is "Maximum Profit".
- **Edit Bid modal**: **Cancel** button is at **top right** next to the title. **Archive from board**: outline control beside **Delete bid** when the **saved** bid is eligible for working-board archive and not yet archived (**[`workingBoardArchiveEligibility.ts`](../src/lib/workingBoardArchiveEligibility.ts)**); confirm stacks above the form (**`RECENT_FEATURES`** **v2.518**). **Delete**: "Delete bid" opens a separate confirmation modal; user must type the project name (or leave empty) to enable Delete.
- **GC/Builder**: Uses `customers` table as data source with searchable combobox (same pattern as customer picker in ProjectForm). **"+ Add new customer"** option at the top of the dropdown (for dev, master_technician, assistant, and estimator) opens an **Add Customer** modal with the same form as `/customers/new` but without Quick Fill; on save, the new customer is created, list is refetched, and the new customer is selected as the bid's GC/Builder. Legacy `bids_gc_builders` retained for backward compatibility.
- Clicking a GC/Builder name opens a modal: customer details (name, address, phone/email from contact_info, won/lost bids) or legacy GC/Builder details (name, address, contact number, won/lost bids) depending on whether bid has `customer_id` or `gc_builder_id`.

**Estimators Tab** (**v2.531+**, URL `?tab=estimators`, viewable by **all roles**; sits to the **right of Bid Costs**):
- **Purpose**: Days × estimators pivot of **`clock_sessions`** linked to bids over the last **30 days** (**`APP_CALENDAR_TZ`**). Each cell stacks bid chips with that estimator's that-day hours as a percentage of the bid's **lifetime team clock time** (denominator across the whole org). Lets anyone see at a glance where estimator time is going across the pipeline.
- **Cell chips**: `{N}% — {label} ({project clip})`. **`{label}`** is the trade-aware ledger label (e.g. **`BE249`** when **`service_types.ledger_bid_prefix` = `BE`**, **`B412`** when blank — same renderer as the rest of the Bids surface). **`{project clip}`** is the first **10** chars of **`bids.project_name`** + `...` (omitted when ≤10 chars or empty). Bid label is a button — click opens **Bid preview** via **`useBidPreview`**.
- **Search bar** (**v2.534**): full-width input above the table; matches each bid's ledger label (prefix or digits), **`project_name`**, and **GC/Builder name** (**`customers.name`** preferred, legacy **`bids_gc_builders.name`** fallback). Case-insensitive substring. When the query is non-empty: day rows with no matching bid are hidden; estimator columns stay stable (no column hiding); matching chips get an amber pill (**`#fef3c7`** + **`#fcd34d`** inset border) and a bolded bid number; live-region result counter reads **`{N} bid(s) · {K} day(s)`**; **Clear** button resets the query; empty match shows `No bids in the last 30 days match {query}.` Pure predicate **[`bidEstimatorsBidMatchesSearch`](../src/lib/bidEstimatorsTab.ts)** + **`normalizeBidEstimatorsSearchQuery`**, 12 unit tests in **[`bidEstimatorsTab.test.ts`](../src/lib/bidEstimatorsTab.test.ts)**.
- **Cost mode** toggle (**dev only**): appends **`{bidValue × pct}k | {bidValue}k`** per chip via **`formatBidValueK`**; **`bids.bid_value`** missing/non-finite → **`no bid value`** in red (**`#dc2626`** — same red as the Bid Board empty-bid-value alert, **v2.532**).
- **Columns**: **`role = 'estimator'`** users **plus** **`bid_estimators_extra_users`** (org-wide augmentation list). Archived / `delete` users excluded.
- **Manage columns** (**dev / master_technician / assistant** only): button opens **[`BidsEstimatorsExtraUsersModal.tsx`](../src/components/bids/BidsEstimatorsExtraUsersModal.tsx)** to add/remove users from **`bid_estimators_extra_users`**.
- **Server-side aggregation** (RLS-safe): two **`SECURITY DEFINER STABLE`** RPCs in **`20260515102040_bid_estimators_tab.sql`** expose only aggregated hours so non pay-access roles can render the pivot — **`list_bid_estimators_window_hours(p_user_ids, p_start_date, p_end_date)`** (per-cell window decimals) and **`list_bid_estimators_all_time_hours(p_bid_ids)`** (lifetime per-bid totals — the denominator for cell percentages). Both filter **`bid_id IS NOT NULL`**, exclude **`rejected_at`** / **`revoked_at`**, clip open sessions at `now()`.
- **Files**: **[`src/components/bids/BidsEstimatorsTab.tsx`](../src/components/bids/BidsEstimatorsTab.tsx)** (table, fetch, search, memos), **[`src/components/bids/BidsEstimatorsExtraUsersModal.tsx`](../src/components/bids/BidsEstimatorsExtraUsersModal.tsx)**, pure helpers **[`src/lib/bidEstimatorsTab.ts`](../src/lib/bidEstimatorsTab.ts)** (+42 unit tests in **`.test.ts`**), migration **`20260515102040_bid_estimators_tab.sql`**, wired into **[`src/pages/Bids.tsx`](../src/pages/Bids.tsx)**. See **`BIDS_SYSTEM.md`** → Estimators Tab.

**Workflow tabs with a selected bid** (**Counts**, **Takeoffs**, **Cost Estimate**, **Pricing**, **Cover Letter**, **Submission & Followup**, **RFI**, **Change Order**, **Lien Release** — **v2.279+**):
- **Tab strip** (**v2.369+**): Center row groups **Counts** through **Cover Letter**, then a **|** separator, **Submission & Followup**, another **|** , then **RFI**, **Change Order**, **Lien Release**. **Superintendent** still omits Pricing / Cover Letter / Submission; one **|** remains before **RFI**.
- **Unsent/Working** (**v2.369+**): Top-row tab (URL **`tab=working`**) opens the per-user Kanban; system columns **Inbox**, **Working** (hint *shows on clock* — bids there appear as Clock In quick picks after Dispatch schedule jobs; see **`fetchWorkingBoardClockBidPicks`** / **`ClockInOutButton`**). To soft-hide a bid from the board and unsent lists while keeping its column placement, open **Edit bid** and use **Archive from board** in the footer (**`RECENT_FEATURES`** **v2.518**). Inbox unread count badge on the tab.
- Selected-bid **`h2`** includes **`B{n}`** as a preview link when **`bid_number`** is set (**`BidWorkflowTabTitleWithPreview`** in **[`Bids.tsx`](../src/pages/Bids.tsx)**).

**Counts Tab**:
- **Search** box is **below** the selected-bid panel, **full width**; column header is **"Project Name"**. **"Edit Bid"** button in tab header (next to Close) opens Edit Bid modal for the selected bid.
- Selecting a bid shows an inline panel with **Add row**, **Import**, and its fixture/count rows. **Import** opens a modal to paste tab- or comma-separated text (**Fixture**, **Count**, optional **Plan Page**; or four columns: **Fixture**, **Count**, **Group/Tag**, **Plan Page**) for bulk import. Table columns: **Reorder** (drag handle), **Count\***, **Fixture\***, **Group/Tag**, **Plan Page**, **Actions** (centered headers). **Drag-and-drop reordering**: Drag the grip icon to reorder rows; order persisted via `update_bids_count_rows_order` RPC.
- **NewCountRow (add row)**: Fixture, Count, and Plan Page in a **combined** cell; **Fixture quick-select** buttons (Bathrooms, Kitchen, Laundry, etc.) below Fixture input; **number pad** below Count (1–9, C, 0, Delete). **Save** and **Save & Add** (Save & Add keeps form open for another row). Fixture and Count required.

**Takeoffs Tab**:
- Select a bid; table maps fixture counts to **material assemblies** and quantities. **Assembly search** above table ("only show assemblies with these words"); dropdowns use filtered options and always include selected. **Multiple assemblies per fixture** (Add assembly / Remove per mapping). Delete entries only from within the edit modal (no in-row delete).
- **Create purchase order** creates a new draft PO from current mappings; **Add to selected PO** adds items to an existing draft PO (uses shared `materialPOUtils`). **View purchase order** link after create/add navigates to Materials with that PO open (`location.state.openPOId`).

**Cost Estimate Tab**: Combine material and labor by bid; link up to three POs (Rough In, Top Out, Trim Set) per stage; editable labor hours per fixture (step 0.25 for up/down arrows) and labor rate; fixture labor matrix synced with Counts. **Totals** (Total materials, Labor total, Grand total) and material-by-stage amounts use **comma formatting** for numbers over 999 (e.g. $12,345.67) via `formatCurrency()`.

**Cover Letter Tab**: Select a bid; top section shows **Customer** (name, address) and **Project** (Project Name, Project Address). Editable sections: **Inclusions** (one per line, bullets; default "Permits" in both textarea and combined document), **Exclusions and Scope** (one per line, shown as bullets; default four exclusions), **Terms and Warranty** (collapsible; default full paragraph including rock excavation and trip charge / change order language). **Apply Proposed amount to Bid Value** and **Apply custom amount to Bid Value** (when custom amount used) write the amount to the bid's bid_value; both buttons are hidden when bid_value already matches the effective amount. **Combined document (copy to send)** ([`buildCoverLetterHtml`](../src/pages/Bids.tsx)): one **`<p>`** with **`&lt;br/&gt;`** line breaks, **`white-space:pre-wrap`** (leading spaces for inclusion/exclusion indents), **`line-height:1`**. **Copy to clipboard** puts **`text/html` only** (full minimal HTML document + StartFragment/EndFragment) so Google Docs uses rich paste; **Paste without formatting** in Docs still uses plain text ([`buildCoverLetterText`](../src/pages/Bids.tsx)) with a paragraph per line. **Edit bid** button in header opens Edit Bid modal for the selected bid.
- **Design Drawings Plan Date**: A bid-level date-only field (`design_drawing_plan_date`) used for proposal/cover-letter wording (shown in the combined document output where applicable).

**Pricing Tab**:
- Pricing is managed by **Price Book Versions** (named sets of `price_book_entries`) and a per-bid version selection (`bids.selected_price_book_version_id`).
- Each bid can store a selected version (`selected_price_book_version_id`), which is restored when reopening Pricing.
- Each count row (fixture) on a bid is assigned a price book entry via `bid_pricing_assignments` (unique per `(bid_id, count_row_id)`).
- Pricing view compares **estimated cost** (labor + allocated materials) vs **revenue** (price book entry or user override) to compute **margin %**, and flags margin: red (< 20%), yellow (< 40%), green (≥ 40%), including totals.
- **Unit cost overrides**: Users can enter a custom Unit Cost per row; revenue uses `unit_price_override` or `bid_count_row_custom_prices` when set, otherwise the price book entry. **Print** and **Print All** use the same logic—printed output reflects user-entered unit costs.
- **Omit from customer-facing fixture lists**: **`bid_count_row_submission_hides`** (**`bid_id`**, **`count_row_id`**, **`price_book_version_id`**) — when a row exists, that fixture line is omitted from **Cover Letter** combined output and from **Margins** (**Approval**) pricing tables for that version only; revenue totals **still include** the excluded line. **`% of bid revenue`**: click the percentage to toggle (eye icon **only when hidden**) — **`RECENT_FEATURES`** **v2.499**.
- **Generate unit selling price**: when the unit override display is blank, a borderless FA-style trigger in the Unit cost column opens **`GenerateUnitCostModal`** — **Line share of total (%)** targets row revenue from the **current bid total**, then **[`unitPriceFromTargetPctOfTotal`](../src/lib/unitPriceFromTargetPctOfTotal.ts)** derives the unit (or fixed lump); **Apply** persists via **`updateUnitPriceOverride`** ([`GenerateUnitCostModal.tsx`](../src/components/bids/GenerateUnitCostModal.tsx)) — **v2.499**; modal preview labels/layout — **v2.500** (**`RECENT_FEATURES.md`**).
- **Prerequisites**: Pricing expects the bid to have Counts and a Cost Estimate. If a bid has count rows but no cost estimate yet, Pricing prompts you to create one first.
- **Cost allocation (high level)**:
  - **Labor cost** comes from Cost Estimate labor rows (per fixture / tie-in).
  - **Materials** are allocated to fixtures proportionally by labor hours, so margin reflects both labor and an allocated share of materials.

**Submission & Followup Tab**:
- **URL deep link** **`/bids?bidId=…&tab=submission-followup`**: when the bid is not in the current service-type list, a **pending ref** switches **`selectedServiceTypeId`** and applies selection once the bid loads (same pattern as Bid Board pending scroll). Bid and customer note **time** fields use [`toDatetimeLocal`](../src/utils/datetimeLocal.ts) / [`fromDatetimeLocal`](../src/utils/datetimeLocal.ts) in [`BidNotesTable.tsx`](../src/components/bidNotes/BidNotesTable.tsx) and [`UnifiedBidCustomerNotes.tsx`](../src/components/bidBoard/UnifiedBidCustomerNotes.tsx) so **`datetime-local`** matches stored UTC (**v2.329**, [`RECENT_FEATURES.md`](RECENT_FEATURES.md)).
- **Five tables** (in order): **Unsent / Working Bids** (bid_date_sent null), **Not yet won or lost** (sent, outcome not won/lost/started_or_complete), **Won**, **Started or Complete**, **Lost**. Each section has a **clickable header** with chevron (▼ expanded, ▶ collapsed) and item count (e.g. "Unsent / Working Bids (3)"); tables are shown/hidden by section state. "Lost" is collapsed by default. Search filters all five. Clicking a row selects the bid and shows its submission entries in a panel above.
- **Selected bid panel**: When a bid is selected, an inline panel shows the bid title (**`h2`**: **`B{n}`** opens **Bid preview** when numbered — **v2.279**), then a **bid summary**: Builder Name, Builder Address, **Builder Phone Number**, **Builder Email** (from customer or legacy GC/Builder), Project Name, Project Address, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**, Bid Size (project contact fields are stored per bid and are not shown on the Bid Board). **Notes strip** (**v2.279**): **+ bid note** / **+ customer note** and **All | Bid | Customer** on one row (wide: actions left, tabs right; narrow/mobile: stacked, centered). **Call script buttons** above the contact table: **Sent Bid Script** and **Bid Question Script** open read-only modals with the respective script text. Below that: **Margins** section includes:
  - **Approval PDF** download button (multi-page packet: Submission and Followup, Pricing [landscape], Cost Estimate, Cover Letter; pricing table has Per Unit column; Per Unit and Revenue as whole numbers; Cover Letter "Inclusions:" and "Exclusions and Scope:" headings bold)
  - **Bid links**: Bid Submission, Project Folder, Job Plans (rendered as clickable links in the PDF with spacing between them)
  - **Cost estimate** status/amount (if available)
  - **Pricing by version** list (Price Book Version → Revenue and Margin)
  - "Our Cost" is **not shown** (redundant with cost estimate amount)
  - **View cost estimate** / **Create cost estimate** button switches to the Cost Estimate tab with that bid preselected
  - Then: submission entries table (Contact method, Notes, Time and date), "Add row", **Edit icon** (gear) next to Close (opens that bid's full edit modal), and Close.
- **Not yet won or lost** table: Columns Project/GC, GC/Builder (customer), Time since last contact, Time to/from bid due date, **Edit**. **Unsent / Working Bids** table: Columns Project/GC, Bid Due Date, Bid Date Sent, Time since last contact, Time to/from bid due date, **Edit**. **Time since last contact** uses the more recent of `bid.last_contact` or the latest submission entry's `occurred_at`; a 60-second re-render (when tab is active) keeps relative times updated. Adding or editing a submission entry updates the bid's `last_contact` to that entry's date and refetches bids. **Time to/from bid due date** shows e.g. "X days since deadline", "Due today", "X days until due". **Edit** column: gear icon button when that row is the selected bid; opens full edit modal (click uses stopPropagation).
- **Won**, **Started or Complete**, and **Lost** tables: Won shows Project/GC, Estimated Job Start Date (YY/MM/DD), GC/Builder (customer), Edit. Started or Complete shows Project/GC, GC/Builder (customer), Edit. Lost shows Project/GC, Bid Due Date, Edit. Win/ Loss dropdown in New/Edit bid includes Won, Lost, and Started or Complete.
- **Submission entry rows**: Edit and Delete are **icon buttons** (gear for Edit, trash for Delete) with tooltips; same behavior as before (inline edit for Edit, confirm then delete for Delete).

#### Database Schema (Bids)

**Tables**:
- `bids_gc_builders` – Legacy GC/Builder entities (name, address, contact_number, email, notes, created_by)
- `bids` – Main bids (drive_link, plans_link, **bid_submission_link**, **design_drawing_plan_date**, gc_builder_id, customer_id, project_name, **bid_number**, address, gc_contact_name, gc_contact_phone, gc_contact_email, bid_due_date, bid_date_sent, outcome, bid_value, agreed_value, profit, estimated_job_start_date, distance_from_office, last_contact, notes, created_by, estimator_id, selected_*_book_version_id fields)
- `bids_count_rows` – Fixture/count per bid (bid_id, fixture, count, group_tag, page, sequence_order)
- `bids_submission_entries` – Submission/follow-up entries per bid (bid_id, contact_method, notes, occurred_at). **Programmatic Win/Loss lines** (**v2.507**): when **`outcome`** changes on bid save (**`insertOutcomeChangeBidNoteAfterSave`** in **`Bids.tsx`**), **`notes`** rows are appended via **`buildOutcomeChangeBidNoteBody`** in **`outcomeChangeBidNote.ts`**; **`contact_method`** is **`NULL`**. **`Confirm bid sent`** and manually added submission rows behave as before.
- `price_book_versions` – Price book versions (named sets of entries)
- `price_book_entries` – Price book entries per version (fixture_name with per-stage prices and total)
- `bid_pricing_assignments` – Assignments linking bid count rows to price book entries (used by Pricing tab; includes **`unit_price_override`**, **`is_fixed_price`**; legacy **`omit_from_submission_documents`** removed — use **`bid_count_row_submission_hides`** instead)
- `bid_count_row_submission_hides` – Omit fixture lines from Cover Letter / Approval pricing lists per price-book version (composite PK **`(bid_id, count_row_id, price_book_version_id)`** — **v2.499**, migrations **`20270521120000`**, **`20270521120100`**)

**Migrations**: `create_bids_gc_builders.sql`, `create_bids.sql`, `create_bids_count_rows.sql`, `create_bids_submission_entries.sql`, `add_bids_customer_id.sql`, `add_bids_count_rows_page.sql`, `split_bids_project_name_and_address.sql`, `add_bids_estimated_job_start_date.sql`, `add_bids_gc_contact.sql`, `add_bids_estimator_id.sql`, `add_bids_bid_submission_link.sql`, `add_bids_design_drawing_plan_date.sql`, `allow_assistants_access_bids.sql`, `allow_estimators_access_bids.sql`, `allow_estimators_select_customers.sql` (customers SELECT/INSERT for estimators), `allow_masters_see_all_bids.sql`; **`20270521120000_bid_count_row_submission_hides.sql`**, **`20270521120100_drop_bid_pricing_assignments_omit_from_submission_documents.sql`** (submission hides + **`duplicate_bid_to_service_type`** copies hides). See **`MIGRATIONS.md`** for complete history.

**RLS**: Bids tables allow devs, masters, assistants, and estimators full access under the policies noted in **`MIGRATIONS.md`** (assistants via `allow_assistants_access_bids.sql`, estimators via `allow_estimators_access_bids.sql`; masters see all bids via `allow_masters_see_all_bids.sql`; primaries and superintendents per later bid-access migrations). Child tables (`bids_count_rows`, `bids_submission_entries`) follow parent bid access. **`bid_count_row_submission_hides`** and **`bid_pricing_assignments`** use **`can_access_bid_for_pricing(bid_id)`** ( **`20270521120000`** — **RECENT_FEATURES** **v2.499**). Customers table: estimators can SELECT all and INSERT when master is assigned (see `allow_estimators_select_customers.sql`).

### 14. Integration Features
- **Google Maps Integration**: 
  - Project addresses on Dashboard are clickable
  - Opens Google Maps search in new tab with project address
- **Email/Phone Integration**:
  - Email addresses are clickable (mailto: links)
  - Phone numbers are clickable (tel: links)
  - Available in People page, Workflow step cards, and Dashboard
- **Direct Navigation**:
  - Project links from Dashboard include hash fragments (`#step-{id}`)
  - Automatically scrolls to specific step card when navigating to workflow
  - Workflow header stage names are clickable and scroll to their cards

### 15. Banking (`/banking`)
- **Page**: [`Banking.tsx`](../src/pages/Banking.tsx)
- **Layout**: Two tab rows. **Product**: **Mercury** | **Stripe** (Stripe row visible to **dev** only; master/assistant URLs that set **`product=stripe`** clamp to Mercury **User Sort**). **Mercury** second row: **Ledger** (**dev** only), **User Sort**, **Drag Sort**, **Accounting** (assistants / masters default to User Sort; **`?tab=drag_sort`** / **`?tab=accounting`**). **Stripe** second row: **Invoices**, **Data** (dev only).
- **Mercury → Team notes (org)** ( **`RECENT_FEATURES.md`** → **v2.480** / **v2.479** / **v2.478** / **v2.477** / **v2.476** / **v2.475**): On **Ledger**, **User Sort**, and **Drag Sort**, the control on the **second line under Amount** is **Edit note** / **Hide edit** ( **`stopPropagation`** so the dollar amount still toggles transaction detail). When any Mercury **`note`**, **`external_memo`**, or saved org **`mercury_transaction_org_notes`** body exists, a **read-only preview** sub-row shows by default ([`MercuryTxNotesReadOnlyPreview`](../src/components/banking/MercuryTxNotesDisclosure.tsx)); org text is a **single indented line** with ellipsis (**v2.477**). **v2.478** — **focus** + auto-grow org **`textarea`**, **Save** closes editor, **Close** when draft empty, actions **right** ([`MercuryTxNotesEditorPanel`](../src/components/banking/MercuryTxNotesDisclosure.tsx)). **v2.479** — **Band grouping**: **`mercuryTxNotesSubRowTdStyle`** (**transparent **`td`**) draws the **divider under** the preview/editor content (**`border-bottom`** **`#e5e7eb`** only — no **`border-top`** seam); **`BankingMercuryTable`** and **`DragSortLedgerRow`** suppress summary **bottom borders** and trim **bottom cell padding** when that stripe follows (**`notesContinuationBelow`** / **`suppressBottomDivider`**); **`mercuryTxNotesSubRowInnerStyle`** keeps **minimal vertical gap** from the Amount row. **v2.480** — Preview/editor sub-rows split into spacer + content **`colSpan`** so text **starts under Counterparty** ( **`bankingMercuryNotesSubRowColSpans`** [**`bankingMercuryNotesSubRowColSpan.ts`**](../src/lib/bankingMercuryNotesSubRowColSpan.ts)); **Drag Sort** spacer covers **Posted** + **Amount**; inner padding no longer fixed **`3rem`** left gutter. **`v2.475`** removed the separate **Notes** table column; sub-row **`colSpan`** sums match **`tableColSpan`** for expanded detail parity. Implementation: [`Banking.tsx`](../src/pages/Banking.tsx) **`BankingMercuryTable`**, [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx).
- **Mercury → Sorting** ( **`RECENT_FEATURES.md`** → v2.401): On the **Sorting** tab, **Configuration**, **User Card Link**, and **Nicknames** (ledger **mercury_debit_card_nicknames** UI) are grouped in the **top-right of the Banking header** (normal document flow; they scroll with the page, not viewport-fixed). The **sorting** toolbar row places **Show unsplit only** and **Show unlinked only** on the left, a flex-growing **search** field in the center, and **Refresh from Mercury** and **Reload table** on the right. There is no visible “Search transactions” label on that input; use **`aria-label="Search transactions"`** for screen readers. **User Card Link** sets **`mercury_debit_card_user_links`** (card → Tally user) and optional **`auto_assign_user_id`** (FK to **`public.users`**) so new and backfilled transactions can populate **`mercury_transaction_attributions.user_id`** when still unattributed — see [`BankingUserCardLinkModal.tsx`](../src/components/BankingUserCardLinkModal.tsx) and migration **`20260424161028_mercury_debit_card_auto_assign_user.sql`**.
- **Mercury → Drag Sort** ( **`RECENT_FEATURES.md`** → **v2.506** (**Counterparty frequency** shared modal) / **Quick label `v2.481`–`v2.484`** plus **DnD** `v2.474` / `v2.473` / `v2.472` / `v2.471` / `v2.470` / `v2.467`; **Team notes on Drag Sort ledger** **`v2.475`**–**`v2.480`**): User-defined **labels** (**`name`**, optional **`schedule_c_line`**, **`description`**) plus **built-in** defaults (**`is_system_default`**, **`default_key`**, seeded from [`dragSortDefaultLabels.ts`](../src/lib/dragSortDefaultLabels.ts)); org-wide shared labels and assignments (**`mercury_drag_sort_labels`**, **`mercury_transaction_drag_sort_assignments`** — **`20260502183057_mercury_drag_sort_labels.sql`**, **`20260502191955_mercury_drag_sort_labels_schedule_c.sql`**, **`20260502193138_mercury_drag_sort_label_system_defaults.sql`**, **`20260502202929_rename_drag_sort_rent_lease_builtin_names.sql`**, **`20260502224616_mercury_drag_sort_org_wide_labels.sql`**). **Sidebar** **`LabelDropZone`** cards (**[`dragSortLabelBucketCard.tsx`](../src/components/banking/dragSortLabelBucketCard.tsx)**; **`variant="sidebar"`**): when **expanded**, **`[C{n}]`** and **tx · $** remain in the **footer** row (title-only when collapsed beside **Accounting Labels**). **Quick label** modal (**[`BankingMercuryDragSortFocusModal.tsx`](../src/components/banking/BankingMercuryDragSortFocusModal.tsx)**, **`variant="grid"`**): **expanded** tiles inline **tx · $** + **`[C…]`** on the **title** row (**v2.484**); **Undo** up to **two** modal picks (**v2.483** via **`quickLabelUndoStack`** in tab); fullscreen flow + **`applyDragSortAssignment`** + slide-off since **v2.481** (**v2.482** **`DragSortLabelBucketCard`** parity / **`labelsCardsExpanded`**); **FocusTransactionCard** denser preview + **`Search labels…`** beside **`Remaining unlabeled`** (**v2.484** layout). Ledger table **Accounting Label** column shows the assigned label **name** only (tooltip carries Schedule C line + description). Right column heading **Accounting Labels** (cards, **Unlabeled**, add form). **Counterparty** column header opens the shared **Counterparty frequency** dialog ([**`MercuryCounterpartyFrequencyModal.tsx`**](../src/components/banking/MercuryCounterpartyFrequencyModal.tsx), **`counterpartyFrequenciesAboveMin`** in [**`bankingMercuryCounterpartyFrequency.ts`**](../src/lib/bankingMercuryCounterpartyFrequency.ts) — counterparties with **3+** rows in the current filtered list, sorted by count **desc**; **v2.506**; same component as **Accounting** Sorting Ledger). Read-only notes preview may show **Mercury sync bank description + notes** as one **piped line** (**`dragSortPipe`**, [`mercuryBankDescriptionFromRaw.ts`](../src/lib/mercuryBankDescriptionFromRaw.ts)) — **v2.479** layout above. **v2.474**: **Collapse** / **Expand** beside **Accounting Labels** collapses **all** label cards to title-only (hides card footer **`[C{n}]`** and **tx · $**); **Unlabeled** and the add-label form stay expanded. **v2.472**: optimistic **Unlabeled** / per-label **tx · $** counts (**`applyAssignmentDelta`** + full **`buildBucketStats`** on reload/revert), **`React.memo`** ledger rows, **`pointerWithin`** + overlay-only drag (handle hidden while dragging, **`DragOverlay`** **`dropAnimation` duration 0**), fire-and-forget upsert/delete with **revert + toast** on failure. UI: [`BankingMercuryDragSortTab.tsx`](../src/components/banking/BankingMercuryDragSortTab.tsx); **`?tab=drag_sort`**.
- **Mercury → Accounting** ( **`RECENT_FEATURES.md`** → **v2.506** / **v2.505** / **v2.504** / **v2.503** / **v2.492** / **v2.490** / **v2.489** / **v2.488** / **v2.485** / **v2.486** / **v2.487**): **`?tab=accounting`** — **rules** (**`mercury_accounting_label_rules`**) match transactions with **AND** criteria: **amount** (inclusive min/max on **`mercury_transactions.amount`**; **v2.486** normalizes **Min**/**Max** when the user enters the numeric bounds in either field order — see **`resolveAccountingRuleAmountBounds`** in [**`accountingLabelRuleMatch.ts`**](../src/lib/accountingLabelRuleMatch.ts)), **counterparty** (**`counterparty_name`**, contains/equals), **bank description** (**`raw.bankDescription`** via [**`mercuryBankDescriptionFromRaw.ts`**](../src/lib/mercuryBankDescriptionFromRaw.ts)). **Test** and **Apply rules** scan the **same loaded list** as the main Mercury table (**account** / **kind** / toolbar **search**), not the Sorting Ledger search. **Suggestions** (**`mercury_accounting_label_suggestions`**; migration **`20260504011219_mercury_accounting_label_rules_and_suggestions.sql`**), **Approvals** queue (**v2.487**: **Approve all** bulk-approves pending rows), read-only **Sorting Ledger** ([**`bankingMercuryDragSortLedger.tsx`**](../src/components/banking/bankingMercuryDragSortLedger.tsx), [**`BankingMercuryAccountingTab.tsx`**](../src/components/banking/BankingMercuryAccountingTab.tsx)). **More filters** (**v2.489**–**v2.492**; [**`BankingMercuryAccountingLedgerFilterModal.tsx`**](../src/components/banking/BankingMercuryAccountingLedgerFilterModal.tsx), [**`bankingAccountingLedgerFilters.ts`**](../src/lib/bankingAccountingLedgerFilters.ts)): **posted date**, **amount** min/max, **transaction type** (`mercury_transactions`.`kind` checkboxes from rows in scope, **v2.490**), **Exclude counterparty** (**`excludeCounterpartyContains`**: case-insensitive substring match on **`counterparty_name`**, max **50** phrases, **v2.492**; null/blank counterparties are not excluded), **job split**, **Person unassigned only** — per-user **`v:1`** JSON via **`readAccountingLedgerFiltersRaw` / `writeAccountingLedgerFiltersRaw`** in [**`bankingDragSortStorage.ts`**](../src/lib/bankingDragSortStorage.ts); pipeline after the tab’s **search**, before **Hide labeled**. **Hide labeled** on the Sorting Ledger defaults **on** (**v2.488**): per-user **`localStorage`** via [**`bankingDragSortStorage.ts`**](../src/lib/bankingDragSortStorage.ts) — absence of key means hide; **`'0'`** when the user turns hide **off** (legacy **`'1'`** still means hide **on**; users who previously had hide **off** with no key now see hide until they uncheck once). **Sorting Ledger** heading **`Sorting Ledger (n)`** reflects visible transaction count; **Counterparty** shows **`Name (k)`** where **`k`** counts matching trimmed **`counterparty_name`** in the same visible list ([**`bankingMercuryCounterpartyFrequency.ts`**](../src/lib/bankingMercuryCounterpartyFrequency.ts)). **v2.506** — Click **Counterparty** header opens the shared **Counterparty frequency** modal ([**`MercuryCounterpartyFrequencyModal.tsx`**](../src/components/banking/MercuryCounterpartyFrequencyModal.tsx); **`counterpartyFrequenciesAboveMin`** on **`displayTransactions`** — lists names with **3+** rows, count **desc**; scope copy reflects **Search** + **More filters** + **Hide labeled**). **Rules** section: **`Search rules…`** filters **Name** / **Label**; **Name** and **Label** column headers toggle sort ([**`accountingRulesTableSearch.ts`**](../src/lib/accountingRulesTableSearch.ts)). **New/Edit rule** uses **`SearchableSelect`** for target label, ordered by **`list_mercury_drag_sort_label_assignment_counts`** ([**`MIGRATIONS.md`**](MIGRATIONS.md) **`20260505231245_list_mercury_drag_sort_label_assignment_counts.sql`**). **Sorting Ledger filters** modal ([**`BankingMercuryAccountingLedgerFilterModal.tsx`**](../src/components/banking/BankingMercuryAccountingLedgerFilterModal.tsx)) uses **Sorting Ledger filters** title.
- **URL**: **`?product=mercury|stripe`** and **`?tab=…`**. Mercury tabs: **`ledger`**, **`sorting`** (User Sort), **`drag_sort`**, **`accounting`**. Stripe tabs: **`invoices`**, **`data`**. **`?tab=sorting`** without **`product`** still opens Mercury **User Sort** (legacy bookmarks).
- **Sorting `localStorage`**: Banking and Quickfill **Banking sorting** share **`banking_sorting_config_v1_<userId>`** ([`loadBankingSortingConfig`](../src/lib/bankingSortingConfig.ts)). Jobs **Stages** → **Bank payments** → **Accounts Receivable Sorting** uses org-wide **`app_settings`** **`bank_payments_sorting_config_v1`** (JSON **`BankingSortingConfigV1`**; dev writes; see [`fetchBankPaymentsSortingConfigFromAppSettings`](../src/lib/bankingSortingConfig.ts)); legacy per-user **`bank_payments_sorting_config_v1_<userId>`** is read only when no server row exists yet. A global **`localStorage`** cache **`bank_payments_sorting_config_v1__cache`** mirrors the server after fetch/save. Stored fields include optional **exclude** substring lists for Mercury **counterparty** and **note** (case-insensitive; same filter as **`list_mercury_transactions_for_bank_payments`** / **`count_mercury_transactions_for_bank_payments`**). **Kind** badge labels/colors for Bank Payments are stored in **`app_settings`** (**`bank_payments_kind_badges_v1`**); see [`bankPaymentsKindBadges.ts`](../src/lib/bankPaymentsKindBadges.ts) and [`appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts).
- **Mercury**: Existing ledger table, sorting workflow, transaction attributions / job splits (see **`ACCESS_CONTROL.md`** Banking row).
- **Stripe — Invoices**: [`BankingStripeInvoicesPanel.tsx`](../src/components/BankingStripeInvoicesPanel.tsx) lists **`jobs_ledger_invoices`** with embedded job (HCP, name, customer). **Seq** shows **`sequence_order`**. Rows missing **`stripe_invoice_id`** use a light red background.
- **Stripe — Data**: [`BankingStripeWebhookEventsPanel.tsx`](../src/components/BankingStripeWebhookEventsPanel.tsx) lists **`stripe_webhook_events`** (written by **`stripe-webhook`** for dedupe; dev SELECT RLS). Migration: **`20270410130300_stripe_webhook_events_dedupe.sql`**.

### 16. Map (`/map`)
- **Page**: [`Map.tsx`](../src/pages/Map.tsx)
- **Components**: [`MapPageView.tsx`](../src/components/map/MapPageView.tsx) — [**Leaflet**](https://leafletjs.com/) + OpenStreetMap tiles; color-coded **circle markers** for **jobs**, **bids**, and **estimates**; **Geoman** polygon draw; **layer** toggles + **Reload** in the **top** toolbar; **scrollable table** listing entities **below** the map; **Filter** (**search**) sits on the **same row as the table heading** (**All visible layers** / search results / in-drawn-area) via [`mapEntitySearch.ts`](../src/lib/map/mapEntitySearch.ts); viewport-fixed **Debug** (bottom-right `<details>`) opens **Review geocodes** ([`MapGeocodeReviewModal.tsx`](../src/components/map/MapGeocodeReviewModal.tsx) — dedupe by address, batch re-run, optional **Google** refresh for selected rows)
- **Default view** (org): **dev** — **Settings** → [`MapDefaultViewSettingsBlock.tsx`](../src/components/settings/MapDefaultViewSettingsBlock.tsx) saves center, zoom, and address label into **`app_settings`** **`map_default_view_v1`** ([`mapDefaultViewSettings.ts`](../src/lib/mapDefaultViewSettings.ts), [`appSettingsKeys.ts`](../src/lib/appSettingsKeys.ts)). [`MapPageView`](../src/components/map/MapPageView.tsx) applies it when the viewport is not using fit-bounds from the current entity set.
- **Data hook**: [`useMapPageData.ts`](../src/hooks/useMapPageData.ts) — loads address-bearing jobs/bids/estimates (RLS-visible rows), merges **`address_geocodes`**; clears **Loading…** immediately after cached coordinates apply, then invokes Edge **`geocode-address-batch`** in chunks (≤20 addresses) for misses with a **generation** guard so **Reload** does not race; optional **Resolving addresses…** line plus collapsible progress list; **`geocode-one`** remains for [**MapGeocodeReviewModal**](../src/components/map/MapGeocodeReviewModal.tsx) **`refresh_google_only`** and **Settings** default-map label flows ([`invokeGeocodeOneRefreshGoogleOnly.ts`](../src/lib/map/invokeGeocodeOneRefreshGoogleOnly.ts), [`mapDefaultViewSettings.ts`](../src/lib/mapDefaultViewSettings.ts)); see [**EDGE_FUNCTIONS.md**](./EDGE_FUNCTIONS.md) (**`geocode-one`**, **`geocode-address-batch`**)
- **Access**: **dev**, **master_technician**, **assistant**, and **estimator** — **[`Map.tsx`](../src/pages/Map.tsx)** + [`layoutRouteAccess.ts`](../src/lib/layoutRouteAccess.ts) / [`Layout.tsx`](../src/components/Layout.tsx); desktop **pin** in header when `canShowMapNav`; **narrow width** hides the pin → **Map** is under **gear** for eligible roles; **`address_geocodes`** RLS and Edge role checks (**`20270520120000_address_geocodes_estimator_map_access.sql`**) include **estimator**

---

## File Structure

```
pipetooling.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment
├── public/
│   ├── .nojekyll               # Prevents Jekyll processing
│   └── favicon.svg             # Site favicon (orange gear + white wrench)
├── src/
│   ├── components/
│   │   ├── Layout.tsx          # Main layout with navigation
│   │   ├── map/                # /map: MapPageView, MapGeocodeReviewModal, mapEntitySearch
│   │   └── NewCustomerForm.tsx # Shared create-only customer form (Bids Add Customer modal, /customers/new)
│   ├── contexts/
│   │   ├── ToastContext.tsx       # Shared toast notifications; useToastContext()
│   │   ├── ForceReloadContext.tsx  # Global reload trigger
│   │   ├── JobsListCacheContext.tsx # Shared jobs list: Jobs + JobsAccountsReceivable
│   │   └── ChecklistAddModalContext.tsx
│   ├── hooks/
│   │   ├── useMapPageData.ts  # /map: jobs, bids, estimates + address_geocodes
│   │   └── useAuth.ts          # Authentication hook
│   ├── lib/
│   │   ├── map/                # invokeGeocodeOneRefreshGoogleOnly, normalizeAddressForGeocode
│   │   ├── supabase.ts         # Supabase client initialization
│   │   ├── hardReload.ts       # SPA hard reload: /?nocache + sessionStorage restore (GitHub Pages)
│   │   └── materialPOUtils.ts # Shared PO helpers (expandTemplate, addExpandedPartsToPO; Materials & Bids Takeoff)
│   ├── pages/
│   │   ├── Calendar.tsx        # Calendar view
│   │   ├── Checklist.tsx       # Checklist (Today, History, Review, Manage)
│   │   ├── CustomerForm.tsx    # Create/edit customer
│   │   ├── Customers.tsx       # List customers
│   │   ├── Dashboard.tsx       # User dashboard
│   │   ├── People.tsx          # People roster (Users, Hours — pay tools + matrix in Hours)
│   │   ├── Jobs.tsx           # Jobs (Reports, Stages, Billing, Team Labor, Sub Labor, Crew P&L, Parts, Job Summary, Inspections)
│   │   ├── Map.tsx            # Map: jobs/bids/estimates on Leaflet + address_geocodes (dev / master / assistant / estimator)
│   │   ├── ProjectForm.tsx    # Create/edit project
│   │   ├── Materials.tsx       # Materials management (price book, templates, purchase orders)
│   │   ├── Bids.tsx            # Bids management (bid board, counts, takeoffs, cover letter, submission & followup); Confirm bid sent optional Adds to bid note → bids_submission_entries (v2.383)
│   │   ├── Projects.tsx       # List projects
│   │   ├── ScheduleDispatch.tsx # Hub vs job-week router → ScheduleDispatchHubPage / ScheduleDispatchJobWeek; hub loads team user ids via jobs_ledger_team_members in batches (JOBS_LEDGER_TEAM_MEMBERS_JOB_ID_CHUNK in scheduleDispatchHub.ts) for large jobs_ledger lists; mobile (≤640px): transparent sticky first column + name pills — scheduleDispatchMobileNamePill.ts, HubPeoplePanel, ScheduleDispatchGrid; "Not coming in today" lifecycle (v2.535): ScheduleDispatchAssignJobPickerModal footer (single-cell intent only) → recordNotComingInForUserAsStaff (pay_staff_bulk_insert_user_time_off) + bulk deleteJobScheduleBlock; cell chips via ScheduleDispatchTimeOffChip + userTimeOffByCell.ts (red Not coming in / amber Off) drive cellHasTimeOff which disables useDroppable, hides Add block / + triangle, greys cells during placement, and ignores click-to-add (existing blocks stay editable); click red chip → ScheduleDispatchUndoNotComingInModal → removeNotComingInForUserAsStaff (RPC pay_staff_remove_not_coming_in_for_user_day, migration 20260515233801)
│   │   ├── ResetPassword.tsx   # Password reset request page
│   │   ├── ResetPasswordConfirm.tsx # Password reset confirmation page
│   │   ├── Settings.tsx        # User management (dev) and password change (all users)
│   │   ├── SignIn.tsx          # Sign in page (with "Forgot password?" link)
│   │   ├── SignUp.tsx          # Sign up page
│   │   ├── Templates.tsx       # Templates (dev)
│   │   └── Workflow.tsx        # Workflow management
│   ├── types/
│   │   └── database.ts         # TypeScript types for database
│   ├── App.tsx                 # Route definitions
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── index.html                  # HTML template
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config
└── supabase/
    ├── functions/
    │   ├── archive-user/       # Archive user Edge Function
    │   ├── restore-user/      # Restore archived user Edge Function
    │   ├── set-user-password/  # Set user password (dev only) Edge Function
    │   ├── login-as-user/      # Impersonation Edge Function
    │   ├── send-workflow-notification/ # Workflow email notifications
    │   └── test-email/         # Email template testing
    └── migrations/
        ├── rename_owner_to_dev.sql # Role migration
        ├── fix_email_templates_rls.sql # RLS policy fix
        └── allow_devs_read_all_people.sql # People table RLS update
```

### Key Files Explained

#### `src/lib/supabase.ts`
- Initializes Supabase client
- Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment
- Throws error if missing (prevents silent failures)
- Uses `db: { schema: 'public' }` to avoid RPC schema mismatches (e.g. 404 when PostgREST schema differs)

#### `src/lib/approveClockSessions.ts`
- RPC helper for `approve_clock_sessions` with explicit `schema('public')` and fetch fallback when RPC returns 404
- Used by People Hours and Quickfill Hours Approve buttons

#### `src/hooks/useAuth.ts`
- Provides `{ user, loading }` from Supabase Auth
- Subscribes to auth state changes
- Used throughout app for authentication checks

#### `src/contexts/ToastContext.tsx`
- Shared toast notification system; `ToastProvider` wraps the app; `useToastContext()` provides `showToast(message, type)` where type is `'info'|'warning'|'error'|'success'`
- **Stable context value**: `showToast` is wrapped in `useCallback`; the provider passes `useMemo(() => ({ showToast }), [showToast])` so consumers are not retriggered on every toast-driven re-render (avoids effect loops in components such as [`ClockInOutButton`](../src/components/ClockInOutButton.tsx) that must omit `showToast` from some `useEffect` deps and call via a ref)
- Used by Settings (e.g. "Report settings saved." green confirmation), App (session-expiring warning), and any component needing user feedback
- Toasts auto-dismiss after 5 seconds; rendered in top-right corner

#### `src/lib/hardReload.ts`
- **`hardReloadFromRoot()`**: Clears Cache API caches (when available), stores current `pathname` / `search` / `hash` under **`pipetooling-hard-reload-restore`**, then sets **`location`** to **`origin/?nocache=…`**. Used by **Hard Reload** ([`Layout.tsx`](../src/components/Layout.tsx)) and broadcast **force reload** ([`ForceReloadContext.tsx`](../src/contexts/ForceReloadContext.tsx)). The key must stay in sync with the inline script in [`index.html`](../index.html).

#### `src/components/Layout.tsx`
- Main navigation bar
- **Header action cluster** (right, before calendar/settings icons): **Task Dispatch**, **Estimator Inbox**, **Task** (square icon buttons), and **Bid** (text button for **estimators**) share **`HEADER_ACTION_BUTTON_HEIGHT`** (`calc(1rem + 1.25em)`) and **`headerActionButtonBase`** styles (`height`, `boxSizing: border-box`, flex centering) so icon and label buttons align to one row height.
- **iOS safe area**: Nav uses `padding-top: max(var(--app-nav-pad-y), env(safe-area-inset-top))` so menu/settings stay below status bar on iOS
- **Customers on mobile (dev only)**: Devs on mobile see Customers link in hamburger dropdown instead of header icon
- Role-based link visibility
- Impersonation: desktop **Back** (full meaning in **`title`** / **`aria-label`**); Settings banner **Back to my Account**
- **Gear menu** (top-right): Settings link (all users); Global Reload (dev-only, broadcasts reload to all connected clients via Supabase Realtime `force-reload` channel)
- Sign out functionality

#### `src/types/database.ts`
- TypeScript types generated from database schema
- Used for type-safe database queries
- **Note**: Must be manually updated when schema changes

#### `src/pages/Bids.tsx`
- **Route**: `/bids`
- **Access**: Devs, master_technicians, assistants
- **Tabs**: Bid Board (Evaluate button and checklist modal; search, table with lost bids always hidden, columns: Project Folder, Job Plans, GC/Builder, Project Name, Address, Account Man, Bid, Bid Date, Distance to Office, Last Contact, Counts (hexagon icon opens bid in Counts tab), Edit; create/edit modal with **Project Name \*** and **Project Address** at top, then Project Folder, Job Plans, GC/Builder, Project Contact Name/Phone/Email, Estimator, etc.; Estimated Job Start Date when outcome is Won; delete bid opens separate confirmation modal; project contact fields not shown on Bid Board), Counts (fixture/count/page per bid), Takeoffs (assembly mappings, create PO, view PO; delete entries only in edit modal), **Cover Letter** (select bid; Customer + Project Name/Address at top; Inclusions/Exclusions/Terms with defaults; combined document; Edit bid button), Submission & Followup (four collapsible tables; selected-bid panel shows Builder Name, Builder Address, Builder Phone Number, Builder Email (from customer or legacy GC/Builder), Project Name, Project Address, Project Contact Name, Project Contact Phone, Project Contact Email, Bid Size; Sent Bid Script and Bid Question Script buttons and modals; then submission entries table; each table has Edit column with gear when row is selected; Won table shows Estimated Job Start Date; edit icon next to Close; submission entry Edit/Delete icons)
- **Bid Board – Notes column**: Expanding a row opens an inline notes area with tabs **All notes** | **Bid notes** | **Customer notes** (default **All notes** when the row opens). **All notes** merges bid submission entries and `customer_contacts` for the bid’s linked customer in one reverse-chronological list (`src/components/bidBoard/UnifiedBidCustomerNotes.tsx`); **Bid notes** / **Customer notes** use `BidNotesTable` and `CustomerNotesTable`. Adding or editing bid notes in All notes still updates `bids.last_contact` when a timestamp is saved.
- **Database**: `bids`, `bids_gc_builders`, `bids_count_rows`, `bids_submission_entries`, `customer_contacts` (includes optional `contact_method` for general customer outreach); GC/Builder picker uses `customers` table
- **Formatting utilities**: `formatShortDate` (e.g. "Sun 2/1"), `formatDateYYMMDD` (e.g. 26/02/12), `formatCompactCurrency` (e.g. $121k), `formatTimeSinceLastContact`, `formatTimeSinceDueDate` (e.g. "X days since deadline", "Due today", "X days until due")

#### `src/pages/Workflow.tsx`
- **Most complex page** (~1,500+ lines)
- **Route**: `/workflows/:projectId` (accessed via React Router `useParams`)
- **Key Responsibilities**:
  - Manages complete workflow lifecycle for a project
  - Handles step CRUD operations (create, read, update, delete)
  - Manages step status transitions (pending → in_progress → completed/approved/rejected)
  - Person assignment and contact information display
  - Financial tracking (line items, projections, ledger) for owners/masters
  - Private notes management (owners/masters only)
  - Notification subscription management
  - Action history/audit trail recording and display
  - Role-based access control and UI visibility
  - Template-based workflow creation
- **State Management**: Uses multiple `useState` hooks for:
  - Project, workflow, and steps data
  - Modals (step form, reject, set start, assign person, line items, projections)
  - User role and permissions
  - Subscriptions, actions, contacts, line items, projections
- **Data Loading**: 
  - Loads project, workflow, steps, subscriptions, actions, line items, projections
  - Filters steps by assignment for assistants/subcontractors
  - Auto-creates workflow if none exists
- **Database Operations**: 
  - CRUD for `project_workflow_steps`, `workflow_step_line_items`, `workflow_projections`
  - Updates `project_workflow_step_actions` for audit trail
  - Manages `step_subscriptions` for notification preferences
  - Triggers email notifications via `send-workflow-notification` Edge Function
- **Helper Functions**:
  - `formatAmount()`: Currency formatting with commas
  - `formatDatetime()`: Date/time display formatting with day of week (e.g., "Tue, 1/21/26, 6:52 PM")
  - `toDatetimeLocal()` / `fromDatetimeLocal()`: Date/time picker conversion
  - `calculateLedgerTotal()`: Sum of all line items
  - `calculateProjectionsTotal()`: Sum of all projections
  - `recordAction()`: Creates audit trail entries
  - `getCurrentUserName()`: Gets current user's name for actions
  - `sendNotification()`: Helper to send individual notifications via Edge Function
  - `sendWorkflowNotifications()`: Main notification orchestrator - checks preferences, finds recipients, sends appropriate notifications
- **Character Encoding**: Uses Unicode escapes for special characters (↓, →, etc.) to avoid display issues

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start dev server (requires .env file)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables
Create `.env` file (not committed):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Migrations
- Migrations are managed via Supabase MCP (Model Context Protocol)
- Use `mcp_supabase_apply_migration` to create migrations
- Migration naming: `snake_case_description`
- Always test migrations on a branch first

#### Important Migrations

##### `rename_owner_to_dev`
- **Purpose**: Updates the database to change the 'owner' role to 'dev' throughout the system
- **Location**: `supabase/archive/rename_owner_to_dev.sql`
- **What it does**:
  1. Adds 'dev' to the `user_role` enum type
  2. Updates all existing user records from 'owner' to 'dev'
  3. Creates `is_dev()` function (replaces `is_owner()`)
  4. **Automatically updates all RLS policies** that reference `is_owner()` to use `is_dev()` instead
  5. Drops the old `is_owner()` function (after all dependencies are updated)
  6. Renames `claim_owner_with_code()` to `claim_dev_with_code()`
- **Key Feature**: The migration uses a `DO` block to query `pg_policy` system catalog and automatically find and update all policies that depend on `is_owner()`. This handles 30+ policies across multiple tables without manual updates.
- **See**: `supabase/archive/rename_owner_to_dev_README.md` for detailed instructions and troubleshooting

##### `fix_email_templates_rls`
- **Purpose**: Fixes RLS policies on `email_templates` table to use `is_dev()` function
- **Location**: `supabase/archive/fix_email_templates_rls.sql`
- **What it does**: Updates policies to use `is_dev()` instead of direct queries to avoid recursion issues

##### `allow_devs_read_all_people`
- **Purpose**: Allows devs to read all people entries (not just their own)
- **Location**: `supabase/archive/allow_devs_read_all_people.sql`
- **What it does**: Adds a policy allowing devs to see all people entries via `is_dev()` function

##### `allow_devs_update_delete_people`
- **Purpose**: Allows devs to edit and delete people entries created by other users
- **Location**: `supabase/migrations/20260211210000_allow_devs_update_delete_people.sql`
- **What it does**: Adds UPDATE and DELETE policies for `people` using `is_dev()`, enabling devs to manage names, email, phone, notes and delete entries in Settings → People Created by Other Users

##### `create_counts_fixture_groups`
- **Purpose**: Configurable quick-select groups for adding count rows in Bids
- **Location**: `supabase/migrations/20260211200000_create_counts_fixture_groups.sql`
- **What it does**:
  1. Creates `counts_fixture_groups` (id, service_type_id, label, sequence_order)
  2. Creates `counts_fixture_group_items` (id, group_id, name, sequence_order)
  3. RLS: All authenticated users can read; only devs can insert/update/delete
  4. Seeds Plumbing fixture groups (Bathrooms, Kitchen, Laundry, Plumbing Fixtures, Appliances)
  5. Managed in Settings → Counts Quick-adds; used by NewCountRow in Bids per service type

##### `add_finalized_notes_tracking`
- **Purpose**: Adds ability to add notes to finalized purchase orders (add-only)
- **Location**: `supabase/archive/add_finalized_notes_tracking.sql`
- **What it does**:
  1. Adds `notes_added_by` (UUID) and `notes_added_at` (TIMESTAMPTZ) columns to `purchase_orders`
  2. Creates RLS policy allowing updating notes fields on finalized POs, but only when `notes` is null (enforcing add-only behavior)
  3. Index on `notes_added_by` for faster lookups

##### `add_link_to_line_items`
- **Purpose**: Adds optional link field to workflow step line items
- **Location**: `supabase/archive/add_link_to_line_items.sql`
- **What it does**:
  1. Adds `link` (TEXT, nullable) column to `workflow_step_line_items` table
  2. Allows linking to external resources like Google Sheets or supply house listings
  3. Used for linking purchase orders, supply house part listings, or other external documents

##### `add_purchase_order_to_line_items`
- **Purpose**: Links purchase orders to workflow step line items
- **Location**: `supabase/archive/add_purchase_order_to_line_items.sql`
- **What it does**:
  1. Adds `purchase_order_id` (UUID, nullable, FK → `purchase_orders.id` ON DELETE SET NULL) to `workflow_step_line_items`
  2. Enables linking finalized purchase orders as line items in workflow steps
  3. ON DELETE SET NULL ensures line items remain if PO is deleted

##### `add_price_confirmation_to_po_items`
- **Purpose**: Adds price confirmation tracking to purchase order items
- **Location**: `supabase/archive/add_price_confirmation_to_po_items.sql`
- **What it does**:
  1. Adds `price_confirmed_at` (TIMESTAMPTZ, nullable) and `price_confirmed_by` (UUID, nullable, FK → `users.id`) to `purchase_order_items`
  2. Allows assistants to confirm prices before finalizing purchase orders
  3. Creates index on `price_confirmed_at` for performance
  4. RLS policy allows assistants to update these fields only

##### `create_material_part_price_history`
- **Purpose**: Creates table for tracking historical price changes
- **Location**: `supabase/archive/create_material_part_price_history.sql`
- **What it does**:
  1. Creates `material_part_price_history` table with columns: id, part_id, supply_house_id, old_price, new_price, price_change_percent, effective_date, changed_at, changed_by, notes
  2. Adds indexes on part_id, supply_house_id, and changed_at for performance
  3. Provides complete audit trail of all price changes

##### `create_price_history_trigger`
- **Purpose**: Creates trigger to automatically log price changes
- **Location**: `supabase/archive/create_price_history_trigger.sql`
- **What it does**:
  1. Creates `track_price_history()` function that fires AFTER INSERT OR UPDATE on `material_part_prices`
  2. Calculates percentage change: `((NEW.price - OLD.price) / OLD.price) * 100`
  3. Handles INSERT (old_price is NULL) and UPDATE (old_price from OLD record) correctly
  4. Records changed_at (current timestamp) and changed_by (current user)
  5. Creates trigger `material_part_prices_history_trigger` to execute function

##### `optimize_rls_for_master_sharing` (Updated)
- **Purpose**: Optimizes RLS policies and fixes assistant step update permissions
- **Location**: `supabase/archive/optimize_rls_for_master_sharing.sql`
- **What it does**:
  1. Creates helper functions (`can_access_project_via_workflow`, `can_access_project_via_step`) with `SECURITY DEFINER` to optimize performance
  2. **Fixed UPDATE policy for `project_workflow_steps`**: Updated `WITH CHECK` clause to allow assistants to update steps in workflows they can access (not just steps assigned to them), fixing 400 errors when changing assignments

### Type Generation
- `src/types/database.ts` is manually maintained
- When schema changes, update types to match
- Consider using Supabase CLI for type generation in future

### Code Style
- TypeScript strict mode enabled
- React functional components with hooks
- Inline styles (no CSS framework)
- Error handling: Display errors to user, log to console

---

## Deployment

### GitHub Pages Deployment

#### Prerequisites
1. Repository secrets must be set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

#### Deployment Process
1. Push to `main` branch triggers workflow
2. GitHub Actions:
   - Checks out code
   - Installs Node.js 20
   - Installs dependencies (`npm ci`)
   - **Validates environment variables** (fails early if missing)
   - Builds with environment variables
   - Uploads `dist/` as artifact
   - Deploys to GitHub Pages

#### Workflow File
`.github/workflows/deploy.yml`

#### Important Files for Deployment
- `public/.nojekyll` - Prevents Jekyll from processing `dist/`
- `CNAME` - Custom domain (if used)
- `index.html` - Inline script (before the app bundle) restores the route after **Hard Reload** / **force reload**: those flows save the current URL to `sessionStorage` and load **`/?nocache=…`** so GitHub Pages serves the shell with a **200**; see [`src/lib/hardReload.ts`](../src/lib/hardReload.ts) and `TROUBLESHOOT_404.md`

### Sync to Testing Site

A double-clickable macOS script **`Sync to Testing.command`** (in the pipetooling project root) refreshes the testing site:

1. Deletes all contents of `testing-pipetooling.github.io`
2. Copies everything from `pipetooling.github.io` into it (including hidden files like `.git`)

**Usage**: Double-click in Finder. Terminal opens, runs the sync, and waits for Enter before closing.

**Location**: Project root, alongside `pipetooling.github.io` and `testing-pipetooling.github.io`.

### Edge Functions Deployment
Edge Functions are deployed via Supabase CLI or Dashboard:
- `invite-user` - Sends invitation emails (✅ Implemented)
- `create-user` - Manually creates users (✅ Implemented). **Role** in request body must be one of: `dev`, `master_technician`, `assistant`, `subcontractor`, `estimator`.
- `archive-user` - Archives users (soft delete; ✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `restore-user` - Restores archived users (✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `set-user-password` - Set another user's password (dev only; ✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `login-as-user` - Generates magic link for impersonation (✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `test-email` - Sends test emails using Resend service (✅ Implemented - requires `RESEND_API_KEY`)
- `send-workflow-notification` - Sends workflow stage notifications via email (✅ Implemented - requires `RESEND_API_KEY`)

**All Edge Functions**:
- Use `verify_jwt: false` (gateway validation disabled)
- Implement internal JWT validation
- Handle CORS explicitly
- Return structured error responses
- **Note**: Functions requiring service role key (`archive-user`, `restore-user`, `set-user-password`, `login-as-user`) must have `SUPABASE_SERVICE_ROLE_KEY` secret set

**Deployment**:
- Deploy via CLI: `supabase functions deploy <function-name> --no-verify-jwt`
- Or via Supabase Dashboard → Edge Functions
- See `supabase/functions/<function-name>/DEPLOY.md` for detailed instructions

**Secrets Required**:
- `RESEND_API_KEY` - Required for `test-email` and `send-workflow-notification` functions
  - Set via: `supabase secrets set RESEND_API_KEY=your_key`
- `SUPABASE_SERVICE_ROLE_KEY` - Required for `archive-user`, `restore-user`, `set-user-password`, and `login-as-user` functions
  - Set via: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key`
  - **⚠️ WARNING**: Service role key has full admin access. Never expose in client-side code!
  - Get from: Supabase Dashboard → Settings → API → Service Role Key

---

## Common Patterns

### 1. Data Fetching Pattern
```typescript
const [data, setData] = useState<Type[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  if (!authUser?.id) {
    setLoading(false)
    return
  }
  ;(async () => {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('master_user_id', authUser.id)
    if (error) setError(error.message)
    else setData(data ?? [])
    setLoading(false)
  })()
}, [authUser?.id])
```

### 2. Edge Function Call Pattern
```typescript
const { data, error: eFn } = await supabase.functions.invoke('function-name', {
  body: { /* payload */ },
})

if (eFn) {
  let msg = eFn.message
  // Parse error from response body if available
  if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
    try {
      const b = (await eFn.context.json()) as { error?: string } | null
      if (b?.error) msg = b.error
    } catch { /* ignore */ }
  }
  setError(msg)
  return
}

// Check for error in response data
const err = (data as { error?: string } | null)?.error
if (err) {
  setError(err)
  return
}

// Success
```

### 3. Role Checking Pattern
```typescript
const [role, setRole] = useState<UserRole | null>(null)

useEffect(() => {
  if (!authUser?.id) {
    setRole(null)
    return
  }
  supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single()
    .then(({ data }) => {
      setRole((data as { role: UserRole } | null)?.role ?? null)
    })
}, [authUser?.id])
```

### 4. Protected Route Pattern
```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading…</div>
  if (!user) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}
```

### 5. Form Submission Pattern
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError(null)
  setSubmitting(true)
  
  const { data, error } = await supabase
    .from('table')
    .insert({ /* data */ })
  
  setSubmitting(false)
  if (error) {
    setError(error.message)
    return
  }
  
  // Success: close modal, reload data, etc.
  closeModal()
  await loadData()
}
```

### 6. Mutex Pattern for Concurrent Async Operations
**Use Case**: Prevent multiple concurrent calls to the same async function (e.g., creating duplicate resources)

```typescript
// Declare ref to track pending promises
const operationPromises = useRef<Map<string, Promise<string | null>>>(new Map())

async function ensureResource(id: string) {
  // Check if there's already a pending call for this id
  const existingPromise = operationPromises.current.get(id)
  if (existingPromise) {
    return await existingPromise
  }
  
  // Create placeholder promise and store immediately (atomic operation)
  let resolvePromise: (value: string | null) => void
  let rejectPromise: (reason?: any) => void
  const placeholderPromise = new Promise<string | null>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  
  // Store placeholder BEFORE async operation
  operationPromises.current.set(id, placeholderPromise)
  
  try {
    // Perform async operation
    const result = await performAsyncOperation(id)
    resolvePromise(result)
    return result
  } catch (error) {
    rejectPromise(error)
    throw error
  } finally {
    // Always remove from map when done
    operationPromises.current.delete(id)
  }
}
```

**Key Points**:
- Store placeholder promise immediately before async operation (ensures atomicity)
- Subsequent concurrent calls will find the placeholder and await it
- Always clean up in `finally` block
- Use `Map` keyed by unique identifier (e.g., project_id) to track per-resource

### 7. Ref Tracking Pattern for Preventing Redundant Loads
**Use Case**: Prevent redundant data loading when useEffect dependencies change but data hasn't actually changed

```typescript
// Track what has been loaded
const lastLoadedId = useRef<string | null>(null)

async function loadData(id: string) {
  // Load data...
  const data = await fetchData(id)
  setData(data)
  
  // Track that we've loaded for this id
  lastLoadedId.current = id
}

useEffect(() => {
  if (!resourceId) return
  
  // Reset tracking when resource changes
  lastLoadedId.current = null
  
  (async () => {
    // Skip load if we've already loaded for this id
    if (lastLoadedId.current !== resourceId) {
      await loadData(resourceId)
    }
  })()
  
  // Cleanup function for React Strict Mode
  return () => {
    // Optional: cancel any pending operations
  }
}, [resourceId, otherDeps])
```

**Key Points**:
- Use `useRef` to track last loaded identifier (persists across renders, doesn't trigger re-renders)
- Reset tracking when key dependency changes (e.g., `projectId`)
- Check before loading to skip redundant loads
- Force reload by resetting ref (e.g., in `refreshData` function)

### 8. Workflow ID Lookup Pattern
**Use Case**: Ensure valid workflow_id for operations when React state might be stale

```typescript
async function saveStep(stepData: StepData) {
  // Ensure we have a workflow_id - fetch from DB if state isn't ready
  // Explicitly type as string | null to match ensureWorkflow return type
  let workflowId: string | null = workflow?.id ?? null
  if (!workflowId && projectId) {
    workflowId = await ensureWorkflow(projectId)
    // Optionally sync state if needed
    if (workflowId && workflow?.id !== workflowId) {
      const { data: wf } = await supabase
        .from('project_workflows')
        .select('*')
        .eq('id', workflowId)
        .single()
      if (wf) setWorkflow(wf as Workflow)
    }
  }
  
  if (!workflowId) {
    setError('Workflow not found. Please refresh the page.')
    return
  }
  
  // Now use workflowId for the operation
  await supabase.from('project_workflow_steps').insert({
    workflow_id: workflowId,
    ...stepData
  })
}
```

**Key Points**:
- Always check `workflow?.id` from state first
- Explicitly type variable as `string | null` to match function return type
- Use `?? null` to convert `undefined` (from optional chaining) to `null`
- Fall back to `ensureWorkflow(projectId)` if state is null
- Optionally sync state after `ensureWorkflow` to prevent future mismatches
- Use this pattern in all save/delete operations that depend on workflow_id

### 9. TypeScript null vs undefined Pattern
**Use Case**: Handle type mismatches when functions return `string | null` but variables are inferred as `string | undefined`

```typescript
// Problem: ensureWorkflow returns Promise<string | null>
// But workflow?.id is string | undefined (optional chaining)
async function myFunction() {
  // ❌ Type error: Type 'string | null' is not assignable to type 'string | undefined'
  let workflowId = workflow?.id
  if (!workflowId) {
    workflowId = await ensureWorkflow(projectId) // Returns string | null
  }
  
  // ✅ Solution: Explicitly type and convert undefined to null
  let workflowId: string | null = workflow?.id ?? null
  if (!workflowId) {
    workflowId = await ensureWorkflow(projectId) // Now types match
  }
}
```

**Key Points**:
- When a function returns `string | null`, explicitly type variables that receive its value
- Use `?? null` to convert `undefined` (from optional chaining) to `null`
- This ensures type consistency throughout the code
- Both `null` and `undefined` are falsy, so `if (!value)` checks work with both


---

## Known Issues & Gotchas

### 1. RLS Policy Recursion
- **Issue**: Policies that query `public.users` can cause infinite recursion or performance issues
- **Solution**: Use `public.is_dev()` function instead of direct queries
- **Examples**: 
  - `is_dev()` is used in `email_templates` table policies
  - `is_dev()` is used in `people` table policies (for devs to read all entries)
  - All new policies should use `is_dev()` function pattern

### 4. Updating Functions Used by RLS Policies
- **Issue**: Cannot drop a function (e.g., `is_owner()`) if RLS policies depend on it
- **Solution**: When renaming functions used by policies:
  1. Create the new function first (e.g., `is_dev()`)
  2. Update all dependent policies to use the new function
  3. Then drop the old function
- **Example**: The `rename_owner_to_dev` migration demonstrates this pattern by:
  - Querying `pg_policy` to find all policies using `is_owner()`
  - Using `pg_get_expr()` to extract policy expressions
  - Replacing `is_owner()` with `is_dev()` in expressions
  - Dropping and recreating each policy with updated expressions
  - Finally dropping `is_owner()` after all dependencies are updated

### 5. RLS Policy Recursion Prevention
- **Issue**: RLS policies that query `public.users` directly can cause recursion or performance issues
- **Solution**: Use helper functions with `SECURITY DEFINER` instead of direct queries
- **Examples**:
  - `email_templates` table: Uses `is_dev()` function in all policies
  - `people` table: Devs can read all entries via `is_dev()` policy
  - `users` table: Uses `master_adopted_current_user()` function to check adoptions without recursion
- **Helper Functions**:
  - `public.is_dev()` - Checks if current user is dev (SECURITY DEFINER)
  - `public.master_adopted_current_user(master_user_id UUID)` - Checks if master adopted current user (SECURITY DEFINER)
- **Best Practice**: All policies should use helper functions instead of direct `EXISTS (SELECT 1 FROM public.users ...)` queries

### 6. Character Encoding in Workflow
- **Issue**: Special characters (↓, ·, …, ←, –) display as "?"
- **Solution**: Use Unicode escapes: `{"\u2193"}` or ASCII alternatives

### 2. Foreign Key Deletion Order
- **Issue**: Deleting parent records fails if children exist
- **Solution**: Always delete in dependency order:
  1. `step_subscriptions`
  2. `project_workflow_steps`
  3. `project_workflows`
  4. `projects`
  5. `customers`

### 3. Edge Function CORS
- **Issue**: Edge Functions can fail with CORS errors
- **Solution**: All Edge Functions explicitly set CORS headers:
  ```typescript
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  ```

### 4. Edge Function JWT Validation
- **Issue**: Gateway JWT validation can fail on GitHub Pages
- **Solution**: Use `verify_jwt: false` and validate internally:
  ```typescript
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  // Extract token and validate
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  ```

### 5. Environment Variables in Build
- **Issue**: Missing env vars cause runtime errors
- **Solution**: GitHub Actions workflow validates secrets before build
- **Note**: Values must be set in repository secrets

### 6. Character Encoding in Workflow
- **Issue**: Special characters (↓, ·, …, ←, –) display as "?"
- **Solution**: Use Unicode escapes: `{"\u2193"}` or ASCII alternatives

### 7. People Deduplication
- **Issue**: Same person appears twice if they exist in both `people` and `users`
- **Solution**: Filter `people` entries where `email` matches a `user.email`

### 8. Impersonation Session Storage
- **Issue**: Original session lost during impersonation (e.g. when reload occurs after Global Reload or new version)
- **Solution**: Store original session in `localStorage` before impersonating (persists across reloads)
- **Key**: `'impersonation_original'`

### 9. TypeScript Type Updates
- **Issue**: Database types can become out of sync
- **Solution**: Manually update `src/types/database.ts` when schema changes

### 10. RLS Policy for Assistant Step Updates
- **Issue**: Assistants getting 400 errors when updating workflow steps (especially when changing `assigned_to_name`)
- **Root Cause**: `WITH CHECK` clause in `project_workflow_steps` UPDATE policy was too restrictive - only allowed assistants to update steps where `assigned_to_name` matched their name, preventing assignment changes
- **Solution**: Updated `optimize_rls_for_master_sharing.sql` migration to include `can_access_project_via_workflow(workflow_id)` check in `WITH CHECK` clause, allowing assistants to update any step in workflows they can access (via adoption/sharing)
- **Migration**: `supabase/archive/optimize_rls_for_master_sharing.sql` (updated UPDATE policy)
- **Future**: Consider Supabase CLI type generation

### 11. Materials Price Book - Missing Prices in Expanded Row (FIXED 2026-02-04)
- **Issue**: Prices added via "Edit prices" modal were not appearing in the expanded row details after closing the modal, even though they were visible in the modal itself and stored correctly in the database
- **Root Cause**: The `loadParts()` function was loading all prices across all parts in a single query with Supabase's default 1,000-row limit. With 1,241+ total prices in the database, prices beyond the cheapest 1,000 were being cut off. The "Edit prices" modal worked correctly because it filtered prices by `part_id` first, loading only that part's prices.
- **Symptoms**:
  - Prices visible in "Edit prices" modal
  - After closing modal, prices briefly appear (from `onPricesUpdated` callback)
  - Then disappear when `loadParts()` overwrites state with incomplete data
  - More expensive prices missing from expanded rows
- **Solution**: Changed `loadParts()` to load prices per-part using `Promise.all()` instead of loading all prices at once:
  ```typescript
  // Before (problematic):
  const { data } = await supabase
    .from('material_part_prices')
    .select('*, supply_houses(*)')
    .order('price', { ascending: true })
    .limit(10000)  // Still hits limits with large datasets
  
  // After (fixed):
  const partsWithPrices = await Promise.all(
    partsList.map(async (part) => {
      const { data } = await supabase
        .from('material_part_prices')
        .select('*, supply_houses(*)')
        .eq('part_id', part.id)  // Filter per-part like the modal does
        .order('price', { ascending: true })
      // ...
    })
  )
  ```
- **Benefits**:
  - No row limit issues (each part's prices loaded separately)
  - Consistent behavior between expanded row and modal
  - Better performance with parallel loading
  - Scales to any number of total prices
- **Files Modified**: `src/pages/Materials.tsx` (lines 194-217)

### 12. GitHub Pages MIME Types
- **Issue**: Module scripts fail with wrong MIME type
- **Solution**: `public/.nojekyll` prevents Jekyll from interfering
- **Note**: GitHub Pages must be configured to use "GitHub Actions" as source, not a branch

### 11. Refresh Token Errors
- **Issue**: Console errors for invalid refresh tokens on login screen
- **Solution**: Errors are handled gracefully in `useAuth` hook - invalid tokens are cleared automatically
- **Note**: These errors are harmless and indicate user needs to sign in again

### 12. Magic Link Authentication Handling
- **Issue**: Magic links from "imitate" feature redirect with tokens in URL hash but weren't being processed
- **Solution**: Added `AuthHandler` component in `App.tsx` that detects `type=magiclink` tokens in URL hash, sets session, and redirects to dashboard
- **Implementation**: Extracts `access_token` and `refresh_token` from hash, calls `supabase.auth.setSession()`, clears hash, and navigates
- **Files Modified**: `src/App.tsx` - Added AuthHandler component, `src/pages/Settings.tsx` - Fixed redirect URL construction

### 13. TypeScript Strict Mode
- **Issue**: TypeScript errors for potentially undefined values
- **Solution**: Always check for undefined before accessing array elements, use non-null assertions (`!`) when type narrowing guarantees existence
- **Common Patterns**:
  - Check array indices: `if (parts[index] && parts[index])`
  - Use destructuring with validation: `if (dateMatch && dateMatch[1] && dateMatch[2])`
  - Wrap function calls in arrow functions for event handlers: `onClick={() => openAddStep()}`

### 14. Current Stage Position Display
- **Issue**: Projects page showed invalid positions like "[16 / 13]" when using raw `sequence_order` values
- **Solution**: Calculate position by finding step's index in sorted list, then add 1 (1-indexed)
- **Implementation**: `Projects.tsx` sorts steps by `sequence_order` and finds index position instead of using raw value
- **Result**: Always shows correct position relative to total steps, regardless of sequence_order gaps or non-sequential values

### 15. Users Table RLS Recursion
- **Issue**: Policies on `users` table that query `users` or `master_assistants` (which queries `users`) cause infinite recursion errors
- **Solution**: Use `SECURITY DEFINER` functions to bypass RLS when checking relationships
- **Example**: `master_adopted_current_user()` function uses `SECURITY DEFINER` to check `master_assistants` without triggering RLS
- **Migration**: `supabase/archive/fix_users_rls_for_project_masters.sql`
- **Result**: Assistants can now see master information (name/email) when viewing projects without recursion errors
- **Master Sharing**: Similar pattern used for `master_shares` table - RLS policies check for sharing relationships without recursion

### 16. Line Items RLS Timeout
- **Issue**: Loading line items causes statement timeout errors (500 Internal Server Error)
- **Solution**: Created `can_access_project_via_step()` helper function to optimize RLS policies
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS, performs single optimized query
- **Migration**: `supabase/archive/optimize_workflow_step_line_items_rls.sql`
- **Result**: Line items load quickly without timeout errors

### 17. Step Actions RLS Errors
- **Issue**: Recording workflow actions causes 403 Forbidden or 500 Internal Server Error
- **Solution**: Created `can_access_step_for_action()` helper function to optimize RLS policies
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS, checks step access efficiently
- **Migration**: `supabase/archive/fix_project_workflow_step_actions_rls.sql`
- **Result**: Actions can be recorded successfully without errors

### 18. Workflow Data Persistence Issues
- **Issue**: Projections and workflow steps (cards) not persisting when navigating away and back to a project
  - Symptoms: Added projections/steps disappear on first navigation back, but appear on subsequent visits
  - Root Cause: Race condition where `workflow?.id` from React state was `null` during immediate save operations
- **Solution**: Modified `saveProjection`, `deleteProjection`, `saveStep`, `refreshSteps`, `createFromTemplate`, and `copyStep` to always obtain a valid `workflowId` by calling `ensureWorkflow(projectId)` if state is null
- **Implementation**: All save/delete operations now check for `workflow?.id` and fall back to `ensureWorkflow(projectId)` if needed
- **Files Modified**: `src/pages/Workflow.tsx`
- **Result**: Projections and steps now persist correctly on first navigation back

### 19. Concurrent Workflow Creation
- **Issue**: Multiple workflows being created for the same project, causing duplicate workflow entries
  - Symptoms: Console logs showing multiple "Created new workflow" messages for the same project
  - Root Cause: Race condition where multiple concurrent calls to `ensureWorkflow` could all pass the initial check before any stored their promise
- **Solution**: Implemented mutex pattern using `useRef` and placeholder promises
- **Implementation**: 
  - Added `ensureWorkflowPromises` ref to track pending calls per project
  - Creates and stores a placeholder promise immediately before executing async logic
  - Subsequent concurrent calls await the placeholder promise, serializing workflow creation
  - Added retry logic for insert errors to handle unique constraint violations gracefully
- **Files Modified**: `src/pages/Workflow.tsx`
- **Result**: Only one workflow is created per project, even with concurrent calls

### 20. Redundant loadSteps Calls
- **Issue**: Excessive `loadSteps` calls (7+ times) for the same workflow_id, causing performance issues
  - Symptoms: Console logs showing multiple redundant `loadSteps` calls on page load
  - Root Cause: `useEffect` with `workflow?.id` in dependency array re-running when workflow state updates
- **Solution**: Added ref tracking to prevent redundant loads
- **Implementation**:
  - Added `lastLoadedWorkflowId` ref to track which workflow_id has been loaded
  - `loadSteps` sets the ref after successful load
  - `useEffect` checks if we've already loaded for the workflow_id before calling `loadSteps`
  - `refreshSteps` resets tracking to force reload when explicitly called
  - Tracking resets when `projectId` changes (new project)
  - Added cleanup function to handle React Strict Mode properly
- **Files Modified**: `src/pages/Workflow.tsx`
- **Result**: Reduced to 1-2 `loadSteps` calls per page load, improving performance

### 21. TypeScript Type Errors: string | null vs string | undefined
- **Issue**: TypeScript build errors: `Type 'string | null' is not assignable to type 'string | undefined'`
  - Symptoms: Build fails with 7 type errors in `Workflow.tsx` when assigning `ensureWorkflow(projectId)` result
  - Root Cause: `ensureWorkflow` returns `Promise<string | null>`, but variables inferred from `workflow?.id` are typed as `string | undefined` (optional chaining returns `undefined`, not `null`)
- **Solution**: Explicitly type variables as `string | null` and use nullish coalescing operator
- **Implementation**:
  - Changed `let workflowId = workflow?.id` to `let workflowId: string | null = workflow?.id ?? null`
  - Applied to 7 locations: `useEffect`, `saveProjection`, `deleteProjection`, `refreshSteps`, `createFromTemplate`, `copyStep`, `saveStep`
  - Using `?? null` converts `undefined` to `null` to match `ensureWorkflow`'s return type
- **Files Modified**: `src/pages/Workflow.tsx`
- **Result**: TypeScript build succeeds, type safety maintained
- **Pattern**: When a function returns `string | null`, explicitly type variables that may receive its value as `string | null` rather than relying on inference


---

## Future Development Notes

### Planned Features (from conversation history)
- ✅ Email notifications for subscribed stages (fully implemented)
- ✅ Assistants can create and edit projects (fully implemented)
- Workflow step dependencies visualization
- Export/import templates
- Project archiving (beyond status changes)

### Technical Debt
1. **Type Generation**: Manual type maintenance is error-prone
   - **Solution**: Use Supabase CLI `supabase gen types typescript`
2. **Error Handling**: Some errors are only logged to console
   - **Solution**: Centralized error handling/toast system
3. **Styling**: Inline styles make maintenance difficult
   - **Solution**: Consider CSS modules or Tailwind
4. **Testing**: No tests currently
   - **Solution**: Add unit tests for hooks, integration tests for pages
5. **Edge Function Error Messages**: Inconsistent error format
   - **Solution**: Standardize error response format

### Database Considerations
- **Indexes**: Review query patterns and add indexes for performance
- **Archiving**: Consider soft deletes or archive tables for historical data
- **Audit Trail**: No audit logging currently (who changed what, when)

### Security Considerations
- **Admin Code**: Now configurable via DEV_PROMOTION_CODE Supabase secret (claim-dev Edge Function)
- **Rate Limiting**: No rate limiting on Edge Functions
- **Input Validation**: Some user inputs not validated (e.g., email format)
- **SQL Injection**: RLS policies use parameterized queries (safe), but be cautious with dynamic SQL

### Performance Optimizations
- **Data Fetching**: Some pages fetch all data upfront (consider pagination)
- **Real-time**: Supabase Realtime used across the app; **v2.454** reduced REST storms from **`postgres_changes`** on busy surfaces — **`useDocumentVisibility`** ([`src/hooks/useDocumentVisibility.ts`](../src/hooks/useDocumentVisibility.ts)); debounced **`financialRefreshKey`** for Dashboard financial pins ([`Dashboard.tsx`](../src/pages/Dashboard.tsx)); **`clock_sessions`** filters **`user_id=in.(…)`** + debounce on team strip ([`useDashboardMyTeamSectionState.ts`](../src/hooks/useDashboardMyTeamSectionState.ts)), debounced + optional filter on People Hours ([`People.tsx`](../src/pages/People.tsx)), visibility-gated Mercury refetch ([`Banking.tsx`](../src/pages/Banking.tsx)). See **`RECENT_FEATURES.md`** **v2.454**. Earlier summary: `people_hours`, `clock_sessions`, `user_pinned_tabs`, `force-reload`.
- **Caching**: No client-side caching (consider React Query)

---

## Quick Reference

### User Roles
- **dev**: Full access, user management, templates
- **master_technician**: Create/manage projects, customers, workflows
- **assistant**: Create/edit projects, view/update workflows (assigned stages only), full access to Bids
- **subcontractor**: Dashboard and Calendar only

### Key Routes
- `/map` - Staff map of job/bid/estimate addresses (**dev**, **master**, **assistant**, **estimator**; desktop **pin** / mobile **gear** per [`Layout.tsx`](../src/components/Layout.tsx); **Geoman** area filter + table **Filter**; **Debug** → **Review geocodes**; **`address_geocodes`**; chunked **`geocode-address-batch`** for cold addresses; see **Key Features** §16)
- `/dashboard` - User dashboard
- `/customers` - Customer list
- `/projects` - Project list
- `/workflows/:projectId` - Workflow management
- `/people` - People roster (Users, Pay, Hours, and other tabs; dev **Feedback** via `?tab=feedback`)
- `/jobs` - Jobs (Reports, Stages, Billing, Team Labor, Sub Labor, Crew P&L, Parts, Job Summary, Inspections tabs)
- `/calendar` - Calendar view
- `/materials` - Materials management (devs and masters only: price book, templates, purchase orders)
- `/bids` - Bids management (bid board, counts, takeoffs, cover letter, submission & followup; devs, masters, assistants)
- `/templates` - Template management (dev)
- `/settings` - User management (dev) and password change (all users)

### Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `RESEND_API_KEY` - Resend API key (set as Supabase secret for Edge Functions)

### Edge Functions
- `invite-user` - Send invitation email
- `create-user` - Manually create user; **role** must be one of: `dev`, `master_technician`, `assistant`, `subcontractor`, `estimator`
- `archive-user` - Archive user
- `restore-user` - Restore archived user
- `set-user-password` - Set another user's password (dev only)
- `login-as-user` - Generate impersonation magic link
- `test-email` - Send test emails using Resend service (for email template testing)
- `send-workflow-notification` - Send workflow stage notifications via email (automatically called when steps change status)

### Database Enums
- `user_role`: `'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator' | 'primary' | 'superintendent'`
- `project_status`: `'awaiting_start' | 'active' | 'completed' | 'on_hold'`
- `workflow_status`: `'draft' | 'active' | 'completed'`
- `step_status`: `'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved'`
- `step_type`: `'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null`
- `people.kind` (check constraint, not a separate enum type): includes `assistant`, `master_technician`, `sub`, `estimator`, `dev`, `primary`, `superintendent`

---

## Getting Started for New Developers

1. **Clone repository**
2. **Set up Supabase**:
   - Create Supabase project
   - Run migrations (via MCP or Supabase CLI)
   - Set up Edge Functions
   - Configure RLS policies
3. **Set up local environment**:
   - Create `.env` with Supabase credentials
   - Run `npm install`
   - Run `npm run dev`
4. **Create first user**:
   - Sign up via UI
  - In Supabase dashboard, manually set role to `'dev'` OR
  - Use Settings page to enter promotion code (configured in Supabase secrets)
5. **Explore features**:
   - Create customer
   - Create project
   - Add workflow steps
   - Assign people
   - Test role restrictions

---

## Contact & Support

For questions or issues:
1. Check this documentation
2. Review conversation history in agent transcripts
3. Check Supabase logs via MCP: `mcp_supabase_get_logs`
4. Review RLS policies via Supabase dashboard

---

**Last Updated**: 2026-02-04
**Documentation Version**: 2.20

## Recent Updates (v2.12–v2.20)

### v2.20 – Takeoff book: aliases + multiple templates/stages per entry + default version
- **Takeoff book entry aliases**: Takeoff Book entries can include optional **additional names** (aliases). If a count row’s Fixture or Tie-in matches the primary name or any alias (case-insensitive), the entry applies.
- **Multiple templates/stages per entry**: Takeoff Book entries now support multiple **(Template, Stage)** pairs per fixture/alias entry. Applying the Takeoff Book adds mappings for each Template/Stage pair for matching fixtures.
- **Default version selection**: In Takeoffs, when a bid has no takeoff book version selected, the UI defaults to the version named **“Default”** and persists it to the bid.
- **Database**:
  - `takeoff_book_entries.alias_names` (TEXT[], default `'{}'`); migration `add_takeoff_book_entries_alias_names.sql`.
  - New table `takeoff_book_entry_items` (Template/Stage pairs per entry), with migration/backfill and moving `template_id`/`stage` from entries to items; migration `add_takeoff_book_entry_items.sql`.

### v2.19 – Submission & Followup: clickable GC/Builder, all-bids modal, scroll buttons
- **Clickable GC/Builder (customer)** in Submission & Followup tables (Not yet won or lost, Won, Started or Complete): clicking opens the customer/GC Builder modal.
- **Customer / GC Builder modal** includes an **All bids** section listing every bid for that entity and its computed status (Unsent, Not yet won or lost, Won, Started or Complete, Lost).
- **Navigation buttons**:
  - **Up-arrow** next to the row Edit/settings button scrolls up to the selected-bid summary.
  - **Down-arrow** near the Approval PDF area scrolls down to the selected bid’s row and auto-expands the correct section if collapsed.
- **Copy update**: Template-selection instruction text now notes staged billing: “Materials broken down by stage allows for staged billing.”

### v2.18 – Bid outcome: Started or Complete
- **Bid outcome** can be **Won**, **Lost**, or **Started or Complete**. Win/ Loss dropdown in New/Edit bid includes the new option. **Submission & Followup** tab has a **Started or Complete** section between Won and Lost; bids with this outcome appear there (Project/GC, Bid Due Date, Edit). Unsent and "Not yet won or lost" exclude started_or_complete. Bid Board Win/ Loss column shows "Started or Complete" for that outcome.
- **Database**: `bids.outcome` CHECK extended to allow `'started_or_complete'`; migration `add_bids_outcome_started_or_complete.sql`.

### v2.17 – Labor book: multiple names per entry
- **Labor book entries** can have one primary **Fixture or Tie-in** name and optional **additional names** (aliases). If a count row's Fixture or Tie-in matches the primary name or any alias (case-insensitive), that entry's labor rate is applied. First match wins by entry order. Entry form has "Additional names (optional)" (comma-separated, e.g. WC, Commode); table shows "also: …" when aliases exist.
- **Database**: `labor_book_entries.alias_names` (TEXT[], default `'{}'`); migration `add_labor_book_entries_alias_names.sql`.

### v2.16 – Approval PDF, call scripts, Evaluate checklist
- **Approval PDF (Submission & Followup)**: Pricing table now has a **Per Unit** column (after Entry, before Revenue). Per Unit and Revenue display as **whole numbers** (e.g. $1,234). **Alignment**: Count column centered; Per Unit and Revenue right-aligned. **Pricing page (page 2)** of the Approval PDF is rendered in **landscape**; other pages (Submission & Followup, Cost Estimate, Cover Letter) remain portrait. **Cover Letter**: "Inclusions:" and "Exclusions and Scope:" headings are **bold**.
- **Submission & Followup – Call scripts**: Above the contact table, two buttons open read-only modals: **Sent Bid Script** and **Bid Question Script**. Modals show the respective script text; closing dismisses the modal.
- **Bid Board – Evaluate**: An **Evaluate** button (left of "New") opens a modal with a checklist: LOCATION, PAYMENT TERMS, BID DOCUMENTS, COMPETITION, STRENGTHS. The checklist resets when the modal is closed.

### v2.15 – Cover Letter and Edit Bid modal
- **Cover Letter tab**: Default Inclusions ("Permits"), default Exclusions (four lines), default Terms and Warranty (full paragraph); labels updated ("Terms and Warranty", "Exclusions and Scope (one per line, shown as bullets)"); Project section shows Project Name + Project Address at top; "Edit bid" button in header (next to Close).
- **Edit Bid modal**: Project Name* and Project Address at top (label "Address" → "Project Address"); remaining fields follow (Project Folder, Job Plans, GC/Builder, etc.).

### v2.14 – Cost Estimate: Labor book
- **Labor book**: Create/edit/delete labor book versions and entries (hours per stage: Rough In, Top Out, Trim Set); bid-level "Labor book version" dropdown ("— Use defaults —" or select version); when syncing cost estimate labor rows from count rows, **new** labor rows get hours from selected version (match by fixture name); existing labor rows not overwritten when version changes.
- **Database**: `labor_book_versions`, `labor_book_entries`, `bids.selected_labor_book_version_id`; migrations `create_labor_book_versions_and_entries.sql`, `add_bids_selected_labor_book_version.sql`. Settings bids backup includes labor book (and price book, takeoff book, POs).

### v2.13 – Pricing tab (full implementation)
- **Price book**: Create/edit/delete price book versions and entries (prices per stage: Rough In, Top Out, Trim Set, Total — **New/Edit entry** modal accepts **cent precision**, `step` 0.01); bid margin comparison: select bid and price book version, assign price book entry per count row (dropdown); compare cost (labor + allocated materials) vs revenue; margin % with flags: red (&lt; 20%), yellow (&lt; 40%), green (≥ 40%); cost allocation (labor from cost estimate, materials by labor hours); selected version stored on bid (`selected_price_book_version_id`); "Go to Cost Estimate" prompt when bid has no cost estimate.
- **Database**: `price_book_versions`, `price_book_entries`, `bid_pricing_assignments`, `bids.selected_price_book_version_id`; migrations `create_price_book_versions_and_entries.sql`, `create_bid_pricing_assignments.sql`, `add_bids_selected_price_book_version.sql`.

### v2.12 – Submission cost estimate, currency, Pricing placeholder
- **Submission & Followup**: When a bid is selected, panel shows cost estimate indicator (grand total with comma formatting, or "Not yet created"); View cost estimate / Create cost estimate button switches to Cost Estimate tab with that bid preselected.
- **Currency formatting**: `formatCurrency(n)` in Bids.tsx; numbers over 999 display with commas (e.g. $12,345.67) in Cost Estimate tab and Submission preview.
- **Pricing tab**: New tab between Cost Estimate and Cover Letter; placeholder "Pricing – coming soon." (full implementation in v2.13).
- **Revert migration**: `revert_price_book_and_bids_job_type.sql` drops price book tables and `bids.job_type` if rolling back schema.

## Recent Updates (v2.11)

### Bids – Approval PDF (Submission & Followup)
- Approval PDF pages are clearly titled: Submission and Followup, Pricing, Cost Estimate, Cover Letter
- "Margins" content is included on the PDF (cost estimate + pricing-by-version summary)
- Bid Submission / Project Folder / Job Plans links are separated with line breaks for readability
- Pricing and Cost Estimate sections render as tables for cleaner layout
- Removed redundant "Our Cost" line from the approval packet display
- Added bid fields for **Bid Submission link** (`bid_submission_link`) and **Design Drawings Plan Date** (`design_drawing_plan_date`)
- Masters can see all bids under RLS (`allow_masters_see_all_bids.sql`)

## Recent Updates (v2.10)

### Bids – Bid Board and Submission & Followup
- **Bid Board**: **Search** input (full width) filters by project name, address, customer name, or GC/builder name. Columns: Project Folder, Job Plans, GC/Builder, Project Name, Address, **Win/ Loss** (toggle button to hide/show lost bids; when hiding, label "(hiding lost)" and underlined), **Bid Value**, Estimator, Bid Due Date, Bid Date Sent, Distance to Office (miles), Last Contact, Notes, Edit. Agreed Value and Maximum Profit columns removed. All column headers and cells **centered**. **Plans Link Folder**. **Distance to Office (miles)** (value e.g. 66.6mi). **Last Contact** short date with day of week (e.g. "Sun 2/1"). **Bid Due Date** and **Bid Date Sent** **YY/MM/DD** (e.g. 26/02/12). **Bid Value** **compact currency** (e.g. $121k). **Edit** column **gear icon** (opens full edit modal). **Notes** cell **clickable** → quick-edit modal; Save updates notes and refreshes table. **New/Edit modal**: After GC/Builder picker, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email** (per bid; not shown on Bid Board). When outcome is Won, **Estimated Job Start Date** date input is shown and saved. **Delete**: "Delete bid" button in Edit modal opens **separate confirmation modal**; type project name (or leave empty if none) to enable Delete; Cancel closes only delete modal.
- **Submission & Followup**: **Five collapsible sections** with clickable headers (chevron ▼/▶ and item count). "Lost" collapsed by default. **Unsent / Working Bids**, **Not yet won or lost**, **Won**, **Started or Complete**, **Lost**. **Selected-bid panel**: Bid title, then summary: Builder Name, Builder Address, **Builder Phone Number**, **Builder Email** (from customer or legacy GC/Builder), Project Name, Project Address, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**, Bid Size; then submission entries table, Add row, Edit icon, Close. **Not yet won or lost**: columns Project/GC, GC/Builder (customer), Time since last contact, Time to/from bid due date, **Edit**. **Unsent / Working Bids**: columns Project/GC, Bid Due Date, Bid Date Sent, Time since last contact, Time to/from bid due date, **Edit** (gear when row is selected; opens full edit modal). **Time to/from bid due date**: e.g. "X days since deadline", "Due today", "X days until due". **Won** table: columns Project/GC, **Estimated Job Start Date** (YY/MM/DD), GC/Builder (customer), Edit. **Started or Complete** table: Project/GC, GC/Builder (customer), Edit. **Lost** table: Project/GC, Bid Due Date, Edit. **Edit icon** (gear) next to Close opens that bid's full edit modal. **Submission entry rows**: Edit and Delete **icon buttons** (gear, trash) with tooltips.

## Recent Updates (v2.9)

### Bids Management
- **New Bids section** with route `/bids` and nav link for devs, master_technicians, and assistants (same as Materials visibility except subcontractors).
- **Bid Board tab**: Table of bids (project folder link, plans link, GC/Builder, project name/address, bid due date, bid date sent, won/lost, bid value, agreed value, projected maximum profit, distance from office, last contact, notes). New/Edit modal with bid folders links [plumbing] [electrical] [HVAC]; distance as number input; profit labeled "Projected Maximum Profit". GC/Builder uses **customers** table with searchable combobox (same pattern as ProjectForm customer picker). Clicking GC/Builder name opens modal with customer or legacy GC/Builder details and won/lost bid counts.
- **Counts tab**: Search bids; select bid to show fixture/count rows. **Add row** and **Import** buttons. Import: paste tab- or comma-separated text (Fixture, Count, Plan Page per line). Columns: Fixture, Count, Plan Page, actions. Plan Page field added to `bids_count_rows` and persisted.
- **Takeoffs / Cover Letter tabs**: Takeoffs (template mappings, create PO, view PO); Cover Letter (select bid; Customer + Project Name/Address; Inclusions/Exclusions/Terms with defaults; combined document; Edit bid button).
- **Submission & Followup tab**: Add rows (contact method, notes, time/date) per selected bid.
- **Database**: Tables `bids_gc_builders`, `bids`, `bids_count_rows`, `bids_submission_entries`; migrations `add_bids_customer_id.sql`, `add_bids_count_rows_page.sql`, `split_bids_project_name_and_address.sql`, `allow_assistants_access_bids.sql`. RLS grants devs, masters, and assistants full access to bids tables.

## Recent Updates (v2.8)

### Materials – Searchable Part Pickers
- **Template Add Item (Part)**: Replaced plain part `<select>` with a searchable combobox. Type to filter parts by name, manufacturer, fixture type, or notes (same fields as Price Book). Dropdown shows up to 50 matches with optional second line (manufacturer · fixture type). Select or Clear; closes on outside click, blur, or Escape.
- **PO Add Part**: Same searchable part picker when adding a part to a draft purchase order. Quantity input remains beside the picker.

### Materials – Template Search
- **Material Templates list**: Search input above the template list filters by name or description (case-insensitive). Empty search shows all templates; "No templates match" when the filter returns no results.

### Settings – Data Backup (Dev Only)
- **Data backup (dev)** section: At the very top of Settings (below header). Three export buttons for devs only.
  - **Export projects backup**: Downloads JSON with customers, projects, project_workflows, project_workflow_steps, project_workflow_step_actions, step_subscriptions, workflow_step_line_items, workflow_projections. Filename: `projects-backup-YYYY-MM-DD.json`.
  - **Export materials backup**: Downloads JSON with supply_houses, material_parts, material_part_prices, material_templates, material_template_items. Filename: `materials-backup-YYYY-MM-DD.json`.
  - **Export bids backup**: Downloads JSON with bids, bids_gc_builders, bids_count_rows, bids_submission_entries, cost_estimates, cost_estimate_labor_rows, fixture_labor_defaults, bid_pricing_assignments, price_book_versions, price_book_entries, labor_book_versions, labor_book_entries, takeoff_book_versions, takeoff_book_entries, purchase_orders, purchase_order_items (all POs and PO items visible under RLS, including Takeoffs-created POs). Filename: `bids-backup-YYYY-MM-DD.json`.
- **Maintenance: Materials prices**: Collapsible subsection (minimized by default). "Review orphaned material prices" button.
- Exports respect RLS (user only receives data they can read). Each file includes an `exportedAt` timestamp.

## Recent Updates (v2.8)

### Purchase Order and Price Book Enhancements
- ✅ **Supply house dropdown with active prices**: Draft PO items and selected PO section use a dropdown per line showing "Supply House Name - $X.XX" options; selecting one updates the PO item and total. Finalized POs show read-only supply house text.
- ✅ **Finalized POs**: Supply House cell is read-only (no dropdown). Confirmed column is hidden (table shows Part, Qty, Supply House, Price, Total only).
- ✅ **Update price to zero**: In the PO supply-house price table, setting New Price to 0 and "Update price" removes that price from the price book (button label: "Remove from supply house").
- ✅ **Price book refresh**: Closing the Part Prices modal refetches parts so the Price Book table shows updated Best Price without a full page refresh.
- ✅ **View PO inline**: Selected PO details appear in an inline section above "Search purchase orders" (no modal). Close hides the section.
- ✅ **Print PO**: Print button opens a print-friendly document: draft shows Part, Qty, All prices, Chosen, Total; finalized shows Part, Qty, Supply House, Price, Total. Grand Total in both. Print window closes after print/cancel.
- ✅ **Reliable refresh**: "Update price" in the PO modal passes part id so the price list refreshes correctly after update.

## Recent Updates (v2.7)

### Materials Management System
- ✅ **Complete Materials Management System** with three main tabs:
  - **Price Book**: Parts, supply houses, and price management
  - **Templates & Purchase Orders**: Template creation and draft PO building
  - **Purchase Orders (Management)**: PO management and workflow integration

#### Price Book Performance Enhancements (v2.24)

- ✅ **Load All Mode** (opt-in, v2.46):
  - **Toggle button** with speed icon (triangle SVG) next to filter dropdowns
  - **Batch loading**: Fetches all parts and prices in batched queries (no N+1)
  - Shows "Loading all parts..." during load
  - **Instant client-side search**: No network delay, filters as you type
  - **Instant client-side sorting**: Click "#" to sort by price count immediately
  - **Visual indicators**:
    - Button turns blue when Load All is active
    - Search box background turns light blue
    - Search placeholder: "Search all parts (instant)..."
  - **Default mode**: Off by default (paginated) to reduce database load; enable via toggle for bulk editing. Preference persists in localStorage per user.
  - **Perfect for assistants**: Bulk price updates without pagination interruption
  - **Toggle anytime**: Switch to paginated mode if needed
  - **Implementation**: `loadAllParts()` with `fetchPricesForParts()` batch helper, `allParts` state array

- ✅ **Infinite Scroll** (paginated mode):
  - **Automatic loading** when within 200px of page bottom
  - Loads next 50 parts seamlessly
  - Loading indicators: "Loading more parts…" or "Scroll down to load more"
  - Prevents duplicate requests via `loadingPartsRef`
  - Only active on Price Book tab (respects current search/filter)
  - Automatically disabled in Load All mode
  - No manual button clicking needed

- ✅ **Server-Side Search**:
  - **Searches entire database** (not just current page)
  - **300ms debounce** prevents excessive queries while typing
  - **Searches across**: name, manufacturer, fixture type, notes fields
  - Uses Supabase `.ilike()` for case-insensitive matching
  - Works with pagination - filtered results paginate correctly
  - Query pattern: `.or('name.ilike.%term%,manufacturer.ilike.%term%,...')`
  - Compatible with fixture type and manufacturer filters

- ✅ **Server-Side Sorting by Price Count**:
  - Click **"#" column header** to sort all parts by price count
  - **Database function**: `get_parts_ordered_by_price_count(ascending_order)`
  - Returns ordered part IDs array
  - Frontend fetches parts by ID for current page in correct order
  - Maintains global sort order across pages (not just current page)
  - **Use case**: Quickly identify parts needing prices (sort ascending = 0 prices first)
  - Migration: `create_parts_with_price_count_function.sql`

- ✅ **Disk IO Optimizations** (v2.46):
  - **Batch price fetching**: `fetchPricesForParts()` fetches prices for multiple parts in one query instead of N+1 per part
  - **Conditional Load All**: `loadAllParts` runs only when Load All mode is on; paginated `loadParts` runs when off
  - **Template items batching**: `loadTemplateItems` batch-fetches parts, prices, and nested templates
  - **Template stats filter**: `loadAllTemplateItemsForStats` filters by selected service type
  - **Composite index**: `idx_material_parts_service_type_name` on `(service_type_id, name)` for faster parts queries

- ✅ **Supply House Statistics**:
  - **Global stats** displayed at top of Supply Houses modal
  - Shows:
    - Total parts count across database
    - Percentage of parts with prices
    - Percentage of parts with multiple prices
    - Per-supply-house coverage sorted by count (highest first)
  - **Auto-refresh** every time modal opens
  - **Database function**: `get_supply_house_price_counts()`
  - Returns `(supply_house_id, name, price_count)` sorted by count DESC
  - **Benefits**: Quick visibility into pricing coverage, identify gaps
  - Migration: `create_supply_house_stats_function.sql`

#### Materials System Features

- ✅ **Supply House Management**:
  - Full CRUD for supply houses (create, edit, delete)
  - Contact information tracking (name, contact person, phone, email, address, notes)
  - Delete button in Edit Supply House form
  - Price coverage statistics in modal

- ✅ **Price History Tracking**:
  - Automatic price change tracking via database trigger
  - View price history with old price, new price, percentage change, timestamp, user, and notes
  - "View History" button in price management modal
  - History entries created on price updates and confirmations

- ✅ **Price Confirmation System**:
  - Per-item checkbox in PO view for assistants to confirm prices (draft POs only; Confirmed column hidden for finalized)
  - Shows "time since checked" (e.g., "2 hours ago")
  - Creates price history entry when confirmed (for charting/analysis)
  - Tracks who confirmed and when

- ✅ **Finalized PO Notes**:
  - Add-only notes to finalized purchase orders
  - Shows user name and timestamp
  - Use cases: final bill amounts, pickup difficulties
  - Notes display prominently at top of PO view
  - RLS policy enforces add-only (can only update when notes is null)

- ✅ **Purchase Order Features**:
  - Default name: "New Purchase Order [current date]"
  - Inline name editing for draft POs
  - **"Duplicate as Draft" button** for finalized POs (creates copy, resets confirmation)
  - **Print Purchase Order**:
    - Draft POs: Shows all prices per part (every supply house)
    - Finalized POs: Shows chosen prices only
    - Print-friendly formatting, opens in new window
  - **Inline PO View** (not modal): Selected PO section above search
  - **Supply House Dropdown** (draft POs): Shows "Supply House - $X.XX", immediate update
  - Change supply house for individual items (even if higher price)
  - Delete button in selected PO section (inline view)

- ✅ **Template Features**:
  - **Nested template support**: Templates can contain other templates
  - **Template expansion**: `expandTemplate()` utility recursively expands nested templates
  - **"From template" tags**: PO items tagged when added via template
  - Used by Bids Takeoff tab for creating purchase orders

- ✅ **UI Improvements**:
  - Delete buttons moved to edit modals (parts, templates, supply houses, POs)
  - Price edit modal: Delete button only visible after Edit is pressed
  - Improved sorting and organization
  - Load All mode optimized for bulk editing workflows

### Data Export and Backup Features

**Location**: Settings page → Data Export section (dev-only)

**Note (v2.46)**: Export may take several minutes for large datasets and uses significant database resources.

- ✅ **Projects Export**:
  - **Data included**: Complete projects data with workflows, steps, and related information
  - **Format**: JSON file download
  - **Filename**: `projects_export_YYYY-MM-DD.json`
  - **Use cases**: 
    - Backup project data before major changes
    - Export for external analysis or reporting
    - Archive completed projects
  - **Access**: Dev role only
  - **Implementation**: Exports all projects accessible to current user via RLS

- ✅ **Materials Export**:
  - **Data included**:
    - Parts (`material_parts`)
    - Prices (`material_part_prices`)
    - Supply houses (`supply_houses`)
    - Templates (`material_templates`, `material_template_items`)
    - Purchase orders (`purchase_orders`, `purchase_order_items`)
  - **Format**: JSON file with nested structure
  - **Filename**: `materials_export_YYYY-MM-DD.json`
  - **Use cases**:
    - Backup materials database
    - Share price book with other users
    - Migrate to new system
  - **Access**: Dev and master_technician roles
  - **Complete export**: Includes all related tables with proper relationships

- ✅ **Bids Backup Export**:
  - **Data included**:
    - All bids data (`bids`, `bids_count_rows`, `bids_submission_entries`)
    - Cost estimates (`cost_estimates`, `cost_estimate_labor_rows`)
    - Price book (`price_book_versions`, `price_book_entries`, `bid_pricing_assignments`)
    - Labor book (`labor_book_versions`, `labor_book_entries`)
    - Takeoff book (`takeoff_book_versions`, `takeoff_book_entries`, `takeoff_book_entry_items`)
    - Purchase orders (`purchase_orders`, `purchase_order_items`) - all rows under RLS
  - **Format**: Comprehensive JSON backup
  - **Filename**: `bids_backup_YYYY-MM-DD.json`
  - **Use cases**:
    - Complete bid system backup
    - Preserve estimation data for analysis
    - Migration or system transfer
    - Historical record keeping
  - **Access**: Dev and estimator roles
  - **Complete system**: Exports entire bidding and estimation system

- ✅ **Orphaned Prices Cleanup**:
  - **Purpose**: Remove prices for deleted parts (data maintenance)
  - **What it does**:
    - Finds prices in `material_part_prices` where `part_id` no longer exists in `material_parts`
    - Displays count of orphaned prices before deletion
    - Requires confirmation (shows list of affected supply houses)
    - Deletes orphaned price records
  - **When to use**:
    - After bulk part deletions
    - Database cleanup and maintenance
    - Before major data exports (ensures clean data)
  - **Safety**:
    - Shows preview before deletion
    - Requires explicit confirmation
    - Cannot be undone (recommend export backup first)
  - **Access**: Dev role only
  - **Implementation**: Uses LEFT JOIN to find orphaned records

### Export File Formats

**JSON Structure Pattern**:
```json
{
  "export_date": "2026-02-07T12:00:00Z",
  "export_type": "projects|materials|bids",
  "data": {
    "main_table": [...],
    "related_table_1": [...],
    "related_table_2": [...]
  },
  "metadata": {
    "total_records": 123,
    "tables_included": ["table1", "table2"],
    "exported_by": "user_id"
  }
}
```

**Benefits of Export System**:
- **Backup**: Regular backups prevent data loss
- **Migration**: Easy transfer to new systems or projects
- **Analysis**: External data analysis in Excel, Python, etc.
- **Audit**: Historical records of system state
- **Sharing**: Share configurations (templates, price books) between users
- **Recovery**: Restore from backup if needed

**Best Practices**:
1. Export regularly (weekly/monthly backups)
2. Store exports in secure location (not just browser downloads)
3. Name exports with dates for easy tracking
4. Test imports/restores periodically
5. Export before major system changes
6. Keep exports for audit trail (at least 1 year)

### Line Items Enhancement
- ✅ **Link Field Added**:
  - Optional link field in Add/Edit Line Item modal (positioned at top, above memo)
  - Auto-formats URLs (adds https:// if missing)
  - Displayed as clickable link icon (chain link SVG) next to memo
  - Available in both Ledger table and Private Notes section
  - Opens in new tab with security attributes

## Recent Updates (v2.6)

### Workflow Data Persistence & Performance Fixes
- ✅ **Fixed data persistence issues** for projections and workflow steps
  - Projections and steps now persist correctly when navigating away and back
  - Fixed race condition where `workflow?.id` from state was null during save operations
  - All save/delete operations now ensure valid workflow_id via `ensureWorkflow(projectId)`
- ✅ **Prevented concurrent workflow creation**
  - Implemented mutex pattern using `useRef` and placeholder promises
  - Only one workflow is created per project, even with concurrent calls
  - Added retry logic for insert errors to handle unique constraint violations
- ✅ **Optimized redundant loadSteps calls**
  - Reduced from 7+ calls to 1-2 calls per page load
  - Added ref tracking to prevent redundant loads when workflow state updates
  - Improved performance and reduced database queries
- ✅ **Fixed TypeScript type errors**
  - Resolved 7 type errors where `string | null` was not assignable to `string | undefined`
  - Explicitly typed workflowId variables as `string | null` to match `ensureWorkflow` return type
  - Used nullish coalescing operator (`?? null`) to convert `undefined` to `null`
  - TypeScript build now succeeds

## Recent Updates (v2.4)

### Assistant Workflow Access
- ✅ Assistants can now see ALL stages in workflows they have access to (not just assigned stages)
- ✅ Subcontractors remain restricted to assigned stages only
- ✅ Fixed line items not updating immediately for assistants after adding/editing

### Financial Tracking Updates
- ✅ Assistants can add/edit line items but cannot see financial totals (Ledger Total, Total Left on Job)
- ✅ Updated label: "Line Items (Master and Assistants only)"
- ✅ Ledger section visible to devs, masters, and assistants (totals hidden from assistants)

### Workflow Stage Status Display
- ✅ Status moved to top of card (right below "Assigned to")
- ✅ Previous work incomplete status includes reason inline: "Status: Previous work incomplete - {reason}"
- ✅ Removed duplicate status display from bottom of card

### Re-open Stages
- ✅ Added "Re-open" button for completed, approved, and marked-incomplete stages
- ✅ Available to devs, masters, and assistants (on Workflow page only)
- ✅ Button appears inline with Edit and Delete buttons (bottom right of card)
- ✅ Resets stage to pending, clears rejection reason, approval info, and next step rejection notices
- ✅ Records 'reopened' action and sends notifications

### Master-to-Master Sharing
- ✅ Added `master_shares` table for master-to-master sharing relationships
- ✅ Updated all RLS policies to support master sharing (customers, projects, workflows, steps, line items, projections)
- ✅ Shared masters receive assistant-level access (can see but not modify, cannot see financial totals)
- ✅ UI added to Settings page for managing shares

### Database RLS Optimizations
- ✅ Optimized `workflow_step_line_items` RLS (prevents timeout errors)
- ✅ Fixed `project_workflow_step_actions` RLS (fixes 403/500 errors)
- ✅ Created helper functions: `can_access_project_via_step()`, `can_access_step_for_action()`

## Recent Updates (v2.3)

### Workflow Step Assignment
- ✅ Autocomplete dropdown in "Add Step" modal for assigning masters and subs
- ✅ "Add person" prompt when name doesn't exist in list
- ✅ Shows source indicators: "(user)" vs "(not user)"

### Projects Page Fixes
- ✅ Fixed current stage position calculation (uses sorted position, not raw sequence_order)
- ✅ Prevents display of invalid positions like "[16 / 13]"

### RLS Policy Fixes
- ✅ Fixed users table RLS recursion issue (uses SECURITY DEFINER function)
- ✅ Assistants can now see master information for projects they have access to
- ✅ Created `master_adopted_current_user()` function to safely check adoptions

## Recent Updates (v2.2)

### Password Management
- ✅ Password reset functionality (forgot password)
- ✅ Password change in Settings (for all users)
- Routes: `/reset-password`, `/reset-password-confirm`

### Edge Functions
- ✅ `archive-user` - Fully implemented (requires `SUPABASE_SERVICE_ROLE_KEY`)
- ✅ `restore-user` - Fully implemented (requires `SUPABASE_SERVICE_ROLE_KEY`)
- ✅ `login-as-user` - Fully implemented (requires `SUPABASE_SERVICE_ROLE_KEY`)
- ✅ `send-workflow-notification` - Fully implemented (requires `RESEND_API_KEY`)

### Database & RLS
- ✅ Email templates RLS policies updated to use `is_dev()` function
- ✅ People table RLS policy added for devs to read all entries
- ✅ All Edge Functions use manual JWT validation (gateway verification disabled)

### UI Improvements
- ✅ Date formatting includes day of week (e.g., "Tue, 1/21/26, 6:52 PM")
- ✅ Orange gear favicon added
- ✅ "Forgot password?" link on sign-in page

**See [RECENT_FEATURES.md](./RECENT_FEATURES.md) for detailed information about all recent additions.**

## Recent Feature Additions (v2.0+)

### Major Features Added

#### Workflow Enhancements
1. **Private Notes**: Owners, masters, and assistants can add private notes to each stage (separate from public notes)
2. **Line Items**: Track expenses/credits per stage with memo and amount fields
3. **Projections**: Track projected costs for entire workflow (stage, memo, amount)
4. **Ledger**: Aggregated view of all line items at top of workflow page
5. **Action History Ledger**: Complete audit trail at bottom of each stage card
6. **Set Start Date/Time**: Date/time picker for setting custom start times (replaces immediate start)
7. **Amount Formatting**: All monetary amounts display with comma separators (e.g., `$1,234.56`)

#### Access Control
8. **Assistant/Subcontractor Restrictions**: 
   - Only see stages assigned to them
   - Can only use action buttons on assigned stages
   - Cannot see private notes, line items, projections, or ledger
9. **Current User in Person Assignment**: Signed-in user always appears first in "Add person" modal

#### Calendar Improvements
10. **Central Time Zone**: All calendar dates/times display in Central Time (America/Chicago)
11. **Two-Line Display**: Each calendar item shows stage name (top) and project name (bottom)

#### Email System
12. **Email Templates**: Customizable email content for 11 notification types
13. **Test Email Function** (`test-email`): Edge Function for testing email templates with Resend (client supplies rendered subject/body from Settings). **`send-workflow-notification`** is the production path (server loads `email_templates` by type); devs can smoke-test it from **Settings → Templates & testing → Workflow email (Edge Function)** — see `RECENT_FEATURES.md` v2.186 and `WORKFLOW_EMAIL_TESTING.md`.
14. **Template Variables**: Support for dynamic content (e.g., `{{name}}`, `{{email}}`, `{{link}}`)

#### Settings Enhancements
15. **People Visibility**: Devs can see all users and all people entries (RLS policy updated)
16. **Separated People Lists**: "People Created by Me" and "People Created by Other Users"
17. **Email Template Management**: GUI for devs to edit email templates in Settings
18. **Password Change**: All users can change their password in Settings (requires current password verification)

#### Authentication & Security
19. **Password Reset**: Users can request password reset via "Forgot password?" link on sign-in page
20. **Password Reset Confirmation**: Dedicated page for setting new password after clicking email link
21. **RLS Policy Fixes**: 
    - Email templates table uses `is_dev()` function for policies
    - People table allows devs to read all entries

#### UI Improvements
20. **Date Formatting**: Date/time displays now include day of week (e.g., "Tue, 1/21/26, 6:52 PM")
21. **Favicon**: Orange gear icon displayed in browser tabs
22. **Contact Integration**: Clickable email/phone links throughout the app
23. **Google Maps Integration**: Clickable addresses open in Google Maps
24. **Direct Step Navigation**: Hash fragments enable direct links to specific step cards

#### Existing Features (from v2.0)
25. **Approval Tracking**: Tracks who approved steps and when (`approved_by`, `approved_at`)
26. **Cross-Step Notifications**: Automatic notifications to adjacent step assignees
27. **Workflow Header Navigation**: Visual stage overview with color-coding and clickable navigation
28. **Step Reordering**: Insert steps at any position (beginning, end, or after specific step)
29. **Customer Quick Fill**: Paste tab-separated data to auto-fill customer forms
30. **Active Stage Display**: Projects list shows currently active workflow stage
31. **Assigned Stages Dashboard**: Users see all stages assigned to them with full details
32. **Project Address Field**: Separate address field for projects (can differ from customer address)
33. **Date Met Tracking**: Track when customer relationship started
34. **Refresh Token Error Handling**: Graceful handling of expired/invalid tokens
