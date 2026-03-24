-- Task Dispatch: optional location (GPS at send time)

ALTER TABLE public.dispatch_requests
  ADD COLUMN location_lat double precision,
  ADD COLUMN location_lng double precision;

COMMENT ON COLUMN public.dispatch_requests.location_lat IS 'Latitude at send time (optional, from geolocation).';
COMMENT ON COLUMN public.dispatch_requests.location_lng IS 'Longitude at send time (optional, from geolocation).';

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
     OR OLD.location_lat IS DISTINCT FROM NEW.location_lat
     OR OLD.location_lng IS DISTINCT FROM NEW.location_lng
  THEN
    IF NOT public.is_dev() THEN
      RAISE EXCEPTION 'Cannot modify dispatch request content';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
