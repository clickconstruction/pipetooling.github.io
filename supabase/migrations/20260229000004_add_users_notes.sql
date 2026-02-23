-- Add notes column to users table for general notes on each user
-- Masters, Assistants, and Devs can edit these notes from the People > Users page

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notes text;

-- Allow Masters, Assistants, and Devs to update user notes
DROP POLICY IF EXISTS "Masters assistants devs can update user notes" ON public.users;
CREATE POLICY "Masters assistants devs can update user notes"
ON public.users FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
);
