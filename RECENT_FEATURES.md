# Recent Features and Updates

This document summarizes all recent features and improvements added to Pipetooling.

## Table of Contents
1. [Latest Updates (v2.4)](#latest-updates-v24)
2. [Workflow Features](#workflow-features)
3. [Calendar Updates](#calendar-updates)
4. [Access Control](#access-control)
5. [Email Templates](#email-templates)
6. [Financial Tracking](#financial-tracking)
7. [Customer and Project Management](#customer-and-project-management)

---

## Latest Updates (v2.4)

### Assistant Workflow Access Improvements

**Date**: 2026-01-21

**Changes**:
- ✅ **Assistants can now see ALL stages** in workflows they have access to (via master adoption)
  - Previously, assistants were incorrectly filtered to only see assigned stages (same as subcontractors)
  - Now assistants have broader visibility while subcontractors remain restricted to assigned stages only
- ✅ **Line items update immediately** for assistants after adding/editing
  - Fixed issue where assistants couldn't see newly added line items until page refresh
  - Updated `useEffect` to include assistants in line items loading
  - Added explicit reload after save/delete operations

**Files Modified**:
- `src/pages/Workflow.tsx` - Removed assistant filtering from `loadSteps()`, updated line items loading

### Financial Tracking Updates

**Changes**:
- ✅ **Assistants can add line items** but cannot see financial totals
  - Assistants can view and edit the Ledger table (all line items)
  - Assistants cannot see "Ledger Total" or "Total Left on Job" (devs/masters only)
  - Projections section remains dev/master-only
- ✅ **Updated label**: "Line Items (You and your assistant only)" → "Line Items (Master and Assistants only)"

**Files Modified**:
- `src/pages/Workflow.tsx` - Split Projections and Ledger sections, hid totals from assistants

### Workflow Stage Status Display

**Changes**:
- ✅ **Status moved to top of card**: Now displays right below "Assigned to" line
  - Format: `Status: {status}` for all status types
  - Rejected status includes reason inline: `Status: rejected - {rejection_reason}`
  - Rejected status shown in red (#b91c1c) with bold font
- ✅ **Removed duplicate status display** from bottom of card

**Files Modified**:
- `src/pages/Workflow.tsx` - Moved status display, removed separate rejection reason display

### Re-open Rejected Stages

**Changes**:
- ✅ **Added "Re-open" button** for rejected stages
  - Visible to devs/masters and assigned person
  - Resets stage to `pending` status
  - Clears `ended_at`, `rejection_reason`, `approved_by`, and `approved_at`
  - Records 'reopened' action in action ledger
  - Sends notifications to subscribed users

**Files Modified**:
- `src/pages/Workflow.tsx` - Added `markReopened()` function and button

### Database RLS Optimizations

**Changes**:
- ✅ **Optimized `workflow_step_line_items` RLS policies**
  - Created `can_access_project_via_step()` helper function
  - Prevents timeout errors when loading line items
  - Uses SECURITY DEFINER to bypass RLS and avoid recursion
- ✅ **Fixed `project_workflow_step_actions` RLS policies**
  - Created `can_access_step_for_action()` helper function
  - Allows authenticated users to insert actions for accessible steps
  - Fixes 403/500 errors when recording workflow actions

**Migration Files Created**:
- `supabase/migrations/optimize_workflow_step_line_items_rls.sql`
- `supabase/migrations/fix_project_workflow_step_actions_rls.sql`

**Key Functions**:
- `public.can_access_project_via_step(step_id_param UUID)` - Checks project access via step
- `public.can_access_step_for_action(step_id_param UUID)` - Checks step access for actions

---

## Workflow Features

### Private Notes and Line Items

**Location**: Each workflow stage card

**Features**:
- **Private Notes**: Text area visible only to owners and master technicians
- **Line Items**: Track expenses/credits per stage with memo and amount
- **Ledger**: Aggregated view of all line items across all stages, shown in the shared Projections/Ledger panel at the top of the workflow

**See**: `PRIVATE_NOTES_SETUP.md` for complete documentation

### Projections

**Location**: Shared financial panel at top of workflow page (combined with Ledger)

**Features**:
- Track projected costs for the entire workflow
- Fields: Stage name, Memo, Amount
- Supports negative numbers (for credits/adjustments)
- Amounts formatted with commas (e.g., `$1,234.56`)
- Projections Total and Ledger Total both shown
- **Total Left on Job: Projections - Ledger = ...** displayed at bottom of the panel

**Database**: `workflow_projections` table
**Migration**: `supabase/migrations/create_workflow_projections.sql`

### Set Start Date/Time

**Location**: "Set Start" button on pending stages

**Features**:
- Changed from immediate start to date/time picker
- Modal opens with datetime-local input
- Pre-filled with current date/time
- Allows setting historical start times

**Implementation**: `setStartStep` state and modal

### Action Ledger

**Location**: Bottom of each workflow stage card

**Features**:
- Complete history of all actions (started, completed, approved, rejected, reopened)
- Shows who performed each action and when
- Displays action notes if provided
- Chronologically ordered (newest first)
- **Re-open functionality**: Rejected stages can be reopened via "Re-open" button
  - Resets stage to `pending` status
  - Clears rejection reason and approval info
  - Records 'reopened' action in ledger
  - Sends notifications to subscribed users

**Database**: `project_workflow_step_actions` table
**RLS**: Optimized with helper function `can_access_step_for_action()` to prevent timeout errors

---

## Calendar Updates

### Central Time Zone

**Feature**: All calendar dates and times display in Central Time (America/Chicago)

**Implementation**:
- Uses `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'`
- Automatically handles DST (CST/CDT)
- Converts UTC timestamps from database to Central Time before display

**Functions**:
- `getCentralDateFromUTC()` - Converts UTC to Central Time date string
- `getCentralDate()` - Gets current date in Central Time

### Two-Line Display

**Feature**: Each calendar item shows:
- **Top line**: Stage name (bold)
- **Bottom line**: Project name (smaller, gray)

**Visual**: Better organization and readability

---

## Access Control

### Assistant and Subcontractor Restrictions

**Dashboard**:
- Only shows stages assigned to the current user (by name match)
- Filters by `assigned_to_name` matching user's name

**Calendar**:
- Only shows stages assigned to the current user
- Filters by `assigned_to_name` matching user's name

**Workflow Page**:
- **Assistants**: Can see ALL stages in workflows they have access to (via master adoption)
- **Subcontractors**: Only shows stages assigned to them (by name match)
- Error message for subcontractors if no assigned stages: "You do not have access to this workflow..."
- Action buttons (Set Start, Complete, Re-open) visible if:
  - User is dev/master, OR
  - User is assigned to that specific stage
- Management buttons (Edit, Delete, Assign) only visible to owners/masters
- Notification settings:
  - "ASSIGNED" column hidden for assistants/subcontractors
  - "ME" column visible if user is assigned to the stage
  - Cross-step notifications only visible to owners/masters

### Current User in Person Assignment

**Feature**: "Add person to:" modal always shows the signed-in user first

**Implementation**:
- Current user appears at top with blue highlight
- Label: "(You)" after name
- Excluded from roster list below to prevent duplicates

---

## Email Templates

**Location**: Settings page → Email Templates section

**Features**:
- 11 template types:
  - User Management: `invitation`, `sign_in`, `login_as`
  - Workflow Notifications: 8 stage-related types
- Customizable subject and body
- Variable support (e.g., `{{name}}`, `{{email}}`, `{{link}}`)
- Test email functionality
- Integration with Resend email service

**Database**: `email_templates` table
**Edge Function**: `test-email` for sending test emails

**See**: `EMAIL_TEMPLATES_SETUP.md` and `EMAIL_TESTING.md` for complete documentation

---

## Financial Tracking

### Amount Formatting

**Feature**: All monetary amounts display with comma separators

**Examples**:
- `$1,234.56` instead of `$1234.56`
- `($1,234.56)` for negative amounts
- `$1,234,567.89` for large numbers

**Implementation**: `formatAmount()` function uses `toLocaleString('en-US')`

### Line Items

**Purpose**: Track actual expenses/credits per workflow stage

**Features**:
- Memo and amount fields
- Supports negative numbers
- Aggregated in Ledger inside the shared Projections/Ledger panel at top of workflow
- **Assistants**: Can view Ledger table and add/edit line items, but cannot see "Ledger Total" or "Total Left on Job"
- **Devs/Masters**: Can see all line items and financial totals
- Projections section remains dev/master-only
- Line items update immediately after adding/editing (no page refresh needed)

### Projections

**Purpose**: Track projected costs for entire workflow

**Features**:
- Stage name, memo, and amount
- Supports negative numbers
- Total calculation, shown alongside Ledger Total and "Total Left on Job: Projections - Ledger = ..."
- Visible only to owners and masters

**Note**: Projections are separate from Line Items - projections are workflow-level, line items are stage-level.

---

## Customer and Project Management

### Customer Delete Functionality

**Location**: Customer edit form (`CustomerForm.tsx`)

**Features**:
- **Delete button** appears below the form when editing a customer (not when creating)
- Only visible to **devs and masters**
- **Masters**: Can only delete customers they own (`master_user_id = auth.uid()`)
- **Devs**: Can delete any customer
- **Confirmation modal** requires typing the customer name to confirm deletion
- Navigates to customer list after successful deletion

**Database**: RLS policy in `supabase/migrations/add_customers_delete_rls.sql`
- Masters can delete their own customers
- Devs can delete any customer

### Projects Page Enhancements

**Location**: Projects list page (`Projects.tsx`)

**Features**:
- **Stage Summary**: Shows complete workflow stage sequence with color coding
  - Green (`#059669`) for completed/approved stages
  - Red (`#b91c1c`) for rejected stages
  - Orange (`#E87600`) and bold for in_progress stages
  - Gray (`#6b7280`) for pending stages
  - Displayed below project description, above plans link
- **Current Stage Display**: Shows current stage with progress indicator
  - Format: `Current stage: check subs work [3 / 5]`
  - Shows stage position (1-indexed) and total stages
  - **Position calculation**: Uses sorted step list position, not raw `sequence_order` (fixes display issues when sequence_order has gaps)
  - **Rejected stages stop progress**: If any stage is rejected, it's shown as the current stage (prevents progress past rejected stages)
- **Map Link**: Clickable map icon next to "Link to plans" (if project has address)
  - Opens Google Maps with project address
  - Same icon and styling as customer list
- **Empty State**: When filtering by customer with no projects, shows: `**[Customer Name]** has no projects yet. Add one.`
  - Customer name is bolded
  - "Add one" link includes customer parameter for pre-filling

### UI Improvements

**Customer List**:
- Removed redundant "Edit" link (clicking customer name goes to edit page)
- Clicking customer name navigates to edit form

**Projects List**:
- Removed redundant "Workflow" link (clicking project name goes to workflow page)
- Clicking project name navigates to workflow page
- Only "Edit" link remains in action area

---

## Database Migrations Required

Run these migrations in order:

1. **Private Notes**: `supabase/migrations/add_private_notes_to_workflow_steps.sql`
2. **Line Items**: `supabase/migrations/create_workflow_step_line_items.sql`
3. **Email Templates**: `supabase/migrations/create_email_templates.sql` (see `EMAIL_TEMPLATES_SETUP.md`)
4. **Projections**: `supabase/migrations/create_workflow_projections.sql`
5. **Customer Delete RLS**: `supabase/migrations/add_customers_delete_rls.sql`
6. **Projects RLS for Assistants**: `supabase/migrations/verify_projects_rls_for_assistants.sql` - Ensures assistants can see all projects from masters who adopted them
7. **Users RLS Fix**: `supabase/migrations/fix_users_rls_for_project_masters.sql` - Fixes 406 errors when assistants try to load master information (uses SECURITY DEFINER function to avoid recursion)
8. **Line Items RLS Optimization**: `supabase/migrations/optimize_workflow_step_line_items_rls.sql` - Optimizes RLS policies to prevent timeout errors when loading line items (uses helper function `can_access_project_via_step()`)
9. **Step Actions RLS Fix**: `supabase/migrations/fix_project_workflow_step_actions_rls.sql` - Fixes 403/500 errors when recording workflow actions (uses helper function `can_access_step_for_action()`)

---

## UI/UX Improvements

### Visual Hierarchy
- Private Notes panel (including line items): Light blue background (`#f0f9ff`) to distinguish from regular notes
- Projections & Ledger: Combined light blue financial panel (`#f0f9ff`) at top of workflow
- Inner Ledger table rows use neutral/gray backgrounds with red for negative amounts
- Collected projections: Green background highlight (future enhancement)

### Button Organization
- Action buttons grouped by function
- Management buttons (Edit, Delete, Assign) only for owners/masters
- Collected button in Projections uses green color scheme

### Error Messages
- Improved error parsing for Edge Functions
- Shows HTTP status codes and specific error messages
- Better user feedback for debugging

---

## Technical Details

### TypeScript Types
- Updated `src/types/database.ts` with all new table types
- Added type aliases: `LineItem`, `Projection`

### State Management
- Role-based state: `userRole`, `currentUserName`
- Feature-specific state: `lineItems`, `projections`, `editingLineItem`, `editingProjection`

### Functions
- `formatAmount()` - Currency formatting with commas
- `calculateLedgerTotal()` - Sum of all line items
- `calculateProjectionsTotal()` - Sum of all projections
- `getCentralDateFromUTC()` - Timezone conversion
- `loadLineItemsForSteps()` - Batch loading
- `loadProjections()` - Workflow-level projections

---

## Future Enhancements

### Email Integration
- Update `invite-user` Edge Function to use templates
- Update `login-as-user` Edge Function to use templates
- Implement workflow stage notification sending
- Connect email templates to actual notification triggers

### Financial Features
- Add "Collected" functionality to Projections (track payments received)
- Export financial reports

### Access Control
- Consider RLS policies for `private_notes` field
- Database-level filtering for assistants/subcontractors

---

## Migration Checklist

Before deploying, ensure all migrations are run:

- [ ] Private Notes field added to `project_workflow_steps`
- [ ] `workflow_step_line_items` table created
- [ ] `workflow_projections` table created
- [ ] `email_templates` table created
- [ ] Customer DELETE RLS policy configured (`add_customers_delete_rls.sql`)
- [ ] RLS policies configured for all new tables
- [ ] Edge Functions deployed (`test-email`)
- [ ] Resend API key configured as Supabase secret
- [ ] Domain verified in Resend dashboard

---

## Testing

### Manual Testing Checklist

1. **Private Notes**:
   - [ ] Owner can see and edit private notes
   - [ ] Master can see and edit private notes
   - [ ] Assistant cannot see private notes
   - [ ] Subcontractor cannot see private notes

2. **Line Items**:
   - [ ] Can add line items to stages
   - [ ] Can edit line items
   - [ ] Can delete line items
   - [ ] Negative amounts display correctly
   - [ ] Ledger shows all line items
   - [ ] Amounts have comma formatting

3. **Projections**:
   - [ ] Can add projections
   - [ ] Can edit projections
   - [ ] Can delete projections
   - [ ] Total calculates correctly
   - [ ] Amounts have comma formatting

4. **Set Start**:
   - [ ] Modal opens with date/time picker
   - [ ] Can set custom start time
   - [ ] Start time saves correctly

5. **Calendar**:
   - [ ] Dates display in Central Time
   - [ ] Two-line format (stage + project)
   - [ ] Only shows assigned stages for assistants/subcontractors

6. **Access Control**:
   - [ ] Assistants only see assigned stages
   - [ ] Subcontractors only see assigned stages
   - [ ] Current user appears first in person assignment modal

7. **Email Templates**:
   - [ ] Can create/edit templates
   - [ ] Test email function works
   - [ ] Variables replace correctly

---

## Known Issues

1. **RLS Policy for People Table**: Owners may not see all people entries due to RLS restrictions. Consider updating RLS policy to allow owners to see all entries.

2. **Email Template Integration**: Templates are stored but not yet used by Edge Functions. Need to update `invite-user` and `login-as-user` functions.

3. **Workflow Notifications**: Stage notifications are tracked but not yet sent. Need to implement email sending in workflow stage transitions.

---

## Workflow Step Assignment Enhancements

### Autocomplete with Add Person Feature

**Location**: "Add Step" modal → "Assigned to" field

**Features**:
- **Searchable autocomplete dropdown** showing all masters and subcontractors
- **Real-time filtering** as you type (case-insensitive)
- **Source indicators**: Shows "(user)" for signed-up users, "(not user)" for roster entries
- **Add new person**: If name entered doesn't match any existing person, shows "Add [name]" option
- **Add person modal**: Prompts to add name, email, phone, and notes (similar to Add Subcontractor flow)
- **Automatic selection**: After adding, automatically selects the newly added person
- **Duplicate prevention**: Checks for duplicate names (case-insensitive) before saving

**Implementation**: 
- Queries `users` table for roles `'master_technician'` and `'subcontractor'`
- Queries `people` table for kind `'master_technician'` and `'sub'`
- Combines and deduplicates by name
- New persons default to `kind: 'sub'` (subcontractor)

**See**: `src/pages/Workflow.tsx` - `StepFormModal` component

---

## Related Documentation

- `PRIVATE_NOTES_SETUP.md` - Detailed private notes and line items documentation
- `EMAIL_TEMPLATES_SETUP.md` - Email templates database setup
- `EMAIL_TESTING.md` - Email testing and integration status
- `PROJECT_DOCUMENTATION.md` - Overall project architecture and patterns
