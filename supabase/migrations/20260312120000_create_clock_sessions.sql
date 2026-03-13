-- Clock sessions: user clock-in/out records. Approved sessions merge into people_hours.

CREATE TABLE public.clock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clocked_in_at TIMESTAMPTZ NOT NULL,
  clocked_out_at TIMESTAMPTZ,
  work_date DATE NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clock_sessions_user_open ON public.clock_sessions(user_id) WHERE clocked_out_at IS NULL;
CREATE INDEX idx_clock_sessions_pending ON public.clock_sessions(work_date, approved_at) WHERE approved_at IS NULL AND clocked_out_at IS NOT NULL;
CREATE INDEX idx_clock_sessions_user_date ON public.clock_sessions(user_id, work_date);

COMMENT ON TABLE public.clock_sessions IS 'User clock-in/out sessions. Approved sessions merge into people_hours.';

ALTER TABLE public.clock_sessions ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own sessions (for clock out, stopwatch)
CREATE POLICY "Users can read own clock sessions"
ON public.clock_sessions
FOR SELECT
USING (user_id = auth.uid());

-- Users can INSERT their own sessions (clock in)
CREATE POLICY "Users can insert own clock sessions"
ON public.clock_sessions
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can UPDATE own (clock out); pay-access can UPDATE any (approve, edit)
CREATE POLICY "Users and pay access can update clock sessions"
ON public.clock_sessions
FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

-- Pay-access can SELECT all (for Hours tab pending section)
CREATE POLICY "Pay access can read all clock sessions"
ON public.clock_sessions
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

-- Pay-access can DELETE (fix mistakes)
CREATE POLICY "Pay access can delete clock sessions"
ON public.clock_sessions
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);
