-- Customer estimate public link views and accept submissions (Edge service role INSERT only).

CREATE TABLE public.estimate_customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  source text NOT NULL,
  client_ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT estimate_customer_events_event_type_check
    CHECK (event_type IN ('public_link_view', 'public_accept_submitted')),
  CONSTRAINT estimate_customer_events_source_check
    CHECK (source IN ('get-estimate-for-customer', 'accept-estimate'))
);

CREATE INDEX idx_estimate_customer_events_estimate_occurred
  ON public.estimate_customer_events (estimate_id, occurred_at DESC);

COMMENT ON TABLE public.estimate_customer_events IS
  'Append-only audit: customer opened public quote link or submitted acceptance; rows inserted from Edge (service role) only.';

COMMENT ON COLUMN public.estimate_customer_events.event_type IS
  'public_link_view: successful get-estimate-for-customer 200; public_accept_submitted: successful accept-estimate.';

COMMENT ON COLUMN public.estimate_customer_events.source IS
  'Edge function that recorded the event.';

COMMENT ON COLUMN public.estimate_customer_events.metadata IS
  'Non-PII JSON, e.g. had_signature on accept; avoid storing printed name here.';

ALTER TABLE public.estimate_customer_events ENABLE ROW LEVEL SECURITY;

-- Same visibility shape as estimates_select: staff roles + parent estimate access (or broad staff roles branch).
CREATE POLICY estimate_customer_events_select
ON public.estimate_customer_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN (
      'dev',
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent'
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = estimate_id
    AND (
      public.user_can_access_estimate(e)
      OR public.superintendent_can_access_estimate(e)
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN (
          'dev',
          'assistant',
          'estimator',
          'master_technician',
          'primary'
        )
      )
    )
  )
);

GRANT SELECT ON public.estimate_customer_events TO authenticated;
