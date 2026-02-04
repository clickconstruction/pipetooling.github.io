# Database Fixes Test Plan

## Overview
This document outlines tests for the database improvements implemented on 2026-02-04.

## Test Categories

### 1. Automatic updated_at Timestamps

**Test**: Verify triggers automatically set updated_at on UPDATE operations

**Steps**:
1. Update any record in tables: customers, projects, material_parts, etc.
2. Check that updated_at is automatically set to current timestamp
3. Verify old code without manual updated_at sets still works

**SQL Test**:
```sql
-- Test on customers table
UPDATE customers SET name = name WHERE id = '<some-id>';
SELECT id, name, updated_at FROM customers WHERE id = '<some-id>';
-- Verify updated_at changed

-- Test on projects table
UPDATE projects SET status = status WHERE id = '<some-id>';
SELECT id, name, updated_at FROM projects WHERE id = '<some-id>';
-- Verify updated_at changed
```

**Expected**: updated_at should be set to NOW() automatically

---

### 2. Cascading Customer Master Updates

**Test**: Verify projects update when customer master_user_id changes

**Steps**:
1. Create a test customer with master_user_id = user_A
2. Create test projects for that customer (should inherit master_user_id = user_A)
3. Update customer master_user_id to user_B
4. Verify all projects now have master_user_id = user_B

**SQL Test**:
```sql
-- Create test customer
INSERT INTO customers (name, master_user_id) 
VALUES ('Test Customer', '<user_A_id>') 
RETURNING id;

-- Create test project
INSERT INTO projects (name, customer_id, master_user_id, address, status)
VALUES ('Test Project', '<customer_id>', '<user_A_id>', '123 Test St', 'active')
RETURNING id;

-- Verify initial state
SELECT p.id, p.name, p.master_user_id, c.master_user_id as customer_master
FROM projects p
JOIN customers c ON p.customer_id = c.id
WHERE c.id = '<customer_id>';

-- Update customer master
UPDATE customers 
SET master_user_id = '<user_B_id>' 
WHERE id = '<customer_id>';

-- Verify cascade worked
SELECT p.id, p.name, p.master_user_id, c.master_user_id as customer_master
FROM projects p
JOIN customers c ON p.customer_id = c.id
WHERE c.id = '<customer_id>';
-- Both should now be user_B_id
```

**Expected**: Project master_user_id should automatically update to match customer

---

### 3. Price History Tracking

**Test**: Verify price changes create history records

**Steps**:
1. Create or select a material_part_price
2. Note the original price
3. Update the price to a new value
4. Check material_part_price_history for a new record

**SQL Test**:
```sql
-- Check current price
SELECT * FROM material_part_prices WHERE id = '<price_id>';

-- Update price
UPDATE material_part_prices 
SET price = 99.99 
WHERE id = '<price_id>';

-- Check history was created
SELECT * FROM material_part_price_history 
WHERE part_id = '<part_id>' 
  AND supply_house_id = '<supply_house_id>'
ORDER BY changed_at DESC 
LIMIT 1;
-- Should show old_price, new_price, and change_percent
```

**Expected**: History record created with old price, new price, and percentage change

---

### 4. Data Integrity Constraints

**Test**: Verify constraints prevent invalid data

**Test 4a - Positive Quantity Constraint**:
```sql
-- This should FAIL
INSERT INTO purchase_order_items (
  purchase_order_id, part_id, quantity, 
  selected_supply_house_id, price_at_time, sequence_order
)
VALUES ('<po_id>', '<part_id>', -5, '<sh_id>', 10.00, 1);
-- Expected error: quantity must be > 0
```

**Test 4b - Non-negative Count Constraint**:
```sql
-- This should FAIL
INSERT INTO bids_count_rows (bid_id, page, count)
VALUES ('<bid_id>', 'test', -1);
-- Expected error: count must be >= 0
```

**Test 4c - Non-negative Price Constraint**:
```sql
-- This should FAIL
UPDATE material_part_prices SET price = -10.00 WHERE id = '<price_id>';
-- Expected error: price must be >= 0
```

