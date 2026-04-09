# Access Control and Permissions Matrix

---
file: ACCESS_CONTROL.md
type: Reference Matrix
purpose: Complete role-based permissions matrix and access control patterns
audience: Developers, Security Auditors, AI Agents
last_updated: 2026-03-27
estimated_read_time: 15-20 minutes
difficulty: Intermediate

total_roles: 7
tables_with_rls: "50+"
access_patterns: "Ownership, Adoption, Sharing"

key_sections:
  - name: "User Roles"
    line: ~18
    anchor: "#user-roles"
    description: "Detailed breakdown of all 7 roles"
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

Pipetooling implements comprehensive role-based access control (RBAC) using seven distinct user roles, each with specific permissions tailored to their responsibilities.

### Seven User Roles
1. **dev** - System administrators with full access
2. **master_technician** - Project managers and business owners
3. **assistant** - Support staff working under masters
4. **subcontractor** - External workers assigned to specific tasks
5. **estimator** - Bid estimation specialists
6. **primary** - Materials and job reports specialist (Reports and Billing tabs on Jobs; Bids full access; Dashboard with Recent Reports and Send task)
7. **superintendent** - Run jobs, manage subcontractors, draft bids (assigned projects only; no People page)

**Adding a new role?** See [ADDING_A_NEW_ROLE.md](./ADDING_A_NEW_ROLE.md) for a step-by-step guide.

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
- Impersonate other users ("imitate" function; cannot impersonate devs)
- Manage system templates
- Set user passwords
- Access all edge functions
- Delete any resource
- Export all data
- Claim dev role via Settings (enter promotion code from DEV_PROMOTION_CODE secret)
- Manage Pay Approved Masters (**Settings → People & accounts**); only dev can change Show in Hours per person
- Manage **Task Dispatch** group in **Settings → People & accounts**: choose which **assistants** receive dispatch pushes and see the Dispatch inbox on Dashboard
- Manage **Team Hours Sharing** (Settings → Dashboard & alerts): link leaders to members for My Team hours approval on Dashboard; **only dev** can set per-assignment **Leader dashboard** (full My Team vs clock strip only)
- **Dashboard → Rejected sessions (all users)**: org-wide rejected clock sessions for review (same delete as People → Hours)
- Delete reports (Jobs Reports tab); masters, assistants, primaries cannot delete reports

**Use Cases**:
- System maintenance and troubleshooting
- User account management
- Template creation and management
- Data exports and backups

---

### master_technician (Master)

**Purpose**: Project and business management

