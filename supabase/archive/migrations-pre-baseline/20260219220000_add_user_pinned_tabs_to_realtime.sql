-- Enable Realtime for user_pinned_tabs so Dashboard shows new pins immediately when a dev pins for a user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_pinned_tabs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_pinned_tabs;
  END IF;
END
$$;
