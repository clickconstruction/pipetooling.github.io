-- Create master_shares junction table
-- Tracks which masters have shared their jobs with which other masters
-- This enables master-to-master sharing: one master can grant another master assistant-level access to their customers and projects

-- Drop table if it exists (in case of previous failed migration)
DROP TABLE IF EXISTS public.master_shares CASCADE;

CREATE TABLE public.master_shares (
  sharing_master_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewing_master_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sharing_master_id, viewing_master_id),
  -- Prevent self-sharing
  CHECK (sharing_master_id != viewing_master_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_shares_sharing_master_id ON public.master_shares(sharing_master_id);
CREATE INDEX IF NOT EXISTS idx_master_shares_viewing_master_id ON public.master_shares(viewing_master_id);

-- Enable RLS
ALTER TABLE public.master_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Masters and devs can read all shares
CREATE POLICY "Masters and devs can read all shares"
ON public.master_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Masters can manage shares where they are the sharing_master_id (they control who sees their jobs)
CREATE POLICY "Masters can manage their own shares"
ON public.master_shares
FOR ALL
USING (
  sharing_master_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
)
WITH CHECK (
  sharing_master_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);

-- Policy: Viewing masters can read shares where they are the viewing_master_id (to see who shared with them)
CREATE POLICY "Viewing masters can read shares they are part of"
ON public.master_shares
FOR SELECT
USING (
  viewing_master_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.master_shares IS 'Junction table tracking which masters have shared their jobs with which other masters. Enables masters to grant assistant-level access to their customers and projects.';
