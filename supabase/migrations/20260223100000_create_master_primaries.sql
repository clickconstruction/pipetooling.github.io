-- Create master_primaries junction table
-- Tracks which masters have "adopted" which primaries
-- Mirrors master_assistants: masters adopt primaries, devs can manage adoptions for any master

CREATE TABLE public.master_primaries (
  master_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  primary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (master_id, primary_id)
);

CREATE INDEX IF NOT EXISTS idx_master_primaries_master_id ON public.master_primaries(master_id);
CREATE INDEX IF NOT EXISTS idx_master_primaries_primary_id ON public.master_primaries(primary_id);

ALTER TABLE public.master_primaries ENABLE ROW LEVEL SECURITY;

-- Masters and devs can read all adoptions
CREATE POLICY "Masters and devs can read all primary adoptions"
ON public.master_primaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);

-- Masters can manage their own adoptions; devs can manage any master's adoptions
CREATE POLICY "Masters and devs can manage primary adoptions"
ON public.master_primaries
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

-- Primaries can read who has adopted them
CREATE POLICY "Primaries can read who adopted them"
ON public.master_primaries
FOR SELECT
USING (
  primary_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);

COMMENT ON TABLE public.master_primaries IS 'Junction table tracking which masters have adopted which primaries. Enables organizational tracking and future access control.';
