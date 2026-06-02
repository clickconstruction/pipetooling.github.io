-- Assembly (material_template) bundle prices per supply house.
--
-- Parallels material_part_prices, but at the assembly level: a single price a supply
-- house quotes for an ENTIRE assembly (e.g. "BATH TUB - ROUGH IN" = $450 from Reece),
-- when they give a bundle discount without a per-part breakdown. One row per
-- (assembly, supply house); the app picks the lowest when more than one is recorded.
CREATE TABLE IF NOT EXISTS public.material_template_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.material_templates(id) ON DELETE CASCADE,
  supply_house_id UUID NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL CHECK (price >= 0),
  effective_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (template_id, supply_house_id)
);

CREATE INDEX IF NOT EXISTS idx_material_template_prices_template_id
  ON public.material_template_prices(template_id);

CREATE INDEX IF NOT EXISTS idx_material_template_prices_supply_house_id
  ON public.material_template_prices(supply_house_id);

COMMENT ON TABLE public.material_template_prices IS
  'Assembly-level supply-house bundle prices: one price a supply house quotes for an entire material_template (assembly), parallel to material_part_prices.';

ALTER TABLE public.material_template_prices ENABLE ROW LEVEL SECURITY;

-- Drop any leftovers from a failed apply, then recreate (idempotent).
DROP POLICY IF EXISTS material_template_prices_select ON public.material_template_prices;
DROP POLICY IF EXISTS material_template_prices_insert ON public.material_template_prices;
DROP POLICY IF EXISTS material_template_prices_update ON public.material_template_prices;
DROP POLICY IF EXISTS material_template_prices_delete ON public.material_template_prices;

-- Mirror material_part_prices access (same six roles).
CREATE POLICY material_template_prices_select
ON public.material_template_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);
CREATE POLICY material_template_prices_insert
ON public.material_template_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);
CREATE POLICY material_template_prices_update
ON public.material_template_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);
CREATE POLICY material_template_prices_delete
ON public.material_template_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);
