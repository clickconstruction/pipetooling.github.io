# PipeTooling Project Documentation

**What this is** — the deep technical reference for PipeTooling: database schema (~55 core tables + the jobs-ledger family summary), RLS patterns, authentication and authorization mechanics, database functions, client code patterns, known gotchas, and deployment. New to the project? Read [AI_CONTEXT.md](./AI_CONTEXT.md) first (30 seconds), then come back here.

**When to read it** — adding or changing tables, writing RLS, debugging access issues, learning the architecture, or looking up an established pattern (retry wrapper, mutex, RLS-recursion avoidance).

**Where depth lives** — this file stays at the schema/pattern layer. Feature behavior is summarized in [Key Features](#key-features) as one paragraph per surface with pointers; the detail lives in each surface's `*_ARCHITECTURE.md` map plus `grep docs/RECENT_FEATURES.md` for version history. Roles → [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) (authoritative). Bids → [BIDS_SYSTEM.md](./BIDS_SYSTEM.md). Edge functions → [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md). Migrations → [MIGRATIONS.md](./MIGRATIONS.md). Terms → [GLOSSARY.md](./GLOSSARY.md). Incidents → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) and [docs/runbooks/](./runbooks/).

---
file: PROJECT_DOCUMENTATION.md
type: Technical Reference
purpose: Deep technical reference — schema, RLS, auth, DB functions, client patterns, gotchas; feature surfaces route to specialist docs
audience: Developers, AI Agents, Technical Staff
last_updated: 2026-08-23
key_sections:
  - name: "Database Schema"
  - name: "Authentication & Authorization"
  - name: "Key Features"
  - name: "Development Workflow"
  - name: "Common Patterns"
  - name: "Known Issues & Gotchas"
  - name: "Quick Reference"
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
14. [Quick Reference](#quick-reference)
15. [Getting Started for New Developers](#getting-started-for-new-developers)
16. [Contact & Support](#contact--support)

---

## How to read this doc

- The **Database Schema** section documents roughly **55 of the ~250 tables** — the core project/workflow/people/materials/bids tables — plus a summary of the `jobs_ledger` family. For any other table, grep [RECENT_FEATURES.md](./RECENT_FEATURES.md) for the version that introduced it.
- **Key Features** sections are deliberately surface-level: one paragraph per surface with pointers. Follow the pointers for depth; do not re-add feature detail here — it drifts.
- Prefer the specialist docs when they exist: [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) for role permissions, [BIDS_SYSTEM.md](./BIDS_SYSTEM.md) for bids, [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) for the ~67 Edge Functions, [MIGRATIONS.md](./MIGRATIONS.md) for schema history, and [RECENT_FEATURES.md](./RECENT_FEATURES.md) for the per-version changelog.

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
- `/dev-login` - Dev-only auth bypass (always signs in as `robert@douglasmining.com` — v2.1517; only when `import.meta.env.DEV`; requires `VITE_DEV_LOGIN_SECRET` and Edge Function `DEV_LOGIN_SECRET`). See `EDGE_FUNCTIONS.md` → dev-login.
- `/sign-up` - Sign up page
- `/reset-password` - Request password reset
- `/reset-password-confirm` - Confirm password reset (from email link)

---

## Database Layer Improvements

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
  - `role` (enum `user_role`, 9 active values: `'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator' | 'primary' | 'superintendent' | 'helpers' | 'controller'`; legacy `'owner'`/`'master'` values remain in the enum but are unused — see `20250101000000_baseline.sql` and `20260714210000_add_user_role_controller.sql`)
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
  - `archived_at` (timestamptz, nullable) / `archived_by` (uuid, FK → `users.id`, ON DELETE SET NULL) - **Soft archive** (v2.736, migration `20260718172650`): non-NULL `archived_at` hides the customer from the Customers list by default (Show archived toggle + badge) and from pickers that link new jobs/estimates/bids/projects; existing links keep working and display is unchanged. Archive/Unarchive is in the Edit customer form (dev/master/assistant-like) with a confirm modal; kernel `src/lib/customerArchive.ts`. No RLS change — same-row UPDATE under existing policies.
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
- **RLS**: Leaders and members can read rows they appear on; dev, master_technician, and assistant can manage all rows (People → Users **Team leads** modal or **People → Teams**). **SQL:** `is_team_lead_for_member(leader, member)`, `can_manage_team_leader_assignments()`.
- **Usage**: **People → Users → Team leads** modal **or** **People → Teams** (`/people?tab=teams`) — both render the shared **[`TeamLeadsManager.tsx`](../src/components/people/TeamLeadsManager.tsx)** (formerly Settings → Dashboard & alerts "Team Hours Sharing"); dev, master_technician, and assistant manage rows (**Leader dashboard** Full/Strip toggle: **dev-only**); extends `clock_sessions` SELECT/UPDATE and `approve_clock_sessions` / `revoke_clock_sessions` for team-lead paths.

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
  - `kind` (check constraint: includes `assistant`, `master_technician`, `sub`, `estimator`, `dev`, `primary`, `superintendent`, `helper`)
  - `name` (text)
  - `email` (text, nullable)
  - `phone` (text, nullable)
  - `notes` (text, nullable)
  - `archived_at` (timestamptz, nullable) – when set, person is archived (hidden from roster); can be restored
  - `start_date` / `end_date` (date, nullable) – employment window, edited on the People **Employment** tab (`20260713120000_time_off_paid_kind_people_employment_dates.sql`)
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
  - `supabase/archive/migrations-pre-baseline/20260321120001_add_supply_house_invoice_to_line_items.sql` - Added supply_house_invoice_id field
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
- **Template Types**: see the `template_type` value list in [`EDGE_FUNCTIONS.md`](./EDGE_FUNCTIONS.md) (send-workflow-email section)

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
- **Purpose**: Deprecated. Replaced by the claim-dev Edge Function (DEV_PROMOTION_CODE secret), which as of `20260717150000_claim_dev_break_glass.sql` is **break-glass only**: the promotion is refused whenever a usable dev exists (`role='dev'`, not archived, not read-only), read-only callers are always refused, and every attempt (granted or refused) is audited in `claim_dev_attempts` (dev-only SELECT; repeated refusals surface as a dashboard alert). The backing RPC `claim_dev_attempt()` is REVOKEd from PUBLIC/anon/authenticated and granted only to `service_role`, so the Edge Function is its sole caller and all refusals return the same opaque failure.

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
  - **Migration**: [`20260430201832_service_types_ledger_display_prefixes.sql`](../supabase/archive/migrations-pre-baseline/20260430201832_service_types_ledger_display_prefixes.sql) adds columns and backfills **Plumbing** → `JP`/`BP`, **Electrical** → `JE`/`BE`, **HVAC** → `JH`/`BH`; other rows stay null (**`J`**/**`B`** in the client).
  - **Settings (dev)**: Service type add/edit modal — optional prefix fields with validation (trim, max length, uniqueness across rows).
  - **Client**: [`src/lib/ledgerDisplayPrefixes.ts`](../src/lib/ledgerDisplayPrefixes.ts) — `buildPrefixMap`, `resolveJobPrefix` / `resolveBidPrefix`, `formatLedgerJobLabel` / `formatLedgerBidLabel` (and related helpers used in Clock In, Jobs, Bids, Documents, My Time, push copy, etc.). Many flows load `service_type_id` with rows so labels match the trade.
  - **Search RPCs** (prefix-aware match from **`20260430201832`**): `search_jobs_ledger` and `search_bids_for_clock` return **`service_type_id`** and treat typed queries as **legacy `J`/`B` + digits** or **configured prefix + remainder** when matching `hcp_number` / `bid_number`. Follow-up **[`20260430205318_search_jobs_ledger_service_type_name.sql`](../supabase/archive/migrations-pre-baseline/20260430205318_search_jobs_ledger_service_type_name.sql)** adds **`service_type_name`** on **`search_jobs_ledger`** (JOIN **`service_types`**) for unified-search **trade** pills on job rows; **[`20270518120000_list_assigned_jobs_service_type_name.sql`](../supabase/archive/migrations-pre-baseline/20270518120000_list_assigned_jobs_service_type_name.sql)** adds **`service_type_name`** to **`list_assigned_jobs_for_dashboard`**. Client: **`serviceTypeTagForUnifiedRow`** / **`getBidServiceTypeTag`** in [`unifiedJobBidSearch.ts`](../src/utils/unifiedJobBidSearch.ts) (**`RECENT_FEATURES`** **v2.433**).
  - **Crew / detail RPCs**: [`20260430202750_crew_rpcs_service_type_id_for_ledger_prefixes.sql`](../supabase/archive/migrations-pre-baseline/20260430202750_crew_rpcs_service_type_id_for_ledger_prefixes.sql) adds `service_type_id` where needed; [`20260430203800_restore_pct_complete_on_jobs_ledger_detail_rpcs.sql`](../supabase/archive/migrations-pre-baseline/20260430203800_restore_pct_complete_on_jobs_ledger_detail_rpcs.sql) restores **`pct_complete`** on `get_jobs_ledger_by_ids*`, `get_jobs_ledger_by_hcp_numbers*`.
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
- **Table**: `public.estimates` — see migrations [`20260404212052_estimates_approach_a.sql`](../supabase/archive/migrations-pre-baseline/20260404212052_estimates_approach_a.sql) (Approach A), [`20260405003103_estimates_global_estimate_number.sql`](../supabase/archive/migrations-pre-baseline/20260405003103_estimates_global_estimate_number.sql) (global **`estimate_number`**), and [`20260405010252_estimate_customer_experience_defaults_snapshot.sql`](../supabase/archive/migrations-pre-baseline/20260405010252_estimate_customer_experience_defaults_snapshot.sql) (**`customer_experience_overrides`**, **`customer_experience_sent`**). **`estimate_customer_events`** ([`20260406024629_estimate_customer_events.sql`](../supabase/archive/migrations-pre-baseline/20260406024629_estimate_customer_events.sql), [`20260406025757_log_estimate_customer_event_rpc.sql`](../supabase/archive/migrations-pre-baseline/20260406025757_log_estimate_customer_event_rpc.sql), [`20260406033952_estimates_audit_customer_accepted_trigger.sql`](../supabase/archive/migrations-pre-baseline/20260406033952_estimates_audit_customer_accepted_trigger.sql), [`20260406034514_record_estimate_public_link_view_rpc.sql`](../supabase/archive/migrations-pre-baseline/20260406034514_record_estimate_public_link_view_rpc.sql), [`20260412184127_dedupe_record_estimate_public_link_view.sql`](../supabase/archive/migrations-pre-baseline/20260412184127_dedupe_record_estimate_public_link_view.sql)) is an append-only timeline of **public link views** and **accept submissions** (**`client_ip`** / **`user_agent`** per event when available; **`metadata`** holds e.g. **`had_signature`**, **`repeat_after_accepted`**). **Link views** are inserted by **`record_estimate_public_link_view`** (called from **`get-estimate-for-customer`** while **`sent`**). **First accept** events are inserted by trigger **`estimates_audit_customer_accepted_trigger`** on **`sent` → `customer_accepted`** (copies **`acceptor_ip`** / **`acceptor_user_agent`**). Repeat **`accept-estimate`** posts (**`alreadyAccepted`**) may append via **`log_estimate_customer_event`** from Edge. Staff **`SELECT`** uses the same visibility shape as **`estimates`**. **`job_ledger_id`** links to **`jobs_ledger`** after acceptance; [**`create_job_from_estimate`**](../supabase/archive/migrations-pre-baseline/20260405072854_estimate_create_job_rpc.sql) inserts the job and sets the link atomically (unique when non-null). Status enum **`estimate_status`**. Staff edit only while **`draft`**; **`sent`** / accept transitions use service role in Edge Functions.
- **`estimate_number`**: Monotonic global **Quote #** per row (`public.estimates_estimate_number_seq` on insert; trigger forbids changing the column after assignment). Gaps in the sequence are possible if draft rows are deleted. List and detail show **Quote #**; canonical staff URL is **`/estimates/{estimate_number}`**. Legacy **`/estimates/{uuid}`** still resolves; the app **`replace`**-navigates to the numeric path when opened by UUID.
- **RLS**: Staff roles aligned with bids/jobs (`user_can_access_estimate`, broad read for estimator/primary/dev/assistant/master like bids). No anon/customer PostgREST access.
- **Edge**: **`get-estimate-for-customer`** (GET), **`accept-estimate`** (POST), **`send-estimate-to-customer`** (JWT + Resend). Optional secret **`ESTIMATE_PUBLIC_ORIGIN`** for link base; else client sends **`public_origin`**. Response may include **`accept_url`** (e.g. when Resend is not configured or for staff copy-open after send).
- **UI**: [`Estimates.tsx`](../src/pages/Estimates.tsx) (list **Quote #** column; **`sent`** detail: **`h1`** with **`# {estimate_number}`** + title; **For** / **Acceptance page logo** / **Line items**; **`customer_accepted`** detail: **`#`** + status only (no duplicate title); frozen quote **card** ([`EstimateCustomerDocument.tsx`](../src/components/estimates/EstimateCustomerDocument.tsx) + optional [`EstimateCustomerAttachmentCard`](../src/components/estimates/EstimateCustomerAttachmentCard.tsx)) first, then customer/email (**Customer:** opens [`CustomerSnapshotModal`](../src/components/customers/CustomerSnapshotModal.tsx)), **Customer acceptance**, collapsible **Customer activity** (**`EstimateDetailCustomerActivitySection`** in [`Estimates.tsx`](../src/pages/Estimates.tsx): **`sent`** default expanded, **`customer_accepted`** default collapsed), **Job** block **centered** — **Create job from estimate** (primary blue) / link / **Unlink job** (modal; clears **`job_ledger_id` only**); **Customer activity** copy — **“Customer opened quote link”** / **“Customer accepted estimate”**, optional IP / **`(with signature)`**, datetime (refetch on **`window` `focus`** while **`sent`**); **`sent`**: **Copy customer link** / **Open customer link** under waiting copy; [`EstimateCustomerAcceptLinkButtons.tsx`](../src/components/estimates/EstimateCustomerAcceptLinkButtons.tsx) — when **`sent`**, omitted from the top of **Customer experience**; **Customer experience** collapsible **Email** / **Acceptance page** / **Thank you**; **draft** **Customize customer copy** under preview tabs; **Line item catalog** modal **Insert from catalog** / **Edit book**; public [`EstimateAccept.tsx`](../src/pages/EstimateAccept.tsx) (**`AbortController`** on initial load). Shared body + modal: [`EstimateAcceptBody.tsx`](../src/components/estimates/EstimateAcceptBody.tsx) — **Approve** modal omits **`accept_instructions`**; primary submit centered; [`EstimateTermsHeaderNotice.tsx`](../src/components/estimates/EstimateTermsHeaderNotice.tsx) — linked **Terms and Conditions.** only; **accepted** staff inline record: disclosure + disabled checked **`accept_checkbox_label`** before **Full name**. [`EstimateCustomerThankYou.tsx`](../src/components/estimates/EstimateCustomerThankYou.tsx) — centered thank-you + **`public/chick.png`**; **Valid through** / **`doc_*`** on document unchanged. Nav: Materials → **Estimates** → Bids (where applicable). See **RECENT_FEATURES** **v2.288**.
- **Mobile / narrow viewport (`≤640px`)**: **`estimatesPageShellCss`** on **`.estimates-page-modern`** (`width: 100%`, **`min-width: 0`**, **`max-width: min(1100px | 900px, 100%)`** via **`estimates-page-shell--list`** vs **`--detail`**, tighter padding **`@media (max-width: 640px)`**); list tables wrapped with **`estimateListTableScrollWrapStyle`** (**`overflow-x: auto`**, **`max-width: 100%`**); **`EstimateListCards`** (**`useNarrowViewport640`**) replaces **`EstimateListTable`** on Ledger / Stages at **`≤640px`** (cards keep thread expand + **`JobThreadNotesPanel`**); Customer experience **Email** HTML preview horizontal scroll + **`estimate-email-html-preview-root`** responsive **`img`**; expanded draft **`CustomerNotesTable`** in **`overflow-x: auto`**; preview shells **`max-width: min(640px, 100%)`**; **[`AcceptHeaderBrandPicker.tsx`](../src/components/estimates/AcceptHeaderBrandPicker.tsx)** **`max-width: min(900px, 100%)`**. See **RECENT_FEATURES** **v2.430**.
- **Customer copy**: Merge order: **`customer_experience_sent`** (frozen when estimate moves to **`sent`**) overrides live merges; else **`app_settings`** keys `estimate_*` (dev: [`Settings.tsx`](../src/pages/Settings.tsx) **Estimate customer experience defaults**) plus optional **`customer_experience_overrides`** on the row. Draft **Customize customer copy** groups fields into **Email**, **Acceptance page**, and **Thank you** under each respective preview tab (with **Acceptance** covering both **`doc_*`** quote-document strings and **`accept_*`** accept-form strings); each textarea **shows** merged defaults (builtins plus **`app_settings`**) until staff edits, and **`customer_experience_overrides`** persists only changed keys. Templates support **`{{accept_url}}`**, **`{{title}}`**, **`{{estimate_number}}`** in email subject/body. Shared logic: [`src/lib/estimateCustomerExperience.ts`](../src/lib/estimateCustomerExperience.ts) and [`supabase/functions/_shared/estimateCustomerExperience.ts`](../supabase/functions/_shared/estimateCustomerExperience.ts) (keep in sync). Builtin thank-you body and accept-page footer tagline match **v2.288**; **[`20260412190051_update_estimate_thank_you_body_default.sql`](../supabase/archive/migrations-pre-baseline/20260412190051_update_estimate_thank_you_body_default.sql)** and **[`20260412190601_update_estimate_accept_page_footer_tagline.sql`](../supabase/archive/migrations-pre-baseline/20260412190601_update_estimate_accept_page_footer_tagline.sql)** update **`app_settings`** on existing deploys. Public GET JSON includes **`customer_experience`** (no email fields) for the accept page; **`already_accepted`** **409** includes **`customer_experience`** for thank-you. Legacy **`estimateCustomerEmail.ts`** files are unused by the app; Edge sends **`resolveEstimateCustomerExperience`** output.
- **Customer on draft**: Staff pick a **`customers`** row via [`CustomerSearchCombobox`](../src/components/customers/CustomerSearchCombobox.tsx) (search shows CRM email and phone); **Edit customer** opens the global [`EditCustomerModal`](../src/components/EditCustomerModal.tsx) (same as Customers/Bids); optional **Create new customer** opens [`NewCustomerForm`](../src/components/NewCustomerForm.tsx). **`estimates.customer_id`** is saved on draft. Send uses **`contact_info.email`** when present; if the CRM record has no email, **Send to email (override)** supplies the address for the Edge function—**`customer_email`** on the row may then reflect that override (not the CRM field). Shared display helpers: [`customerContactDisplay.ts`](../src/lib/customerContactDisplay.ts).
- **Email when customer accepts (staff)**: Column **`accept_notify_user_ids`** (`uuid[]`, nullable; [**`20260430213314_estimates_accept_notify_user_ids.sql`**](../supabase/archive/migrations-pre-baseline/20260430213314_estimates_accept_notify_user_ids.sql)). After **`sent` → `customer_accepted`**, **`accept-estimate`** (Edge) emails each eligible **`users.email`** for ids in this array (**`estimate_accept_notify_filter_eligible_user_ids`**). **`NULL`**: never saved for this field—draft detail load in [`Estimates.tsx`](../src/pages/Estimates.tsx) initializes selection to **deduped current user + every `master_technician`** (falls back to self only if the query fails). **`[]`**: explicitly no staff recipients. **Draft UI**: **Notify me** (self) + **Also notify** ([`SearchableMultiSelect`](../src/components/SearchableMultiSelect.tsx); self omitted from the multi list); options ordered **Master technicians → Assistants → Superintendents → everyone else** with small section captions on labeled separators ([`SearchableSelectSeparatorListRow`](../src/components/SearchableSelect.tsx)). Saved **non-null** arrays load as stored. See **RECENT_FEATURES** **v2.434** and **`EDGE_FUNCTIONS.md`** **accept-estimate**.

- **Quick Estimate (field wizard, v2.2293)**: per-user opt-in ⚡ Dashboard button (Settings → Dashboard & alerts, `user_dashboard_buttons` key `quick_estimate`, default off; roles dev/master_technician/primary/estimator/superintendent/subcontractor) opens [`QuickEstimateWizard.tsx`](../src/components/estimates/QuickEstimateWizard.tsx): schedule-seeded job pick (→ CO + customer), voice-nudged work description + camera photos (`estimate_field_photos` + private `estimate-field-photos` bucket, shown in detail via `EstimateFieldPhotosStrip`), type-first ballpark (lands as a $0 "Field ballpark — to be priced" line), **Send to Dispatch** (stamps `estimates.sent_to_dispatch_at` → amber **With Dispatch** chip on draft rows; inserts a `dispatch_requests` row `pending_action 'review_field_estimate'` with an **Open the draft** link in the Dispatch inbox; adds the author to `accept_notify_user_ids` so acceptance emails them). Kernel [`quickEstimate.ts`](../src/lib/quickEstimate.ts). The wizard never sets `job_ledger_id` (unique per job — reserved for the office's create/apply flows).

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
  - `bid_due_time` (time, nullable) - Optional time-of-day the bid is due; wall-clock as entered, no timezone math (`20260713153000_bids_bid_due_time.sql`)
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

### Jobs Ledger Family (summary)

The jobs pipeline postdates the schema sections above; its column semantics are summarized here (their one schema home). Behavior lives in [JOBS_TABS_ARCHITECTURE.md](./JOBS_TABS_ARCHITECTURE.md), [BILLING_FLOWS.md](./BILLING_FLOWS.md), and [GLOSSARY.md](./GLOSSARY.md).

#### `public.jobs_ledger`
- One row per job; `status` runs waiting → working → ready_to_bill → billed → paid via the `update_job_status` RPC.
- Every status change is audited in `job_status_events` (single-writer trigger since v2.1435).
- `revenue` is the canonical job total; `payments_made` is a trigger-maintained cache of payment rows.
- `hcp_number` and `click_number` combine into the effective job number (HCP wins when both are set).
- `last_work_date` is trigger-maintained from approved clock sessions; the manual `last_bill_date` column was retired in v2.1154 (nothing reads or writes it).
- FKs: `customer_id` (required before billing), `gc_customer_id` (optional GC link), `development_id` (optional job grouping), `project_id` (job's `master_user_id` synced to project owner), `service_type_id`. The two `customers` FKs make bare embeds ambiguous — always name the FK (PGRST201).
- Link columns: `google_drive_link` (customer files), `job_pictures_link`, `job_plans_link`.

#### Child tables
- `jobs_ledger_fixtures` — Specific Work lines: `name`, `count`, optional `line_unit_price`, optional `line_description` (scope text for that row's Stripe invoice line), `sequence_order`.
- `jobs_ledger_invoices` — billing lines; `is_primary_rtb_bundle` marks the primary remainder from `ensure_single_ready_to_bill_invoice_for_job`; Stripe rows carry `stripe_invoice_id` / `hosted_invoice_url`; external sends record `external_send_channel`.
- `jobs_ledger_payments` — payments; nullable `invoice_id` ties a payment to one invoice line (whole-job payments leave it null).
- `jobs_ledger_materials` / `jobs_ledger_team_members` — job material-cost rows; assigned team (read by the dashboard RPCs).
- `jobs_ledger_thread_notes` — append-only per-job thread; the `jobs_ledger_thread_note_stats` RPC feeds board previews.
- `job_schedule_blocks` — dispatch windows per assignee and `work_date` (4:00–20:00 Central, 30-minute minimum); `shared_block_group_id` ties linked legs so time/note stay in sync; jobs only (no `bid_id`).


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

**[ACCESS_CONTROL.md](./ACCESS_CONTROL.md) is authoritative for role permissions** — full per-role sections, the page-access matrix, feature matrices, and redirection rules. The per-role detail that used to live here had drifted (it predated estimator access to `/customers`, the controller role, and more); do not re-add it. One-line orientation:

- `dev` — full access; user management, impersonation, templates. `claim_dev_with_code` is break-glass only since v2.706 (refused while a usable dev exists; attempts audited in `claim_dev_attempts`).
- `master_technician` — owns customers/projects; adopts assistants and shares with other masters (Settings → People & accounts).
- `assistant` — assistant-level access to adopting masters' data; no financial totals.
- `controller` — assistant-like plus `has_payroll_access()` (costs without pay admin).
- `subcontractor` — assigned stages/jobs only.
- `helpers` — subcontractor-like; cannot send jobs to billing.
- `estimator` — bids/materials/estimates specialist; optional per-service-type restriction (`estimator_service_type_ids`).
- `primary`, `superintendent` — field-leadership roles; see their ACCESS_CONTROL.md sections.

Prefer capability helpers (`is_dev()`, `is_assistant()`, `has_payroll_access()`) over per-role checks — see [ADDING_A_NEW_ROLE.md](./ADDING_A_NEW_ROLE.md).

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

One paragraph per surface: what it is, its main tables, and where the depth lives. **Do not add feature detail here** — per-version history belongs in [RECENT_FEATURES.md](./RECENT_FEATURES.md) (grep it) and per-surface mechanics belong in the linked specialist doc. Role gates for every surface: [ACCESS_CONTROL.md](./ACCESS_CONTROL.md).

### 1. Customer Management
`Customers.tsx` — customer list with search, create/edit (assistants and devs pick an owning master; masters own their own; estimators may create with a master assigned), Quick Fill paste-import, clickable contact/map icons, per-row lifetime value + "$ Top customers" sort (`?sort=value`, v2.1780), delete (master/dev only). Clicking a name opens the Customer Hub; the ✎ pencil opens the edit modal. Tables: `customers` (`contact_info` JSONB, `date_met`, `master_user_id` owner). History: grep RECENT_FEATURES.md for "customer".

### 1a. Customer Hub
`CustomerDetail.tsx` at `/customers/:id` (Customer Hub train, v2.1775–v2.1780) — the dedicated page per customer, tab in `?tab=`: **Profile** (money strip — lifetime value/open balance + aging/pays-in/estimates won — open-jobs panel, Activity feed of all job events with Money/Jobs/Notes filters), **Estimates**, **Jobs** (full history incl. paid, payment progress bars), **Invoices** (all `jobs_ledger_invoices` across their jobs with channel/status/aging and a reconciled lifetime footer). Read surface — mutations go through the existing Job Detail / Bill Customer / Pipeline flows. Kernels: `src/lib/customers/` (`customerProfileStats`, `customerActivityFeed`, `customerInvoiceRows`, `customersListLcv` — all unit-tested). The quick-peek `CustomerProfileModal` (v2.1322) shares the same fetch + stats kernels.

### 2. Project Management
`Projects.tsx` — three tabs: **Overview** (project list with color-coded stage summary and card-rail pills linking jobs/bids/estimates), **Job History** (`?tab=job-history` — Gantt of working jobs from approved clock sessions, Expanded/Compact lane packing, per-day crew-count cells with a day-detail modal), and **Forecast** (`?tab=forecast` — forward-looking stage Gantt from `project_workflow_steps` scheduled + actual dates, Specific and All Steps sub-tabs, drag editing, `%` complete). Tables: `projects`, `project_workflows`, `project_workflow_steps`. Depth: [PROJECTS_FORECAST_TABS_ARCHITECTURE.md](./PROJECTS_FORECAST_TABS_ARCHITECTURE.md) (Forecast → Specific map); history: RECENT_FEATURES.md v2.548–v2.562.

### 3. Workflow Management
`Workflow.tsx` (~4.8k lines) at `/workflows/:projectId` — the stage-by-stage project interface: step cards with status actions (Set Start / Complete / Approve / Send Back / Re-open), roster-autocomplete assignment, expected dates + `%` complete (feeds Projects → Forecast), tech/office notes, line items with PO and supply-house-invoice links, projections-vs-ledger financials, per-step action ledger, and notification subscriptions. Tables: `project_workflow_steps`, `workflow_step_line_items`, `workflow_projections`, `project_workflow_step_actions`, `step_subscriptions`. Depth: [WORKFLOW_PAGE_ARCHITECTURE.md](./WORKFLOW_PAGE_ARCHITECTURE.md), [WORKFLOW_FEATURES.md](./WORKFLOW_FEATURES.md); per-role behavior: ACCESS_CONTROL.md.

### 4. Template System
`Templates.tsx` (dev-only) — CRUD for workflow templates and their ordered steps; templates seed workflows at project creation. Tables: `workflow_templates`, `workflow_template_steps`.

### 5. People Roster
`People.tsx` — 15 tabs: Users (roster + accounts), Hours (timesheet grid, clock-session approval, pay tools), Payroll (`?tab=pay_stubs`), Review (dev analytics + Team Summary), Overhead, Teams, Employment, Offsets, Vehicles, Housing, Licenses, Contracts, Write-ups, Feedback, Activity. Tables: `people` (+`account_user_id` login link), `people_pay_config`, `people_hours`, `people_crew_jobs` / `people_crew_bids`, `clock_sessions`, the `pay_stubs` family, `hours_reviewed`, `people_teams`. Identity is `person_id`-keyed; name text is legacy ([PERSON_IDENTITY_PLAN.md](./PERSON_IDENTITY_PLAN.md)). Depth: [PEOPLE_TABS_ARCHITECTURE.md](./PEOPLE_TABS_ARCHITECTURE.md) (page map), [PEOPLE_REVIEW_TAB_ARCHITECTURE.md](./PEOPLE_REVIEW_TAB_ARCHITECTURE.md), [PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md](./PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md), [SALARY_CLOCK_SESSIONS.md](./SALARY_CLOCK_SESSIONS.md) (salary semantics, 8/0 rule), [CREW_PNL_DATA_FLOW.md](./CREW_PNL_DATA_FLOW.md), [TIME_AND_ZONES.md](./TIME_AND_ZONES.md).

### 6. Jobs Page
`Jobs.tsx` — the jobs pipeline. Tabs: Reports | **Pipeline** (the Stages board, default) | Billing | Team Labor | Sub Labor | Crew P&L (dev) | Parts | Job Summary | Inspections. Jobs move waiting → working → ready_to_bill → billed → paid; billing runs through the Bill Customer modal (Stripe hosted invoice / HouseCall Pro record-only / Physical PDF + email). Tables: the `jobs_ledger` family (see [Jobs Ledger Family](#jobs-ledger-family-summary)), `people_labor_jobs` (+items) for Sub Labor, `inspections`. Depth: [JOBS_TABS_ARCHITECTURE.md](./JOBS_TABS_ARCHITECTURE.md) (page map), [JOBS_STAGES_TAB_ARCHITECTURE.md](./JOBS_STAGES_TAB_ARCHITECTURE.md), [JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md), [JOBS_MODALS_ARCHITECTURE.md](./JOBS_MODALS_ARCHITECTURE.md) (Sub Labor form + Job Detail), [JOB_FORM_MODAL_ARCHITECTURE.md](./JOB_FORM_MODAL_ARCHITECTURE.md) (New/Edit Job), [BILLING_FLOWS.md](./BILLING_FLOWS.md) + [SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md](./SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md) (billing), [SCHEDULE_DISPATCH_ARCHITECTURE.md](./SCHEDULE_DISPATCH_ARCHITECTURE.md) (dispatch + schedule blocks).

### 6a. Job Parts Tally
`JobTally.tsx` at `/tally` — field parts entry per job, fixture-only send-to-office pricing, and the Transactions tab (linked Mercury debit-card purchases with job-split assignment; a clock-out gate nags unlinked ones). Depth: [JOB_TALLY_ARCHITECTURE.md](./JOB_TALLY_ARCHITECTURE.md).

### 6b. Quickfill
`Quickfill.tsx` at `/quickfill` — the office daily loop: ordered sections (warnings, hours approval, banking sorting, crew jobs/bids, billing reminders, schedule, prospects, inboxes, and more), each with "mark up to date" tracking in `quickfill_section_marks` (+ `quickfill_section_mark_events`). Depth: [QUICKFILL_ARCHITECTURE.md](./QUICKFILL_ARCHITECTURE.md). **Field photos → Drive** (v2.2300, [`QuickfillFieldPhotoHandoverSection`](../src/components/quickfill/QuickfillFieldPhotoHandoverSection.tsx)): Quick Estimate field photos waiting in the `estimate-field-photos` bucket, grouped per estimate oldest-first — the office downloads them, files them in the customer's Google Drive folder, and pastes the folder link, which records `estimate_photo_handover` and deletes the photos from app storage (kernel [`fieldPhotoHandover.ts`](../src/lib/quickfill/fieldPhotoHandover.ts)).

### 6c. Moneyfill
`Moneyfill.tsx` at `/moneyfill` (dev + controller only) — financial queues worked to zero (bank-transfer attribution), kept off the assistants' daily loop. History: RECENT_FEATURES.md v2.1378.

### 7. Calendar View
`Calendar.tsx` — month grid of the signed-in user's assigned stages, bids and prospect callbacks, planned dispatch blocks, recorded clock time, and salaried-workday / time-off layers, plus the My Day single-day card. All times Central. Tables read: `project_workflow_steps`, `job_schedule_blocks`, `clock_sessions`, `user_time_off`, `salary_work_schedule_templates`. Depth: [CLOCK_SURFACES_ARCHITECTURE.md](./CLOCK_SURFACES_ARCHITECTURE.md), [SALARY_CLOCK_SESSIONS.md](./SALARY_CLOCK_SESSIONS.md); history: grep RECENT_FEATURES.md (v2.558 wave).

### 8. Dashboard
`Dashboard.tsx` — the role-adaptive home: Clock In/Out with unified job/bid search and dispatch quick-picks, the team clock strip (approve / assign / My-Time day editor), Ready to Bill / Billed lists for staff, assigned- and superintendent-job cards, My Bids, inbox cards, alert banners (stale tally, unallocated deposits, lost-bid reasons), and the Job Mode / Dispatch Mode phone shells. Tables: `clock_sessions`, `jobs_ledger` (via RPCs), `user_dashboard_goals`, checklist tables. Depth: [DASHBOARD_SECTIONS_ARCHITECTURE.md](./DASHBOARD_SECTIONS_ARCHITECTURE.md) (section map), [MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md](./MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md), [CLOCK_SURFACES_ARCHITECTURE.md](./CLOCK_SURFACES_ARCHITECTURE.md).

### 9. Settings
`Settings.tsx` — grouped tabs (Your account, Dashboard & alerts, People & accounts, Email & notifications, Data & migration, Jobs & dispatch, Catalogs & trades, Templates & testing, Advanced, Guides, Release notes): profile, adoption/sharing, user management (dev), email templates, org toggles in `app_settings`, and My email schedule ([REPORT_SUBSCRIPTIONS.md](./REPORT_SUBSCRIPTIONS.md)). Depth: [SETTINGS_TABS_ARCHITECTURE.md](./SETTINGS_TABS_ARCHITECTURE.md).

### 10. Notifications
Workflow step-change emails: per-step flags plus `step_subscriptions`, sent non-blocking by the `send-workflow-notification` edge function using `email_templates` (variables like `{{project_name}}`, `{{stage_name}}`); recipients matched from `people`/`users`. Depth: [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md); scheduled report/email streams are a separate system: [REPORT_SUBSCRIPTIONS.md](./REPORT_SUBSCRIPTIONS.md).

### 11. Materials Management
`Materials.tsx` — tabs: Supply Houses (AP invoices) | PO Generator | Price Book | Assembly Book | Templates & POs | Purchase Orders. Tables: `material_parts`, `material_part_prices` (+ history via the `track_price_history()` trigger), `material_templates` (+items, nestable), `purchase_orders` (+items), `supply_houses`, `supply_house_invoices`, `material_po_generator_entries` — schema details above under Materials Management Tables. Depth: [MATERIALS_TABS_ARCHITECTURE.md](./MATERIALS_TABS_ARCHITECTURE.md).

### 12. Action History & Audit Trail
`project_workflow_step_actions` — append-only ledger of step state changes (who, when, action type, notes), rendered on each Workflow step card. Deletion capture is a separate system — see §19.

### 13. Bids Management
`Bids.tsx` — the estimating pipeline: Bid Board, Followup, Unsent/Working Kanban, Counts → Takeoff → Cost Estimate → Pricing (price-book versions, margins) → Cover Letter → Submission, plus RFI / Change Order / Lien Release. **[BIDS_SYSTEM.md](./BIDS_SYSTEM.md) is the authoritative doc** for all tabs, workflows, and integrations; component maps: [BIDS_TABS_ARCHITECTURE.md](./BIDS_TABS_ARCHITECTURE.md), [BIDS_TAKEOFF_TAB_ARCHITECTURE.md](./BIDS_TAKEOFF_TAB_ARCHITECTURE.md), [BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md](./BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md), [BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md](./BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md). Core tables: `bids`, `bids_count_rows`, `bids_submission_entries`, `cost_estimates` (+labor rows), `price_book_versions`/`price_book_entries`, `bid_pricing_assignments` — schema details above under Bids Management Tables.

### 14. Integration Features
Clickable addresses (Google Maps), `mailto:`/`tel:` links, and `#step-{id}` deep links into Workflow — used across Dashboard, People, and step cards.

### 15. Banking (`/banking`)
`Banking.tsx` — Mercury (Ledger, User Sort, Drag Sort accounting labels, Accounting rules/suggestions) and Stripe (Invoices, Data) products; org-wide label and rule tables (`mercury_drag_sort_labels`, `mercury_accounting_label_rules`), transaction attribution, and job splits. Depth: [BANKING_TABS_ARCHITECTURE.md](./BANKING_TABS_ARCHITECTURE.md); capability grants: ACCESS_CONTROL.md → Banking attributors.

### 16. Map (`/map`)
`Map.tsx` — Leaflet map of jobs/bids/estimates with a geocode cache (`address_geocodes`, `geocode-address-batch` edge function), polygon draw, and a geocode review modal. Access: dev / master / assistant / estimator. History: grep RECENT_FEATURES.md for "Map".

### 17. Prospects (`/prospects`)
- **Page**: [`Prospects.tsx`](../src/pages/Prospects.tsx) with two top-level tabs:
  - **Customers** — the sales-lead pipeline, with sub-tabs **Follow Up**, **Prospect List**, **Convert**, and **Activity** (renamed from **Team** in v2.708; per-user/per-day marked+updated activity tables). Lead warmth, fit status (`prospect_fit_status`), callbacks, and copy templates feed the Calendar and the Quickfill **Prospects** section.
  - **Team** — the **prospective-hires board** ([`TeamProspectsTab`](../src/components/prospects/TeamProspectsTab.tsx)): candidate cards in `team_prospects` with roles in `team_prospect_roles` (`20260717190000`, `20260717230000`), including per-source success tracking (v2.715). Access is per-user via `users.team_prospects_access` (`20260717250000_team_prospects_access_flag.sql`, helper `user_has_team_prospects_access()`, v2.714) — prospects-staff role alone is not enough.
- See [ACCESS_CONTROL.md](./ACCESS_CONTROL.md), [PROSPECTS_TABS_ARCHITECTURE.md](./PROSPECTS_TABS_ARCHITECTURE.md), and [RECENT_FEATURES.md](./RECENT_FEATURES.md) (v2.708–v2.715) for details.

### 18. Read-only training mode
- A dev can flag any user `users.read_only` (Settings → Active Accounts → **Read-only**, any role since v2.704; nobody can flag or clear their own account). The user browses everything their role can see, but all writes are blocked.
- Enforcement is two layered, idempotent helpers that migrations re-run after CREATE TABLE: `apply_read_only_write_blocks()` (restrictive RLS policies; `20260713090000_read_only_training_mode.sql`) and `apply_read_only_stmt_blocks()` (`read_only_block_stmt` statement trigger that also stops SECURITY DEFINER RPCs; `20260717000000_read_only_all_roles_and_rpc_block.sql`).
- Anonymous public flows (estimate/contract accept) are unaffected — `is_read_only()` is false without a JWT. See [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) → Read-only training mode.

### 19. Deleted-records archive, restore, and bulk-deletion alerts
- **Archive**: `deleted_records_archive` captures every deleted row (payload, `deleted_by`, `deleted_at`, `table_name`, `group_key` bundling a cascade into one logical deletion) across ~83 covered tables. Migrations `20260716120000` (core), `20260716150000` (bids coverage), `20260716230000` (tier 2), `20260717210000` (people).
- **Restore**: `list_deleted_records()` / `restore_deleted_records()` RPCs power the dev "Recently deleted" UI with one-click restore, including FK-cycle handling (`20260716180000_deleted_records_restore.sql`, `20260716210000_deleted_records_restore_fk_cycles.sql`).
- **Alerts**: `list_bulk_deletion_alerts()` (`20260717120000_bulk_deletion_alerts.sql`) is a read-side aggregate over the archive that surfaces deletion bursts (measured in bundles, not rows) on the dev dashboard.
- See [MIGRATIONS.md](./MIGRATIONS.md) and [RECENT_FEATURES.md](./RECENT_FEATURES.md) (v2.695–v2.704) for details.

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
│   │   ├── People.tsx          # People roster (Users, Hours, Payroll + other tabs — pay tools live in Hours; cost matrix retired)
│   │   ├── Jobs.tsx           # Jobs (Reports, Stages, Billing, Team Labor, Sub Labor, Crew P&L, Parts, Job Summary, Inspections)
│   │   ├── Map.tsx            # Map: jobs/bids/estimates on Leaflet + address_geocodes (dev / master / assistant / estimator)
│   │   ├── ProjectNewGate.tsx # Create project (gate)
│   │   ├── ProjectEditGate.tsx # Edit project (gate)
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
- **Most complex page** (~4,800 lines)
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
- Apply migrations ONLY with `supabase db push`, and only after the migration file is on `main` (or in the PR merging right now). Never apply DDL via Supabase MCP `apply_migration`, `execute_sql`, or the dashboard SQL editor — all three cause ledger drift (see CLAUDE.md / AGENTS.md for the full rule and the 2026-07-04 ledger-rewrite history)
- Every new migration starts with `SET lock_timeout = '3s';` (CI-enforced) — there is no staging; DDL runs against prod while crews use the app
- Migrations that CREATE TABLE must end with both `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();` so read-only (training-mode) users can't write to the new table
- Number new migrations from `origin/main`'s latest file (`git ls-tree origin/main supabase/migrations/ | tail`), not from your branch
- Write migrations idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) and additive when possible; check ledger alignment with `npm run check:migration-drift`

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
- **Location**: `supabase/archive/migrations-pre-baseline/20260211210000_allow_devs_update_delete_people.sql`
- **What it does**: Adds UPDATE and DELETE policies for `people` using `is_dev()`, enabling devs to manage names, email, phone, notes and delete entries in Settings → People Created by Other Users

##### `create_counts_fixture_groups`
- **Purpose**: Configurable quick-select groups for adding count rows in Bids
- **Location**: `supabase/archive/migrations-pre-baseline/20260211200000_create_counts_fixture_groups.sql`
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
- `src/types/database.ts` is generated by the Supabase CLI — do not hand-edit it
- After a schema change, regenerate with `npm run gen-types:local` (local shadow DB) or `npm run gen-types:linked` (linked prod project)

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
- `index.html` - Inline script (before the app bundle) restores the route after **Hard Reload** / **force reload**: those flows save the current URL to `sessionStorage` and load **`/?nocache=…`** so GitHub Pages serves the shell with a **200**; see [`src/lib/hardReload.ts`](../src/lib/hardReload.ts) and [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) (SPA document-404 note)

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

### 10. Modal scroll lock — automatic, opt-out (v2.2186)

The page behind any modal, sheet, or dialog is frozen **app-wide without per-modal code**. [`BodyScrollLockSentinel`](../src/components/BodyScrollLockSentinel.tsx) (mounted once in `Layout`) watches the DOM and, while [`findBlockingOverlays`](../src/lib/blockingOverlay.ts) finds a `position: fixed` layer covering ≥ 90% of the viewport, holds the reference-counted iOS-safe lock in [`bodyScrollLock.ts`](../src/lib/bodyScrollLock.ts) (`body { position: fixed; top: -scrollY }`, scrollbar-width compensation, exact scroll restore on the last release). Stacked modals just work.

- **Writing a modal:** nothing to do — a fixed, viewport-covering backdrop is detected. Give the panel `role="dialog"` (+ `aria-modal="true"`) anyway: it's the explicit signal and the a11y-correct one.
- **Opting a modal out** (let the page scroll behind it): `data-page-scroll="allow"` on the overlay (or any ancestor of the dialog).
- **Freezing without an overlay** (e.g. the roadmap's CSS fullscreen): `useBodyScrollLock(true)` — refcounted with the sentinel, so both coexist.
- Don't hand-roll `document.body.style.overflow = 'hidden'` — it doesn't hold on iOS Safari; the three historical copies were retired in v2.2186.


---

## Known Issues & Gotchas

### 1. RLS Policy Recursion
- **Issue**: Policies that query `public.users` can cause infinite recursion or performance issues
- **Solution**: Use `public.is_dev()` function instead of direct queries
- **Examples**: 
  - `is_dev()` is used in `email_templates` table policies
  - `is_dev()` is used in `people` table policies (for devs to read all entries)
  - All new policies should use `is_dev()` function pattern

### 2. Updating Functions Used by RLS Policies
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

### 3. RLS Policy Recursion Prevention
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

### 4. Character Encoding in Workflow
- **Issue**: Special characters (↓, ·, …, ←, –) display as "?"
- **Solution**: Use Unicode escapes: `{"\u2193"}` or ASCII alternatives

### 5. Foreign Key Deletion Order
- **Issue**: Deleting parent records fails if children exist
- **Solution**: Always delete in dependency order:
  1. `step_subscriptions`
  2. `project_workflow_steps`
  3. `project_workflows`
  4. `projects`
  5. `customers`

### 6. Edge Function CORS
- **Issue**: Edge Functions can fail with CORS errors
- **Solution**: All Edge Functions explicitly set CORS headers:
  ```typescript
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  ```

### 7. Edge Function JWT Validation
- **Issue**: Gateway JWT validation can fail on GitHub Pages
- **Solution**: Use `verify_jwt: false` and validate internally:
  ```typescript
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  // Extract token and validate
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  ```

### 8. Environment Variables in Build
- **Issue**: Missing env vars cause runtime errors
- **Solution**: GitHub Actions workflow validates secrets before build
- **Note**: Values must be set in repository secrets

### 9. People Deduplication
- **Issue**: Same person appears twice if they exist in both `people` and `users`
- **Solution**: Filter `people` entries where `email` matches a `user.email`

### 10. Impersonation Session Storage
- **Issue**: Original session lost during impersonation (e.g. when reload occurs after Global Reload or new version)
- **Solution**: Store original session in `localStorage` before impersonating (persists across reloads)
- **Key**: `'impersonation_original'`

### 11. TypeScript Type Updates
- **Issue**: Database types can become out of sync
- **Solution**: Manually update `src/types/database.ts` when schema changes

### 12. RLS Policy for Assistant Step Updates
- **Issue**: Assistants getting 400 errors when updating workflow steps (especially when changing `assigned_to_name`)
- **Root Cause**: `WITH CHECK` clause in `project_workflow_steps` UPDATE policy was too restrictive - only allowed assistants to update steps where `assigned_to_name` matched their name, preventing assignment changes
- **Solution**: Updated `optimize_rls_for_master_sharing.sql` migration to include `can_access_project_via_workflow(workflow_id)` check in `WITH CHECK` clause, allowing assistants to update any step in workflows they can access (via adoption/sharing)
- **Migration**: `supabase/archive/optimize_rls_for_master_sharing.sql` (updated UPDATE policy)
- **Future**: Consider Supabase CLI type generation

### 13. Materials Price Book - Missing Prices in Expanded Row (RESOLVED 2026-02-04)
- **Was**: prices beyond Supabase's default 1,000-row limit were silently cut off when `loadParts()` fetched every part's prices in one query.
- **Fix**: per-part price loads (`Promise.all` + `.eq('part_id', …)`). Kept as a one-line reminder: unbounded cross-table fetches hit the 1,000-row default silently.

### 14. GitHub Pages MIME Types
- **Issue**: Module scripts fail with wrong MIME type
- **Solution**: `public/.nojekyll` prevents Jekyll from interfering
- **Note**: GitHub Pages must be configured to use "GitHub Actions" as source, not a branch

### 15. Refresh Token Errors
- **Issue**: Console errors for invalid refresh tokens on login screen
- **Solution**: Errors are handled gracefully in `useAuth` hook - invalid tokens are cleared automatically
- **Note**: These errors are harmless and indicate user needs to sign in again

### 16. Magic Link Authentication Handling
- **Issue**: Magic links from "imitate" feature redirect with tokens in URL hash but weren't being processed
- **Solution**: Added `AuthHandler` component in `App.tsx` that detects `type=magiclink` tokens in URL hash, sets session, and redirects to dashboard
- **Implementation**: Extracts `access_token` and `refresh_token` from hash, calls `supabase.auth.setSession()`, clears hash, and navigates
- **Files Modified**: `src/App.tsx` - Added AuthHandler component, `src/pages/Settings.tsx` - Fixed redirect URL construction

### 17. TypeScript Strict Mode
- **Issue**: TypeScript errors for potentially undefined values
- **Solution**: Always check for undefined before accessing array elements, use non-null assertions (`!`) when type narrowing guarantees existence
- **Common Patterns**:
  - Check array indices: `if (parts[index] && parts[index])`
  - Use destructuring with validation: `if (dateMatch && dateMatch[1] && dateMatch[2])`
  - Wrap function calls in arrow functions for event handlers: `onClick={() => openAddStep()}`

### 18. Current Stage Position Display
- **Issue**: Projects page showed invalid positions like "[16 / 13]" when using raw `sequence_order` values
- **Solution**: Calculate position by finding step's index in sorted list, then add 1 (1-indexed)
- **Implementation**: `Projects.tsx` sorts steps by `sequence_order` and finds index position instead of using raw value
- **Result**: Always shows correct position relative to total steps, regardless of sequence_order gaps or non-sequential values

### 19. Users Table RLS Recursion
- **Issue**: Policies on `users` table that query `users` or `master_assistants` (which queries `users`) cause infinite recursion errors
- **Solution**: Use `SECURITY DEFINER` functions to bypass RLS when checking relationships
- **Example**: `master_adopted_current_user()` function uses `SECURITY DEFINER` to check `master_assistants` without triggering RLS
- **Migration**: `supabase/archive/fix_users_rls_for_project_masters.sql`
- **Result**: Assistants can now see master information (name/email) when viewing projects without recursion errors
- **Master Sharing**: Similar pattern used for `master_shares` table - RLS policies check for sharing relationships without recursion

### 20. Line Items RLS Timeout
- **Issue**: Loading line items causes statement timeout errors (500 Internal Server Error)
- **Solution**: Created `can_access_project_via_step()` helper function to optimize RLS policies
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS, performs single optimized query
- **Migration**: `supabase/archive/optimize_workflow_step_line_items_rls.sql`
- **Result**: Line items load quickly without timeout errors

### 21. Step Actions RLS Errors
- **Issue**: Recording workflow actions causes 403 Forbidden or 500 Internal Server Error
- **Solution**: Created `can_access_step_for_action()` helper function to optimize RLS policies
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS, checks step access efficiently
- **Migration**: `supabase/archive/fix_project_workflow_step_actions_rls.sql`
- **Result**: Actions can be recorded successfully without errors

### 22. Workflow Data Persistence Issues
- **Issue**: Projections and workflow steps (cards) not persisting when navigating away and back to a project
  - Symptoms: Added projections/steps disappear on first navigation back, but appear on subsequent visits
  - Root Cause: Race condition where `workflow?.id` from React state was `null` during immediate save operations
- **Solution**: Modified `saveProjection`, `deleteProjection`, `saveStep`, `refreshSteps`, `createFromTemplate`, and `copyStep` to always obtain a valid `workflowId` by calling `ensureWorkflow(projectId)` if state is null
- **Implementation**: All save/delete operations now check for `workflow?.id` and fall back to `ensureWorkflow(projectId)` if needed
- **Files Modified**: `src/pages/Workflow.tsx`
- **Result**: Projections and steps now persist correctly on first navigation back

### 23. Concurrent Workflow Creation
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

### 24. Redundant loadSteps Calls
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

### 25. TypeScript Type Errors: string | null vs string | undefined
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
1. **Type Generation**: ✅ Resolved — `src/types/database.ts` is generated via `npm run gen-types:local` / `gen-types:linked` (Supabase CLI)
2. **Error Handling**: Some errors are only logged to console
   - **Solution**: Centralized error handling/toast system
3. **Styling**: Inline styles make maintenance difficult
   - **Solution**: Consider CSS modules or Tailwind
4. **Testing**: ~440 `*.test.ts(x)` files run via vitest (`npm test`); repo convention is to extract logic into pure `.ts` kernels with unit tests as the primary pattern, plus component render smokes (`*.render.test.tsx`, jsdom + `renderWithProviders` from `src/test/renderSmokeMocks.tsx`)
5. **Edge Function Error Messages**: Inconsistent error format
   - **Solution**: Standardize error response format

### Database Considerations
- **Indexes**: Review query patterns and add indexes for performance
- **Archiving**: Implemented — `deleted_records` archives deletes with restore RPCs (six migrations 2026-07-16/17: `20260716120000_deleted_records_archive.sql` through `20260717210000_deleted_records_archive_people.sql`); see the Deleted-records section under Key Features
- **Audit Trail**: Partially implemented — `deleted_records` (who deleted what, when, with payload), `bulk_deletion_alerts` (`20260717120000`), and `claim_dev_attempts` (claim-dev attempt audit, `20260717150000`); plus the long-standing `project_workflow_step_actions` action history

### Security Considerations
- **Admin Code**: DEV_PROMOTION_CODE Supabase secret (claim-dev Edge Function) — break-glass only since `20260717150000_claim_dev_break_glass.sql` (refused while a usable dev exists; audited)
- **Rate Limiting**: No rate limiting on Edge Functions
- **Input Validation**: Some user inputs not validated (e.g., email format)
- **SQL Injection**: RLS policies use parameterized queries (safe), but be cautious with dynamic SQL

### Performance Optimizations
- **Data Fetching**: Some pages fetch all data upfront (consider pagination)
- **Real-time**: Supabase Realtime used across the app; **v2.454** reduced REST storms from **`postgres_changes`** on busy surfaces — **`useDocumentVisibility`** ([`src/hooks/useDocumentVisibility.ts`](../src/hooks/useDocumentVisibility.ts)); debounced **`financialRefreshKey`** for Dashboard financial pins ([`Dashboard.tsx`](../src/pages/Dashboard.tsx)); **`clock_sessions`** filters **`user_id=in.(…)`** + debounce on team strip ([`useDashboardMyTeamSectionState.ts`](../src/hooks/useDashboardMyTeamSectionState.ts)), debounced + optional filter on People Hours ([`People.tsx`](../src/pages/People.tsx)), visibility-gated Mercury refetch ([`Banking.tsx`](../src/pages/Banking.tsx)). See **`RECENT_FEATURES.md`** **v2.454**. Earlier summary: `people_hours`, `clock_sessions`, `user_pinned_tabs`, `force-reload`.
- **Caching**: No client-side caching (consider React Query)

---

## Quick Reference

### User Roles (9 — see [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) for the authoritative matrix)
- **dev**: Full access, user management, templates
- **master_technician**: Create/manage projects, customers, workflows
- **assistant**: Create/edit projects, view/update workflows (assigned stages only), full access to Bids
- **subcontractor**: Dashboard and Calendar only
- **estimator**: Bids + Materials focused; no Customers/Projects/People
- **primary**: Materials, Jobs Reports, bid documents (RFI/CO/Lien Release)
- **superintendent**: Runs assigned projects; manages subs; no People page
- **helpers**: Subcontractor-like field role (`helpers_service_type_ids` scoping)
- **controller**: Assistant-like plus dev-level financial visibility (Payroll, wages)

### Key Routes
- `/map` - Staff map of job/bid/estimate addresses (**dev**, **master**, **assistant**, **estimator**; desktop **pin** / mobile **gear** per [`Layout.tsx`](../src/components/Layout.tsx); **Geoman** area filter + table **Filter**; **Debug** → **Review geocodes**; **`address_geocodes`**; chunked **`geocode-address-batch`** for cold addresses; see **Key Features** §16)
- `/dashboard` - User dashboard
- `/customers` - Customer list
- `/projects` - Project list
- `/workflows/:projectId` - Workflow management
- `/people` - People roster (Users, Hours, Payroll, and other tabs — no separate Pay tab, it merged into Hours; dev **Feedback** via `?tab=feedback`)
- `/jobs` - Jobs (Reports, Stages, Billing, Team Labor, Sub Labor, Crew P&L, Parts, Job Summary, Inspections tabs)
- `/accounts-receivable` - AR view sharing the Jobs list cache
- `/schedule-dispatch` - Schedule Dispatch hub / job-week grids
- `/banking` - Mercury banking (sorting, attributions)
- `/quickfill` - Quickfill daily-review sections
- `/moneyfill` - Moneyfill financial queues (dev + controller; v2.1378)
- `/calendar` - Calendar view
- `/materials` - Materials management (price book, templates, purchase orders)
- `/estimates` (+ `/estimates/:id`) - Customer estimates
- `/documents` - Documents page
- `/duplicates` - Duplicate materials cleanup (dev)
- `/bids` - Bids management (bid board, counts, takeoffs, cover letter, submission & followup)
- `/prospects` - Prospects (Customers pipeline + Team hiring board)
- `/checklist` - Checklist (Today, History, Review, Manage, Roadmap)
- `/tally` - Job parts tally
- `/help` - Help guides
- `/templates` - Template management (dev)
- `/settings` - User management (dev) and password change (all users)
- Public/entry routes: `/accept-invite`, `/task`, `/estimate/accept`, `/contract/accept`
- Full route list: [`src/App.tsx`](../src/App.tsx)

### Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `RESEND_API_KEY` - Resend API key (set as Supabase secret for Edge Functions)

### Edge Functions
There are **57** Edge Functions in `supabase/functions/` — see [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) for the full annotated reference (an inline list here goes stale). Frequently referenced examples:
- `create-user` - Manually create user; **role** must be one of the 9 valid roles: `dev`, `master_technician`, `assistant`, `subcontractor`, `helpers`, `estimator`, `primary`, `superintendent`, `controller`
- `invite-user`, `archive-user`, `restore-user`, `set-user-password`, `login-as-user` - Account lifecycle
- `claim-dev` - Break-glass dev promotion (audited; see Security Considerations)
- `send-workflow-notification`, `test-email` - Email

### Database Enums
- `user_role` (9 active values): `'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator' | 'primary' | 'superintendent' | 'helpers' | 'controller'` (legacy `'owner'`/`'master'` values remain in the enum but are unused)
- `project_status`: `'awaiting_start' | 'active' | 'completed' | 'on_hold'`
- `workflow_status`: `'draft' | 'active' | 'completed'`
- `step_status`: `'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved'`
- `step_type`: `'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null`
- `people.kind` (check constraint, not a separate enum type): includes `assistant`, `master_technician`, `sub`, `estimator`, `dev`, `primary`, `superintendent`, `helper`

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