**Access**:
- Dashboard, Customers, Projects, People, Jobs, Calendar, Bids, Materials, Settings (limited)

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
- Create people in roster (including **Primary** and **Superintendent** `people` rows for pay/hours parity; adoption tables still control role access)
- Adopt assistants (grants them access to customers/projects)
- Share with other masters (grants assistant-level access)
- View people they created and people shared with them (via master_shares)
- Jobs page — Stages tab: Billed Awaiting Payment section with Total by Name modal
- Jobs page — Labor tab: Add labor jobs per person (fixture rows, job #, date, labor rate)
- Jobs page — Sub Sheet Ledger tab: View all labor jobs; Edit and Delete (own jobs); shared jobs show "Created by [name]"
- Pay tab (dev, Pay Approved Masters, or shared by dev): Due by Trade, Due by Team, Cost matrix, Teams; People pay config, Share Cost Matrix and Teams (**Settings → People & accounts** → Sharing and Adoption), Tag colors at bottom. Cost matrix date headers on two lines (Mon / 2/16) on mobile. Dev can share Cost matrix and Teams (view-only) with selected masters or assistants from that Settings section
- Pay History tab (dev, Pay Approved Masters, and their assistants): Ledger of generated pay stubs with **Search** by person name; **Paid to date** / **Balance** from **`pay_stub_payments`**; **Record payment** (partial installments); **Generate Pay Reports** bulk modal (includes **Partial** / fully paid counts) and single-person generator; **Print** from ledger row; **View** (HTML preview) from bulk modal only; dev-only delete via red trash icon
- Hours tab (dev, Pay Approved Masters, and their assistants): Timesheet entry

**Bids**:
- Full access to all bids features
- Create, edit, delete bids
- All tabs (Board, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission)
- Manage takeoff/labor/price book versions

**Materials**:
- Full CRUD on parts, prices, supply houses
- Supply Houses tab: supply house invoices (AP)
- Create and manage templates
- Create and manage purchase orders
- View price history

**Settings**:
- **People & accounts** (in-page jump `settings-people`): Adopt/unadopt assistants, primaries, superintendents; share/unshare with other masters; view adopted assistants and shared masters; (dev) Share Cost Matrix and Teams inside **Sharing and Adoption**
- Change own password
- No user management
- (Dev only) Pin Billed Awaiting Payment, Supply Houses AP, Sub Labor Due, Cost matrix to masters/devs dashboards (**Dashboard & alerts** → Dashboard Page Pins)

**Edge Functions**:
- Can call `login-as-user` (impersonate assistants/subs; cannot impersonate devs)

---

### assistant (Assistant)

**Purpose**: Support masters with customer and project work

**Access**:
- Dashboard, Customers, Projects, People, Jobs, Calendar, Bids, Materials, Prospects
- **Settings** (via gear menu): Change password, push notifications, Dashboard buttons, **Dashboard Page Pins** (Page pins card only—manage own pins, Clear all, Remove per pin), **Team Hours Sharing** (leader → member links for My Team). Does NOT see dev-only sections (Pin Billed, Cost matrix, Supply Houses AP, Sub Labor Due, user management, email templates, etc.). The PAGE_ACCESS table in Settings is a reference display; assistants can navigate to Settings.
- **Blocked**: Templates

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
- Jobs page — Stages tab: Billed Awaiting Payment, Total by Name modal
- Jobs page — Labor tab: Add labor jobs per person
- Jobs page — Sub Sheet Ledger tab: View labor jobs (own and shared); Edit/Delete own jobs; shared jobs show "Created by [name]"
- Pay tab (if shared by dev): View-only Cost matrix and Teams (no People pay config, no Add team or edit teams)
- Pay History tab (if master is Pay Approved): Ledger (with name search), generators, **Print**; **View** from bulk **Generate Pay Reports** modal; dev-only stub delete icon
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

**Jobs**:
- Team Labor tab: Hidden from assistants (dev and master only)

**Prospects**:
- Team tab: Visible to dev and assistant; shows last 30 days of prospect activity (User | Cards Marked | Cards Updated)

---

### subcontractor (Subcontractor/Sub)

**Purpose**: External workers assigned to specific stages

**Service Type Filtering**:
- Devs can restrict a subcontractor to specific service types (e.g., Plumbing only, Electrical only) for Clock In and Task Dispatch job/bid association
- Set via `subcontractor_service_type_ids` on the user record when creating or editing a subcontractor
- **NULL or empty array** = subcontractor sees all service types when associating with jobs/bids
- **Non-empty array** = subcontractor sees only bids matching those service types in Clock In and Dispatch modals
- Configurable in Settings → Manual Add User (when role is subcontractor) or Edit User (when editing a subcontractor)

**Access**:
- Dashboard, Calendar, Checklist, Settings, Tally
- **Blocked**: Customers, Projects, People, Jobs, Bids, Materials, Templates

**Permissions**:

**Severe Restrictions**:
- Can only see stages where `assigned_to_name` matches their name
- Cannot see stages they're not assigned to
- Cannot access any management pages
- Navigation: Dashboard, Calendar, Checklist, Settings, Tally
- In Settings: Cannot edit own name; dev-only People & accounts tools (Pay Approved Masters, team feedback admin, Additional People) not shown

**Dashboard**:
- View only assigned stages
- Set Start on assigned stages
- Complete assigned stages
- Cannot see private notes, line items, or projections

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
- Dashboard, Bids, Materials, Calendar, Checklist, Settings
- **Blocked**: Customers, Projects, People, Jobs, Templates

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
- No user management (can change own password via Settings)

**Use Cases**:
- Dedicated estimators who only handle bids
- Separation of estimation from project execution
- Can create customers for bids without full customer access
- Focused interface for bid workflows

**Layout Behavior**:
- Navigation shows: Dashboard, Materials, Bids, Calendar, Checklist
- Attempts to access blocked pages redirect to `/bids`

---

### primary (Primary)

**Purpose**: Materials and job reports specialist with access to Reports and Billing tabs on Jobs, full Bids access (same as estimators), plus Dashboard with Recent Reports and Send task.

**Access**:
- Dashboard, Materials, Jobs (Reports and Billing tabs), Bids (full access: all tabs, create/edit/delete bids), Calendar, Checklist, Settings
- **Blocked**: Customers, Projects, People, Quickfill, other Jobs tabs (Sub Sheet Ledger, Teams Summary)

**Service Type Filtering**:
- Devs can restrict a primary to specific service types in Materials via `primary_service_type_ids` on the user record (like `estimator_service_type_ids`)
- **NULL or empty array** = primary sees all service types
- **Non-empty array** = primary sees only those service types in Materials

**Master-Primaries Adoption**:
- Masters can adopt primaries via `master_primaries` table (**Settings → People & accounts** → Sharing and Adoption)
- Adopted primaries can add materials to jobs in Jobs Billing tab
- Primaries appear in task assignee dropdown when adopted by the viewing user's master

**Permissions**:

**Materials - Full Access**:
- Same as estimator/master_technician (subject to primary_service_type_ids if set)
- Price book management (parts, prices, supply houses)
- Template creation and editing
- Purchase order management
- Price history viewing

**Jobs - Reports and Billing Tabs**:
- **Reports tab**: View all reports via `list_reports_with_job_info` RPC; SELECT, INSERT, UPDATE on reports (delete restricted to devs only)
- **Billing tab**: View jobs and add materials; Edit/Delete buttons hidden (read + add materials only)
- Other Jobs tabs hidden (Sub Sheet Ledger, Teams Summary)

**Dashboard**:
- Recent Reports section (same as masters)
- Send task form (create and assign checklist tasks)
- ChecklistAddModal ("detail send") available when canSendTask is true

**What They Cannot Do**:
- Cannot access Customers, Projects, People
- Cannot access Jobs tabs other than Reports and Billing (no Edit/Delete on Billing)
- No Quickfill
- No user management (can change own password via Settings)

**Use Cases**:
- Field staff who manage materials and submit job reports
- Users who need to send tasks without full project visibility

**Layout Behavior**:
- Navigation shows: Dashboard, Materials, Jobs, Bids, Prospects, Calendar, Checklist
- Attempts to access blocked pages (e.g. Projects) redirect to `/dashboard`

---

### superintendent (Superintendent)

**Purpose**: Run jobs, manage subcontractors, and draft bids. Same access as assistants for projects, but only those they are assigned to.

**Access**:
- Dashboard, Projects, Workflow, Jobs, Bids, Materials, Calendar, Checklist, Settings, Tally
- **Blocked**: Customers (direct), People, Templates, Prospects
- **Jobs tabs**: Reports, Sub Sheet Ledger (hide Team Labor, Teams Summary, Stages, Billing)
- **Bids tabs**: Bid Board, Builder Review, Counts, Takeoff, Cost Estimate, RFI, Change Order, Lien Release (hide Pricing, Cover Letter, Submission)
- **Customers**: Create from Bids modal only (like estimator)
- **Assign people**: Yes (Workflow) — superintendent can assign subcontractors to stages

**Service Type Filtering**:
- Devs can restrict a superintendent to specific service types via `superintendent_service_type_ids` on the user record (like `primary_service_type_ids`)
- **NULL or empty array** = superintendent sees all service types
- **Non-empty array** = superintendent sees only those service types in Bids and Materials

**Project-Level Superintendent Assignment (Required for Project Access)**:
- Devs, masters, and assistants assign superintendents to specific projects via the Workflow page (Assigned Superintendents section)
- `project_superintendents(project_id, superintendent_id)` table; RLS uses `can_access_project_row` for assigners
- Superintendents gain access **only** via project assignment. Adoption (`master_superintendents`) no longer grants project access.

**Master-Superintendents Adoption** (legacy; does not grant project access):
- Masters can adopt superintendents via `master_superintendents` (**Settings → People & accounts** → Sharing and Adoption) for other purposes
- Project access is via `project_superintendents` only

**Permissions**:

**Workflow**:
- Can see all stages in accessible workflows (like assistant)
- Can assign people to stages (Assign button visible)
- Can see private notes
- Cannot see projections or Ledger Total

**Jobs**:
- Reports, Sub Sheet Ledger tabs only (no Stages or Billing)
- Team Labor and Teams Summary tabs hidden

**Bids**:
- Draft flow: Bid Board, Builder Review, Counts, Takeoff, Cost Estimate, RFI, Change Order, Lien Release
- Pricing, Cover Letter, Submission tabs hidden

**Materials**:
- Price book and Assembly book (subject to superintendent_service_type_ids if set)
- Supply Houses, Templates & PO, Purchase Orders tabs hidden (like primary)

**What They Cannot Do**:
- No People page (only enough access to support Workflow assignment)
- No Customers page (create from Bids modal only)
- No Pricing, Cover Letter, Submission tabs on Bids

**Layout Behavior**:
- Navigation shows: Dashboard, Projects, Workflow, Jobs, Bids, Materials, Calendar, Checklist, Settings, Tally
- Attempts to access blocked pages redirect to `/dashboard`

---

## Page Access Matrix

| Page | dev | master | assistant | sub | estimator | primary | superintendent |
|------|-----|--------|-----------|-----|-----------|---------|-----------------|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Customers** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Projects** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ assigned only |
| **Workflow** | ✅ | ✅ | ✅ limited | ❌ | ❌ | ❌ | ✅ limited |
| **People** | ✅ | ✅ | ✅ limited | ❌ | ❌ | ❌ | ❌ |
| **Jobs** | ✅ | ✅ | ✅ limited | ❌ | ❌ | ✅ Reports + Billing | ✅ Reports + Sub Ledger |
| **Dispatch** (`/schedule-dispatch`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ week grid (same `job_schedule_blocks` rules; **+ → Linked copy** / **Linked** crew rows; DnD reassign **solo** legs only) |
| **Banking** | ✅ full Mercury (Ledger + Sorting + Configuration + sync); RLS SELECT on **`mercury_transactions`** + nicknames | ❌ | ✅ **Sorting** (default slice, no Configuration / no sync); read **`mercury_transactions`** + nicknames; **edit `mercury_debit_card_nicknames`** only (RLS) | ❌ | ❌ | ❌ | ❌ |

Mercury **Person** attribution (job splits modal): staff use **`list_users_for_banking_attribution`** (**SECURITY DEFINER**, same dev/master/assistant gate as **`replace_mercury_transaction_splits`**) for the user picker; **`mercury_transaction_attributions`** may store **`user_id`** or legacy **`person_id`** (not both).
| **Calendar** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Bids** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ limited |
| **Estimates** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ limited (project-linked super visibility) |
| **Materials** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ limited |
| **Templates** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Settings** | ✅ | ✅ limited | ✅ limited | ❌ | ✅ limited | ✅ limited | ✅ limited |

### Redirection Rules

**Subcontractors**: Any page except Dashboard/Calendar/Checklist/Settings/Tally → `/dashboard`

**Estimators**: Any page except Dashboard/Materials/Estimates/Bids/Calendar/Checklist/Settings → `/bids`

**Primary**: Any page except Dashboard/Materials/Estimates/Jobs/Bids/Prospects/Calendar/Checklist/Settings → `/dashboard`; Jobs shows Reports and Billing tabs only; Bids full access (all tabs); Projects hidden

**Superintendent**: Any page except Dashboard/Projects/Workflow/Jobs/Dispatch/Bids/Materials/Estimates/Calendar/Checklist/Settings/Tally → `/dashboard`; Jobs shows Reports, Sub Sheet Ledger; Bids shows draft tabs only (no Pricing, Cover Letter, Submission); Materials shows Price book and Assembly book; People and Customers pages blocked

**Assistants**: Can access most pages but see filtered data

---

## Feature Access Matrix

### Dashboard

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configure dashboard buttons (Job, Job Labor, Bid, Project, Part, Assembly, New Prospect) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Task Dispatch (header: send task + optional reference + links to Dispatch group) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dispatch inbox (open requests, mark closed) | ✅ | ❌ | If in Dispatch group | ❌ | ❌ | ❌ | ❌ |
| My Team (pending clock sessions for assigned members; approve/reject/assign job) | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader |
| **My Time** **Edit time** (clock strip): leader **split/replace-day** RPCs — **`can_edit_clock_sessions_for_user`** (**`20260401190823`**) treats **master_technician**, **assistant**, and **superintendent** like the dev team-lead path for **any** target user (broad edit capability on those RPCs) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| NCNS from team **My Time** day editor (clock strip): **`record_ncns_and_reject_sessions_for_day`** rejects all **closed** sessions for that **`work_date`**, inserts **`attendance_incidents`**; **approved** hours removed from **`people_hours`**; **two-step** UI confirm (payroll + trust) when any session was approved; **RPC** also allowed for **team lead** for subject (same as approve/revoke), UI shown for **dev / master / assistant** with clock strip scope only | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Copy day job mix** on Dashboard **Clocked in today** (**Mix** toggle, **`CopyDayJobMixModal`**, **`leader_replace_clock_session_cluster_mixed`**): same strip roles as **My team / Everyone** — **dev / master_technician / assistant** only | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Stale tally staff follow-up** (Dashboard blue banner + modal — same stale/unlinked Mercury rules as personal stale banner; rows limited to users allowed by **`staff_can_view_user_for_tally_followup`**: **dev** any target; **master_technician** self, adopted assistants, or users on **master’s** jobs as team members; **assistant** adopting masters, same-master assistants via **`assistants_share_master`**, or users on **jobs** whose **`master_user_id`** is any master who adopted the assistant; **`list_stale_unlinked_mercury_transactions_for_tally_staff`** / **`replace_mercury_job_splits_for_linked_card_as_staff`** / **`search_jobs_for_tally_mercury_assign_as_user`**) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Rejected clock sessions (org-wide, review/delete) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Calendar

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| **NCNS** on own days: read **`attendance_incidents`** where **`subject_user_id = self`** (Calendar badge / day modal); policy `"Attendance incidents subject select own"` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Salary schedule (green)**: **`scheduled`** chips / modal workday only when **`work_date` > today**; **unpaid time off (`time_off`)** purple chip **all dates** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Recorded time** on Calendar: aggregate own **`clock_sessions`** in visible month (toggle) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

### Settings (selected)

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| People & accounts (`#settings-people`): adoption, master sharing, primaries/superintendents, Share Cost Matrix and Teams (dev); dev-only user tools and Task Dispatch above sharing | ✅ | ✅ (sharing block only) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Team Hours Sharing (leader → member links for My Team; Dashboard & alerts); **Leader dashboard** column (full vs strip only) **editable dev-only** | ✅ | ✅ view | ✅ view | ❌ | ❌ | ❌ | ❌ |

### Customer Management

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View customers | ✅ All | ✅ Own | ✅ Adopted | ❌ | ✅ Via Bids | ❌ | ❌ |
| Create customers | ✅ | ✅ | ✅ Must select master | ❌ | ✅ Via Bids modal | ❌ | ✅ Via Bids modal |
| Edit customers | ✅ | ✅ Own | ✅ Adopted | ❌ | ❌ | ❌ | ❌ |
| Delete customers | ✅ | ✅ Own | ❌ | ❌ | ❌ | ❌ | ❌ |
| Change customer owner | ✅ | ✅ Own | ❌ | ❌ | ❌ | ❌ | ❌ |
| Quick Fill | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Project Management

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View projects | ✅ All | ✅ Own | ✅ Adopted | ❌ | ❌ | ❌ | ✅ Assigned only |
| Create projects | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit projects | ✅ | ✅ Own | ✅ Adopted | ❌ | ❌ | ❌ | ❌ |
| Delete projects | ✅ | ✅ Own | ❌ | ❌ | ❌ | ❌ | ❌ |
| View stage summary | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### People Management

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View people (own + shared) | ✅ All | ✅ Own + shared | ✅ Own + shared | ❌ | ❌ | ❌ | ❌ (Workflow roster only) |
| Create people | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit/delete people | ✅ | ✅ Own | ✅ Own | ❌ | ❌ | ❌ | ❌ |
| Jobs — Labor tab: Add jobs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Jobs — Sub Sheet Ledger: View jobs | ✅ | ✅ Own + shared | ✅ Own + shared | ❌ | ❌ | ❌ | ✅ Adopted |
| Jobs — Sub Sheet Ledger: Edit/delete jobs | ✅ | ✅ Own | ✅ Own | ❌ | ❌ | ❌ | ❌ |
| Pay tab (config, cost matrix, teams) | ✅ | ✅ If Pay Approved or shared | ✅ If shared by dev (view-only) | ❌ | ❌ | ❌ | ❌ |
| Pay History tab (ledger, generators, print; view in bulk modal) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Hours tab (timesheet) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Vehicles tab (fleet CRUD, odometer, possessions) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Housing tab (units CRUD, weekly rent/utilities/insurance, possessions) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Offsets tab (backcharges, damages, apply to pay stub) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Licenses tab (license type, note, date of expiry per person) | ✅ | ✅ If Pay Approved | ✅ | ❌ | ❌ | ❌ | ❌ |
| Contracts tab (templates, assignments, document status per person) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Writeups tab (`?tab=writeups`): custom form templates, writeups about a subject user, Discussed vs Withheld disclosure; submitted rows immutable; dev-only delete submitted; **unified list** also shows **read-only** NCNS rows from **`attendance_incidents`** (same RLS as incidents); legacy `?tab=contracts&contracts_sub=writeups` redirects to `tab=writeups` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Activity tab (first-party app usage: org-wide UTC table; dev grants assistant / master / primary) | ✅ + manage grants | ✅ if granted | ✅ if granted | ❌ | ❌ | ✅ if granted | ❌ |

### Workflow Management

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View all stages | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View assigned stages only | - | - | - | ✅ | - | - | - |
| Create/edit/delete stages | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign people | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Set Start (assigned) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Complete (assigned) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Approve/Previous work incomplete | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Re-open | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View private notes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View/edit line items | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View financial totals | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View/edit projections | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Bids System

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View bids | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Create/edit bids | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Edit bid number | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete bids | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Bid Board tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Builder Review tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| RFI tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Change Order tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Lien Release tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Counts tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Takeoff tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Cost Estimate tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Pricing tab | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Cover Letter tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Submission tab | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Manage book versions | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

### Materials System

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View price book | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Edit parts/prices | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Create/edit supply houses | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Delete supply houses | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create templates | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Draft POs | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Finalize POs | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Confirm prices | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| View price history | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

### User Management

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| Create users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set user passwords | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Impersonate users | ✅ | ✅ Limited (Settings) | ✅ Limited (Settings) | ❌ | ❌ | ❌ | ❌ |
| Impersonate from People (dev-only) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Adopt assistants | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Adopt superintendents | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Share with masters | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Data Export

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| Export projects | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export materials | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Export bids | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Cleanup orphaned prices | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Data Access Patterns

### Job schedule blocks (`job_schedule_blocks`)

**SELECT**: Users who are the **assignee**, or who can see the parent **`jobs_ledger`** row via the same visibility family as **`jobs_ledger_thread_notes`** (master, dev, primary, adoption, superintendent/project access, **team** membership).

**INSERT / UPDATE / DELETE**: **`dev`**, **`master_technician`**, **`assistant`**, **`superintendent`** only, with **job manage** access matching office/superintendent rules (not subcontractors, not team-only).

**Linked rows**: Optional **`shared_block_group_id`** (UUID). Rows sharing a non-null value are edited as one logical block (times + note) in UI; each leg remains a normal row for RLS (assignee still scopes read where applicable).

**Calendar / Preview**: Assignees see their blocks; **`list_assigned_jobs_for_dashboard`** includes **`project_id`** for mapping workflow context to team jobs on the Preview modal.

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
4. **primary**: Focused access (materials + job reports only)
5. **assistant**: Conditional access (depends on adoption)
6. **subcontractor**: Minimal access (assigned stages only)

### By Use Case

**Full System Management** → dev

**Business Operations** → master_technician

**Bid Estimation** → estimator

**Materials & Reports** → primary

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
