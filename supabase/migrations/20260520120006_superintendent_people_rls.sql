-- Superintendent: People RLS for Workflow assignment
-- Superintendent has no People page but needs to load assignable names from adopted masters' people

CREATE POLICY "Superintendent can see people from adopted masters"
ON public.people
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND EXISTS (
    SELECT 1 FROM public.master_superintendents
    WHERE master_id = master_user_id
    AND superintendent_id = auth.uid()
  )
);
COMMENT ON POLICY "Superintendent can see people from adopted masters" ON public.people IS
  'Allows superintendents to see people from masters who adopted them. Used for Workflow Assign dropdown.';
