-- Migration: Add automatic updated_at triggers to all tables
-- Date: 2026-02-04
-- Purpose: Automatically update updated_at timestamp on all UPDATE operations
--          Eliminates need for manual updated_at sets in application code

-- Create the trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables with updated_at column
-- Using IF NOT EXISTS equivalent pattern (DROP IF EXISTS, then CREATE)

-- bids
DROP TRIGGER IF EXISTS update_bids_updated_at ON bids;
CREATE TRIGGER update_bids_updated_at
  BEFORE UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- bids_gc_builders
DROP TRIGGER IF EXISTS update_bids_gc_builders_updated_at ON bids_gc_builders;
CREATE TRIGGER update_bids_gc_builders_updated_at
  BEFORE UPDATE ON bids_gc_builders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- cost_estimates
DROP TRIGGER IF EXISTS update_cost_estimates_updated_at ON cost_estimates;
CREATE TRIGGER update_cost_estimates_updated_at
  BEFORE UPDATE ON cost_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- email_templates
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- material_part_prices
DROP TRIGGER IF EXISTS update_material_part_prices_updated_at ON material_part_prices;
CREATE TRIGGER update_material_part_prices_updated_at
  BEFORE UPDATE ON material_part_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- material_parts
DROP TRIGGER IF EXISTS update_material_parts_updated_at ON material_parts;
CREATE TRIGGER update_material_parts_updated_at
  BEFORE UPDATE ON material_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- material_template_items
DROP TRIGGER IF EXISTS update_material_template_items_updated_at ON material_template_items;
CREATE TRIGGER update_material_template_items_updated_at
  BEFORE UPDATE ON material_template_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- material_templates
DROP TRIGGER IF EXISTS update_material_templates_updated_at ON material_templates;
CREATE TRIGGER update_material_templates_updated_at
  BEFORE UPDATE ON material_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- people
DROP TRIGGER IF EXISTS update_people_updated_at ON people;
CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- project_workflow_steps
DROP TRIGGER IF EXISTS update_project_workflow_steps_updated_at ON project_workflow_steps;
CREATE TRIGGER update_project_workflow_steps_updated_at
  BEFORE UPDATE ON project_workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- project_workflows
DROP TRIGGER IF EXISTS update_project_workflows_updated_at ON project_workflows;
CREATE TRIGGER update_project_workflows_updated_at
  BEFORE UPDATE ON project_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- projects
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- purchase_order_items
DROP TRIGGER IF EXISTS update_purchase_order_items_updated_at ON purchase_order_items;
CREATE TRIGGER update_purchase_order_items_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- purchase_orders
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- supply_houses
DROP TRIGGER IF EXISTS update_supply_houses_updated_at ON supply_houses;
CREATE TRIGGER update_supply_houses_updated_at
  BEFORE UPDATE ON supply_houses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- workflow_projections
DROP TRIGGER IF EXISTS update_workflow_projections_updated_at ON workflow_projections;
CREATE TRIGGER update_workflow_projections_updated_at
  BEFORE UPDATE ON workflow_projections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- workflow_step_line_items
DROP TRIGGER IF EXISTS update_workflow_step_line_items_updated_at ON workflow_step_line_items;
CREATE TRIGGER update_workflow_step_line_items_updated_at
  BEFORE UPDATE ON workflow_step_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- workflow_templates
DROP TRIGGER IF EXISTS update_workflow_templates_updated_at ON workflow_templates;
CREATE TRIGGER update_workflow_templates_updated_at
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