**Test 4d - Unique Part per Template**:
```sql
-- Create a template item
INSERT INTO material_template_items (template_id, part_id, item_type, quantity)
VALUES ('<template_id>', '<part_id>', 'part', 1);

-- Try to add the same part again - should FAIL
INSERT INTO material_template_items (template_id, part_id, item_type, quantity)
VALUES ('<template_id>', '<part_id>', 'part', 2);
-- Expected error: unique constraint violation
```

**Expected**: All invalid operations should fail with appropriate constraint errors

---

### 5. Database Functions - Project Creation

**Test**: Verify create_project_with_template function works transactionally

**Test 5a - Success Case**:
```sql
SELECT create_project_with_template(
  'Test Project'::TEXT,
  '<customer_id>'::UUID,
  '123 Test Street'::TEXT,
  '<user_id>'::UUID,
  '<template_id>'::UUID,
  'Test notes'::TEXT
);
-- Should return: {"project_id": "...", "workflow_id": "...", "success": true}

-- Verify project created
SELECT * FROM projects WHERE name = 'Test Project';

-- Verify workflow created
SELECT * FROM project_workflows WHERE project_id = '<returned_project_id>';

-- Verify steps created from template
SELECT * FROM project_workflow_steps WHERE workflow_id = '<returned_workflow_id>';
```

**Test 5b - Rollback on Failure**:
```sql
-- Try with invalid template_id (should fail and rollback)
SELECT create_project_with_template(
  'Test Project Fail'::TEXT,
  '<customer_id>'::UUID,
  '123 Test Street'::TEXT,
  '<user_id>'::UUID,
  '00000000-0000-0000-0000-000000000000'::UUID,  -- Non-existent template
  NULL
);
-- Should raise error

-- Verify no orphaned project was created
SELECT * FROM projects WHERE name = 'Test Project Fail';
-- Should return empty (rollback worked)
```

**Expected**: 
- Success case creates project, workflow, and all steps
- Failure case doesn't create any records (full rollback)

---

### 6. Database Functions - Purchase Order Duplication

**Test**: Verify duplicate_purchase_order function works transactionally

**Test 6a - Success Case**:
```sql
-- Get source PO item count
SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = '<source_po_id>';

-- Duplicate the PO
SELECT duplicate_purchase_order(
  '<source_po_id>'::UUID,
  '<user_id>'::UUID
);
-- Should return: {"new_po_id": "...", "items_copied": N, "success": true}

-- Verify new PO created as draft
SELECT * FROM purchase_orders WHERE id = '<returned_new_po_id>';
-- status should be 'draft'
-- name should be 'Copy of <original_name>'

-- Verify all items copied
SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = '<new_po_id>';
-- Should match items_copied count
```

**Test 6b - Rollback on Failure**:
```sql
-- Try with non-existent source PO (should fail and rollback)
SELECT duplicate_purchase_order(
  '00000000-0000-0000-0000-000000000000'::UUID,
  '<user_id>'::UUID
);
-- Should raise error: Source purchase order not found

-- Verify no orphaned records
SELECT * FROM purchase_orders WHERE name LIKE 'Copy of%' AND created_at > NOW() - INTERVAL '1 minute';
-- Should not find the failed PO
```

**Expected**:
- Success case creates new PO with all items
- Failure case doesn't create any records (full rollback)

---

### 7. Database Functions - Workflow Step Copy

**Test**: Verify copy_workflow_step function maintains sequence order

**Test 7a - Success Case**:
```sql
-- Get current step order
SELECT id, name, sequence_order 
FROM project_workflow_steps 
WHERE workflow_id = '<workflow_id>'
ORDER BY sequence_order;

-- Copy a step to insert after position 2
SELECT copy_workflow_step(
  '<step_id>'::UUID,
  2::INTEGER
);
-- Should return: {"new_step_id": "...", "new_sequence": 3, "success": true}

-- Verify sequence order updated correctly
SELECT id, name, sequence_order 
FROM project_workflow_steps 
WHERE workflow_id = '<workflow_id>'
ORDER BY sequence_order;
-- Step originally at position 3 should now be at 4
-- New copied step should be at position 3
```

