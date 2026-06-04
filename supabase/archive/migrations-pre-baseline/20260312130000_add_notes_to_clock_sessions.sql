-- Add required notes column to clock_sessions for "what are you working on"
ALTER TABLE public.clock_sessions
ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.clock_sessions.notes IS 'What the user is working on during this session. Required at clock-in.';
