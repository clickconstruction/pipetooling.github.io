-- User Review Modal: enable realtime on the two Mercury tables that the
-- modal's Transactions section needs to re-render after off-screen edits
-- (Banking page allocations modal, Drag Sort, etc.).
--
-- Subscriber: `useUserMercuryWindow` in src/hooks/useUserMercuryWindow.ts
-- (Tier 1 publication rule — subscriber lands in the same PR).
--
-- Both tables already have RLS that restricts SELECT to banking staff
-- (dev / master_technician / assistant), so realtime broadcast inherits
-- the same gate — non-banking sockets receive nothing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mercury_transaction_attributions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mercury_transaction_attributions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mercury_transaction_job_allocations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mercury_transaction_job_allocations;
  END IF;
END $$;
