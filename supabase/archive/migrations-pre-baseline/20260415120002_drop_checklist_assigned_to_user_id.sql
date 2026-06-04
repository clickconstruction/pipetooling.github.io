-- Multi-assignee checklist: drop assigned_to_user_id, use junction tables for RLS

-- checklist_items: replace "Users read checklist items assigned to them" with junction-based policy
DROP POLICY IF EXISTS "Users read checklist items assigned to them" ON public.checklist_items;

CREATE POLICY "Users read checklist items where assigned"
ON public.checklist_items FOR SELECT
USING (
  public.is_dev_or_master_or_assistant()
  OR EXISTS (
    SELECT 1 FROM public.checklist_item_assignees
    WHERE checklist_item_id = checklist_items.id AND user_id = auth.uid()
  )
);

-- checklist_instances: replace assigned_to_user_id-based policies with junction-based
DROP POLICY IF EXISTS "Users read own instances or dev master assistant read all" ON public.checklist_instances;

CREATE POLICY "Users read instances where assigned or dev master assistant"
ON public.checklist_instances FOR SELECT
USING (
  public.is_dev_or_master_or_assistant()
  OR EXISTS (
    SELECT 1 FROM public.checklist_instance_assignees
    WHERE checklist_instance_id = checklist_instances.id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users update own instances" ON public.checklist_instances;

CREATE POLICY "Users update instances where assigned"
ON public.checklist_instances FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_instance_assignees
    WHERE checklist_instance_id = checklist_instances.id AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklist_instance_assignees
    WHERE checklist_instance_id = checklist_instances.id AND user_id = auth.uid()
  )
);

-- Drop columns
ALTER TABLE public.checklist_items DROP COLUMN IF EXISTS assigned_to_user_id;
ALTER TABLE public.checklist_instances DROP COLUMN IF EXISTS assigned_to_user_id;
