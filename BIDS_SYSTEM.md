# Bids System Documentation

---
file: BIDS_SYSTEM.md
type: System Documentation
purpose: Complete documentation of 6-tab Bids system including workflows, book systems, and integrations
audience: Developers, Estimators, AI Agents
last_updated: 2026-02-10
estimated_read_time: 30-40 minutes
difficulty: Intermediate to Advanced

system_components:
  - "6 Tabs: Bid Board, Counts, Takeoff, Cost Estimate, Pricing, Cover Letter, Submission"
  - "3 Book Systems: Takeoff Book, Labor Book, Price Book"
  - "Integration with Materials (PO creation)"

key_sections:
  - name: "Overview"
    line: ~17
    anchor: "#overview"
    description: "System purpose and workflow summary"
  - name: "Bid Board Tab"
    line: ~35
    anchor: "#bid-board-tab"
    description: "Main bid list, search, and management"
  - name: "Counts Tab"
    line: ~97
    anchor: "#counts-tab"
    description: "Fixture quantity entry with number pad"
  - name: "Takeoff Tab"
    line: ~184
    anchor: "#takeoff-tab"
    description: "Map counts to templates, create POs"
  - name: "Cost Estimate Tab"
    line: ~333
    anchor: "#cost-estimate-tab"
    description: "Materials + labor + driving costs"
  - name: "Pricing Tab"
    line: ~503
    anchor: "#pricing-tab"
    description: "Compare costs to price book, margins"
  - name: "Cover Letter Tab"
    line: ~681
    anchor: "#cover-letter-tab"
    description: "Generate proposal documents"
  - name: "Submission & Followup Tab"
    line: ~732
    anchor: "#submission--followup-tab"
    description: "Track bid outcomes and follow-ups"
  - name: "Database Schema"
    line: ~897
    anchor: "#database-schema"
    description: "All bids-related tables"

quick_navigation:
  - "[6-Tab Workflow](#overview) - Tab sequence and purpose"
  - "[Book Systems](#takeoff-tab) - Template libraries"
  - "[Database Tables](#database-schema) - Schema reference"
  - "[Materials Integration](#integration-with-materials) - PO creation"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Database schema details"
  - "[ACCESS_CONTROL.md](./ACCESS_CONTROL.md) - Estimator role access"
  - "[GLOSSARY.md](./GLOSSARY.md) - Bids terminology"

prerequisites:
  - Understanding of plumbing estimation process
  - Familiarity with stages: Rough In, Top Out, Trim Set
  - Basic understanding of materials and labor costing

when_to_read:
  - Working on bids features
  - Understanding bid workflow
  - Implementing book systems
  - Debugging bids issues
---

