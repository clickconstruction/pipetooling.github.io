-- Routed travel-time cache between two jobs (Option B of the Day-view travel
-- hints). Filled ONLY by the travel-time-batch edge function (service role);
-- clients read it. The Day view falls back to the straight-line estimate
-- (src/lib/jobTravelEstimate.ts) whenever a pair is absent here.
-- Idempotent; additive.

CREATE TABLE IF NOT EXISTS public.job_travel_times (
  from_job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  to_job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  distance_meters integer NOT NULL CHECK (distance_meters >= 0),
  source text NOT NULL DEFAULT 'google_routes',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_job_id, to_job_id)
);

COMMENT ON TABLE public.job_travel_times IS
  'Routed drive-time cache between two jobs (Day-view travel hints, Option B). Written only by the travel-time-batch edge function (service role); straight-line client estimate is the fallback.';

ALTER TABLE public.job_travel_times ENABLE ROW LEVEL SECURITY;

-- All signed-in roles may read (travel hints render wherever the Day schedule
-- renders); there are deliberately NO insert/update/delete policies — writes
-- go through the edge function's service-role client only.
DROP POLICY IF EXISTS job_travel_times_select_authenticated ON public.job_travel_times;
CREATE POLICY job_travel_times_select_authenticated
  ON public.job_travel_times FOR SELECT TO authenticated USING (true);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
