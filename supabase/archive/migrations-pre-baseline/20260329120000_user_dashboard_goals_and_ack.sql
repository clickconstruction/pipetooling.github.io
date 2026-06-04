-- Per-user daily goals (edited by dev / master / assistant) and per-calendar-day acknowledgment
CREATE TABLE IF NOT EXISTS public.user_dashboard_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_goals_user_id ON public.user_dashboard_goals(user_id);

COMMENT ON TABLE public.user_dashboard_goals IS 'Daily goals shown in full-screen gate after first clock-in; managed by dev/master/assistant per user.';

CREATE TABLE IF NOT EXISTS public.user_daily_goals_ack (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_date)
);
COMMENT ON TABLE public.user_daily_goals_ack IS 'User completed daily goals checklist for a calendar day (local work_date).';

ALTER TABLE public.user_dashboard_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_goals_ack ENABLE ROW LEVEL SECURITY;

-- Goals: read own rows
CREATE POLICY "Users select own dashboard goals"
ON public.user_dashboard_goals FOR SELECT
USING (auth.uid() = user_id);

-- Goals: dev / master / assistant full access for any user
CREATE POLICY "Dev master assistant manage dashboard goals"
ON public.user_dashboard_goals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- Ack: only own rows
CREATE POLICY "Users manage own daily goals ack"
ON public.user_daily_goals_ack FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
