# PipeTooling Project Documentation

> **New to this project?** Start with [AI_CONTEXT.md](./AI_CONTEXT.md) for a 30-second overview, then return here for deep technical details.

---
file: PROJECT_DOCUMENTATION.md
type: Technical Reference
purpose: Complete technical documentation covering architecture, database schema, and development patterns
audience: Developers, AI Agents, Technical Staff
last_updated: 2026-02-20
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
  - "[TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - White screen, Supabase, sign-in"
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
- **Checklist**: Recurring checklist items (weekly by day(s), days-after-completion) with push notifications; items due today shown on Dashboard. **FWD (Forward)** (dev-only): Button/link on each task to forward it—edit title, assign to another user; creates new task and removes original. **Scheduled reminders** (dev-only): Per-item reminder time (CST) and scope (today only / today+overdue); pg_cron invokes `send-scheduled-reminders` every 15 minutes to notify assignees with incomplete tasks

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
  - Real-time subscriptions (people_hours for Pay/Hours sync; user_pinned_tabs for Dashboard pins; force-reload broadcast for Global Reload)

### Hosting
- **GitHub Pages** - Static site hosting
- **GitHub Actions** - CI/CD pipeline

### Key Dependencies
- `@supabase/supabase-js` - Supabase client library

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
  - `housecallpro_number` (text, nullable) - External system reference
  - `plans_link` (text, nullable) - URL to plans
  - `address` (text, nullable) - Project address (can differ from customer address)
  - `street_name` (text, nullable) - Street name (for future use)
  - `project_type` (text, nullable) - Project type (for future use)
- **RLS**: 
  - SELECT: Users can see projects they own OR projects from masters who adopted them
    - Assistants can see **all projects** from masters who adopted them (not just assigned stages)
    - Migration: `supabase/migrations/verify_projects_rls_for_assistants.sql` ensures correct policy
  - INSERT: Assistants, masters, and devs can create projects; project owner automatically matches customer owner
  - UPDATE: Assistants, masters, and devs can update projects they own or from masters who adopted them (project owner cannot be changed)
  - DELETE: Only devs and masters can delete projects
- **Special Features**: 
  - Address auto-fills from customer but can be overridden
  - Active stage displayed in project list
  - Project owner (master) displayed in project list and workflow page
  - **Project owner automatically matches customer owner** - cannot be changed or selected separately
  - Clicking project name navigates to workflow page (not edit page)

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

#### `public.people`
- **Purpose**: Roster of people (may or may not have user accounts)
- **Key Fields**:
  - `id` (uuid, PK)
  - `master_user_id` (uuid, FK → `users.id`)
  - `kind` (enum: `'assistant' | 'master_technician' | 'sub'`)
  - `name` (text)
  - `email` (text, nullable)
  - `phone` (text, nullable)
  - `notes` (text, nullable)
- **RLS**: Users can only see/manage their own roster entries; devs can see all entries and can update/delete any people (via `20260211210000_allow_devs_update_delete_people.sql`); shared access via `master_shares` (viewing master and their assistants can see shared people)

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
  - `memo` (text, required) - Description of the line item
  - `amount` (numeric(10, 2), required) - **Supports negative numbers** for credits/refunds
  - `purchase_order_id` (uuid, FK → `purchase_orders.id` ON DELETE SET NULL, nullable) - Link to purchase order if added from Materials
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
  - Assistants can view Ledger table but cannot see financial totals
- **Migrations**: 
  - `supabase/migrations/optimize_workflow_step_line_items_rls.sql` - RLS optimization
  - `supabase/migrations/add_link_to_line_items.sql` - Added link field
  - `supabase/migrations/add_purchase_order_to_line_items.sql` - Added purchase_order_id field

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
- **Migration**: `supabase/migrations/fix_project_workflow_step_actions_rls.sql`

### Database Functions

#### `public.handle_new_user()`
- **Trigger**: Fires on `auth.users` INSERT
- **Purpose**: Creates corresponding `public.users` record
- **Logic**: Checks `raw_user_meta_data.invited_role` to set initial role, defaults to `'assistant'`

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
- **Migration**: `supabase/migrations/fix_users_rls_for_project_masters.sql`

#### `public.can_access_project_via_step(step_id_param UUID)`
- **Returns**: `boolean`
- **Purpose**: Checks if the current user can access a project via a workflow step
- **Usage**: Used in `workflow_step_line_items` RLS policies to optimize performance
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS and avoid recursion
- **Migration**: `supabase/migrations/optimize_workflow_step_line_items_rls.sql`

#### `public.can_access_step_for_action(step_id_param UUID)`
- **Returns**: `boolean`
- **Purpose**: Checks if the current user can access a step for recording actions
- **Usage**: Used in `project_workflow_step_actions` RLS policies to optimize performance
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS and avoid recursion
- **Migration**: `supabase/migrations/fix_project_workflow_step_actions_rls.sql`

#### `public.claim_dev_with_code(code text)`
- **Returns**: `boolean`
- **Purpose**: Grants dev role if code matches `'admin1234'`
- **Usage**: Called from Settings page

#### `public.touch_last_sign_in()`
- **Trigger**: Fires on `auth.users` UPDATE when `last_sign_in_at` changes
- **Purpose**: Updates `public.users.last_sign_in_at`

#### `public.track_price_history()`
- **Trigger**: Fires on `material_part_prices` INSERT and UPDATE
- **Purpose**: Automatically logs price changes to `material_part_price_history` table
- **Logic**: 
  - Calculates `price_change_percent` from old and new prices
  - Handles INSERT (old_price is NULL) and UPDATE (old_price from OLD record) correctly
  - Records `changed_at` (current timestamp) and `changed_by` (current user)
- **Migration**: `supabase/migrations/create_price_history_trigger.sql`

#### `public.get_supply_house_price_counts()`
- **Returns**: Table of `(supply_house_id uuid, name text, price_count integer)`
- **Purpose**: Returns price coverage statistics for all supply houses
- **Usage**: Used in Supply Houses modal statistics section on Materials page
- **Logic**:
  - LEFT JOIN to include supply houses with zero prices
  - Counts prices per supply house
  - Sorted by `price_count DESC` (most prices first)
- **Migration**: `supabase/migrations/create_supply_house_stats_function.sql`
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
  - `created_at`, `updated_at` (timestamptz)
- **Initial Data**:
  - Plumbing (sequence_order: 1)
  - Electrical (sequence_order: 2)
  - HVAC (sequence_order: 3)
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
  - `notes` (text, nullable)
  - `created_at`, `updated_at` (timestamptz)
- **RLS**: Only devs and master_technicians can CRUD

#### `public.material_parts`
- **Purpose**: Parts catalog
- **Key Fields**:
  - `id` (uuid, PK)
  - `name` (text, required)
  - `manufacturer` (text, nullable)
  - `fixture_type` (text, nullable) - Predefined options (Fitting, Pipe, Drain, Sink, etc.)
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
  - `address` (text, nullable)
  - `gc_contact_name` (text, nullable) - Project contact person for this bid
  - `gc_contact_phone` (text, nullable) - Project contact phone for this bid
  - `gc_contact_email` (text, nullable) - Project contact email for this bid
  - `bid_due_date` (date, nullable)
  - `bid_date_sent` (date, nullable)
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
- **Migrations**: `create_bids.sql`, `add_bids_customer_id.sql`, `split_bids_project_name_and_address.sql`, `add_bids_estimated_job_start_date.sql`, `add_bids_gc_contact.sql`, `add_bids_estimator_id.sql`, `add_bids_loss_reason.sql`, `add_bids_outcome_started_or_complete.sql`, `allow_assistants_access_bids.sql`, `allow_estimators_access_bids.sql`

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
  └── project_workflows.project_id

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
  - Claim dev role with code `'admin1234'`

