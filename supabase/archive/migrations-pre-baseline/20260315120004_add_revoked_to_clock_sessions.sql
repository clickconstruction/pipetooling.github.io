-- Add revoked_at and revoked_by for accountability when sessions are revoked back to Pending

ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clock_sessions.revoked_at IS 'When pay-access user revoked this session (moves back to Pending)';
COMMENT ON COLUMN public.clock_sessions.revoked_by IS 'User who revoked this session';
