-- User preference to mute completed task notifications (1 week, 1 month, or forever)
CREATE TABLE public.user_completed_task_mute_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_until timestamptz NOT NULL,
  PRIMARY KEY (user_id)
);
COMMENT ON TABLE public.user_completed_task_mute_preferences IS 'When a user has muted completed task notifications; muted_until determines when it expires (use far-future for forever).';
ALTER TABLE public.user_completed_task_mute_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own completed task mute preference"
  ON public.user_completed_task_mute_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completed task mute preference"
  ON public.user_completed_task_mute_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completed task mute preference"
  ON public.user_completed_task_mute_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own completed task mute preference"
  ON public.user_completed_task_mute_preferences FOR DELETE
  USING (auth.uid() = user_id);
