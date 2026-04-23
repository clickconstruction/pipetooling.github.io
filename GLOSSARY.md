# Project Glossary

> **Purpose**: Comprehensive definitions of all domain-specific terms, technical concepts, and project-specific terminology used in Pipetooling.

---
file: GLOSSARY.md
type: Reference
purpose: Comprehensive definitions of all domain-specific terms and technical concepts
audience: All users (especially new developers and AI agents)
last_updated: 2026-04-23
estimated_read_time: 15-20 minutes (reference only)
difficulty: Beginner

total_terms: ~127
categories: 9

key_sections:
  - name: "User Roles"
    line: ~17
    anchor: "#user-roles"
    terms: 6
  - name: "Project Management"
    line: ~66
    anchor: "#project-management"
    terms: 6
  - name: "Access Control"
    line: ~107
    anchor: "#access-control"
    terms: 5
  - name: "Workflow Concepts"
    line: ~234
    anchor: "#workflow-concepts"
    terms: 8
  - name: "Bids System"
    line: ~228
    anchor: "#bids-system"
    terms: 19
  - name: "Materials System"
    line: ~385
    anchor: "#materials-system"
    terms: 14
  - name: "Database Concepts"
    line: ~495
    anchor: "#database-concepts"
    terms: 11
  - name: "Technical Terms"
    line: ~561
    anchor: "#technical-terms"
    terms: 9
  - name: "Abbreviations"
    line: ~655
    anchor: "#abbreviations"
    terms: ~15

usage: "Use Ctrl+F/Cmd+F to search for specific terms"

related_docs:
  - "[AI_CONTEXT.md](./AI_CONTEXT.md) - Quick overview with glossary"
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Terms in context"
  - "[BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids terminology"
  - "[ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Role terminology"

when_to_read:
  - Encountering unfamiliar terms
  - Learning project terminology
  - Understanding domain concepts
  - Clarifying abbreviations
---

## Quick Navigation

