-- Thread notes on Task Dispatch inbox items (Dashboard expand row).

CREATE TABLE public.dispatch_request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.dispatch_requests(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dispatch_request_notes IS 'Chronological notes on dispatch_requests; INSERT restricted to dev and dispatch group members; SELECT aligned with dispatch_requests visibility.';

CREATE INDEX idx_dispatch_request_notes_request_created
  ON public.dispatch_request_notes (request_id, created_at);

ALTER TABLE public.dispatch_request_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatch_request_notes_select"
  ON public.dispatch_request_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dispatch_requests r
      WHERE r.id = dispatch_request_notes.request_id
        AND (
          r.from_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_dispatch_group_member()
        )
    )
  );

CREATE POLICY "dispatch_request_notes_insert"
  ON public.dispatch_request_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (public.is_dev() OR public.is_dispatch_group_member())
    AND EXISTS (
      SELECT 1 FROM public.dispatch_requests r
      WHERE r.id = dispatch_request_notes.request_id
        AND (
          r.from_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_dispatch_group_member()
        )
    )
  );
