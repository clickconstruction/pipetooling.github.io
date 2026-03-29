# Workflow Features Documentation

This document provides detailed information about all workflow-related features.

## Table of Contents
1. [Stage Management](#stage-management)
2. [Financial Tracking](#financial-tracking)
3. [Access Control](#access-control)
4. [Notifications](#notifications)
5. [Action History](#action-history)

---

## Stage Management

### Step Assignment

**Location**: "Add Step" modal → "Assigned to" field

**Features**:
- **Searchable autocomplete dropdown** showing all masters and subcontractors
- **Real-time filtering** as you type (case-insensitive search)
- **Source indicators**: 
  - Shows "(user)" for people with user accounts
  - Shows "(not user)" for roster entries without accounts
- **Add new person**: 
  - If name entered doesn't match any existing person, shows "Add [name]" option in dropdown
  - Opens modal with fields: Name (pre-filled), Email, Phone, Notes
  - Defaults to `kind: 'sub'` (subcontractor)
  - Validates for duplicate names (case-insensitive)
  - Automatically selects newly added person after creation
- **Data sources**: 
  - Queries `users` table for roles `'master_technician'` and `'subcontractor'`
  - Queries `people` table for kind `'master_technician'` and `'sub'`
  - Combines and deduplicates by name (case-insensitive)

**Implementation**: `src/pages/Workflow.tsx` - `StepFormModal` component

### Setting Start Time

**Button**: "Set Start" (replaces old "Start" button)

**Behavior**:
- Opens a modal with datetime-local input
- Pre-filled with current date/time
- Allows setting custom start time (past or future)
- Saves `started_at` timestamp and sets status to `in_progress`
- Records action in Action Ledger

**Function**: `markStarted(step, startDateTime?)`

### Stage Status Actions

**Available Actions** (based on status and user role):
- **Set Start**: Pending stages only
- **Complete**: Pending or in-progress stages
- **Approve**: Pending or in-progress (dev, master, assistant, superintendent)
- **Previous work incomplete**: Pending or in-progress (dev, master, assistant, superintendent)
- **Re-open**: Completed, approved, or rejected (owners/masters only)

**Note**: Approve and Previous work incomplete refer to the card they appear on (same step), not the previous card.

**Access Control**:
- Assistants/subcontractors can only use Set Start and Complete on stages assigned to them
- Owners/masters can use all actions on any stage
- Superintendents can use Set Start, Complete, Approve, and Send Back: Previous Work Incomplete on stages in workflows they have access to

### Action Ledger

**Location**: Bottom of each stage card

**Content**:
- Complete chronological history of all actions
- Shows: Action type, performer name, timestamp, optional notes
- Ordered newest first
- Visible to all users who can see the stage

**Database**: `project_workflow_step_actions` table

### Button Styling

Workflow uses scoped CSS classes (`wf-btn-ghost`, `wf-btn-primary`, `wf-btn-success`, `wf-btn-danger`, `wf-btn-info`, `wf-btn-secondary`, etc.) with hover states and transitions. **Action button colors**: Set Start blue (initiate, `wf-btn-info`), Complete green (success, `wf-btn-success`), Approve blue (manager sign-off, `wf-btn-info`), Previous work incomplete red (destructive, `wf-btn-danger`). Approve and Previous work incomplete are visually separated from Set Start and Complete (left border, spacing) and available to dev, master, assistant, and superintendent. Notify control is right-aligned when the card is expanded.

### Collapse Old Stages Toggle

- **Toggle button**: "Collapse old stages" / "Expand old stages" (shown when 2+ completed/approved stages).
- **When off**: All steps shown individually.
- **When on**: Old completed stages (all but the most recent by `sequence_order`) are replaced by a single summary row: `X previous stages · Started {date}`. Most recent completed stage stays visible. Summary row is clickable to expand.
- **Implementation**: `oldStagesCollapsed` state; `displayItems` array with `summary` or `step` types; summary card uses green background `#f0fdf4`.

### Stage Breadcrumb Layout

- **Location**: Dedicated row below the title and "Expand old stages" / "Add step" buttons.
- **Full width**: Breadcrumb spans full width; no longer competes with buttons on the same row.
- **Horizontal scroll**: Stages stay on one line (`whiteSpace: nowrap`); horizontal scrollbar when content exceeds viewport. Uses `overflowX: auto`, `minWidth: 0`, `WebkitOverflowScrolling: touch` following Materials/People pattern.
- **Click to scroll**: Each stage name is clickable and scrolls the corresponding step card into view.

---

## Financial Tracking

### Collapsible Sections (Stage Card)

**Row collapse**: Entire step card can collapse to 1–2 lines. Completed/approved cards default collapsed. Chevron in header toggles expand/collapse. Collapsed header shows Start/End dates, line items (count + total), Notes/Pvt word counts. Assign and Notify hidden when collapsed. Notes and Private Notes section labels show word count (e.g. "Notes (12 words)").

Each stage card has collapsible sections for Notify, Notes, Private Notes, and Line Items For Office.

**Notify when stage**:
- Always collapsed by default
- Cross-step checkboxes ("Notify next card assignee when complete or approved", "Notify prior card assignee when marked incomplete") default to on (null/undefined = checked)
- These two checkboxes do not affect section expansion

**Notes, Private Notes, Line Items For Office**:
- Expand when stage is in progress or when section has content
- Same font size (1rem) for all three headers
- No blue background/border (matches Notes styling)

**Line Items For Office when collapsed**:
- Header shows total: "Line Items For Office | $3,000.00"
- Total is sum of all line item amounts for that stage

---

### Line Items For Office (Stage-Level)

**Purpose**: Track actual expenses/credits for individual workflow stages

**Location**: Separate collapsible section in each stage card (visible to devs, masters, and assistants)

**Fields**:
- **Date (optional)**: User-entered calendar date (`item_date`); shown in the **Line Items For Office** table and in delete confirmation when set.
- **Link (optional)**: URL for external references
- **Memo**: Description (required)
- **Amount**: Monetary value (required, supports negative numbers)

**Features**:
- Add, edit, delete line items
- Negative amounts for credits/refunds
- Amounts formatted with commas: `$1,234.56`
- Aggregated in Ledger at top of workflow
- **Clipboard bulk import (Add Line Item only)**: Header icon reads the system clipboard; expects **tab-separated** lines: `M/D/YYYY`, memo, amount (with optional `$` and spaces). All-or-nothing parse; one bulk `insert`. Requires a secure context (HTTPS or localhost) for the Clipboard API. Hidden when editing an existing line item.
- **Supply House Invoice Integration**: Line items can link to `supply_house_invoices` via `supply_house_invoice_id`. "Add Supply House Invoice" button when invoices exist; modal with search by invoice #, supply house name, amount, date, PO #, paid/unpaid. "View Invoice" button on linked line items opens details modal.

**Access / Visibility**:
- Devs and masters can see and manage line items for all stages
- Assistants can see and edit line items for projects they can access (via adopted masters)
- Subcontractors cannot see line items

**Database**: `workflow_step_line_items` table

### Projections & Ledger (Workflow-Level)

**Purpose**: Track projected/estimated costs for entire workflow and compare against actuals

**Location**: Shared financial panel at top of workflow page (Projections and Ledger in one box)

**Fields**:
- **Stage**: Stage name (required)
- **Memo**: Description (required)
- **Amount**: Monetary value (required, supports negative numbers)

**Features**:
- Add, edit, delete projections
- Negative amounts for credits/adjustments
- Amounts formatted with commas: `$1,234.56`
- Projections table and Ledger table shown in a single panel
- `Projections Total`, `Ledger Total`, and **“Total Left on Job: Projections - Ledger = …”** displayed
- Visual distinction: Light blue background for the entire financial panel

**Database**:
- Projections: `workflow_projections` table
- Line items (feeding Ledger): `workflow_step_line_items` table

---

## Access Control

### Role-Based Visibility

**Owners and Master Technicians**:
- See all stages in all workflows
- Can add, edit, delete stages
- Can see private notes, line items, projections, ledger
- Can use all action buttons
- Can manage notification settings

**Assistants**:
- Only see stages where `assigned_to_name` matches their name (for projects they can access via adopted masters)
- Cannot add, edit, or delete stages
- Cannot see private notes, projections, or ledger; can see and edit line items on accessible projects
- Can only use Set Start and Complete on assigned stages
- Can only see "ME" column in notification settings
- Error message if accessing workflow with no assigned stages

**Subcontractors**:
- Only see stages where `assigned_to_name` matches their name
- Cannot add, edit, or delete stages
- Cannot see private notes, line items, projections, or ledger
- Can only use Set Start and Complete on assigned stages
- Can only see "ME" column in notification settings
- Error message if accessing workflow with no assigned stages

**Superintendents**:
- See all stages in workflows for projects they have access to (via adoption or project assignment)
- Cannot add, edit, or delete stages; can assign people
- Can see private notes, line items; cannot see projections or financial totals
- Can use Set Start, Complete, Approve, and Send Back: Previous Work Incomplete on stages in accessible workflows
- Can only see "ME" column in notification settings

### Person Assignment

**Feature**: "Add person to:" modal improvements

**Current User**:
- Always appears first in the list
- Highlighted with blue background and border
- Label: "(You)" after name
- Excluded from roster list below

**Implementation**: `currentUserName` state tracks signed-in user's name

---

## Notifications

### Notification Settings

**Location**: Top-right of each stage card

**Columns**:
- **ASSIGNED**: Controls notifications sent to the person assigned to the stage (owners/masters only)
- **ME**: Controls notifications for the current user (all users)

**Options**:
- Notify when stage: started, complete, re-opened (section collapsed by default)
- Cross-step notifications (owners/masters only, default to on):
  - Notify next card assignee when complete or approved
  - Notify prior card assignee when marked incomplete

**Database**: 
- Stage-level: `notify_assigned_when_*` fields
- User-level: `step_subscriptions` table

---

## Amount Formatting

### Display Format

All monetary amounts throughout the application use comma formatting:

- **Positive**: `$1,234.56`
- **Negative**: `($1,234.56)` in red
- **Large numbers**: `$1,234,567.89`

**Implementation**: `formatAmount()` function uses `toLocaleString('en-US')` with 2 decimal places

**Applied to**:
- Line Items For Office (in cards and Ledger)
- Projections
- All financial totals

---

## Database Schema Updates

### New Tables

1. **`workflow_step_line_items`**
   - Stage-level financial tracking
   - Foreign key to `project_workflow_steps` with CASCADE delete

2. **`workflow_projections`**
   - Workflow-level financial projections
   - Foreign key to `project_workflows` with CASCADE delete

3. **`email_templates`**
   - Customizable email content
   - 11 template types supported

### Modified Tables

1. **`project_workflow_steps`**
   - Added `private_notes` field (TEXT, nullable)

---

## Migration Order

When setting up a new environment, run migrations in this order:

1. `add_private_notes_to_workflow_steps.sql`
2. `create_workflow_step_line_items.sql`
3. `create_workflow_projections.sql`
4. `create_email_templates.sql` (see `EMAIL_TEMPLATES_SETUP.md`)

---

## Related Documentation

- `PRIVATE_NOTES_SETUP.md` - Detailed setup instructions
- `RECENT_FEATURES.md` - Summary of all recent features
- `PROJECT_DOCUMENTATION.md` - Overall architecture
