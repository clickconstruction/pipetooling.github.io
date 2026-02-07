-- Allow assistants to UPDATE customers when the customer is owned by a master who has adopted them
-- This mirrors the INSERT policy logic for consistency

CREATE POLICY "Assistants can update customers when master has adopted them"
ON public.customers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'assistant'
  )
  AND master_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
)
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

COMMENT ON POLICY "Assistants can update customers when master has adopted them" ON public.customers IS 'Allows assistants to edit customer information for customers owned by masters who have adopted them. Ensures assistants cannot reassign customers to masters who have not adopted them.';
