-- Enable Realtime for people_hours so Pay/Hours tabs update when any user changes hours
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'people_hours'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.people_hours;
  END IF;
END
$$;
