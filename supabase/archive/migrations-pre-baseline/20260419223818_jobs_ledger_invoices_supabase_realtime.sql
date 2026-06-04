-- Dashboard Field collect-payment queue: Realtime on invoice rows (billed / stripe id) without flow row updates.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'jobs_ledger_invoices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs_ledger_invoices;
  END IF;
END $$;
