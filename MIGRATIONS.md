# Database Migrations Reference

---
file: MIGRATIONS.md
type: Reference/Changelog
purpose: Complete database migration history organized by date and category
audience: Developers, Database Administrators, AI Agents
last_updated: 2026-02-07
estimated_read_time: 15-20 minutes
difficulty: Intermediate to Advanced

total_migrations: ~84
date_range: "Through February 7, 2026"
categories: "Bids, Materials, Workflow, RLS, Database Improvements"

key_sections:
  - name: "Recent Migrations (Feb 2026)"
    line: ~18
    anchor: "#recent-migrations"
    description: "Latest schema changes by date"
  - name: "Migrations by Category"
    line: ~196
    anchor: "#migrations-by-category"
    description: "Grouped by system/feature"
  - name: "Migrations by Feature"
    line: ~337
    anchor: "#migrations-by-feature"
    description: "Complete feature implementation sequences"
  - name: "Migration Best Practices"
    line: ~397
    anchor: "#migration-best-practices"
    description: "How to create safe migrations"
  - name: "Rollback Procedures"
    line: ~452
    anchor: "#rollback-procedures"
    description: "How to revert changes"

quick_navigation:
  - "[Latest Changes](#recent-migrations) - February 2026"
  - "[By Category](#migrations-by-category) - Grouped by system"
  - "[Best Practices](#migration-best-practices) - How to migrate safely"
  - "[Rollback](#rollback-procedures) - Reverting changes"

related_docs:
  - "[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) - Current schema"
  - "[DATABASE_IMPROVEMENTS_SUMMARY.md](./DATABASE_IMPROVEMENTS_SUMMARY.md) - v2.22 improvements"
  - "[supabase/migrations/README.md](./supabase/migrations/README.md) - Migration files"

prerequisites:
  - Understanding of PostgreSQL DDL
  - Familiarity with RLS concepts
  - Knowledge of Supabase migrations

when_to_read:
  - Creating new migrations
  - Understanding schema evolution
  - Debugging migration issues
  - Planning schema changes
  - Reviewing project history
---

