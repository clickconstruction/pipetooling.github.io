-- Per-person day notes/events for Quickfill Schedule roster (work_date-style calendar days).

CREATE TABLE public.user_day_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.user_day_calendar_events IS
  'Per-person calendar notes for one calendar day (same YYYY-MM-DD convention as work_date); edited from Quickfill Schedule.';

CREATE INDEX idx_user_day_calendar_events_user_date
  ON public.user_day_calendar_events (user_id, event_date);

ALTER TABLE public.user_day_calendar_events ENABLE ROW LEVEL SECURITY;

-- Same role cohort as Quickfill Schedule section (no access for sub / estimator / primary by omission).
CREATE POLICY "user_day_calendar_events_schedule_roles_all"
  ON public.user_day_calendar_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users viewer
      WHERE viewer.id = auth.uid()
        AND viewer.role IN ('dev', 'master_technician', 'assistant', 'superintendent')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users viewer
      WHERE viewer.id = auth.uid()
        AND viewer.role IN ('dev', 'master_technician', 'assistant', 'superintendent')
    )
  );
