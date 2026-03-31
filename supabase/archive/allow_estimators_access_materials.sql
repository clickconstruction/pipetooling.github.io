-- Allow estimators full access to Materials (same as assistants)
-- Updates all RLS policies for materials-related tables to include 'estimator' role

-- ============================================================================
-- material_parts
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, and assistants can read material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs, masters, and assistants can update material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs, masters, and assistants can delete material parts" ON public.material_parts;

-- Create updated policies with estimators
CREATE POLICY "Devs, masters, assistants, and estimators can read material parts"
ON public.material_parts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert material parts"
ON public.material_parts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update material parts"
ON public.material_parts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete material parts"
ON public.material_parts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- ============================================================================
-- material_part_prices
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, and assistants can read material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs, masters, and assistants can update material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs, masters, and assistants can delete material part prices" ON public.material_part_prices;

-- Create updated policies with estimators
CREATE POLICY "Devs, masters, assistants, and estimators can read material part prices"
ON public.material_part_prices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert material part prices"
ON public.material_part_prices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update material part prices"
ON public.material_part_prices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete material part prices"
ON public.material_part_prices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- ============================================================================
-- material_part_price_history
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, and assistants can read price history" ON public.material_part_price_history;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert price history" ON public.material_part_price_history;

-- Create updated policies with estimators
CREATE POLICY "Devs, masters, assistants, and estimators can read price history"
ON public.material_part_price_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert price history"
ON public.material_part_price_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- ============================================================================
-- material_templates
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, and assistants can read material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs, masters, and assistants can update material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs, masters, and assistants can delete material templates" ON public.material_templates;

-- Create updated policies with estimators
CREATE POLICY "Devs, masters, assistants, and estimators can read material templates"
ON public.material_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert material templates"
ON public.material_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update material templates"
ON public.material_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete material templates"
ON public.material_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- ============================================================================
-- material_template_items
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, and assistants can read material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs, masters, and assistants can update material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs, masters, and assistants can delete material template items" ON public.material_template_items;

-- Create updated policies with estimators
CREATE POLICY "Devs, masters, assistants, and estimators can read material template items"
ON public.material_template_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert material template items"
ON public.material_template_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update material template items"
ON public.material_template_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete material template items"
ON public.material_template_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- ============================================================================
-- purchase_orders
-- Assistants should see all POs (like devs), not just their own
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, and assistants can read purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs, masters, and assistants can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs, masters, and assistants can delete purchase orders" ON public.purchase_orders;

-- Create updated policies with estimators (assistants see all POs like devs)
CREATE POLICY "Devs, masters, assistants, and estimators can read purchase orders"
ON public.purchase_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator')
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert purchase orders"
ON public.purchase_orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs, masters, assistants, and estimators can update purchase orders"
ON public.purchase_orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator')
    )
  )
  AND status = 'draft'  -- Only drafts can be updated
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator')
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete purchase orders"
ON public.purchase_orders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator')
    )
  )
);

-- ============================================================================
-- purchase_order_items
-- Assistants should see/edit items for all POs (like devs)
-- Note: Keep existing assistant price confirmation policy
-- ============================================================================

-- Drop existing policies (but keep the assistant price confirmation policy)
DROP POLICY IF EXISTS "Devs, masters, and assistants can read purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs, masters, and assistants can update purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs, masters, and assistants can delete purchase order items" ON public.purchase_order_items;

-- Create updated policies with estimators (assistants see all items like devs)
CREATE POLICY "Devs, masters, assistants, and estimators can read purchase order items"
ON public.purchase_order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert purchase order items"
ON public.purchase_order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items added
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update purchase order items"
ON public.purchase_order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items updated
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
    AND po.status = 'draft'
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete purchase order items"
ON public.purchase_order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND (
      po.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
    AND po.status = 'draft'  -- Only draft POs can have items deleted
  )
);

-- ============================================================================
-- supply_houses
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Devs, masters, and assistants can read supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs, masters, and assistants can update supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs, masters, and assistants can delete supply houses" ON public.supply_houses;

-- Create updated policies with estimators
CREATE POLICY "Devs, masters, assistants, and estimators can read supply houses"
ON public.supply_houses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert supply houses"
ON public.supply_houses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update supply houses"
ON public.supply_houses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete supply houses"
ON public.supply_houses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);
