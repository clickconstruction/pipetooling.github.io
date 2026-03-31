-- Create material_part_price_history table for tracking price changes over time

CREATE TABLE IF NOT EXISTS public.material_part_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES public.material_parts(id) ON DELETE CASCADE,
  supply_house_id UUID NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2) NOT NULL,
  price_change_percent NUMERIC(10, 2),
  effective_date DATE,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_history_part_id ON public.material_part_price_history(part_id);
CREATE INDEX IF NOT EXISTS idx_price_history_supply_house_id ON public.material_part_price_history(supply_house_id);
CREATE INDEX IF NOT EXISTS idx_price_history_changed_at ON public.material_part_price_history(part_id, supply_house_id, changed_at DESC);

-- Enable RLS
ALTER TABLE public.material_part_price_history ENABLE ROW LEVEL SECURITY;

-- Policy: Devs and masters can read all price history
CREATE POLICY "Devs and masters can read price history"
ON public.material_part_price_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can insert price history
CREATE POLICY "Devs and masters can insert price history"
ON public.material_part_price_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.material_part_price_history IS 'Historical record of all price changes for material parts across supply houses. Tracks old price, new price, percentage change, and when the change occurred.';
