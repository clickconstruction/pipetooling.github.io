# Database Migrations Reference

---
file: MIGRATIONS.md
type: Reference/Changelog
purpose: Complete database migration history organized by date and category
audience: Developers, Database Administrators, AI Agents
last_updated: 2026-02-17
estimated_read_time: 15-20 minutes
difficulty: Intermediate to Advanced

total_migrations: ~87
date_range: "Through February 17, 2026"
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

This document tracks all database migrations in the PipeTooling project. Migrations are located in `supabase/migrations/` and are applied automatically by Supabase.

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

#### February 17, 2026

**`20260217230000_add_material_parts_service_type_name_index.sql`**
- **Purpose**: Reduce disk IO for Materials Price Book queries
- **Changes**: Added composite index `idx_material_parts_service_type_name` on (service_type_id, name)
- **Impact**: Faster parts loading when filtering by service type and ordering by name
- **Category**: Materials / Performance

**`20260217210000_create_cost_matrix_teams_shares.sql`**
- **Purpose**: Share Cost Matrix and Teams with selected masters/assistants (view-only)
- **Changes**: Created `cost_matrix_teams_shares` (shared_with_user_id); `is_cost_matrix_shared_with_current_user()`; RLS for dev manage, shared users SELECT; added SELECT policies for shared users on people_pay_config, people_teams, people_team_members, people_hours
- **Impact**: Dev can grant view-only Cost matrix and Teams access; shared users see Cost matrix and Teams but cannot edit
- **Category**: People / Pay

**`20260217200000_allow_masters_assistants_read_push_subscriptions.sql`**
- **Purpose**: Allow masters and assistants to see push notification status (green dot) in People
- **Changes**: Added RLS policy on `push_subscriptions` for role in (master_technician, assistant)
- **Impact**: Masters and assistants see green dot next to users with push notifications enabled
- **Category**: Notifications

**`20260217070000_checklist_repeat_days_of_week_array.sql`**
- **Purpose**: Support multiple days per week for weekly checklist repeats
- **Changes**: Added `repeat_days_of_week` (integer[]); migrated from `repeat_day_of_week`; dropped `repeat_day_of_week`
- **Impact**: Add/Edit checklist item shows 7 checkboxes (Sun–Sat) instead of single dropdown
- **Category**: Checklist

**`20260217060000_allow_assignees_read_checklist_items.sql`**
- **Purpose**: Allow assignees to read checklist items (for Today/History views)
- **Changes**: RLS policy for checklist_items allowing assigned users to read
- **Impact**: Users can see their checklist items in Today and History tabs
- **Category**: Checklist

**`20260217041500_create_push_subscriptions.sql`**
- **Purpose**: Store Web Push subscriptions for checklist and workflow notifications
- **Changes**: Created `push_subscriptions` (user_id, endpoint, p256dh_key, auth_key); RLS for own subscriptions
- **Impact**: Settings push notifications; send-checklist-notification Edge Function
- **Category**: Notifications

**`20260217050000_create_checklist.sql`**
- **Purpose**: Checklist system for recurring tasks
- **Changes**: Created `checklist_items`, `checklist_instances`; `is_dev_or_master_or_assistant()`; RLS for dev/master/assistant manage, assignees read/update own instances
- **Impact**: Checklist page (Today, History, Manage tabs); repeat types: day_of_week, days_after_completion, once
- **Category**: Checklist

#### February 13, 2026

**`20260213000007_create_people_hours_display_order.sql`**
- **Purpose**: Custom order for people in Hours tab
- **Changes**: Created `people_hours_display_order` (person_name, sequence_order); RLS for pay-access users
- **Impact**: Users can reorder people in Hours timesheet via up/down buttons
- **Category**: People / Pay

**`20260213000006_restrict_show_in_hours_to_dev.sql`**
- **Purpose**: Restrict Show in Hours toggle to dev only
- **Changes**: Added trigger on `people_pay_config` to reject show_in_hours updates from non-dev users
- **Impact**: Only dev can control who appears in Hours tab; defense in depth
- **Category**: People / Pay

**`20260213000005_allow_all_assistants_hours.sql`**
- **Purpose**: Allow all assistants of approved masters to read/write people hours
- **Changes**: Updated people_hours RLS to use `is_assistant_of_pay_approved_master()`
- **Impact**: Assistants of Pay Approved Masters can enter timesheet hours
- **Category**: People / Pay

**`20260213000004_add_show_in_cost_matrix.sql`**
- **Purpose**: Control who appears in Cost matrix and Teams
- **Changes**: Added `show_in_cost_matrix` (BOOLEAN, default false) to `people_pay_config`
- **Impact**: Per-person toggle to include/exclude from Cost matrix and Teams
- **Category**: People / Pay

**`20260213000003_create_people_teams.sql`**
- **Purpose**: Create teams for combined cost tracking
- **Changes**: Created `people_teams` (id, name) and `people_team_members` (team_id, person_name); RLS for pay-access users
- **Impact**: Pay tab Teams section; add teams, assign people, view combined cost for date range
- **Category**: People / Pay

