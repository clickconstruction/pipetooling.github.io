-- Per-task mute: user mutes completed-task notifications for a specific checklist item
CREATE TABLE public.user_checklist_item_mute_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  muted_until timestamptz NOT NULL,
  PRIMARY KEY (user_id, checklist_item_id)
);
COMMENT ON TABLE public.user_checklist_item_mute_preferences IS 'Per-task mute: user mutes completed-task notifications for a specific checklist item.';
ALTER TABLE public.user_checklist_item_mute_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own checklist item mute"
  ON public.user_checklist_item_mute_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own checklist item mute"
  ON public.user_checklist_item_mute_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own checklist item mute"
  ON public.user_checklist_item_mute_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own checklist item mute"
  ON public.user_checklist_item_mute_preferences FOR DELETE
  USING (auth.uid() = user_id);
