-- Idempotency ledger for Stripe webhook deliveries (Edge service_role). Dedupes on event.id to avoid duplicate mark-paid work.

CREATE TABLE public.stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stripe_webhook_events_received_at_idx
  ON public.stripe_webhook_events (received_at DESC);

COMMENT ON TABLE public.stripe_webhook_events IS
  'Stripe webhook event ids seen by stripe-webhook Edge Function; insert-first dedupes at-least-once deliveries.';

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Dev-only client reads; service role bypasses RLS for Edge inserts.
CREATE POLICY "stripe_webhook_events dev select"
  ON public.stripe_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_dev());

CREATE POLICY "stripe_webhook_events no insert"
  ON public.stripe_webhook_events
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "stripe_webhook_events no update"
  ON public.stripe_webhook_events
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "stripe_webhook_events no delete"
  ON public.stripe_webhook_events
  FOR DELETE
  TO authenticated
  USING (false);

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