**`20260213000002_create_people_hours.sql`**
- **Purpose**: Store hours worked per person per day
- **Changes**: Created `people_hours` (person_name, work_date, hours, entered_by); RLS for dev, approved masters, assistants
- **Impact**: Hours tab timesheet; editable for hourly people, read-only for salary (8 hrs/day)
- **Category**: People / Pay

**`20260213000001_create_people_pay_config.sql`**
- **Purpose**: Per-person pay configuration
- **Changes**: Created `people_pay_config` (person_name, hourly_wage, is_salary, show_in_hours); RLS for dev and approved masters
- **Impact**: Pay tab People pay config; wage, salary flag, Show in Hours toggle
- **Category**: People / Pay

**`20260213000000_create_pay_approved_masters.sql`**
- **Purpose**: Control access to Pay and Hours tabs
- **Changes**: Created `pay_approved_masters` (user_id); `is_pay_approved_master()` and `is_assistant_of_pay_approved_master()` functions; Settings section to manage approved masters
- **Impact**: Only dev and approved masters see Pay/Hours; assistants of approved masters see Hours
- **Category**: People / Pay

#### February 12, 2026

**`20260212260000_add_job_date_to_people_labor_jobs.sql`**
- **Purpose**: Add optional job date to labor jobs
- **Changes**: Added `job_date` (DATE, nullable) to `people_labor_jobs`
- **Impact**: When set, used for display in Ledger and print for sub; otherwise `created_at` is used
- **Category**: People / Labor

**`20260212250000_add_job_number_to_people_labor_jobs.sql`**
- **Purpose**: Add optional job number to labor jobs
- **Changes**: Added `job_number` (VARCHAR(10), nullable) to `people_labor_jobs`
- **Impact**: Shown in Labor form, Ledger, and print for sub
- **Category**: People / Labor

**`20260212240000_allow_estimators_see_masters.sql`**
- **Purpose**: Allow estimators to see masters in Customer Owner dropdown
- **Root Cause**: RLS blocked estimators from reading master_technician/dev users, causing "No masters found"
- **Changes**: Created `is_estimator()` SECURITY DEFINER function; added SELECT policy for estimators on users where role IN ('master_technician', 'dev')
- **Impact**: Estimators can add customers via Bids modal and select a master as owner
- **Category**: Access Control / RLS

**`20260212230000_allow_viewing_masters_see_sharing_masters.sql`**
- **Purpose**: Allow viewing masters and their assistants to see sharing masters' user rows
- **Root Cause**: "Created by [name]" showed "Unknown" when viewing shared people because users table RLS blocked reading dev/master rows
- **Changes**: Created `can_see_sharing_master()` SECURITY DEFINER function; added SELECT policy on users
- **Impact**: Creator names display correctly for shared people
- **Category**: Access Control / RLS

**`20260212220000_allow_assistants_read_master_shares_for_viewing.sql`**
- **Purpose**: Allow assistants to read master_shares where they assist the viewing master
- **Changes**: Added SELECT policy on `master_shares` for assistants whose master is the viewing_master_id
- **Impact**: Assistants (e.g., Taunya) can see people and labor jobs shared with their master (e.g., Malachi)
- **Category**: Access Control / RLS

**`20260212210000_add_master_shares_to_people.sql`**
- **Purpose**: Add master_shares support to people, people_labor_jobs, people_labor_job_items
- **Changes**: Added SELECT policies for shared access via master_shares and master_assistants; when Dev shares with another Master, both that Master and their assistants can see shared people and labor jobs
- **Impact**: Shared people and ledger visible to viewing master and their assistants
- **Category**: Access Control / People

**`20260212200000_add_is_fixed_to_people_labor_job_items.sql`**
- **Purpose**: Support fixed labor hours (like cost_estimate_labor_rows)
- **Changes**: Added `is_fixed` (BOOLEAN, default false) to `people_labor_job_items`; when true, labor hours = hrs_per_unit (count ignored)
- **Impact**: Labor form supports fixed-rate items
- **Category**: People / Labor

**`20260212190000_create_people_labor_jobs.sql`**
- **Purpose**: Create People Labor and Ledger tables
- **Changes**: Created `people_labor_jobs` (assigned_to_name, address, labor_rate) and `people_labor_job_items` (fixture, count, hrs_per_unit, sequence_order); RLS for dev, master, assistant, estimator
- **Impact**: Labor tab and Ledger tab on People page
- **Category**: People / Labor

**`20260212180000_add_estimator_cost_to_cost_estimates.sql`**
- **Purpose**: Add estimator cost parameters to cost estimates (per-count-type or flat amount)
- **Changes**:
  - Added `estimator_cost_per_count` (numeric(10,2), default 10) to `cost_estimates`
  - Added `estimator_cost_flat_amount` (numeric(10,2), nullable) to `cost_estimates`
- **Impact**: Enables estimator cost in Labor Total on Cost Estimate, Pricing, prints, and PDFs

