-- Enable Realtime for clock_sessions so Hours tab updates when sessions change
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'clock_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clock_sessions;
  END IF;
END
$$;
