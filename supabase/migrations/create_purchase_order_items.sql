-- Create purchase_order_items table

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.material_parts(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  selected_supply_house_id UUID REFERENCES public.supply_houses(id),
  price_at_time NUMERIC(10, 2) NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_part_id ON public.purchase_order_items(part_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_sequence_order ON public.purchase_order_items(purchase_order_id, sequence_order);

-- Enable RLS
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Devs and masters can read items for purchase orders they can access
CREATE POLICY "Devs and masters can read purchase order items"
ON public.purchase_order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'dev'
      )
    )
  )
);

-- Policy: Devs and masters can insert items for purchase orders they own
CREATE POLICY "Devs and masters can insert purchase order items"
ON public.purchase_order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'dev'
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items added
  )
);

-- Policy: Devs and masters can update items for draft purchase orders they own
CREATE POLICY "Devs and masters can update purchase order items"
ON public.purchase_order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'dev'
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items updated
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'dev'
      )
    )
    AND po.status = 'draft'
  )
);

-- Policy: Devs and masters can delete items for draft purchase orders they own
CREATE POLICY "Devs and masters can delete purchase order items"
ON public.purchase_order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'dev'
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items deleted
  )
);

-- Add comment
COMMENT ON TABLE public.purchase_order_items IS 'Items within purchase orders. Contains part, quantity, selected supply house, and price snapshot.';
