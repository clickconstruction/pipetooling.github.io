# Private Notes and Line Items for Workflow Stages

This document describes the private notes and line items features added to workflow stages, visible only to owners and master technicians.

## Overview

Each workflow stage now has a **Private Notes** section that is only visible to users with `owner` or `master_technician` roles. This is separate from the regular "Notes" field which is visible to all users.

Additionally, each stage includes a **Line Items** section within the private notes area, allowing owners and masters to track expenses, credits, and other financial items with memo and amount fields. All line items are automatically aggregated into a **Ledger** displayed at the top of the workflow page.

## Database Changes

### Migrations Required

Two SQL migrations are needed:

#### 1. Private Notes Field

**File**: `supabase/migrations/add_private_notes_to_workflow_steps.sql`

**To apply**:
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste the contents of the migration file
4. Click "Run"

The migration adds:
- `private_notes TEXT` column to `project_workflow_steps` table
- A comment documenting the field's purpose

#### 2. Line Items Table

**File**: `supabase/migrations/create_workflow_step_line_items.sql`

**To apply**:
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste the contents of the migration file
4. Click "Run"

The migration creates:
- `workflow_step_line_items` table with fields:
  - `id` (UUID, primary key)
  - `step_id` (UUID, foreign key to `project_workflow_steps`)
  - `memo` (TEXT, required) - Description of the line item
  - `amount` (NUMERIC(10, 2), required) - **Supports negative numbers** for credits/refunds
  - `sequence_order` (INTEGER) - Order within the step
  - `created_at`, `updated_at` (timestamps)
- Indexes for performance
- RLS policies restricting access to owners and master_technicians only

## UI Changes

### Workflow Page

In the Workflow page (`src/pages/Workflow.tsx`), each stage now displays:

1. **Regular Notes** (visible to all users)
   - Standard textarea for general notes
   - Visible to everyone

2. **Private Notes** (visible only to owners and masters)
   - Highlighted with a yellow/amber background (`#fef3c7`)
   - Border color: `#fbbf24`
   - Label: "Private Notes (Your account only)"
   - Only shown when `userRole === 'owner' || userRole === 'master_technician'`

3. **Line Items** (within Private Notes section)
   - Located below the private notes textarea
   - "+ Add Line Item" button to create new items
   - Each line item displays:
     - **Memo**: Description of the item
     - **Amount**: Monetary value (supports negative numbers)
   - Edit and Delete buttons for each item
   - Modal form for adding/editing line items
   - Negative amounts are displayed in red with parentheses: `($50.00)`
   - Positive amounts display normally: `$50.00`

4. **Ledger** (at top of workflow page)
   - Only visible to owners and masters
   - Displays all line items from all stages in a table format
   - Columns: Stage, Memo, Amount
   - Shows total sum at the bottom
   - Negative amounts displayed in red with parentheses
   - Total turns red if negative
   - Empty state message when no line items exist

### Role Detection

The component now:
- Loads the current user's role on mount
- Stores it in `userRole` state
- Conditionally renders the private notes section based on role

## Functions Added

### Private Notes Functions

#### `updatePrivateNotes(step: Step, privateNotes: string)`
- Updates the `private_notes` field for a workflow step
- Called when the private notes textarea loses focus (onBlur)
- Automatically refreshes the steps list after update

### Line Items Functions

#### `loadLineItemsForSteps(stepIds: string[])`
- Loads all line items for the given step IDs
- Only executes if user is owner or master_technician
- Groups items by step_id in state

#### `saveLineItem(stepId: string, item: LineItem | null, memo: string, amount: string)`
- Creates a new line item or updates an existing one
- Validates memo is not empty
- Parses amount as float (supports negative numbers)
- Automatically sets sequence_order for new items
- Refreshes steps after save

#### `deleteLineItem(itemId: string)`
- Deletes a line item by ID
- Refreshes steps after deletion

#### `openEditLineItem(stepId: string, item: LineItem | null)`
- Opens the edit modal for a line item
- If `item` is null, opens in "add" mode
- If `item` is provided, opens in "edit" mode with pre-filled values

#### `calculateLedgerTotal(): number`
- Calculates the sum of all line items across all stages
- Returns a number (can be negative)
- Used to display the total in the ledger

