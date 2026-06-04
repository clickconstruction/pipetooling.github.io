-- Create master_superintendents junction table
-- Tracks which masters have "adopted" which superintendents
-- Mirrors master_primaries: masters adopt superintendents, devs can manage adoptions for any master

CREATE TABLE public.master_superintendents (
  master_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  superintendent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (master_id, superintendent_id)
);
CREATE INDEX IF NOT EXISTS idx_master_superintendents_master_id ON public.master_superintendents(master_id);
CREATE INDEX IF NOT EXISTS idx_master_superintendents_superintendent_id ON public.master_superintendents(superintendent_id);
ALTER TABLE public.master_superintendents ENABLE ROW LEVEL SECURITY;
-- Masters and devs can read all adoptions
CREATE POLICY "Masters and devs can read all superintendent adoptions"
ON public.master_superintendents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);
-- Masters can manage their own adoptions; devs can manage any master's adoptions
CREATE POLICY "Masters and devs can manage superintendent adoptions"
ON public.master_superintendents
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
-- Superintendents can read who has adopted them
CREATE POLICY "Superintendents can read who adopted them"
ON public.master_superintendents
FOR SELECT
USING (
  superintendent_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);
COMMENT ON TABLE public.master_superintendents IS 'Junction table tracking which masters have adopted which superintendents. Enables adoption-based access control.';