## Table of Contents
1. [Overview](#overview)
2. [Bid Board Tab](#bid-board-tab)
3. [Counts Tab](#counts-tab)
4. [Takeoff Tab](#takeoff-tab)
5. [Cost Estimate Tab](#cost-estimate-tab)
6. [Pricing Tab](#pricing-tab)
7. [Cover Letter Tab](#cover-letter-tab)
8. [Submission & Followup Tab](#submission--followup-tab)
9. [Database Schema](#database-schema)
10. [Integration with Materials](#integration-with-materials)

---

## Overview

The Bids system is a comprehensive bidding and estimation tool for plumbing contractors. It provides a complete workflow from initial fixture counts through pricing, cost estimation, and bid submission tracking.

### Key Features
- **Six integrated tabs** covering the complete bid lifecycle
- **Three book systems** (Takeoff, Labor, Price) for standardizing estimates
- **Automatic cost calculations** including driving costs
- **Margin analysis** comparing costs to revenue
- **Submission tracking** with follow-up management

### Workflow
1. **Bid Board** - Create and manage bids
2. **Counts** - Enter fixture/tie-in counts per stage
3. **Takeoff** - Map counts to material templates
4. **Cost Estimate** - Calculate material and labor costs with driving expenses
5. **Pricing** - Compare costs to price book and analyze margins
6. **Cover Letter** - Generate proposal documents with inclusions/exclusions
7. **Submission & Followup** - Track bid submissions and outcomes

---

## Bid Board Tab

### Purpose
Central hub for viewing and managing all bids. Provides high-level overview of bid status, values, and outcomes.

### Features

#### Service Type Filtering
- **Filter buttons** appear above all tabs (Bid Board, Counts, Takeoffs, etc.)
- **Displays** all available service types (Plumbing, Electrical, HVAC, etc.)
- **Active filter** highlighted with background color matching service type color
- **Filters all tabs**: When a service type is selected, all bid-related tabs show only bids of that type
- **Required field**: All bids must have a service type assigned
- **Management**: Devs can add/edit/reorder service types in Settings

#### Search Functionality
- **Full-width search input** filters bids in real-time
- **Searches across**:
  - Project name
  - Project address
  - Customer name (GC/Builder)
- **Case-insensitive** matching
- **Empty state** reflects active search query

#### Hide/Show Lost Bids Toggle
- **Win/Loss column header** is clickable button
- Toggles between showing all bids and hiding lost bids
- When hiding lost bids:
  - Label shows "(hiding lost)" with underline
  - Lost bids removed from table
  - Useful for focusing on active opportunities

#### Table Columns

Column order (left to right):
1. **Project Name** - Bid identifier
2. **Address** - Project location
3. **Win/Loss** - Bid outcome (unsent, won, lost, started_or_complete)
4. **Bid Value** - Total bid amount
5. **Estimator** - Assigned estimator
6. **Bid Date** - Bid due date
7. **GC/Builder** - Customer name
8. **Edit** - Gear icon button (header hidden, only icon visible)

**Note**: Removed columns from earlier versions:
- Agreed Value (removed)
- Maximum Profit (removed)

#### Edit and Delete Workflows

**Edit Bid Modal**:
- Opened by clicking gear icon in Edit column
- **Cancel button** in top-right next to modal title
- **Field order**:
  1. Project Name* (required, first field)
  2. Project Address (renamed from "Address")
  3. Project Folder
  4. Job Plans
  5. GC/Builder (customer selector)
  6. Project Contact Name
  7. Project Contact Phone
  8. Project Contact Email
  9. Estimator
  10. Bid Due Date
  11. Distance to Office
  12. Outcome (Won, Lost, Started or Complete, etc.)
  13. Loss Reason (when outcome is "Lost")
  14. Estimated Job Start Date (when outcome is "Won")

**Delete Bid Confirmation**:
- **"Delete bid" button** in Edit Bid modal opens separate confirmation modal
- **Confirmation requirement**: User must type project name to enable Delete button
- If project name is empty, can leave input empty to confirm
- **Cancel** closes only the delete modal (returns to Edit modal)
- **Delete** removes bid and closes both modals on success

#### New Bid Modal

**Features**:
- Project Name is required field (marked with *)
- Client-side validation prevents save when empty
- Error message: "Project Name is required."
- **"Save and start Counts" button** (bottom left):
  - Saves the bid
  - Switches to Counts tab
  - Preselects the new bid for counting

---

## Counts Tab

### Purpose
Enter fixture and tie-in counts for each bid. Counts form the foundation for material takeoffs and labor estimates.

### Layout

**Selected Bid Panel** (at top):
- Shows currently selected bid details
- **Edit Bid button** in header (next to Close) opens Edit Bid modal

**Search Box**:
- Positioned **below** selected-bid panel, **above** bids list table
- **Full width** (`boxSizing: 'border-box'`)
- Filters bids by Project Name

**Bids List Table**:
- Column header: "Project Name" (changed from "Project / GC")
- Click bid row to select and load counts

### Count Entry Interface

#### Table Headers
- **Fixture*** - Fixture or tie-in name (required)
- **Count*** - Quantity (required)
- **Plan Page** - Optional reference to plan sheet
- **Actions** - Edit/Delete buttons

All headers are centered.

#### Fixture Quick-Select Buttons

**Purpose**: Speed up data entry by populating common fixture names

**Button Groups**:
- Bathrooms (toilets, sinks, showers, tubs)
- Kitchen (sinks, dishwashers, disposals)
- Laundry (washers, utility sinks)
- Plumbing Fixtures (various common fixtures)
- Appliances (water heaters, etc.)

**Behavior**:
- Clicking button populates Fixture input field
- Allows manual editing after population
- Positioned below Fixture input in add-row form

#### Number Pad

**Layout**:
```
1  2  3
4  5  6
7  8  9
C  0  Del
```

**Functions**:
- **Digits 0-9**: Append to Count field
- **C (Clear)**: Clear entire Count field
- **Delete (Del)**: Backspace (remove last digit)

**Styling**: Centered grid below Count input

#### Combined Input Layout

The add-row form uses `colSpan={3}` to merge cells:
- **One cell** contains: Fixture input, Count input, Plan Page input
- **Arranged horizontally** in single row
- Allows compact, efficient data entry

#### Save Buttons

**Save** (renamed from "Add"):
- Saves the count row
- Closes the add-row form
- Refreshes count list
- Blue button styling

**Save and Add**:
- Saves the count row
- **Clears form fields**
- **Keeps form open** for next entry
- Refreshes count list
- Ideal for entering multiple counts quickly
- Blue button styling (matches "Add row")

#### Required Fields

Both Fixture and Count show:
- Asterisk in label (Fixture*, Count*)
- Placeholder text with asterisk
- Client-side validation on save

---

## Takeoff Tab

### Purpose
Map fixture counts to material templates, creating purchase orders for the bid. Supports multiple templates per fixture and staged material breakdowns.

### Takeoff Book System

The Takeoff Book provides standardized mappings from fixture names to material templates and stages.

#### Takeoff Book Versions

**Management**:
- Create, edit, and delete named versions
- Each version has independent set of entries
- Select version from dropdown per bid
- **Default version selection**: If bid has no version selected, automatically selects version named "Default"

**Bid-level persistence**:
- Selected version stored in `bids.selected_takeoff_book_version_id`
- Restores selection when reopening Takeoff tab

#### Takeoff Book Entries

**Structure**:
- **Fixture or Tie-in** - Primary name (e.g., "Toilet", "Sink")
- **Additional names (aliases)** - Comma-separated alternative names (e.g., "Water Closet, WC")
- **Multiple (Template, Stage) pairs** - One entry can have multiple template/stage combinations

**Alias Matching**:
- Case-insensitive matching
- Count row matches if its "Fixture or Tie-in" equals entry's primary name OR any alias
- First match wins (entries processed in sequence order)

**Example**:
```
Entry: "Toilet"
Aliases: "Water Closet, WC, Commode"
Items:
  - Template: "Standard Toilet", Stage: "Rough In"
  - Template: "Standard Toilet", Stage: "Top Out"
  - Template: "Standard Toilet", Stage: "Trim Set"
```

When applying this entry to a count row with Fixture="WC" and Count=5:
- Creates 3 takeoff mappings (one per item)
- Each mapping: Template="Standard Toilet", Quantity=5, Stage varies

#### Entry Management UI

**Entry Form** (for adding/editing):
- Fixture or Tie-in (text input)
- Additional names (textarea, comma-separated)
- **Multiple Template/Stage Rows**:
  - Add/Remove buttons for rows
  - Template dropdown
  - Stage dropdown (Rough In, Top Out, Trim Set)
  - Each row stored separately in `takeoff_book_entry_items` table

**Apply Takeoff Book Button**:
- Applies selected book version to current bid
- Creates mappings for matching count rows
- Displays success message with count of mappings created

### Takeoff Mappings Table

**Columns**:
- **Fixture** - From count row
- **Count** - Quantity
- **Template** - Material template dropdown (searchable)
- **Quantity** - Number of this template per fixture (default 1)
- **Stage** - Rough In, Top Out, or Trim Set
- **Actions** - Add Template, Remove

**Features**:
- **Multiple templates per fixture**: Click "Add template" to add another row for same fixture
- Each mapping has unique ID
- Remove unwanted mappings individually

### Template Search/Filter

**Location**: Centered above mappings table

**Features**:
- **360px width** input field
- Placeholder: "only show templates with these words"
- Filters template dropdown options in real-time
- Always includes currently selected templates (even if filtered out)
- Case-insensitive search across template names

### Purchase Order Creation

#### Create Purchase Order

**Button**: "Create purchase order"

**Process**:
1. Validates at least one mapping exists
2. Creates new draft PO with name "Takeoff PO for [Bid Name]"
3. For each mapping:
   - Expands template recursively (handles nested templates)
   - Adds parts to PO with:
     - `from_template` tag
     - Stage information
     - Calculated quantities (Count × Template Quantity × Part Quantity)
4. Opens Materials page with new PO

**Utility**: Uses `expandTemplate()` from `materialPOUtils.ts`

#### Add to Selected PO

**Button**: "Add to selected PO"

**Requirements**:
- Draft PO must be selected from dropdown
- Cannot add to finalized POs

**Process**:
1. Validates draft PO selected
2. Expands all template mappings
3. Adds parts to existing PO (appends to current items)
4. Shows success message

#### View Purchase Order Link

After creating or adding to PO:
- **"View purchase order" link** appears
- Navigates to `/materials` with `state.openPOId`
- Materials page:
  - Opens Purchase Orders tab
  - Displays specified PO
  - Clears `location.state` to avoid re-opening on refresh

### Database Tables

**`takeoff_book_versions`**:
```sql
id (uuid, PK)
name (text, unique)
created_at (timestamptz)
```

**`takeoff_book_entries`**:
```sql
id (uuid, PK)
version_id (uuid, FK → takeoff_book_versions ON DELETE CASCADE)
fixture_name (text)
alias_names (text[], nullable) -- Array of alternative names
sequence_order (integer)
created_at (timestamptz)
UNIQUE (version_id, fixture_name)
```

**`takeoff_book_entry_items`**:
```sql
id (uuid, PK)
entry_id (uuid, FK → takeoff_book_entries ON DELETE CASCADE)
template_id (uuid, FK → material_templates ON DELETE CASCADE)
stage (text) -- 'Rough In', 'Top Out', 'Trim Set'
created_at (timestamptz)
```

**RLS**: dev, master_technician, assistant, estimator have full CRUD access

---

## Cost Estimate Tab

### Purpose
Calculate total project costs including materials, labor, and driving expenses. Provides detailed breakdown by stage and fixture.

### Material Costs

**Display**:
- **Rough In Materials**: Total cost for Rough In stage
- **Top Out Materials**: Total cost for Top Out stage  
- **Trim Set Materials**: Total cost for Trim Set stage
- **Total Materials**: Sum of all three stages

**Source**: Linked purchase orders created from Takeoff tab

**Format**: Currency with comma formatting (e.g., $12,345.67)

### Labor Costs

#### Labor Book System

The Labor Book provides standardized labor hours for common fixtures across the three plumbing stages.

**Versions Management**:
- Create, edit, and delete named labor book versions
- Each version has independent set of entries
- **Auto-selection**: First labor book version automatically selected when opening Cost Estimate tab
- Preserves previously saved selection for the bid

**Bid-level persistence**:
- Selected version stored in `bids.selected_labor_book_version_id`
- Version dropdown in Cost Estimate tab header

**Labor Book Entries**:
- **Fixture name** - Primary name (e.g., "Toilet", "Sink")
- **Additional names (aliases)** - Comma-separated alternatives
- **Hours per stage**:
  - `rough_in_hrs` - Rough In labor hours
  - `top_out_hrs` - Top Out labor hours
  - `trim_set_hrs` - Trim Set labor hours
- **Sequence order** - Display order in management UI

**Alias Matching**:
- Case-insensitive match against fixture name and all aliases
- First match wins (by entry order)

**Database Tables**:

`labor_book_versions`:
```sql
id (uuid, PK)
name (text)
created_at (timestamptz)
```

`labor_book_entries`:
```sql
id (uuid, PK)
version_id (uuid, FK → labor_book_versions ON DELETE CASCADE)
fixture_name (text)
alias_names (text[], nullable)
rough_in_hrs (numeric(10,2))
top_out_hrs (numeric(10,2))
trim_set_hrs (numeric(10,2))
sequence_order (integer)
created_at (timestamptz)
UNIQUE (version_id, fixture_name)
```

#### Labor Hours Table

**Structure**: Matrix of fixtures (rows) × stages (columns)

**Columns**:
- **Fixture** - From Counts tab
- **Rough In** - Labor hours (editable)
- **Top Out** - Labor hours (editable)
- **Trim Set** - Labor hours (editable)

**Total Row**: Shows sum of hours per stage

**Labor Rate**: Single editable field ($/hour), applies to all hours

**Sync with Counts**:
- When count rows are added/removed, labor table automatically updates
- **New labor rows** get hours from:
  1. Selected labor book (if fixture matches)
  2. `fixture_labor_defaults` table (system defaults)
  3. Zero (if no match found)

#### Apply Labor Book Hours

**Button**: "Apply matching Labor Hours"

**Location**: Top-right header, next to Print button

**Behavior**:
- One-click operation (no confirmation)
- Updates fixtures that match labor book entries
- **Smart matching**:
  - Only updates fixtures found in selected labor book
  - Non-matching fixtures remain unchanged (preserves manual edits)
- Shows success message inline next to button for 3 seconds

**Auto-selection**:
- First labor book version selected when opening Cost Estimate tab
- Button immediately clickable without manual selection
- Preserves previously saved labor book selection for bid

**Fallback Logic for New Fixtures**:
When syncing cost estimate labor rows from count rows:
1. Uses hours from selected labor book if fixture matches
2. Falls back to `fixture_labor_defaults` table (e.g., Toilet: 1/1/1 hrs)
3. Defaults to 0 only if fixture not found in either source

**Benefits**:
- Faster workflow - one-click application
- Consistent UX - matches Takeoff "Apply matching Fixture Templates" pattern
- Safer - preserves non-matching fixture hours
- More discoverable - prominent header placement

### Driving Cost Calculation

**Purpose**: Automatically calculate travel/driving costs based on job parameters

**Formula**:
```
Driving Cost = (Total Man Hours / Hours Per Trip) × Rate Per Mile × Distance to Office
```

**Example**:
```
40 hours / 2 hrs/trip × $0.70/mi × 50 miles = $700.00
```

**Parameters** (editable per estimate):
- **Rate per mile**: Default $0.70, persists in `cost_estimates.driving_cost_rate`
- **Hours per trip**: Default 2.0 hours, persists in `cost_estimates.hours_per_trip`

**Distance Source**:
- Reads from `bids.distance_to_office` field
- "Edit Bid" button for quick distance updates
- Shows "Distance to office: Not set" if no distance configured

**UI Display**:
- **Yellow-highlighted section** "Driving Cost Parameters" after labor table
- Shows:
  - Current distance to office
  - Editable rate per mile input
  - Editable hours per trip input
  - Calculation breakdown: "X trips × $Y/mi × Z mi = $Total"

**Integration**:
- Driving cost appears as separate line in Summary
- Included in "Labor total" (Labor + Driving)
- Incorporated into Grand total
- Shows $0.00 if distance not set (always visible)

**PDF Export**:
- Includes in Cost Estimate PDF
- Shows breakdown: "Driving cost: 20.0 trips × $0.70/mi × 50mi = $700.00"
- Appears in summary with Labor and Materials totals

**Database**:
```sql
cost_estimates.driving_cost_rate (numeric(10,2), default 0.70)
cost_estimates.hours_per_trip (numeric(10,2), default 2.0)
```

Migration: `add_cost_estimate_driving_cost_fields.sql`

### Summary Section

**Display**:
- **Total materials**: Sum from all stages
- **Labor**: Hours × Rate (excluding driving)
- **Driving**: Calculated driving cost
- **Labor total**: Labor + Driving
- **Grand total**: Materials + Labor total

**Format**: All amounts with comma formatting for values over $999

### Save and Print

**Save**: Persists cost estimate to database

**Print**: Opens print-friendly PDF view with all calculations and breakdowns

---

## Pricing Tab

### Purpose
Compare estimated costs to price book revenue and analyze profit margins. Helps ensure bids are profitable.

### Price Book System

The Price Book provides standardized pricing for fixtures across plumbing stages.

#### Price Book Versions

**Management**:
- Create, edit, and delete named price book versions
- Each version has independent pricing structure
- Select version from dropdown per bid

**Bid-level persistence**:
- Selected version stored in `bids.selected_price_book_version_id`
- Restores selection when reopening Pricing tab

#### Price Book Entries

**Structure**:
- **Fixture name** - Primary name (must be unique per version)
- **Prices per stage**:
  - `rough_in_price` - Rough In stage price
  - `top_out_price` - Top Out stage price
  - `trim_set_price` - Trim Set stage price
  - `total_price` - Total price across all stages
- **Sequence order** - Display order

**Database Tables**:

`price_book_versions`:
```sql
id (uuid, PK)
name (text, unique) -- Unique constraint added
created_at (timestamptz)
```

`price_book_entries`:
```sql
id (uuid, PK)
version_id (uuid, FK → price_book_versions ON DELETE CASCADE)
fixture_name (text)
rough_in_price (numeric(10,2))
top_out_price (numeric(10,2))
trim_set_price (numeric(10,2))
total_price (numeric(10,2))
sequence_order (integer)
created_at (timestamptz)
UNIQUE (version_id, fixture_name)
```

### Searchable Features

#### Price Book Entries Search

**Location**: Below price book version dropdown, above entries table

**Features**:
- **Real-time filtering** as you type
- Case-insensitive matching on fixture/tie-in name
- Table updates instantly
- When no matches found:
  - Shows: "No entries match '{search term}'"
  - **"Add to Price Book" button** appears
  - Clicking opens entry form with fixture name pre-filled

**Benefits**:
- Quickly find entries in large price books
- Create missing entries without leaving search flow

#### Searchable Assignment Dropdowns

**Location**: Pricing comparison table, per-fixture assignment column

**Behavior**:
- Click input to open dropdown with all price book entries
- Type to filter entries in real-time
- Matching entries appear in dropdown below input
- Click entry to assign
- Clear button (×) to remove assignment
- Dropdown closes when clicking outside

**No Matches Flow**:
- Type fixture name not in price book
- Shows: "No matches for '{search term}'"
- **"Add '{search term}' to Price Book" button** in dropdown
- Click to open entry form with name pre-filled
- After saving, can immediately assign new entry

**Technical Details**:
- Per-row search state tracking
- Click-outside handler closes dropdowns
- Hover effects on dropdown items
- Disabled during save operations

### Bid Pricing Assignments

#### Assignment Table

**Columns**:
- **Fixture** - From count rows (read-only)
- **Count** - Quantity (read-only)
- **Price Book Entry** - Searchable dropdown for assignment
- **Our Cost** - Calculated from cost estimate
- **Revenue** - From assigned price book entry
- **Margin %** - `(Revenue - Cost) / Revenue × 100`
- **Flag** - Color-coded indicator

**Totals Row**:
- Sum of all costs
- Sum of all revenue
- Overall margin %
- Overall flag

#### Cost Allocation Logic

**Labor Cost per Fixture**:
- Taken directly from cost estimate labor rows
- Sum of (Hours × Rate) across all three stages

**Material Cost per Fixture**:
- Total materials cost allocated proportionally by labor hours
- Formula: `(Fixture Hours / Total Hours) × Total Materials Cost`
- Ensures all material costs are distributed

**Total Cost per Fixture**: Labor Cost + Allocated Material Cost

#### Margin Calculation

```
Margin % = ((Revenue - Cost) / Revenue) × 100
```

**Color-Coded Flags**:
- 🔴 **Red**: < 20% margin (low profitability)
- 🟡 **Yellow**: 20% ≤ margin < 40% (acceptable)
- 🟢 **Green**: ≥ 40% margin (good profitability)

**Overall Margin**: Calculated from totals row

#### Bid Pricing Assignments Table

**Purpose**: Persist fixture-to-entry assignments

**Schema**:
```sql
bid_pricing_assignments:
  id (uuid, PK)
  bid_id (uuid, FK → bids ON DELETE CASCADE)
  count_row_id (uuid, FK → bids_count_rows ON DELETE CASCADE)
  price_book_entry_id (uuid, FK → price_book_entries ON DELETE CASCADE)
  UNIQUE (bid_id, count_row_id)
```

**RLS**: Access controlled via bid access policies

### Create Cost Estimate Prompt

**When Displayed**:
- Selected bid has count rows
- Selected bid has no cost estimate

**Content**:
- Message explaining cost estimate needed for pricing analysis
- **"Go to Cost Estimate" button**
- Switches to Cost Estimate tab with bid preselected

---

## Cover Letter Tab

### Purpose
Generate professional bid proposal documents with project details, scope, terms, and warranty information.

### Default Values

The Cover Letter provides sensible defaults that can be customized per bid.

#### Default Inclusions

**Constant**: `DEFAULT_INCLUSIONS`

**Value**: `"Permits"`

**Behavior**:
- Pre-fills Inclusions textarea when empty
- Appears in combined document preview
- User can edit or replace

#### Default Exclusions

**Constant**: `DEFAULT_EXCLUSIONS`

**Value** (4 lines):
```
Concrete cutting, removal, and pour back are excluded.
Impact fees are excluded.
Work not specifically described is excluded.
Electrical, fire protection, fire alarm, drywall, framing, and architectural finishes are excluded.
```

**Behavior**:
- Pre-fills Exclusions textarea when empty
- Displayed as bullets in combined document
- User can edit, add, or remove lines

#### Default Terms and Warranty

**Constant**: `DEFAULT_TERMS_AND_WARRANTY`

**Value**: Full paragraph including:
- Workmanlike manner commitment
- One-year workmanship warranty
- Material warranty information
- No warranty on customer-supplied materials
- Contingencies clause
- 30-day acceptance deadline
- Click Plumbing void option
- Extra charges disclosure (alterations, rock, debris)

**Behavior**:
- Pre-fills Terms and Warranty textarea when empty
- Shows in combined document even if user clears field
- Comprehensive standard terms

### Form Fields

#### Project Section

**Display** (top of Cover Letter and combined document):
- **Project Name** - From `bid.project_name`
- **Project Address** - From `bid.address`
- Two lines only, prominent placement

#### Editable Fields

**Inclusions** (textarea):
- Label: "Inclusions"
- Pre-filled with default
- Editable per bid
- Appears prominently in document

**Exclusions and Scope** (textarea):
- Label: "Exclusions and Scope (one per line, shown as bullets)"
- Pre-filled with 4-line default
- One exclusion per line
- Rendered as bullet list in document

**Terms and Warranty** (textarea):
- Label: "Terms and Warranty"
- Pre-filled with comprehensive default paragraph
- Editable per bid
- Shows default in combined document even if cleared

### Combined Document Preview

**Display**:
- Live preview of complete proposal document
- Includes all sections with proper formatting
- Uses defaults where user hasn't customized
- Professional layout suitable for customer presentation

### Edit Bid Button

**Location**: Cover Letter tab header, next to Close

**Function**:
- Opens Edit Bid modal for currently selected bid
- Quick access to update project details, address, contacts
- Saves need to return to Bid Board

---

## Submission & Followup Tab

### Purpose
Track bid submissions, follow-up activities, and outcomes. Organize bids by status for efficient pipeline management.

### Four Collapsible Sections

Each section has clickable header with:
- **Chevron** (▼ expanded, ▶ collapsed)
- **Item count** (e.g., "Unsent bids (3)")
- Click anywhere on header to toggle

#### 1. Unsent Bids

**Purpose**: Bids not yet submitted to customer

**Default state**: Expanded

**Criteria**: Bids with no submission date

#### 2. Not Yet Won or Lost (Pending Follow-up)

**Purpose**: Active bids awaiting decision

**Default state**: Expanded

**Criteria**: Bids submitted but outcome not yet determined

#### 3. Won Bids

**Purpose**: Bids awarded to company

**Default state**: Expanded

**Criteria**: `outcome = 'won'` or `outcome = 'started_or_complete'`

**Sorting**: Automatically sorted by `estimated_job_start_date` ascending (soonest first)

**Special column**: "Start Date" shows estimated job start date

#### 4. Lost Bids

**Purpose**: Bids not awarded

**Default state**: Collapsed

**Criteria**: `outcome = 'lost'`

**Reason tracking**: Shows `loss_reason` when provided

### Date Formatting

#### Bid Date (Time to/from due)

**Format**: +/- notation

**Logic**:
- **Negative numbers**: Days until deadline (e.g., "-15" = 15 days until bid is due)
- **Positive numbers**: Days past deadline (e.g., "+5" = 5 days overdue)
- **"-0"**: Due today

**Examples**:
- "-30" → 30 days until bid due
- "+2" → 2 days past deadline
- "-0" → Due today

**Old format** (replaced): "1 day since deadline", "2 days until due", "Due today"

#### Start Date (Won Bids only)

**Format**: "MM/DD [±X]"

**Logic**:
- Shows date and countdown/countup
- Negative: Days until start
- Positive: Days since start
- "-0": Starting today

**Examples**:
- "04/15 [-15]" → April 15, starting in 15 days
- "03/01 [+10]" → March 1, started 10 days ago
- "02/05 [-0]" → February 5, starting today

### Bid Values in Project Names

**Format**: Project name followed by bid value in thousands

**Pattern**: "Project Name (X.X)"

**Smart Decimal Formatting**:
- **Values under $10k**: Show 1 decimal (e.g., "3.8", "9.5")
- **Values ≥ $10k**: No decimal (e.g., "11", "25", "150")

**Examples**:
- Bid value $3,800: "Gibbs Residence Grinder Pump (3.8)"
- Bid value $11,700: "Project Name (11)"
- Bid value $500: "Project Name (0.5)"
- No bid value: "Project Name" (no suffix)

**Benefits**:
- Quickly assess bid size without opening
- Prioritize larger opportunities at a glance
- Cleaner display for large values

### GC/Builder Contact Fields

**Per-bid fields** (stored in bids table):
- `gc_contact_name` - Project contact name
- `gc_contact_phone` - Project contact phone
- `gc_contact_email` - Project contact email

**Display Location**: Selected bid panel above submission entries table

**Panel shows**:
- Builder Name (from customer)
- Builder Address (from customer)
- Builder Phone Number (from customer)
- Builder Email (from customer)
- Project Name
- Project Address
- **Project Contact Name** (from bid)
- **Project Contact Phone** (from bid)
- **Project Contact Email** (from bid)
- Bid Size

**Note**: Project contact fields NOT shown in Bid Board table (only in Submission panel)

### Cost Estimate Indicator

**Location**: Selected bid panel in Submission & Followup tab

**Display**:
- **Cost estimate:** Shows amount or status
- **Amount format**: Comma-formatted (e.g., "$12,345.67") when estimate exists
- **Status**: "Not yet created" when no estimate
- **Loading state**: "Loading cost estimate info…"

**Button**:
- **"View cost estimate"** (when exists): Switches to Cost Estimate tab with bid preselected
- **"Create cost estimate"** (when missing): Switches to Cost Estimate tab for creation

**Purpose**: Quick navigation to cost estimate without leaving Submission view

### Edit Column

**Display**: Gear icon button in last column

**Visibility**: Only appears for selected bid row

**Behavior**:
- Click opens Edit Bid modal for that bid
- Uses `stopPropagation` to prevent row selection
- Consistent across all four section tables

### Clickable GC/Builder

**Location**: GC/Builder column in "Not yet won or lost", "Won", and "Started or Complete" tables

**Behavior**: Click customer name to open Customer / GC Builder modal

**Modal Features**:
- Customer details
- All contact information
- **"All bids" section** - Lists all bids for this customer with computed status:
  - Unsent
  - Not yet won or lost
  - Won
  - Started or Complete
  - Lost

**Benefits**: See customer's complete bid history and status at a glance

### Navigation Arrows

**Up Arrow**:
- Location: Next to Edit/settings button in bid row
- Function: Scrolls back to selected-bid summary at top
- Use case: Return to summary after scrolling through long table

**Down Arrow**:
- Location: Near Approval PDF area in selected-bid summary panel
- Function: Scrolls to selected bid's row in correct table section
- Auto-expands section if collapsed
- Use case: Navigate from summary to bid details in table

**Benefits**: Efficient navigation in long submission lists

### Table Columns

**Simplified column headers** (from v2.23+):
- "Bid Date" (was "Bid Due Date" or "Time to/from bid due date")
- "Last Contact" (was "Time since last contact")
- "Start Date" (was "Estimated Job Start Date", Won bids only)
- "Edit" (gear icon column)

### Print and PDF Features

**Location**: Above search bar in Submission & Followup tab

**Components**:
1. Account Manager selector dropdown
2. Print button (opens preview window)
3. PDF button (downloads file)

**Account Manager Options**:
- Individual account managers (shows only their assigned bids)
- "ALL" (shows all bids, grouped by account manager, one page each)
- "UNASSIGNED" (shows bids without account manager)

**Print Preview Window**:
- Opens in new window with print-optimized formatting
- Projects grouped by status:
  - "Not Yet Won or Lost" section
  - "Won" section
- Excludes lost bids from printout

**PDF Format**:
Same formatting as print preview with enhanced features:
- Clickable phone numbers (tel: links for mobile)
- Clickable email addresses (mailto: links)
- Professional formatting for field use

**Content Per Project**:
- Project name and address
- Builder information (indented 10 spaces):
  - Phone (clickable in PDF)
  - Address
  - Email (clickable in PDF)
- Project Contact details:
  - Name
  - Phone (clickable in PDF)
  - Email (clickable in PDF)
- Bid Details:
  - Win/Loss status
  - Bid Date
  - Sent Date
  - Design Drawing Plan Date
  - Bid Value
  - Agreed Value
  - Distance to Office (miles)
  - Notes
- Latest 3 Submission Entries:
  - Contact method
  - Notes
  - Timestamp

**Technical Implementation**:
- `printFollowupSheet()`: Opens print preview window with HTML generation
- `downloadFollowupSheetPdf()`: Generates downloadable PDF using jsPDF library
- Filters bids by account manager and status
- Fetches latest 3 submission entries per project
- Formats contact information with clickable links

**Use Case**:
Account managers can print or download their assigned projects for field reference, with clickable contact information for immediate communication from mobile devices.

---

## Database Schema

### Core Bids Table

```sql
bids:
  id (uuid, PK)
  project_name (text, required)
  address (text, nullable)
  customer_id (uuid, FK → customers, nullable)
  gc_builder (text, nullable) -- Legacy field
  estimator_id (uuid, FK → users, nullable)
  service_type_id (uuid, FK → service_types, required) -- Trade category
  bid_due_date (date, nullable)
  outcome (text, nullable) -- 'won', 'lost', 'started_or_complete'
  loss_reason (text, nullable)
  estimated_job_start_date (date, nullable)
  distance_to_office (numeric(10,2), nullable) -- Miles
  
  -- Project contact fields (per bid)
  gc_contact_name (text, nullable)
  gc_contact_phone (text, nullable)
  gc_contact_email (text, nullable)
  
  -- Book version selections
  selected_takeoff_book_version_id (uuid, FK → takeoff_book_versions, nullable)
  selected_labor_book_version_id (uuid, FK → labor_book_versions, nullable)
  selected_price_book_version_id (uuid, FK → price_book_versions, nullable)
  
  created_at (timestamptz)
  updated_at (timestamptz) -- Auto-updated via trigger
```

### Count Rows

```sql
bids_count_rows:
  id (uuid, PK)
  bid_id (uuid, FK → bids ON DELETE CASCADE)
  fixture_or_tiein (text, required)
  count (integer, required, CHECK count >= 0)
  plan_page (text, nullable)
  sequence_order (integer)
  created_at (timestamptz)
  updated_at (timestamptz)
```

### Cost Estimates

```sql
cost_estimates:
  id (uuid, PK)
  bid_id (uuid, FK → bids ON DELETE CASCADE, unique)
  labor_rate (numeric(10,2), nullable)
  driving_cost_rate (numeric(10,2), default 0.70)
  hours_per_trip (numeric(10,2), default 2.0)
  created_at (timestamptz)
  updated_at (timestamptz)
```

### Cost Estimate Labor Rows

```sql
cost_estimate_labor_rows:
  id (uuid, PK)
  cost_estimate_id (uuid, FK → cost_estimates ON DELETE CASCADE)
  fixture_name (text, required)
  rough_in_hrs (numeric(10,2), default 0)
  top_out_hrs (numeric(10,2), default 0)
  trim_set_hrs (numeric(10,2), default 0)
  sequence_order (integer)
  created_at (timestamptz)
```

### Takeoff Book Tables

```sql
takeoff_book_versions:
  id (uuid, PK)
  name (text, required)
  created_at (timestamptz)

takeoff_book_entries:
  id (uuid, PK)
  version_id (uuid, FK → takeoff_book_versions ON DELETE CASCADE)
  fixture_name (text, required)
  alias_names (text[], nullable) -- Array of alternative names
  sequence_order (integer)
  created_at (timestamptz)
  UNIQUE (version_id, fixture_name)

takeoff_book_entry_items:
  id (uuid, PK)
  entry_id (uuid, FK → takeoff_book_entries ON DELETE CASCADE)
  template_id (uuid, FK → material_templates ON DELETE CASCADE)
  stage (text, required) -- 'Rough In', 'Top Out', 'Trim Set'
  created_at (timestamptz)
```

### Labor Book Tables

```sql
labor_book_versions:
  id (uuid, PK)
  name (text, required)
  created_at (timestamptz)

labor_book_entries:
  id (uuid, PK)
  version_id (uuid, FK → labor_book_versions ON DELETE CASCADE)
  fixture_name (text, required)
  alias_names (text[], nullable)
  rough_in_hrs (numeric(10,2), required)
  top_out_hrs (numeric(10,2), required)
  trim_set_hrs (numeric(10,2), required)
  sequence_order (integer)
  created_at (timestamptz)
  UNIQUE (version_id, fixture_name)
```

### Price Book Tables

```sql
price_book_versions:
  id (uuid, PK)
  name (text, unique, required) -- Unique constraint
  created_at (timestamptz)

price_book_entries:
  id (uuid, PK)
  version_id (uuid, FK → price_book_versions ON DELETE CASCADE)
  fixture_name (text, required)
  rough_in_price (numeric(10,2), required)
  top_out_price (numeric(10,2), required)
  trim_set_price (numeric(10,2), required)
  total_price (numeric(10,2), required)
  sequence_order (integer)
  created_at (timestamptz)
  UNIQUE (version_id, fixture_name)

bid_pricing_assignments:
  id (uuid, PK)
  bid_id (uuid, FK → bids ON DELETE CASCADE)
  count_row_id (uuid, FK → bids_count_rows ON DELETE CASCADE)
  price_book_entry_id (uuid, FK → price_book_entries ON DELETE CASCADE)
  created_at (timestamptz)
  UNIQUE (bid_id, count_row_id)
```

### Row Level Security

All book tables (Takeoff, Labor, Price) have RLS policies allowing:
- **dev**: Full CRUD
- **master_technician**: Full CRUD
- **assistant**: Full CRUD
- **estimator**: Full CRUD

Bids table access:
- **dev**: Full CRUD
- **master_technician**: Full CRUD
- **assistant**: Read/Write (limited to accessible customers)
- **estimator**: Full CRUD

---

## Integration with Materials

### Purchase Order Creation

**From Takeoff Tab**:
1. User maps counts to templates
2. Clicks "Create PO" or "Add to PO"
3. System expands templates using `expandTemplate()` utility:
   - Handles nested templates recursively
   - Calculates quantities: Count × Template Qty × Part Qty
   - Tags items with `from_template` flag
4. Creates or updates PO in Materials system
5. Navigates to Materials page with PO open

**Utility Functions** (`src/lib/materialPOUtils.ts`):
- `expandTemplate(templateId, quantity)`: Recursively expands nested templates
- `getTemplatePartsPreview(templateId)`: Preview parts before adding
- `addExpandedPartsToPO(poId, parts)`: Add parts to existing PO

### Linking POs to Cost Estimate

**In Cost Estimate**:
- User can link up to 3 POs per stage:
  - Rough In PO
  - Top Out PO
  - Trim Set PO
- Material costs pulled from linked POs
- Updates automatically when PO finalized

### Workflow Integration

**From Materials to Workflow**:
- Finalized POs can be added to workflow line items
- Links purchase to specific project stage
- "Go to Projects" button in PO view navigates to associated project workflow
- Line item shows "View PO" button when linked

**Benefits**:
- Seamless flow from estimation to purchasing to project tracking
- Single source of truth for material costs
- Audit trail from bid to completion

---

## Related Documentation

- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Overall architecture and database schema
- [RECENT_FEATURES.md](./RECENT_FEATURES.md) - Latest updates and feature additions
- [Materials documentation](./PROJECT_DOCUMENTATION.md#materials-management-tables) - Materials system details
- [Workflow documentation](./WORKFLOW_FEATURES.md) - Project workflow and line items

---

## Future Enhancements

### Planned Features
- Bid comparison reports (compare multiple bids side-by-side)
- Historical pricing analysis (track price trends over time)
- Automated bid reminders (notify when follow-up needed)
- Template suggestions (AI-powered template recommendations)
- Bid performance metrics (win rate, average margin, etc.)

### Integration Opportunities
- QuickBooks export (send won bids to accounting)
- Email integration (send cover letters directly to customers)
- Calendar integration (sync bid due dates and start dates)
- Document generation (PDF proposals with company branding)
