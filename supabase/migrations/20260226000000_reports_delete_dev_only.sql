-- Restrict report DELETE to devs only. Masters, assistants, primaries keep SELECT/INSERT/UPDATE.

-- Drop existing FOR ALL policies
DROP POLICY IF EXISTS "Devs masters assistants can do all on reports" ON public.reports;
DROP POLICY IF EXISTS "Primary can do all on reports" ON public.reports;

-- Devs, masters, assistants: SELECT, INSERT, UPDATE (no DELETE)
CREATE POLICY "Devs masters assistants can select insert update reports"
ON public.reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs masters assistants can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs masters assistants can update reports"
ON public.reports
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

-- Devs only: DELETE
CREATE POLICY "Devs can delete reports"
ON public.reports
FOR DELETE
USING (public.is_dev());

-- Primary: SELECT, INSERT, UPDATE (no DELETE)
CREATE POLICY "Primary can select reports"
ON public.reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
);

CREATE POLICY "Primary can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
);

CREATE POLICY "Primary can update reports"
ON public.reports
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
);
