-- Allow users to read checklist_items for items assigned to them (needed for Today/History tab embeds)
CREATE POLICY "Users read checklist items assigned to them"
ON public.checklist_items FOR SELECT
USING (assigned_to_user_id = auth.uid());
