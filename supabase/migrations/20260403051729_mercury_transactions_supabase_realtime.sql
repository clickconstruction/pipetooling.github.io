-- Realtime: Banking / Quickfill Sorting refetch when mercury_transactions changes (e.g. mercury-webhook upsert).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mercury_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mercury_transactions;
  END IF;
END
$$;
