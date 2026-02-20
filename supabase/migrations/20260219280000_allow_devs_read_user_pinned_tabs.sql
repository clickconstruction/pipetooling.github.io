-- Allow devs to read all user_pinned_tabs (e.g. to show who has Cost matrix pinned)
CREATE POLICY "Devs can select any pinned tab" ON public.user_pinned_tabs
  FOR SELECT USING (public.is_dev());
