-- Allow assistants to INSERT customers when they assign a master who has adopted them
-- This policy enables assistants to create customers for masters who have adopted them via master_assistants table

CREATE POLICY "Assistants can insert customers when master is assigned and has adopted them"
ON public.customers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'assistant'
  )
  AND master_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = master_user_id
    AND u.role IN ('master_technician', 'dev')
  )
  AND EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
);
