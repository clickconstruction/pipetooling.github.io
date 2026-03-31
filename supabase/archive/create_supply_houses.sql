-- Create supply_houses table for managing supply house information

CREATE TABLE IF NOT EXISTS public.supply_houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_supply_houses_name ON public.supply_houses(name);

-- Enable RLS
ALTER TABLE public.supply_houses ENABLE ROW LEVEL SECURITY;

-- Policy: Devs and masters can read all supply houses
CREATE POLICY "Devs and masters can read supply houses"
ON public.supply_houses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can insert supply houses
CREATE POLICY "Devs and masters can insert supply houses"
ON public.supply_houses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Devs and masters can update supply houses
CREATE POLICY "Devs and masters can update supply houses"
ON public.supply_houses
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

-- Policy: Devs and masters can delete supply houses
CREATE POLICY "Devs and masters can delete supply houses"
ON public.supply_houses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.supply_houses IS 'Supply houses that provide materials. Devs and masters can manage supply house information.';
