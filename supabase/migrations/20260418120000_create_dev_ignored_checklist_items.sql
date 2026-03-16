-- Task types a dev has chosen to move to the Ignored section in Recently Completed Tasks
CREATE TABLE public.dev_ignored_checklist_items (
  dev_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  ignored_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (dev_user_id, checklist_item_id)
);
COMMENT ON TABLE public.dev_ignored_checklist_items IS 'Task types a dev has chosen to move to the Ignored section in Recently Completed Tasks.';
ALTER TABLE public.dev_ignored_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs select own ignored checklist items"
  ON public.dev_ignored_checklist_items FOR SELECT
  USING (
    auth.uid() = dev_user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  );

CREATE POLICY "Devs insert own ignored checklist items"
  ON public.dev_ignored_checklist_items FOR INSERT
  WITH CHECK (
    auth.uid() = dev_user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  );

CREATE POLICY "Devs delete own ignored checklist items"
  ON public.dev_ignored_checklist_items FOR DELETE
  USING (
    auth.uid() = dev_user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  );
