-- prospect_timer_events: log timer value and button when user clicks No Longer a Fit, Next Prospect, or Can't reach
CREATE TABLE IF NOT EXISTS public.prospect_timer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  timer_seconds INTEGER NOT NULL,
  button_name TEXT NOT NULL CHECK (button_name IN ('no_longer_fit', 'next_prospect', 'cant_reach'))
);

CREATE INDEX IF NOT EXISTS idx_prospect_timer_events_user_id ON public.prospect_timer_events(user_id);
CREATE INDEX IF NOT EXISTS idx_prospect_timer_events_created_at ON public.prospect_timer_events(created_at DESC);

ALTER TABLE public.prospect_timer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own prospect timer events"
ON public.prospect_timer_events
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own prospect timer events"
ON public.prospect_timer_events
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);