- [User Roles](#user-roles)
- [Project Management](#project-management)
- [Access Control](#access-control)
- [Workflow Concepts](#workflow-concepts)
- [Checklist](#checklist)
- [Task Dispatch](#task-dispatch)
- [Bids System](#bids-system)
- [Materials System](#materials-system)
- [Database Concepts](#database-concepts)
- [Technical Terms](#technical-terms)
- [UI/UX Terms](#uiux-terms)

---

## User Roles

### dev (Developer/Admin)
System administrator with complete access to all features, data, and operations. Can create/delete users, manage templates, impersonate users, and access all edge functions. The highest privilege level in the system.

**Capabilities**: Everything (full CRUD on all resources, user management, system configuration)

### master_technician (Master)
Project owner and business manager role. Creates customers and projects, manages workflows, assigns work to assistants and subcontractors. Can adopt assistants and share data with other masters.

**Capabilities**: Own data management, assistant adoption, master sharing, full bids/materials access

**Alias**: Sometimes called "Master" for brevity

### assistant (Assistant)
Support staff who work under masters. Must be "adopted" by a master to access their data. Can view all stages in accessible workflows but only take actions on assigned stages. Cannot see private notes or financial totals.

**Capabilities**: View adopted masters' data, edit line items (no totals), manage bids/materials, limited customer creation

**Key Restriction**: Must be adopted by a master to access any data

### subcontractor (Sub/Subcontractor)
External worker with minimal access. Only sees stages they are assigned to by name. Cannot access customer, project, or workflow management pages. Limited to Dashboard and Calendar views.

**Capabilities**: Start/Complete assigned stages only; **Task Dispatch** (send title + links to Dispatch group)

**Key Restriction**: Cannot see any stage they're not explicitly assigned to

### estimator (Estimator)
Bid estimation specialist with access only to Bids and Materials systems. Cannot access ongoing project management, workflows, or dashboard. Can view all customers (for bid creation) and create new customers via Bids modal.

**Capabilities**: Full Bids system, full Materials system, view/create customers (via Bids)

**Key Restriction**: No access to Projects, Workflows, Dashboard, Calendar, or Settings pages

### primary (Primary)
Materials and job reports specialist with access to Materials (full), Jobs (Reports tab only), Bids (Bid Board, RFI, Change Order, Lien Release), and Dashboard with Recent Reports and Send task. Cannot access Customers, Projects, People, or other Jobs/Bids tabs.

**Capabilities**: Full Materials system, Jobs Reports tab (view/create reports), Bids Bid Board + RFI/Change Order/Lien Release (view bids, generate documents), Dashboard Recent Reports, Send task, ChecklistAddModal ("detail send")

**Key Restriction**: No access to Customers, Projects, People, or Jobs/Bids tabs other than Reports and Bid Board/RFI/Change Order/Lien Release

---

## Project Management

### Customer
A client or General Contractor (GC) who provides work. Customers have an owner (`master_user_id`) and can have multiple projects. In the Bids context, customers are also called "GC/Builder".

**Database**: `customers` table

**Key Fields**: name, address, contact info (JSONB), date_met, master_user_id

### Project
A job site or construction project for a specific customer. Each project has one workflow. The project owner automatically matches the customer owner (enforced by database trigger).

### Job–Project Link
Optional association between a Job (billing) and a Project (multi-phase work). Jobs can optionally belong to a project; not all jobs need projects. When linked, the job owner must match the project owner (enforced by trigger). When editing a job and linking it to a project, the job's owner is automatically updated to the project owner.

**Database**: `projects` table

**Key Fields**: name, description, status, customer_id, master_user_id, address

**Rule**: Project owner = Customer owner (cannot be changed independently)

### Workflow
A sequence of stages/steps for completing a project. Each project has exactly one workflow. Created from templates or built from scratch.

**Database**: `project_workflows` table

**Relationship**: One per project (1:1)

### Stage / Step
Individual work phase in a project workflow (e.g., "Rough In", "Inspection", "Top Out", "Trim Set"). Can be assigned to people, have start/complete dates, and track status (pending, in_progress, completed, approved, rejected). The rejected status displays as "Previous work incomplete" in the UI.

**Database**: `project_workflow_steps` table

**Alias**: "Stage" and "Step" used interchangeably

**Statuses**: pending, in_progress, completed, approved, rejected (rejected displays as "Previous work incomplete")

### Template
Reusable workflow definition. Masters and devs can create templates with pre-defined stages. When creating a project, can select a template to auto-generate workflow stages.

**Database**: `workflow_templates`, `workflow_template_steps` tables

**Access**: Only dev can create/edit templates

### Clock Sessions / Pending Clock Sessions
User clock-in/clock-out records from the Dashboard. Each session has `clocked_in_at`, `clocked_out_at`, `work_date` (from clock-in date), required `notes` ("What are you working on?"), and optional `job_ledger_id` or `bid_id` for job/bid-level reporting (mutually exclusive). **Pending** sessions are clocked out but not yet approved or rejected. **Approved** sessions have hours merged into `people_hours`; **Rejected** sessions are in a separate section. Pay-access users approve, reject, or revoke in People Hours tab (and Quickfill Hours section). `approve_clock_sessions` RPC merges hours into `people_hours` and, for sessions with `job_ledger_id`, auto-creates/updates `people_crew_jobs`; for sessions with `bid_id`, auto-creates/updates `people_crew_bids`. `revoke_clock_sessions` subtracts hours and moves back to Pending, recomputing or removing crew jobs/crew bids when the session had a job or bid. **Pending table UX**: Time and duration on the first line of the time column; work date and location (or placeholder when GPS missing) on the second line; **Notes** and **Job/Bid** share a wide cell with the job/bid label under the notes; accountability uses two lines (actor line + short timestamp without seconds). Pending row actions are ordered **Approve**, **Reject**, **Edit**. Job/Bid label format: `J123 · [job name] - [address]` for jobs or `B456 · [project name] - [address]` for bids. Cross-midnight work (e.g. 11pm–1am) is attributed entirely to the clock-in date. Devs do not appear in the Pay roster; if a dev's session is approved, hours go to `people_hours` but are not visible in the Hours grid.

**Database**: `clock_sessions`

**Salaried auto-sessions**: For users with a salary workday template, **`origin = 'salary_schedule'`** rows are opened/closed by **`salary_sync_one_user_clock_sessions`** (cron via Edge **sync-salary-sessions**, or after saving Settings). **`salary_segment_index`** is null for a **continuous** day or **1** / **2** for split-template slots; splitting an indexed slot turns new segments into **`user_punch`**. Sync uses a **boundary** model: at each template block end it sets **`clocked_out_at`** on **every** still-open session for that user/**`work_date`** (including **`user_punch`**); it opens canonical **`salary_schedule`** rows only when **nothing** is open that day. See **[`SALARY_CLOCK_SESSIONS.md`](SALARY_CLOCK_SESSIONS.md)**.

### Job schedule blocks (planned work) / Linked crew block
**`job_schedule_blocks`** rows describe a planned work window on a job: **assignee** (`assignee_user_id`), **`work_date`**, Central wall-clock **`time_start`** / **`time_end`** (allowed range 4:00–20:00), optional **`note`**. Used in the Jobs **Schedule** modal, Calendar **planned** chips, and **Schedule dispatch** week grid. **Solo** rows (or older data) may have **`shared_block_group_id`** null. **New** inserts assign a random UUID to **`shared_block_group_id`** so every block can be linked-copied. Rows that share the same non-null **`shared_block_group_id`** are one **linked** (crew) block: they keep the same times and note; each person still has their own row. **Schedule dispatch** can use **+ → Linked copy** on a card to add another assignee’s leg; **Edit** updates every leg in the group; removing one leg does not remove the others. **Drag** to reassign another team member applies only to **solo** legs — linked legs use a disabled handle. **Add schedule block** opens a modal with an **occupied timeline** for that person-day: existing blocks appear as labeled bands; you can **drag** them to draft new times (linked legs on that day move together) before **Save**, which updates moved rows then inserts the new block (**RECENT_FEATURES** v2.296).

**Database**: `job_schedule_blocks` — migration **`20260407061043`** adds **`shared_block_group_id`**; **`20260407052651`** enforces minimum 30-minute duration.

### My Roles Goals / Daily goals gate
Per-user checklist lines (**`user_dashboard_goals`**) edited by dev, master, or assistant in Settings. After the **first successful clock-in of a calendar day**, if the user has at least one goal, a full-screen overlay titled **“My Roles Goals”** appears; **Continue** writes **`user_daily_goals_ack`** for that local date so the gate stays off until the next calendar day.

---

## Access Control

### Adoption
Process where a master grants an assistant access to their customers and projects. Creates a many-to-many relationship allowing assistants to work for multiple masters.

**Database**: `master_assistants` table with `(master_id, assistant_id)` pairs

**Effect**: Assistant can see and work on adopted master's data

**UI**: Managed in Settings page with checkboxes

### Sharing
Process where a master grants another master assistant-level access to their data. Shared masters can view but not modify, and cannot see private notes or financial totals.

**Database**: `master_shares` table with `(sharing_master_id, viewing_master_id)` pairs

**Effect**: Viewing master gets read-only access to sharing master's data

**Use Case**: Collaboration, backup coverage, training

### RLS (Row Level Security)
PostgreSQL security mechanism that filters database rows based on user context. Every table has policies defining who can SELECT, INSERT, UPDATE, or DELETE rows.

**Implementation**: SQL policies in migration files

**Common Pattern**: Check ownership OR dev role OR adoption OR sharing

### SECURITY DEFINER
PostgreSQL function attribute that runs the function with the creator's permissions instead of caller's. Used to bypass RLS in helper functions to prevent recursion and timeouts.

**Use Case**: Helper functions like `is_dev()`, `can_access_project_via_step()`

**Caution**: Use sparingly; creates security risk if misused

### Ownership
Relationship where a user owns a resource (customer, project, purchase order). Indicated by `master_user_id` or `created_by` foreign key to `users.id`.

**Pattern**: Users can always access their own resources

**Inheritance**: Projects inherit owner from customer (automatic)

---

## Workflow Concepts

### Line Item
Financial entry on a workflow stage representing materials, labor, or expenses. Has memo, amount, and optional link to external resources. Also called **Line Items For Office** in the UI.

**Database**: `workflow_step_line_items` table

**Access**: Masters and assistants can add/edit; assistants cannot see totals

**Optional**: Can link to purchase order for material tracking. Can link to supply house invoices; "View Invoice" button opens invoice details.

### Projection
Forward-looking financial estimate for a workflow. Represents expected future costs or revenue.

**Database**: `workflow_projections` table

**Access**: Masters only (dev can see)

**Visibility**: Not visible to assistants or subcontractors

### Private Note
Owner-only note on a workflow stage. Not visible to assistants, subcontractors, or shared masters.

**Database**: `private_notes` field on `project_workflow_steps`

**Access**: Only owner (master) and dev can see/edit

### Action / Action Ledger
Status change event recorded in history (started, completed, approved, rejected, reopened). The rejected action displays as "Previous work incomplete". Provides complete audit trail of stage lifecycle.

**Database**: `project_workflow_step_actions` table

**Tracked**: action_type, occurred_at, performed_by, notes

**Purpose**: Complete stage history for accountability and analysis

### Ledger Total
Sum of all line items for a workflow. Shows total costs/expenses across all stages.

**Calculation**: Client-side sum of line item amounts

**Visibility**: Masters and dev only (hidden from assistants)

### Total Left on Job
Remaining budget after subtracting ledger total from projections.

**Calculation**: Projections - Ledger Total

**Visibility**: Masters and dev only (hidden from assistants)

### Accounts Receivable Sorting (Jobs Stages → Bank payments)
Org-wide Mercury transaction filter for applying customer bank deposits to billed work (**Jobs** → **Stages** → **Bank payments**). The active filter shape is **`BankingSortingConfigV1`**: kinds, accounts, debit cards, Chicago **start date**, and optional counterparty/note substring exclusions. Canonical storage is **`app_settings`** key **`bank_payments_sorting_config_v1`** (**`value_text`** JSON); only **dev** can upsert (RLS). All authenticated roles that can open Bank Payments read the same row; **`list_mercury_transactions_for_bank_payments`** and **`count_mercury_transactions_for_bank_payments`** use the same **`p_filter`**. If no server row exists yet, the client may fall back to legacy per-user **`localStorage`** or Banking/Quickfill **`banking_sorting_config_v1_<userId>`** until a dev publishes settings. A global browser cache key **`bank_payments_sorting_config_v1__cache`** mirrors the server after fetch/save. Distinct from per-user **Banking** page sorting (**`banking_sorting_config_v1_<userId>`**).

**Returned deposit (AR Bank Payments)**: Org flag on a Mercury **`mercury_transactions`** row for deposits that still appear in the feed after a return or bounce (e.g. cheque). Stored in **`mercury_transaction_ar_returned`** (not on the sync table). By default **`list_mercury_transactions_for_bank_payments`** / **`count_mercury_transactions_for_bank_payments`** hide rows marked returned, same as fully applied deposits, unless **`p_filter.includeHiddenArDeposits`** is true (legacy **`includeFullyApplied`** still maps to that behavior). Toggle via **`set_mercury_transaction_ar_returned`** and **Mark** mode in **[`BankPaymentsModal`](src/components/jobs/BankPaymentsModal.tsx)**.

**See**: `RECENT_FEATURES.md` → v2.335, v2.334; `PROJECT_DOCUMENTATION.md` → §15 Banking; [`bankingSortingConfig.ts`](src/lib/bankingSortingConfig.ts), [`appSettingsKeys.ts`](src/lib/appSettingsKeys.ts).

---

## Checklist

### Checklist Items / Checklist Instances
Recurring tasks with Today, History, **Review**, and Manage tabs (Review/Manage require manage-capable roles). **Assignees** are stored in junction tables `checklist_item_assignees` (item, user) and `checklist_instance_assignees` (instance, user)—items and instances can have multiple assignees. Add/Edit modal uses checkboxes for multi-assignee selection; at least one assignee required. Today/History filter by `checklist_instance_assignees.user_id`. **Review** tab: **Outstanding by person** (filters and table) first, then **Task Dispatch** and **Estimator Inbox** cards via `ChecklistReviewInboxes` (inbox cards hidden for assistants). **Link placeholders**: `[1]`, `[2]`, etc. in item titles map to URLs in `checklist_items.links` array; Add/Edit modal provides URL inputs; displayed as clickable links via `ChecklistTitleWithLinks`.

**Database**: `checklist_items`, `checklist_instances`, `checklist_item_assignees`, `checklist_instance_assignees`

**Repeat types**: once, day_of_week (multiple days), days_after_completion

### Muted task
Per-task preference to stop receiving completed-task push notifications for a specific checklist item. Stored in `user_checklist_item_mute_preferences`. Users who are notification recipients (notify_on_complete_user_id or creator when notify_creator_on_complete) can mute via inline bell-off icon on Checklist Today, Manage, Dashboard; Settings shows Muted Tasks list.

### Ignored section (dev)
Collapsible section in Dashboard Recently Completed Tasks where devs move task types they want out of the main view. Stored in `dev_ignored_checklist_items`. Main section shows only non-ignored types; UNREAD count excludes ignored; Ignore/Un-ignore buttons move task types between sections.

---

## Task Dispatch

Short messages to internal **Dispatch** (a dev-configured set of **assistants**), separate from recurring checklist tasks. Any signed-in user can open **Task Dispatch** in the header. The modal titled **Message the Dispatch team** has: **Task** (required), **Reference (optional)** (job/bid search), and **Links (optional)** (URLs for `[1]`, `[2]` placeholders in the task text). Rows live in `dispatch_requests`. **Dispatch group** membership is `dispatch_group_members` (assistant users only; trigger-enforced). Devs edit the group in Settings. Dispatch members and devs see the **Dispatch inbox** on the Dashboard for open requests and can **mark closed**. When marking closed, user enters a **closed_note** (required in app). Closed requests can be **dismissed** per-user (hidden from that user's inbox); `dispatch_request_dismissals` table. Push notifications use Edge Function **`notify-dispatch-request`** so the member list is not exposed to clients. The Edge gateway should use **`verify_jwt = false`** for that function in **`supabase/config.toml`** (JWT validated inside the function, same pattern as **`notify-estimator-request`**); otherwise the client can see **401** before the function runs.

---

## Bids System

### Bid / Bid Board
The main bid management system. Bid Board is the first tab showing all bids in a list.

**Database**: `bids` table

**6 Tabs**: Bid Board, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission & Followup

### Bid Number
Short identifier for a bid (e.g. "456"), analogous to HCP for jobs. Stored in `bids.bid_number`. Auto-generated for new bids via `bids_bid_number_seq`; backfilled for existing bids (oldest first). Displayed as **`B456`** in Clock In/Update Focus search, People Hours clock session displays, **Bid Board** (clickable to open **Bid preview** when set), and workflow tab headings (**Counts**, **Takeoffs**, **Cost Estimate**, **Pricing**, **Cover Letter**, **Submission & Followup**, **RFI**, **Change Order**, **Lien Release** — **`B{n}`** opens preview when preview context exists). **Edit restriction**: Only dev, master_technician, and assistant can edit; estimator and primary see it read-only (enforced by UI and database trigger).

### GC / Builder / General Contractor
Customer in the bids context. The entity requesting the bid (can be actual GC, homeowner, developer, etc.).

**Database**: Uses `customers` table (linked via `customer_id`)

**Alias**: "GC/Builder", "GC", "Builder", "Customer" all refer to same concept in Bids

### Fixture / Fixture Type
Installed plumbing fixture in a project (toilet, sink, faucet, shower, tub, water heater, etc.). Service-type-specific categorization used in Bids system for labor and pricing calculations.

**Database**: `fixture_types` table with FK to `service_types`

**Used In**: Labor book entries, Price book entries (structured with FK)

**Count Rows**: Use free text `fixture` field (not FK) for flexibility

**Example Values**: "Toilet", "Kitchen Sink", "Shower Valve", "Tub/Shower Combo"

**Management**: Settings page, Fixture Types section (dev access)

### Tie-in
Connection point where new plumbing connects to existing systems (water supply, waste lines, vent stacks).

**Used In**: Counts tab (alongside fixtures)

**Example Values**: "Water Supply Tie-in", "Waste Line Connection", "Gas Line Tie-in"

### Count / Count Row
Quantity entry for a fixture or tie-in in a bid. Stored in Counts tab. Uses free text for flexibility.

**Database**: `bids_count_rows` table

**Fields**: fixture (free text name), count (quantity), page (optional plan page reference)

**Note**: Unlike labor/price books, count rows use free text `fixture` field (not FK) to allow flexible field notes

### Rough In
Initial plumbing installation phase. In-wall piping, water supply lines, drain/waste/vent lines installed before walls closed.

**Stage Context**: One of three main plumbing stages (Rough In → Top Out → Trim Set)

### Top Out
Mid-stage plumbing work. Testing, inspection, adjustments after rough-in before final fixtures.

**Stage Context**: Second of three main plumbing stages

### Trim Set / Trim Out
Final fixture installation phase. Installing visible fixtures, trim kits, faucets, toilets, sinks, etc.

**Stage Context**: Third of three main plumbing stages

**Alias**: "Trim Set" and "Trim Out" used interchangeably

### Takeoff
Process of calculating material quantities from fixture counts. Maps counts to material templates to generate purchase orders.

**Tab**: Third tab in Bids system

**Output**: Purchase orders with calculated quantities

**Print Breakdown**: Printable report (per stage, per fixture) showing parts and assemblies for master plumber audit

### Takeoff Book
Template library mapping fixture names to material templates and stages. Standardizes material takeoffs.

**Database**: `takeoff_book_versions`, `takeoff_book_entries`, `takeoff_book_entry_items`

**Structure**: Version → Entries → Items (Template + Stage pairs)

**Features**: Alias names for matching, multiple templates per fixture

### Labor Book
Template library mapping fixture types to labor hours per stage. Standardizes labor estimates.

**Database**: `labor_book_versions`, `labor_book_entries`

**Structure**: Version → Entries (fixture_type_id FK + hours per stage)

**Fields**: fixture_type_id (FK to fixture_types), rough_in_hrs, top_out_hrs, trim_set_hrs, alias_names

### Price Book
Template library mapping fixture types to pricing per stage. Used for margin analysis.

**Database**: `price_book_versions`, `price_book_entries`

**Structure**: Version → Entries (fixture_type_id FK + prices per stage)

**Fields**: fixture_type_id (FK to fixture_types), rough_in_price, top_out_price, trim_set_price, total_price

### Cost Estimate
Calculated total project cost including materials, labor, driving, and estimator expenses. Created in Cost Estimate tab (4th tab).

**Database**: `cost_estimates`, `cost_estimate_labor_rows`

**Components**: Material costs (from linked POs), Labor costs (hours × rate), Driving costs (calculated), Estimator costs (per count type or flat)

### Driving Cost
Transportation cost calculated from total labor hours, distance to office, and configurable rates.

**Formula**: `(Total Man Hours / Hours Per Trip) × Rate Per Mile × Distance to Office`

**Default Rates**: $0.70/mile, 2.0 hours/trip

**Database**: `driving_cost_rate`, `hours_per_trip` fields on `cost_estimates`

### Estimator Cost
Per-count-type or flat amount added to Labor Total to cover estimator overhead. Default: $10 per Count Type (fixture type row in Counts).

**Options**: Per count row (Count Types × $/count) or flat amount

**Database**: `estimator_cost_per_count`, `estimator_cost_flat_amount` on `cost_estimates`

### Margin / Margin Percentage
Profitability metric comparing revenue to cost.

**Formula**: `((Revenue - Cost) / Revenue) × 100`

**Color Flags**: 
- Red: < 20% (low profitability)
- Yellow: 20-40% (acceptable)
- Green: ≥ 40% (good profitability)

**Tab**: Analyzed in Pricing tab (5th tab)

### Bid Assignment / Pricing Assignment
Link between a count row and a price book entry. Stores fixture-to-pricing mappings for margin analysis.

**Database**: `bid_pricing_assignments` table

**Purpose**: Persist which price book entry applies to each fixture count

### Followup Sheet
Printable/downloadable report showing account manager's assigned projects with contact details and submission history. Available in Submission & Followup tab.

**Formats**: Print preview window, downloadable PDF

**Features**: 
- Select specific account manager, "ALL", or "UNASSIGNED"
- Groups projects by status (Not Yet Won or Lost, Won)
- Includes project details, builder info, project contact, bid details, and latest 3 submission entries
- PDF has clickable phone numbers (tel: links) and emails (mailto: links) for mobile use

**Purpose**: Field reference for account managers with quick access to contact information

### Book / Book Version
Reusable template collection (Takeoff, Labor, or Price book). Multiple versions allow different standards for different job types.

**Pattern**: All three book systems use same structure (versions → entries)

**Selection**: Bid-level version persistence (each bid remembers selected versions)

---

## Materials System

### Part / Material Part
Individual plumbing part or material in the catalog (pipe, fitting, fixture, valve, etc.).

**Database**: `material_parts` table

**Fields**: name, manufacturer, part_type_id (FK to part_types), notes (can include SKU)

### Part Type
Category for organizing material parts in the Materials system (Pipe, Fitting, Valve, Sink, Faucet, etc.). Service-type-specific categorization separate from fixture types used in Bids.

**Database**: `part_types` table (separate from `fixture_types`)

**Management**: Settings page, Part Types section (dev access)

### Supply House / Vendor
Supplier or vendor where materials are purchased (Ferguson, HD Supply, local plumbing supply, etc.).

**Database**: `supply_houses` table

**Fields**: name, contact info, address, notes, monthly_payment_day (day 1–31 when payment is typically due; used for Due column in supply house list)

### Price / Part Price
Cost of a specific part from a specific supply house. One price per (part, supply_house) combination.

**Database**: `material_part_prices` table

**Unique Constraint**: `(part_id, supply_house_id)` - prevents duplicate prices

### Price History
Historical record of price changes. Automatically tracked via database trigger.

**Database**: `material_part_price_history` table

**Tracked**: old_price, new_price, price_change_percent, changed_at, changed_by, notes

**Purpose**: Audit trail and analysis of price trends

### Price Confirmation
Assistant verification of a price before ordering. Tracked per PO item.

**Fields**: `price_confirmed_at`, `price_confirmed_by` on `purchase_order_items`

**Display**: "X hours ago" since confirmation

**Purpose**: Ensure prices are current before placing orders

### Service Type
Trade category (Plumbing, Electrical, HVAC) used to organize materials and bids by specialty. Each part, template, purchase order, and bid must be assigned a service type.

**Database**: `service_types` table (referenced by `material_parts`, `material_templates`, `purchase_orders`, `bids`)

**Initial Types**: Plumbing, Electrical, HVAC

**Management**: Devs can add, edit, delete (if not in use), and reorder service types in Settings

**UI**: Filter buttons above tabs in Materials and Bids sections show only items of selected type

### Assembly Type
Category for organizing material assemblies/templates (Bathroom, Kitchen, Utility, Commercial, Residential, etc.). Service-type-specific categorization for grouping and filtering assemblies.

**Database**: `assembly_types` table

**Fields**: service_type_id (FK), name, category, sequence_order

**Management**: Settings page, Material Assembly Types section (dev access)

**Usage**: Filter and search assemblies in Materials Assembly Book

**Examples**: 
- Plumbing: Bathroom, Kitchen, Utility, Commercial
- Optional field - assemblies can exist without a type

### Template / Material Template / Assembly
Reusable collection of parts and nested assemblies (e.g., "Bathroom rough-in" might include pipes, fittings, and fixtures). Can be added to purchase orders or used in takeoff books.

**Database**: `material_templates` table (with `material_template_items` for contents)

**Fields**: name, description, service_type_id, assembly_type_id (optional)

**Features**: Nested assemblies (assemblies can contain other assemblies), quantity per item, recursive cost calculation

**Management**: 
- Assembly Book tab (Materials) - Focused interface for building and checking assemblies
- Assemblies & Purchase Orders tab - Quick access when building POs

**Use Case**: "Standard Bathroom", "Kitchen Rough-in", "Commercial Restroom", etc.

### Assembly Book
Dedicated tab in Materials for managing assemblies, their parts, nested assemblies, and pricing.

**Location**: Materials page → Assembly Book tab (between Price Book and Assemblies & POs)

**Features**:
- Filter by assembly type
- Search by name, description, or type
- View detailed assembly breakdown with all parts and costs
- Edit part quantities within assemblies
- View all prices at different supply houses
- Quick access to edit parts and prices
- Recursive cost calculation for nested assemblies
- Pricing status indicators (all priced, missing prices, etc.)

**Purpose**: Focused interface for building complete, properly priced assemblies before using them in purchase orders or takeoff books

### Purchase Order (PO)
Order for materials from a supply house. Can be draft (editable) or finalized (locked).

**Database**: `purchase_orders`, `purchase_order_items`

**Statuses**: draft, finalized

**Features**: Draft = editable, Finalized = locked (except add-only notes)

### Draft PO
Editable purchase order. Can add/remove items, change quantities, change supply houses.

**Status**: `status = 'draft'`

**Restrictions**: None (fully editable)

### Finalized PO
Locked purchase order ready for ordering. Cannot edit items but can add notes once.

**Status**: `status = 'finalized'`

**Notes**: Add-only field for final bill amount, pickup issues, etc.

**Fields**: `notes`, `notes_added_by`, `notes_added_at`

### Load All Mode
Price book feature that loads entire parts catalog for instant client-side search and sorting.

**UI**: Toggle button with speed icon, blue indicator when active

**Benefits**: No pagination interruption, perfect for bulk editing

**Default**: Enabled by default

### Infinite Scroll
Pagination mode that automatically loads more parts as user scrolls near bottom.

**Trigger**: Within 200px of page bottom

**Disabled**: When Load All mode is active

### Server-Side Search
Search that queries database instead of filtering loaded results. Searches across entire dataset.

**Debounce**: 300ms delay to prevent excessive queries

**Fields Searched**: name, manufacturer, fixture_type, notes

### Server-Side Sorting
Sorting by price count that queries database for global sort order (not just current page).

**Column**: "#" column header (price count)

**Function**: `get_parts_ordered_by_price_count(ascending_order, filter_service_type_id)`

**Benefit**: See parts with fewest/most prices across entire catalog

---

## Database Concepts

### Migration
SQL file defining schema changes (CREATE TABLE, ALTER TABLE, etc.). Migrations are append-only and never edited after creation.

**Location**: `supabase/migrations/`

**Naming**: `YYYYMMDDHHMMSS_descriptive_name.sql`

**Rule**: Never edit existing migrations; create new ones

### address_geocodes
Cache of **normalized address key** → **latitude** / **longitude** (and source metadata) for the [Map page](#map-page-map) and related geocoding. Written by Edge Functions **`geocode-one`** and **`geocode-address-batch`** (see [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)). Client: [`useMapPageData.ts`](src/hooks/useMapPageData.ts). See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) **Key Features** §16.

### Last work date (`jobs_ledger.last_work_date`)
Cached calendar **`work_date`**: the latest among **approved**, non-rejected, non-revoked **`clock_sessions`** with **`job_ledger_id`** pointing at the job. Maintained by database triggers on **`clock_sessions`** (not edited in Job form). Used for read-only display (e.g. **Job Detail** modal).

### Last bill date (Job Detail modal — UI-only row)
**Not a database column.** In **[`DetailJobModal.tsx`](src/components/jobs/DetailJobModal.tsx)**, the **Last bill date** label shows the calendar-latest **recorded billing activity** from **`deriveRecordedBillingActivityDetail`** ([`stagesJobReferenceDates.ts`](src/lib/stagesJobReferenceDates.ts)): **`jobs_ledger_invoices`** **`sent_to_customer_at`** / **`billed_at`** and **`jobs_ledger_payments`** **`paid_on`** only (manual **`last_bill_date`** is **excluded** here; see **Last manual bill date** and Stages **`b:`**). **`—`** when no activity qualifies or when the modal uses a **limited** snapshot without invoice/payment data.

### Last manual bill date (`jobs_ledger.last_bill_date`)
**UI label** in **Edit Job** / **Detail Job**: **Last manual bill date** (database column **`last_bill_date`**). Business date for billing / Stages aging / partial-invoice defaults—**entered by the user**, not auto-updated when an invoice is sent. Set in **Edit Job** and **When Billed** / **Missing Billed Date** on Jobs **Ready to Bill** when unset. Former column name **`estimated_completion_date`**. Future **Stripe** webhooks may set or align this field. Included in the **Stages `b:`** line (`max` with invoice/payment activity; see below).

### Primary remainder vs partial Ready-to-Bill lines (`jobs_ledger_invoices`)
For jobs in **Ready to Bill**, **`jobs_ledger_invoices`** can have **multiple** rows with **`status = ready_to_bill`**. Exactly one row should have **`is_primary_rtb_bundle = true`**: the **remainder** line whose **`amount`** is kept in sync with unallocated balance (**revenue − payments − sum of ready_to_bill and billed invoice amounts**) by **`ensure_single_ready_to_bill_invoice_for_job`**. User-created **partial** lines use **`is_primary_rtb_bundle = false`**; their amounts are **not** overwritten by that RPC. **Bill Customer** from the **job** row targets the **primary** remainder; billing a **partial** amount uses **Bill Customer** on that **invoice** row.

### Other job charges (Jobs — manual materials)
User-facing label for **manual job materials** lines stored on **`jobs_ledger_materials`** in **Edit Job** and **Job Detail** materials cost accordions (and in Jobs **Parts** totals / Quickfill copy). Replaces the older **Billed materials** wording. See **`RECENT_FEATURES.md`** → v2.277; **`JobFormModal.tsx`**, **`JobDetailMaterialsCostSection.tsx`**.

### Stages lines `j:` and `b:` (Jobs Stages tab)
Read-only **T±n (weekday)** summaries under **Assigned / HCP**: **`j:`** (job / field) = calendar-latest of **`last_work_date`** (approved clock sessions cache) and max **`job_schedule_blocks.work_date`** for the job; **`b:`** (billing reference) = calendar-**latest** of **last manual bill date** (**`last_bill_date`**) and invoice **`sent_to_customer_at`** / **`billed_at`** and payment **`paid_on`**—**`—`** only when all of those are empty. Helpers: **`src/lib/stagesJobReferenceDates.ts`**.

### Stages Last activity — Stripe emailed customer (Jobs)
When **Jobs** **Stages** **Last activity** shows **Stripe emailed customer** plus a time line and **Resend invoice email**, the job has exactly **one** matching **billed** Stripe invoice line with **`sent_to_customer_at`** set (**`stagesJobLevelStripeEmailedHintInvoice`** in **`Jobs.tsx`**); multiple billed Stripe lines hide the block. **Resend** invokes Edge **`send-stripe-invoice`** (same as **Send Email invoice from Stripe** in **Bill Customer** / hosted bill). **`jobs_ledger_invoices.sent_to_customer_at`** holds the **latest** send timestamp; append-only **`jobs_ledger_invoice_stripe_email_sends`** records each successful **PipeTooling** send for history in the confirm modal. See **`RECENT_FEATURES.md`** → v2.303, v2.304.

### pay_stub_payments
Physical installment rows against a generated pay stub: amount sent, optional sent-on date, optional memo. A database trigger prevents the sum of installment amounts from exceeding **Net Pay** (stub **gross_pay** minus **`pay_stub_deductions`** plus **`pay_stub_additional_lines`** `line_total`, within a small rounding tolerance).

**Contrast with `pay_stub_days`**: Day rows allocate gross by **work date** (used in Annual Pay to Date: earned vs allocated). **`pay_stub_payments`** tracks **cash actually sent** and drives Pay History **Paid to date**, **Balance**, and Unpaid / Partial / Paid status (against **Net Pay**).

**Client helpers**: `src/lib/payStubPayments.ts` (e.g. sum, remaining, fully paid).

**See also**: `RECENT_FEATURES.md` → v2.172, v2.173, v2.174; `PROJECT_DOCUMENTATION.md` → People (Pay History).

### person_offsets
Per-person **backcharges**, **damages**, and **employee credits** (`person_offsets.type`, migration **`20270408163000`**). Pending rows (`pay_stub_id` null) surface on printed pay reports; applied rows link to a pay stub. **Employee credit** records money owed *to* the employee (for example a payment overage captured as a pending offset). **Less** in `src/components/pay/PayStubLessModal.tsx` does not **Apply** employee credits as deductions.

**See also**: `RECENT_FEATURES.md` → v2.252; `PROJECT_DOCUMENTATION.md` → People (Offsets, Pay History).

### pay_stub_deductions
**Less** lines on a pay stub: amounts subtracted from **gross_pay** as part of **Net Pay**. Each row is either **manual** (description + amount) or **offset** (linked to **`person_offsets`**). Sum of deductions cannot exceed gross; changing deductions is blocked if existing installments would exceed the new Net Pay (which also includes **Additional**).

**See also**: `RECENT_FEATURES.md` → v2.173, v2.174; `src/components/pay/PayStubLessModal.tsx`.

### pay_stub_additional_lines
**Additional** lines on a pay stub: **quantity** × **rate**, with **`line_total`** generated in the database as `round(quantity * rate, 2)`. **Net Pay** = **gross_pay** − sum(Less) + sum(Additional line totals). Edits are blocked when installments already fully cover Net Pay, same pattern as **Less**. Optional **`source_clock_session_id`** links a line to **`clock_sessions`** (for example a **prevailing wage** top-up from an approved session in the stub period); partial unique index enforces at most one such row per stub per session. **`description`** is user-facing text only (**v2.345**): new prevailing-wage rows do not embed a machine prefix; **`stripPrevailingWageTag`** in **`payStubPrevailingWageLine.ts`** strips any legacy **`[pw:<uuid>]`** leader for the Additional modal and pay report HTML, while **`parsePrevailingSessionId`** can still read it for dedup on old rows.

**Client helpers**: `src/lib/payStubDeductions.ts`, `src/lib/payStubPrevailingWageLine.ts`.

**See also**: `RECENT_FEATURES.md` → v2.345, v2.174; `PROJECT_DOCUMENTATION.md` → People (Pay History); `MIGRATIONS.md` → `20260420051645`; `src/components/pay/PayStubAdditionalModal.tsx`.

### Trigger
Automatic database function that fires on INSERT, UPDATE, or DELETE operations.

**Common Uses**: 
- Update `updated_at` timestamps
- Cascade customer master changes to projects
- Track price history changes

**Example**: `update_updated_at_column()` trigger on all tables

### Cascade / Cascading
Automatic propagation of changes via foreign keys.

**ON DELETE CASCADE**: Deleting parent deletes children (e.g., delete project → delete workflow)

**ON DELETE SET NULL**: Deleting parent nulls reference (e.g., delete user → null `created_by`)

**ON UPDATE CASCADE**: Updating parent updates children (e.g., customer owner → project owner)

### Foreign Key
Database constraint linking tables via ID references.

**Pattern**: `other_table_id UUID REFERENCES other_table(id)`

**Cascading**: Specifies what happens on parent DELETE/UPDATE

### Check Constraint
Database validation rule enforcing data integrity.

**Examples**: 
- `CHECK (quantity > 0)` - no negative quantities
- `CHECK (price >= 0)` - no negative prices
- `CHECK (count >= 0)` - no negative counts

### Unique Constraint
Database rule preventing duplicate values.

**Examples**:
- `UNIQUE (version_id, fixture_name)` - no duplicate fixtures per version
- `UNIQUE (bid_id, count_row_id)` - one pricing assignment per count row
- `UNIQUE (part_id, supply_house_id)` - one price per part per supply house

### Index
Performance optimization structure for faster queries.

**Types**: Regular, Unique, Partial (with WHERE clause)

**Purpose**: Speed up lookups on frequently queried columns

### Transaction / Transaction Function
Multiple database operations wrapped in atomic unit. All succeed or all rollback.

**Benefits**: Prevents partial data on failures

**Examples**: `create_project_with_template()`, `duplicate_purchase_order()`

### Atomic Operation
Database operation that completes fully or not at all (no partial completion).

**Guarantee**: Either all changes commit or all rollback

**Implementation**: Transaction functions in PostgreSQL

---

## Technical Terms

### Supabase
Backend-as-a-service platform providing PostgreSQL database, authentication, edge functions, and real-time subscriptions.

**Components**: Database (PostgreSQL), Auth (JWT-based), Edge Functions (Deno), Storage, Realtime

**URL Pattern**: `https://[project-ref].supabase.co`

### Edge Function
Serverless function running on Deno runtime. Handles privileged operations requiring service role permissions.

**Runtime**: Deno (TypeScript/JavaScript)

**Location**: `supabase/functions/`

**Examples**: create-user, archive-user, restore-user, login-as-user, send-workflow-notification

### Resend
Email delivery service used for sending notification emails.

**API Key**: Stored in Supabase Edge Functions secrets

**Used By**: `send-workflow-notification`, `test-email` edge functions

### JWT (JSON Web Token)
Authentication token containing user ID and metadata. Passed in Authorization header.

**Format**: `Authorization: Bearer <jwt_token>`

**Contains**: user_id, role, email, expiry

### Service Role Key
Supabase admin key with full database access (bypasses RLS). Used in Edge Functions for privileged operations.

**Security**: Never expose to frontend; only use in backend

**Storage**: Supabase Edge Functions secrets

### GitHub Pages
Static site hosting service. Pipetooling deploys here via GitHub Actions.

**URL Pattern**: `https://[username].github.io/[repo]/`

**Deployment**: Automatic on push to main branch

**SPA note**: Deep links (e.g. `/dashboard`) have no static file; the host may return **HTTP 404** for the document while still serving **`404.html`** (copy of `index.html`). **Hard Reload** in the app loads **`/`** first then restores the path in the browser ([`TROUBLESHOOT_404.md`](TROUBLESHOOT_404.md), [`src/lib/hardReload.ts`](src/lib/hardReload.ts)).

### GitHub Actions
CI/CD automation running workflows on GitHub events.

**Location**: `.github/workflows/deploy.yml`

**Triggers**: Push to main branch

**Steps**: Install dependencies, build, deploy to GitHub Pages

### Vite
Frontend build tool and dev server. Fast hot module replacement (HMR) during development.

**Dev Server**: `npm run dev` (port 5173 by default)

**Build**: `npm run build` → outputs to `dist/`

**Config**: `vite.config.ts`

### React Router DOM
Client-side routing library for React single-page applications.

**Routes**: Defined in `src/App.tsx`

**Components**: `<BrowserRouter>`, `<Routes>`, `<Route>`, `<Navigate>`

### Context API
React pattern for sharing state across component tree without prop drilling.

**Used For**: Authentication state (`AuthContext`)

**Pattern**: Provider at root, consumers via `useContext()` hook

---

## UI/UX Terms

### Protected Route
Route component that requires authentication. Redirects to sign-in if user not authenticated.

**Implementation**: `ProtectedRoute` wrapper in `App.tsx`

**Redirects**: Unauthenticated users → `/sign-in`

### Map page (`/map`)
**Leaflet** + OpenStreetMap **tiles**; circle markers for **jobs**, **bids**, and **estimates**; top **Filter** (token-and search over name, address, #, and meta) narrows **pins** and the **table**; **Geoman** polygon draw refines the list further; **Review geocodes** (batch re-run, optional **Google** refresh) is under the bottom-right **Debug** disclosure. **Dev** can set an org **default map center/zoom** in **Settings** (`map_default_view_v1` in `app_settings`; see `MapDefaultViewSettingsBlock`, `mapDefaultViewSettings.ts`). The **header** **Map** (pin) link is **dev**-only; route access and **Edge** geocoding rules are summarized in [ACCESS_CONTROL.md](ACCESS_CONTROL.md) (Page Access Matrix) and [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) §16.

### Layout
Component wrapping page content with navigation header.

**Location**: `src/components/Layout.tsx`

**Features**: Navigation links, role-based menu visibility, user menu

### Modal
Overlay dialog for forms and confirmations. Used extensively for create/edit operations.

**Pattern**: Conditional rendering based on state (e.g., `showModal` boolean)

**Close**: X button, Cancel button, or click outside (some modals)

### Toast / Notification
Temporary message showing success/error feedback.

**Library**: Custom implementation or third-party (check code)

**Duration**: Typically 3-5 seconds

### Dropdown / Select
Form input allowing selection from list of options.

**Types**: 
- Standard select element
- Searchable dropdown (custom)
- Autocomplete (with filtering)

### Quick Fill
Feature in Customers page for bulk-pasting customer data from spreadsheet.

**Format**: Tab-separated values (name, address, email, phone, date)

**Location**: Expandable section in New Customer form

**Visibility**: Collapsed by default, hidden in Bids modal

### Quickfill (page)
The **`/quickfill`** route — day-to-day workflow hub (section marks, hours, **Prospects**, schedule, inboxes, etc.). Not the same as **Quick Fill** (customer bulk paste). **Prospects** block: warmth pipeline + (for **dev** / **master** / **assistant**) a **30-day Team activity line chart** — **`RECENT_FEATURES.md`** v2.381 / v2.382, **`PROJECT_DOCUMENTATION.md`** (Quickfill), **`ACCESS_CONTROL.md`**.

### Expandable Row
Table row that expands to show additional details.

**Used In**: Price Book (shows all prices), Materials (shows notes)

**Trigger**: Click row or expand icon

### Inline Editing
Editing field directly in table/list without opening modal.

**Example**: PO name editing in Draft POs

**Pattern**: Click to edit, blur or Enter to save

### Page Pins
User-customizable shortcut links on the Dashboard. Stored in localStorage and/or `user_pinned_tabs` table.

**Management**: Settings → Dashboard Page Pins → Page pins (Clear all, Remove per pin). Users add pins via the Layout pin icon when on pinnable pages.

**Dev-only pins**: Devs can pin financial totals (Billed Awaiting Payment, Supply Houses AP, Sub Labor Due, Cost matrix) to masters/devs dashboards via dev-only sections in Settings.

---

## Abbreviations

- **PO**: Purchase Order
- **RLS**: Row Level Security
- **FK**: Foreign Key
- **GC**: General Contractor
- **HMR**: Hot Module Replacement
- **CRUD**: Create, Read, Update, Delete
- **JWT**: JSON Web Token
- **UUID**: Universally Unique Identifier
- **RPC**: Remote Procedure Call (Supabase functions)
- **UI**: User Interface
- **UX**: User Experience
- **API**: Application Programming Interface
- **SQL**: Structured Query Language
- **CSV**: Comma-Separated Values
- **JSON**: JavaScript Object Notation
- **JSONB**: JSON Binary (PostgreSQL data type)

---

## Common Phrases

### "Adopted master"
A master who has adopted the current user (assistant). Grants the assistant access to the master's data.

### "Shared master"
A master who has granted the current user (another master) assistant-level access to their data.

### "Own data"
Resources where `master_user_id` or `created_by` matches current user's ID.

### "Via adoption"
Access granted because a master adopted the current user.

### "Via sharing"
Access granted because a master shared with the current user.

### "Assistant-level access"
Read-only access with restrictions: can view but not modify, cannot see private notes or financial totals.

### "Cascade to projects"
When customer owner changes, automatically update owner on all customer's projects.

### "Expand template"
Recursively resolve nested templates to get final list of parts with quantities.

### "Book version"
Specific set of entries in a book (Takeoff, Labor, or Price). Allows different standards for different scenarios.

### "Apply book"
Use selected book version to populate fields (labor hours from Labor Book, pricing from Price Book, etc.).

### "RLS policy"
Row-level security rule on a table defining who can access which rows.

### "Helper function"
Database function using SECURITY DEFINER to check conditions without RLS recursion.

### "Transaction function"
Database function wrapping multiple operations in atomic transaction with rollback.

### "Type generation"
Command to auto-generate TypeScript types from Supabase schema: `supabase gen types typescript`

---

**Last Updated**: 2026-02-10

**Related Documentation**: 
- [AI_CONTEXT.md](./AI_CONTEXT.md) - Quick project overview
- [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Role permissions details
- [BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids terminology in context
- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Technical reference
