-- Create master_assistants junction table
-- Tracks which masters have "adopted" which assistants
-- This enables many-to-many relationship: assistants can work for multiple masters

-- Drop table if it exists (in case of previous failed migration)
DROP TABLE IF EXISTS public.master_assistants CASCADE;

CREATE TABLE public.master_assistants (
  master_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (master_id, assistant_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_assistants_master_id ON public.master_assistants(master_id);
CREATE INDEX IF NOT EXISTS idx_master_assistants_assistant_id ON public.master_assistants(assistant_id);

-- Enable RLS
ALTER TABLE public.master_assistants ENABLE ROW LEVEL SECURITY;

-- Policy: Masters and devs can read all adoptions
CREATE POLICY "Masters and devs can read all adoptions"
ON public.master_assistants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Masters can manage their own adoptions (adopt/unadopt assistants)
CREATE POLICY "Masters can manage their own adoptions"
ON public.master_assistants
FOR ALL
USING (
  master_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
)
WITH CHECK (
  master_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);

-- Policy: Assistants can read who has adopted them
CREATE POLICY "Assistants can read who adopted them"
ON public.master_assistants
FOR SELECT
USING (
  assistant_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.master_assistants IS 'Junction table tracking which masters have adopted which assistants. Enables assistants to access customers and projects from masters who have adopted them.';
