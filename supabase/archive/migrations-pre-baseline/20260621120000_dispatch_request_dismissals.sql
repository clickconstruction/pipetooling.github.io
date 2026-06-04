-- Per-user dismissals of closed dispatch requests. When a dispatch user dismisses a closed request,
-- it is hidden from their inbox. Other users still see it until they dismiss it.
CREATE TABLE public.dispatch_request_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.dispatch_requests(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

COMMENT ON TABLE public.dispatch_request_dismissals IS 'Per-user dismissals of closed dispatch requests. Users hide closed items from their own inbox.';

ALTER TABLE public.dispatch_request_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatch_request_dismissals_select_own"
  ON public.dispatch_request_dismissals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "dispatch_request_dismissals_insert_own"
  ON public.dispatch_request_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
