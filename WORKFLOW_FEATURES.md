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
- **Approve**: Pending or in-progress (owners/masters only)
- **Reject**: Pending or in-progress (owners/masters only)
- **Re-open**: Completed, approved, or rejected (owners/masters only)

**Access Control**:
- Assistants/subcontractors can only use Set Start and Complete on stages assigned to them
- Owners/masters can use all actions on any stage

### Action Ledger

**Location**: Bottom of each stage card

**Content**:
- Complete chronological history of all actions
- Shows: Action type, performer name, timestamp, optional notes
- Ordered newest first
- Visible to all users who can see the stage

**Database**: `project_workflow_step_actions` table

---

## Financial Tracking

### Line Items (Stage-Level)

**Purpose**: Track actual expenses/credits for individual workflow stages

**Location**: Separate section in each stage card (visible to devs, masters, and assistants)

**Fields**:
- **Memo**: Description (required)
- **Amount**: Monetary value (required, supports negative numbers)

**Features**:
- Add, edit, delete line items
- Negative amounts for credits/refunds
- Amounts formatted with commas: `$1,234.56`
- Aggregated in Ledger at top of workflow

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
- Notify when stage: started, complete, re-opened
- Cross-step notifications (owners/masters only):
  - Notify next card assignee when complete or approved
  - Notify prior card assignee when rejected

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
- Line Items (in cards and Ledger)
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
