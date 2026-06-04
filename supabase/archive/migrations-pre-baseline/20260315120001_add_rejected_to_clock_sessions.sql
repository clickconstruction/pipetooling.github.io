-- Add rejected_at and rejected_by to clock_sessions for Reject flow
ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clock_sessions.rejected_at IS 'When pay-access user rejected this session (moves to Rejected section)';
COMMENT ON COLUMN public.clock_sessions.rejected_by IS 'User who rejected this session';