**`20260212170000_add_service_type_filter_to_parts_price_count.sql`**
- **Purpose**: Make Price Book "Sort by #" respect the selected service type and enable Part Type/Manufacturer filters
- **Changes**:
  - Added optional `filter_service_type_id` (uuid, default NULL) parameter to `get_parts_ordered_by_price_count`
  - When provided, filters results to parts belonging to that service type
- **Impact**: Materials Price Book tab correctly filters by Plumbing/Electrical/HVAC when sorting by price count; Part Type and Manufacturer dropdowns now work
- **Category**: Materials Enhancement / Database

#### February 11, 2026

**`20260211200000_create_counts_fixture_groups.sql`**
- **Purpose**: Configurable quick-select groups for adding count rows in Bids
- **Changes**:
  - Created `counts_fixture_groups` (id, service_type_id, label, sequence_order)
  - Created `counts_fixture_group_items` (id, group_id, name, sequence_order)
  - RLS: All authenticated users can read; only devs can insert/update/delete
  - Seeded Plumbing fixture groups (Bathrooms, Kitchen, Laundry, Plumbing Fixtures, Appliances)
- **Impact**: Fixture quick-adds in Bids Counts are now managed per service type in Settings → Counts Quick-adds
- **Category**: Bids Enhancement / Settings

**`20260211210000_allow_devs_update_delete_people.sql`**
- **Purpose**: Allow devs to edit and delete people entries created by other users
- **Changes**:
  - Added "Devs can update any people" policy (UPDATE using is_dev())
  - Added "Devs can delete any people" policy (DELETE using is_dev())
- **Impact**: Devs can rename, update email/phone/notes, and delete people in Settings → People Created by Other Users
- **Category**: Access Control / Settings

#### February 10, 2026

**`add_fixed_price_to_pricing_assignments.sql`**
- **Purpose**: Add fixed price feature for flat-rate pricing in Bids Pricing tab
- **Root Cause**: Revenue calculations always multiplied price by count, which doesn't work for flat-rate items (permits, delivery fees, one-time charges)
- **Changes**:
  - Added `is_fixed_price` (BOOLEAN, default false) column to `bid_pricing_assignments`
  - Created index on `is_fixed_price` for query performance
  - Added column comment explaining behavior
- **Impact**: Users can now mark pricing assignments as fixed price to bypass count multiplication
- **Behavior**: 
  - Unchecked (default): Revenue = Price × Count
  - Checked: Revenue = Price (ignores count)
- **Category**: Bids Enhancement / User Feature

#### February 8, 2026

**`restrict_supply_house_deletion_to_devs.sql`**
- **Purpose**: Restrict supply house deletion to dev role only
- **Root Cause**: All roles (dev, master, assistant, estimator) could delete supply houses, risking accidental data loss
- **Changes**: Changed DELETE RLS policy to only allow 'dev' role
- **Impact**: Only devs can delete supply houses; UI delete button hidden for other roles
- **Category**: Access Control / Data Protection

**`preserve_price_history_on_deletion.sql`**
- **Purpose**: Preserve all price history records permanently, even after part/supply house deletion
- **Root Cause**: CASCADE constraints deleted historical pricing data when business entities were removed
- **Changes**: 
  - Made part_id and supply_house_id nullable
  - Changed both FK constraints from ON DELETE CASCADE to ON DELETE SET NULL
- **Impact**: Price history is now truly permanent; orphaned records show pricing trends even for deleted items
- **Category**: Database Improvements / Data Preservation

**`fix_price_history_user_deletion.sql`**
- **Purpose**: Allow user deletion when they have price history records
- **Root Cause**: NO ACTION constraint blocked deletion if user had changed_by records in material_part_price_history
- **Changes**: Changed material_part_price_history.changed_by FK to ON DELETE SET NULL
- **Impact**: Users can be deleted smoothly; price history preserved but attribution nulled
- **Category**: Database Improvements / User Management

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
- `add_fixed_price_to_pricing_assignments.sql` (Feb 10, 2026) - Fixed price feature for flat-rate items

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
- `20260212170000_add_service_type_filter_to_parts_price_count.sql` (Feb 12, 2026)
  - Function: Added `filter_service_type_id` parameter to `get_parts_ordered_by_price_count`
  - Price Book filters by service type when sorting by price count

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
- `20260212220000_allow_assistants_read_master_shares_for_viewing.sql` (Feb 12, 2026) - Assistants read master_shares
- `20260212230000_allow_viewing_masters_see_sharing_masters.sql` (Feb 12, 2026) - Creator names for shared people
- `20260212240000_allow_estimators_see_masters.sql` (Feb 12, 2026) - Estimators see masters in dropdown
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
- `20260212190000_create_people_labor_jobs.sql` (Feb 12, 2026) - Labor jobs and items tables
- `20260212200000_add_is_fixed_to_people_labor_job_items.sql` (Feb 12, 2026) - Fixed labor hours
- `20260212250000_add_job_number_to_people_labor_jobs.sql` (Feb 12, 2026) - Job number field
- `20260212260000_add_job_date_to_people_labor_jobs.sql` (Feb 12, 2026) - Job date field
- `20260212210000_add_master_shares_to_people.sql` (Feb 12, 2026) - Master shares for people/labor

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
