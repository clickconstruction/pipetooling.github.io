-- Track which prospect copy templates have been "sent" (mail opened) per user per prospect

CREATE TABLE IF NOT EXISTS public.prospect_email_sent (
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (prospect_id, user_id, template_key)
);
COMMENT ON TABLE public.prospect_email_sent IS 'Tracks when a user opened mail for a prospect copy template. One row per (prospect, user, template).';
ALTER TABLE public.prospect_email_sent ENABLE ROW LEVEL SECURITY;
-- Devs, masters, assistants can see all
CREATE POLICY "Devs masters assistants can see all prospect_email_sent"
ON public.prospect_email_sent
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);
-- Users can insert their own rows
CREATE POLICY "Users can insert own prospect_email_sent"
ON public.prospect_email_sent
FOR INSERT
WITH CHECK (auth.uid() = user_id);
