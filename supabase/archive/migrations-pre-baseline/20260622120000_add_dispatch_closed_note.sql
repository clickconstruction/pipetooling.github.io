-- Add close note to dispatch requests. Required when closing (enforced in app).
ALTER TABLE public.dispatch_requests
  ADD COLUMN closed_note text;

COMMENT ON COLUMN public.dispatch_requests.closed_note IS 'Note entered by the user who closed the request. Required when closing.';
