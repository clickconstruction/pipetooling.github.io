-- Allow devs to delete any row in user_pinned_tabs (e.g. for "Unpin All" Cost matrix)
CREATE POLICY "Devs can delete any pinned tab" ON public.user_pinned_tabs
  FOR DELETE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'dev'
  );
