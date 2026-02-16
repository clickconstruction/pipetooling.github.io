-- Allow assistants to read master_shares where they assist the viewing master.
-- This enables assistants (e.g., Taunya) to see people and labor jobs shared with
-- their master (e.g., Malachi) when the sharing master uses "Share with other Master".

CREATE POLICY "Assistants can read shares where they assist the viewing master"
ON public.master_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = viewing_master_id
    AND assistant_id = auth.uid()
  )
);
