-- Replace purchase_order_id (FK to internal POs) with purchase_order_number (plain text from supply house)
-- Preserve existing PO names before dropping the FK

-- Add new column
ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS purchase_order_number TEXT;

-- Copy PO names from linked purchase_orders before dropping the FK
UPDATE public.supply_house_invoices shi
SET purchase_order_number = po.name
FROM public.purchase_orders po
WHERE shi.purchase_order_id = po.id
  AND (shi.purchase_order_number IS NULL OR shi.purchase_order_number = '');

-- Drop the FK to internal purchase_orders
ALTER TABLE public.supply_house_invoices
  DROP COLUMN IF EXISTS purchase_order_id;

COMMENT ON COLUMN public.supply_house_invoices.purchase_order_number IS 'PO number from the supply house invoice (plain text reference).';
