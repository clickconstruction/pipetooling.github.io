# Private Notes, Line Items For Office, and Projections for Workflows

This document describes the private notes (labeled "Notes for Office" in the UI), line items (labeled "Line Items For Office"), and projections features added to workflows. Notes and line items are visible to devs, masters, assistant-like roles (assistant, controller), and superintendents; projections stay dev/master-only.

## Overview

### Private Notes and Line Items

Each workflow stage has a **Notes for Office** (private notes) section that is visible to devs, masters, assistant-like roles (assistant, controller), and superintendents — the `canSeePrivateNotesAndApprove` gate in `src/pages/Workflow.tsx` (`isAssistantLike` covers assistant + controller). This is separate from the regular "Notes" field, which is visible to all users.

Additionally, each stage includes a **Line Items For Office** section (visible to the same roles), allowing them to track expenses, credits, and other financial items with memo and amount fields. Line items can link to purchase orders or supply house invoices from Materials. All line items are automatically aggregated into a **Ledger** total in the financial summary bar at the top of the workflow page.

### Projections

At the workflow level (above the Ledger), there is a **Projections** section for tracking projected costs. Projections are separate from line items - they represent planned/estimated costs for the entire workflow, while line items track actual expenses per stage.

## Database Changes

### Schema (already in the baseline — no setup needed)

All of the schema below is included in the squashed baseline migration
`supabase/migrations/20250101000000_baseline.sql`; there is nothing to apply for a new
environment beyond the normal `supabase db push`. The original standalone SQL files are kept
for historical reference in `supabase/archive/` (`add_private_notes_to_workflow_steps.sql`,
`create_workflow_step_line_items.sql`, `create_workflow_projections.sql`).

> **Never apply DDL via the Dashboard SQL editor** — see the migration rule in
> [CLAUDE.md](../CLAUDE.md). Migrations go through `supabase db push` only.

#### 1. Private Notes Field

- `private_notes TEXT` column on the `project_workflow_steps` table
- A comment documenting the field's purpose

#### 2. Line Items Table

- `workflow_step_line_items` table with fields:
  - `id` (UUID, primary key)
  - `step_id` (UUID, foreign key to `project_workflow_steps` ON DELETE CASCADE)
  - `item_date` (DATE, optional) - User-entered calendar date for the line item
  - `link` (TEXT, optional) - URL for external references
  - `memo` (TEXT, required) - Description of the line item
  - `amount` (NUMERIC(10, 2), required) - **Supports negative numbers** for credits/refunds
  - `supply_house_invoice_id` (UUID, optional) - Link to a `supply_house_invoices` row
  - `sequence_order` (INTEGER) - Order within the step
  - `created_at`, `updated_at` (timestamps)
- Indexes for performance
- RLS policies restricting access to privileged roles

#### 3. Projections Table

- `workflow_projections` table with fields:
  - `id` (UUID, primary key)
  - `workflow_id` (UUID, foreign key to `project_workflows` ON DELETE CASCADE)
  - `stage_name` (TEXT, required) - Stage name for the projection
  - `memo` (TEXT, required) - Description
  - `amount` (NUMERIC(10, 2), required) - **Supports negative numbers**
  - `sequence_order` (INTEGER) - Order within the workflow
  - `created_at`, `updated_at` (timestamps)
- Indexes for performance
- RLS policies restricting access to owners and master_technicians

## UI Changes

### Workflow Page

In the Workflow page (`src/pages/Workflow.tsx`), each stage now displays:

1. **Regular Notes** (visible to all users)
   - Standard textarea for general notes
   - Visible to everyone

2. **Notes for Office** (private notes; visible to devs, masters, assistant-like roles, superintendents)
   - Collapsible section header labeled "Notes for Office (N words)" (word count of the current note)
   - Shown when `canSeePrivateNotesAndApprove` is true (dev, master_technician, assistant-like, superintendent)

3. **Line Items For Office** (same visibility as Notes for Office)
   - Located below the private notes textarea
   - "+ Add Line Item" button to create new items
   - "Add PO" and "Add Supply House Invoice" buttons to link purchase orders or supply house invoices from Materials
   - Each line item displays:
     - **Date** (optional): User-entered calendar date (`item_date`)
     - **Link** (optional): URL for external references
     - **Memo**: Description of the item
     - **Amount**: Monetary value (supports negative numbers)
   - Edit and Delete buttons for each item
   - Modal form for adding/editing line items
   - Negative amounts are displayed in red with parentheses: `($50.00)`
   - Positive amounts display normally: `$50.00`

4. **Projections + Ledger summary bar** (top of workflow page)
   - One unified collapsible panel: a summary bar plus a combined Projections + Ledger table
   - Summary bar shows `Projections: $…`, `Ledger: $…`, and `Left: $…` (Projections minus Ledger)
   - **Visibility split**: the Ledger total is visible to all `canManageStages` roles (dev, master, assistant-like, superintendent); the Projections total and the `Left:` figure are dev/master-only
   - "+ Add Projection" button (dev/master-only)
   - Expanded table lists projections and ledger line items with Edit/Delete actions
   - Amounts formatted with commas (e.g., `$1,234.56`); negatives in red with parentheses; supports negative numbers

5. **Action Ledger** (at bottom of each stage card)
   - Complete history of all actions performed on the stage
   - Shows action type, performer, timestamp, and optional notes
   - Chronologically ordered (newest first)
   - Visible to all users who can see the stage

