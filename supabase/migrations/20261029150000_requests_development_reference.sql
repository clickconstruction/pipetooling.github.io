SET lock_timeout = '3s';

-- A question about a development (punch list #208 PR 4, v2.6047): the two request lanes take a
-- development as a reference beside a bid or a job, one reference per request, and the office team
-- reads every request that carries a reference, so a leader reads the history on a piece they did
-- not ask about and an estimator reads the questions on bids and sites. The asker's own, the dev's
-- and the lane's group's reads stay as they were.

ALTER TABLE public.estimator_requests ADD COLUMN IF NOT EXISTS development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL;
ALTER TABLE public.dispatch_requests ADD COLUMN IF NOT EXISTS development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.estimator_requests.development_id IS 'The development the question is about (v2.6047), beside bid_id and job_ledger_id: one reference per request.';
COMMENT ON COLUMN public.dispatch_requests.development_id IS 'The development the question is about (v2.6047), beside bid_id and job_ledger_id: one reference per request.';

CREATE INDEX IF NOT EXISTS estimator_requests_development_idx ON public.estimator_requests (development_id) WHERE development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dispatch_requests_development_idx ON public.dispatch_requests (development_id) WHERE development_id IS NOT NULL;

-- One reference per request, for the rows written from here on (NOT VALID: the rows already there are not re-read).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimator_requests_one_reference') THEN
    ALTER TABLE public.estimator_requests ADD CONSTRAINT estimator_requests_one_reference
      CHECK (((bid_id IS NOT NULL)::int + (job_ledger_id IS NOT NULL)::int + (development_id IS NOT NULL)::int) <= 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_requests_one_reference') THEN
    ALTER TABLE public.dispatch_requests ADD CONSTRAINT dispatch_requests_one_reference
      CHECK (((bid_id IS NOT NULL)::int + (job_ledger_id IS NOT NULL)::int + (development_id IS NOT NULL)::int) <= 1) NOT VALID;
  END IF;
END $$;

-- The widened read: the office team (gc_office_team: dev, master, assistant, controller, estimator) reads a request that carries a reference.
DROP POLICY IF EXISTS estimator_requests_select ON public.estimator_requests;
CREATE POLICY estimator_requests_select ON public.estimator_requests
  FOR SELECT TO authenticated
  USING (
    from_user_id = (SELECT auth.uid())
    OR public.is_dev()
    OR public.is_estimator_group_member()
    OR (public.gc_office_team() AND (bid_id IS NOT NULL OR job_ledger_id IS NOT NULL OR development_id IS NOT NULL))
  );

DROP POLICY IF EXISTS dispatch_requests_select ON public.dispatch_requests;
CREATE POLICY dispatch_requests_select ON public.dispatch_requests
  FOR SELECT TO authenticated
  USING (
    from_user_id = (SELECT auth.uid())
    OR public.is_dev()
    OR public.is_dispatch_group_member()
    OR (public.gc_office_team() AND (bid_id IS NOT NULL OR job_ledger_id IS NOT NULL OR development_id IS NOT NULL))
  );
