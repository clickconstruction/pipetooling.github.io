-- Allow assistants full access to Materials (same as masters)
-- Updates all RLS policies for materials-related tables to include 'assistant' role

-- ============================================================================
-- material_parts
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs and masters can read material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs and masters can insert material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs and masters can update material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs and masters can delete material parts" ON public.material_parts;

-- Create updated policies with assistants
CREATE POLICY "Devs, masters, and assistants can read material parts"
ON public.material_parts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can insert material parts"
ON public.material_parts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can update material parts"
ON public.material_parts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete material parts"
ON public.material_parts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- ============================================================================
-- material_part_prices
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs and masters can read material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs and masters can insert material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs and masters can update material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs and masters can delete material part prices" ON public.material_part_prices;

-- Create updated policies with assistants
CREATE POLICY "Devs, masters, and assistants can read material part prices"
ON public.material_part_prices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can insert material part prices"
ON public.material_part_prices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can update material part prices"
ON public.material_part_prices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete material part prices"
ON public.material_part_prices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- ============================================================================
-- material_part_price_history
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs and masters can read price history" ON public.material_part_price_history;
DROP POLICY IF EXISTS "Devs and masters can insert price history" ON public.material_part_price_history;

-- Create updated policies with assistants
CREATE POLICY "Devs, masters, and assistants can read price history"
ON public.material_part_price_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can insert price history"
ON public.material_part_price_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- ============================================================================
-- material_templates
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs and masters can read material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs and masters can insert material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs and masters can update material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs and masters can delete material templates" ON public.material_templates;

-- Create updated policies with assistants
CREATE POLICY "Devs, masters, and assistants can read material templates"
ON public.material_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can insert material templates"
ON public.material_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can update material templates"
ON public.material_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete material templates"
ON public.material_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- ============================================================================
-- material_template_items
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs and masters can read material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs and masters can insert material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs and masters can update material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs and masters can delete material template items" ON public.material_template_items;

-- Create updated policies with assistants
CREATE POLICY "Devs, masters, and assistants can read material template items"
ON public.material_template_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can insert material template items"
ON public.material_template_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can update material template items"
ON public.material_template_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete material template items"
ON public.material_template_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- ============================================================================
-- purchase_orders
-- Assistants should see all POs (like devs), not just their own
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs and masters can read purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs and masters can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs and masters can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs and masters can delete purchase orders" ON public.purchase_orders;

-- Create updated policies with assistants (assistants see all POs like devs)
CREATE POLICY "Devs, masters, and assistants can read purchase orders"
ON public.purchase_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can insert purchase orders"
ON public.purchase_orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs, masters, and assistants can update purchase orders"
ON public.purchase_orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
  AND status = 'draft'  -- Only drafts can be updated
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can delete purchase orders"
ON public.purchase_orders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
);

-- ============================================================================
-- purchase_order_items
-- Assistants should see/edit items for all POs (like devs)
-- Note: Keep existing assistant price confirmation policy
-- ============================================================================

-- Drop existing policies (but keep the assistant price confirmation policy)
DROP POLICY IF EXISTS "Devs and masters can read purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs and masters can insert purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs and masters can update purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs and masters can delete purchase order items" ON public.purchase_order_items;

-- Create updated policies with assistants (assistants see all items like devs)
CREATE POLICY "Devs, masters, and assistants can read purchase order items"
ON public.purchase_order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can insert purchase order items"
ON public.purchase_order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items added
  )
);

CREATE POLICY "Devs, masters, and assistants can update purchase order items"
ON public.purchase_order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items updated
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
    AND po.status = 'draft'
  )
);

CREATE POLICY "Devs, masters, and assistants can delete purchase order items"
ON public.purchase_order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items deleted
  )
);

-- ============================================================================
-- supply_houses
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs and masters can read supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs and masters can insert supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs and masters can update supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs and masters can delete supply houses" ON public.supply_houses;

-- Create updated policies with assistants
CREATE POLICY "Devs, masters, and assistants can read supply houses"
ON public.supply_houses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can insert supply houses"
ON public.supply_houses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can update supply houses"
ON public.supply_houses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete supply houses"
ON public.supply_houses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);
