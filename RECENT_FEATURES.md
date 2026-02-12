# Recent Features and Updates

This document summarizes all recent features and improvements added to Pipetooling.

---
file: RECENT_FEATURES.md
type: Changelog
purpose: Chronological log of all features and updates by version
audience: All users (developers, product managers, AI agents)
last_updated: 2026-02-11
estimated_read_time: 30-40 minutes
difficulty: Beginner to Intermediate

format: "Reverse chronological (newest first)"
version_range: "v2.33 → v2.4"

key_sections:
  - name: "Latest Version (v2.33)"
    line: ~82
    description: "Labor step increment, delete in modals, Template→Assembly, Bid Board changes"
  - name: "v2.32"
    line: ~116
    description: "Settings renames, Materials Load All, Cost Estimate distance"
  - name: "v2.29"
    line: ~110
    description: "Price/Labor book enhancements and fixed price feature"
  - name: "Bids System Updates"
    versions: "v2.25, v2.24, v2.23, v2.22"
    description: "Book systems, driving costs, pricing features"
  - name: "Materials Enhancements"
    versions: "v2.24, v2.20, v2.19"
    description: "Load All mode, infinite scroll, PO features"
  - name: "Database Improvements"
    versions: "v2.22"
    description: "Triggers, constraints, transaction functions"

quick_navigation:
  - "Latest features at top (v2.32)"
  - "Search for specific version: v2.XX"
  - "Search for feature name (e.g., 'Load All', 'Driving Cost')"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Technical details"
  - "[BIDS_SYSTEM.md](./BIDS_SYSTEM.md) - Bids features"
  - "[MIGRATIONS.md](./MIGRATIONS.md) - Database changes"

when_to_read:
  - Understanding what changed recently
  - Finding when a feature was added
  - Reviewing project evolution
  - Catching up after time away
---

