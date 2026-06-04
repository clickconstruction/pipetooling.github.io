-- Idempotency ledger for Mercury webhook deliveries (Edge service_role).
-- Mercury retries failed deliveries with exponential backoff (at-least-once);
-- the mercury-webhook function inserts-first keyed on the per-delivery signature
-- so retries are deduped. Genuine later updates to the same transaction carry a
-- different signed payload (different key) and are still processed.
-- Mirrors stripe_webhook_events.

CREATE TABLE IF NOT EXISTS public.mercury_webhook_events (
  event_key text PRIMARY KEY,
  resource_type text,
  resource_id text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mercury_webhook_events_received_at_idx
  ON public.mercury_webhook_events (received_at DESC);

COMMENT ON TABLE public.mercury_webhook_events IS
  'Mercury webhook delivery keys seen by mercury-webhook Edge Function; insert-first dedupes at-least-once retries.';

ALTER TABLE public.mercury_webhook_events ENABLE ROW LEVEL SECURITY;

-- Dev-only client reads; service role bypasses RLS for Edge inserts.
DROP POLICY IF EXISTS "mercury_webhook_events dev select" ON public.mercury_webhook_events;
CREATE POLICY "mercury_webhook_events dev select"
  ON public.mercury_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_dev());

DROP POLICY IF EXISTS "mercury_webhook_events no insert" ON public.mercury_webhook_events;
CREATE POLICY "mercury_webhook_events no insert"
  ON public.mercury_webhook_events
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "mercury_webhook_events no update" ON public.mercury_webhook_events;
CREATE POLICY "mercury_webhook_events no update"
  ON public.mercury_webhook_events
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "mercury_webhook_events no delete" ON public.mercury_webhook_events;
CREATE POLICY "mercury_webhook_events no delete"
  ON public.mercury_webhook_events
  FOR DELETE
  TO authenticated
  USING (false);

GRANT SELECT ON public.mercury_webhook_events TO authenticated;
GRANT ALL ON public.mercury_webhook_events TO service_role;
