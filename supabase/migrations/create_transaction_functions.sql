-- Migration: Create database functions for multi-step operations
-- Date: 2026-02-04
-- Purpose: Move complex multi-step operations to database functions with automatic transaction handling
--          This ensures data consistency and prevents partial failures

-- ============================================================================
-- Function 1: Create project with workflow template
-- ============================================================================
CREATE OR REPLACE FUNCTION create_project_with_template(
  p_name TEXT,
  p_customer_id UUID,
  p_address TEXT,
  p_master_user_id UUID,
  p_template_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_project_id UUID;
  v_workflow_id UUID;
  v_workflow_name TEXT;
  v_template_step RECORD;
BEGIN
  -- 1. Insert the project
  INSERT INTO projects (
    name,
    customer_id,
    address,
    master_user_id,
    status,
    notes,
    created_at,
    updated_at
  )
  VALUES (
    p_name,
    p_customer_id,
    p_address,
    p_master_user_id,
    'active',
    p_notes,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_project_id;

  -- 2. If template specified, create workflow and steps
  IF p_template_id IS NOT NULL THEN
    v_workflow_name := p_name || ' workflow';
    
    -- Create the workflow
    INSERT INTO project_workflows (
      project_id,
      template_id,
      name,
      created_at,
      updated_at
    )
    VALUES (
      v_project_id,
      p_template_id,
      v_workflow_name,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_workflow_id;

    -- Create all steps from the template
    FOR v_template_step IN
      SELECT id, sequence_order, name, step_type, required_skill
      FROM workflow_template_steps
      WHERE template_id = p_template_id
      ORDER BY sequence_order
    LOOP
      INSERT INTO project_workflow_steps (
        workflow_id,
        template_step_id,
        sequence_order,
        name,
        step_type,
        assigned_skill,
        status,
        created_at,
        updated_at
      )
      VALUES (
        v_workflow_id,
        v_template_step.id,
        v_template_step.sequence_order,
        v_template_step.name,
        v_template_step.step_type,
        v_template_step.required_skill,
        'pending',
        NOW(),
        NOW()
      );
    END LOOP;
    
    RETURN jsonb_build_object(
      'project_id', v_project_id,
      'workflow_id', v_workflow_id,
      'success', true
    );
  ELSE
    RETURN jsonb_build_object(
      'project_id', v_project_id,
      'workflow_id', NULL,
      'success', true
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction automatically rolls back on exception
    RAISE EXCEPTION 'Failed to create project with template: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_project_with_template IS 
  'Creates a project with optional workflow from template. All operations are transactional - if any step fails, all changes are rolled back.';

-- ============================================================================
-- Function 2: Duplicate purchase order
-- ============================================================================
CREATE OR REPLACE FUNCTION duplicate_purchase_order(
  p_source_po_id UUID,
  p_created_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_new_po_id UUID;
  v_source_po RECORD;
  v_item RECORD;
  v_items_copied INTEGER := 0;
BEGIN
  -- 1. Load source PO
  SELECT * INTO v_source_po
  FROM purchase_orders
  WHERE id = p_source_po_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source purchase order not found: %', p_source_po_id;
  END IF;

  -- 2. Create new draft PO
  INSERT INTO purchase_orders (
    name,
    status,
    created_by,
    notes,
    created_at,
    updated_at
  )
  VALUES (
    'Copy of ' || v_source_po.name,
    'draft',
    p_created_by,
    v_source_po.notes,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_po_id;

  -- 3. Copy all items from source PO
  FOR v_item IN
    SELECT 
      part_id,
      quantity,
      selected_supply_house_id,
      price_at_time,
      sequence_order,
      notes,
      source_template_id
    FROM purchase_order_items
    WHERE purchase_order_id = p_source_po_id
    ORDER BY sequence_order
  LOOP
    INSERT INTO purchase_order_items (
      purchase_order_id,
      part_id,
      quantity,
      selected_supply_house_id,
      price_at_time,
      sequence_order,
      notes,
      source_template_id,
      created_at,
      updated_at
    )
    VALUES (
      v_new_po_id,
      v_item.part_id,
      v_item.quantity,
      v_item.selected_supply_house_id,
      v_item.price_at_time,
      v_item.sequence_order,
      v_item.notes,
      v_item.source_template_id,
      NOW(),
      NOW()
    );
    
    v_items_copied := v_items_copied + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'new_po_id', v_new_po_id,
    'items_copied', v_items_copied,
    'success', true
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction automatically rolls back on exception
    RAISE EXCEPTION 'Failed to duplicate purchase order: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION duplicate_purchase_order IS 
  'Duplicates a purchase order with all its items as a new draft. Transactional - all or nothing.';

-- ============================================================================
-- Function 3: Copy workflow step with sequence adjustment
-- ============================================================================
CREATE OR REPLACE FUNCTION copy_workflow_step(
  p_step_id UUID,
  p_insert_after_sequence INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_source_step RECORD;
  v_workflow_id UUID;
  v_new_step_id UUID;
  v_new_sequence INTEGER;
BEGIN
  -- 1. Load source step
  SELECT * INTO v_source_step
  FROM project_workflow_steps
  WHERE id = p_step_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source step not found: %', p_step_id;
  END IF;

  v_workflow_id := v_source_step.workflow_id;
  v_new_sequence := p_insert_after_sequence + 1;

  -- 2. Update sequence_order for all steps after insert position
  UPDATE project_workflow_steps
  SET 
    sequence_order = sequence_order + 1,
    updated_at = NOW()
  WHERE workflow_id = v_workflow_id
    AND sequence_order >= v_new_sequence;

  -- 3. Create the new step
  INSERT INTO project_workflow_steps (
    workflow_id,
    template_step_id,
    sequence_order,
    name,
    step_type,
    assigned_skill,
    assigned_user_id,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_workflow_id,
    v_source_step.template_step_id,
    v_new_sequence,
    v_source_step.name || ' (Copy)',
    v_source_step.step_type,
    v_source_step.assigned_skill,
    NULL, -- Don't copy assignment
    'pending', -- Always start as pending
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_step_id;

  RETURN jsonb_build_object(
    'new_step_id', v_new_step_id,
    'new_sequence', v_new_sequence,
    'success', true
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction automatically rolls back on exception
    RAISE EXCEPTION 'Failed to copy workflow step: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION copy_workflow_step IS 
  'Copies a workflow step and inserts it at the specified position, adjusting sequence numbers. Transactional.';

-- ============================================================================
-- Function 4: Create takeoff book entry with items
-- ============================================================================
CREATE OR REPLACE FUNCTION create_takeoff_entry_with_items(
  p_bid_id UUID,
  p_page TEXT,
  p_entry_data JSONB,
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_entry_id UUID;
  v_item JSONB;
  v_items_created INTEGER := 0;
BEGIN
  -- 1. Create the entry
  INSERT INTO takeoff_book_entries (
    bid_id,
    page,
    item_type,
    item_size,
    fitting_type,
    created_at,
    updated_at
  )
  VALUES (
    p_bid_id,
    p_page,
    p_entry_data->>'item_type',
    p_entry_data->>'item_size',
    p_entry_data->>'fitting_type',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_entry_id;

  -- 2. Create all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO takeoff_book_entry_items (
      entry_id,
      quantity,
      location,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      v_entry_id,
      (v_item->>'quantity')::INTEGER,
      v_item->>'location',
      v_item->>'notes',
      NOW(),
      NOW()
    );
    
    v_items_created := v_items_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'entry_id', v_entry_id,
    'items_created', v_items_created,
    'success', true
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction automatically rolls back on exception
    RAISE EXCEPTION 'Failed to create takeoff entry with items: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_takeoff_entry_with_items IS 
  'Creates a takeoff book entry with multiple items. Transactional - all or nothing.';