### Role Detection

The component now:
- Loads the current user's role on mount
- Stores it in `userRole` state
- Conditionally renders the private notes section based on role

## Functions Added

### Private Notes Functions

#### `updatePrivateNotes(step: Step, privateNotes: string)`
- Updates the `private_notes` field for a workflow step
- Goes through the `update_step_private_notes` RPC, with a direct-table-update fallback if the RPC is not found in the schema cache
- Called when the private notes textarea loses focus (onBlur)
- Automatically refreshes the steps list after update

### Line Items Functions

#### `loadLineItemsForSteps(stepIds: string[])`
- Loads all line items for the given step IDs
- Only executes for roles that can see private notes (dev, master, assistant-like, superintendent)
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
- Formats amounts for display with comma separators
- Negative numbers: `($1,234.56)` in parentheses
- Positive numbers: `$1,234.56` with dollar sign and commas
- Always shows 2 decimal places
- Uses `toLocaleString('en-US')` for formatting

### Projections Functions

#### `loadProjections(workflowId: string)`
- Loads all projections for the given workflow ID
- Only executes if user is dev or master_technician
- Orders by sequence_order

#### `saveProjection(item: Projection | null, stageName: string, memo: string, amount: string)`
- Creates a new projection or updates an existing one
- Validates stage name and memo are not empty
- Parses amount as float (supports negative numbers)
- Automatically sets sequence_order for new items
- Refreshes projections after save

#### `deleteProjection(itemId: string)`
- Deletes a projection by ID
- Refreshes projections after deletion

#### `openEditProjection(item: Projection | null)`
- Opens the edit modal for a projection
- If `item` is null, opens in "add" mode
- If `item` is provided, opens in "edit" mode with pre-filled values

#### `calculateProjectionsTotal(): number`
- Calculates the sum of all projections for the workflow
- Returns a number (can be negative)
- Used to display the total in the projections section

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

### Projections
- New table type: `workflow_projections`
- `Row` type includes: `id`, `workflow_id`, `stage_name`, `memo`, `amount`, `sequence_order`, `created_at`, `updated_at`
- `Insert` and `Update` types with appropriate optional fields
- `Projection` type alias defined in `Workflow.tsx`

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
-- for non-dev/master users, but this would require a view or function
```

Currently, the security is enforced at the UI level. For production, consider:
- Adding a database view that excludes `private_notes` for non-privileged users
- Or using a function that conditionally returns `private_notes` based on user role

## Usage

### Private Notes

1. **As dev, master, assistant, controller, or superintendent**:
   - Navigate to any workflow
   - Scroll to any stage
   - You'll see both the "Notes" and the "Notes for Office" sections
   - Type in the Notes for Office field and click away (blur) to save

2. **As Subcontractor (or other non-privileged roles)**:
   - Navigate to any workflow
   - Scroll to any stage
   - You'll only see the regular "Notes" section
   - The Notes for Office section is hidden

### Line Items

1. **Adding a Line Item**:
   - As a privileged role, scroll to any stage's Line Items For Office section
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
   - At the top of the workflow page, the Projections + Ledger summary bar shows the `Ledger:` total (all `canManageStages` roles); expanding the panel shows all line items from all stages in a table
   - Negative amounts shown in red with parentheses: `($50.00)`
   - Positive amounts shown normally: `$50.00`
   - Amounts formatted with commas: `$1,234.56`

### Projections

1. **Adding a Projection**:
   - As dev or master, scroll to the top of the workflow page
   - Click "+ Add Projection" button in the Projections + Ledger summary bar
   - Enter stage name - required
   - Enter memo (description) - required
   - Enter amount - required (supports negative numbers)
   - Click "Save"

2. **Editing a Projection**:
   - Click "Edit" button next to any projection
   - Modify the stage name, memo, or amount
   - Click "Save"

3. **Deleting a Projection**:
   - Click "Delete" button next to any projection
   - Projection is immediately removed

4. **Viewing Projections** (dev/master-only):
   - The summary bar shows `Projections: $…` and `Left: $…` (Projections minus Ledger)
   - Expanding the panel shows all projections in a table format
   - Amounts formatted with commas: `$1,234.56`

### Negative Numbers

- **Purpose**: Negative amounts are useful for:
  - Credits/refunds
  - Discounts
  - Adjustments
  - Returns

- **Display Format**:
  - Negative: `($1,234.56)` - shown in red with commas
  - Positive: `$1,234.56` - shown in black/dark gray with commas

- **Input**: 
  - Simply enter a negative number in the amount field (e.g., `-50.00`)
  - No restrictions - any numeric value is accepted
  - Commas are automatically added on display (not required in input)

## Visual Design

Styling uses the app's theme CSS variables (see `src/index.css` and the theme-token rule in
[CLAUDE.md](../CLAUDE.md)), so all of these surfaces adapt to light/dark mode. In brief:

- **Notes for Office**: collapsible header with word count; styled like the regular Notes section.
- **Line Items**: negative amounts render in red with parentheses; positive amounts in the standard text color.
- **Projections + Ledger summary bar**: light blue tinted panel; totals turn red when negative; the `Left:` figure is green when non-negative, red when negative.
- **Action Ledger**: muted panel at the bottom of each stage card; chronological list of actions (action type, performer, timestamp, optional notes).
