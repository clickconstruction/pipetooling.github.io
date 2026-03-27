-- Optional UI copy for Team Feedback inclusion step and Likert prompts (dev-editable via team_feedback_settings).

ALTER TABLE public.team_feedback_settings
  ADD COLUMN IF NOT EXISTS inclusion_title TEXT,
  ADD COLUMN IF NOT EXISTS inclusion_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS inclusion_label_manager TEXT,
  ADD COLUMN IF NOT EXISTS inclusion_label_peer TEXT,
  ADD COLUMN IF NOT EXISTS inclusion_label_open TEXT,
  ADD COLUMN IF NOT EXISTS manager_likert_prompts JSONB,
  ADD COLUMN IF NOT EXISTS peer_likert_prompts JSONB,
  ADD COLUMN IF NOT EXISTS manager_overall_prompt TEXT,
  ADD COLUMN IF NOT EXISTS manager_step_heading TEXT,
  ADD COLUMN IF NOT EXISTS peer_step_heading TEXT;

COMMENT ON COLUMN public.team_feedback_settings.inclusion_title IS 'Optional override for inclusion step title; null uses app default.';
COMMENT ON COLUMN public.team_feedback_settings.manager_likert_prompts IS 'JSON array of 5 strings for manager Likert prompts; null uses app default.';
