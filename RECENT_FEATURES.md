# Recent Features and Updates

This document summarizes all recent features and improvements added to Pipetooling.

## Table of Contents
1. [Workflow Features](#workflow-features)
2. [Calendar Updates](#calendar-updates)
3. [Access Control](#access-control)
4. [Email Templates](#email-templates)
5. [Financial Tracking](#financial-tracking)

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

**Database**: `project_workflow_step_actions` table

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
- Only shows stages assigned to the user (for assistants/subcontractors)
- Error message if no assigned stages: "You do not have access to this workflow..."
- Action buttons (Set Start, Complete) only visible if:
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
- Visible to owners, masters, and assistants (assistants can add/edit line items on projects for masters who adopted them)
- Projections and financial totals remain dev/master-only

### Projections

**Purpose**: Track projected costs for entire workflow

**Features**:
- Stage name, memo, and amount
- Supports negative numbers
- Total calculation, shown alongside Ledger Total and "Total Left on Job: Projections - Ledger = ..."
- Visible only to owners and masters

**Note**: Projections are separate from Line Items - projections are workflow-level, line items are stage-level.

---

## Database Migrations Required

Run these migrations in order:

1. **Private Notes**: `supabase/migrations/add_private_notes_to_workflow_steps.sql`
2. **Line Items**: `supabase/migrations/create_workflow_step_line_items.sql`
3. **Email Templates**: `supabase/migrations/create_email_templates.sql` (see `EMAIL_TEMPLATES_SETUP.md`)
4. **Projections**: `supabase/migrations/create_workflow_projections.sql`

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

## Related Documentation

- `PRIVATE_NOTES_SETUP.md` - Detailed private notes and line items documentation
- `EMAIL_TEMPLATES_SETUP.md` - Email templates database setup
- `EMAIL_TESTING.md` - Email testing and integration status
- `PROJECT_DOCUMENTATION.md` - Overall project architecture and patterns
