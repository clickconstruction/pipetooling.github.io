# Recent Features and Updates

This document summarizes all recent features and improvements added to Pipetooling.

## Table of Contents
1. [Latest Updates (v2.15)](#latest-updates-v215)
2. [Latest Updates (v2.14)](#latest-updates-v214)
3. [Latest Updates (v2.13)](#latest-updates-v213)
4. [Latest Updates (v2.12)](#latest-updates-v212)
5. [Latest Updates (v2.11)](#latest-updates-v211)
6. [Latest Updates (v2.10)](#latest-updates-v210)
7. [Latest Updates (v2.9)](#latest-updates-v29)
8. [Latest Updates (v2.8)](#latest-updates-v28)
9. [Latest Updates (v2.7)](#latest-updates-v27)
10. [Latest Updates (v2.6)](#latest-updates-v26)
11. [Workflow Features](#workflow-features)
12. [Calendar Updates](#calendar-updates)
13. [Access Control](#access-control)
14. [Email Templates](#email-templates)
15. [Financial Tracking](#financial-tracking)
16. [Customer and Project Management](#customer-and-project-management)

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
