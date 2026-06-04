-- Multi-assignee checklist: junction table for checklist item assignees
-- One row per (item, user). Replaces single assigned_to_user_id.

CREATE TABLE public.checklist_item_assignees (
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (checklist_item_id, user_id)
);

COMMENT ON TABLE public.checklist_item_assignees IS 'Assignees for checklist items. One row per (item, user). Enables multi-assignee support.';

ALTER TABLE public.checklist_item_assignees ENABLE ROW LEVEL SECURITY;

-- Dev/master/assistant/primary can manage
CREATE POLICY "Devs masters assistants primaries can read checklist item assignees"
ON public.checklist_item_assignees FOR SELECT
USING (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants primaries can insert checklist item assignees"
ON public.checklist_item_assignees FOR INSERT
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants primaries can update checklist item assignees"
ON public.checklist_item_assignees FOR UPDATE
USING (public.is_dev_or_master_or_assistant())
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants primaries can delete checklist item assignees"
ON public.checklist_item_assignees FOR DELETE
USING (public.is_dev_or_master_or_assistant());

-- Users can read rows where they are assigned
CREATE POLICY "Users read checklist item assignees for themselves"
ON public.checklist_item_assignees FOR SELECT
USING (user_id = auth.uid());

-- Migrate existing data
INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id)
SELECT id, assigned_to_user_id
FROM public.checklist_items
WHERE assigned_to_user_id IS NOT NULL;
