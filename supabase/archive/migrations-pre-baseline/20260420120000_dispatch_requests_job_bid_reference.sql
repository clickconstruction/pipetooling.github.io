-- Task Dispatch: optional job or bid reference + denormalized summary for inbox/push

ALTER TABLE public.dispatch_requests
  ADD COLUMN job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  ADD COLUMN bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  ADD COLUMN reference_summary text;

COMMENT ON COLUMN public.dispatch_requests.job_ledger_id IS 'Optional jobs_ledger row this dispatch refers to; mutually exclusive with bid_id.';
COMMENT ON COLUMN public.dispatch_requests.bid_id IS 'Optional bids row this dispatch refers to; mutually exclusive with job_ledger_id.';
COMMENT ON COLUMN public.dispatch_requests.reference_summary IS 'Denormalized J…/B… line from client at send time for inbox and push; informational.';

ALTER TABLE public.dispatch_requests
  ADD CONSTRAINT dispatch_requests_job_or_bid_not_both_chk
  CHECK (NOT (job_ledger_id IS NOT NULL AND bid_id IS NOT NULL));

CREATE OR REPLACE FUNCTION public.dispatch_requests_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.from_user_id IS DISTINCT FROM NEW.from_user_id
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.links IS DISTINCT FROM NEW.links
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
     OR OLD.job_ledger_id IS DISTINCT FROM NEW.job_ledger_id
     OR OLD.bid_id IS DISTINCT FROM NEW.bid_id
     OR OLD.reference_summary IS DISTINCT FROM NEW.reference_summary
  THEN
    IF NOT public.is_dev() THEN
      RAISE EXCEPTION 'Cannot modify dispatch request content';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
