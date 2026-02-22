-- Primary role: full Materials access (same as estimator)
-- Add 'primary' to all materials-related RLS policies

-- material_parts
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update material parts" ON public.material_parts;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete material parts" ON public.material_parts;

CREATE POLICY "Devs masters assistants estimators primaries can read material parts"
ON public.material_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert material parts"
ON public.material_parts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can update material parts"
ON public.material_parts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can delete material parts"
ON public.material_parts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

-- material_part_prices
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update material part prices" ON public.material_part_prices;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete material part prices" ON public.material_part_prices;

CREATE POLICY "Devs masters assistants estimators primaries can read material part prices"
ON public.material_part_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert material part prices"
ON public.material_part_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can update material part prices"
ON public.material_part_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can delete material part prices"
ON public.material_part_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

-- material_part_price_history
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read price history" ON public.material_part_price_history;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert price history" ON public.material_part_price_history;

CREATE POLICY "Devs masters assistants estimators primaries can read price history"
ON public.material_part_price_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert price history"
ON public.material_part_price_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

-- material_templates
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update material templates" ON public.material_templates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete material templates" ON public.material_templates;

CREATE POLICY "Devs masters assistants estimators primaries can read material templates"
ON public.material_templates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert material templates"
ON public.material_templates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can update material templates"
ON public.material_templates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can delete material templates"
ON public.material_templates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

-- material_template_items
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update material template items" ON public.material_template_items;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete material template items" ON public.material_template_items;

CREATE POLICY "Devs masters assistants estimators primaries can read material template items"
ON public.material_template_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert material template items"
ON public.material_template_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can update material template items"
ON public.material_template_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can delete material template items"
ON public.material_template_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

-- purchase_orders (Primary gets same as estimator: see own + dev/assistant/estimator see all)
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete purchase orders" ON public.purchase_orders;

CREATE POLICY "Devs masters assistants estimators primaries can read purchase orders"
ON public.purchase_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary')))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert purchase orders"
ON public.purchase_orders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND created_by = auth.uid()
);
CREATE POLICY "Devs masters assistants estimators primaries can update purchase orders"
ON public.purchase_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary')))
  AND status = 'draft'
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary')))
);
CREATE POLICY "Devs masters assistants estimators primaries can delete purchase orders"
ON public.purchase_orders FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary')))
);

-- purchase_order_items
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete purchase order items" ON public.purchase_order_items;

CREATE POLICY "Devs masters assistants estimators primaries can read purchase order items"
ON public.purchase_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id
    AND (po.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary'))))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert purchase order items"
ON public.purchase_order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id
    AND (po.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary')))
    AND po.status = 'draft')
);
CREATE POLICY "Devs masters assistants estimators primaries can update purchase order items"
ON public.purchase_order_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id
    AND (po.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary')))
    AND po.status = 'draft')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id
    AND (po.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary')))
    AND po.status = 'draft')
);
CREATE POLICY "Devs masters assistants estimators primaries can delete purchase order items"
ON public.purchase_order_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id
    AND (po.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'primary'))))
);

-- supply_houses
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update supply houses" ON public.supply_houses;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete supply houses" ON public.supply_houses;

CREATE POLICY "Devs masters assistants estimators primaries can read supply houses"
ON public.supply_houses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can insert supply houses"
ON public.supply_houses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can update supply houses"
ON public.supply_houses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can delete supply houses"
ON public.supply_houses FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
