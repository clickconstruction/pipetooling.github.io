-- Migration: Add cascading update trigger for customer master_user_id
-- Date: 2026-02-04
-- Purpose: When a customer's master_user_id changes, automatically update all their projects
--          This maintains data consistency between customers and their projects

-- Create the cascade function
CREATE OR REPLACE FUNCTION cascade_customer_master_to_projects()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if master_user_id actually changed
  IF OLD.master_user_id IS DISTINCT FROM NEW.master_user_id THEN
    -- Update all projects belonging to this customer
    UPDATE projects
    SET 
      master_user_id = NEW.master_user_id,
      updated_at = NOW()
    WHERE customer_id = NEW.id;
    
    -- Log the number of updated projects for debugging
    RAISE NOTICE 'Cascaded master_user_id change from customer % to % projects', 
      NEW.id, 
      (SELECT COUNT(*) FROM projects WHERE customer_id = NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS cascade_customer_master_update ON customers;
CREATE TRIGGER cascade_customer_master_update
  AFTER UPDATE ON customers
  FOR EACH ROW
  WHEN (OLD.master_user_id IS DISTINCT FROM NEW.master_user_id)
  EXECUTE FUNCTION cascade_customer_master_to_projects();

-- Add comment
COMMENT ON FUNCTION cascade_customer_master_to_projects() IS 
  'Automatically updates master_user_id on all projects when their customer''s master_user_id changes. Maintains data consistency between customers and projects.';
