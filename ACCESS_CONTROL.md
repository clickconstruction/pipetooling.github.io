# Access Control and Permissions Matrix

---
file: ACCESS_CONTROL.md
type: Reference Matrix
purpose: Complete role-based permissions matrix and access control patterns
audience: Developers, Security Auditors, AI Agents
last_updated: 2026-02-13
estimated_read_time: 15-20 minutes
difficulty: Intermediate

total_roles: 5
tables_with_rls: "50+"
access_patterns: "Ownership, Adoption, Sharing"

key_sections:
  - name: "User Roles"
    line: ~18
    anchor: "#user-roles"
    description: "Detailed breakdown of all 5 roles"
  - name: "Page Access Matrix"
    line: ~232
    anchor: "#page-access-matrix"
    description: "Which roles access which pages"
  - name: "Feature Access Matrix"
    line: ~257
    anchor: "#feature-access-matrix"
    description: "Feature-level permissions by role"
  - name: "Data Access Patterns"
    line: ~430
    anchor: "#data-access-patterns"
    description: "Adoption, sharing, ownership patterns"
  - name: "RLS Policy Examples"
    line: ~527
    anchor: "#rls-policy-examples"
    description: "Sample policies with explanations"
  - name: "Troubleshooting"
    line: ~596
    anchor: "#troubleshooting-access-issues"
    description: "Common access issues and fixes"

quick_navigation:
  - "[Role Comparison](#user-roles) - All roles side-by-side"
  - "[Page Access](#page-access-matrix) - Page permissions table"
  - "[Feature Access](#feature-access-matrix) - Feature permissions tables"
  - "[RLS Examples](#rls-policy-examples) - Policy code samples"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - RLS patterns section"
  - "[GLOSSARY.md](./GLOSSARY.md) - Access control terms"
  - "[AI_CONTEXT.md](./AI_CONTEXT.md) - Access control overview"

when_to_read:
  - Implementing new RLS policies
  - Debugging access/permissions issues
  - Understanding role capabilities
  - Adding new features with access control
  - Security auditing
---