#### `master_technician`
- **Access**: Dashboard, Customers, Projects, People, Calendar, Settings
- **Master-Assistant Relationship**:
  - Can adopt assistants via checkboxes in Settings
  - Adopted assistants can access their customers and projects
  - Can see all assistants and manage adoptions
- **Can**: 
  - Create customers, projects, workflows, assign people
  - Automatically assigned as owner when creating customers
  - Projects automatically inherit customer owner (cannot be changed)
  - Update customer owner when editing
  - Adopt/unadopt assistants in Settings
  - See which assistants they have adopted
- **Cannot**: 
  - Change project owner (automatically matches customer owner)
  - Manage user roles, templates, or other users

#### `assistant`
- **Access**: Dashboard, Customers, Projects, People, Calendar
- **Master-Assistant Relationship**:
  - Masters can "adopt" assistants via checkboxes in Settings
  - Assistants can work for multiple masters (many-to-many relationship)
  - Assistants can only see customers/projects from masters who adopted them
- **Master-Sharing Relationship**:
  - Masters can "share" with other masters via checkboxes in Settings
  - Shared masters receive assistant-level access (can see but not modify, cannot see private notes/financials)
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
- **Dashboard** - Checklist items due today, Builder Review link; Send task (if dev/master/assistant)
- **Materials** - Full access to price book, parts, templates, purchase orders
- **Bids** - Full access to all Bids tabs and features
- **Calendar** - View calendar
- **Checklist** - Today, History, Manage tabs
- **Settings** - Change password, push notifications

##### Pages Blocked
- Customers, Projects, People, Templates
- **Layout redirects**: Attempts to access blocked pages redirect to `/bids`

##### Bids Capabilities

**Full Bids System Access**:
- All Bids tabs (Bid Board, Builder Review, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission & Followup). Builder Review: customers sorted by last contact (Oldest first / Newest first); PIA checkbox per customer excludes that customer when Oldest first is selected (stored per user in localStorage).
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

**Note**: Shared masters receive assistant-level access (can see but not modify, cannot see private notes/financials).

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
1. Dev/Master clicks "imitate" button in Settings
2. Frontend calls `login-as-user` Edge Function
3. Edge Function generates magic link for target user
4. Frontend stores original session in `localStorage` (key: `'impersonation_original'`) so it survives reloads
5. Browser redirects to magic link URL with tokens in hash
6. AuthHandler component processes tokens and sets session
7. User is redirected to dashboard as the target user
8. "Back to my account" button restores original session from `localStorage`

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
- **Features**:
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
    - Green for completed/approved, red for rejected, orange (bold) for in_progress, gray for pending
  - **Current Stage**: Shows active stage with progress `[current / total]` (e.g., `[3 / 5]`)
    - Rejected stages stop progress and are shown as current stage
  - **Click project name** to view workflow (removed redundant "Workflow" link)
  - **Empty state**: When filtering by customer, shows `**[Customer Name]** has no projects yet. Add one.`
- **Data**: Name, description, status, customer, master_user_id (project owner, matches customer owner), address, external references

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
  - **Workflow Header**: Shows all stage names with "→" separators, color-coded by status
    - Green: completed/approved
    - Red: rejected
    - Orange: in_progress (bolded)
    - Gray: pending
    - Clickable stage names scroll to specific step cards
  - Step cards displayed in sequence order
  - Each card shows full stage details, status, assigned person, and actions

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
  - Show contact info (email/phone) as clickable links next to name
  - Current user always appears first in assignment modal (highlighted with "(You)" label)
  - Excludes current user from roster list to prevent duplicates

**Step Status Actions**:
  - **Set Start**: Date/time picker modal to set custom start time (replaces immediate start)
    - Allows setting historical or future start times
    - Pre-filled with current date/time
  - **Complete**: Mark stage as finished (sets `ended_at` timestamp)
  - **Approve**: Owners/masters can approve with tracking (who approved, when)
  - **Reject**: Owners/masters can reject with reason notes
  - **Re-open**: Reopen completed/approved/rejected stages (resets status to pending)
    - Available for completed, approved, or rejected stages via "Re-open" button
    - Visible to devs, masters, and assistants (on Workflow page only)
    - Button appears inline with Edit and Delete buttons (bottom right of card)
    - Clears rejection reason, approval info, and next step rejection notices
    - Records 'reopened' action in action ledger
    - Sends notifications to subscribed users
  - **Step States**: `pending` → `in_progress` → `completed` / `rejected` / `approved`
  - **Time Tracking**: `started_at`, `ended_at` (shows "unknown" if null)

**Financial Tracking**:
  - **Line Items**: Track actual expenses/credits per stage
    - Fields: Link (optional URL), Memo (description), Amount (supports negative for credits/refunds)
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
    - Notify prior step assignee when current step is rejected (default: enabled)
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
    - **Testing Guide**: See [WORKFLOW_EMAIL_TESTING.md](./WORKFLOW_EMAIL_TESTING.md) for comprehensive testing scenarios

**Access Control**:
  - **Owners/Masters**: See all stages, full access to all features
  - **Assistants**: 
    - See ALL stages in workflows they have access to (via master adoption)
    - Can use Set Start, Complete, and Re-open on assigned stages
    - Can view and edit line items (but cannot see financial totals)
    - Cannot see private notes, projections, or financial totals
    - Cannot add, edit, delete, or assign stages
    - Notification settings: "ASSIGNED" column hidden, only "ME" column visible
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
- **Tabs**: **Users** (default), **Pay**, **Hours**
- **Features**:
  - List people by kind (Assistant, Master Technician, Subcontractor)
  - Add people without user accounts
  - Merge display of roster entries and signed-up users (deduplicated by email)
  - Show active projects per person
  - Invite roster entries as users (sends invitation email)
  - **Contact Integration**: 
    - Email addresses are clickable (opens email client)
    - Phone numbers are clickable (opens phone dialer)
  - Display shows "(account)" next to people who have user accounts; green dot indicates push notifications enabled (visible to devs, masters, assistants)
  - **Pay Tab** (dev, approved masters, or shared by dev): Due by Trade, Due by Team, Cost matrix with date range and "← last week" / "next week →" buttons; Teams for combined cost by date range (view-only for shared users); People pay config (collapsible, dev/approved only) for hourly wage, Salary, Show in Hours, Show in Cost Matrix; Share Cost Matrix and Teams (dev-only, in Settings) to grant view-only access to selected masters/assistants; Tag colors. Cost matrix date headers display on two lines (e.g. Mon / 2/16) on mobile (≤640px). **Realtime sync**: When any user updates hours in Hours tab, the Cost matrix updates automatically for all users viewing Pay—no refresh needed.
  - **Hours Tab** (dev, approved masters, assistants): Timesheet with day columns (editable HH:MM:SS for hourly; read-only for salary); per-person HH:MM:SS and Decimal total columns; two footer rows (Total HH:MM:SS, Total Decimal) with per-day sums and grand total. Subscribes to `people_hours` Realtime; refetches when another user changes hours.
  - **Master Shares**: When a Dev shares with another Master, that Master and their assistants see shared people; shared people show "Created by [name]" instead of Remove
