# Pipetooling Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Key Features](#key-features)
7. [File Structure](#file-structure)
8. [Development Workflow](#development-workflow)
9. [Deployment](#deployment)
10. [Common Patterns](#common-patterns)
11. [Known Issues & Gotchas](#known-issues--gotchas)
12. [Future Development Notes](#future-development-notes)

---

## Project Overview

**Pipetooling** is a web application designed for Master Plumbers to track plumbing work across multiple projects and crews. The key innovation is that it allows tracking work for crews that don't have direct access to the site.

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
  - Real-time subscriptions (not currently used)

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

## Database Schema

### Core Tables

#### `public.users`
- **Purpose**: User accounts with roles
- **Key Fields**:
  - `id` (uuid, PK) - Matches `auth.users.id`
  - `email` (text)
  - `name` (text, nullable)
  - `role` (enum: `'dev' | 'master_technician' | 'assistant' | 'subcontractor'`)
  - `last_sign_in_at` (timestamptz, nullable)
- **Relationships**: Referenced by `customers.master_user_id`, `people.master_user_id`
- **RLS**: 
  - Users can read their own record
  - Masters/devs can see all assistants
  - Users can see masters who have adopted them (via `master_adopted_current_user()` function)
  - Uses `SECURITY DEFINER` function to avoid recursion in RLS policies
- **Helper Functions**:
  - `public.is_dev()` - Checks if current user has dev role (avoids recursion)
  - `public.master_adopted_current_user(master_user_id UUID)` - Checks if master adopted current user (avoids recursion)

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
  - SELECT: Users can see customers where `master_user_id` matches their ID, they're a dev/master, they're in `master_assistants`, or they're in `master_shares`
  - DELETE: Masters can delete their own customers (`master_user_id = auth.uid()`), devs can delete any customer
- **Special Features**: 
  - Quick fill form allows pasting tab-separated data (name, address, email, phone, date)
  - **Master selection**: Assistants and devs must select a master when creating customers
    - Assistants: Can only select from masters who adopted them
    - Devs: Can select from all masters in the system
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
- **RLS**: Users can only see/manage their own roster entries; devs can see all entries

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
  - `memo` (text, required) - Description of the line item
  - `amount` (numeric(10, 2), required) - **Supports negative numbers** for credits/refunds
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
  - Assistants can view Ledger table but cannot see financial totals
- **Migration**: `supabase/migrations/optimize_workflow_step_line_items_rls.sql`

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
  └── projects.customer_id

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
```

**Important**: When deleting, respect foreign key order:
1. `step_subscriptions` (references steps)
2. `project_workflow_step_actions` (references steps)
3. `project_workflow_steps` (references workflows)
4. `project_workflows` (references projects)
5. `projects` (references customers)
6. `customers` (references users)

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
4. Frontend stores original session in `sessionStorage` (key: `'impersonation_original'`)
5. Browser redirects to magic link URL with tokens in hash
6. AuthHandler component processes tokens and sets session
7. User is redirected to dashboard as the target user
8. "Back to my account" button restores original session from `sessionStorage`

---

## Key Features

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
  - **Quick Fill**: Paste tab-separated data (name, address, email, phone, date) to auto-fill form
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
    - Fields: Memo (description), Amount (supports negative for credits/refunds)
    - Located within Private Notes section of each stage
    - Amounts formatted with commas: `$1,234.56`
    - Negative amounts displayed in red with parentheses: `($1,234.56)`
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
- **Features**:
  - List people by kind (Assistant, Master Technician, Subcontractor)
  - Add people without user accounts
  - Merge display of roster entries and signed-up users (deduplicated by email)
  - Show active projects per person
  - Invite roster entries as users (sends invitation email)
  - **Contact Integration**: 
    - Email addresses are clickable (opens email client)
    - Phone numbers are clickable (opens phone dialer)
  - Display shows "(account)" next to people who have user accounts
- **Data**: Name, email, phone, notes, kind

### 6. Calendar View
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

### 7. Dashboard
- **Page**: `Dashboard.tsx`
- **Features**:
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
    - When a Master or Assistant selects to Notify when a stage updates, that stage will show up in their Subscribed Stages below:
  - **My Assigned Stages**: Lists all steps assigned to current user (by `assigned_to_name`)
    - Shows project name, stage name, status
    - Displays start/end times
    - Clickable project address opens Google Maps in new tab
    - Project links include hash fragment to scroll directly to step card
    - Shows project address and plans link if available
    - Displays notes and rejection reasons if present
    - Shows next step rejection notices if present
    - Action buttons: Set Start, Complete, Approve, Reject (based on role and status)
  - **Subscribed Stages**: Shows stages user has subscribed to (with notification preferences)
    - Links to projects and workflows
  - **Card Layout**: 
    - Format: "Stage name - Assigned person"
    - Project link below title
    - Status, start/end times displayed
    - Color-coded by status (green for approved/completed, red for rejected)

### 8. Settings
- **Page**: `Settings.tsx`
- **Features (All Users)**:
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
  - Display last login time
  - **Email Template Management**: Create and edit email templates for all notification types
  - View all people entries (not just own entries)

### 9. Notifications
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

### 10. Action History & Audit Trail
- **System**: `project_workflow_step_actions` table
- **Features**:
  - Complete ledger of all step state changes
  - Tracks: who performed action, when, action type, optional notes
  - Action types: 'started', 'completed', 'approved', 'rejected', 'reopened'
  - Displayed in "Action Ledger" section on each step card
  - Provides full audit trail for compliance and debugging

### 11. Integration Features
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
│   └── favicon.svg             # Site favicon (orange gear icon)
├── src/
│   ├── components/
│   │   └── Layout.tsx          # Main layout with navigation
│   ├── hooks/
│   │   └── useAuth.ts          # Authentication hook
│   ├── lib/
│   │   └── supabase.ts         # Supabase client initialization
│   ├── pages/
│   │   ├── Calendar.tsx        # Calendar view
│   │   ├── CustomerForm.tsx    # Create/edit customer
│   │   ├── Customers.tsx       # List customers
│   │   ├── Dashboard.tsx       # User dashboard
│   │   ├── People.tsx          # People roster
│   │   ├── ProjectForm.tsx     # Create/edit project
│   │   ├── Projects.tsx        # List projects
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
- Role-based link visibility
- Impersonation handling ("Back to my account")
- Sign out functionality

#### `src/types/database.ts`
- TypeScript types generated from database schema
- Used for type-safe database queries
- **Note**: Must be manually updated when schema changes

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
- `create-user` - Manually creates users (✅ Implemented)
- `delete-user` - Deletes users (✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `login-as-user` - Generates magic link for impersonation (✅ Implemented - requires `SUPABASE_SERVICE_ROLE_KEY`)
- `test-email` - Sends test emails using Resend service (✅ Implemented - requires `RESEND_API_KEY`)
- `send-workflow-notification` - Sends workflow stage notifications via email (✅ Implemented - requires `RESEND_API_KEY`)

**All Edge Functions**:
- Use `verify_jwt: false` (gateway validation disabled)
- Implement internal JWT validation
- Handle CORS explicitly
- Return structured error responses
- **Note**: Functions requiring service role key (`delete-user`, `login-as-user`) must have `SUPABASE_SERVICE_ROLE_KEY` secret set

**Deployment**:
- Deploy via CLI: `supabase functions deploy <function-name> --no-verify-jwt`
- Or via Supabase Dashboard → Edge Functions
- See `supabase/functions/<function-name>/DEPLOY.md` for detailed instructions

**Secrets Required**:
- `RESEND_API_KEY` - Required for `test-email` and `send-workflow-notification` functions
  - Set via: `supabase secrets set RESEND_API_KEY=your_key`
- `SUPABASE_SERVICE_ROLE_KEY` - Required for `delete-user` and `login-as-user` functions
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
  let workflowId = workflow?.id
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
- Fall back to `ensureWorkflow(projectId)` if state is null
- Optionally sync state after `ensureWorkflow` to prevent future mismatches
- Use this pattern in all save/delete operations that depend on workflow_id


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
- **Issue**: Original session lost during impersonation
- **Solution**: Store original session in `sessionStorage` before impersonating
- **Key**: `'impersonation_original'`

### 9. TypeScript Type Updates
- **Issue**: Database types can become out of sync
- **Solution**: Manually update `src/types/database.ts` when schema changes
- **Future**: Consider Supabase CLI type generation

### 10. GitHub Pages MIME Types
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
- **Real-time**: Supabase real-time not used (could enable for live updates)
- **Caching**: No client-side caching (consider React Query)

---

## Quick Reference

### User Roles
- **dev**: Full access, user management, templates
- **master_technician**: Create/manage projects, customers, workflows
- **assistant**: Create/edit projects, view/update workflows (assigned stages only)
- **subcontractor**: Dashboard and Calendar only

### Key Routes
- `/dashboard` - User dashboard
- `/customers` - Customer list
- `/projects` - Project list
- `/workflows/:projectId` - Workflow management
- `/people` - People roster
- `/calendar` - Calendar view
- `/templates` - Template management (dev)
- `/settings` - User management (dev) and password change (all users)

### Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `RESEND_API_KEY` - Resend API key (set as Supabase secret for Edge Functions)

### Edge Functions
- `invite-user` - Send invitation email
- `create-user` - Manually create user
- `delete-user` - Delete user
- `login-as-user` - Generate impersonation magic link
- `test-email` - Send test emails using Resend service (for email template testing)
- `send-workflow-notification` - Send workflow stage notifications via email (automatically called when steps change status)

### Database Enums
- `user_role`: `'dev' | 'master_technician' | 'assistant' | 'subcontractor'`
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

**Last Updated**: 2026-01-21
**Documentation Version**: 2.6

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
