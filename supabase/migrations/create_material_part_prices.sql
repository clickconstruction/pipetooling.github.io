-- Create material_part_prices table for supply house pricing

CREATE TABLE IF NOT EXISTS public.material_part_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES public.material_parts(id) ON DELETE CASCADE,
  supply_house_id UUID NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL,
  effective_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(part_id, supply_house_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_material_part_prices_part_id ON public.material_part_prices(part_id);
CREATE INDEX IF NOT EXISTS idx_material_part_prices_supply_house_id ON public.material_part_prices(supply_house_id);
CREATE INDEX IF NOT EXISTS idx_material_part_prices_price ON public.material_part_prices(part_id, price);

-- Enable RLS
ALTER TABLE public.material_part_prices ENABLE ROW LEVEL SECURITY;

-- Policy: Devs and masters can read all prices
CREATE POLICY "Devs and masters can read material part prices"
ON public.material_part_prices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can insert prices
CREATE POLICY "Devs and masters can insert material part prices"
ON public.material_part_prices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can update prices
CREATE POLICY "Devs and masters can update material part prices"
ON public.material_part_prices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can delete prices
CREATE POLICY "Devs and masters can delete material part prices"
ON public.material_part_prices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.material_part_prices IS 'Prices for material parts per supply house. One price per part per supply house.';