#### `formatAmount(amount: number | null | undefined): string`
- Formats amounts for display
- Negative numbers: `($123.45)` in parentheses
- Positive numbers: `$123.45` with dollar sign
- Always shows 2 decimal places

## TypeScript Types

Updated `src/types/database.ts` to include:

### Private Notes
- `private_notes: string | null` in the `Row` type
- `private_notes?: string | null` in both `Insert` and `Update` types

### Line Items
- New table type: `workflow_step_line_items`
- `Row` type includes: `id`, `step_id`, `memo`, `amount`, `sequence_order`, `created_at`, `updated_at`
- `Insert` and `Update` types with appropriate optional fields
- `LineItem` type alias defined in `Workflow.tsx`

## Security Considerations

**Important**: This feature relies on:
1. **Frontend role checking** - The UI only shows private notes to owners/masters
2. **RLS policies** - Database policies should restrict access to `private_notes` field

### Recommended RLS Policy

You may want to add an RLS policy to ensure only owners and masters can read/write `private_notes`:

```sql
-- Policy: Only owners and master_technicians can read private_notes
-- Note: This is handled at the application level currently
-- For additional security, you could add a policy that filters out private_notes
-- for non-owner/master users, but this would require a view or function
```

Currently, the security is enforced at the UI level. For production, consider:
- Adding a database view that excludes `private_notes` for non-privileged users
- Or using a function that conditionally returns `private_notes` based on user role

## Usage

### Private Notes

1. **As Owner or Master Technician**:
   - Navigate to any workflow
   - Scroll to any stage
   - You'll see both "Notes" and "Private Notes" sections
   - Private Notes has a yellow/amber background to distinguish it
   - Type in the private notes field and click away (blur) to save

2. **As Assistant or Subcontractor**:
   - Navigate to any workflow
   - Scroll to any stage
   - You'll only see the regular "Notes" section
   - Private Notes section is hidden

### Line Items

1. **Adding a Line Item**:
   - As owner or master, scroll to any stage's Private Notes section
   - Click "+ Add Line Item" button
   - Enter a memo (description) - required
   - Enter an amount - required (supports negative numbers for credits/refunds)
   - Click "Save"

2. **Editing a Line Item**:
   - Click "Edit" button next to any line item
   - Modify the memo or amount
   - Click "Save"

3. **Deleting a Line Item**:
   - Click "Delete" button next to any line item
   - Item is immediately removed

4. **Viewing the Ledger**:
   - At the top of the workflow page, owners and masters see a "Ledger" section
   - Shows all line items from all stages in a table
   - Displays total at the bottom
   - Negative amounts shown in red with parentheses: `($50.00)`
   - Positive amounts shown normally: `$50.00`

### Negative Numbers

- **Purpose**: Negative amounts are useful for:
  - Credits/refunds
  - Discounts
  - Adjustments
  - Returns

- **Display Format**:
  - Negative: `($123.45)` - shown in red
  - Positive: `$123.45` - shown in black/dark gray

- **Input**: 
  - Simply enter a negative number in the amount field (e.g., `-50.00`)
  - No restrictions - any numeric value is accepted

## Visual Design

### Private Notes Section
- **Background**: Light yellow/amber (`#fef3c7`)
- **Border**: Amber (`#fbbf24`)
- **Text Color**: Dark brown (`#92400e`) for the label
- **Textarea**: White background with amber border
- **Purpose**: Visually distinct from regular notes to indicate privileged access

### Line Items
- **Background**: White cards within the private notes section
- **Border**: Amber (`#fbbf24`) to match private notes theme
- **Positive Amounts**: Black/dark gray (`#111827` or `#6b7280`)
- **Negative Amounts**: Red (`#b91c1c`) with parentheses formatting
- **Buttons**: 
  - Add: Amber background (`#fbbf24`)
  - Edit: Light gray background (`#f3f4f6`)
  - Delete: Light red background (`#fee2e2`)

### Ledger
- **Background**: Light gray (`#f9fafb`)
- **Border**: Gray (`#e5e7eb`)
- **Table**: Clean table layout with stage, memo, and amount columns
- **Total**: Bold, large font
  - Positive: Black (`#111827`)
  - Negative: Red (`#b91c1c`)
- **Separator**: Dark border (`#111827`) above total