**Expected**: 
- New step inserted at correct position
- All subsequent steps incremented by 1
- No gaps in sequence order

---

### 8. Error Handling

**Test**: Verify frontend error handling improvements

**Manual UI Tests**:

**Test 8a - Project Deletion**:
1. Go to project form
2. Try to delete a project
3. Verify comprehensive error messages if any step fails
4. Check browser console for proper error logging

**Test 8b - Workflow Step Deletion**:
1. Open a workflow
2. Try to delete a step
3. Verify error handling if dependencies exist
4. Check that all related data is cleaned up

**Expected**: 
- Clear error messages to users
- No partial deletions (all-or-nothing)
- Proper error logging in console

---

### 9. Integration Tests

**Manual UI Tests**:

**Test 9a - Create Project with Template**:
1. Go to New Project form
2. Fill in all required fields
3. Select a workflow template
4. Submit
5. Verify project, workflow, and steps all created
6. Check that updated_at timestamps are set

**Test 9b - Duplicate Purchase Order**:
1. Go to Materials page
2. Find an existing PO with multiple items
3. Click "Duplicate as Draft"
4. Verify new PO created with status = 'draft'
5. Verify all items copied correctly
6. Check that confirmation status was reset

**Test 9c - Update Customer Master**:
1. Find a customer with projects
2. Change the customer's master user
3. Verify all associated projects update automatically
4. Check that updated_at set on both customer and projects

**Expected**: All operations complete successfully with proper data consistency

---

## Test Execution Checklist

- [ ] 1. Test updated_at triggers on all tables
- [ ] 2. Test customer master cascade to projects
- [ ] 3. Test price history tracking
- [ ] 4. Test data integrity constraints
  - [ ] 4a. Positive quantity constraint
  - [ ] 4b. Non-negative count constraint
  - [ ] 4c. Non-negative price constraint
  - [ ] 4d. Unique part per template
- [ ] 5. Test create_project_with_template
  - [ ] 5a. Success case
  - [ ] 5b. Rollback case
- [ ] 6. Test duplicate_purchase_order
  - [ ] 6a. Success case
  - [ ] 6b. Rollback case
- [ ] 7. Test copy_workflow_step
  - [ ] 7a. Success case
- [ ] 8. Test error handling
  - [ ] 8a. Project deletion
  - [ ] 8b. Workflow step deletion
- [ ] 9. Integration tests
  - [ ] 9a. Create project with template
  - [ ] 9b. Duplicate purchase order
  - [ ] 9c. Update customer master

---

## Rollback Plan

If any issues are found, migrations can be rolled back individually:

```sql
-- Rollback updated_at triggers
DROP TRIGGER IF EXISTS update_<table>_updated_at ON <table>;

-- Rollback cascading triggers
DROP TRIGGER IF EXISTS cascade_customer_master_update ON customers;
DROP FUNCTION IF EXISTS cascade_customer_master_to_projects();

-- Rollback constraints
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_quantity_positive;
ALTER TABLE bids_count_rows DROP CONSTRAINT IF EXISTS bids_count_rows_count_non_negative;
-- etc.

-- Rollback functions
DROP FUNCTION IF EXISTS create_project_with_template;
DROP FUNCTION IF EXISTS duplicate_purchase_order;
DROP FUNCTION IF EXISTS copy_workflow_step;
DROP FUNCTION IF EXISTS create_takeoff_entry_with_items;
```

---

## Notes

- All database changes are backward compatible with existing code
- Frontend code changes are additive (new utilities, improved error handling)
- Triggers and constraints enhance data integrity without breaking existing functionality
- Database functions provide atomic alternatives to multi-step operations but don't replace existing code yet