## Table of Contents
1. [Overview](#overview)
2. [User Roles](#user-roles)
3. [Page Access Matrix](#page-access-matrix)
4. [Feature Access Matrix](#feature-access-matrix)
5. [Data Access Patterns](#data-access-patterns)
6. [Special Relationships](#special-relationships)

---

## Overview

Pipetooling implements comprehensive role-based access control (RBAC) using five distinct user roles, each with specific permissions tailored to their responsibilities.

### Five User Roles
1. **dev** - System administrators with full access
2. **master_technician** - Project managers and business owners
3. **assistant** - Support staff working under masters
4. **subcontractor** - External workers assigned to specific tasks
5. **estimator** - Bid estimation specialists

### Access Control Mechanisms
- **Frontend**: Page-level routing restrictions with redirects
- **Backend**: Row Level Security (RLS) policies on all tables
- **Database**: Foreign key relationships enforce data ownership
- **Edge Functions**: Role validation before privileged operations

---

## User Roles

### dev (Developer/Administrator)

**Purpose**: System administration and full control

**Access**: Everything

**Special Permissions**:
- Create, edit, and delete users
- Impersonate other users ("imitate" function)
- Manage system templates
- Set user passwords
- Access all edge functions
- Delete any resource
- Export all data
- Claim dev role with code `'admin1234'`
- Manage Pay Approved Masters (Settings); only dev can change Show in Hours per person

**Use Cases**:
- System maintenance and troubleshooting
- User account management
- Template creation and management
- Data exports and backups

---

### master_technician (Master)

**Purpose**: Project and business management

**Access**:
- Dashboard, Customers, Projects, People, Calendar, Bids, Materials, Settings (limited)

**Permissions**:

**Customers**:
- Create (automatically becomes owner)
- View own customers and shared customers
- Edit own customers (including changing master owner)
- Delete own customers

**Projects**:
- Create (owner matches customer owner)
- View own projects and shared projects
- Edit own projects (cannot change owner - tied to customer)
- Delete own projects

**Workflows**:
- Full access to own workflows
- Create, edit, delete stages
- Assign people to stages
- See private notes
- Manage line items and projections
- See financial totals

**People**:
- Create people in roster
- Adopt assistants (grants them access to customers/projects)
- Share with other masters (grants assistant-level access)
- View people they created and people shared with them (via master_shares)
- Labor tab: Add labor jobs per person (fixture rows, job #, date, labor rate)
- Ledger tab: View all labor jobs; Edit and Delete (own jobs); shared jobs show "Created by [name]"
- Pay tab (dev, Pay Approved Masters, or shared by dev): People pay config (dev/approved only), Cost matrix, Teams. Dev can share Cost matrix and Teams (view-only) with selected masters or assistants via "Share Cost Matrix and Teams" section
- Hours tab (dev, Pay Approved Masters, and their assistants): Timesheet entry

**Bids**:
- Full access to all bids features
- Create, edit, delete bids
- All tabs (Board, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission)
- Manage takeoff/labor/price book versions

**Materials**:
- Full CRUD on parts, prices, supply houses
- Create and manage templates
- Create and manage purchase orders
- View price history

**Settings**:
- Adopt/unadopt assistants
- Share/unshare with other masters
- View adopted assistants and shared masters
- Change own password
- No user management

**Edge Functions**:
- Can call `login-as-user` (impersonate assistants/subs)

---

### assistant (Assistant)

**Purpose**: Support masters with customer and project work

**Access**:
- Dashboard, Customers, Projects, People, Calendar, Bids, Materials
- **Blocked**: Settings (except viewing adoptions), Templates

**Permissions**:

**Adoption Requirement**:
- Must be adopted by a master to access their data
- Can be adopted by multiple masters (many-to-many)
- Only sees customers/projects from masters who adopted them

**Customers**:
- View customers from adopted masters
- Create customers (must select adopting master as owner)
- Edit customers from adopted masters
- Cannot delete customers

**Projects**:
- View projects from adopted masters
- Create projects (owner matches customer owner)
- Edit projects from adopted masters
- Cannot delete projects

**Workflows**:
- **Can see ALL stages** in accessible workflows (not just assigned)
- Use action buttons (Set Start, Complete, Re-open) only on assigned stages
- Cannot edit/delete/assign stages
- Cannot see private notes
- **Can view and edit line items** (but cannot see financial totals)
- Cannot see projections
- Cannot see Ledger Total or Total Left on Job

**People**:
- View people they created and people shared with their master (via master_shares)
- Labor tab: Add labor jobs per person
- Ledger tab: View labor jobs (own and shared); Edit/Delete own jobs; shared jobs show "Created by [name]"
- Pay tab (if shared by dev): View-only Cost matrix and Teams (no People pay config, no Add team or edit teams)
- Hours tab (if master is Pay Approved): Timesheet entry for people in roster

**Bids**:
- Full access to all bids features (same as master/dev)
- Can create customers via "+ Add new customer" in Bids (must select master)
- Manage bids, counts, takeoffs, cost estimates, pricing

**Materials**:
- Full access (same as master/dev)
- Manage price book, templates, purchase orders
- Confirm prices on POs

**Special Features**:
- Can be shared with by masters (receives access to shared masters' data)
- Shared access is assistant-level (view-only, no private notes/financials)

---

### subcontractor (Subcontractor/Sub)

**Purpose**: External workers assigned to specific stages

**Access**:
- Dashboard, Calendar only
- **Blocked**: All other pages (Customers, Projects, People, Bids, Materials, Settings, Templates)

**Permissions**:

**Severe Restrictions**:
- Can only see stages where `assigned_to_name` matches their name
- Cannot see stages they're not assigned to
- Cannot access any management pages
- Navigation hides all links except Dashboard and Calendar

**Dashboard**:
- View only assigned stages
- Set Start on assigned stages
- Complete assigned stages
- Cannot see private notes, line items, or projections

**Calendar**:
- View only assigned stages with scheduled dates

**What They Cannot Do**:
- Cannot create, edit, or delete anything
- Cannot assign people
- Cannot view customer or project information
- Cannot access materials or bids
- Cannot see other stages in same project
- No access to financial information

**Use Cases**:
- External plumbers assigned to specific work
- Limited visibility for security
- Task-based access only

---

### estimator (Estimator)

**Purpose**: Bid estimation and material pricing specialist

**Access**:
- Bids, Materials only
- **Blocked**: Dashboard, Customers, Projects, People, Templates, Calendar, Settings

**Service Type Filtering**:
- Devs can restrict an estimator to specific service types (e.g., Electrical only, Plumbing only)
- Set via `estimator_service_type_ids` on the user record when creating or editing an estimator
- **NULL or empty array** = estimator sees all service types (Plumbing, Electrical, HVAC) — backward compatible
- **Non-empty array** = estimator sees only those service types; Bids and Materials tabs/selector show only allowed types
- RLS policies enforce access at query time; frontend hides disallowed service type tabs
- Configurable in Settings → Manual Add User (when role is estimator) or Edit User (when editing an estimator)

**Permissions**:

**Bids - Full Access**:
- All 6 tabs (Bid Board, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission)
- Create, edit, and delete bids
- Enter counts, map templates, calculate costs
- Manage labor book and price book assignments
- Track submissions and outcomes
- Can see all customers in GC/Builder dropdown (RLS SELECT permission)
- **Can create new customers** via "+ Add new customer" modal:
  - Must assign Customer Owner (Master) - sees all masters and devs in dropdown (RLS policy `allow_estimators_see_masters`)
  - Cannot access `/customers` page directly
  - RLS allows INSERT when `master_user_id` set to valid master

**Materials - Full Access**:
- Same permissions as master_technician
- Price book management (parts, prices, supply houses)
- Template creation and editing
- Purchase order management
- Price history viewing

**Takeoff/Labor/Price Books**:
- Full CRUD on all book versions and entries
- Same access as master_technician

**What They Cannot Do**:
- Cannot access ongoing project management
- Cannot view or edit workflows
- Cannot assign people to stages
- Cannot access customer management page
- No settings or user management
- No calendar or dashboard views

**Use Cases**:
- Dedicated estimators who only handle bids
- Separation of estimation from project execution
- Can create customers for bids without full customer access
- Focused interface for bid workflows

**Layout Behavior**:
- Navigation shows only: Bids, Materials
- Attempts to access other pages redirect to `/bids`

---

## Page Access Matrix

| Page | dev | master | assistant | sub | estimator |
|------|-----|--------|-----------|-----|-----------|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Customers** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Projects** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Workflow** | ✅ | ✅ | ✅ limited | ❌ | ❌ |
| **People** | ✅ | ✅ | ✅ limited | ❌ | ❌ |
| **Calendar** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Bids** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Materials** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Templates** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Settings** | ✅ | ✅ limited | ❌ | ❌ | ❌ |

### Redirection Rules

**Subcontractors**: Any page except Dashboard/Calendar → `/dashboard`

**Estimators**: Any page except Bids/Materials → `/bids`

**Assistants**: Can access most pages but see filtered data

---

## Feature Access Matrix

### Customer Management

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| View customers | ✅ All | ✅ Own | ✅ Adopted | ❌ | ✅ Via Bids |
| Create customers | ✅ | ✅ | ✅ Must select master | ❌ | ✅ Via Bids modal |
| Edit customers | ✅ | ✅ Own | ✅ Adopted | ❌ | ❌ |
| Delete customers | ✅ | ✅ Own | ❌ | ❌ | ❌ |
| Change customer owner | ✅ | ✅ Own | ❌ | ❌ | ❌ |
| Quick Fill | ✅ | ✅ | ✅ | ❌ | ❌ |

### Project Management

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| View projects | ✅ All | ✅ Own | ✅ Adopted | ❌ | ❌ |
| Create projects | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit projects | ✅ | ✅ Own | ✅ Adopted | ❌ | ❌ |
| Delete projects | ✅ | ✅ Own | ❌ | ❌ | ❌ |
| View stage summary | ✅ | ✅ | ✅ | ❌ | ❌ |

### People Management

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| View people (own + shared) | ✅ All | ✅ Own + shared | ✅ Own + shared | ❌ | ❌ |
| Create people | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit/delete people | ✅ | ✅ Own | ✅ Own | ❌ | ❌ |
| Labor tab: Add jobs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ledger: View jobs | ✅ | ✅ Own + shared | ✅ Own + shared | ❌ | ❌ |
| Ledger: Edit/delete jobs | ✅ | ✅ Own | ✅ Own | ❌ | ❌ |
| Pay tab (config, cost matrix, teams) | ✅ | ✅ If Pay Approved or shared | ✅ If shared by dev (view-only) | ❌ | ❌ |
| Hours tab (timesheet) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ |

### Workflow Management

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| View all stages | ✅ | ✅ | ✅ | ❌ | ❌ |
| View assigned stages only | - | - | - | ✅ | - |
| Create/edit/delete stages | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign people | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set Start (assigned) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Complete (assigned) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve/Reject | ✅ | ✅ | ❌ | ❌ | ❌ |
| Re-open | ✅ | ✅ | ✅ | ❌ | ❌ |
| View private notes | ✅ | ✅ | ❌ | ❌ | ❌ |
| View/edit line items | ✅ | ✅ | ✅ | ❌ | ❌ |
| View financial totals | ✅ | ✅ | ❌ | ❌ | ❌ |
| View/edit projections | ✅ | ✅ | ❌ | ❌ | ❌ |

### Bids System

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| View bids | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create/edit bids | ✅ | ✅ | ✅ | ❌ | ✅ |
| Delete bids | ✅ | ✅ | ✅ | ❌ | ✅ |
| Counts tab | ✅ | ✅ | ✅ | ❌ | ✅ |
| Takeoff tab | ✅ | ✅ | ✅ | ❌ | ✅ |
| Cost Estimate tab | ✅ | ✅ | ✅ | ❌ | ✅ |
| Pricing tab | ✅ | ✅ | ✅ | ❌ | ✅ |
| Cover Letter tab | ✅ | ✅ | ✅ | ❌ | ✅ |
| Submission tab | ✅ | ✅ | ✅ | ❌ | ✅ |
| Manage book versions | ✅ | ✅ | ✅ | ❌ | ✅ |

### Materials System

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| View price book | ✅ | ✅ | ✅ | ❌ | ✅ |
| Edit parts/prices | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create/edit supply houses | ✅ | ✅ | ✅ | ❌ | ✅ |
| Delete supply houses | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create templates | ✅ | ✅ | ✅ | ❌ | ✅ |
| Draft POs | ✅ | ✅ | ✅ | ❌ | ✅ |
| Finalize POs | ✅ | ✅ | ✅ | ❌ | ✅ |
| Confirm prices | ✅ | ✅ | ✅ | ❌ | ✅ |
| View price history | ✅ | ✅ | ✅ | ❌ | ✅ |

### User Management

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| Create users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set user passwords | ✅ | ❌ | ❌ | ❌ | ❌ |
| Impersonate users | ✅ | ✅ Limited | ❌ | ❌ | ❌ |
| Adopt assistants | ❌ | ✅ | ❌ | ❌ | ❌ |
| Share with masters | ❌ | ✅ | ❌ | ❌ | ❌ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ |

### Data Export

| Feature | dev | master | assistant | sub | estimator |
|---------|-----|--------|-----------|-----|-----------|
| Export projects | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export materials | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export bids | ✅ | ❌ | ❌ | ❌ | ✅ |
| Cleanup orphaned prices | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Data Access Patterns

### Master-Assistant Adoption

**Pattern**: Masters grant assistants access to their customers and projects

**Mechanism**: `master_assistants` table (many-to-many)

**RLS Policy Example**:
```sql
-- Assistant can see customer if master adopted them
EXISTS (
  SELECT 1 FROM master_assistants
  WHERE master_id = customers.master_user_id
  AND assistant_id = auth.uid()
)
```

**Tables Using This Pattern**:
- `customers`
- `projects`
- `project_workflows`
- `project_workflow_steps`
- `workflow_step_line_items`
- `workflow_projections`

**Benefits**:
- Flexible: One assistant can work for multiple masters
- Selective: Masters control which assistants see their data
- Scalable: Many-to-many relationship supports large teams

### Master-Master Sharing

**Pattern**: Masters grant other masters assistant-level access

**Mechanism**: `master_shares` table (many-to-many)

**RLS Policy Example**:
```sql
-- Master B can see Master A's customer if A shared with B
EXISTS (
  SELECT 1 FROM master_shares
  WHERE sharing_master_id = customers.master_user_id
  AND viewing_master_id = auth.uid()
)
```

**Access Level**: Assistant-level (view-only, no private notes/financials)

**Tables Using This Pattern**:
- Same as master-assistant adoption
- `people`, `people_labor_jobs`, `people_labor_job_items` (viewing master and their assistants see shared people and labor jobs; shared people show "Created by [name]")
- Shared masters have same restrictions as assistants

**Use Cases**:
- Collaboration between masters
- Backup coverage when master unavailable
- Training new masters

### Ownership Pattern

**Pattern**: Resources have an owner (user_id or master_user_id)

**Mechanism**: Foreign key to `users.id`

**RLS Policy Example**:
```sql
-- User can see their own resources
master_user_id = auth.uid()
```

**Tables Using This Pattern**:
- `customers` (master_user_id)
- `projects` (master_user_id)
- `purchase_orders` (created_by)
- `people` (master_user_id)
- `people_labor_jobs` (master_user_id)

**Cascade Behavior**:
- Projects inherit customer owner (automatic)
- Cannot change project owner (tied to customer)
- Deleting customer cascades to projects (optional CASCADE)

---

## Special Relationships

### Project Owner Follows Customer

**Rule**: `projects.master_user_id` always matches `customers.master_user_id`

**Enforcement**:
- Frontend: Project owner not selectable (auto-set from customer)
- Database: Trigger `cascade_customer_master_to_projects()` maintains consistency

**Migration**: When customer owner changes, all their projects update automatically

### Assigned Person (No User Required)

**Rule**: Stages can be assigned to names, not just users

**Pattern**: `assigned_to_name` field stores plain text name

**Flexibility**:
- Can assign to users (matches name from `users` table)
- Can assign to roster entries (matches name from `people` table)
- Can assign to any name (even if no account exists)

**Access Control**:
- Assistants/subs can only act on stages where `assigned_to_name` matches their name
- Masters/devs can act on any stage

### Estimator Customer Creation

**Special Case**: Estimators can create customers without full customer access

**Mechanism**:
- **SELECT RLS**: Allows estimators to see all customers (for dropdowns)
- **INSERT RLS**: Allows when `master_user_id` set to valid master
- **No UPDATE/DELETE**: Estimators cannot modify existing customers
- **No Page Access**: Cannot navigate to `/customers` page

**Workflow**:
1. Estimator opens "+ Add new customer" modal in Bids
2. Selects master from dropdown (all masters shown)
3. Fills customer details
4. Saves - customer created with selected master as owner
5. New customer automatically selected as bid's GC/Builder

**Benefits**:
- Estimators can handle new customers during bid process
- Maintains proper ownership (customer assigned to master)
- Separation of concerns (estimation vs. ongoing management)

---

## Permission Summary

### By Complexity (Least to Most Restrictive)

1. **dev**: Full system access
2. **master_technician**: Full business access (own data + shared)
3. **estimator**: Focused access (bids + materials only)
4. **assistant**: Conditional access (depends on adoption)
5. **subcontractor**: Minimal access (assigned stages only)

### By Use Case

**Full System Management** → dev

**Business Operations** → master_technician

**Bid Estimation** → estimator

**Operational Support** → assistant

**Task Execution** → subcontractor

---

## Related Documentation

- [PROJECT_DOCUMENTATION.md - Authentication & Authorization](./PROJECT_DOCUMENTATION.md#authentication--authorization)
- [PROJECT_DOCUMENTATION.md - User Roles](./PROJECT_DOCUMENTATION.md#user-roles)
- [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) - Edge function role requirements
- [BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids system access details

---

## RLS Policy Examples

### customers Table

```sql
-- SELECT: View own customers, adopted customers, shared customers
CREATE POLICY "Users can view accessible customers" ON customers
FOR SELECT USING (
  master_user_id = auth.uid()  -- Own customers
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'dev')  -- Devs see all
  OR EXISTS (  -- Assistants see adopted masters' customers
    SELECT 1 FROM master_assistants
    WHERE master_id = master_user_id AND assistant_id = auth.uid()
  )
  OR EXISTS (  -- Masters see shared masters' customers
    SELECT 1 FROM master_shares
    WHERE sharing_master_id = master_user_id AND viewing_master_id = auth.uid()
  )
  OR EXISTS (  -- Estimators see all customers (for dropdowns)
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'estimator'
  )
);
```

### project_workflow_steps Table

```sql
-- SELECT: Assistants see all stages in accessible workflows
-- Subcontractors only see assigned stages
CREATE POLICY "Users can view accessible workflow steps" ON project_workflow_steps
FOR SELECT USING (
  EXISTS (  -- Can access parent project
    SELECT 1 FROM project_workflows w
    JOIN projects p ON w.project_id = p.id
    WHERE w.id = workflow_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'dev')
      OR EXISTS (
        SELECT 1 FROM master_assistants
        WHERE master_id = p.master_user_id AND assistant_id = auth.uid()
      )
    )
  )
  OR (  -- Subcontractors: only assigned stages
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'subcontractor')
    AND assigned_to_name IN (SELECT name FROM users WHERE id = auth.uid())
  )
);
```

---

## Troubleshooting Access Issues

### User Can't See Expected Data

**Check**:
1. Verify user role in `public.users` table
2. Check `master_assistants` for adoption relationships
3. Check `master_shares` for sharing relationships
4. Verify resource ownership (`master_user_id` fields)

### 403 Forbidden Errors

**Common Causes**:
1. User lacks required role for operation
2. Resource owned by different master
3. Missing adoption/sharing relationship
4. RLS policy blocking access

**Debug**:
```sql
-- Check user role
SELECT role FROM users WHERE id = auth.uid();

-- Check adoptions
SELECT * FROM master_assistants WHERE assistant_id = auth.uid();

-- Check shares
SELECT * FROM master_shares WHERE viewing_master_id = auth.uid();
```

### Edge Function Access Denied

**Check**:
1. Authorization header present and valid
2. JWT token not expired (sign out/in to refresh)
3. User has required role for function
4. Service role key configured (for admin functions)
