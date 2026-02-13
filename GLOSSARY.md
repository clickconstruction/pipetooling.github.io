# Project Glossary

> **Purpose**: Comprehensive definitions of all domain-specific terms, technical concepts, and project-specific terminology used in Pipetooling.

---
file: GLOSSARY.md
type: Reference
purpose: Comprehensive definitions of all domain-specific terms and technical concepts
audience: All users (especially new developers and AI agents)
last_updated: 2026-02-13
estimated_read_time: 15-20 minutes (reference only)
difficulty: Beginner

total_terms: ~122
categories: 9

key_sections:
  - name: "User Roles"
    line: ~17
    anchor: "#user-roles"
    terms: 5
  - name: "Project Management"
    line: ~66
    anchor: "#project-management"
    terms: 6
  - name: "Access Control"
    line: ~107
    anchor: "#access-control"
    terms: 5
  - name: "Workflow Concepts"
    line: ~162
    anchor: "#workflow-concepts"
    terms: 7
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
    terms: 10
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

**Capabilities**: Start/Complete assigned stages only

**Key Restriction**: Cannot see any stage they're not explicitly assigned to

### estimator (Estimator)
Bid estimation specialist with access only to Bids and Materials systems. Cannot access ongoing project management, workflows, or dashboard. Can view all customers (for bid creation) and create new customers via Bids modal.

**Capabilities**: Full Bids system, full Materials system, view/create customers (via Bids)

**Key Restriction**: No access to Projects, Workflows, Dashboard, Calendar, or Settings pages

---

## Project Management

### Customer
A client or General Contractor (GC) who provides work. Customers have an owner (`master_user_id`) and can have multiple projects. In the Bids context, customers are also called "GC/Builder".

**Database**: `customers` table

**Key Fields**: name, address, contact info (JSONB), date_met, master_user_id

### Project
A job site or construction project for a specific customer. Each project has one workflow. The project owner automatically matches the customer owner (enforced by database trigger).

**Database**: `projects` table

**Key Fields**: name, description, status, customer_id, master_user_id, address

**Rule**: Project owner = Customer owner (cannot be changed independently)

### Workflow
A sequence of stages/steps for completing a project. Each project has exactly one workflow. Created from templates or built from scratch.

**Database**: `project_workflows` table

**Relationship**: One per project (1:1)

### Stage / Step
Individual work phase in a project workflow (e.g., "Rough In", "Inspection", "Top Out", "Trim Set"). Can be assigned to people, have start/complete dates, and track status (pending, in_progress, completed, approved, rejected).

**Database**: `project_workflow_steps` table

**Alias**: "Stage" and "Step" used interchangeably

**Statuses**: pending, in_progress, completed, approved, rejected

### Template
Reusable workflow definition. Masters and devs can create templates with pre-defined stages. When creating a project, can select a template to auto-generate workflow stages.

**Database**: `workflow_templates`, `workflow_template_steps` tables

**Access**: Only dev can create/edit templates

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
Financial entry on a workflow stage representing materials, labor, or expenses. Has memo, amount, and optional link to external resources.

**Database**: `workflow_step_line_items` table

**Access**: Masters and assistants can add/edit; assistants cannot see totals

**Optional**: Can link to purchase order for material tracking

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
Status change event recorded in history (started, completed, approved, rejected, reopened). Provides complete audit trail of stage lifecycle.

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

---

## Bids System

### Bid / Bid Board
The main bid management system. Bid Board is the first tab showing all bids in a list.

**Database**: `bids` table

**6 Tabs**: Bid Board, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission & Followup

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
Calculated total project cost including materials, labor, and driving expenses. Created in Cost Estimate tab (4th tab).

**Database**: `cost_estimates`, `cost_estimate_labor_rows`

**Components**: Material costs (from linked POs), Labor costs (hours × rate), Driving costs (calculated)

### Driving Cost
Transportation cost calculated from total labor hours, distance to office, and configurable rates.

**Formula**: `(Total Man Hours / Hours Per Trip) × Rate Per Mile × Distance to Office`

**Default Rates**: $0.70/mile, 2.0 hours/trip

**Database**: `driving_cost_rate`, `hours_per_trip` fields on `cost_estimates`

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

**Fields**: name, contact info, address, notes

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

**Examples**: create-user, delete-user, login-as-user, send-workflow-notification

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

### Expandable Row
Table row that expands to show additional details.

**Used In**: Price Book (shows all prices), Materials (shows notes)

**Trigger**: Click row or expand icon

### Inline Editing
Editing field directly in table/list without opening modal.

**Example**: PO name editing in Draft POs

**Pattern**: Click to edit, blur or Enter to save

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
