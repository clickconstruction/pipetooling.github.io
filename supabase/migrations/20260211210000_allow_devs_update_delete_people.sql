-- Allow devs to update and delete any people entries (for Settings "People Created by Other Users")

DROP POLICY IF EXISTS "Devs can update any people" ON public.people;
CREATE POLICY "Devs can update any people"
ON public.people
FOR UPDATE
USING (public.is_dev())
WITH CHECK (public.is_dev());

DROP POLICY IF EXISTS "Devs can delete any people" ON public.people;
CREATE POLICY "Devs can delete any people"
ON public.people
FOR DELETE
USING (public.is_dev());
