-- Restore Realtime CDC for the Dispatch inbox.
--
-- dispatch_requests and dispatch_request_notes were dropped from the supabase_realtime
-- publication during the 2026-06-05 connection-incident cleanup, which left the inbox's
-- postgres_changes subscriptions (useDispatchInbox) connected but permanently silent —
-- new requests/notes only appeared after a page reload. Both tables are low-volume
-- (a handful of rows per day), so re-adding them is safe for the connection pool.
--
-- Idempotent: skips tables already in the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dispatch_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dispatch_request_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_request_notes;
  END IF;
END $$;
