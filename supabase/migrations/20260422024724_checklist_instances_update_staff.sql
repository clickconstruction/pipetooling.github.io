-- Allow dev/master/assistant to UPDATE checklist_instances they can already SELECT
-- (e.g. completing another assignee's instance from Review). Assignees may still
-- update when they appear in checklist_instance_assignees.

DROP POLICY IF EXISTS "Users update instances where assigned" ON public.checklist_instances;

CREATE POLICY "Users update instances where assigned or staff"
ON public.checklist_instances FOR UPDATE
USING (
  public.is_dev_or_master_or_assistant()
  OR EXISTS (
    SELECT 1 FROM public.checklist_instance_assignees
    WHERE checklist_instance_id = checklist_instances.id AND user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_dev_or_master_or_assistant()
  OR EXISTS (
    SELECT 1 FROM public.checklist_instance_assignees
    WHERE checklist_instance_id = checklist_instances.id AND user_id = auth.uid()
  )
);
