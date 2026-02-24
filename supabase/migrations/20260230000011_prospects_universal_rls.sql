-- Prospects list: universal visibility for all Devs, Masters, and Assistants
-- Same prospects visible to everyone with these roles

DROP POLICY IF EXISTS "Users can see prospects they own or from masters who adopted them" ON public.prospects;
CREATE POLICY "Devs, masters, and assistants can see all prospects"
ON public.prospects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

DROP POLICY IF EXISTS "Users can update prospects they own or from masters who adopted them" ON public.prospects;
CREATE POLICY "Devs, masters, and assistants can update all prospects"
ON public.prospects
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

DROP POLICY IF EXISTS "Users can delete prospects they own or from masters who adopted them" ON public.prospects;
CREATE POLICY "Devs, masters, and assistants can delete all prospects"
ON public.prospects
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- Update prospect_comments: same universal access for devs, masters, assistants
DROP POLICY IF EXISTS "Users can see prospect comments for prospects they can access" ON public.prospect_comments;
CREATE POLICY "Devs, masters, and assistants can see all prospect comments"
ON public.prospect_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

DROP POLICY IF EXISTS "Devs, masters, and assistants can insert prospect comments" ON public.prospect_comments;
CREATE POLICY "Devs, masters, and assistants can insert prospect comments"
ON public.prospect_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_id
  )
);

DROP POLICY IF EXISTS "Users can delete prospect comments for prospects they can access" ON public.prospect_comments;
CREATE POLICY "Devs, masters, and assistants can delete prospect comments"
ON public.prospect_comments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- Update prospect_callbacks INSERT: assistants can add callbacks for any prospect
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert prospect callbacks" ON public.prospect_callbacks;
CREATE POLICY "Devs, masters, and assistants can insert prospect callbacks"
ON public.prospect_callbacks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_id
  )
);
