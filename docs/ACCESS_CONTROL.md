# Access Control and Permissions Matrix

---
file: ACCESS_CONTROL.md
type: Reference Matrix
purpose: Complete role-based permissions matrix and access control patterns
audience: Developers, Security Auditors, AI Agents
last_updated: 2026-05-16
estimated_read_time: 15-20 minutes
difficulty: Intermediate

total_roles: 8
tables_with_rls: "50+"
access_patterns: "Ownership, Adoption, Sharing"

key_sections:
  - name: "User Roles"
    line: ~18
    anchor: "#user-roles"
    description: "Detailed breakdown of all 8 roles"
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

Pipetooling implements comprehensive role-based access control (RBAC) using eight distinct user roles, each with specific permissions tailored to their responsibilities.

### Eight User Roles
1. **dev** - System administrators with full access
2. **master_technician** - Project managers and business owners
3. **assistant** - Support staff working under masters
4. **subcontractor** - External workers assigned to specific tasks
5. **helpers** - Field workers with **the same app routing, RLS parity, and Clock/Dispatch service-type rules as subcontractors**; scoped via `helpers_service_type_ids` (same semantics as `subcontractor_service_type_ids`)
6. **estimator** - Bid estimation specialists
7. **primary** - Materials and job reports specialist (Reports and Billing tabs on Jobs; Bids full access; Dashboard with Recent Reports and Send task)
8. **superintendent** - Run jobs, manage subcontractors, draft bids (assigned projects only; no People page)

**Adding a new role?** See [ADDING_A_NEW_ROLE.md](./ADDING_A_NEW_ROLE.md) for a step-by-step guide.

### Access Control Mechanisms
- **Frontend**: Page-level routing restrictions with redirects
- **Backend**: Row Level Security (RLS) policies on all tables
- **Database**: Foreign key relationships enforce data ownership
- **Edge Functions**: Role validation before privileged operations

### Stripe out-of-band payment unwind (v2.362, refinements v2.363)
- **Who**: **`dev`**, **`master_technician`**, **`assistant`**, and **`primary`** with the same job-access pattern as **`mark_invoice_paid`** (RPC **`revert_stripe_oob_invoice_payment`** enforces this).
- **Where**: **Hosted Stripe bill** panel (**`HostedStripeBillPanel`**) when the ledger invoice is **Paid** — **Undo out-of-band payment** issues a Stripe **credit note** (no card charge on the invoice) and reverts the ledger row to **Billed**. **v2.363**: optional **`onAfterOobUnwindSuccess`** refreshes **Edit Job** **Payments received** and **Bill Customer** success-screen job snapshots so **`jobs_ledger_payments`** removals match the form without reopening the editor.
- **Audit**: Staff with job access may **`SELECT`** **`stripe_oob_payment_reverts`**; **`dev`** has full table access.

