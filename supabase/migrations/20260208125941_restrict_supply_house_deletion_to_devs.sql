-- Restrict supply house deletion to devs only
-- This prevents accidental deletion by other roles

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete supply houses" ON public.supply_houses;

-- Create new policy: only devs can delete
CREATE POLICY "Only devs can delete supply houses"
ON public.supply_houses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);

COMMENT ON POLICY "Only devs can delete supply houses" ON public.supply_houses IS 
'Restricts supply house deletion to dev role only to prevent accidental data loss.';
