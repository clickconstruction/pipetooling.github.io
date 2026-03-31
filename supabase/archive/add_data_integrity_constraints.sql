-- Migration: Add data integrity constraints
-- Date: 2026-02-04
-- Purpose: Add check constraints and unique constraints to prevent invalid data

-- 1. Ensure purchase order item quantities are positive
ALTER TABLE purchase_order_items
DROP CONSTRAINT IF EXISTS purchase_order_items_quantity_positive;

ALTER TABLE purchase_order_items
ADD CONSTRAINT purchase_order_items_quantity_positive
CHECK (quantity > 0);

COMMENT ON CONSTRAINT purchase_order_items_quantity_positive ON purchase_order_items IS 
  'Ensures that all purchase order item quantities are greater than zero';

-- 2. Ensure bid count rows have non-negative counts
ALTER TABLE bids_count_rows
DROP CONSTRAINT IF EXISTS bids_count_rows_count_non_negative;

ALTER TABLE bids_count_rows
ADD CONSTRAINT bids_count_rows_count_non_negative
CHECK (count >= 0);

COMMENT ON CONSTRAINT bids_count_rows_count_non_negative ON bids_count_rows IS 
  'Ensures that count values cannot be negative';

-- 3. Ensure material template items are unique per template
-- This prevents accidentally adding the same part twice to a template
ALTER TABLE material_template_items
DROP CONSTRAINT IF EXISTS material_template_items_unique_item;

-- Only create unique constraint for parts (not nested templates, which can appear multiple times)
-- We'll create a unique index with a WHERE clause
DROP INDEX IF EXISTS material_template_items_unique_part_per_template;

CREATE UNIQUE INDEX material_template_items_unique_part_per_template
ON material_template_items (template_id, part_id)
WHERE item_type = 'part' AND part_id IS NOT NULL;

COMMENT ON INDEX material_template_items_unique_part_per_template IS 
  'Ensures that the same part cannot be added multiple times to the same template';

-- 4. Ensure prices are non-negative
ALTER TABLE material_part_prices
DROP CONSTRAINT IF EXISTS material_part_prices_price_non_negative;

ALTER TABLE material_part_prices
ADD CONSTRAINT material_part_prices_price_non_negative
CHECK (price >= 0);

COMMENT ON CONSTRAINT material_part_prices_price_non_negative ON material_part_prices IS 
  'Ensures that prices cannot be negative';

-- 5. Ensure purchase order item prices are non-negative
ALTER TABLE purchase_order_items
DROP CONSTRAINT IF EXISTS purchase_order_items_price_non_negative;

ALTER TABLE purchase_order_items
ADD CONSTRAINT purchase_order_items_price_non_negative
CHECK (price_at_time >= 0);

COMMENT ON CONSTRAINT purchase_order_items_price_non_negative ON purchase_order_items IS 
  'Ensures that prices cannot be negative';

-- 6. Improve projects foreign key with better cascading
-- Make sure that when a user is deleted, projects are handled properly
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_master_user_id_fkey;

ALTER TABLE projects
ADD CONSTRAINT projects_master_user_id_fkey
FOREIGN KEY (master_user_id) REFERENCES users(id)
ON DELETE SET NULL;

COMMENT ON CONSTRAINT projects_master_user_id_fkey ON projects IS 
  'Links projects to their master user. Sets to NULL if user is deleted.';
