-- Multi-assignee checklist: junction table for checklist instance assignees
-- One row per (instance, user). Replaces single assigned_to_user_id on instances.

CREATE TABLE public.checklist_instance_assignees (
  checklist_instance_id uuid NOT NULL REFERENCES public.checklist_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (checklist_instance_id, user_id)
);

COMMENT ON TABLE public.checklist_instance_assignees IS 'Assignees for checklist instances. One row per (instance, user). Enables multi-assignee support.';

ALTER TABLE public.checklist_instance_assignees ENABLE ROW LEVEL SECURITY;

-- Dev/master/assistant/primary can manage
CREATE POLICY "Devs masters assistants primaries can read checklist instance assignees"
ON public.checklist_instance_assignees FOR SELECT
USING (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants primaries can insert checklist instance assignees"
ON public.checklist_instance_assignees FOR INSERT
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants primaries can update checklist instance assignees"
ON public.checklist_instance_assignees FOR UPDATE
USING (public.is_dev_or_master_or_assistant())
WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "Devs masters assistants primaries can delete checklist instance assignees"
ON public.checklist_instance_assignees FOR DELETE
USING (public.is_dev_or_master_or_assistant());

-- Users can read rows where they are assigned
CREATE POLICY "Users read checklist instance assignees for themselves"
ON public.checklist_instance_assignees FOR SELECT
USING (user_id = auth.uid());

-- Migrate existing data
INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id)
SELECT id, assigned_to_user_id
FROM public.checklist_instances
WHERE assigned_to_user_id IS NOT NULL;
