-- Per-user visibility of dashboard quick-action buttons (Job, Job Labor, Bid, Project, Part, Assembly)
CREATE TABLE IF NOT EXISTS public.user_dashboard_buttons (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  button_key text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, button_key)
);

COMMENT ON TABLE public.user_dashboard_buttons IS 'Per-user visibility of dashboard quick-action buttons.';

ALTER TABLE public.user_dashboard_buttons ENABLE ROW LEVEL SECURITY;

-- Users can read/write only their own rows
CREATE POLICY "Users manage own dashboard buttons"
ON public.user_dashboard_buttons FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