## Table of Contents
1. [Overview](#overview)
2. [Recent Migrations](#recent-migrations)
3. [Migrations by Category](#migrations-by-category)
4. [Migration Best Practices](#migration-best-practices)
5. [Rollback Procedures](#rollback-procedures)

---

## Overview

This document tracks all database migrations in the Pipetooling project. Migrations are located in `supabase/migrations/` and are applied automatically by Supabase.

### Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20260206220800_add_unique_constraint_to_price_book_versions.sql`

### Key Principles
- Migrations are **append-only** (never edit existing migrations)
- Each migration is **idempotent** when possible
- Destructive changes require explicit confirmation
- Schema changes documented in this file

---

## Recent Migrations

### February 2026

#### February 7, 2026

**`fix_masters_see_other_masters_recursion.sql`**
- **Purpose**: Fix infinite recursion in "Masters and devs can see other masters" policy
- **Root Cause**: Policy used EXISTS on users table causing infinite loop
- **Changes**: 
  - Created `is_master_or_dev()` SECURITY DEFINER helper function
  - Dropped and recreated policy using the helper function
- **Impact**: Masters can now see other masters without recursion errors
- **Category**: RLS Bug Fix

**`allow_masters_see_other_masters.sql`**
- **Purpose**: Allow masters to see other masters in "Share with other Master" feature
- **Root Cause**: Missing SELECT policy - masters could not query other master_technician users
- **Changes**: Added SELECT policy allowing masters and devs to view all master_technician users
- **Impact**: Initial fix (had recursion bug, fixed by next migration)
- **Category**: Access Control / RLS Bug Fix

**`allow_assistants_update_customers.sql`**
- **Purpose**: Allow assistants to update customer information
- **Root Cause**: Missing UPDATE policy - assistants could SELECT and INSERT customers but not UPDATE them
- **Changes**: Added UPDATE policy for assistants matching INSERT policy logic
- **Impact**: Assistants can now edit customer details for customers owned by masters who have adopted them
- **Category**: Access Control / RLS

**`fix_cost_estimates_rls_for_assistants.sql`**
- **Purpose**: Fix RLS policies to allow assistants to create cost estimates
- **Root Cause**: INSERT policy had flawed logic with redundant/complex nested EXISTS checks
- **Changes**: 
  - Dropped all 4 existing policies (SELECT, INSERT, UPDATE, DELETE)
  - Created simplified policies that only check user role
  - Aligned with bids table access pattern (all dev/master/assistant/estimator users can access)
- **Impact**: Assistants can now create/edit cost estimates without RLS errors
- **Category**: RLS Bug Fix

#### February 6, 2026

**`add_unique_constraint_to_price_book_versions.sql`**
- **Purpose**: Ensure unique price book version names
- **Changes**: Added UNIQUE constraint on `price_book_versions.name`
- **Impact**: Prevents duplicate version names
- **Category**: Data Integrity

**`add_cost_estimate_driving_cost_fields.sql`**
- **Purpose**: Add driving cost calculation fields
- **Changes**: 
  - Added `driving_cost_rate` (NUMERIC(10,2), default 0.70) to `cost_estimates`
  - Added `hours_per_trip` (NUMERIC(10,2), default 2.0) to `cost_estimates`
- **Impact**: Enables automatic driving cost calculation in Cost Estimate tab
- **Formula**: `(Total Hours / Hours Per Trip) × Rate Per Mile × Distance to Office`
- **Category**: Bids Enhancement

#### February 5, 2026

**`create_parts_with_price_count_function.sql`**
- **Purpose**: Server-side sorting by price count
- **Changes**: Created `get_parts_ordered_by_price_count(ascending_order BOOLEAN)` function
- **Returns**: Array of part UUIDs sorted by price count
- **Impact**: Enables sorting all parts by price count (not just current page)
- **Category**: Materials Performance

**`create_supply_house_stats_function.sql`**
- **Purpose**: Supply house statistics and coverage
- **Changes**: Created `get_supply_house_price_counts()` function
- **Returns**: Table of `(supply_house_id, name, price_count)` sorted by count DESC
- **Impact**: Shows pricing coverage stats in Supply Houses modal
- **Category**: Materials Performance

**`update_people_kind_constraint.sql`**
- **Purpose**: Update people table constraints
- **Changes**: Modified CHECK constraint on `people.kind` enum
- **Impact**: Ensures valid kind values (assistant, master_technician, sub)
- **Category**: Data Integrity

#### February 4, 2026

**`create_transaction_functions.sql`**
- **Purpose**: Atomic multi-step operations with rollback
- **Changes**: Created 4 database functions:
  1. `create_project_with_template()` - Atomic project + workflow creation
  2. `duplicate_purchase_order()` - Atomic PO duplication
  3. `copy_workflow_step()` - Atomic step copying with sequence update
  4. `create_takeoff_entry_with_items()` - Atomic takeoff entry creation
- **Impact**: Prevents partial data on failures, better reliability
- **Category**: Database Improvements

**`add_data_integrity_constraints.sql`**
- **Purpose**: Prevent invalid data at database level
- **Changes**:
  - CHECK `purchase_order_items.quantity > 0`
  - CHECK `bids_count_rows.count >= 0`
  - CHECK `material_part_prices.price >= 0`
  - UNIQUE INDEX on `material_template_items(template_id, part_id)` WHERE item_type='part'
  - Updated FK cascading for `projects.master_user_id` (ON DELETE SET NULL)
- **Impact**: Database rejects invalid data before it corrupts system
- **Category**: Data Integrity

**`add_cascading_customer_master_to_projects.sql`**
- **Purpose**: Maintain customer-project master consistency
- **Changes**: Created trigger `cascade_customer_master_to_projects()`
- **Logic**: When `customers.master_user_id` changes, automatically updates `projects.master_user_id` for all customer's projects
- **Impact**: No orphaned projects with wrong master assignment
- **Category**: Database Improvements

**`add_updated_at_triggers.sql`**
- **Purpose**: Automatic timestamp management
- **Changes**:
  - Created reusable trigger function `update_updated_at_column()`
  - Applied BEFORE UPDATE triggers to 20 tables
- **Tables**: bids, customers, projects, material_parts, purchase_orders, workflow_steps, and 14 others
- **Impact**: Eliminates manual timestamp management, ensures consistency
- **Category**: Database Improvements

**`allow_assistants_insert_customers.sql`**
- **Purpose**: Let assistants create customers
- **Changes**: New INSERT policy on `customers` for assistants
- **Logic**: Assistants can create when selecting master who adopted them
- **Impact**: Assistants can add customers for their masters
- **Category**: Access Control

**`add_bids_loss_reason.sql`**
- **Purpose**: Track why bids were lost
- **Changes**: Added `loss_reason` (TEXT, nullable) to `bids` table
- **Impact**: Better bid outcome analysis
- **Category**: Bids Enhancement

**`add_takeoff_book_entry_items.sql`**
- **Purpose**: Support multiple template/stage pairs per takeoff entry
- **Changes**:
  - Created `takeoff_book_entry_items` table
  - Migrated existing `template_id` and `stage` from `takeoff_book_entries` to items
  - One entry can now have multiple (Template, Stage) pairs
- **Impact**: More flexible takeoff book mappings
- **Category**: Bids Enhancement

**`add_takeoff_book_entries_alias_names.sql`**
- **Purpose**: Support alternative fixture names in takeoff book
- **Changes**: Added `alias_names` (TEXT[], default '{}') to `takeoff_book_entries`
- **Impact**: Entries match multiple fixture name variations
- **Category**: Bids Enhancement

#### February 3, 2026

**`add_labor_book_entries_alias_names.sql`**
- **Purpose**: Support alternative fixture names in labor book
- **Changes**: Added `alias_names` (TEXT[], default '{}') to `labor_book_entries`
- **Impact**: Entries match multiple fixture name variations
- **Category**: Bids Enhancement

**`add_bids_outcome_started_or_complete.sql`**
- **Purpose**: Add new bid outcome option
- **Changes**: Updated `bids.outcome` CHECK constraint to include `'started_or_complete'`
- **Impact**: Better tracking of bid lifecycle
- **Category**: Bids Enhancement

#### February 2, 2026

**`add_bids_bid_submission_link.sql`**
- **Purpose**: Track bid submission URLs
- **Changes**: Added `bid_submission_link` (TEXT, nullable) to `bids`
- **Impact**: Link to submitted bid documents
- **Category**: Bids Enhancement

**`add_bids_design_drawing_plan_date.sql`**
- **Purpose**: Track design drawing plan dates
- **Changes**: Added `design_drawing_plan_date` (DATE, nullable) to `bids`
- **Impact**: Project planning timeline tracking
- **Category**: Bids Enhancement

**`allow_masters_see_all_bids.sql`**
- **Purpose**: Update bids RLS for proper access
- **Changes**: Updated SELECT, INSERT, UPDATE, DELETE policies on bids and related tables
- **Impact**: Masters can see and manage bids properly
- **Category**: Access Control

**`create_takeoff_book_versions_and_entries.sql`**
- **Purpose**: Create takeoff book system
- **Changes**:
  - Created `takeoff_book_versions` table
  - Created `takeoff_book_entries` table (before entry_items split)
  - RLS policies for dev, master, assistant, estimator
- **Impact**: Standardized fixture-to-template mappings
- **Category**: Bids Enhancement

**`add_bids_selected_takeoff_book_version.sql`**
- **Purpose**: Link bids to takeoff book versions
- **Changes**: Added `selected_takeoff_book_version_id` (UUID, FK, nullable) to `bids`
- **Impact**: Persist takeoff book selection per bid
- **Category**: Bids Enhancement

**`create_labor_book_versions_and_entries.sql`**
- **Purpose**: Create labor book system
- **Changes**:
  - Created `labor_book_versions` table
  - Created `labor_book_entries` table with hours per stage
  - Seeded "Default" version with sample entries
  - RLS policies for dev, master, assistant, estimator
- **Impact**: Standardized labor hour estimates
- **Category**: Bids Enhancement

**`add_bids_selected_labor_book_version.sql`**
- **Purpose**: Link bids to labor book versions
- **Changes**: Added `selected_labor_book_version_id` (UUID, FK, nullable) to `bids`
- **Impact**: Persist labor book selection per bid
- **Category**: Bids Enhancement

#### February 1, 2026

**`add_bid_pricing_assignments_version.sql`**
- **Purpose**: Link pricing assignments to price book versions
- **Changes**: Added version tracking to bid pricing assignments
- **Impact**: Version-aware pricing assignments
- **Category**: Bids Enhancement

**`create_price_book_versions_and_entries.sql`**
- **Purpose**: Create price book system
- **Changes**:
  - Created `price_book_versions` table
  - Created `price_book_entries` table with prices per stage
  - RLS policies for dev, master, assistant, estimator
- **Impact**: Standardized fixture pricing for margin analysis
- **Category**: Bids Enhancement

**`create_bid_pricing_assignments.sql`**
- **Purpose**: Link count rows to price book entries
- **Changes**:
  - Created `bid_pricing_assignments` table
  - UNIQUE constraint on `(bid_id, count_row_id)`
  - RLS follows bid access
- **Impact**: Persist fixture-to-entry assignments for margin tracking
- **Category**: Bids Enhancement

**`add_bids_selected_price_book_version.sql`**
- **Purpose**: Link bids to price book versions
- **Changes**: Added `selected_price_book_version_id` (UUID, FK, nullable) to `bids`
- **Impact**: Persist price book selection per bid
- **Category**: Bids Enhancement

**`revert_price_book_and_bids_job_type.sql`**
- **Purpose**: Rollback migration (if needed)
- **Changes**: Drops price book tables and `bids.job_type` column
- **Impact**: Allows reverting price book feature
- **Category**: Rollback

**`add_purchase_orders_stage.sql`**
- **Purpose**: Track PO stage association
- **Changes**: Added `stage` (TEXT, nullable) to `purchase_orders`
- **Impact**: Link POs to specific workflow stages
- **Category**: Materials Enhancement

---

## Migrations by Category

### Database Improvements (Infrastructure)

**Automatic Timestamp Management**:
- `add_updated_at_triggers.sql` (Feb 4, 2026)
  - 20 tables with automatic `updated_at` triggers
  - Reusable `update_updated_at_column()` function

**Cascading Updates**:
- `add_cascading_customer_master_to_projects.sql` (Feb 4, 2026)
  - Maintains customer-project master consistency
  - Automatic propagation of ownership changes

**Data Integrity Constraints**:
- `add_data_integrity_constraints.sql` (Feb 4, 2026)
  - 4 CHECK constraints (positive quantities, non-negative counts/prices)
  - 1 UNIQUE INDEX (no duplicate parts per template)

**Atomic Transaction Functions**:
- `create_transaction_functions.sql` (Feb 4, 2026)
  - 4 functions for complex multi-step operations
  - Automatic rollback on failure

### Bids System Enhancements

**Core Bids Features**:
- `create_bids.sql` - Initial bids table
- `add_bids_customer_id.sql` - Link to customers table
- `split_bids_project_name_and_address.sql` - Separate fields
- `add_bids_estimated_job_start_date.sql` (Feb 1-4, 2026)
- `add_bids_gc_contact.sql` - Project contact fields
- `add_bids_estimator_id.sql` - Estimator assignment
- `add_bids_loss_reason.sql` (Feb 4, 2026)
- `add_bids_outcome_started_or_complete.sql` (Feb 3, 2026)
- `add_bids_design_drawing_plan_date.sql` (Feb 2, 2026)
- `add_bids_bid_submission_link.sql` (Feb 2, 2026)

**Takeoff Book System**:
- `create_takeoff_book_versions_and_entries.sql` (Feb 2, 2026)
- `add_takeoff_book_entries_alias_names.sql` (Feb 4, 2026)
- `add_takeoff_book_entry_items.sql` (Feb 4, 2026) - Multiple templates per entry
- `add_bids_selected_takeoff_book_version.sql` (Feb 2, 2026)

**Labor Book System**:
- `create_labor_book_versions_and_entries.sql` (Feb 2, 2026)
- `add_labor_book_entries_alias_names.sql` (Feb 3, 2026)
- `add_bids_selected_labor_book_version.sql` (Feb 2, 2026)

**Price Book System**:
- `create_price_book_versions_and_entries.sql` (Feb 1, 2026)
- `create_bid_pricing_assignments.sql` (Feb 1, 2026)
- `add_bid_pricing_assignments_version.sql` (Feb 2, 2026)
- `add_bids_selected_price_book_version.sql` (Feb 1, 2026)
- `add_unique_constraint_to_price_book_versions.sql` (Feb 6, 2026)

**Cost Estimate Enhancements**:
- `create_cost_estimates.sql` - Initial cost estimates
- `create_cost_estimate_labor_rows.sql` - Labor hours table
- `add_cost_estimate_driving_cost_fields.sql` (Feb 6, 2026)
- `fix_cost_estimates_rls_for_assistants.sql` (Feb 7, 2026) - Simplified RLS policies

**Counts and Submission**:
- `create_bids_count_rows.sql` - Fixture counts
- `add_bids_count_rows_page.sql` - Plan page reference
- `create_bids_submission_entries.sql` - Submission tracking

### Materials System Enhancements

**Performance Functions**:
- `create_supply_house_stats_function.sql` (Feb 5, 2026)
  - Function: `get_supply_house_price_counts()`
  - Returns: Coverage statistics per supply house
- `create_parts_with_price_count_function.sql` (Feb 5, 2026)
  - Function: `get_parts_ordered_by_price_count(ascending_order)`
  - Returns: Part IDs sorted by price count

**Core Materials**:
- `create_supply_houses.sql` - Supply house management
- `create_material_parts.sql` - Parts catalog
- `create_material_part_prices.sql` - Price book
- `create_material_templates.sql` - Template system
- `create_purchase_orders.sql` - PO management

**Purchase Order Features**:
- `add_finalized_notes_tracking.sql` - Add-only notes for finalized POs
- `add_purchase_orders_stage.sql` (Feb 1, 2026) - Stage association
- `add_purchase_order_to_line_items.sql` - Link POs to workflow line items

**Price Tracking**:
- `create_price_history_trigger.sql` - Automatic price change logging
- `add_price_confirmation_fields.sql` - Assistant price confirmation

### Workflow Enhancements

**Financial Tracking**:
- `add_private_notes_to_workflow_steps.sql` - Private notes field
- `create_workflow_step_line_items.sql` - Line items per stage
- `create_workflow_projections.sql` - Workflow-level projections
- `add_link_to_line_items.sql` - URL field for external references

**Action Tracking**:
- `create_project_workflow_step_actions.sql` - Action history ledger
- Tracks: started, completed, approved, rejected, reopened

**Rejection Workflow**:
- `add_next_step_rejection_fields.sql` - Cascading rejection notices

### Access Control and RLS

**Master-Assistant System**:
- `create_master_assistants.sql` - Adoption relationships
- `update_customers_rls_for_master_sharing.sql`
- `update_projects_rls_for_master_sharing.sql`
- `update_project_workflows_rls_for_master_sharing.sql`
- `update_project_workflow_steps_rls_for_master_sharing.sql`
- `update_workflow_step_line_items_rls_for_master_sharing.sql`
- `update_workflow_projections_rls_for_master_sharing.sql`

**Master Sharing**:
- `create_master_shares.sql` - Master-to-master sharing

**RLS Optimizations**:
- `optimize_rls_for_master_sharing.sql` - Helper function pattern to prevent timeouts
- `optimize_workflow_step_line_items_rls.sql` - Can access project via step
- `fix_project_workflow_step_actions_rls.sql` - Can access step for action
- `optimize_workflow_templates_rls.sql` - Evaluates auth functions once per query
- `fix_users_rls_for_project_masters.sql` - Prevents recursion with SECURITY DEFINER

**Role-Specific Access**:
- `allow_assistants_access_bids.sql` - Assistants full bids access
- `allow_assistants_insert_customers.sql` - Assistants can create customers
- `allow_assistants_update_customers.sql` (Feb 7, 2026) - Assistants can edit customers
- `allow_masters_see_other_masters.sql` (Feb 7, 2026) - Masters can view other masters for sharing
- `allow_estimators_access_bids.sql` - Estimators full bids access
- `allow_estimators_select_customers.sql` (Feb 4, 2026) - Estimators SELECT/INSERT customers
- `verify_projects_rls_for_assistants.sql` - Assistants see all stages
- `fix_cost_estimates_rls_for_assistants.sql` (Feb 7, 2026) - Simplified RLS for cost estimates

**Customer Management**:
- `add_customers_delete_rls.sql` - Masters can delete own customers

### Email and Notifications

**Email Templates**:
- `create_email_templates.sql` - Template storage
- `seed_email_templates.sql` - Default templates
- RLS policies use `is_dev()` function

**Notifications**:
- `add_notification_fields_to_workflow_steps.sql` - Stage notification settings
- `create_step_subscriptions.sql` - User notification preferences

### User Management

**Core User System**:
- `create_users_table.sql` - Public users table
- `create_handle_new_user_trigger.sql` - Auto-create public.users record

**People Roster**:
- `create_people_table.sql` - People without user accounts
- `update_people_kind_constraint.sql` (Feb 5, 2026) - Kind enum validation
- `allow_devs_read_all_people.sql` - Devs see all roster entries

---

## Migrations by Feature

### Complete Feature Implementation Sequences

#### Bids System (6 tabs)
1. `create_bids.sql` - Core table
2. `create_bids_count_rows.sql` - Counts tab
3. `create_cost_estimates.sql` + `create_cost_estimate_labor_rows.sql` - Cost Estimate tab
4. `create_takeoff_book_*` → `add_takeoff_book_*` - Takeoff tab
5. `create_labor_book_*` → `add_labor_book_*` - Labor book for Cost Estimate
6. `create_price_book_*` + `create_bid_pricing_assignments.sql` - Pricing tab
7. `create_bids_submission_entries.sql` - Submission & Followup tab

#### Materials System (3 tabs)
1. `create_supply_houses.sql` - Vendors
2. `create_material_parts.sql` + `create_material_part_prices.sql` - Price Book tab
3. `create_material_templates.sql` + `create_material_template_items.sql` - Templates tab
4. `create_purchase_orders.sql` + `create_purchase_order_items.sql` - Purchase Orders tab
5. `create_price_history_trigger.sql` - Price tracking
6. Performance functions - Search and sort enhancements

#### Workflow Financial Tracking
1. `add_private_notes_to_workflow_steps.sql` - Private notes
2. `create_workflow_step_line_items.sql` - Line items per stage
3. `create_workflow_projections.sql` - Workflow-level projections
4. `add_link_to_line_items.sql` - External links
5. `add_purchase_order_to_line_items.sql` - PO integration

---

## Migration Best Practices

### Before Creating Migration

1. **Test locally first**: Use Supabase local development
   ```bash
   supabase migration new descriptive_name
   ```

2. **Make idempotent when possible**:
   ```sql
   -- Good: Will succeed if already exists
   CREATE TABLE IF NOT EXISTS my_table (...);
   
   -- Good: Will succeed if already exists
   DO $$ BEGIN
     ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
   EXCEPTION WHEN duplicate_column THEN
     -- Column already exists, that's fine
   END $$;
   ```

3. **Check dependencies**: Verify foreign keys and constraints

4. **Consider data migration**: If altering columns with data, handle existing records

### After Creating Migration

1. **Test in development**: Apply to local database first
   ```bash
   supabase migration up
   ```

2. **Test rollback** (if possible): Create down migration or test revert

3. **Update TypeScript types**: Run type generation
   ```bash
   supabase gen types typescript --local > src/types/database.ts
   ```

4. **Document in RECENT_FEATURES.md**: Add to feature log

5. **Update this file**: Add to Recent Migrations section

### Migration Safety

**Safe Operations**:
- Adding nullable columns
- Creating new tables
- Adding indexes
- Creating functions
- Adding RLS policies

**Potentially Breaking**:
- Dropping columns/tables
- Changing column types
- Adding NOT NULL to existing columns
- Changing foreign key cascading

**Destructive Operations**:
- Require explicit confirmation
- Document rollback procedure
- Consider data export first

---

## Rollback Procedures

### Revert Migration (Generic)

```bash
# Create rollback migration
supabase migration new revert_feature_name

# In migration file:
# - DROP tables in reverse dependency order
# - Remove columns with ALTER TABLE DROP COLUMN
# - Drop functions with DROP FUNCTION
```

### Example Rollback Migrations

**`revert_price_book_and_bids_job_type.sql`** (Feb 1, 2026):
```sql
-- Drops in dependency order
DROP TABLE IF EXISTS bid_pricing_assignments;
DROP TABLE IF EXISTS price_book_entries;
DROP TABLE IF EXISTS price_book_versions;
ALTER TABLE bids DROP COLUMN IF EXISTS job_type;
```

### Emergency Rollback

**If migration causes production issues**:

1. **Identify breaking migration**: Check error logs
2. **Create hotfix migration**: Revert specific changes
3. **Deploy immediately**: `supabase migration up`
4. **Verify functionality**: Test affected features
5. **Post-mortem**: Document issue and prevention

---

## Migration Tracking

### Viewing Applied Migrations

**In Supabase Dashboard**:
- Database → Migrations tab
- Shows all applied migrations with timestamps

**Via SQL**:
```sql
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

### Checking Migration Status

```bash
# List all migrations and their status
supabase migration list

# Show migration diff
supabase db diff
```

---

## Related Documentation

- [PROJECT_DOCUMENTATION.md - Database Schema](./PROJECT_DOCUMENTATION.md#database-schema)
- [DATABASE_IMPROVEMENTS_SUMMARY.md](./DATABASE_IMPROVEMENTS_SUMMARY.md) - v2.22 improvements
- [DATABASE_FIXES_TEST_PLAN.md](./DATABASE_FIXES_TEST_PLAN.md) - Testing procedures
- [supabase/migrations/README.md](./supabase/migrations/README.md) - Migration directory readme

---

## Future Migration Planning

### Planned Enhancements

**Performance**:
- Add indexes on frequently queried columns
- Optimize RLS policies with helper functions
- Consider materialized views for complex queries

**Features**:
- Notification scheduling tables
- Document generation metadata
- Bid comparison analytics tables
- Historical reporting tables

**Data Quality**:
- Additional CHECK constraints for business rules
- Computed columns for derived values
- Audit trigger for sensitive operations