## Table of Contents
1. [Latest Updates (v2.33)](#latest-updates-v233) - Labor Step, Delete in Modals, Template→Assembly, Bid Board
2. [Latest Updates (v2.32)](#latest-updates-v232) - Settings Renames, Materials Load All, Cost Estimate Distance
3. [Latest Updates (v2.31)](#latest-updates-v231) - Pricing Takeoff-Based Cost, Counts Quick-adds, Settings Improvements
4. [Latest Updates (v2.30)](#latest-updates-v230) - Estimator Service Type Filtering
5. [Latest Updates (v2.29)](#latest-updates-v229) - Price/Labor Book Enhancements, Fixed Price Feature
6. [Latest Updates (v2.28)](#latest-updates-v228) - Part Types vs Fixture Types Separation
7. [Latest Updates (v2.27)](#latest-updates-v227) - Service Type System
8. [Latest Updates (v2.26)](#latest-updates-v226)
9. [Latest Updates (v2.25)](#latest-updates-v225)
10. [Latest Updates (v2.24)](#latest-updates-v224)
11. [Latest Updates (v2.23)](#latest-updates-v223)
12. [Latest Updates (v2.22)](#latest-updates-v222)
13. [Latest Updates (v2.21)](#latest-updates-v221)
14. [Latest Updates (v2.20)](#latest-updates-v220)
15. [Latest Updates (v2.19)](#latest-updates-v219)
16. [Latest Updates (v2.18)](#latest-updates-v218)
17. [Latest Updates (v2.17)](#latest-updates-v217)
18. [Latest Updates (v2.16)](#latest-updates-v216)
19. [Latest Updates (v2.15)](#latest-updates-v215)
20. [Latest Updates (v2.14)](#latest-updates-v214)
21. [Latest Updates (v2.13)](#latest-updates-v213)
22. [Latest Updates (v2.12)](#latest-updates-v212)
23. [Latest Updates (v2.11)](#latest-updates-v211)
24. [Latest Updates (v2.10)](#latest-updates-v210)
25. [Latest Updates (v2.9)](#latest-updates-v29)
26. [Latest Updates (v2.8)](#latest-updates-v28)
27. [Latest Updates (v2.7)](#latest-updates-v27)
28. [Latest Updates (v2.6)](#latest-updates-v26)
29. [Workflow Features](#workflow-features)
30. [Calendar Updates](#calendar-updates)
31. [Access Control](#access-control)
32. [Email Templates](#email-templates)
33. [Financial Tracking](#financial-tracking)
34. [Customer and Project Management](#customer-and-project-management)

---

## Latest Updates (v2.33)

### Labor Section Increment Step

**Date**: 2026-02-11

**Overview**:
Rough In, Top Out, and Trim Set labor hour inputs in the Cost Estimate tab now use a step of 0.25 instead of 0.01 for the up/down arrows, making it easier to adjust labor hours in quarter-hour increments.

---

### Delete Buttons Moved to Edit Modals

**Date**: 2026-02-11

**Overview**:
In-row delete buttons were removed from Takeoff, Labor, and Pricing books. Delete actions are now only available inside the edit modal for each entry, reducing accidental deletions and keeping the table row layout cleaner.

---

### Template → Assembly Terminology

**Date**: 2026-02-11

**Overview**:
All user-facing "Template"/"Templates" labels for material templates were renamed to "Assembly"/"Assemblies" across Materials, Bids, and Settings.

**Changes**:
- **Tab**: "Templates & Purchase Orders" → "Assemblies & Purchase Orders"
- **Section**: "Material Templates" → "Material Assemblies"
- Labels, placeholders, error messages, and related copy updated throughout
- **Note**: Database tables and code still use `material_templates`; only UI text changed

---

### Bid Board Changes

**Date**: 2026-02-11

**Overview**:
The Bid Board tab was simplified and reorganized for cleaner layout and focused workflow.

**Removed columns**:
- Notes
- Win/Loss (W/L)
- Sent Date

**Lost bids**:
- Lost bids are now always hidden on the Bid Board (no toggle)
- Empty state message when all matching bids are lost: "No bids to show (all matching bids are lost)."

**Layout updates**:
- **Column headers** split across lines: Project/Folder, Job/Plans, Account/Man, Bid/Date, Last/Contact, Distance/to Office
- **Address**: Line break after first comma (e.g., street on line 1; city/state on line 2)
- **Last Contact**: Weekday and date on separate lines (e.g., "Wed" / "2/11")
- **Project Folder**: Folder SVG icon instead of "Link" text
- **Job Plans**: Document SVG icon instead of "Link" text

---

## Latest Updates (v2.32)

### Settings Renames and Category Removal

**Date**: 2026-02-11

**Overview**:
Settings section names and labels were clarified for better clarity. The category field was removed from Book Names.

**Changes**:
- **Fixture Types** → **Takeoff, Labor, and Price Book Names**
- **Part Types** → **Material Part Types**
- **Counts Quick-adds** → **Counts Quick-add Names** (label only; section was already named Counts Quick-adds)
- **Book Names**: Removed category field from form and badge; simplified display

---

### Book Names and Price Book Ordering

**Date**: 2026-02-11

**Overview**:
Items in Settings and Bids are now sorted alphabetically. Price Book entries are sorted by fixture name with `localeCompare` (alphanumeric). Move up/down buttons were removed from Book Names.

**Implementation**:
- Settings and Bids: Book names sorted alphabetically by name
- Price Book: Entries sorted by fixture name using `localeCompare`
- Removed move up/down buttons from Book Names section

---

### Email Templates Layout

**Date**: 2026-02-11

**Overview**:
Email Templates section is now collapsible and collapsed by default. Full-width layout with no border for a cleaner appearance.

---

### Materials Price Book – Load All Mode

**Date**: 2026-02-11

**Overview**:
The mountain icon (Load All) in the Materials Price Book was fixed for clickability and now persists per user. Load All mode is on by default for new users.

**Implementation**:
- **Clickability fix**: Added `pointerEvents: 'none'` to the SVG to prevent child elements from blocking clicks
- **Persistence**: Preference saved per user in `localStorage` (`materials_loadAllMode_${userId}`)
- **Default**: Load All mode is on by default for new users

---

### Cost Estimate – Update Bid Distance

**Date**: 2026-02-11

**Overview**:
Added a distance input and **Update bid distance** button next to Edit bid in the Driving Cost Parameters section. Users can quickly update the bid distance without leaving the Cost Estimate view.

**Implementation**:
- Added `[ ___ mi]` distance input and **Update bid distance** button next to Edit bid
- Shows success message ("✓ Distance updated") for 3 seconds after a successful update
- Located in the Driving Cost Parameters section of the Cost Estimate view

---

## Latest Updates (v2.31)

### Bids Pricing Tab: Takeoff-Based Our Cost and Row Breakdown

**Date**: 2026-02-11

**Overview**:
The Pricing tab "Our cost" now uses takeoff parts prices per fixture (with tax) plus labor instead of allocating total materials proportionally by labor hours. Clicking a row opens a modal showing the cost breakdown.

**Implementation**:
- **Our cost formula**: `(takeoff materials for fixture × (1 + tax%)) + labor`. Falls back to proportional allocation when fixture has no takeoff mappings.
- **Takeoff integration**: Loads `bids_takeoff_template_mappings` and PO items from Cost Estimate POs; uses `expandTemplate()` to compute per-fixture materials from templates and part prices.
- **Tax**: Uses `costEstimatePOModalTaxPercent` (default 8.25%) for takeoff-based materials.
- **Breakdown modal**: Shows Materials (from takeoff or proportional), Tax, Labor, and Our cost. Closes on backdrop click or Close button.

---

### Counts Quick-adds (formerly Counts Fixtures)

**Date**: 2026-02-11

**Overview**:
The hardcoded fixture quick-select buttons in Bids Counts (when adding a row) are now configurable per service type in Settings. Renamed from "Counts Fixtures" to "Counts Quick-adds."

**Implementation**:
- **Database**: New tables `counts_fixture_groups` and `counts_fixture_group_items`. Each service type (Plumbing, Electrical, HVAC) has its own groups and fixture names.
- **Settings**: Devs can add/edit/delete groups and fixtures per service type. One fixture per row for easier organization.
- **Bids**: NewCountRow loads the appropriate groups from the database based on the bid's service type.

---

### Settings Improvements

**Date**: 2026-02-11

**Overview**:
Multiple UX and capability improvements in Settings for devs.

**Changes**:
1. **Convert Master to Assistant/Subcontractor**: Section is now collapsible and collapsed by default.
2. **User actions**: Edit, Send email to sign in, imitate, Set password buttons display next to each other (horizontal layout).
3. **People Created by Other Users**: Devs can now edit (rename, email, phone, notes) and delete people entries created by other users. RLS policies added for devs to update/delete any people.
4. **Fixture Types**: "Remove unused" button next to "+ Add Fixture Type" removes all fixture types with 0 takeoff, 0 labor, 0 price. Useful for cleaning up the labor book fixture list. Counts are unaffected (count rows store fixture as free text).

---

## Latest Updates (v2.30)

### Estimator Service Type Filtering

**Date**: 2026-02-11

**Overview**:
Devs can restrict estimators to specific service types (Plumbing, Electrical, HVAC). Estimators with restrictions see only their allowed service types in Bids and Materials; estimators with no restriction continue to see all service types.

**Implementation**:
- **Database**: Added `estimator_service_type_ids uuid[]` to `users` (nullable). NULL or empty = all types; non-empty = only those types
- **RLS**: Helper function `estimator_can_access_service_type()` used in policies for bids, materials, books, and reference tables
- **Settings**: Manual Add User and Edit User show service type checkboxes when role is estimator
- **create-user Edge Function**: Accepts optional `service_type_ids` when creating estimators
- **Materials & Bids pages**: Filter service type tabs/selector to only show allowed types for restricted estimators

**User Flow**:
1. Dev creates or edits an estimator in Settings
2. When role is estimator, service type checkboxes appear (Plumbing, Electrical, HVAC)
3. Leave all unchecked = estimator sees all types (default)
4. Check specific types = estimator sees only those (e.g., Electrical only)
5. Restricted estimator sees only their allowed tabs in Bids and Materials

---

## Latest Updates (v2.29)

### Bids System: Price/Labor Book Enhancements and Fixed Price Feature

**Date**: 2026-02-10

**Overview**:
Enhanced the Price and Labor book entry workflows with plain text autocomplete input, automatic fixture type creation, and added a fixed price feature for flat-rate pricing in the Pricing tab. Improved Cost Estimate print output with PO summaries and split cost columns.

#### 1. Plain Text Fixture Input with Auto-Creation

**Problem**: 
- Pricing and Labor book entry modals used strict dropdowns for fixture types
- Users couldn't add entries for fixtures not already in the system
- Save button failed silently when typed names didn't match exactly

**Solution**:
- Replaced `<select>` dropdowns with `<input>` + `<datalist>` combobox
- Users can now type freely or select from autocomplete suggestions
- New fixture types are automatically created when custom names are entered
- Added error display in modals for better feedback

**Implementation**:
- Created `getOrCreateFixtureTypeId()` helper function
- Automatically assigns new fixtures to "Other" category
- Reloads fixture types after creation so suggestions update immediately
- Applied to both Pricing and Labor entry modals

**User Flow**:
1. User opens "Add entry" modal in Pricing or Labor tabs
2. Types fixture name (e.g., "Water Softener")
3. If not in system, autocomplete shows existing similar fixtures
4. On save, new fixture type is created automatically
5. All future users see the new fixture in suggestions

#### 2. Fixed Price Checkbox in Pricing Tab

**Problem**:
Revenue calculations always multiplied price book entry by count, which doesn't work for flat-rate items (e.g., permits, delivery fees, one-time charges).

**Solution**:
Added "Fixed" checkbox next to each pricing assignment that bypasses count multiplication.

**Database Changes**:
```sql
-- Migration: 20260210193624_add_fixed_price_to_pricing_assignments.sql
ALTER TABLE public.bid_pricing_assignments
ADD COLUMN is_fixed_price BOOLEAN NOT NULL DEFAULT false;
```

**Behavior**:
- **Unchecked (default)**: `Revenue = Price × Count`
- **Checked**: `Revenue = Price` (ignores count)

**Implementation Details**:
- Added `togglePricingAssignmentFixedPrice()` function
- Updated revenue calculations in 5 locations:
  - Main pricing table display
  - Single price book print
  - All price books print
  - Cover letter revenue calculation (2 locations)
- Checkbox appears inline with assignment input field

**UI Layout**:
```
[Search or assign...] [☑ Fixed] [×]
```

#### 3. Cost Estimate Print Improvements

**A. PO Summaries in Print View**

**Enhancement**: When printing Cost Estimate, each PO stage (Rough In, Top Out, Trim Set) now displays a detailed summary table showing:
- Part name
- Quantity (formatted with commas for 1,000+)
- Price per unit (formatted with commas)
- Line total (formatted with commas)
- PO subtotal

**Implementation**:
- Made `printCostEstimatePage()` async to load PO items
- Created `loadPOItems()` helper to fetch from `purchase_order_items`
- Created `generatePOSummary()` to render HTML table
- Applied `toLocaleString()` formatting for all numbers

**B. Split Cost Columns in Pricing Print**

**Enhancement**: Pricing tab print view now shows separate "Our Labor" and "Our Materials" columns instead of combined "Our cost".

**Before**:
| Fixture | Count | Entry | Our cost | Revenue | Margin % |
|---------|-------|-------|----------|---------|----------|
| Toilet  | 5     | Toilet| $2,000   | $2,500  | 20.0%    |

**After**:
| Fixture | Count | Entry | Our Labor | Our Materials | Revenue | Margin % |
|---------|-------|-------|-----------|---------------|---------|----------|
| Toilet  | 5     | Toilet| $1,250    | $750          | $2,500  | 20.0%    |

**Benefits**:
- Clear visibility into labor vs materials costs per fixture
- Separate totals row for each cost type
- Better cost analysis and margin understanding

#### 4. Cost Estimate UI Improvements

**Changes**:
- Centered "Materials" and "Labor" section headings in print view
- Centered Save button at bottom of Cost Estimate tab
- Changed "Grand total:" to "Our total cost is:" in print summary

#### 5. Settings Documentation Update

Updated Fixture Types description to reflect:
- Distinction from Part Types (Materials)
- Auto-creation capability
- Examples of fixture types (Toilet, Sink, Water Heater)
- Clarified usage across Bids and book systems

#### 6. Bug Fixes

**Issue**: Pricing assignment input showed blank after selecting entry
**Fix**: Updated value logic to check for `undefined` instead of using nullish coalescing, properly delete search state keys

#### Summary of Changes

**Database**:
- `bid_pricing_assignments.is_fixed_price` column added
- Index on `is_fixed_price` for query performance

**Frontend** (`Bids.tsx`):
- `getOrCreateFixtureTypeId()` helper function
- Replaced fixture dropdowns with text input + datalist (2 modals)
- `togglePricingAssignmentFixedPrice()` function
- Updated revenue calculations (5 locations)
- Made `printCostEstimatePage()` async with PO summaries
- Split cost columns in pricing prints (2 functions)
- Fixed pricing assignment display bug
- Centered UI elements in print views

**Settings** (`Settings.tsx`):
- Updated Fixture Types description

**Files Modified**:
- `pipetooling.github.io/src/pages/Bids.tsx`
- `pipetooling.github.io/src/pages/Settings.tsx`
- `pipetooling.github.io/supabase/migrations/20260210193624_add_fixed_price_to_pricing_assignments.sql` (new)

**User Benefits**:
- Faster data entry with autocomplete
- No more blocked workflows from missing fixtures
- Flexible pricing for flat-rate vs per-unit items
- Better cost visibility in reports
- More accurate revenue calculations

---

## Latest Updates (v2.28)

### Part Types vs Fixture Types: Complete Domain Separation

**Date**: 2026-02-10

**Overview**:
Major architectural refactor splitting the overloaded "Fixture Type" concept into two distinct domains: Part Types (for Materials) and Fixture Types (for Bids/Books). This resolves semantic confusion and properly separates material catalog management from bid estimation workflows.

#### The Problem

The original implementation used "Fixture Type" for two unrelated purposes:
1. **Materials Price Book**: Categorizing parts like pipes, fittings, valves (should be "Part Type")
2. **Bids/Books**: Categorizing installed fixtures like toilets, sinks for labor/pricing calculations

This caused confusion and data model issues where plumbing supply parts were being treated as installed fixtures.

#### The Solution

**Created separate tables and workflows:**

1. **Part Types** (`part_types` table) - for Materials system
   - Used in Materials Price Book to categorize material parts
   - Examples: Pipe, Fitting, Valve, Coupling, Adapter
   - Foreign key: `material_parts.part_type_id`
   - Management: Settings page, Part Types section (appears first)

2. **Fixture Types** (`fixture_types` table) - for Bids/Books system
   - Used in Labor Books and Price Books for calculations
   - Examples: Toilet, Sink, Tub, Water Heater, Faucet
   - Foreign keys: `labor_book_entries.fixture_type_id`, `price_book_entries.fixture_type_id`
   - Management: Settings page, Fixture Types section (appears second)
   - Count rows usage: Count rows (`bids_count_rows`) use free text `fixture` field for flexibility

#### Database Changes

**New Tables**:
- `part_types` - Service-type-specific part categorization for materials

**Migrations**:
1. `20260210122816_create_part_types.sql` - Creates `part_types` table, copies Plumbing data from `fixture_types`
2. `20260210122817_add_part_type_id_to_material_parts.sql` - Adds `part_type_id` FK to `material_parts`, backfills data
3. `20260210122818_remove_fixture_type_from_material_parts.sql` - Removes old `fixture_type_id` from `material_parts`
4. `20260210_revert_count_rows_to_text.sql` - Reverts `bids_count_rows` from FK to free text

**Schema Summary**:
- `material_parts.part_type_id` → `part_types.id` (FK)
- `labor_book_entries.fixture_type_id` → `fixture_types.id` (FK)
- `price_book_entries.fixture_type_id` → `fixture_types.id` (FK)
- `bids_count_rows.fixture` (TEXT, not FK - free text for flexibility)

#### Frontend Refactor (47 TypeScript Errors Fixed)

**Comprehensive code updates across 8 files:**

1. **Materials.tsx** (5 errors fixed)
   - Renamed all `fixtureType` references to `partType`
   - Updated queries to use `part_types` table
   - Changed display logic to show `part_type?.name`
   - Added validation for required `part_type_id`
   - Fixed initial page load issue (added `loadParts(0)` to service type change effect)

2. **Bids.tsx** (36+ errors fixed)
   - Created extended types with joined fixture data: `LaborBookEntryWithFixture`, `PriceBookEntryWithFixture`
   - Added `fixture_types(name)` joins to all labor/price book queries
   - Updated all display logic to use `fixture_types?.name ?? ''`
   - Converted INSERT/UPDATE to use `fixture_type_id` with name lookup helper
   - Reverted count rows to use free text `fixture` field
   - Added `service_type_id` to material template and bid inserts
   - Added `loadFixtureTypes()` function and state management

3. **Settings.tsx** (4 errors fixed)
   - Duplicated fixture type management UI for part types
   - Added part count display and cleanup feature
   - Added fixture type usage counts (labor, price, count rows)
   - Fixed undefined checks in count badges
   - Reordered sections: Part Types first, Fixture Types second
   - Updated count row matching to use free text name matching

4. **Other Files** (7 errors fixed)
   - CustomerForm/NewCustomerForm: Fixed `master_user_id` null handling
   - Dashboard/Workflow: Added null coalescing for boolean fields

#### Key Technical Decisions

1. **Count Rows Stay Free Text**: 
   - `bids_count_rows.fixture` remains TEXT (not FK) for flexibility
   - Users can enter any text, not restricted to fixture types
   - Settings counts match by name for display purposes only

2. **Books Use Structured FKs**:
   - Labor and Price books need structured data for calculations
   - Forms now use fixture type lookup by name
   - Validation ensures fixture type exists before saving

3. **Helper Function Pattern**:
   - Added `getFixtureTypeIdByName()` for name-to-ID lookups
   - Preserves text-based UI while using structured database

#### Benefits

- Clear semantic separation between Materials and Bids domains
- Better data integrity with proper foreign keys
- Flexible count rows for field notes
- Structured books for reliable calculations
- Settings UI properly organized by domain
- All TypeScript errors resolved

#### Build Verification

```
npm run build
✓ built in 1.54s
```

All 47 TypeScript errors resolved and production build succeeds.

#### Files Modified (8)

- `src/pages/Materials.tsx` - Part type refactor, initial load fix
- `src/pages/Bids.tsx` - Count rows revert, fixture type joins, inserts
- `src/pages/Settings.tsx` - Dual management UI, count badges, reordering
- `src/components/NewCustomerForm.tsx` - Null handling
- `src/pages/CustomerForm.tsx` - Null handling
- `src/pages/Dashboard.tsx` - Boolean null coalescing
- `src/pages/Workflow.tsx` - Boolean null coalescing
- `src/types/database.ts` - Regenerated types

#### Migration Files (4)

- `supabase/migrations/20260210122816_create_part_types.sql`
- `supabase/migrations/20260210122817_add_part_type_id_to_material_parts.sql`
- `supabase/migrations/20260210122818_remove_fixture_type_from_material_parts.sql`
- `supabase/migrations/20260210_revert_count_rows_to_text.sql`

#### Updated Documentation

- `GLOSSARY.md` - Updated Fixture, Part Type, Count Row, Labor Book, and Price Book definitions

---

## Latest Updates (v2.27)

### Service Type System

**Date**: 2026-02-10

**Overview**:
Implemented comprehensive Service Type system for categorizing materials (parts, templates, purchase orders) and bids by trade type (Plumbing, Electrical, HVAC), with filtering UI in both Materials and Bids sections.

**Features**:
- Three initial service types: Plumbing, Electrical, HVAC
- Dev-only management interface in Settings for adding/editing/reordering service types
- Filter buttons above tabs in `/materials` to show only items of selected type
- Filter buttons above tabs in `/bids` to show only bids of selected type
- All existing data automatically assigned to Plumbing service type
- Service type displayed when adding new parts in Materials
- Service type required field for all new bids and materials
- Color-coded service type buttons for visual distinction

**UI Components**:
- Materials: Service type filter buttons above Price Book, Templates, and PO tabs
- Bids: Service type filter buttons above all bid tabs
- Settings: Service Types management section (dev-only)

**Database**:
- New table: `service_types` (id, name, description, color, sequence_order)
- New columns: `service_type_id` added to `material_parts`, `material_templates`, `purchase_orders`, `bids`
- RLS: Dev-only write access, all authenticated read access

**Bug Fix**: Fixed stale data issue where switching service types in Materials would briefly show parts from previous type

**Files Modified**:
- `src/pages/Materials.tsx`: Service type filtering and UI
- `src/pages/Bids.tsx`: Service type filtering and UI
- `src/pages/Settings.tsx`: Service type management (CRUD operations)

### Followup Sheet Print and PDF

**Date**: 2026-02-09

**Overview**:
Added print preview and downloadable PDF functionality for account manager follow-up sheets in Submission & Followup tab.

**Features**:
- Dropdown to select specific account manager or "ALL" or "UNASSIGNED"
- Print button opens printable preview window (similar to Pricing tab)
- PDF button downloads formatted PDF with clickable phone numbers and emails
- Shows projects grouped by status: "Not Yet Won or Lost" and "Won"
- Includes complete project details, builder information, and latest 3 submission entries
- Phone numbers are clickable (tel: links) in PDF for mobile devices
- Emails are clickable (mailto: links) for quick composition

**UI Location**:
Located within Submission & Followup tab, above the search bar

**Print Format**:
- Project name and address
- Builder Phone (clickable in PDF)
- Builder Address
- Builder Email (clickable in PDF)
- Project Contact name, phone, email
- Win/Loss status, Bid Date, Sent Date, Design Drawing Date
- Bid Value, Agreed Value, Distance to Office, Notes
- Latest 3 submission entries with contact method, notes, timestamp
- Builder details indented 10 spaces for visual separation

**Technical Implementation**:
- `printFollowupSheet()`: Opens print preview window with HTML generation
- `downloadFollowupSheetPdf()`: Generates downloadable PDF using jsPDF library
- Filters bids by account manager and status
- Fetches latest 3 submission entries per project
- Formats contact information with clickable links

**Files Modified**:
- `src/pages/Bids.tsx`: Print/PDF functions and UI controls

### Bid Board Display Improvements

**Date**: 2026-02-09

**Overview**:
Improved bid date display formatting in Bid Board for better readability.

**Changes**:
- Bid Date and Sent Date now display on two separate lines
- Format: "02/06" on first line, "[+4]" (days ago) on second line
- Previous format was single line: "02/06 [+4]"

**Implementation**:
- Added `formatDateYYMMDDParts()` helper function to split date and days-ago into separate strings
- Updated Bid Board table cells to render dates vertically

**Files Modified**:
- `src/pages/Bids.tsx`: Date formatting in Bid Board table

---

## Latest Updates (v2.25)

### Cost Estimate: Driving Cost Calculation and Labor Book Improvements

**Date**: 2026-02-06

**Overview**:
Enhanced the Cost Estimate tab with automated driving cost calculations based on total man-hours and distance to office, plus improved labor book application workflow.

#### Driving Cost Calculation

**Feature**: Automatic calculation of driving costs based on job parameters.

**How It Works**:
- Formula: (Total Man Hours / Hours Per Trip) × Rate Per Mile × Distance to Office
- Example: 40 hrs / 2 hrs/trip × $0.70/mi × 50 miles = $700

**Features**:
- Editable rate per mile (default: $0.70)
- Editable hours per trip (default: 2.0 hours)
- Displays distance to office from bid data
- "Edit Bid" button for quick distance updates
- Automatically included in labor total and grand total
- Appears in Summary section and PDF exports

**UI Location**:
Yellow-highlighted "Driving Cost Parameters" section appears after the labor hours table in Cost Estimate tab.

**Database**:
- Added `driving_cost_rate` column to `cost_estimates` table
- Added `hours_per_trip` column to `cost_estimates` table
- Migration: `add_cost_estimate_driving_cost_fields.sql`

**Technical Details**:
- Values persist per cost estimate
- Updates save to database with other cost estimate changes
- PDF export includes driving cost breakdown
- Submission preview calculations include driving cost in margins

#### Labor Book Application Improvements

**Enhancement**: Streamlined workflow for applying labor book templates to cost estimates.

**Features**:
- "Apply matching Labor Hours" button moved to top-right header (next to Print button)
- Auto-selects first labor book version when opening Cost Estimate tab
- One-click application (no confirmation dialogs)
- Blue button styling matches "Apply matching Fixture Templates" pattern
- Success message appears inline next to button
- Button only visible when labor book is selected

**Smart Matching**:
- Only updates fixtures that match entries in the selected labor book
- Non-matching fixtures preserve their existing hours or fall back to system defaults
- Uses fixture name and alias name matching (case-insensitive)

**Fallback Logic**:
When creating new labor rows:
1. First attempts to use hours from selected labor book
2. Falls back to `fixture_labor_defaults` table for non-matching fixtures
3. Defaults to 0 only if fixture exists in neither source

**Impact**:
- Faster workflow - button always visible and ready to use
- Consistent UX - matches takeoffs tab pattern
- Safer - preserves non-matching fixture hours
- Better discoverability - prominent header placement

#### Pricing Tab: Searchable Price Book Features

**Enhancement**: Added search functionality to price book entries and assignments for faster navigation and entry creation.

**Features Added**:

##### 1. Price Book Entries Search

**Location**: Pricing tab, price book management section (below price book dropdown)

**Features**:
- Search input field filters price book entries in real-time by fixture/tie-in name
- Case-insensitive matching
- Table updates instantly as you type
- When no matches found, displays "No entries match '{search term}'" message
- "Add to Price Book" button appears when no matches exist
- Clicking the button opens the entry form modal with fixture name pre-filled

**Usage Example**:
1. Select a price book
2. Type "toilet" in search - only "Toilet", "Toilet ADA", etc. appear
3. Type "bidet" (if not in price book) - "Add 'bidet' to Price Book" button appears
4. Click button - form opens with "bidet" already filled in

##### 2. Searchable Assignment Dropdowns

**Location**: Pricing tab, fixture assignment table (when comparing costs to price book)

**Old Behavior**: Standard dropdown requiring scrolling through all entries

**New Behavior**: Searchable input field with dropdown results

**Features**:
- Click input field to open dropdown showing all price book entries
- Type to filter entries in real-time
- Matching entries appear in dropdown below input
- Click entry to assign it to the fixture
- When assigned, entry name displays in input field
- Clear button (×) appears to remove assignment
- Dropdown closes when clicking outside

**No Matches Flow**:
- Type fixture name that doesn't exist in price book
- Shows "No matches for '{search term}'" message
- "Add '{search term}' to Price Book" button appears in dropdown
- Click button to open entry form with name pre-filled
- After saving new entry, can immediately assign it

**Technical Implementation**:
- Per-row search state tracking
- Click-outside handler to close dropdowns
- Real-time filtering with case-insensitive matching
- Hover effects on dropdown items
- Disabled state support during save operations

**Benefits**:
- Faster assignment workflow - no scrolling through long lists
- Quick creation of missing entries without leaving the assignment flow
- Consistent search experience across price book management and assignments
- Reduced errors from similar fixture names
- Better UX for price books with many entries

**Usage Tips**:
- Start typing immediately when field is focused
- Use clear button (×) to quickly reassign a fixture
- Create new entries on-the-fly when needed
- Dropdown shows all entries when field is empty

---

## Latest Updates (v2.25)

### Cost Estimate: Driving Cost Calculation and Labor Book Improvements

**Date**: 2026-02-06

**Overview**:
Enhanced the Cost Estimate tab with automated driving cost calculations and streamlined labor book application workflow.

#### Driving Cost Calculation

**Feature**: Automatic calculation of driving costs based on job parameters and editable cost factors.

**How It Works**:
- **Formula**: (Total Man Hours ÷ Hours Per Trip) × Rate Per Mile × Distance to Office
- **Example**: 40 hrs ÷ 2 hrs/trip × $0.70/mi × 50 miles = $700 driving cost

**Editable Parameters**:
- **Rate per mile**: Default $0.70, adjustable per estimate
- **Hours per trip**: Default 2.0 hours, adjustable per estimate
- Parameters persist with the cost estimate when saved

**UI Features**:
- Yellow-highlighted "Driving Cost Parameters" section after labor table
- Displays current distance to office from bid data
- "Edit Bid" button for quick access to update distance
- Real-time calculation display showing trips, rate, distance, and total cost
- Shows "Distance to office: Not set" when no distance is configured

**Summary Integration**:
- Driving cost appears as separate line item in Summary section
- Included in "Labor total" (Labor + Driving)
- Incorporated into Grand total calculation
- Format: `Driving: $700.00` (always visible, shows $0.00 if no distance)

**PDF Export**:
- Driving cost calculation included in Cost Estimate PDF
- Shows breakdown: "Driving cost: 20.0 trips × $0.70/mi × 50mi = $700.00"
- Appears in summary table with Labor and Materials totals
- Included in Submission & Followup preview calculations for margin analysis

**Database Changes**:
- Table: `cost_estimates`
- New columns: `driving_cost_rate` (NUMERIC(10,2), default 0.70), `hours_per_trip` (NUMERIC(10,2), default 2.0)
- Migration file: `supabase/migrations/add_cost_estimate_driving_cost_fields.sql`

#### Labor Book Application Workflow

**Enhancement**: Streamlined labor book template application with better visibility and user experience.

**Button Placement**:
- Moved to top-right header next to Print button (previously below labor rate input)
- Renamed to "Apply matching Labor Hours" for consistency with Takeoffs tab
- Blue styling matching "Apply matching Fixture Templates" pattern
- Compact size (0.35rem × 0.75rem padding)

**Auto-Selection**:
- First labor book version automatically selected when opening Cost Estimate tab
- Preserves any previously saved labor book selection for the bid
- Button immediately clickable without manual selection

**Simplified Workflow**:
- One-click operation (no confirmation dialogs)
- Success message appears inline next to button
- Shows "Applying..." state while processing
- Green success message displays for 3 seconds after completion

**Smart Matching Behavior**:
- Only updates fixtures that exist in the selected labor book
- Matches by fixture name and alias names (case-insensitive)
- Non-matching fixtures remain unchanged

**Fallback Logic for New Fixtures**:
When adding new fixtures to cost estimate:
1. Uses hours from selected labor book if fixture matches
2. Falls back to `fixture_labor_defaults` table for non-matching fixtures (e.g., Toilet: 1/1/1 hrs)
3. Defaults to 0 only if fixture not found in either source

**Technical Details**:
- Function: `applyLaborBookHoursToEstimate()` (line 2005)
- Sync function: `loadCostEstimateLaborRowsAndSync()` (line 1082)
- Auto-selection logic in Cost Estimate tab useEffect (line 3326)
- Button only visible when labor rows exist and labor book is selected

**Benefits**:
- More discoverable - prominent header placement
- Faster workflow - auto-selection and one-click application
- Consistent UX - matches patterns from other tabs
- Safer - preserves non-matching fixture hours using fallback defaults
- Better visibility - success feedback right at the button

---

## Latest Updates (v2.24)

### Materials Price Book: Performance, Search, and Bulk Editing Enhancements

**Date**: 2026-02-05

**Overview**:
Major performance improvements and workflow enhancements for the Materials Price Book, including server-side search across all parts, infinite scroll, "Load All" mode for bulk editing, and comprehensive supply house statistics.

#### Supply House Statistics in Modal

**Enhancement**: Global materials statistics now appear at the top of the Supply Houses modal.

**Features**:
- Total parts count across entire database
- Percentage of parts with prices
- Percentage of parts with multiple prices
- Per-supply-house price coverage sorted by count (highest first)
- Stats refresh automatically every time the modal is opened

**Benefits**:
- Quick visibility into pricing coverage across all supply houses
- Identify which supply houses need more pricing data
- See comprehensive stats without leaving supply house management

**Database**:
- New SQL function: `get_supply_house_price_counts()` 
- Efficiently counts prices per supply house using LEFT JOIN
- Returns all supply houses including those with 0 prices
- Migration: `create_supply_house_stats_function.sql`

---

#### Server-Side Search Across All Parts

**Enhancement**: Search box now queries the entire database, not just the current page.

**How It Works**:
- Search queries filter parts server-side using Supabase `.ilike` (case-insensitive)
- 300ms debounce prevents excessive queries while typing
- Searches across name, manufacturer, fixture type, and notes fields
- Pagination continues to work with filtered results
- Fixture type and manufacturer filters also work server-side

**Benefits**:
- Find any part in the database instantly
- No need to paginate through pages to find a specific part
- Efficient database queries instead of loading everything

**Technical Details**:
- Modified `loadParts()` to accept search/filter options
- Applies filters before pagination with `.or()` query
- Debounced `useEffect` triggers reload on search/filter changes

---

#### Infinite Scroll Pagination

**Enhancement**: Parts automatically load as you scroll to the bottom of the page.

**Features**:
- Loads next 50 parts when within 200px of page bottom
- Shows loading indicator: "Loading more parts…" or "Scroll down to load more"
- Prevents duplicate requests when scrolling quickly
- Only active on Price Book tab
- Respects current search and filter state

**Benefits**:
- No manual button clicking needed
- Seamless browsing experience
- Faster navigation through large part lists

**Technical Details**:
- Window scroll event listener with distance calculation
- `loadingPartsRef` prevents race conditions
- Automatically disabled in "Load All" mode

---

#### Server-Side Sorting by Price Count

**Enhancement**: Clicking the "#" column header now sorts all parts in the database by price count.

**How It Works**:
- Database function counts and sorts all parts by price count
- Returns ordered part IDs to frontend
- Frontend fetches only the needed page of parts in correct order
- Maintains pagination while ensuring global sort order

**Benefits**:
- See which parts need pricing across entire database
- Quickly identify parts with 0 prices
- Efficient sorting without loading all data client-side

**Database**:
- New SQL function: `get_parts_ordered_by_price_count(ascending_order)`
- Uses LEFT JOIN and COUNT aggregation
- Migration: `create_parts_with_price_count_function.sql`

**Technical Details**:
- When sorting is active, uses RPC to get ordered part IDs
- Fetches parts by ID for current page
- Maintains sort order from database

---

#### "Load All" Mode for Bulk Editing

**Enhancement**: New toggle mode that loads all parts at once with instant client-side search.

**Features**:
- **Toggle button**: Speed icon (triangle SVG) next to filter dropdowns
- **Progressive loading**: Shows "Loading all parts... (X loaded)" with count
- **Instant search**: Client-side filtering with no network delay
- **Client-side sorting**: Click "#" to sort all loaded parts immediately
- **Visual indicators**: 
  - Button turns blue when active
  - Search box background turns light blue
  - Search placeholder changes to "Search all parts (instant)..."
- **Default mode**: Load All mode is enabled by default for optimal bulk editing workflow

**How It Works**:
- Fetches all parts from database in batches of 50
- Loads prices for each part progressively
- Stores all parts in `allParts` state array
- Search and sort happen client-side (instant)
- Toggle button switches between Load All and paginated modes

**Benefits**:
- Perfect for assistants doing bulk price updates
- Instant search across all parts (no waiting)
- No pagination interruption when editing multiple parts
- Fast sorting without server calls
- Can still toggle to paginated mode if needed

**Technical Details**:
- `loadAllParts()` function with batched loading
- Separate `clientSearchQuery` state for instant filtering
- `displayParts` computed with client-side filtering and sorting
- Fixture type/manufacturer filters disabled in Load All mode
- Infinite scroll automatically disabled in Load All mode

**Dependencies**:
- Installed `@tanstack/react-virtual` (available for future virtual scrolling optimization)

---

#### Summary of Changes

**Migrations Created (2)**:
1. `create_supply_house_stats_function.sql` - Supply house price counting and sorting
2. `create_parts_with_price_count_function.sql` - Parts sorting by price count

**Code Files Modified (2)**:
1. `src/pages/Materials.tsx` - All performance and UX enhancements
2. `src/pages/Bids.tsx` - Fixed TypeScript null checks in `formatAddressWithoutZip()`

**Key Functions Added/Modified**:
1. `loadGlobalPriceBookStats()` - Uses RPC for accurate supply house counts
2. `loadParts()` - Accepts search/filter/sort options, applies server-side
3. `loadAllParts()` - Loads all parts in batches with progress indicator
4. `openSupplyHousesModal()` - Refreshes stats when modal opens
5. `displayParts` - Smart calculation for Load All vs paginated mode

**State Variables Added**:
- `loadAllMode` - Tracks bulk editing mode
- `allParts` - Stores all parts when loaded
- `loadingAllParts` - Loading state for bulk load
- `clientSearchQuery` - Separate search for instant filtering
- `loadingPartsRef` - Prevents duplicate pagination requests

**Impact**:
- ✅ Search works across all 1000+ parts in database
- ✅ Infinite scroll eliminates manual "Load more" clicking
- ✅ Sorting by "#" works globally, not just per page
- ✅ Supply house stats show accurate counts for all supply houses
- ✅ "Load All" mode enables rapid bulk editing workflows
- ✅ Fixed bug where supply houses showed 0 prices due to row limits
- ✅ Supply houses sorted by price count (most prices first)
- ✅ All changes work seamlessly together

**Performance Characteristics**:
- Normal mode: Loads 50 parts at a time (fast initial load)
- Load All mode: Loads all parts in 10-30 seconds (instant search after)
- Server-side operations: Efficient database queries with proper indexing
- Client-side operations: Fast filtering/sorting on loaded data

**Backward Compatibility**:
All changes are backward compatible. Users can toggle between paginated and Load All modes at any time.

---

## Latest Updates (v2.23)

### Bids Submissions and Followup UI Improvements

**Date**: 2026-02-04

**Overview**:
Streamlined the Submissions and Followup section of the Bids page with more concise labels and enhanced data display for better readability and quick scanning.

#### Label Updates

**Simplified Column Headers**:
- "Time to/from bid due date" → "Bid Date"
- "Bid Due Date" → "Bid Date" (applied across all bid tables)
- "Time since last contact" → "Last Contact"
- "Estimated Job Start Date" → "Start Date"

**Benefits**:
- More concise headers save space
- Easier to scan at a glance
- Consistent naming across all tables

---

#### Compact Date Formats

**Bid Date Time Display** (Unsent and Pending Follow-up tables):

Changed from verbose text to concise +/- notation:
- **Old format**: "1 day since deadline", "2 days until due", "Due today"
- **New format**: "+1", "-2", "-0"

**Logic**:
- Negative numbers indicate days until deadline (e.g., "-15" means 15 days until bid is due)
- Positive numbers indicate days past deadline (e.g., "+5" means 5 days overdue)
- "-0" indicates due today

**Start Date Display** (Won Bids table):

Shows both the date and countdown/countup:
- **Format**: "MM/DD [±X]"
- **Examples**:
  - "04/15 [-15]" = April 15, starting in 15 days
  - "03/01 [+10]" = March 1, started 10 days ago
  - "02/05 [-0]" = February 5, starting today

**Benefits**:
- Quick visual scanning for urgency
- No mental math required to assess timelines
- Consistent format across both date columns

---

#### Bid Values in Project Names

**Enhancement**: Bid values now display in thousands next to project names across all Submissions and Followup tables.

**Format**: "Project Name (X.X)" where the number represents bid value in thousands

**Examples**:
- Bid value $3,800: "Gibbs Residence Grinder Pump (3.8)"
- Bid value $11,700: "Project Name (11)" ← No decimal for values ≥ $10k
- Bid value $500: "Project Name (0.5)"
- No bid value: "Project Name" (no suffix)

**Smart Decimal Formatting**:
- Values under $10k: Show 1 decimal (e.g., 3.8, 9.5)
- Values $10k and above: No decimal (e.g., 11, 25, 150)

**Benefits**:
- Quickly assess bid size without opening each bid
- Prioritize larger opportunities at a glance
- Cleaner display for large values

---

#### Won Bids Sorting

**Enhancement**: Won bids are now automatically sorted by start date in ascending order.

**Behavior**:
- Jobs starting soonest appear at the top
- Jobs further out appear below
- Jobs without start dates appear at the end

**Benefits**:
- Easy to identify which won projects need immediate attention
- Better scheduling visibility
- Logical ordering for project planning

---

#### Summary of Changes

**Modified Files**:
- `src/pages/Bids.tsx`

**Functions Modified/Created**:
1. `formatTimeSinceDueDate()` - Updated to return "+X" or "-X" format
2. `formatDateYYMMDD()` - Enhanced to show "MM/DD [±X]" with countdown
3. `formatBidNameWithValue()` - New function to append bid value in thousands

**Impact**:
- 9 label updates for consistency
- 3 formatting functions improved
- 5 submission tables enhanced with bid values
- 1 table sorted by relevance

All changes maintain backward compatibility and require no database modifications.

---

## Latest Updates (v2.22)

### Comprehensive Database Layer Improvements

**Date**: 2026-02-04

**Overview**:
Major systematic improvements to the database layer addressing timestamp management, data integrity, transaction handling, and error recovery. These changes make the application more robust, maintainable, and prevent data corruption.

#### 1. Automatic `updated_at` Timestamp Management

**What Changed**:
- Added database triggers to automatically set `updated_at` on all UPDATE operations
- Covers 20 tables: bids, customers, projects, material_parts, purchase_orders, workflow_steps, and 14 others
- Removed 9 manual timestamp sets from frontend code (Settings, Bids, People pages)

**Benefits**:
- Eliminates developer errors and forgotten timestamps
- Ensures consistency across all updates
- Cleaner, more maintainable code
- Automatic and transparent to application code

**Technical Details**:
- Created reusable trigger function `update_updated_at_column()`
- Applied BEFORE UPDATE triggers to all tables with `updated_at` columns
- Migration: `add_updated_at_triggers.sql`

---

#### 2. Cascading Update Triggers

**What Changed**:
- Customer master ownership changes now automatically cascade to all their projects
- Maintains data consistency between customers and projects

**Benefits**:
- No orphaned projects with wrong master assignment
- Automatic synchronization eliminates manual updates
- Prevents data integrity issues

**Technical Details**:
- Trigger function: `cascade_customer_master_to_projects()`
- Automatically updates `project.master_user_id` when `customer.master_user_id` changes
- Migration: `add_cascading_customer_master_to_projects.sql`

---

#### 3. Data Integrity Constraints

**What Changed**:
Added database-level constraints to prevent invalid data:
- **Positive quantities**: Purchase order items must have `quantity > 0`
- **Non-negative counts**: Bid count rows must have `count >= 0`
- **Non-negative prices**: Material prices and PO prices must be `>= 0`
- **Unique parts per template**: Same part cannot be added twice to a template
- **Improved cascading**: Project master user FKs now use `ON DELETE SET NULL`

**Benefits**:
- Prevents data corruption at database level
- Clear error messages for validation failures
- Enforces business rules consistently
- Catches errors before they propagate

**Technical Details**:
- 4 CHECK constraints for validation
- 1 partial unique index on `material_template_items(template_id, part_id)`
- Cleaned up 1 duplicate data entry during migration
- Migration: `add_data_integrity_constraints.sql`

---

#### 4. Atomic Transaction Functions

**What Changed**:
Created 4 database functions for complex multi-step operations with automatic rollback:

**4a. `create_project_with_template`**
- Atomically creates project, workflow, and all steps from template
- All-or-nothing operation - if any step fails, entire operation rolls back
- Parameters: name, customer_id, address, master_user_id, template_id, notes
- Returns: `{project_id, workflow_id, success}`

**4b. `duplicate_purchase_order`**
- Atomically duplicates PO with all items as a draft
- Guaranteed no orphaned PO if item copying fails
- Parameters: source_po_id, created_by
- Returns: `{new_po_id, items_copied, success}`

**4c. `copy_workflow_step`**
- Atomically copies step and updates sequence order
- No gaps or inconsistencies in sequence numbers
- Parameters: step_id, insert_after_sequence
- Returns: `{new_step_id, new_sequence, success}`

**4d. `create_takeoff_entry_with_items`**
- Atomically creates takeoff entry with multiple items
- Parameters: bid_id, page, entry_data, items
- Returns: `{entry_id, items_created, success}`

**Benefits**:
- Guaranteed all-or-nothing operations (no partial data on failures)
- Automatic rollback eliminates cleanup code
- Reduced network round-trips
- Better performance for multi-step operations

**Technical Details**:
- All functions use PL/pgSQL with EXCEPTION handlers
- SECURITY DEFINER to run with proper permissions
- Migration: `create_transaction_functions.sql`

**Usage Example**:
```typescript
// Call from frontend using Supabase RPC
const { data, error } = await supabase.rpc('create_project_with_template', {
  p_name: 'New Project',
  p_customer_id: customerId,
  p_address: '123 Main St',
  p_master_user_id: userId,
  p_template_id: templateId,
  p_notes: 'Project notes'
})
```

---

#### 5. Frontend Error Handling Improvements

**What Changed**:
- Created comprehensive error handling utilities (`src/utils/errorHandling.ts`)
- Improved error handling in ProjectForm and Workflow delete operations
- Added retry logic for transient network/database failures

**New Utilities**:
- `withRetry()`: Automatic retry with exponential backoff
- `withSupabaseRetry()`: Type-safe Supabase operations with retry
- `checkSupabaseError()`: Consistent error checking
- `executeDeleteChain()`: Multi-step delete with proper error handling
- `DatabaseError`: Structured error handling class

**Benefits**:
- Resilient to transient failures
- Clear error messages for users
- Proper error propagation and logging
- Consistent error handling patterns

**Updated Files**:
- `src/pages/ProjectForm.tsx`: Improved delete operation with comprehensive error checking
- `src/pages/Workflow.tsx`: Added proper error handling to step deletion

**Usage Example**:
```typescript
import { withSupabaseRetry } from '@/utils/errorHandling'

// Automatically retries on transient failures
const users = await withSupabaseRetry(
  () => supabase.from('users').select('*'),
  'fetch users',
  { maxRetries: 3, initialDelay: 1000 }
)
```

---

#### 6. TypeScript Type Safety

**What Changed**:
- Created TypeScript interfaces for all database functions
- Added type-safe parameter and return types
- Created helper interface for RPC calls

**New File**: `src/types/database-functions.ts`

**Benefits**:
- Type safety for database function calls
- IntelliSense support in IDE
- Compile-time error detection
- Self-documenting code

**Usage Example**:
```typescript
import type { CreateProjectWithTemplateParams } from '@/types/database-functions'

const params: CreateProjectWithTemplateParams = {
  p_name: 'Project',
  p_customer_id: customerId,
  p_address: '123 Main St',
  p_master_user_id: userId
}
```

---

#### Summary of Changes

**Migrations Created (4)**:
1. `add_updated_at_triggers.sql` - 20 automatic timestamp triggers
2. `add_cascading_customer_master_to_projects.sql` - Cascading customer updates
3. `add_data_integrity_constraints.sql` - 4 constraints + 1 unique index
4. `create_transaction_functions.sql` - 4 atomic transaction functions

**Code Files Created (2)**:
1. `src/utils/errorHandling.ts` - Error handling utilities
2. `src/types/database-functions.ts` - TypeScript types

**Code Files Modified (5)**:
1. `src/pages/ProjectForm.tsx` - Improved error handling
2. `src/pages/Workflow.tsx` - Improved error handling
3. `src/pages/Settings.tsx` - Removed manual timestamps
4. `src/pages/Bids.tsx` - Removed manual timestamps
5. `src/pages/People.tsx` - Removed manual timestamps

**Documentation Created (2)**:
1. `DATABASE_FIXES_TEST_PLAN.md` - Comprehensive test plan
2. `DATABASE_IMPROVEMENTS_SUMMARY.md` - Complete implementation summary

**Impact**:
- ✅ 20 tables with automatic timestamp management
- ✅ 4 new check constraints preventing invalid data
- ✅ 1 unique constraint preventing duplicates
- ✅ 1 cascading trigger maintaining consistency
- ✅ 4 atomic database functions eliminating partial failures
- ✅ Improved error handling preventing silent failures
- ✅ Removed 9 manual timestamp sets
- ✅ Added comprehensive retry logic

**Backward Compatibility**:
All changes are backward compatible. Existing code continues to work unchanged. The new database functions are optional enhancements available for gradual adoption.

---

## Latest Updates (v2.21)

### Materials Price Book: Fixed Missing Prices in Expanded Row

**Date**: 2026-02-04

**Issue**:
- Prices added or updated via the "Edit prices" modal were not appearing in the expanded row details
- Prices would briefly appear after closing the modal, then disappear
- The "Edit prices" modal showed all prices correctly
- Problem affected parts with prices beyond the cheapest 1,000 prices across the entire database

**Root Cause**:
- The `loadParts()` function was loading ALL prices for ALL parts in a single query
- Supabase has a default 1,000-row limit per query
- With 1,241+ total prices in the database, prices beyond row 1,000 were being truncated
- The "Edit prices" modal worked correctly because it filtered by `part_id` first, loading only that specific part's prices

**Solution**:
- Changed `loadParts()` to load prices per-part instead of loading all prices at once
- Uses `Promise.all()` to load prices for each part in parallel
- Each part's query filters by `part_id` first: `.eq('part_id', part.id)`
- Matches the same query pattern used by the working "Edit prices" modal

**Benefits**:
- No row limit issues (each part's prices are loaded separately)
- Consistent behavior between expanded row and modal
- Scales to any number of total prices in the database
- Better performance with parallel loading

**Files modified**:
- `src/pages/Materials.tsx` (lines 194-217) - Changed `loadParts()` from single bulk query to per-part parallel queries
- `src/pages/Settings.tsx` (lines 256, 280) - Fixed TypeScript errors in orphaned prices feature

---

## Latest Updates (v2.20)

### Takeoff Book: Aliases, Multiple Templates/Stages per Entry, Default Version Selection

**Date**: 2026-02-04

**Changes**:

- **Takeoff Book entries – additional names (aliases)**
  - Takeoff Book entries can include optional **additional names** (comma-separated) that match count rows’ **Fixture or Tie-in** (case-insensitive).
  - When applying the Takeoff Book, a count row matches if its Fixture or Tie-in equals the entry’s primary name or any alias.
- **Takeoff Book entries – multiple Templates & Stages per entry**
  - A single Takeoff Book entry (one Fixture or Tie-in + aliases) can now have **multiple (Template, Stage)** pairs.
  - Entry form supports adding/removing multiple Template/Stage rows.
  - Applying the Takeoff Book adds mappings for **each** Template/Stage pair on a matching entry.
- **Takeoff book version default**
  - When a bid has no takeoff book version selected, the Takeoffs tab will default to the version named **“Default”** (and persist that choice to the bid).

**Database**:
- Added `takeoff_book_entries.alias_names` (TEXT[], default `'{}'`).
- Added `takeoff_book_entry_items` (Template/Stage pairs per entry) and migrated existing `takeoff_book_entries.template_id`/`stage` into items; `template_id` and `stage` are now stored on items instead of entries.

**Files modified**:
- `src/pages/Bids.tsx` – Takeoff Book entry form supports alias names and multiple Template/Stage rows; apply logic loads entries + items; default version selection to “Default” when unset.
- `src/types/database.ts` – Updated `takeoff_book_entries`; added `takeoff_book_entry_items`.

**Files added**:
- `supabase/migrations/add_takeoff_book_entries_alias_names.sql`
- `supabase/migrations/add_takeoff_book_entry_items.sql`

### Materials Price Book improvements

- Price details are now visible inline when you expand a part: you see notes (SKU, etc.), a `$price SupplyHouse` list for all prices, and an **Edit prices** button directly beneath the list.
- The Best Price column hides the “No prices” label when a part has no prices (the cell is blank), making the table easier to scan.
- You can click the `#` column header to sort parts by how many prices they have (fewest first), with a small arrow indicator showing when that sort is active.
- A new **Supply house price coverage** summary at the bottom shows each supply house name and how many prices are defined for it.

### Settings cleanup

- The **Sign out** and **Change password** actions have been moved into the Settings header as buttons, instead of separate boxes.
- The dev-only **Force Check Prices** maintenance button has been removed; Materials now refreshes prices automatically after you add, edit, or delete prices in the Part Prices Manager.

---

## Latest Updates (v2.19)

### Submission & Followup: Clickable GC/Builder, All-bids Modal, Navigation Buttons

**Date**: 2026-02-04

**Changes**:

- **Clickable GC/Builder (customer) in Submission & Followup tables**
  - In **Not yet won or lost**, **Won**, and **Started or Complete**, the GC/Builder (customer) cell is clickable and opens the existing Customer / GC Builder modal.
- **Customer / GC Builder modal: “All bids” list with status**
  - The modal now includes an **All bids** section showing each bid and its computed status:
    - Unsent
    - Not yet won or lost
    - Won
    - Started or Complete
    - Lost
- **Submission & Followup navigation buttons**
  - **Up-arrow** next to the row Edit/settings button scrolls back to the selected-bid summary at the top.
  - **Down-arrow** near the Approval PDF area scrolls to the selected bid’s row in the correct table section and auto-expands that section if collapsed.
- **Copy update (PO / templates)**
  - Updated instruction text to mention staged billing: “Materials broken down by stage allows for staged billing.”

**Files modified**:
- `src/pages/Bids.tsx` – Clickable GC/Builder cells, “All bids” modal sections, status helper, up/down scroll buttons, and small copy update.

---

## Latest Updates (v2.18)

### Bid outcome: Started or Complete

**Date**: 2026-02-03

**Changes**:

- Added a new bid outcome **Started or Complete** and a dedicated collapsible section in Submission & Followup between Won and Lost.
- Bid Board Win/Loss column shows “Started or Complete” when applicable.

**Database**:
- Updated `bids.outcome` constraint via `supabase/migrations/add_bids_outcome_started_or_complete.sql`.

**Files modified**:
- `src/pages/Bids.tsx`
- `src/types/database.ts`

---

## Latest Updates (v2.17)

### Labor Book: Multiple Fixture/Tie-in Names (Aliases)

**Date**: 2026-02-03

**Changes**:

- Labor Book entries can include optional **additional names** (aliases) that match count rows’ Fixture or Tie-in (case-insensitive); first match wins by entry order.

**Database**:
- Added `labor_book_entries.alias_names` via `supabase/migrations/add_labor_book_entries_alias_names.sql`.

**Files modified**:
- `src/pages/Bids.tsx`
- `src/types/database.ts`

---

## Latest Updates (v2.16)

### Dev Feature: Set User Password

**Date**: 2026-02-03

**Changes**:

- Devs can set another user’s password from Settings (modal + confirmation).
- Added Edge Function `set-user-password` with dev-role enforcement and password validation.

**Files modified**:
- `src/pages/Settings.tsx`

**Files added**:
- `supabase/functions/set-user-password/index.ts`

---

## Latest Updates (v2.15)

### Cover Letter and Edit Bid Modal

**Date**: 2026-02-02

**Changes**:

- **Cover Letter tab**
  - **Default Inclusions**: Textarea and combined document are pre-filled with **"Permits"** when the user has not entered custom inclusions. Constant `DEFAULT_INCLUSIONS`.
  - **Default Exclusions**: Textarea and combined document are pre-filled with four lines when empty: concrete cutting/removal/pour back excluded; impact fees excluded; work not specifically described excluded; electrical, fire protection, fire alarm, drywall, framing, architectural finishes excluded. Constant `DEFAULT_EXCLUSIONS`.
  - **Default Terms and Warranty**: Textarea and combined document are pre-filled with the full default paragraph (workmanlike manner, one-year workmanship warranty, material warranty, no warranty on customer materials, contingencies, 30-day acceptance, Click Plumbing void option, extra charges for alterations/rock/debris). Constant `DEFAULT_TERMS_AND_WARRANTY`. When the user clears the field, the combined document still shows this default.
  - **Labels**: "Terms and Warranty (collapsible)" → **"Terms and Warranty"**; "Exclusions and Scope (one per line)" → **"Exclusions and Scope (one per line, shown as bullets)"**.
  - **Project section**: At the top of the Cover Letter (and in the combined document), **Project** shows **Project Name** then **Project Address** (two lines only). Data from `bid.project_name` and `bid.address`.
  - **Edit bid button**: When a bid is selected in the Cover Letter tab, the header now has an **"Edit bid"** button (next to Close) that opens the Edit Bid modal for that bid.

- **Edit Bid modal**
  - **Field order**: **Project Name \*** is the first field at the top of the form. **Project Address** (renamed from "Address") is the second field, directly below Project Name.
  - Remaining fields follow: Project Folder, Job Plans, GC/Builder, Project Contact Name/Phone/Email, Estimator, Bid Due Date, etc.

**Files modified**:
- `src/pages/Bids.tsx` – Cover Letter: `DEFAULT_INCLUSIONS`, `DEFAULT_EXCLUSIONS`, `DEFAULT_TERMS_AND_WARRANTY`; pre-filled textareas and combined document logic; Project section (name + address); Edit bid button. Edit Bid modal: Project Name and Project Address at top; label "Address" → "Project Address".

---

## Latest Updates (v2.14)

### Cost Estimate Tab: Labor Book and Version Prefill

**Date**: 2026-02-01

**Changes**:

- **Labor book (Cost Estimate tab)**
  - **Labor book versions**: Create, edit, and delete named labor book versions. Each version has a list of entries.
  - **Labor book entries**: Per version, add/edit/delete fixture or tie-in entries with hours per stage: Rough In, Top Out, Trim Set. Each entry has a primary name and optional **additional names** (aliases); if any name matches a count row's Fixture or Tie-in (case-insensitive), that labor rate is applied. Entries ordered by sequence and fixture name.
  - **Bid-level version selection**: Each bid can have a selected labor book version (`selected_labor_book_version_id`). A "Labor book version" dropdown on the Cost Estimate tab (when a bid is selected) lets you choose a version or "— Use defaults —".
  - **Prefill for new labor rows**: When syncing cost estimate labor rows from count rows, **new** labor rows get hours from the selected labor book version's entries (match by primary name or any alias). If no version is selected, or a fixture has no matching entry, the app uses global `fixture_labor_defaults` (or 0). Existing labor rows are not overwritten when the version changes.

**Database**:
- **`labor_book_versions`**: `id`, `name`, `created_at`. RLS: dev, master_technician, assistant, estimator (full CRUD).
- **`labor_book_entries`**: `id`, `version_id` (FK, CASCADE), `fixture_name`, `alias_names` (TEXT[], optional additional names for same rate), `rough_in_hrs`, `top_out_hrs`, `trim_set_hrs`, `sequence_order`, `created_at`. Unique `(version_id, fixture_name)`. RLS: same roles.
- **`bids.selected_labor_book_version_id`**: Nullable FK to `labor_book_versions` (ON DELETE SET NULL).

**Files modified**:
- `src/types/database.ts` – Added `labor_book_versions`, `labor_book_entries`; extended `bids` with `selected_labor_book_version_id`.
- `src/pages/Bids.tsx` – Cost Estimate tab: labor book state, loaders, version dropdown, sync prefill from labor book, Labor Book management (versions + entries CRUD, modals).
- `src/pages/Settings.tsx` – Bids backup export includes price book (`price_book_versions`, `price_book_entries`), labor book (`labor_book_versions`, `labor_book_entries`), takeoff book (`takeoff_book_versions`, `takeoff_book_entries`), and full `purchase_orders` and `purchase_order_items` (all rows under RLS, including Takeoffs-created POs).

**Files added**:
- `supabase/migrations/create_labor_book_versions_and_entries.sql` – Creates `labor_book_versions` and `labor_book_entries` with RLS; seeds one "Default" version and sample entries.
- `supabase/migrations/add_bids_selected_labor_book_version.sql` – Adds `bids.selected_labor_book_version_id` column.

---

## Latest Updates (v2.13)

### Pricing Tab: Price Book and Margin Comparison

**Date**: 2026-02-01

**Changes**:

- **Pricing tab – full implementation**
  - **Price book versions**: Create, edit, and delete named price book versions. Each version has a list of entries.
  - **Price book entries**: Per version, add/edit/delete fixture or tie-in entries with prices per stage: Rough In, Top Out, Trim Set, and Total. Entries ordered by sequence and fixture name.
  - **Bid margin comparison**: Select a bid and a price book version. For each count row (fixture) on the bid, assign a price book entry (dropdown). Compare our cost (labor + allocated materials) to price book revenue; show margin % and flag: red (&lt; 20%), yellow (&lt; 40%), green (≥ 40%). Totals row shows total cost, total revenue, overall margin %, and overall flag.
  - **Cost allocation**: Per-fixture labor cost from cost estimate labor rows; materials allocated to fixtures proportionally by labor hours. Margin = (revenue − cost) / revenue.
  - **Version persistence**: Selected price book version for a bid is stored on the bid (`selected_price_book_version_id`) and restored when reopening the Pricing tab.
  - **Create Cost Estimate prompt**: If the selected bid has count rows but no cost estimate, a message and "Go to Cost Estimate" button are shown so the user can create one first.

**Database**:
- **`price_book_versions`**: `id`, `name`, `created_at`. RLS: dev, master_technician, assistant, estimator (full CRUD).
- **`price_book_entries`**: `id`, `version_id` (FK, CASCADE), `fixture_name`, `rough_in_price`, `top_out_price`, `trim_set_price`, `total_price`, `sequence_order`, `created_at`. Unique `(version_id, fixture_name)`. RLS: same roles.
- **`bid_pricing_assignments`**: `id`, `bid_id` (FK, CASCADE), `count_row_id` (FK to `bids_count_rows`, CASCADE), `price_book_entry_id` (FK, CASCADE). Unique `(bid_id, count_row_id)`. RLS: same as bids (access via bid).
- **`bids.selected_price_book_version_id`**: Nullable FK to `price_book_versions` (ON DELETE SET NULL).

**Files modified**:
- `src/types/database.ts` – Added `price_book_versions`, `price_book_entries`, `bid_pricing_assignments` table types; extended `bids` Row/Insert/Update with `selected_price_book_version_id`.
- `src/pages/Bids.tsx` – Pricing tab state and loaders; price book version/entry CRUD; bid pricing assignments; margin comparison table with assignment dropdowns and flags; version dropdown and "Go to Cost Estimate" prompt.

**Files added**:
- `supabase/migrations/create_price_book_versions_and_entries.sql` – Creates `price_book_versions` and `price_book_entries` with RLS.
- `supabase/migrations/create_bid_pricing_assignments.sql` – Creates `bid_pricing_assignments` with RLS.
- `supabase/migrations/add_bids_selected_price_book_version.sql` – Adds `bids.selected_price_book_version_id` column.

---

## Latest Updates (v2.12)

### Submissions Cost Estimate Indicator, Currency Formatting, Pricing Tab, Revert Migration

**Date**: 2026-02-01

**Changes**:

- **Submission & Followup – Cost estimate indicator and link**
  - When a bid is selected in the Submission & Followup tab, the bid preview panel now shows whether a cost estimate exists for that bid.
  - **Cost estimate:** Displays the computed grand total (materials + labor) with comma formatting (e.g. $12,345.67) when a cost estimate exists, or "Not yet created" when it does not. Loading state shows "Loading cost estimate info…".
  - **View cost estimate** / **Create cost estimate** button: Switches to the Cost Estimate tab and preselects the same bid so the user can view or create the cost estimate.

- **Cost estimate totals and Submission preview – Comma formatting**
  - Numbers over 999 now display with commas (e.g. $1,000.00, $12,345.67) in:
    - Cost Estimate tab: Rough In / Top Out / Trim Set materials, Total materials, Labor total line, Summary (Total materials, Labor total, Grand total).
    - Submission & Followup cost estimate preview (the amount shown next to "Cost estimate:").
  - New helper **`formatCurrency(n)`** in Bids.tsx uses `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.

- **Pricing tab**
  - New **Pricing** tab added between Cost Estimate and Cover Letter on the Bids page. Placeholder content: "Pricing – coming soon."

- **Revert migration (price book)**
  - Migration **`revert_price_book_and_bids_job_type.sql`** reverses previously applied price-book–related schema changes: drops `bid_pricing_assignments`, `price_book_entries`, `price_book_versions`, and the `bids.job_type` column. Use this if the price book feature was reverted in code but migrations had already been run.

**Files modified**:
- `src/pages/Bids.tsx` – `submissionBidHasCostEstimate` and `submissionBidCostEstimateAmount` state; `useEffect` to load cost estimate existence and amount for selected Submission bid; cost estimate indicator and View/Create button in Submission panel; `formatCurrency` helper; Cost Estimate tab and Submission preview use `formatCurrency`; Pricing tab (placeholder); `activeTab` type includes `'pricing'`.

**Files added**:
- `supabase/migrations/revert_price_book_and_bids_job_type.sql` – Drops price book tables and `bids.job_type` in dependency order.

---

## Latest Updates (v2.11)

### Bids UI, Counts, Takeoff, Purchase Orders

**Date**: 2026-01-31

**Changes**:

- **Bid Board**
  - **Edit column**: Header text hidden (only gear icon visible; `title` and `aria-label` kept for accessibility). Edit button wrapper styled invisible (no background/border/padding) so only the SVG icon shows.

- **Edit Bid modal**
  - **Cancel button** moved from bottom row to **top right**, next to the modal title.

- **New Bid modal**
  - **"Save and start Counts"** button (bottom left): Saves the bid and opens it in the Counts tab (creates or updates bid, then sets `activeTab` to counts and `selectedBidForCounts` to the saved bid).
  - **Project Name required**: Label shows "Project Name *"; client-side validation prevents save when empty and shows "Project Name is required."; input has `required` and clears error on change.

- **Counts tab**
  - **Search box** moved **below** the selected-bid panel (above the bids list table). Search bar is **full width** (`boxSizing: 'border-box'`).
  - **Column header**: "Project / GC" changed to **"Project Name"**.
  - **"Edit Bid" button** in tab header (next to Close) opens the Edit Bid modal for the selected bid.
  - **NewCountRow (add row)**:
    - **Fixture quick-select**: Buttons below Fixture input (Bathrooms, Kitchen, Laundry, Plumbing Fixtures, Appliances, etc.) populate the Fixture field when clicked.
    - **Number pad** below Count: digits 0–9, **C** (all clear), **0**, **Delete** (backspace); layout 1–9 then C, 0, Delete; centered.
    - **Combined inputs**: Fixture, Count, and Plan Page in a single cell (`colSpan={3}`), arranged horizontally; table headers **Fixture\***, **Count\***, **Plan Page**, **Actions** centered.
    - **Save** (renamed from "Add") and **Save and Add**: Save and Add saves the row, clears form, refreshes counts, keeps form open for another row; styled to match "Add row" (blue).
    - Fixture and Count are required (placeholders show "Fixture*", "Count*").

- **Takeoff tab**
  - **Full implementation** (replaces "Coming soon"): Select a bid; table maps fixture counts to material templates and quantities. **Create purchase order** creates a new draft PO from current mappings; **Add to selected PO** adds items to an existing draft PO (uses shared `materialPOUtils`: `expandTemplate`, `addExpandedPartsToPO`).
  - **Multiple templates per fixture**: Each fixture can have multiple template mappings (Add template / Remove per row); each mapping has a unique `id`.
  - **Template search**: Centered filter above table ("only show templates with these words", 360px width); template dropdowns use filtered options while always including selected templates.
  - **View purchase order**: After creating or adding to a PO, a "View purchase order" link appears; it navigates to `/materials` with `state.openPOId` so the Materials page opens the Purchase Orders tab and displays that PO. Materials page clears `location.state` after handling to avoid re-opening on refresh.

- **Cover Letter tab**
  - Content: "Cover Letter – coming soon" and "Until then, please use [BidTooling.com](https://BidTooling.com)" (link opens in new tab).

- **Purchase Orders (Materials page)**
  - **Grand Total**: `colSpan` in footer set to **5** for finalized POs; totals coerce `price_at_time` and `quantity` to number with NaN fallback to 0.
  - **With Tax row**: New row below Grand Total: label "With Tax", editable tax % (default 8.25, width 6rem), and calculated total (Grand Total × (1 + tax% / 100)); state `viewedPOTaxPercent`.
  - **Column headers**: "Quantity" changed to **"Qty"** in PO tables.

- **RLS (workflow_templates)**
  - Migration `optimize_workflow_templates_rls.sql`: Replaces bare `auth.uid()`/`auth.jwt()` with `(select auth.uid())`/`(select auth.jwt())` in RLS policies on `public.workflow_templates` so they are evaluated once per query (see Supabase RLS performance best practices).

**Files modified**:
- `src/pages/Bids.tsx` – Bid Board Edit column/button, Edit Bid Cancel position, New Bid "Save and start Counts" and Project Name required, Counts search/column/Edit Bid button, NewCountRow (Fixture quick-select, number pad, Save/Save and Add, combined inputs, required labels), Takeoff (state, loaders, mappings, template search, Create PO / Add to PO, View purchase order link)
- `src/pages/Materials.tsx` – PO Grand Total colspan and NaN handling, With Tax row and `viewedPOTaxPercent`, "Qty" headers, `location.state.openPOId` handling to open PO from Bids
- `src/lib/materialPOUtils.ts` – Shared `expandTemplate`, `addExpandedPartsToPO` (used by Materials and Bids Takeoff)

**Files added**:
- `supabase/migrations/optimize_workflow_templates_rls.sql` – RLS optimization for workflow_templates

---

## Latest Updates (v2.10)

### Add Customer from Edit Bid Modal, Estimator Customer Access, Quick Fill UI

**Date**: 2026-01-31

**Changes**:

- **Add Customer from Edit Bid modal**
  - In the Edit/New Bid modal, the GC/Builder (customer) dropdown now includes a **"+ Add new customer"** option at the top (for dev, master_technician, assistant, and estimator).
  - Clicking it opens an **Add Customer** modal with the same form as `/customers/new` but **without** the Quick Fill block (Name, Address, Phone, Email, Date Met, Customer Owner (Master)).
  - On save, the new customer is created, the customer list is refetched, the new customer is selected as the bid’s GC/Builder, and the Add Customer modal closes.
  - Shared component **`NewCustomerForm`** (`src/components/NewCustomerForm.tsx`) is used for both `/customers/new` (with Quick Fill) and the Add Customer modal (without Quick Fill). CustomerForm uses it for the create path; Bids renders it inside the Add Customer modal with `showQuickFill={false}`, `mode="modal"`, `onCancel`, and `onCreated`.

- **Estimators: see and add customers in Bids only**
  - **Customers RLS**: New migration `allow_estimators_select_customers.sql` lets estimators **SELECT** all customers (for the GC/Builder dropdown and joined customer data on bids) and **INSERT** into `customers` only when `master_user_id` is set to a valid master (dev or master_technician). Estimators cannot UPDATE or DELETE customers.
  - **Bids page**: Estimators now load the customer list (`loadCustomers()` is called for estimators as well as dev/master/assistant), so the GC/Builder dropdown is populated. Estimators also see the "+ Add new customer" option and can open the Add Customer modal.
  - **NewCustomerForm**: Estimator role is supported: estimators see the Customer Owner (Master) dropdown (all masters), must select a master when creating a customer, and can create customers from the Add Customer modal in Bids. Estimators still have **no access** to `/customers` or `/projects` (Layout redirects them to `/bids` for those paths).

- **Quick Fill on New Customer page**
  - On `/customers/new`, the **Quick Fill** block (paste tab-separated data to fill Name, Address, Email, Phone, Date) is now **expandable** and **collapsed by default**.
  - A **Quick Fill** button (with ▶ when collapsed, ▼ when expanded) sits **next to** the "New customer" title. Clicking it toggles the textarea and "Fill Fields" button.
  - When expanded, the label "Paste: Name	Address	Email	Phone	Date (M/D/YYYY)" and the textarea and "Fill Fields" button are shown below the title row.

**Files added**:
- `src/components/NewCustomerForm.tsx` – shared create-only customer form (used by CustomerForm for create and by Bids Add Customer modal).
- `supabase/migrations/allow_estimators_select_customers.sql` – customers SELECT policy includes estimator; new INSERT policy for estimators when master is assigned.

**Files modified**:
- `src/pages/CustomerForm.tsx` – uses `NewCustomerForm` when `isNew`; edit/delete flow unchanged.
- `src/pages/Bids.tsx` – `addCustomerModalOpen` state; "+ Add new customer" in GC/Builder dropdown (all four roles); Add Customer modal with `NewCustomerForm`; `loadCustomers()` called for estimators.
- `src/components/NewCustomerForm.tsx` – `estimator` in UserRole; load all masters for estimator; require master selection for estimator; show Customer Owner dropdown for estimator; Quick Fill expandable (default collapsed), Quick Fill button next to title.

---

## Latest Updates (v2.9)

### Bids Page Enhancements

**Date**: 2026-01-31

**Changes**:
- ✅ **Estimated Job Start Date**
  - Added nullable `estimated_job_start_date` column to `public.bids` (migration: `add_bids_estimated_job_start_date.sql`).
  - New/Edit Bid modal: when outcome is "Won", a date input for "Estimated Job Start Date" is shown and saved.
  - Submission & Followup tab: Won table header is "Estimated Job Start Date"; cell shows the date (YY/MM/DD format).
  - Types updated in `src/types/database.ts` (Row, Insert, Update).

- ✅ **Collapsible Submission & Followup tables**
  - Each of the four sections (Unsent bids, Not yet won or lost, Won, Lost) has a clickable header with chevron (▼ expanded, ▶ collapsed) and item count (e.g. "Unsent bids (3)").
  - Tables are shown or hidden based on section state. "Lost" is collapsed by default.

- ✅ **Bid Board search**
  - Full-width search input on Bid Board tab. Filters bids by project name, address, customer name, or GC/builder name (case-insensitive). Empty state reflects search and "hide lost" filter.

- ✅ **Bid Board columns**
  - Removed "Agreed Value" and "Maximum Profit" columns from the Bid Board table.
  - "Win/ Loss" and "Bid Value" moved to appear after "Address" and before "Estimator".
  - "Win/ Loss" header is a button that toggles hiding/showing lost bids; when hiding lost, the label shows "(hiding lost)" and is underlined.

- ✅ **Delete Bid confirmation modal**
  - Edit Bid modal: inline delete replaced with a "Delete bid" button that opens a separate confirmation modal.
  - Confirmation modal requires typing the project name (or leaving empty if no project name) to enable Delete. Cancel closes only the delete modal. Delete uses existing `deleteBid()` and closes both modals on success.

- ✅ **Submission & Followup Edit column**
  - Each of the four Submission & Followup tables has an "Edit" column (last column) with a gear icon button per row when that row is the selected bid. Clicking it opens that bid's full edit modal; click uses `stopPropagation` so row selection does not fire.

- ✅ **Wording**
  - "X day(s) overdue" in Time to/from bid due date is now "X day(s) since deadline".

- ✅ **GC/Builder contact fields (per bid)**
  - Added nullable columns to `public.bids`: `gc_contact_name`, `gc_contact_phone`, `gc_contact_email` (migration: `add_bids_gc_contact.sql`).
  - **New/Edit Bid modal**: After the GC/Builder (customer) picker and before Project Name, three fields: **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**. Saved with the bid; types updated in `src/types/database.ts`.
  - **Submission & Followup only**: When a bid is selected, the panel above the submission entries table shows Builder Name, Builder Address, **Builder Phone Number**, **Builder Email** (from customer or legacy GC/Builder), Project Name, Project Address, **Project Contact Name**, **Project Contact Phone**, **Project Contact Email**, Bid Size. Project contact fields are **not** shown on the Bid Board table.

**Files Modified**:
- `supabase/migrations/add_bids_gc_contact.sql` – New migration for gc_contact_name, gc_contact_phone, gc_contact_email
- `src/types/database.ts` – `bids`: added `estimated_job_start_date`, `gc_contact_name`, `gc_contact_phone`, `gc_contact_email`
- `src/pages/Bids.tsx` – state, form field, save payload, collapsible sections, search, column order/visibility, delete modal, Edit column, Won table column, wording, GC/Builder contact state/form/panel

---

## Latest Updates (v2.8)

### Purchase Order and Price Book Enhancements

**Date**: 2026-01-26

**Changes**:
- ✅ **Supply house dropdown with active prices**
  - In the draft PO items table and in the selected PO section, each line item’s Supply House cell is now a **dropdown** instead of plain text or a generic list.
  - Options show supply houses that have a price for that part, formatted as "Supply House Name - $X.XX" (from the price book).
  - Selecting an option immediately updates the PO item’s supply house and price and recalculates the PO total (no Edit/Update step).
  - "None" option clears the supply house and sets price to 0. Options load when the dropdown is opened (on focus).

- ✅ **Finalized POs: read-only supply house and hidden Confirmed**
  - When a PO is **finalized**, the Supply House cell shows read-only text (supply house name or "—") instead of the dropdown; users cannot change prices or supply house.
  - The **Confirmed** column is **hidden** for finalized POs (header and body); the table shows Part, Quantity, Supply House, Price, Total only. Footer colspan is adjusted so Grand Total aligns correctly.

- ✅ **Update price to zero removes part from supply house**
  - In the PO modal’s supply-house price table (when "Update" is expanded), setting the New Price to **0** and clicking "Update price" now **deletes** that price record from the price book (removes the part from that supply house) instead of saving a zero price. The button label changes to "Remove from supply house" when the value is 0.

- ✅ **Price book refresh on close of Part Prices modal**
  - When the user closes the "Prices" modal (Part Prices Manager) after editing or adding prices for a part, the Price Book table now **refetches parts** so the "Best Price" and part data update without a full page refresh.

- ✅ **View purchase order inline (no modal)**
  - Viewing a purchase order no longer opens a fixed overlay modal. The selected PO details (name, notes, status, items table, Grand Total, Delete/Close/Print/Duplicate/Go to Projects) now appear in an **inline section** on the Purchase Orders tab, **above** the "Search purchase orders" bar and table. Close hides the section; the search and table remain visible.

- ✅ **Print purchase order**
  - A **Print** button appears in the selected PO section (next to Close). Clicking it opens a new window with a print-friendly document and triggers the browser print dialog.
  - **Draft POs**: Print view shows **all prices** for each part (every supply house and price from the price book for that part), plus the currently chosen supply house and price and line total. Columns: Part, Qty, All prices, Chosen, Total; Grand Total.
  - **Finalized POs**: Print view shows only the **chosen price** per line. Columns: Part, Qty, Supply House, Price, Total; Grand Total. The print window closes after the user prints or cancels.

- ✅ **Reliable refresh after "Update price" in PO modal**
  - The "Update price" action in the PO modal’s supply-house table now passes the part id from the row into the update function so the price list refreshes correctly even when selection state is stale. "Use for PO" and "Add price" are unchanged.

**Files Modified**:
- `src/pages/Materials.tsx` - Supply house dropdown state and loader, inline PO section, Print button and printPO handler, fetchPricesForPart helper, finalized read-only/hidden Confirmed, loadParts on Part Prices modal close, updatePartPriceInBook partId and zero-price delete, updatePOItemSupplyHouse for draft-only PO

---

## Latest Updates (v2.7)

### Materials Management Enhancements

**Date**: 2026-01-21

**Changes**:
- ✅ **Finalized Purchase Order Notes**
  - Added ability to add notes to finalized purchase orders (add-only, cannot be edited once added)
  - Notes display prominently at the top of the PO view modal
  - Shows user name and timestamp: "Added by [Name] on [Date]"
  - Use cases: final bill amounts, pickup difficulties, special instructions
  - Database: Added `notes_added_by` and `notes_added_at` columns to `purchase_orders` table
  - RLS: New policy allows updating notes fields on finalized POs, but only when `notes` is null (enforcing add-only behavior)

- ✅ **Duplicate as Draft Feature**
  - Added "Duplicate as Draft" button to finalized purchase order view modal
  - Creates a new draft PO with all items copied from the finalized PO
  - Name format: "Copy of [original name]"
  - Resets confirmation status (price_confirmed_at, price_confirmed_by cleared)
  - Automatically opens the new draft PO for editing in Templates & Purchase Orders tab

- ✅ **UI Improvements - Delete Buttons Moved to Modals**
  - Moved delete buttons from list views to edit/view modals for better UX
  - **Templates**: Delete button now in Edit Template modal (left side)
  - **Parts**: Delete button now in Edit Part modal (left side)
  - **Supply Houses**: Delete button now in Edit Supply House form (left side)
  - **Purchase Orders**: Delete button now in PO view modal (left side)
  - Delete buttons only appear when editing/viewing existing items (not when creating new ones)
  - Consistent styling and positioning across all modals

**Database Changes**:
- ✅ Created `add_finalized_notes_tracking.sql` migration
  - Adds `notes_added_by` (UUID) and `notes_added_at` (TIMESTAMPTZ) columns
  - Creates RLS policy for updating notes on finalized POs (add-only enforcement)
  - Index on `notes_added_by` for faster lookups

**Files Modified**:
- `supabase/migrations/add_finalized_notes_tracking.sql` - New migration for notes tracking
- `supabase/migrations/optimize_rls_for_master_sharing.sql` - Fixed UPDATE policy for assistants
- `src/types/database.ts` - Updated `purchase_orders` table types
- `src/pages/Materials.tsx` - Added notes functionality, duplicate feature, moved delete buttons

**Technical Details**:
- **Add-Only Enforcement**: Database RLS policy ensures notes can only be added when `notes` is null, preventing edits
- **User Name Loading**: User names are loaded and cached in `userNamesMap` for efficient display
- **Optimistic UI Updates**: Notes form updates UI immediately, with rollback on error
- **RLS Policy Fix**: Updated `project_workflow_steps` UPDATE policy to allow assistants to update steps in workflows they can access (not just steps assigned to them), fixing 400 errors when changing assignments

---

## Latest Updates (v2.6)

### Workflow Data Persistence & Performance Fixes

**Date**: 2026-01-21

**Changes**:
- ✅ **Fixed data persistence issues** for projections and workflow steps
  - **Problem**: Projections and steps added to new projects would disappear when navigating away and coming back
  - **Root Cause**: Race condition where `workflow?.id` from React state was `null` during immediate save operations, causing saves to silently fail
  - **Solution**: Modified all save/delete operations (`saveProjection`, `deleteProjection`, `saveStep`, `refreshSteps`, `createFromTemplate`, `copyStep`) to always obtain a valid `workflowId` by calling `ensureWorkflow(projectId)` if state is null
  - **Result**: Data now persists correctly on first navigation back

- ✅ **Prevented concurrent workflow creation**
  - **Problem**: Multiple workflows being created for the same project, causing duplicate entries
  - **Root Cause**: Race condition where multiple concurrent calls to `ensureWorkflow` could all pass the initial check before any stored their promise
  - **Solution**: Implemented mutex pattern using `useRef` and placeholder promises
    - Creates and stores a placeholder promise immediately before executing async logic
    - Subsequent concurrent calls await the placeholder promise, serializing workflow creation
    - Added retry logic for insert errors to handle unique constraint violations gracefully
  - **Result**: Only one workflow is created per project, even with concurrent calls

- ✅ **Optimized redundant loadSteps calls**
  - **Problem**: Excessive `loadSteps` calls (7+ times) for the same workflow_id, causing performance issues
  - **Root Cause**: `useEffect` with `workflow?.id` in dependency array re-running when workflow state updates
  - **Solution**: Added ref tracking to prevent redundant loads
    - Added `lastLoadedWorkflowId` ref to track which workflow_id has been loaded
    - `loadSteps` sets the ref after successful load
    - `useEffect` checks if we've already loaded for the workflow_id before calling `loadSteps`
    - `refreshSteps` resets tracking to force reload when explicitly called
    - Tracking resets when `projectId` changes (new project)
    - Added cleanup function to handle React Strict Mode properly
  - **Result**: Reduced to 1-2 `loadSteps` calls per page load, significantly improving performance

**Files Modified**:
- `src/pages/Workflow.tsx` - Added mutex pattern, ref tracking, workflow_id lookup pattern, and TypeScript type fixes

**Technical Details**:
- **Mutex Pattern**: Uses `useRef<Map<string, Promise<string | null>>>` to track pending `ensureWorkflow` calls per project
- **Ref Tracking**: Uses `useRef<string | null>` to track last loaded workflow_id
- **Workflow State Sync**: After `ensureWorkflow` returns, workflow state is updated to ensure consistency
- **Cleanup Function**: Added to useEffect to handle React Strict Mode double-invocation
- **TypeScript Type Fixes**: Explicitly typed `workflowId` variables as `string | null` (7 locations) to match `ensureWorkflow` return type, using `?? null` to convert `undefined` to `null`

## Latest Updates (v2.5)

### Master-to-Master Sharing

**Date**: 2026-01-21

**Changes**:
- ✅ **Added "Share with other Master" feature** in Settings
  - Masters can grant other masters assistant-level access to their customers and projects
  - Similar to "Adopt Assistants" but for master-to-master relationships
  - Shared masters can see customers, projects, workflows, and steps
  - Shared masters cannot see private notes or financial totals (same restrictions as assistants)
  - Shared masters cannot modify/delete resources (same restrictions as assistants)

**Database Changes**:
- ✅ Created `master_shares` table to track sharing relationships
- ✅ Updated RLS policies for customers, projects, workflows, steps, line items, and projections
- ✅ All policies now check for `master_shares` relationships in addition to `master_assistants`
- ✅ **Added RLS timeout fix migration** for master sharing
  - Introduces helper-function-based policies to avoid statement timeouts (`57014`)
  - File: `supabase/migrations/optimize_rls_for_master_sharing.sql`

**Files Modified**:
- `supabase/migrations/create_master_shares.sql` - New table
- `supabase/migrations/update_*_rls_for_master_sharing.sql` - 6 migration files updating RLS policies
- `supabase/migrations/optimize_rls_for_master_sharing.sql` - Fix statement timeout errors
- `src/types/database.ts` - Added master_shares table types
- `src/pages/Settings.tsx` - Added UI for master sharing

### Re-open Functionality Updates

**Date**: 2026-01-21

**Changes**:
- ✅ **Re-open button now available for completed, approved, and rejected stages**
  - Previously only available for rejected stages
  - Now available to devs, masters, and assistants (on Workflow page)
  - Button appears inline with Edit and Delete buttons (bottom right of card)
  - Removed from Dashboard (only available on Workflow page)
- ✅ **Re-open clears next step rejection notices**
  - When reopening a step, clears `next_step_rejected_notice` and `next_step_rejection_reason` if set
  - Ensures clean state when manually reopening

**Files Modified**:
- `src/pages/Workflow.tsx` - Updated re-open button visibility and location
- `src/pages/Dashboard.tsx` - Removed re-open button

### Dashboard UI Updates

**Date**: 2026-01-21

**Changes**:
- ✅ **Updated "How It Works" section**
  - Added intro line: "PipeTooling helps Masters better manage Projects with Subs. Three types of People: Masters, Assistants, Subs"
  - Updated bullets to the new “Customers/Projects/Stages” wording
- ✅ **Updated "Sharing" + Subcontractors help text**
  - Added explanation lines (→) under sharing bullets
  - Removed the separate "Access Control" section from the help box
  - Simplified Subcontractor bullets (cannot see private notes or financials)

**Files Modified**:
- `src/pages/Dashboard.tsx` - Updated help text sections

### Login-as-User Improvements

**Date**: 2026-01-21

**Changes**:
- ✅ **Fixed magic link authentication handling**
  - Added `AuthHandler` component to process authentication tokens from URL hash
  - Automatically sets session and redirects to dashboard when coming from magic link
  - Fixed redirect URL construction to use `window.location.origin`
- ✅ **Updated button text**: "Login as user" → "imitate"

**Files Modified**:
- `src/App.tsx` - Added AuthHandler component
- `src/pages/Settings.tsx` - Updated button text and redirect URL

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