### Edit Job payment unlink (`remove_jobs_ledger_payment_and_reconcile`, v2.436)
- **Who**: **`dev`**, **`master_technician`**, **`assistant`**, and **`primary`** — RPC enforces role + the same job-access **`EXISTS`** pattern used by other billing RPCs (e.g. **`mark_invoice_paid`**). **`superintendent`** and other roles do not receive **`EXECUTE`** on this function.
- **Where**: **Edit Job** → **Billing** → **Payments received** — **Mercury** **Unlink and remove**, and removing persisted **non-Mercury** rows tied to **non-Stripe** **`jobs_ledger_invoices`** (after confirm).
- **Stripe-hosted invoices**: RPC **rejects** when the payment’s **`invoice_id`** points at an invoice with non-empty **`stripe_invoice_id`**; UI hides **Unlink** in that case. Use Stripe / out-of-band reversal flows for hosted invoice payments.

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
- Manage **Team Hours Sharing** (Settings → Dashboard & alerts **or** **People → Teams**, `?tab=teams`): link leaders to members for My Team hours approval on Dashboard; **only dev** can set per-assignment **Leader dashboard** (full My Team vs clock strip only)
- **Dashboard → Rejected sessions (all users)**: org-wide rejected clock sessions for review (same delete as People → Hours)
- **Dashboard → Clock strip — Email schedule** (`ScheduleDayEmailModal`): **dev** may queue a dispatch-schedule email for **any non-archived user** (`schedule_day_email_requests`; RLS **`schedule_day_email_requests_insert_dev_any_recipient`**); other staff may queue **only for self**. See **`RECENT_FEATURES.md`** (e.g. v2.523).
- **People → Feedback** (`?tab=feedback`, dev-only): full team feedback admin (**`TeamFeedbackDevSettingsBlock`**) — **Enabled** persists to **`team_feedback_settings`**; **Settings** / **Eligibility** modals; raw submissions (detail modal, CSV, dev delete). Same surface as **Settings → People & accounts → Team feedback**
- Delete reports (Jobs Reports tab); masters, assistants, primaries cannot delete reports
- Jobs **Reports tab** — **Recurring Email Reports**: configure org digest schedules and recipients (optional per-recipient **include costs**, which emails wage-derived dollar amounts for clocked people to that recipient). **`user_can_manage_recurring_job_report_scope`** and Edge **`recurring-job-report-*`**; see **`RECENT_FEATURES.md`** v2.425, **`EDGE_FUNCTIONS.md`**, **`PROJECT_DOCUMENTATION.md`** (Jobs Reports tab)

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
- Jobs page — Stages tab: Billed Awaiting Payment section with Total by Name modal; **Combine / Separate** (toolbar **right**, after **Total by Name**) — **[`JobsCombineSeparateModal`](../src/components/jobs/JobsCombineSeparateModal.tsx)** (**`RECENT_FEATURES.md`** **v2.516**); RPCs enforce staff + job access
- Jobs page — Labor tab: Add labor jobs per person (fixture rows, job #, date, labor rate)
- Jobs page — Sub Sheet Ledger tab: View all labor jobs; Edit and Delete (own jobs); shared jobs show "Created by [name]"
- Jobs page — **Reports tab** — **Recurring Email Reports**: same as dev (schedules, recipients, optional **include costs** in digest emails)
- **Hours** tab (dev, Pay Approved Masters, and their assistants): Shared **week / date range**; **section jump** row; **Dashboard**-style clock strip; pending / approved / rejected sessions; timesheet grid; **Review Hours & pay config** (modal + **Hours reviewed** ledger + pay settings for dev and Pay Approved Masters); **Due by Trade / Team**; **Cost matrix** and **Teams**; **Share Cost Matrix and Teams** and **Tag colors** at bottom (dev, **Settings → People & accounts** → Sharing and Adoption — dev can grant view-only matrix/Teams to selected masters or assistants). Legacy **`?tab=pay`** opens **Hours**. Cost matrix date headers on two lines (Mon / 2/16) on mobile.
- Payroll tab (dev, Pay Approved Masters, and their assistants): Ledger of generated pay stubs with **Search** by person name; **Paid to date** / **Balance** from **`pay_stub_payments`**; **Record payment** (partial installments); **Generate Pay Reports** bulk modal (includes **Partial** / fully paid counts) and single-person generator; **Print** from ledger row; **View** (HTML preview) from bulk modal only; dev-only delete via red trash icon; **Draft Payroll** — **Cash Due**, clickable **Hours** breakdown (**v2.514**, **`RECENT_FEATURES.md`**), grey row **View**, optional dev stub delete in modal
- **People → Teams** (`?tab=teams`): manage **`team_leader_assignments`** (leader→member links for Dashboard **My Team**); same capabilities as Settings **Team Hours Sharing**; per-link **Leader dashboard** visibility (**full** vs **strip only**) — **dev-only**
- **People → Overhead** (`?tab=overhead`): daily **approved, closed** clock labor $ on the configured **office** job (**`app_settings`**) + **bid** time; dev sets office **`jobs_ledger`** id

**Bids**:
- Full access to all bids features
- Create, edit, delete bids
- All tabs (Board, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission)
- Manage takeoff/labor/price book versions

**Materials**:
- Full CRUD on parts, prices, supply houses
- **Supply Houses** and **PO Generator** tabs: supply house invoices (AP); PO Generator ledger (**`material_po_generator_entries`**, dev/master/assistant)
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
- **Settings** (via gear menu): Change password, push notifications, Dashboard buttons, **Dashboard Page Pins** (Page pins card only—manage own pins, Clear all, Remove per pin), **Team Hours Sharing** (leader → member links for My Team; same data as **People → Teams**). Does NOT see dev-only sections (Pin Billed, Cost matrix, Supply Houses AP, Sub Labor Due, user management, email templates, etc.). The PAGE_ACCESS table in Settings is a reference display; assistants can navigate to Settings.
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
- Jobs page — Stages tab: Billed Awaiting Payment, Total by Name modal; **Combine / Separate** (toolbar **right**) — same **dev** / **master_technician** / **assistant** gate as **Job Book** (**v2.516**)
- Jobs page — Labor tab: Add labor jobs per person
- Jobs page — Sub Sheet Ledger tab: View labor jobs (own and shared); Edit/Delete own jobs; shared jobs show "Created by [name]"
- **Hours** tab (if master is Pay Approved): Timesheet, sessions, and grid; **Review Hours** / **Hours reviewed** when applicable; when dev shared Cost matrix: view-only **Cost matrix** and **Teams** — no **People** pay config, no add/edit teams
- Payroll tab (if master is Pay Approved): Ledger (with name search), generators, **Print**; **View** from bulk **Generate Pay Reports** modal; dev-only stub delete icon; **Draft Payroll** UX as in **`RECENT_FEATURES`** **v2.514**
- **People → Teams** (`?tab=teams`): manage **`team_leader_assignments`** (same as Settings **Team Hours Sharing**); per-link **Leader dashboard** — **dev-only**

**Bids**:
- Full access to all bids features (same as master/dev)
- Can create customers via "+ Add new customer" in Bids (must select master)
- Manage bids, counts, takeoffs, cost estimates, pricing

**Materials**:
- Full access (same as master/dev)
- Manage price book, templates, purchase orders; **Supply Houses** and **PO Generator** tabs
- Confirm prices on POs

**Special Features**:
- Can be shared with by masters (receives access to shared masters' data)
- Shared access is assistant-level (view-only, no private notes/financials)

**Jobs**:
- Team Labor tab: Hidden from assistants (dev and master only)
- **Reports tab** — **Recurring Email Reports**: schedules and recipients with optional **include costs** (same product as dev/master; **`user_can_manage_recurring_job_report_scope`**)

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

### helpers (Helper)

**Purpose**: Same product experience as **subcontractor** — field/crew users with limited navigation, assigned workflow stages only, Clock In and Dispatch filtered by **`helpers_service_type_ids`**, and **`people.kind` = `helper`** for off-roster roster rows.

**Access and permissions**: Treat as **subcontractor** everywhere in this document unless a feature explicitly lists only **subcontractor** — the **`helpers`** enum value is included for parity (routing: `Layout` / `SUBCONTRACTOR_PATHS`, `isSubcontractorLikeRole()`, RLS/RPC batches, Edge guards, Settings manual add/edit).

**Service type filtering**: Configure via **`helpers_service_type_ids`** on `users` (Settings when role is **helpers**), not the subcontractor column.

**Dashboard Assigned Jobs**: **Send to Billing** (Working → Ready to Bill) is **hidden** on the dashboard card; **`update_job_status`** rejects that transition on the plain team-member path for **`helpers`** (same UX intent as subcontractors not billing from this surface — **`RECENT_FEATURES.md`** v2.411, migration **`20270506120000_update_job_status_disallow_helpers_send_to_billing.sql`**).

---

### estimator (Estimator)

**Purpose**: Bid estimation and material pricing specialist

**Access**:
- Dashboard, Materials, Estimates, Bids, **Map** (`/map`), Calendar, Checklist, People, Settings, Tally, Prospects (if enabled)
- **Customers** (`/customers`): list, search, notes, create (master required), edit **basic fields** (name, address, contact, customer type, date met). **Advanced** (customer owner), **merge**, and **delete** are not available in the UI; DB blocks changing **owner** (`master_user_id`) and **Stripe** (`stripe_customer_id`) on save.
- **Blocked**: Projects, People, Jobs, Templates

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
- **Can create new customers** via "+ Add new customer" modal or **Customers** page:
  - Must assign Customer Owner (Master) - sees all masters and devs in dropdown (RLS policy `allow_estimators_see_masters`)
  - RLS allows INSERT when `master_user_id` set to valid master
- **Can edit existing customers** from **Customers** page or edit modal: UPDATE RLS + trigger forbid changing `master_user_id` or `stripe_customer_id`

**Materials - Full Access**:
- Same permissions as master_technician **except** the **Supply Houses** and **PO Generator** tabs are **hidden** in the UI (restricted URLs redirect—same pattern as primaries for those tabs)
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
- Cannot change **customer owner**, **Stripe** link, **merge**, or **delete** customers
- No user management (can change own password via Settings)

**Use Cases**:
- Dedicated estimators who only handle bids
- Separation of estimation from project execution
- Can create and edit customers within the limits above (no owner/Stripe/merge/delete)
- Focused interface for bid workflows

**Layout Behavior**:
- Navigation shows: Dashboard, Materials, Estimates, Bids, **Customers**, Prospects (if enabled), Calendar, Checklist, People (desktop inline nav); **mobile** — **Dashboard** is the **first row inside the hamburger menu** (not the icon strip beside the menu); remaining items and **gear** shortcuts (Documents, Materials, Checklist, **Map**) match [`Layout.tsx`](../src/components/Layout.tsx)
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
- **UI**: **Supply Houses** and **PO Generator** tabs hidden (restricted URLs redirect)
- Price book management (parts, prices, supply houses)
- Template creation and editing
- Purchase order management
- Price history viewing

**Jobs - Reports and Billing Tabs**:
- **Reports tab**: View all reports via `list_reports_with_job_info` RPC; SELECT, INSERT, UPDATE on reports (delete restricted to devs only)
- **Billing tab**: View jobs and add materials; Edit/Delete buttons hidden (read + add materials only)
- Other Jobs tabs hidden (Sub Sheet Ledger, Teams Summary)

**Dashboard**:
- Recent Reports section (same as masters); **primary** defaults **collapsed** and does **not** auto-expand when reports are unread (**`RECENT_FEATURES`** **v2.494**)
- **My Bids** section (estimator/account-manager bids); title **My Bids (`n`)** after load; **primary** defaults **collapsed** (**`RECENT_FEATURES`** **v2.494**)
**Unallocated bank deposits** — **Dashboard** blue banner uses **`canRoleSeeArBankUnallocatedDashboardBanner`** (**dev** + **assistant** only; **master_technician** does not — **`RECENT_FEATURES`** **v2.497**). **Quickfill** / **`/accounts-receivable`** still use **`canRoleSeeArBankUnallocatedOrgNudge`** (**dev**, **master_technician**, **assistant**; excludes **primary**). **Bank Payments** / AR on **Jobs → Stages** uses **`canRoleUseArBankCount`** when applicable
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
- Supply Houses, **PO Generator**, Templates & PO, Purchase Orders tabs hidden (like primary)

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
| **Customers** | ✅ | ✅ | ✅ | ❌ | ✅ limited | ❌ | ❌ |
| **Projects** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ assigned only |
| **Workflow** | ✅ | ✅ | ✅ limited | ❌ | ❌ | ❌ | ✅ limited |
| **People** | ✅ | ✅ | ✅ limited | ❌ | ❌ | ❌ | ❌ |
| **Jobs** | ✅ | ✅ | ✅ limited | ❌ | ❌ | ✅ Reports + Billing | ✅ Reports + Sub Ledger |
| **Dispatch** (`/schedule-dispatch`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ week grid (same `job_schedule_blocks` rules; **+ → Linked copy** / **Linked** crew rows; DnD reassign **solo** legs only) |
| **Banking** | ✅ full Mercury (Ledger + User Sort + Drag Sort + **Accounting** + Configuration + sync); RLS SELECT on **`mercury_transactions`** + nicknames; org-wide **`mercury_drag_sort_labels`** / **`mercury_transaction_drag_sort_assignments`** (Drag Sort / Accounting approvals); **`mercury_accounting_label_rules`** / **`mercury_accounting_label_suggestions`** (**Accounting** tab, banking-staff RLS); **Stripe** segment (**dev-only**): **Invoices** (`jobs_ledger_invoices` + job embed, rows without **`stripe_invoice_id`** highlighted) and **Data** (`stripe_webhook_events` webhook log) | ❌ | ✅ **User Sort** + **Drag Sort** + **Accounting** (default User Sort slice, no Configuration / no sync); read **`mercury_transactions`** + nicknames; **edit `mercury_debit_card_nicknames`** only (RLS); rules/suggestions/approvals per banking-staff policies | ❌ | ❌ | ❌ | ❌ |

Non-dev roles do not see the Banking **Stripe** segment; master/assistant deep links with `product=stripe` normalize to Mercury **User Sort**.

Mercury **Person** attribution (job splits modal): staff use **`list_users_for_banking_attribution`** (**SECURITY DEFINER**, same dev/master/assistant gate as **`replace_mercury_transaction_splits`**) for the user picker; **`mercury_transaction_attributions`** may store **`user_id`** or legacy **`person_id`** (not both).
| **Calendar** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Bids** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ limited |
| **Estimates** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ limited (project-linked super visibility) |
| **Materials** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ limited |
| **Templates** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Settings** | ✅ | ✅ limited | ✅ limited | ❌ | ✅ limited | ✅ limited | ✅ limited |
| **Map** (`/map`) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |

*\* **Map**: **dev**, **master_technician**, **assistant**, and **estimator** — page **`/map`**; **[`layoutRouteAccess.ts`](../src/lib/layoutRouteAccess.ts)**, **`Layout.tsx`**: desktop **pin** when `canShowMapNav`; **narrow** hides pin → **Map** under **gear**; **`address_geocodes`** RLS (**`20270520120000_address_geocodes_estimator_map_access.sql`**); Edge **`geocode-address-batch`** (primary load chunks) / **`geocode-one`** (**Review geocodes** Google refresh, Settings default-label). **Subcontractor**, **primary**, and **superintendent** are redirected away from **`/map`** when it is not an allowed route.*

### Redirection Rules

**Subcontractors**: Any page except Dashboard/Calendar/Checklist/Settings/Tally → `/dashboard`. On those allowed routes, **Task Dispatch**, **Estimator Inbox**, and **Task** (checklist add) in the header behave like other roles that pass [`headerTaskDispatchEstimatorEligible.ts`](../src/lib/headerTaskDispatchEstimatorEligible.ts) (`helpers` matches — see **helpers** section above).

**Estimators**: Any page except Dashboard/**Map**/Materials/Estimates/Bids/**Customers**/Calendar/Checklist/People/Settings/Tally/Prospects (if enabled) → `/bids`

**Primary**: Any page except Dashboard/Materials/Estimates/Jobs/Bids/Prospects/Calendar/Checklist/Settings → `/dashboard`; Jobs shows Reports and Billing tabs only; Bids full access (all tabs); Projects hidden

**Superintendent**: Any page except Dashboard/Projects/Workflow/Jobs/Dispatch/Bids/Materials/Estimates/Calendar/Checklist/Settings/Tally → `/dashboard`; Jobs shows Reports, Sub Sheet Ledger; Bids shows draft tabs only (no Pricing, Cover Letter, Submission); Materials shows Price book and Assembly book; People and Customers pages blocked

**Assistants**: Can access most pages but see filtered data

---

## Feature Access Matrix

### Dashboard

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Job Mode** (header gear-menu toggle; replaces top of Dashboard with focused **Leave Report** / **Next Job** card driven by today's `job_schedule_blocks` and the open `clock_sessions` row; per-user `localStorage`; **[`canLeaveJobFieldReport(role)`](../src/lib/canLeaveJobFieldReport.ts)** gates visibility of the toggle — same predicate as the existing **Leave Report** flows so every role that can file field reports can use Job Mode; **`RECENT_FEATURES.md`** **v2.545**) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configure dashboard buttons (Job, Job Labor, Bid, Project, Part, Assembly, New Prospect) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Task Dispatch (**header**: send `dispatch_requests`; optional job/bid reference — recipients are **Dispatch group** members on Dashboard, not the sender) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Estimator Inbox (**header**: send `estimator_requests`; same “send vs inbox” split as Task Dispatch) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dispatch inbox (Dashboard, Quickfill, Checklist Review: open requests, mark closed; **`dispatch_group_members`**, **dev** bypass in [`useDispatchInbox`](../src/hooks/useDispatchInbox.ts); narrow card layout **v2.452**) | ✅ | ❌ | If in Dispatch group | ❌ | ❌ | ❌ | ❌ |
| Estimator inbox (Dashboard, Checklist Review: open requests, mark closed; **`estimator_group_members`**, **dev** bypass in [`useEstimatorInbox`](../src/hooks/useEstimatorInbox.ts); narrow layout **v2.452**) | ✅ | ❌ | If in Estimator group | ❌ | If in Estimator group | ❌ | ❌ |
| My Team (pending clock sessions for assigned members; approve/reject/assign job) | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader | ✅ if leader |
| **My Time** **Edit time** (clock strip): leader **split/replace-day** RPCs — **`can_edit_clock_sessions_for_user`** (**`20260401190823`**) treats **master_technician**, **assistant**, and **superintendent** like the dev team-lead path for **any** target user (broad edit capability on those RPCs) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| NCNS from team **My Time** day editor (clock strip): **`record_ncns_and_reject_sessions_for_day`** rejects all **closed** sessions for that **`work_date`** when any exist, inserts **`attendance_incidents`**; if **no** sessions but assignee has **`job_schedule_blocks`** on that date, inserts incident only (**`scheduled_without_clock`** in **`metadata`**); duplicate NCNS same day rejected; **approved** hours removed from **`people_hours`** when sessions exist; **two-step** UI confirm (payroll + trust) when any session was approved; **RPC** also allowed for **team lead** for subject (same as approve/revoke), UI shown for **dev / master / assistant** with clock strip scope only | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Copy day job mix** on Dashboard **Clocked in today** (**Mix** toggle, **`CopyDayJobMixModal`**, **`leader_replace_clock_session_cluster_mixed`**): same strip roles as **Everyone / Organization** — **dev / master_technician / assistant** only | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Email schedule** (strip **Email schedule** → **`ScheduleDayEmailModal`**): one-off dispatch-blocks email for strip day; **dev** may choose **Send to** another user; **master** / **assistant** self only | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Stale tally staff follow-up** (Dashboard blue banner + modal — same stale/unlinked Mercury rules as personal stale banner; rows limited to users allowed by **`staff_can_view_user_for_tally_followup`**: **dev** any target; **master_technician** self, adopted assistants, or users on **master’s** jobs as team members; **assistant** adopting masters, same-master assistants via **`assistants_share_master`**, or users on **jobs** whose **`master_user_id`** is any master who adopted the assistant; **`list_stale_unlinked_mercury_transactions_for_tally_staff`** / **`replace_mercury_job_splits_for_linked_card_as_staff`** / **`search_jobs_for_tally_mercury_assign_as_user`**) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Unallocated bank deposits** banner (**Dashboard** tally row only; **`canRoleSeeArBankUnallocatedDashboardBanner`**; navigates **`/accounts-receivable`**) — **not** shown to **primary** (they may still use **Jobs → Stages** AR) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Unallocated bank deposits** banner (**Quickfill** **Warnings** when that section is shown; **`canRoleSeeArBankUnallocatedOrgNudge`**; same **`/accounts-receivable`** navigation) — **not** shown to **primary** (**`RECENT_FEATURES`** **v2.494**; Dashboard vs master split **v2.497**) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **My Bids** (Dashboard collapsible; **My Bids (`n`)** after load) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Rejected clock sessions (org-wide, review/delete) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Header vs Dashboard inbox**: **Subcontractor** and **helpers** share the **header** buttons with office roles via [`headerTaskDispatchEstimatorEligible.ts`](../src/lib/headerTaskDispatchEstimatorEligible.ts) but they **do not** see Dashboard inbox cards unless they have a row in **`dispatch_group_members`** / **`estimator_group_members`** (unusual). Sending does not imply inbox access.

### Calendar

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| **NCNS** on own days: read **`attendance_incidents`** where **`subject_user_id = self`** (Calendar badge / day modal); policy `"Attendance incidents subject select own"` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Salary schedule (green)**: **`scheduled`** chips / modal workday only when **`work_date` > today**; **unpaid time off (`time_off`)** purple chip **all dates** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Recorded time** on Calendar: aggregate own **`clock_sessions`** in visible month (toggle) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

### Checklist (`/checklist`)

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| **Roadmap** tab (tech tree): **see** a roadmap row (`can_select_checklist_tech_tree_roadmap`) | ✅ all | ✅ all | ✅ all | ✅ if member | ✅ if member | ✅ all | ✅ if member |
| **Roadmap**: **create** roadmap, **delete** roadmap | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Roadmap**: **edit graph** (groups/tasks/edges) — `can_edit_checklist_tech_tree_structure_for_roadmap` | ✅ | ✅ | ✅ | ✅ if **editor** | ✅ if **editor** | ✅ | ✅ if **editor** |
| **Roadmap**: **Members** modal — add/remove, **viewer** / **editor** (`can_manage_checklist_tech_tree_roadmap_members`) | ✅ | ✅ | ✅ | ✅ if **editor** | ✅ if **editor** | ✅ | ✅ if **editor** |
| Header **Task** (global modal — add checklist item + assignees + instances on allowed routes) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

**RLS notes** (v2.408, [`20270427120000_checklist_tech_tree_multi_roadmap.sql`](../supabase/migrations/20270427120000_checklist_tech_tree_multi_roadmap.sql)): **Dev**, **master_technician**, **assistant**, and **primary** bypass membership for **select** and **structure** (see all roadmaps). **Subcontractor**, **estimator**, **superintendent** (and anyone not in that bypass set) need a row in **`checklist_tech_tree_roadmap_members`** for each roadmap they can open. Migration backfill adds **viewer** on the **Default** roadmap for all non-archived users, so everyone typically retains access to that graph; additional named roadmaps are visible only to bypass roles or invited members.

**Task modal CHECKLIST RLS** ([`20270519120000_subcontractor_helpers_estimator_checklist_task_definitions.sql`](../supabase/migrations/20270519120000_subcontractor_helpers_estimator_checklist_task_definitions.sql)): **`can_define_task_style_checklist_items()`** allows **subcontractor**, **helpers**, and **estimator** to insert/update/delete checklist definitions only when **`created_by_user_id = auth.uid()`** (and related assignee/instance rows for those items); staff paths still use **`is_dev_or_master_or_assistant()`** unchanged. [**`20260501205038_fix_checklist_items_rls_recursion.sql`](../supabase/migrations/20260501205038_fix_checklist_items_rls_recursion.sql)** adds **`checklist_item_created_by_auth_user(uuid)`** and **`checklist_instance_parent_item_created_by_auth_user(uuid)`** (**`SECURITY DEFINER`**, **`SET row_security = off`**) so junction/instance policies do not query **`checklist_items`** under RLS recursively (**RECENT_FEATURES.md** v2.450).

### Quickfill (`/quickfill`)

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| **Schedule** section — read-only per-user day row (**`DispatchAddBlockTimeRange`**, same window as Add schedule block); roster + **`job_schedule_blocks`** for selected **`work_date`**; link to **`/schedule-dispatch`** with **`week`**, optional **`day`** / **`jobId`**; **`quickfill_section_marks.section_id` = `schedule`** (shown only for **dev**, **master_technician**, **assistant**, **superintendent** — same gate as **`sectionWouldRenderOnPage`** in **`Quickfill.tsx`**) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Prospects** — active prospect warmth counts (0–3 and 4+); **Open Prospects** to **`/prospects?tab=prospect-list`**. **Team (last 30 days)** for **dev** / **master_technician** / **assistant** — **line chart** (**`recharts`**, **Y** = **Marked + Updated** per day; same data as **Prospects → Team**, which stays **per-day tables**). Shown when **`canAccessProspects`** in **`Quickfill.tsx`**. **Estimator** only when **Settings** grants **`estimator_prospects_access`** (warmth + CTA; no Team sub-block) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Stages: customer link & customer pictures** (`no-customer-stages`) — **[`useQuickfillStagesJobsWithoutCustomer`](../src/hooks/useQuickfillStagesJobsWithoutCustomer.ts)**; **Open list** (no linked customer) + **No customer pictures** (**working**, empty **`job_pictures_link`**); **union** metric; same empty–Stages-search rules as **Jobs → Stages** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Difficult people** — **`quickfill_difficult_people_items`** (template) **`quickfill_difficult_people_daily_checks`** (**`work_date`** + **`item_id`**, company calendar): dev **add** / **edit** / **delete** template rows; **master_technician** / **assistant** **SELECT** + **INSERT**/**DELETE** on daily checks (check/uncheck today). Template **UPDATE** **dev** only. **Section** **`difficult-people`** visible only for **dev** / **master_technician** / **assistant** (not **estimator**). | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Unassigned field time** (`quickfill_section_marks.section_id` = `unassigned-field-time`, **v2.537**) — per (person, work_date) cells where paid field-type time has no crew attribution; mirrors **`derivePersonTeamSummary`** math (`fieldHours = max(0, dayHoursRaw − overheadOnDay)`, subtract crew + sub-labor). **`sectionWouldRenderOnPage`** gate in **[`Quickfill.tsx`](../src/pages/Quickfill.tsx)** + in-component gate in **[`QuickfillUnassignedFieldTimeSection.tsx`](../src/components/quickfill/QuickfillUnassignedFieldTimeSection.tsx)** (dev / assistant / **master_technician** must also be in **`pay_approved_masters`** — same as Hours / Pay). Reads **`people_pay_config`**, **`people_hours`**, **`people_crew_jobs`** + **`people_crew_bids`**, approved-closed **`clock_sessions`** (in window) + **`overhead_office_job_ledger_id_v1`** (**`app_settings`**); writes via existing **`PeopleHoursDayAuditModal`** (crew assignments + **`approve_clock_sessions`**). No new RLS / RPCs. | ✅ | ✅ (when in **`pay_approved_masters`**) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Office Arriving** / **Office Leaving** — checklist templates in **`app_settings`** (**`quickfill_office_arriving_items`** / **`quickfill_office_leaving_items`**). **Arriving** checkboxes: **`quickfill_office_arriving_daily_checks`** (**`item_id`** text + **`work_date`**, company calendar; **INSERT**/**DELETE** for **`is_dev_or_master_or_assistant()`**, **INSERT** **`checked_by = auth.uid()`**). **Leaving** done state: **`quickfill_office_leaving_done`** JSON only (**`app_settings` UPDATE** policy allows that key, not **`quickfill_office_arriving_done`**). **Realtime** on **`quickfill_office_arriving_daily_checks`** where enabled. | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Email**, **Texts**, **Physical inbox** — textarea + mark with note history; **mark** / **`quickfill_section_marks`** **UPSERT**: dev / master / assistant only (**RLS**). **Physical inbox** inline Task / Task Dispatch / Estimator buttons use the same role gates as [`Layout.tsx`](../src/components/Layout.tsx); subcontractor/helpers do not reach this surface because **`/quickfill`** is not an allowed path | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Settings (selected)

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| People & accounts (`#settings-people`): adoption, master sharing, primaries/superintendents, Share Cost Matrix and Teams (dev); dev-only user tools and Task Dispatch above sharing | ✅ | ✅ (sharing block only) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Team Hours Sharing (leader → member links for My Team; **Settings → Dashboard & alerts** and **People → Teams** `?tab=teams`); **Leader dashboard** column (full vs strip only) **editable dev-only** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Job Book** (`job_book_entries`): **SELECT** all **authenticated** (e.g. **Collect Payment** Step 1 catalog); **INSERT/UPDATE/DELETE** **dev** / **master_technician** / **assistant** only (**Settings → Job Book**) | ✅ | ✅ | ✅ | ✅ read | ✅ read | ✅ read | ✅ read |

### Customer Management

| Feature | dev | master | assistant | sub | estimator | primary | superintendent |
|---------|-----|--------|-----------|-----|-----------|---------|----------------|
| View customers | ✅ All | ✅ Own | ✅ Adopted | ❌ | ✅ `/customers` + Bids | ❌ | ❌ |
| Create customers | ✅ | ✅ | ✅ Must select master | ❌ | ✅ Bids modal + Customers page | ❌ | ✅ Via Bids modal |
| Edit customers | ✅ | ✅ Own | ✅ Adopted | ❌ | ✅ Basic fields only | ❌ | ❌ |
| Delete customers | ✅ | ✅ Own | ❌ | ❌ | ❌ | ❌ | ❌ |
| Change customer owner | ✅ | ✅ Own | ❌ | ❌ | ❌ | ❌ | ❌ |
| Quick Fill | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |

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
| Hours tab (timesheet; Review Hours, pay config, Due summaries, cost matrix, teams, sharing — former Pay merged — see `PROJECT_DOCUMENTATION.md` §5) | ✅ | ✅ If Pay Approved or shared (matrix/teams view-only when shared) | ✅ If master Pay Approved (timesheet); view-only matrix/teams if dev shared | ❌ | ❌ | ❌ | ❌ |
| Payroll tab (ledger, generators, print; view in bulk modal; Draft Payroll drilldown/print v2.514) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Vehicles tab (fleet CRUD, odometer, possessions) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Housing tab (units CRUD, weekly rent/utilities/insurance, possessions) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Offsets tab (backcharges, damages, apply to pay stub) | ✅ | ✅ If Pay Approved | ✅ If master Pay Approved | ❌ | ❌ | ❌ | ❌ |
| Licenses tab (license type, note, date of expiry per person) | ✅ | ✅ If Pay Approved | ✅ | ❌ | ❌ | ❌ | ❌ |
| Contracts tab (templates, assignments, document status per person) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Writeups tab (`?tab=writeups`): custom form templates, writeups about a subject user, Discussed vs Withheld disclosure; submitted rows immutable; dev-only delete submitted; **unified list** also shows **read-only** NCNS rows from **`attendance_incidents`** (same RLS as incidents); legacy `?tab=contracts&contracts_sub=writeups` redirects to `tab=writeups` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Activity tab (first-party app usage: org-wide UTC table; dev grants assistant / master / primary) | ✅ + manage grants | ✅ if granted | ✅ if granted | ❌ | ❌ | ✅ if granted | ❌ |
| **Teams** tab (`?tab=teams`): manage **`team_leader_assignments`** (add/remove leader→member links; leader-centric tree; search); **Leader dashboard** visibility **dev-only** (same RLS as Settings **Team Hours Sharing**) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Overhead** tab (`?tab=overhead`): daily **approved, closed** clock labor $ — **office** job from **`app_settings`** **`overhead_office_job_ledger_id_v1`** (dev configures) + **bid** time; hours × **`people_pay_config.hourly_wage`** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Contracts (assistants):** **assistant** may use the tab but **cannot delete** person documents, templates, Contract Book library entries, or remove template checklist lines on save (**`canDeletePeopleContracts`** in **`People.tsx`** — **dev** and **master_technician** only). **Unassign template** is limited the same way (DB **DELETE** on contract tables excludes plain **assistant** — migration **`20260502070926_contract_tables_assistant_no_delete.sql`**).

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

### Estimator Customers (create and limited edit)

**Special Case**: Estimators have **Customers** page access for everyday fields, not full customer admin.

**Mechanism**:
- **SELECT RLS**: Estimators see all customers (dropdowns + `/customers` list)
- **INSERT RLS**: Allowed when `master_user_id` is set to a valid master (dev or master_technician)
- **UPDATE RLS**: Policy **Estimators can update customers**; **`BEFORE UPDATE` trigger** `customers_estimator_update_immutable_fields` on `public.customers` (function **`enforce_customers_estimator_update_immutable_fields`**) rejects changes to `master_user_id` or `stripe_customer_id` when the caller is an estimator
- **DELETE**: Not granted; UI shows no delete for estimators
- **UI**: No **Advanced** (owner), **merge**, or **delete** in edit modal

**Workflow (Bids)**:
1. Estimator opens "+ Add new customer" modal in Bids
2. Selects master from dropdown (all masters shown)
3. Fills customer details
4. Saves - customer created with selected master as owner
5. New customer automatically selected as bid's GC/Builder

**Workflow (Customers page)**:
1. Open `/customers`, search, add or edit in modal
2. Saves update only **basic** columns; owner and Stripe stay fixed

**Benefits**:
- Estimators can maintain customer records without project/workflow access
- Ownership and billing identifiers stay protected

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