- **Data**: Name, email, phone, notes, kind; people_pay_config (hourly_wage, is_salary, show_in_hours, show_in_cost_matrix); people_hours (person_name, work_date, hours); people_teams; cost_matrix_teams_shares (shared_with_user_id for view-only Cost matrix and Teams)
- **Note**: Labor and Sub Sheet Ledger (labor jobs) were moved to the **Jobs** page; see section 6.

### 6. Jobs Page
- **Page**: `Jobs.tsx`
- **Header**: "Jobs" title on the right of the tab bar (matches People page pattern)
- **Tabs** (in order): **Receivables** | **Labor** | **HCP Jobs** | **Sub Sheet Ledger** | Upcoming | Teams Summary
- **Features**:
  - **Receivables Tab**: Assistants enter Payer, Point Of Contact, Account Rep (Master or Sub from dropdown), Amount to Collect. AR total displayed at top. Add Payer button at bottom. Uses `jobs_receivables`; RLS mirrors jobs_ledger (dev, master, assistant; assistants see master's data).
  - **Labor Tab**: Add labor jobs; form fields: **User** (two lists—**Everyone else** [Masters, Assistants, Estimators, Devs] and **Subcontractors**; radio selection), Address, Job # (max 10 chars), Service type, Labor rate, Date; fixture rows (Fixture, Count, hrs/unit, Fixed); Save Job, Print for sub. Collapsible **Labor book** section: select version, apply matching labor hours to form rows; manage versions and entries (Rough In, Top Out, Trim Set hrs). Uses same roster (people + users) as People; helpers `rosterNamesEveryoneElse()` and `rosterNamesSubcontractors()`.
  - **Sub Sheet Ledger Tab**: Table of all labor jobs (User, Job #, Address, Labor rate, Total hrs, Total cost, Print for sub, Date); Edit opens modal (same User two-list picker); Delete removes job; date editable inline.
  - **HCP Jobs Tab**: Jobs ledger (HCP #, Job Name, Address, materials, team members, revenue); New Job, search; **Edit** and **Delete** per row, vertically centered in the row.
  - **Upcoming** and **Teams Summary**: Placeholder tabs (content coming soon).
- **Data**: Receivables use `jobs_receivables`; Labor/Sub Sheet Ledger use `people_labor_jobs`, `people_labor_job_items`; labor book uses `labor_book_versions`, `labor_book_entries`; service types and fixture types; HCP Jobs use `jobs_ledger`, `jobs_ledger_materials`, `jobs_ledger_team_members`.

### 7. Calendar View
- **Page**: `Calendar.tsx`
- **Features**:
  - Month-view calendar
  - Shows steps assigned to current user (by `assigned_to_name`)
  - **All dates/times displayed in Central Time (America/Chicago)**
  - **Two-line display**: Stage name (top, bold) and Project name (bottom, gray)
  - Color-coded by status
  - Links to workflow pages
  - Navigation (prev/next month, "Today")
  - **Access Control**: Assistants/subcontractors only see stages assigned to them

### 8. Dashboard
- **Page**: `Dashboard.tsx`
- **Layout**: No page title; content starts with pinned links and sections
- **Features**:
  - **Pinned Links** (from Settings or Layout Pin): Dev can pin AR, Supply Houses AP, External Team, and Cost matrix (Internal Team) to masters/devs dashboards. Pins show labels: "AR | $X,XXX", "Supply Houses: $X", "External Team: $X,XXX", "Internal Team: $X,XXX". Links navigate to Jobs Receivables, Materials Supply Houses, Materials External Team section, People Pay Cost matrix.
  - **User Role Display**: Shows current user's role
  - **How It Works** (Masters/Devs only): Explains system structure
    - PipeTooling helps Masters better manage Projects with Subs.
      Three types of People: Masters, Assistants, Subs
    - Master accounts have Customers
    - Customers can have Projects
    - Masters assign People to Project Stages
    - When People complete Stages, Masters are updated
  - **Sharing** (Masters/Devs only): Explains sharing features
    - Masters can choose to adopt assistants in Settings
      - → they can manage stages but not see financials or private notes
    - Masters can choose to share with other Masters
      - → they have the same permissions as assistants
  - **Subcontractors** (Masters/Devs only): Quick summary
    - Only see a stage when it is assigned to them
    - Can only Start and Complete their stages
    - Cannot see private notes or financials
    - Cannot add, edit, delete, or assign stages
    - When a Master or Assistant selects to Notify when a stage updates, that stage will show up in their Projects: Subscribed Stages below:
  - **Projects: Assigned Stages**: Lists all steps assigned to current user (by `assigned_to_name`)
    - Shows project name, stage name, status
    - Displays start/end times
    - Clickable project address opens Google Maps in new tab
    - Project links include hash fragment to scroll directly to step card
    - Shows project address and plans link if available
    - Displays notes and rejection reasons if present
    - Shows next step rejection notices if present
    - Action buttons: Set Start, Complete, Approve, Reject (based on role and status)
  - **Projects: Subscribed Stages**: Shows stages user has subscribed to (with notification preferences)
    - Links to projects and workflows
  - **My Notification History**: Expandable ledger of recent notifications (timestamp, title, channel badge, links to project/workflow/checklist)
  - **Recently Completed Tasks (7 days)**: Expandable section showing checklist items completed in the last 7 days, grouped by completer
  - **Performance**: Parallel fetches and progressive rendering with per-section loading flags; skeleton UI for Checklist, Assigned, Subscribed
  - **Checklist FWD (dev-only)**: Each checklist item shows a light grey "fwd" link on the far right; opens modal to edit title and assign to another user; creates new task and removes original
  - **Card Layout**: 
    - Format: "Stage name - Assigned person"
    - Project link below title
    - Status, start/end times displayed
    - Color-coded by status (green for approved/completed, red for rejected)

### 9. Settings
- **Page**: `Settings.tsx`
- **Layout/Navigation**:
  - **Gear menu** (top-right in Layout): Settings link (all users); Global Reload (dev-only, broadcasts reload to all connected clients via Supabase Realtime)
  - **Top button row** (Settings page): Sign out, Hard Reload (clears caches, reloads current user only), Change password
- **Features (All Users)**:
  - **Sign out**: At top of Settings page
  - **Hard Reload**: At top of Settings page; clears caches and reloads current user only
  - **Change Password**: Change your own password (requires current password verification)
- **Features (Masters and Devs)**:
  - **Adopt Assistants**: Checkbox list to adopt/unadopt assistants
    - Shows all assistants in the system
    - Checkbox indicates adoption status
    - Assistants can see which masters adopted them
    - Adopted assistants gain access to master's customers and projects
  - **Share with other Master**: Checkbox list to share/unshare with other masters
    - Shows all other masters in the system (excluding self)
    - Checkbox indicates sharing status
    - Shared masters receive assistant-level access (cannot see private notes or financials)
    - Viewing masters can see who has shared with them
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
  - View all people entries (not just own entries)
  - **Pin to Dashboard** (dev-only): Pin AR, Supply Houses AP, External Team, and Cost matrix (Internal Team) to masters/devs dashboards. Checkbox list of masters/devs, "Pin To Dashboard" and "Unpin All" buttons. Pins appear as shortcut links on the target user's Dashboard with live totals (AR | $X, Supply Houses: $X, External Team: $X, Internal Team: $X). Share Cost Matrix and Teams section moved from People Pay to Settings (below AR pin).
  - **Duplicate Materials** (`/duplicates`): Dev-only page for finding and removing duplicate material parts. Groups parts with 80%+ name similarity; shows Name, Manufacturer, Part Type, Service Type, Best Price, Supply House; filters by "Only show 100% name match" and service type (Plumbing, Electrical, HVAC); delete with type-to-confirm. Accessible via Settings → Duplicate Materials link.
  - **Data backup (dev)**: Export projects, materials, or bids as JSON for backup
    - "Export projects backup" downloads customers, projects, workflows, steps, step actions, subscriptions, line items, projections
    - "Export materials backup" downloads supply houses, material parts, part prices, material templates, template items
    - "Export bids backup" downloads bids, bids_gc_builders, bids_count_rows, bids_submission_entries, cost_estimates, cost_estimate_labor_rows, fixture_labor_defaults, bid_pricing_assignments, price_book_versions, price_book_entries, labor_book_versions, labor_book_entries, takeoff_book_versions, takeoff_book_entries, purchase_orders, purchase_order_items
    - Filenames include date (e.g. `projects-backup-2026-01-26.json`). Exports respect RLS.

### 10. Notifications
- **System**: `step_subscriptions` table + step-level flags + `send-workflow-notification` Edge Function
- **Features**:
  - **Two Subscription Types**:
    - **Assigned person**: Notify when step started/complete/re-opened (stored on step as `notify_assigned_when_*`)
    - **Current user (ME)**: Notify when step started/complete/re-opened (stored in `step_subscriptions`)
  - **Cross-Step Notifications**:
    - Notify next step assignee when current step is completed or approved (default: enabled)
    - Notify prior step assignee when current step is rejected (default: enabled)
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
  - **Step Rejected**: Sends `stage_prior_rejected` to prior step assignee
  - **Step Reopened**: Sends `stage_assigned_reopened` to assigned person, `stage_me_reopened` to subscribed users
- **Email Lookup**: Recipients are found by matching names in `people` and `users` tables
- **Template Variables**: Supports `{{name}}`, `{{email}}`, `{{project_name}}`, `{{stage_name}}`, `{{assigned_to_name}}`, `{{workflow_link}}`, `{{previous_stage_name}}`, `{{rejection_reason}}`

### 11. Materials Management
- **Page**: `Materials.tsx`
- **Route**: `/materials`
- **Access**: Devs, master_technicians, assistants, and estimators (estimators see Price Book, Assembly Book, Templates, Purchase Orders; Supply Houses & External Subs tab hidden from estimators)
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
  - The page-level `Materials` heading has been removed so the Price Book/Template/PO tabs appear at the top of the content area.
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

**Supply Houses & External Subs Tab** (dev, master, assistant only; hidden from estimators):
- **Supply Houses section**: Summary at top with AP total (Supply Houses: $X); expandable rows per supply house; Add Supply House button (top right). Per supply house: name, address, phone, email; invoices (Invoice #, Date, Due Date, Amount, Link, Paid checkbox); purchase orders linked via `supply_house_id`. Unpaid invoices sum to outstanding; paid invoices excluded. Tables: `supply_house_invoices`, `supply_houses`; `purchase_orders.supply_house_id`.
- **External Team section**: Table of external subcontractors (from `people` kind='sub') with External Subcontractor, Sub Manager (User), Outstanding, Add Job Payment. Expandable rows show job payments (note, amount, paid checkbox); Add External Subcontractor button. Sub Manager assignable from users dropdown. Unpaid job payments sum to Outstanding. Tables: `external_team_sub_managers`, `external_team_job_payments`.
- **Dev-only Settings**: Pin Supply Houses AP and Pin External Team to Dashboard (like Pin AR); pins show on masters/devs Dashboards.

**Integration with Workflows**:
- Finalized purchase orders can be added as line items to workflow steps
- PO details (name, item count, total) displayed in line item memo
- "View PO" button on line items opens PO details modal
- Links back to original purchase order for full details
- Purchase orders sorted by name in "Add PO" dropdown

#### Database Schema

**Tables**:
- `supply_houses` - Supply house information (name, contact_name, phone, email, address, notes)
- `supply_house_invoices` - Invoices per supply house (invoice_number, invoice_date, due_date, amount, link, is_paid); unpaid sum = AP
- `external_team_sub_managers` - Sub Manager (user) per subcontractor (person_id, user_id)
- `external_team_job_payments` - Job payments per subcontractor (person_id, note, amount, is_paid); unpaid sum = Outstanding
- `material_parts` - Parts catalog (name, manufacturer, fixture_type, notes)
- `material_part_prices` - Prices for parts by supply house (with effective_date, unique constraint on part_id + supply_house_id)
- `material_part_price_history` - Historical price changes (old_price, new_price, price_change_percent, changed_at, changed_by, notes)
- `material_templates` - Reusable material templates (name, description)
- `material_template_items` - Items within templates (supports nested templates and parts with quantities)
- `purchase_orders` - Purchase orders (name, status: draft/finalized, notes, notes_added_by, notes_added_at, created_by, finalized_at, supply_house_id)
- `purchase_order_items` - Items in purchase orders (part_id, quantity, selected_supply_house_id, price_at_time, price_confirmed_at, price_confirmed_by, sequence_order, notes)

**Database Functions**:
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
- **Evaluate**: Button to the left of "New" opens a modal with an evaluation checklist (LOCATION, PAYMENT TERMS, BID DOCUMENTS, COMPETITION, STRENGTHS); checklist state resets when the modal is closed.
- **Search**: Full-width search input filters bids by project name, address, customer name, or GC/builder name (case-insensitive). Empty state reflects search and "hide lost" filter.
- Table of bids; all column headers and cells are **centered**. Columns: Project Folder, Job Plans, GC/Builder, Project Name, Address, Win/ Loss, Bid Value, Estimator, Bid Due Date, Bid Date Sent, Distance to Office (miles), Last Contact, Notes, Edit. (Agreed Value and Maximum Profit columns are not shown.)
- **Win/ Loss**: Header is a **button** that toggles hiding/showing lost bids; when hiding lost, label shows "(hiding lost)" and is underlined.
- **Display formatting**: Bid Due Date and Bid Date Sent use **YY/MM/DD** (e.g. 26/02/12). Last Contact uses **short date with day of week** (e.g. "Sun 2/1"). Bid Value uses **compact currency** (e.g. $121k). Distance to Office (miles) column shows value + **mi** (e.g. 66.6mi).
- **Notes**: Clicking the Notes cell opens a **quick-edit modal** (Notes – [project name]) with a textarea; Save updates the bid's notes and refreshes the table; Cancel closes without saving. Notes cell is clickable with cursor pointer and tooltip "Click to add notes" / "(click to edit)".
- **Edit**: Edit column shows only a **gear/settings icon** (no visible button box; header text hidden, `title`/`aria-label` for accessibility). Opens the full New/Edit Bid modal.
- "New" button opens modal to create/edit bids. **Project Name \*** and **Project Address** are the **first two fields** at the top of the form (Project Name required; label "Project Address" was formerly "Address"). **"Save and start Counts"** (bottom left) saves the bid and opens it in the Counts tab. Then: Project Folder (label includes inline links: "bid folders: [plumbing] [electrical] [HVAC]"), Job Plans, **Bid Submission** link (`bid_submission_link`), **Design Drawings Plan Date** (`design_drawing_plan_date`), GC/Builder (customer) picker, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email** (per-bid; not shown on Bid Board), Estimator, Bid Due Date, Bid Date Sent, Win/Loss, etc. When outcome is **Won**, an **Estimated Job Start Date** date input is shown and saved. Distance to Office (miles) is a number input (min 0, step 0.1). Profit label is "Maximum Profit".
- **Edit Bid modal**: **Cancel** button is at **top right** next to the title. **Delete**: "Delete bid" opens a separate confirmation modal; user must type the project name (or leave empty) to enable Delete.
- **GC/Builder**: Uses `customers` table as data source with searchable combobox (same pattern as customer picker in ProjectForm). **"+ Add new customer"** option at the top of the dropdown (for dev, master_technician, assistant, and estimator) opens an **Add Customer** modal with the same form as `/customers/new` but without Quick Fill; on save, the new customer is created, list is refetched, and the new customer is selected as the bid's GC/Builder. Legacy `bids_gc_builders` retained for backward compatibility.
- Clicking a GC/Builder name opens a modal: customer details (name, address, phone/email from contact_info, won/lost bids) or legacy GC/Builder details (name, address, contact number, won/lost bids) depending on whether bid has `customer_id` or `gc_builder_id`.

**Counts Tab**:
- **Search** box is **below** the selected-bid panel, **full width**; column header is **"Project Name"**. **"Edit Bid"** button in tab header (next to Close) opens Edit Bid modal for the selected bid.
- Selecting a bid shows an inline panel with **Add row** and its fixture/count rows. Table columns: **Fixture\***, **Count\***, **Plan Page**, **Actions** (centered headers).
- **NewCountRow (add row)**: Fixture, Count, and Plan Page in a **combined** cell; **Fixture quick-select** buttons (Bathrooms, Kitchen, Laundry, etc.) below Fixture input; **number pad** below Count (1–9, C, 0, Delete). **Save** and **Save and Add** (Save and Add keeps form open for another row). Fixture and Count required.

**Takeoffs Tab**:
- Select a bid; table maps fixture counts to **material assemblies** and quantities. **Assembly search** above table ("only show assemblies with these words"); dropdowns use filtered options and always include selected. **Multiple assemblies per fixture** (Add assembly / Remove per mapping). Delete entries only from within the edit modal (no in-row delete).
- **Create purchase order** creates a new draft PO from current mappings; **Add to selected PO** adds items to an existing draft PO (uses shared `materialPOUtils`). **View purchase order** link after create/add navigates to Materials with that PO open (`location.state.openPOId`).

**Cost Estimate Tab**: Combine material and labor by bid; link up to three POs (Rough In, Top Out, Trim Set) per stage; editable labor hours per fixture (step 0.25 for up/down arrows) and labor rate; fixture labor matrix synced with Counts. **Totals** (Total materials, Labor total, Grand total) and material-by-stage amounts use **comma formatting** for numbers over 999 (e.g. $12,345.67) via `formatCurrency()`.

**Cover Letter Tab**: Select a bid; top section shows **Customer** (name, address) and **Project** (Project Name, Project Address). Editable sections: **Inclusions** (one per line, bullets; default "Permits"), **Exclusions and Scope** (one per line, shown as bullets; default four exclusions), **Terms and Warranty** (collapsible; default full paragraph). Combined document (copy to send) builds from those plus proposed amount and fixtures; **Edit bid** button in header opens Edit Bid modal for the selected bid.
- **Design Drawings Plan Date**: A bid-level date-only field (`design_drawing_plan_date`) used for proposal/cover-letter wording (shown in the combined document output where applicable).

**Pricing Tab**:
- Pricing is managed by **Price Book Versions** (named sets of `price_book_entries`) and a per-bid version selection (`bids.selected_price_book_version_id`).
- Each bid can store a selected version (`selected_price_book_version_id`), which is restored when reopening Pricing.
- Each count row (fixture) on a bid is assigned a price book entry via `bid_pricing_assignments` (unique per `(bid_id, count_row_id)`).
- Pricing view compares **estimated cost** (labor + allocated materials) vs **revenue** (price book entry) to compute **margin %**, and flags margin: red (< 20%), yellow (< 40%), green (≥ 40%), including totals.
- **Prerequisites**: Pricing expects the bid to have Counts and a Cost Estimate. If a bid has count rows but no cost estimate yet, Pricing prompts you to create one first.
- **Cost allocation (high level)**:
  - **Labor cost** comes from Cost Estimate labor rows (per fixture / tie-in).
  - **Materials** are allocated to fixtures proportionally by labor hours, so margin reflects both labor and an allocated share of materials.

**Submission & Followup Tab**:
- **Five tables** (in order): **Unsent bids** (bid_date_sent null), **Not yet won or lost** (sent, outcome not won/lost/started_or_complete), **Won**, **Started or Complete**, **Lost**. Each section has a **clickable header** with chevron (▼ expanded, ▶ collapsed) and item count (e.g. "Unsent bids (3)"); tables are shown/hidden by section state. "Lost" is collapsed by default. Search filters all five. Clicking a row selects the bid and shows its submission entries in a panel above.
- **Selected bid panel**: When a bid is selected, an inline panel shows the bid title, then a **bid summary**: Builder Name, Builder Address, **Builder Phone Number**, **Builder Email** (from customer or legacy GC/Builder), Project Name, Project Address, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**, Bid Size (project contact fields are stored per bid and are not shown on the Bid Board). **Call script buttons** above the contact table: **Sent Bid Script** and **Bid Question Script** open read-only modals with the respective script text. Below that: **Margins** section includes:
  - **Approval PDF** download button (multi-page packet: Submission and Followup, Pricing [landscape], Cost Estimate, Cover Letter; pricing table has Per Unit column; Per Unit and Revenue as whole numbers; Cover Letter "Inclusions:" and "Exclusions and Scope:" headings bold)
  - **Bid links**: Bid Submission, Project Folder, Job Plans (rendered as clickable links in the PDF with spacing between them)
  - **Cost estimate** status/amount (if available)
  - **Pricing by version** list (Price Book Version → Revenue and Margin)
  - "Our Cost" is **not shown** (redundant with cost estimate amount)
  - **View cost estimate** / **Create cost estimate** button switches to the Cost Estimate tab with that bid preselected
  - Then: submission entries table (Contact method, Notes, Time and date), "Add row", **Edit icon** (gear) next to Close (opens that bid's full edit modal), and Close.
- **Not yet won or lost** table: Columns Project/GC, GC/Builder (customer), Time since last contact, Time to/from bid due date, **Edit**. **Unsent bids** table: Columns Project/GC, Bid Due Date, Bid Date Sent, Time since last contact, Time to/from bid due date, **Edit**. **Time since last contact** uses the more recent of `bid.last_contact` or the latest submission entry's `occurred_at`; a 60-second re-render (when tab is active) keeps relative times updated. Adding or editing a submission entry updates the bid's `last_contact` to that entry's date and refetches bids. **Time to/from bid due date** shows e.g. "X days since deadline", "Due today", "X days until due". **Edit** column: gear icon button when that row is the selected bid; opens full edit modal (click uses stopPropagation).
- **Won**, **Started or Complete**, and **Lost** tables: Won shows Project/GC, Estimated Job Start Date (YY/MM/DD), GC/Builder (customer), Edit. Started or Complete shows Project/GC, GC/Builder (customer), Edit. Lost shows Project/GC, Bid Due Date, Edit. Win/ Loss dropdown in New/Edit bid includes Won, Lost, and Started or Complete.
- **Submission entry rows**: Edit and Delete are **icon buttons** (gear for Edit, trash for Delete) with tooltips; same behavior as before (inline edit for Edit, confirm then delete for Delete).

#### Database Schema (Bids)

**Tables**:
- `bids_gc_builders` – Legacy GC/Builder entities (name, address, contact_number, email, notes, created_by)
- `bids` – Main bids (drive_link, plans_link, **bid_submission_link**, **design_drawing_plan_date**, gc_builder_id, customer_id, project_name, address, gc_contact_name, gc_contact_phone, gc_contact_email, bid_due_date, bid_date_sent, outcome, bid_value, agreed_value, profit, estimated_job_start_date, distance_from_office, last_contact, notes, created_by, estimator_id, selected_*_book_version_id fields)
- `bids_count_rows` – Fixture/count per bid (bid_id, fixture, count, page, sequence_order)
- `bids_submission_entries` – Submission/follow-up entries per bid (bid_id, contact_method, notes, occurred_at)
- `price_book_versions` – Price book versions (named sets of entries)
- `price_book_entries` – Price book entries per version (fixture_name with per-stage prices and total)
- `bid_pricing_assignments` – Assignments linking bid count rows to price book entries (used by Pricing tab)

**Migrations**: `create_bids_gc_builders.sql`, `create_bids.sql`, `create_bids_count_rows.sql`, `create_bids_submission_entries.sql`, `add_bids_customer_id.sql`, `add_bids_count_rows_page.sql`, `split_bids_project_name_and_address.sql`, `add_bids_estimated_job_start_date.sql`, `add_bids_gc_contact.sql`, `add_bids_estimator_id.sql`, `add_bids_bid_submission_link.sql`, `add_bids_design_drawing_plan_date.sql`, `allow_assistants_access_bids.sql`, `allow_estimators_access_bids.sql`, `allow_estimators_select_customers.sql` (customers SELECT/INSERT for estimators), `allow_masters_see_all_bids.sql`.

**RLS**: Bids tables allow devs, masters, assistants, and estimators full access (assistants via `allow_assistants_access_bids.sql`, estimators via `allow_estimators_access_bids.sql`; masters see all bids via `allow_masters_see_all_bids.sql`). Child tables (bids_count_rows, bids_submission_entries) follow parent bid access. Customers table: estimators can SELECT all and INSERT when master is assigned (see `allow_estimators_select_customers.sql`).

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
│   │   └── NewCustomerForm.tsx # Shared create-only customer form (Bids Add Customer modal, /customers/new)
│   ├── hooks/
│   │   └── useAuth.ts          # Authentication hook
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client initialization
│   │   └── materialPOUtils.ts # Shared PO helpers (expandTemplate, addExpandedPartsToPO; Materials & Bids Takeoff)
│   ├── pages/
│   │   ├── Calendar.tsx        # Calendar view
│   │   ├── Checklist.tsx       # Checklist (Today, History, Manage tabs)
│   │   ├── CustomerForm.tsx    # Create/edit customer
│   │   ├── Customers.tsx       # List customers
│   │   ├── Dashboard.tsx       # User dashboard
│   │   ├── People.tsx          # People roster (Users, Pay, Hours)
│   │   ├── Jobs.tsx           # Jobs (Labor, HCP Jobs, Sub Sheet Ledger, Upcoming, Teams Summary)
│   │   ├── ProjectForm.tsx    # Create/edit project
│   │   ├── Materials.tsx       # Materials management (price book, templates, purchase orders)
│   │   ├── Bids.tsx            # Bids management (bid board, counts, takeoffs, cover letter, submission & followup)
│   │   ├── Projects.tsx       # List projects
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
    │   ├── delete-user/        # Delete user Edge Function
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

#### `src/hooks/useAuth.ts`
- Provides `{ user, loading }` from Supabase Auth
- Subscribes to auth state changes
- Used throughout app for authentication checks

#### `src/components/Layout.tsx`
- Main navigation bar
- **iOS safe area**: Nav uses `padding-top: max(var(--app-nav-pad-y), env(safe-area-inset-top))` so menu/settings stay below status bar on iOS
- Role-based link visibility
- Impersonation handling ("Back to my account")
- **Gear menu** (top-right): Settings link (all users); Global Reload (dev-only, broadcasts reload to all connected clients via Supabase Realtime `force-reload` channel)
- Sign out functionality

#### `src/types/database.ts`
- TypeScript types generated from database schema
- Used for type-safe database queries
- **Note**: Must be manually updated when schema changes

#### `src/pages/Bids.tsx`
- **Route**: `/bids`
- **Access**: Devs, master_technicians, assistants
- **Tabs**: Bid Board (Evaluate button and checklist modal; search, table with lost bids always hidden, columns: Project Folder, Job Plans, GC/Builder, Project Name, Address, Account Man, Bid, Bid Date, Distance to Office, Last Contact, Edit; create/edit modal with **Project Name \*** and **Project Address** at top, then Project Folder, Job Plans, GC/Builder, Project Contact Name/Phone/Email, Estimator, etc.; Estimated Job Start Date when outcome is Won; delete bid opens separate confirmation modal; project contact fields not shown on Bid Board), Counts (fixture/count/page per bid), Takeoffs (assembly mappings, create PO, view PO; delete entries only in edit modal), **Cover Letter** (select bid; Customer + Project Name/Address at top; Inclusions/Exclusions/Terms with defaults; combined document; Edit bid button), Submission & Followup (four collapsible tables; selected-bid panel shows Builder Name, Builder Address, Builder Phone Number, Builder Email (from customer or legacy GC/Builder), Project Name, Project Address, Project Contact Name, Project Contact Phone, Project Contact Email, Bid Size; Sent Bid Script and Bid Question Script buttons and modals; then submission entries table; each table has Edit column with gear when row is selected; Won table shows Estimated Job Start Date; edit icon next to Close; submission entry Edit/Delete icons)
- **Database**: `bids`, `bids_gc_builders`, `bids_count_rows`, `bids_submission_entries`; GC/Builder picker uses `customers` table
- **Helpers**: `formatShortDate` (e.g. "Sun 2/1"), `formatDateYYMMDD` (e.g. 26/02/12), `formatCompactCurrency` (e.g. $121k), `formatTimeSinceLastContact`, `formatTimeSinceDueDate` (e.g. "X days since deadline", "Due today", "X days until due")

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
- **Location**: `supabase/migrations/rename_owner_to_dev.sql`
- **What it does**:
  1. Adds 'dev' to the `user_role` enum type
  2. Updates all existing user records from 'owner' to 'dev'
  3. Creates `is_dev()` function (replaces `is_owner()`)
  4. **Automatically updates all RLS policies** that reference `is_owner()` to use `is_dev()` instead
  5. Drops the old `is_owner()` function (after all dependencies are updated)
  6. Renames `claim_owner_with_code()` to `claim_dev_with_code()`
- **Key Feature**: The migration uses a `DO` block to query `pg_policy` system catalog and automatically find and update all policies that depend on `is_owner()`. This handles 30+ policies across multiple tables without manual updates.
- **See**: `supabase/migrations/rename_owner_to_dev_README.md` for detailed instructions and troubleshooting

##### `fix_email_templates_rls`
- **Purpose**: Fixes RLS policies on `email_templates` table to use `is_dev()` function
- **Location**: `supabase/migrations/fix_email_templates_rls.sql`
- **What it does**: Updates policies to use `is_dev()` instead of direct queries to avoid recursion issues

##### `allow_devs_read_all_people`
- **Purpose**: Allows devs to read all people entries (not just their own)
- **Location**: `supabase/migrations/allow_devs_read_all_people.sql`
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
- **Location**: `supabase/migrations/add_finalized_notes_tracking.sql`
- **What it does**:
  1. Adds `notes_added_by` (UUID) and `notes_added_at` (TIMESTAMPTZ) columns to `purchase_orders`
  2. Creates RLS policy allowing updating notes fields on finalized POs, but only when `notes` is null (enforcing add-only behavior)
  3. Index on `notes_added_by` for faster lookups

##### `add_link_to_line_items`
- **Purpose**: Adds optional link field to workflow step line items
- **Location**: `supabase/migrations/add_link_to_line_items.sql`
- **What it does**:
  1. Adds `link` (TEXT, nullable) column to `workflow_step_line_items` table
  2. Allows linking to external resources like Google Sheets or supply house listings
  3. Used for linking purchase orders, supply house part listings, or other external documents

##### `add_purchase_order_to_line_items`
- **Purpose**: Links purchase orders to workflow step line items
- **Location**: `supabase/migrations/add_purchase_order_to_line_items.sql`
- **What it does**:
  1. Adds `purchase_order_id` (UUID, nullable, FK → `purchase_orders.id` ON DELETE SET NULL) to `workflow_step_line_items`
  2. Enables linking finalized purchase orders as line items in workflow steps
  3. ON DELETE SET NULL ensures line items remain if PO is deleted

##### `add_price_confirmation_to_po_items`
- **Purpose**: Adds price confirmation tracking to purchase order items
- **Location**: `supabase/migrations/add_price_confirmation_to_po_items.sql`
- **What it does**:
  1. Adds `price_confirmed_at` (TIMESTAMPTZ, nullable) and `price_confirmed_by` (UUID, nullable, FK → `users.id`) to `purchase_order_items`
  2. Allows assistants to confirm prices before finalizing purchase orders
  3. Creates index on `price_confirmed_at` for performance
  4. RLS policy allows assistants to update these fields only

##### `create_material_part_price_history`
- **Purpose**: Creates table for tracking historical price changes
- **Location**: `supabase/migrations/create_material_part_price_history.sql`
- **What it does**:
  1. Creates `material_part_price_history` table with columns: id, part_id, supply_house_id, old_price, new_price, price_change_percent, effective_date, changed_at, changed_by, notes
  2. Adds indexes on part_id, supply_house_id, and changed_at for performance
  3. Provides complete audit trail of all price changes

##### `create_price_history_trigger`
- **Purpose**: Creates trigger to automatically log price changes
- **Location**: `supabase/migrations/create_price_history_trigger.sql`
- **What it does**:
  1. Creates `track_price_history()` function that fires AFTER INSERT OR UPDATE on `material_part_prices`
  2. Calculates percentage change: `((NEW.price - OLD.price) / OLD.price) * 100`
  3. Handles INSERT (old_price is NULL) and UPDATE (old_price from OLD record) correctly
  4. Records changed_at (current timestamp) and changed_by (current user)
  5. Creates trigger `material_part_prices_history_trigger` to execute function

##### `optimize_rls_for_master_sharing` (Updated)
- **Purpose**: Optimizes RLS policies and fixes assistant step update permissions
- **Location**: `supabase/migrations/optimize_rls_for_master_sharing.sql`
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

### Edge Functions Deployment
Edge Functions are deployed via Supabase CLI or Dashboard:
- `invite-user` - Sends invitation emails (✅ Implemented)
- `create-user` - Manually creates users (✅ Implemented). **Role** in request body must be one of: `dev`, `master_technician`, `assistant`, `subcontractor`, `estimator`.
- `delete-user` - Deletes users (✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `set-user-password` - Set another user's password (dev only; ✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `login-as-user` - Generates magic link for impersonation (✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `test-email` - Sends test emails using Resend service (✅ Implemented - requires `RESEND_API_KEY`)
- `send-workflow-notification` - Sends workflow stage notifications via email (✅ Implemented - requires `RESEND_API_KEY`)

**All Edge Functions**:
- Use `verify_jwt: false` (gateway validation disabled)
- Implement internal JWT validation
- Handle CORS explicitly
- Return structured error responses
- **Note**: Functions requiring service role key (`delete-user`, `set-user-password`, `login-as-user`) must have `SUPABASE_SERVICE_ROLE_KEY` secret set

**Deployment**:
- Deploy via CLI: `supabase functions deploy <function-name> --no-verify-jwt`
- Or via Supabase Dashboard → Edge Functions
- See `supabase/functions/<function-name>/DEPLOY.md` for detailed instructions

**Secrets Required**:
- `RESEND_API_KEY` - Required for `test-email` and `send-workflow-notification` functions
  - Set via: `supabase secrets set RESEND_API_KEY=your_key`
- `SUPABASE_SERVICE_ROLE_KEY` - Required for `delete-user`, `set-user-password`, and `login-as-user` functions
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
- **Migration**: `supabase/migrations/optimize_rls_for_master_sharing.sql` (updated UPDATE policy)
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
- **Migration**: `supabase/migrations/fix_users_rls_for_project_masters.sql`
- **Result**: Assistants can now see master information (name/email) when viewing projects without recursion errors
- **Master Sharing**: Similar pattern used for `master_shares` table - RLS policies check for sharing relationships without recursion

### 16. Line Items RLS Timeout
- **Issue**: Loading line items causes statement timeout errors (500 Internal Server Error)
- **Solution**: Created `can_access_project_via_step()` helper function to optimize RLS policies
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS, performs single optimized query
- **Migration**: `supabase/migrations/optimize_workflow_step_line_items_rls.sql`
- **Result**: Line items load quickly without timeout errors

### 17. Step Actions RLS Errors
- **Issue**: Recording workflow actions causes 403 Forbidden or 500 Internal Server Error
- **Solution**: Created `can_access_step_for_action()` helper function to optimize RLS policies
- **Implementation**: Uses `SECURITY DEFINER` to bypass RLS, checks step access efficiently
- **Migration**: `supabase/migrations/fix_project_workflow_step_actions_rls.sql`
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
- **Admin Code**: Hardcoded `'admin1234'` should be configurable
- **Rate Limiting**: No rate limiting on Edge Functions
- **Input Validation**: Some user inputs not validated (e.g., email format)
- **SQL Injection**: RLS policies use parameterized queries (safe), but be cautious with dynamic SQL

### Performance Optimizations
- **Data Fetching**: Some pages fetch all data upfront (consider pagination)
- **Real-time**: Supabase Realtime used for `people_hours` (Pay/Hours sync), `user_pinned_tabs` (Dashboard pins), and `force-reload` broadcast (Global Reload)
- **Caching**: No client-side caching (consider React Query)

---

## Quick Reference

### User Roles
- **dev**: Full access, user management, templates
- **master_technician**: Create/manage projects, customers, workflows
- **assistant**: Create/edit projects, view/update workflows (assigned stages only), full access to Bids
- **subcontractor**: Dashboard and Calendar only

### Key Routes
- `/dashboard` - User dashboard
- `/customers` - Customer list
- `/projects` - Project list
- `/workflows/:projectId` - Workflow management
- `/people` - People roster (Users, Pay, Hours tabs)
- `/jobs` - Jobs (Labor, HCP Jobs, Sub Sheet Ledger, Upcoming, Teams Summary tabs)
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
- `delete-user` - Delete user
- `set-user-password` - Set another user's password (dev only)
- `login-as-user` - Generate impersonation magic link
- `test-email` - Send test emails using Resend service (for email template testing)
- `send-workflow-notification` - Send workflow stage notifications via email (automatically called when steps change status)

### Database Enums
- `user_role`: `'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'`
- `project_status`: `'awaiting_start' | 'active' | 'completed' | 'on_hold'`
- `workflow_status`: `'draft' | 'active' | 'completed'`
- `step_status`: `'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved'`
- `step_type`: `'delivery' | 'count' | 'work' | 'inspection' | 'billing' | null`
- `person_kind`: `'assistant' | 'master_technician' | 'sub'`

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
  - Use Settings page to enter admin code `'admin1234'`
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
- **Price book**: Create/edit/delete price book versions and entries (prices per stage: Rough In, Top Out, Trim Set, Total); bid margin comparison: select bid and price book version, assign price book entry per count row (dropdown); compare cost (labor + allocated materials) vs revenue; margin % with flags: red (&lt; 20%), yellow (&lt; 40%), green (≥ 40%); cost allocation (labor from cost estimate, materials by labor hours); selected version stored on bid (`selected_price_book_version_id`); "Go to Cost Estimate" prompt when bid has no cost estimate.
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
- **Submission & Followup**: **Five collapsible sections** with clickable headers (chevron ▼/▶ and item count). "Lost" collapsed by default. **Unsent bids**, **Not yet won or lost**, **Won**, **Started or Complete**, **Lost**. **Selected-bid panel**: Bid title, then summary: Builder Name, Builder Address, **Builder Phone Number**, **Builder Email** (from customer or legacy GC/Builder), Project Name, Project Address, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**, Bid Size; then submission entries table, Add row, Edit icon, Close. **Not yet won or lost**: columns Project/GC, GC/Builder (customer), Time since last contact, Time to/from bid due date, **Edit**. **Unsent bids**: columns Project/GC, Bid Due Date, Bid Date Sent, Time since last contact, Time to/from bid due date, **Edit** (gear when row is selected; opens full edit modal). **Time to/from bid due date**: e.g. "X days since deadline", "Due today", "X days until due". **Won** table: columns Project/GC, **Estimated Job Start Date** (YY/MM/DD), GC/Builder (customer), Edit. **Started or Complete** table: Project/GC, GC/Builder (customer), Edit. **Lost** table: Project/GC, Bid Due Date, Edit. **Edit icon** (gear) next to Close opens that bid's full edit modal. **Submission entry rows**: Edit and Delete **icon buttons** (gear, trash) with tooltips.

## Recent Updates (v2.9)

### Bids Management
- **New Bids section** with route `/bids` and nav link for devs, master_technicians, and assistants (same as Materials visibility except subcontractors).
- **Bid Board tab**: Table of bids (project folder link, plans link, GC/Builder, project name/address, bid due date, bid date sent, won/lost, bid value, agreed value, projected maximum profit, distance from office, last contact, notes). New/Edit modal with bid folders links [plumbing] [electrical] [HVAC]; distance as number input; profit labeled "Projected Maximum Profit". GC/Builder uses **customers** table with searchable combobox (same pattern as ProjectForm customer picker). Clicking GC/Builder name opens modal with customer or legacy GC/Builder details and won/lost bid counts.
- **Counts tab**: Search bids; select bid to show fixture/count rows. Columns: Fixture, Count, Plan Page, actions. Plan Page field added to `bids_count_rows` and persisted.
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
- **Data backup (dev)** section: Three export buttons for devs only.
  - **Export projects backup**: Downloads JSON with customers, projects, project_workflows, project_workflow_steps, project_workflow_step_actions, step_subscriptions, workflow_step_line_items, workflow_projections. Filename: `projects-backup-YYYY-MM-DD.json`.
  - **Export materials backup**: Downloads JSON with supply_houses, material_parts, material_part_prices, material_templates, material_template_items. Filename: `materials-backup-YYYY-MM-DD.json`.
  - **Export bids backup**: Downloads JSON with bids, bids_gc_builders, bids_count_rows, bids_submission_entries, cost_estimates, cost_estimate_labor_rows, fixture_labor_defaults, bid_pricing_assignments, price_book_versions, price_book_entries, labor_book_versions, labor_book_entries, takeoff_book_versions, takeoff_book_entries, purchase_orders, purchase_order_items (all POs and PO items visible under RLS, including Takeoffs-created POs). Filename: `bids-backup-YYYY-MM-DD.json`.
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
- ✅ Rejected status includes reason inline: "Status: rejected - {reason}"
- ✅ Removed duplicate status display from bottom of card

### Re-open Stages
- ✅ Added "Re-open" button for completed, approved, and rejected stages
- ✅ Available to devs, masters, and assistants (on Workflow page only)
- ✅ Button appears inline with Edit and Delete buttons (bottom right of card)
- ✅ Resets stage to pending, clears rejection reason, approval info, and next step rejection notices
- ✅ Records 'reopened' action and sends notifications

### Master-to-Master Sharing
- ✅ Added `master_shares` table for master-to-master sharing relationships
- ✅ Updated all RLS policies to support master sharing (customers, projects, workflows, steps, line items, projections)
- ✅ Shared masters receive assistant-level access (can see but not modify, cannot see private notes/financials)
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
- ✅ `delete-user` - Fully implemented (requires `SUPABASE_SERVICE_ROLE_KEY`)
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
1. **Private Notes**: Owners and masters can add private notes to each stage (separate from public notes)
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
13. **Test Email Function**: Edge Function for testing email templates with Resend integration
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
