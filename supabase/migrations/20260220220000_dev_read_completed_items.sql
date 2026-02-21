-- Dev read completed items: track which completed checklist instances a dev has marked as read
CREATE TABLE public.dev_read_completed_items (
  dev_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_instance_id uuid NOT NULL REFERENCES public.checklist_instances(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (dev_user_id, checklist_instance_id)
);

COMMENT ON TABLE public.dev_read_completed_items IS 'Tracks which completed checklist instances a dev has marked as read on the Dashboard.';

ALTER TABLE public.dev_read_completed_items ENABLE ROW LEVEL SECURITY;

-- Only devs can SELECT their own read items
CREATE POLICY "Devs can select own read completed items"
  ON public.dev_read_completed_items FOR SELECT
  USING (
    auth.uid() = dev_user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  );

-- Only devs can INSERT for themselves
CREATE POLICY "Devs can insert own read completed items"
  ON public.dev_read_completed_items FOR INSERT
  WITH CHECK (
    auth.uid() = dev_user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  );

-- Only devs can DELETE their own (for un-mark-as-read)
CREATE POLICY "Devs can delete own read completed items"
  ON public.dev_read_completed_items FOR DELETE
  USING (
    auth.uid() = dev_user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  );
