-- Team feedback: settings, submissions, user_state (Phase 1).
-- reviewer_user_id is for dev audit only; do not expose in manager UI.

CREATE TABLE public.team_feedback_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  cadence_days INTEGER NOT NULL DEFAULT 28 CHECK (cadence_days >= 1 AND cadence_days <= 365),
  intro_copy TEXT,
  thank_you_copy TEXT,
  manager_section_enabled BOOLEAN NOT NULL DEFAULT true,
  peer_section_enabled BOOLEAN NOT NULL DEFAULT false,
  home_entry_enabled BOOLEAN NOT NULL DEFAULT false,
  comment_only_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.team_feedback_settings (id) VALUES (1);

CREATE TABLE public.team_feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('clock_out_prompt', 'home_button', 'comment_only')),
  cycle_period_start DATE,
  manager_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  manager_likert_1 SMALLINT CHECK (manager_likert_1 IS NULL OR (manager_likert_1 >= 1 AND manager_likert_1 <= 5)),
  manager_likert_2 SMALLINT CHECK (manager_likert_2 IS NULL OR (manager_likert_2 >= 1 AND manager_likert_2 <= 5)),
  manager_likert_3 SMALLINT CHECK (manager_likert_3 IS NULL OR (manager_likert_3 >= 1 AND manager_likert_3 <= 5)),
  manager_likert_4 SMALLINT CHECK (manager_likert_4 IS NULL OR (manager_likert_4 >= 1 AND manager_likert_4 <= 5)),
  manager_likert_5 SMALLINT CHECK (manager_likert_5 IS NULL OR (manager_likert_5 >= 1 AND manager_likert_5 <= 5)),
  manager_overall_1_10 SMALLINT CHECK (manager_overall_1_10 IS NULL OR (manager_overall_1_10 >= 1 AND manager_overall_1_10 <= 10)),
  open_fix_improve TEXT,
  open_safety_tools TEXT,
  open_training TEXT
);

CREATE INDEX idx_team_feedback_submissions_reviewer ON public.team_feedback_submissions(reviewer_user_id);
CREATE INDEX idx_team_feedback_submissions_created ON public.team_feedback_submissions(created_at DESC);
CREATE INDEX idx_team_feedback_submissions_cycle ON public.team_feedback_submissions(cycle_period_start);
CREATE INDEX idx_team_feedback_submissions_manager ON public.team_feedback_submissions(manager_user_id);

CREATE TABLE public.team_feedback_user_state (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_prompt_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  last_skipped_at TIMESTAMPTZ,
  snooze_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.team_feedback_submissions IS 'Team feedback about management/peers; reviewer_user_id for dev audit only.';
COMMENT ON TABLE public.team_feedback_user_state IS 'Per-user cadence and snooze for feedback prompts.';

ALTER TABLE public.team_feedback_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_feedback_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_feedback_user_state ENABLE ROW LEVEL SECURITY;

-- Settings: all authenticated may read (enabled/cadence/copy for clients); dev updates.
CREATE POLICY "team_feedback_settings_select_authenticated"
ON public.team_feedback_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "team_feedback_settings_update_dev"
ON public.team_feedback_settings FOR UPDATE
TO authenticated
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- Submissions: insert own row only; raw rows dev-only (reporting via RPC/views in later migration).
CREATE POLICY "team_feedback_submissions_insert_own"
ON public.team_feedback_submissions FOR INSERT
TO authenticated
WITH CHECK (reviewer_user_id = auth.uid());

CREATE POLICY "team_feedback_submissions_select_dev"
ON public.team_feedback_submissions FOR SELECT
TO authenticated
USING (public.is_dev());

CREATE POLICY "team_feedback_submissions_delete_dev"
ON public.team_feedback_submissions FOR DELETE
TO authenticated
USING (public.is_dev());

-- User state: own row; dev all.
CREATE POLICY "team_feedback_user_state_select_own_or_dev"
ON public.team_feedback_user_state FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_dev());

CREATE POLICY "team_feedback_user_state_insert_own"
ON public.team_feedback_user_state FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "team_feedback_user_state_update_own_or_dev"
ON public.team_feedback_user_state FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_dev())
WITH CHECK (user_id = auth.uid() OR public.is_dev());

CREATE POLICY "team_feedback_user_state_delete_dev"
ON public.team_feedback_user_state FOR DELETE
TO authenticated
USING (public.is_dev());

GRANT SELECT ON public.team_feedback_settings TO authenticated;
GRANT UPDATE ON public.team_feedback_settings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.team_feedback_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_feedback_user_state TO authenticated;
